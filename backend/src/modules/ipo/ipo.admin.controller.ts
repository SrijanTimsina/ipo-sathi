import type { Request, Response } from "express";
import { z } from "zod";
import { ipoService } from "./ipo.service.js";
import { sendSuccess, sendError } from "../../shared/utils/response.js";
import { AppError } from "../../shared/middleware/errorHandler.js";

const userIdSchema = z.object({
  userId: z.string().uuid(),
});

export const ipoAdminController = {
  /**
   * GET /api/v1/admin/ipo?userId=:userId
   * View IPO activity (applications, statuses, results) for any user.
   */
  async getActivityForUser(req: Request, res: Response): Promise<void> {
    const parsed = userIdSchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, 400, "VALIDATION_ERROR", "userId query param (UUID) is required");
      return;
    }
    const applications = await ipoService.getActivityForUser(parsed.data.userId);
    sendSuccess(res, applications);
  },
};
