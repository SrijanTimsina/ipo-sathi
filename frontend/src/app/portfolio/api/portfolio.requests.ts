import { apiClient } from "#/shared/lib/axios";
import type { ApiSuccess, PortfolioResponse } from "#/shared/types/api";

export const portfolioRequests = {
  async getPortfolio(): Promise<PortfolioResponse> {
    const res = await apiClient.get<ApiSuccess<PortfolioResponse>>("/portfolio");
    return res.data.data;
  },
};
