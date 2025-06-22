import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
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
      retry: (failureCount, error) => {
        // Don't retry on quota exceeded errors
        if (error.message?.includes('QuotaExceededError')) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

// Helper function to clear cache before payment to prevent quota errors
export function clearCacheForPayment() {
  try {
    // Clear all React Query caches aggressively
    queryClient.clear();
    queryClient.removeQueries();
    queryClient.invalidateQueries();
    
    // Clear all localStorage and sessionStorage
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('Could not clear localStorage:', e);
    }
    
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn('Could not clear sessionStorage:', e);
    }
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
    
    console.log('Aggressive cache clearing completed for payment processing');
  } catch (error) {
    console.warn('Cache clearing failed:', error);
  }
}

// Check storage quota and clear if approaching limit
function checkStorageQuota() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    navigator.storage.estimate().then(estimate => {
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const usagePercentage = (usage / quota) * 100;
      
      if (usagePercentage > 80) { // If using more than 80%
        console.warn('Storage quota approaching limit, clearing cache');
        clearCacheForPayment();
      }
    });
  }
}

// Enhanced error handler for quota errors
export function handleQuotaError(error: Error) {
  if (error.message && error.message.includes('quota')) {
    console.error('Quota exceeded, attempting recovery');
    clearCacheForPayment();
    
    // Wait a moment then reload the page to ensure clean state
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
    return true; // Handled
  }
  return false; // Not handled
}

// Monitor storage usage periodically
setInterval(checkStorageQuota, 30000); // Check every 30 seconds
