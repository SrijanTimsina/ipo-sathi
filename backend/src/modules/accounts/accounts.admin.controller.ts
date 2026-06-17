import type { Request, Response } from "express";
import { z } from "zod";
import { accountsService } from "./accounts.service.js";
import { sendSuccess, sendError } from "../../shared/utils/response.js";
import { AppError } from "../../shared/middleware/errorHandler.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const accountsAdminController = {
  /**
   * GET /api/v1/admin/users/:userId/accounts
   * Read-only view of any user's linked accounts.
   * Admin cannot add/edit/delete accounts on behalf of a user.
   */
  async listByUserId(req: Request, res: Response): Promise<void> {
    const userId = req.params.userId as string;
    if (!userId) throw new AppError(400, "MISSING_PARAM", "User ID is required");

    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((e: any) => e.message).join(", "));
      return;
    }

    const result = await accountsService.listUserAccounts(userId, parsed.data);
    sendSuccess(res, result);
  },
};
