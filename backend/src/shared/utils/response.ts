import type { Response } from "express";

/**
 * Standard success response envelope.
 * { "success": true, "data": { ... } }
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): void {
  res.status(statusCode).json({ success: true, data });
}

/**
 * Standard error response envelope.
 * { "success": false, "error": { "code": "...", "message": "..." } }
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string
): void {
  res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
