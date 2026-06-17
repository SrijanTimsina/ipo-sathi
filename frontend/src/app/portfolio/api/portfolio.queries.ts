import { useQuery } from "@tanstack/react-query";
import { portfolioRequests } from "./portfolio.requests";

export const portfolioQueryKeys = {
  all: ["portfolio"] as const,
};

export function usePortfolio() {
  return useQuery({
    queryKey: portfolioQueryKeys.all,
    queryFn: () => portfolioRequests.getPortfolio(),
    staleTime: 0, // Always fresh — live data from MeroShare
  });
}
