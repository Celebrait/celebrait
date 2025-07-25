import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Robust API request with retry mechanism for development environment instability
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  retryCount = 0,
  maxRetries = 3
): Promise<Response> {
  console.log(`[DEBUG] Making API request to: ${url} (attempt ${retryCount + 1}/${maxRetries + 1})`);
  
  try {
    // Create AbortController for timeout handling
    const controller = new AbortController();
    
    // Determine appropriate timeout based on endpoint
    const isImageGeneration = url.includes('edit-scene') || 
                             url.includes('generate-inside-card') || 
                             url.includes('transform-style') || 
                             url.includes('generate-images');
    
    const timeout = isImageGeneration ? 180000 : 30000; // 3 minutes for image generation, 30s for others
    console.log(`[DEBUG] Using ${timeout/1000}s timeout for ${isImageGeneration ? 'image generation' : 'regular'} endpoint: ${url}`);
    const timeoutId = setTimeout(() => {
      console.log(`[DEBUG] Request timed out after ${timeout/1000}s: ${url}`);
      controller.abort();
    }, timeout);
    
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        ...(data ? {} : {})
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: controller.signal,
      keepalive: true, // Helps maintain connection for long requests
    });

    clearTimeout(timeoutId);
    console.log(`[DEBUG] API response received: ${url} - Status: ${res.status}`);
    
    // Check if response is actually JSON
    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      console.error(`[DEBUG] Non-JSON response received: ${contentType}`);
      throw new Error(`Server returned non-JSON response: ${contentType}`);
    }
    
    // For image generation endpoints, verify the response is complete
    if (isImageGeneration) {
      const contentLength = res.headers.get('content-length');
      console.log(`[DEBUG] Image generation response - Content-Length: ${contentLength}`);
      
      // Clone response to check if it's readable
      const testRes = res.clone();
      try {
        const testText = await testRes.text();
        if (!testText || testText.length < 10) {
          throw new Error(`Incomplete response received: ${testText.length} bytes`);
        }
        console.log(`[DEBUG] Response verification passed: ${testText.length} bytes`);
      } catch (verifyError: any) {
        console.error(`[DEBUG] Response verification failed:`, verifyError.message);
        throw new Error(`Response verification failed: ${verifyError.message}`);
      }
    }
    
    await throwIfResNotOk(res);
    return res;
  } catch (error: any) {
    console.error(`[DEBUG] API request failed (attempt ${retryCount + 1}): ${url} - ${error.message}`);
    
    // Check if this is a retryable error
    const isRetryableError = 
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('AbortError') ||
      error.message?.includes('non-JSON response') ||
      error.name === 'AbortError';
    
    // For image generation endpoints, be more aggressive with retries since server often completes successfully
    const isImageGenerationEndpoint = url.includes('edit-scene') || 
                                     url.includes('generate-inside-card') || 
                                     url.includes('transform-style') || 
                                     url.includes('generate-images');
    const effectiveMaxRetries = isImageGenerationEndpoint ? 5 : maxRetries;
    
    // Retry logic for development environment instability
    if (isRetryableError && retryCount < effectiveMaxRetries) {
      // For image generation, add longer delays to let server fully complete
      const baseDelay = isImageGenerationEndpoint ? 2000 : 1000;
      const delay = Math.min(baseDelay * Math.pow(2, retryCount), isImageGenerationEndpoint ? 15000 : 8000);
      console.log(`[DEBUG] Retrying API request after ${delay}ms delay... (${retryCount + 1}/${effectiveMaxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return apiRequest(method, url, data, retryCount + 1, effectiveMaxRetries);
    }
    
    throw error;
  }
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
    
    // Preserve important delivery flow data before clearing
    const preserveKeys = ['selectedDeliveryType', 'deliverTo'];
    const preservedData: { [key: string]: string | null } = {};
    
    preserveKeys.forEach(key => {
      try {
        preservedData[key] = sessionStorage.getItem(key);
      } catch (e) {
        // Ignore errors reading individual keys
      }
    });
    
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
    
    // Restore preserved delivery flow data
    preserveKeys.forEach(key => {
      if (preservedData[key] !== null) {
        try {
          sessionStorage.setItem(key, preservedData[key]);
        } catch (e) {
          // Ignore errors restoring individual keys
        }
      }
    });
    
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

// Emergency storage cleanup for critical navigation points
export function emergencyStorageCleanup() {
  try {
    // Clear all caches immediately
    clearCacheForPayment();
    
    // Clear any IndexedDB storage
    if ('indexedDB' in window) {
      indexedDB.databases().then(databases => {
        databases.forEach(db => {
          if (db.name && (db.name.includes('keyval') || db.name.includes('react-query'))) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      }).catch(() => {});
    }
    
    // Clear service worker caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      }).catch(() => {});
    }
    
    // Force immediate garbage collection
    if (window.gc) {
      window.gc();
    }
    
    console.log('Emergency storage cleanup completed');
    return true;
  } catch (error) {
    console.warn('Emergency cleanup failed:', error);
    return false;
  }
}
