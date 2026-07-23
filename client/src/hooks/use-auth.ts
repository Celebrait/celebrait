import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { apiRequest } from "@/lib/queryClient";

// Optimistic auth cache. The /api/auth/user fetch takes a beat (~800ms on a
// cold load), during which the header showed the logged-OUT state and then
// flipped to "Open my studio" once it resolved (Kevin 2026-07-22). We stash
// the last-known user in localStorage and seed the query with it, so a
// returning user sees the right header immediately — the real fetch then
// revalidates in the background. Only the user's own profile, on their own
// device.
const AUTH_CACHE_KEY = "celebrait:auth-user:v1";

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null): void {
  try {
    if (user) localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    /* localStorage blocked — optimistic seed just won't apply */
  }
}

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    writeCachedUser(null);
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  const user = (await response.json()) as User | null;
  writeCachedUser(user);
  return user;
}

async function logout(): Promise<void> {
  // OTP session is the only auth path; POST to destroy then hard-redirect
  // to the landing page so React Query state is also cleared.
  try {
    await fetch("/api/auth/otp/logout", { method: "POST", credentials: "include" });
  } catch {
    /* best-effort */
  }
  window.location.href = "/";
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
    // Seed from the last-known user so the header renders the correct state
    // on first paint instead of flashing logged-out. Only seed when we
    // actually have a cached user (undefined → normal loading path for a
    // genuine first visit). initialDataUpdatedAt:0 marks it stale so the
    // real fetch still runs immediately to confirm.
    initialData: () => readCachedUser() ?? undefined,
    initialDataUpdatedAt: 0,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      writeCachedUser(null);
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  const sendOtpMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/otp/send", { email });
      return res.json();
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (params: { email: string; code: string; firstName?: string; lastName?: string }) => {
      const res = await apiRequest("POST", "/api/auth/otp/verify", params);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Verification failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      writeCachedUser(data.user ?? null);
      queryClient.setQueryData(["/api/auth/user"], data.user);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    sendOtp: sendOtpMutation.mutateAsync,
    isSendingOtp: sendOtpMutation.isPending,
    verifyOtp: verifyOtpMutation.mutateAsync,
    isVerifyingOtp: verifyOtpMutation.isPending,
  };
}
