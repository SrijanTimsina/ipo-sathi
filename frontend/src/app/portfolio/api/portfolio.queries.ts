import { useQuery } from "@tanstack/react-query";
import { portfolioRequests } from "./portfolio.requests";
import { localPortfolioRequests } from "./portfolio.local.requests";
import { useAuth } from "#/shared/hooks/useAuth";

export const portfolioQueryKeys = {
  all: ["portfolio"] as const,
};

export function usePortfolio() {
  const { isAuthenticated } = useAuth();
  const requests = isAuthenticated ? portfolioRequests : localPortfolioRequests;

  return useQuery({
    queryKey: portfolioQueryKeys.all,
    queryFn: () => requests.getPortfolio(),
    staleTime: 0, // Always fresh — live data from MeroShare
  });
}
