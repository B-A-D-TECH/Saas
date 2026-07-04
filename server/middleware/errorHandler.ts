import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/errors";

/**
 * Global error handling middleware
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("Error:", err);

  // Handle ApiError
  if (err instanceof ApiError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // Handle Zod validation errors
  if (err instanceof Error && err.name === "ZodError") {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: err.message,
      },
    });
    return;
  }

  // Handle other errors
  if (err instanceof Error) {
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
      },
    });
    return;
  }

  // Unknown error
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unknown error occurred",
    },
  });
}

/**
 * Async wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
