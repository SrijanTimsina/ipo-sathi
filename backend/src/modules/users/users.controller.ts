import type { Request, Response } from "express";
import { usersService } from "./users.service.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { AppError } from "../../shared/middleware/errorHandler.js";

/**
 * User-context controller — restricted to own profile only.
 */
export const usersController = {
  /**
   * GET /api/v1/users/me
   * Returns the currently authenticated user's profile.
   */
  async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
    }

    const user = await usersService.getOwnProfile(req.user.sub);
    sendSuccess(res, user);
  },

  /**
   * PUT /api/v1/users/me/password
   * Change own password
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
    }
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      throw new AppError(400, "VALIDATION_ERROR", "oldPassword and newPassword are required");
    }
    if (newPassword.length < 8) {
      throw new AppError(400, "VALIDATION_ERROR", "Password must be at least 8 characters long");
    }

    await usersService.changeOwnPassword(req.user.sub, oldPassword, newPassword);
    sendSuccess(res, { success: true });
  },
};
