import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accountsRequests } from './accounts.requests'
import { localAccountsRequests } from './accounts.local.requests'
import { useAuth } from '#/shared/hooks/useAuth'
import type {
  CreateAccountPayload,
  UpdateAccountPayload,
} from './accounts.requests'

export const accountsQueryKeys = {
  all: ['accounts'] as const,
  list: (page: number, limit: number) =>
    ['accounts', 'list', page, limit] as const,
  detail: (id: string) => ['accounts', 'detail', id] as const,
}

export function useAccounts(page = 1, limit = 20) {
  const { isAuthenticated } = useAuth()
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests
  
  return useQuery({
    queryKey: accountsQueryKeys.list(page, limit),
    queryFn: () => requests.list(page, limit),
    // Keep query fresh for the session as account detail doesnot change
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useAccount(id: string) {
  const { isAuthenticated } = useAuth()
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests
  
  return useQuery({
    queryKey: accountsQueryKeys.detail(id),
    queryFn: () => requests.getById(id),
    enabled: Boolean(id),
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests

  return useMutation({
    mutationFn: (payload: CreateAccountPayload) =>
      requests.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all })
    },
  })
}

export function useUpdateAccount(options?: {
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAccountPayload }) =>
      requests.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all })
      options?.onSuccess?.()
    },
    onError: (error: Error) => {
      options?.onError?.(error)
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests

  return useMutation({
    mutationFn: (id: string) => requests.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all })
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
  const { isAuthenticated } = useAuth()
  const requests = isAuthenticated ? accountsRequests : localAccountsRequests

  return useQuery({
    queryKey: ['accounts', 'banks', accountId],
    queryFn: () => requests.fetchBanksForAccount(accountId),
    enabled: Boolean(accountId),
  })
}
