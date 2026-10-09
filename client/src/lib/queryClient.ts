import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * A non-2xx response as a thrown error. `.message` keeps the shapes the
 * app has always had (the server's `message`, or "404: <body>" for plain
 * text), so `err.message` call sites still work; `.status` is the new,
 * reliable bit — the retry policy below and `friendlyError()` read it
 * rather than parsing the string.
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** HTTP status off any thrown error (ApiError, a hydrated error, or a
 *  legacy "404: …" message). undefined when it isn't an HTTP failure. */
export function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const s = (err as { status?: unknown }).status;
  if (typeof s === 'number') return s;
  const m = /^(\d{3}):\s/.exec((err as { message?: unknown }).message as string ?? '');
  return m ? Number(m[1]) : undefined;
}

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
      const error = new ApiError(res.status, errorData.message || res.statusText);
      Object.assign(error, errorData);
      error.status = res.status; // never let a body field shadow the real status
      throw error;
    }

    // Plain text fallback.
    throw new ApiError(res.status, `${res.status}: ${text || res.statusText}`);
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
      // Never retry a 4xx: a 401/404 is deterministic, and retrying it
      // with backoff left broken share links and stale card ids showing
      // a spinner for 7–12 s before any message (audit 2026-10-06).
      // Network drops and 5xx still get three goes.
      retry: (failureCount, error) => {
        const status = getErrorStatus(error);
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 3;
      },
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
