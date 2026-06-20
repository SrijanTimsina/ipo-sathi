import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountsRequests } from "./accounts.requests";
import type { CreateAccountPayload, UpdateAccountPayload } from "./accounts.requests";

export const accountsQueryKeys = {
  all: ["accounts"] as const,
  list: (page: number, limit: number) => ["accounts", "list", page, limit] as const,
  detail: (id: string) => ["accounts", "detail", id] as const,
};

export function useAccounts(page = 1, limit = 20) {
  return useQuery({
    queryKey: accountsQueryKeys.list(page, limit),
    queryFn: () => accountsRequests.list(page, limit),
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: accountsQueryKeys.detail(id),
    queryFn: () => accountsRequests.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAccountPayload) => accountsRequests.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all });
    },
  });
}

export function useUpdateAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAccountPayload) => accountsRequests.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsRequests.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.all });
    },
  });
}

export function useFetchMeroshareBanks() {
  return useMutation({
    mutationFn: (payload: Pick<CreateAccountPayload, "clientId" | "username" | "password">) => 
      accountsRequests.fetchMeroshareBanks(payload),
  });
}

export function useAccountBanks(accountId: string) {
  return useQuery({
    queryKey: ["accounts", "banks", accountId],
    queryFn: () => accountsRequests.fetchBanksForAccount(accountId),
    enabled: Boolean(accountId),
  });
}
