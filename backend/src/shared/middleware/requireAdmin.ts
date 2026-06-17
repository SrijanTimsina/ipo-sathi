import type { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response.js";

/**
 * Must be used AFTER requireAuth.
 * Checks that req.user.role === 'admin'.
 * Returns 403 if the authenticated user is not an admin.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== "admin") {
    sendError(res, 403, "FORBIDDEN", "Admin access required");
    return;
  }
  next();
}
