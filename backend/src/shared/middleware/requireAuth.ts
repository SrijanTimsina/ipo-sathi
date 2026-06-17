import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { sendError } from "../utils/response.js";
import type { JwtPayload } from "../../modules/auth/auth.service.js";

/**
 * Validates the JWT Bearer token from the Authorization header.
 * Attaches decoded payload to req.user on success.
 * Returns 401 if token is missing or invalid.
 */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(_res, 401, "UNAUTHORIZED", "Missing or invalid Authorization header");
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    sendError(_res, 401, "INVALID_TOKEN", "Token is invalid or expired");
  }
}
