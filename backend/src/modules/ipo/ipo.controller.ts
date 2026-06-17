import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ipoService } from "./ipo.service.js";
import { runIpoAutomation } from "./ipo.automation.js";
import { sendSuccess, sendError } from "../../shared/utils/response.js";
import { AppError } from "../../shared/middleware/errorHandler.js";

const bulkApplySchema = z.object({
  companyShareId: z.number().int().positive(),
  ipoName: z.string().min(1),
  kittas: z.number().int().positive(),
  accountIds: z.array(z.string().uuid()).optional(),
});

const reapplySchema = z.object({
  accountId: z.string().uuid(),
  applicantFormId: z.number().int().positive(),
});

function getUserId(req: Request): string {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return req.user.sub;
}

export const ipoController = {
  /**
   * GET /api/v1/ipo
   * Returns list of currently open IPOs from MeroShare.
   */
  async listAvailable(req: Request, res: Response): Promise<void> {
    const ipos = await ipoService.getAvailableIpos(getUserId(req));
    sendSuccess(res, ipos);
  },

  /**
   * POST /api/v1/ipo/apply
   * Bulk apply for an IPO across all or selected broker accounts.
   */
  async bulkApply(req: Request, res: Response): Promise<void> {
    const parsed = bulkApplySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((e: any) => e.message).join(", "));
      return;
    }
    const result = await ipoService.bulkApply(getUserId(req), parsed.data);
    sendSuccess(res, result);
  },

  /**
   * POST /api/v1/ipo/reapply
   * Reapply for an IPO for a specific account.
   */
  async reapply(req: Request, res: Response): Promise<void> {
    const parsed = reapplySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((e: any) => e.message).join(", "));
      return;
    }
    await ipoService.reapply(getUserId(req), parsed.data.accountId, parsed.data.applicantFormId);
    sendSuccess(res, { message: "Reapplied successfully" });
  },

  /**
   * GET /api/v1/ipo/status
   * Application status for each broker account per IPO.
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    const ipoId = typeof req.query["ipoId"] === "string" ? req.query["ipoId"] : undefined;
    const accountId = typeof req.query["accountId"] === "string" ? req.query["accountId"] : undefined;
    const results = await ipoService.getApplicationStatus(getUserId(req), ipoId, accountId);
    sendSuccess(res, results);
  },

  /**
   * GET /api/v1/ipo/results
   * Allotment results (only 'allotted' records).
   */
  async getResults(req: Request, res: Response): Promise<void> {
    const results = await ipoService.getAllotmentResults(getUserId(req));
    sendSuccess(res, results);
  },

  /**
   * GET /api/v1/ipo/applied
   * Returns a unique list of IPOs the user has applied to.
   */
  async getAppliedIpos(req: Request, res: Response): Promise<void> {
    const results = await ipoService.getAppliedIpos(getUserId(req));
    sendSuccess(res, results);
  },

  /**
   * GET /api/v1/ipo/capitals
   * Returns list of capitals from MeroShare.
   */
  async getCapitals(req: Request, res: Response): Promise<void> {
    const { MeroShareClient } = await import("./ipo.meroshare.client.js");
    const client = new MeroShareClient();
    const capitals = await client.getCapitals();
    sendSuccess(res, capitals);
  },

  /**
   * Externally trigger the IPO automation process
   */
  async automate(_req: Request, res: Response, next: NextFunction) {
    try {
      // Intentionally not awaiting here to let it run in background if it takes too long
      // OR we can await it if we want to return results. Since it might take a long time,
      // it's better to start it in the background and return 202 Accepted.
      void runIpoAutomation();
      res.status(202).json({
        status: "success",
        message: "Automation process started in the background",
      });
    } catch (err) {
      next(err);
    }
  },
};
