import { createContext, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  apiClient,
  setAccessToken,
  clearAccessToken,
  getAccessToken,
} from '../lib/axios.js'
import type { AuthUser, ApiSuccess } from '../types/api.js'

interface LoginPayload {
  accessToken: string
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
      })
      .catch(() => {
        clearAccessToken()
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
      const { accessToken, user: authUser } = res.data.data
      setAccessToken(accessToken)
      setUser(authUser)
    },
    [],
  )

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      clearAccessToken()
      setUser(null)
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
