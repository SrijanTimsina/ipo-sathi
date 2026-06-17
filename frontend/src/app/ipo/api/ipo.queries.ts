import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ipoRequests } from "./ipo.requests";
import type { BulkApplyPayload } from "./ipo.requests";

export const ipoQueryKeys = {
  available: ["ipo", "available"] as const,
  status: (ipoId?: string, accountId?: string) => ["ipo", "status", ipoId ?? "all", accountId ?? "all"] as const,
  results: ["ipo", "results"] as const,
  capitals: ["ipo", "capitals"] as const,
  applied: ["ipo", "applied"] as const,
};

export function useAvailableIpos() {
  return useQuery({
    queryKey: ipoQueryKeys.available,
    queryFn: () => ipoRequests.listAvailable(),
    staleTime: 60_000, // 1 minute — IPO list doesn't change frequently
  });
}

export function useIpoStatus(ipoId?: string, accountId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ipoQueryKeys.status(ipoId, accountId),
    queryFn: () => ipoRequests.getStatus(ipoId, accountId),
    enabled: options?.enabled,
  });
}

export function useAllotmentResults() {
  return useQuery({
    queryKey: ipoQueryKeys.results,
    queryFn: () => ipoRequests.getResults(),
  });
}

export function useCapitals() {
  return useQuery({
    queryKey: ipoQueryKeys.capitals,
    queryFn: () => ipoRequests.getCapitals(),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours since it doesn't change
  });
}

export function useAppliedIpos() {
  return useQuery({
    queryKey: ipoQueryKeys.applied,
    queryFn: () => ipoRequests.getAppliedIpos(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useBulkApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkApplyPayload) => ipoRequests.bulkApply(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipo", "status"] });
      void queryClient.invalidateQueries({ queryKey: ipoQueryKeys.results });
    },
  });
}

export function useReapply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { accountId: string; applicantFormId: number }) => ipoRequests.reapply(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipo", "status"] });
    },
  });
}
