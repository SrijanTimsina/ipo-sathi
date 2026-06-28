import { createContext, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  apiClient,
  setAccessToken,
  clearAccessToken,
  getAccessToken,
  setRefreshToken,
  clearRefreshToken,
} from '../lib/axios.js'
import type { AuthUser, ApiSuccess } from '../types/api.js'
import { queryClient } from '../../integrations/tanstack-query/root-provider.js'
import { accountsStore } from '../../app/accounts/api/accounts.store.js'
import { accountsRequests } from '../../app/accounts/api/accounts.requests.js'
import { accountsQueryKeys } from '../../app/accounts/api/accounts.queries.js'

interface LoginPayload {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (mobileNumber: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: if there's a stored token, try to fetch own profile to validate session
  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    apiClient
      .get<ApiSuccess<AuthUser>>('/users/me')
      .then((res) => {
        setUser(res.data.data)
        // Populate the in-memory accounts store so all subsequent MeroShare
        // queries can run browser-direct without a backend round-trip.
        return populateAccountsStore(res.data.data.id)
      })
      .catch(() => {
        clearAccessToken()
        clearRefreshToken()
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = useCallback(
    async (mobileNumber: string, password: string): Promise<void> => {
      const res = await apiClient.post<ApiSuccess<LoginPayload>>(
        '/auth/login',
        {
          mobileNumber,
          password,
        },
      )
      const { accessToken, refreshToken, user: authUser } = res.data.data
      setAccessToken(accessToken)
      setRefreshToken(refreshToken)
      setUser(authUser)
      // Pre-load accounts into the store immediately after login.
      await populateAccountsStore(authUser.id)
    },
    [],
  )

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      clearAccessToken()
      clearRefreshToken()
      setUser(null)
      // Clear cached accounts on logout.
      accountsStore.clear()
      queryClient.removeQueries({ queryKey: ['accounts'] })
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Fetches all broker accounts and caches them in BOTH the TanStack Query
 * cache and the in-memory `accountsStore`.
 *
 * Using `queryClient.fetchQuery` means:
 * - The result is stored under the same key as `useAccounts(1, 100)` — so
 *   any component using that hook will get an instant cache hit (no refetch).
 * - Subsequent calls while the data is still fresh are deduplicated.
 */
async function populateAccountsStore(userId: string): Promise<void> {
  try {
    const data = await queryClient.fetchQuery({
      queryKey: accountsQueryKeys.list(userId, 1, 100),
      queryFn: () => accountsRequests.list(1, 100),
      // staleTime: Infinity so repeat calls (e.g. session restore + login)
      // never trigger a second network request within the same session.
      staleTime: Infinity,
    })
    accountsStore.set(data.data)
  } catch (e) {
    console.error('[AuthContext] Failed to populate accounts store', e)
  }
}
