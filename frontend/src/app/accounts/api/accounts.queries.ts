import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accountsRequests } from './accounts.requests'
import { localAccountsRequests } from './accounts.local.requests'
import { accountsStore } from './accounts.store'
import { useAuth } from '#/shared/hooks/useAuth'
import type {
  CreateAccountPayload,
  UpdateAccountPayload,
} from './accounts.requests'
import { queryClient } from '#/integrations/tanstack-query/root-provider'

/**
 * Re-fetches all accounts from the server into the TanStack Query cache,
 * which also updates the in-memory store via the useAccounts side-effect.
 * Using queryClient.fetchQuery means the result is cached and deduped.
 */
async function refreshStore(userId: string): Promise<void> {
  try {
    const data = await queryClient.fetchQuery({
      queryKey: accountsQueryKeys.list(userId, 1, 100),
      queryFn: () => accountsRequests.list(1, 100),
      staleTime: 0, // Force refresh after a mutation
    })
    accountsStore.set(data.data)
  } catch (e) {
    console.error('[accounts.queries] Failed to refresh accounts store', e)
  }
}

export const accountsQueryKeys = {
  all: (userId: string) => ['accounts', userId] as const,
  list: (userId: string, page: number, limit: number) =>
    ['accounts', userId, 'list', page, limit] as const,
  detail: (userId: string, id: string) => ['accounts', userId, 'detail', id] as const,
}

export function useAccounts(page = 1, limit = 20) {
  const { isAuthenticated, user } = useAuth()
  const userId = user?.id || 'guest'
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests

  const query = useQuery({
    queryKey: accountsQueryKeys.list(userId, page, limit),
    queryFn: () => requests.list(page, limit),
    // Keep cached for the whole session — accounts don't change without
    // an explicit mutation which will invalidate this key.
    staleTime: Infinity,
    gcTime: Infinity,
  })

  // Keep the in-memory accountsStore in sync whenever accounts are fetched
  // or returned from cache. This ensures browser-direct MeroShare requests
  // always have fresh credentials without an extra network call.
  useEffect(() => {
    if (isAuthenticated && query.data) {
      accountsStore.set(query.data.data)
    }
  }, [isAuthenticated, query.data])

  return query
}

export function useAccount(id: string) {
  const { isAuthenticated, user } = useAuth()
  const userId = user?.id || 'guest'
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests
  
  return useQuery({
    queryKey: accountsQueryKeys.detail(userId, id),
    queryFn: () => requests.getById(id),
    enabled: Boolean(id),
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  const { isAuthenticated, user } = useAuth()
  const userId = user?.id || 'guest'
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests

  return useMutation({
    mutationFn: (payload: CreateAccountPayload) =>
      requests.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all(userId) })
      // Keep browser-direct MeroShare requests in sync.
      if (isAuthenticated) void refreshStore(userId)
    },
  })
}

export function useUpdateAccount(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  const { isAuthenticated, user } = useAuth()
  const userId = user?.id || 'guest'
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAccountPayload }) =>
      requests.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all(userId) })
      // Keep browser-direct MeroShare requests in sync.
      if (isAuthenticated) void refreshStore(userId)
      options?.onSuccess?.()
    },
    onError: (error: Error) => {
      options?.onError?.(error)
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  const { isAuthenticated, user } = useAuth()
  const userId = user?.id || 'guest'
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests

  return useMutation({
    mutationFn: (id: string) => requests.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all(userId) })
      // Keep browser-direct MeroShare requests in sync.
      if (isAuthenticated) void refreshStore(userId)
    },
  })
}

export function useFetchMeroshareBanks() {
  const { isAuthenticated } = useAuth()
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests

  return useMutation({
    mutationFn: (
      payload: Pick<CreateAccountPayload, 'clientId' | 'username' | 'password'>,
    ) => requests.fetchMeroshareBanks(payload),
  })
}

export function useAccountBanks(accountId: string) {
  const { isAuthenticated, user } = useAuth()
  const userId = user?.id || 'guest'
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests

  return useQuery({
    queryKey: ['accounts', userId, 'banks', accountId],
    queryFn: () => requests.fetchBanksForAccount(accountId),
    enabled: Boolean(accountId),
  })
}
