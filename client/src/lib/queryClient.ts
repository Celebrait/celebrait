import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();

    // Try to parse as structured JSON error.
    let errorData: any = null;
    try {
      errorData = JSON.parse(text);
    } catch {
      // Not JSON — fall through to plain text error.
    }

    if (errorData && typeof errorData === 'object') {
      // Structured error — preserve all fields (kind, code,
      // modelExplanation, suggestions, etc.) on the Error object so
      // the calling mutation's onError handler can read them.
      const error = new Error(errorData.message || res.statusText);
      Object.assign(error, errorData);
      throw error;
    }

    // Plain text fallback.
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes instead of Infinity
      gcTime: 1000 * 60 * 10, // 10 minutes garbage collection
      retry: (failureCount) => failureCount < 3,
    },
    mutations: {
      retry: false,
    },
  },
});

// NOTE: a legacy "storage quota" apparatus (a 30s interval that could call
// localStorage.clear() at >80% device storage — wiping the photo-consent
// record, welcome/hint flags, etc.) was removed here 2026-07-02. It existed
// only to protect utils/image-store.ts (base64 images in localStorage),
// which is dead. React Query's own gcTime handles cache memory.
