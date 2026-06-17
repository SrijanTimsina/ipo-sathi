import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminUsersRequests } from './users.requests'
import type { CreateUserPayload, UpdateUserPayload } from './users.requests'

export const adminUsersQueryKeys = {
  all: ['admin', 'users'] as const,
  list: (page: number, limit: number, search?: string) =>
    ['admin', 'users', 'list', page, limit, search ?? ''] as const,
  detail: (id: string) => ['admin', 'users', 'detail', id] as const,
  accounts: (userId: string) => ['admin', 'users', userId, 'accounts'] as const,
}

export function useAdminUsers(page = 1, limit = 20, search?: string) {
  return useQuery({
    queryKey: adminUsersQueryKeys.list(page, limit, search),
    queryFn: () => adminUsersRequests.list(page, limit, search),
  })
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: adminUsersQueryKeys.detail(id),
    queryFn: () => adminUsersRequests.getById(id),
    enabled: Boolean(id),
  })
}

export function useAdminCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateUserPayload) =>
      adminUsersRequests.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminUsersQueryKeys.all })
    },
  })
}

export function useAdminUpdateUser(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateUserPayload) =>
      adminUsersRequests.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminUsersQueryKeys.all })
      void queryClient.invalidateQueries({
        queryKey: adminUsersQueryKeys.detail(id),
      })
    },
  })
}

export function useAdminSetUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminUsersRequests.setStatus(id, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminUsersQueryKeys.all })
    },
  })
}

export function useAdminDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminUsersRequests.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminUsersQueryKeys.all })
    },
  })
}

export function useAdminUserAccounts(userId: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: adminUsersQueryKeys.accounts(userId),
    queryFn: () => adminUsersRequests.getUserAccounts(userId, page, limit),
    enabled: Boolean(userId),
  })
}
