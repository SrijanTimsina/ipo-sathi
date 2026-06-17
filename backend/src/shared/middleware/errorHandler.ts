import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { sendError } from "../utils/response.js";
import { config } from "../../config/index.js";

/**
 * Global error-handling middleware. Must be registered LAST in app.ts.
 * Handles Zod validation errors, known app errors, and unexpected errors.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const message = err.issues
      .map((e: any) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    sendError(res, 400, "VALIDATION_ERROR", message);
    return;
  }

  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }

  // Log unexpected errors in development
  if (config.server.nodeEnv === "development") {
    console.error("[ErrorHandler]", err);
  }

  sendError(res, 500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred");
}

/**
 * Application-level error class.
 * Throw this anywhere in the service layer to produce a typed HTTP error.
 *
 * Example:
 *   throw new AppError(404, "NOT_FOUND", "User not found");
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "AppError";
  }
}
