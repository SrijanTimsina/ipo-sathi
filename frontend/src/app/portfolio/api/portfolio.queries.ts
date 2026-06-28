import { useQuery } from "@tanstack/react-query";
import { portfolioRequests } from "./portfolio.requests";
import { localPortfolioRequests } from "./portfolio.local.requests";
import { portfolioCloudRequests } from "./portfolio.cloud.requests";
import { useAuth } from "#/shared/hooks/useAuth";

export const portfolioQueryKeys = {
  all: ["portfolio"] as const,
};

export function usePortfolio() {
  const { isAuthenticated } = useAuth();
  // Authenticated users go browser-direct to MeroShare; guests use local accounts.
  const requests = isAuthenticated ? portfolioCloudRequests : localPortfolioRequests;

  return useQuery({
    queryKey: portfolioQueryKeys.all,
    queryFn: () => requests.getPortfolio(),
    staleTime: 0, // Always fresh — live data from MeroShare
  });
}

// Keep a direct export for any code that explicitly needs the server-side path.
export { portfolioRequests };
