import type { Request, Response } from "express";
import { portfolioService } from "./portfolio.service.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { AppError } from "../../shared/middleware/errorHandler.js";

function getUserId(req: Request): string {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return req.user.sub;
}

export const portfolioController = {
  /**
   * GET /api/v1/portfolio
   * Returns live portfolio data for all active broker accounts.
   */
  async getPortfolio(req: Request, res: Response): Promise<void> {
    const result = await portfolioService.getPortfolioForUser(getUserId(req));
    sendSuccess(res, result);
  },
};
