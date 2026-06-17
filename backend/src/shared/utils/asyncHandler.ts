import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler to forward errors to the next() error handler.
 * Prevents unhandled promise rejections from reaching Express.
 *
 * Usage:
 *   router.get("/path", asyncHandler(myController.method));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
