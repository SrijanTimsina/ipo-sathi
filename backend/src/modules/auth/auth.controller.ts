import type { Request, Response } from "express";
import { z } from "zod";
import { authService } from "./auth.service.js";
import { sendSuccess, sendError } from "../../shared/utils/response.js";
import { config } from "../../config/index.js";

const loginSchema = z.object({
  mobileNumber: z.string().min(1, "Mobile number is required"),
  password: z.string().min(1, "Password is required"),
});


export const authController = {
  async login(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((e: any) => e.message).join(", "));
      return;
    }

    const result = await authService.login(parsed.data.mobileNumber, parsed.data.password);

    sendSuccess(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const refreshToken = req.body.refreshToken;

    if (!refreshToken) {
      sendError(res, 401, "NO_REFRESH_TOKEN", "Refresh token is missing");
      return;
    }

    const result = authService.refreshAccessToken(refreshToken);
    sendSuccess(res, result);
  },

  async logout(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, { message: "Logged out successfully" });
  },
};
