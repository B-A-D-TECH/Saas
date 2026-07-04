/**
 * Centralized Error Handling for SaaS API
 */

export enum ErrorCode {
  // Auth Errors (401-403)
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",

  // Validation Errors (400)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",

  // Resource Errors (404)
  NOT_FOUND = "NOT_FOUND",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",

  // Business Logic Errors (409)
  CONFLICT = "CONFLICT",
  DUPLICATE_ENTRY = "DUPLICATE_ENTRY",
  INVALID_STATE = "INVALID_STATE",

  // Server Errors (500)
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.context && { context: this.context }),
      },
    };
  }
}

// Auth Errors
export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(ErrorCode.UNAUTHORIZED, 401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(ErrorCode.FORBIDDEN, 403, message);
  }
}

export class InvalidTokenError extends ApiError {
  constructor(message = "Invalid or expired token") {
    super(ErrorCode.INVALID_TOKEN, 401, message);
  }
}

// Validation Errors
export class ValidationError extends ApiError {
  constructor(message = "Validation failed", context?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, 400, message, context);
  }
}

// Resource Errors
export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(ErrorCode.NOT_FOUND, 404, `${resource} not found`);
  }
}

// Business Logic Errors
export class ConflictError extends ApiError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(ErrorCode.CONFLICT, 409, message, context);
  }
}

export class DuplicateEntryError extends ApiError {
  constructor(field: string) {
    super(ErrorCode.DUPLICATE_ENTRY, 409, `${field} already exists`);
  }
}

// Server Errors
export class DatabaseError extends ApiError {
  constructor(message = "Database operation failed") {
    super(ErrorCode.DATABASE_ERROR, 500, message);
  }
}

export class InternalServerError extends ApiError {
  constructor(message = "Internal server error") {
    super(ErrorCode.INTERNAL_SERVER_ERROR, 500, message);
  }
}
