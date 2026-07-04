/**
 * API Client Configuration
 */

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: "/auth/login",
  AUTH_LOGOUT: "/auth/logout",
  AUTH_REGISTER: "/auth/register",
  AUTH_REFRESH: "/auth/refresh",
  AUTH_ME: "/auth/me",

  // Products
  PRODUCTS_LIST: "/products",
  PRODUCTS_GET: (id: string) => `/products/${id}`,
  PRODUCTS_CREATE: "/products",
  PRODUCTS_UPDATE: (id: string) => `/products/${id}`,
  PRODUCTS_DELETE: (id: string) => `/products/${id}`,

  // Categories
  CATEGORIES_LIST: "/categories",
  CATEGORIES_GET: (id: string) => `/categories/${id}`,
  CATEGORIES_CREATE: "/categories",
  CATEGORIES_UPDATE: (id: string) => `/categories/${id}`,
  CATEGORIES_DELETE: (id: string) => `/categories/${id}`,

  // Orders
  ORDERS_LIST: "/orders",
  ORDERS_GET: (id: string) => `/orders/${id}`,
  ORDERS_CREATE: "/orders",
  ORDERS_UPDATE: (id: string) => `/orders/${id}`,

  // Users
  USERS_LIST: "/users",
  USERS_GET: (id: string) => `/users/${id}`,
  USERS_CREATE: "/users",
  USERS_UPDATE: (id: string) => `/users/${id}`,
  USERS_DELETE: (id: string) => `/users/${id}`,

  // Health
  HEALTH: "/health",
} as const;

export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
}

/**
 * Fetch wrapper with error handling and retries
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const fullUrl = `${API_CONFIG.BASE_URL}${url}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers instanceof Headers
      ? Object.fromEntries(options.headers)
      : (options.headers as Record<string, string>)),
  };

  // Add auth token if available
  const token = localStorage.getItem("auth_token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < API_CONFIG.RETRY_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      try {
        const response = await fetch(fullUrl, {
          ...options,
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data: ApiResponse<T> = await response.json();

        if (!response.ok) {
          throw new ApiClientError(
            response.status,
            data.error?.code || "UNKNOWN_ERROR",
            data.error?.message || "An error occurred",
            data.error?.context
          );
        }

        return data.data as T;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on client errors (4xx)
      if (error instanceof ApiClientError && error.statusCode < 500) {
        throw error;
      }

      if (attempt < API_CONFIG.RETRY_ATTEMPTS - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, API_CONFIG.RETRY_DELAY * Math.pow(2, attempt))
        );
      }
    }
  }

  throw lastError;
}
