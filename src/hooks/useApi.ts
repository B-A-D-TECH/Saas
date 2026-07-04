/**
 * React Hook for API calls with loading and error handling
 */

import { useState, useCallback } from "react";
import { apiFetch, ApiClientError } from "../api/client.ts";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiClientError | null;
}

interface UseApiOptions {
  autoCall?: boolean;
}

export function useApi<T = unknown>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  options?: UseApiOptions
) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: options?.autoCall ? true : false,
    error: null,
  });

  const execute = useCallback(
    async (body?: unknown) => {
      setState({ data: null, loading: true, error: null });
      try {
        const data = await apiFetch<T>(url, {
          method,
          body: body ? JSON.stringify(body) : undefined,
        });
        setState({ data, loading: false, error: null });
        return data;
      } catch (error) {
        const apiError =
          error instanceof ApiClientError
            ? error
            : new ApiClientError(500, "UNKNOWN_ERROR", String(error));
        setState({ data: null, loading: false, error: apiError });
        throw apiError;
      }
    },
    [method, url]
  );

  return { ...state, execute };
}

export function useQuery<T = unknown>(url: string) {
  return useApi<T>("GET", url, { autoCall: true });
}

export function useMutation<T = unknown>(
  method: "POST" | "PUT" | "DELETE",
  url: string
) {
  return useApi<T>(method, url);
}
