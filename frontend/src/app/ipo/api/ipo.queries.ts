import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ipoRequests } from "./ipo.requests";
import { localIpoRequests } from "./ipo.local.requests";
import { useAuth } from "#/shared/hooks/useAuth";
import type { BulkApplyPayload } from "./ipo.requests";

export const ipoQueryKeys = {
  available: ["ipo", "available"] as const,
  status: (ipoId?: string, accountId?: string) => ["ipo", "status", ipoId ?? "all", accountId ?? "all"] as const,
  results: ["ipo", "results"] as const,
  capitals: ["ipo", "capitals"] as const,
  applied: ["ipo", "applied"] as const,
};

export function useAvailableIpos() {
  const { isAuthenticated } = useAuth();
  const requests = isAuthenticated ? ipoRequests : localIpoRequests;

  return useQuery({
    queryKey: ipoQueryKeys.available,
    queryFn: () => requests.listAvailable(),
    staleTime: 60_000,
  });
}

export function useIpoStatus(ipoId?: string, accountId?: string, options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const requests = isAuthenticated ? ipoRequests : localIpoRequests;

  return useQuery({
    queryKey: ipoQueryKeys.status(ipoId, accountId),
    queryFn: () => requests.getStatus(ipoId, accountId),
    enabled: options?.enabled,
  });
}

export function useAllotmentResults() {
  const { isAuthenticated } = useAuth();
  const requests = isAuthenticated ? ipoRequests : localIpoRequests;

  return useQuery({
    queryKey: ipoQueryKeys.results,
    queryFn: () => requests.getResults(),
  });
}

export function useCapitals() {
  const { isAuthenticated } = useAuth();
  const requests = isAuthenticated ? ipoRequests : localIpoRequests;

  return useQuery({
    queryKey: ipoQueryKeys.capitals,
    queryFn: () => requests.getCapitals(),
    staleTime: 1000 * 60 * 60 * 24,
  });
}

export function useAppliedIpos() {
  const { isAuthenticated } = useAuth();
  const requests = isAuthenticated ? ipoRequests : localIpoRequests;

  return useQuery({
    queryKey: ipoQueryKeys.applied,
    queryFn: () => requests.getAppliedIpos(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useBulkApply() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const requests = isAuthenticated ? ipoRequests : localIpoRequests;

  return useMutation({
    mutationFn: (payload: BulkApplyPayload) => requests.bulkApply(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipo", "status"] });
      void queryClient.invalidateQueries({ queryKey: ipoQueryKeys.results });
    },
  });
}

export function useReapply() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const requests = isAuthenticated ? ipoRequests : localIpoRequests;

  return useMutation({
    mutationFn: (payload: { accountId: string; applicantFormId: number }) => requests.reapply(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipo", "status"] });
    },
  });
}
