// client/src/hooks/use-site-lock.ts
//
// "Is this visitor behind the pre-launch lock?" for pages that stay open
// while the site is locked (legal, contact). Same query key + fetch as
// SiteGate, so react-query dedupes it — this never adds a request.

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

interface LockState { locked: boolean; allowed: boolean; hasPassword: boolean }

/** True while the site is locked AND this visitor isn't let through
 *  (admins and password holders are `allowed`). Unknown → false, so the
 *  long-lived post-launch state never flashes the minimal chrome. */
export function useSiteLocked(): boolean {
  const { user } = useAuth();
  const { data, isError } = useQuery<LockState>({
    queryKey: ['/api/site-lock', (user as { id?: string } | null | undefined)?.id ?? 'guest'],
    queryFn: async () => {
      const r = await fetch('/api/site-lock', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    staleTime: 60_000,
    retry: 1,
  });
  // The gate fails OPEN on error (site-gate.tsx, launch audit 2026-10-06);
  // match it so the chrome agrees with the page.
  if (isError) return false;
  return !!data && data.locked && !data.allowed;
}
