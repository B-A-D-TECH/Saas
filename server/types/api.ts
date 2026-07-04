/**
 * API Response types
 */

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface ApiRequestContext {
  tenantId: string;
  userId: string;
  email: string;
  role: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
}

export interface ApiDataResponse<T> {
  data: T;
}

export type ApiResponse<T> = ApiDataResponse<T> | ApiErrorResponse;
