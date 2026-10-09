// client/src/hooks/use-rack.ts
//
// "Are the stock cards for sale?" — THE RACK SWITCH (Aidan 2026-10-09:
// no stock at launch, and a thin rack reads as a failed shop). The flag
// rides on /api/site-lock, the request SiteGate already makes on every
// load, under the same query key, so react-query dedupes it — this never
// adds a request. Flipped at /admin/site, no deploy.

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

interface LockState { locked: boolean; allowed: boolean; hasPassword: boolean; rackEnabled?: boolean }

/** true = the rack sells; false = parked (every rack surface hides and
 *  the carousel is proof only); undefined = not known yet. Consumers
 *  treat undefined as OFF — never flash the rack. In practice SiteGate
 *  has resolved this query before any page renders, so undefined is the
 *  error case (fail to parked, like the server guards). */
export function useRackEnabled(): boolean | undefined {
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
    // The key changes when auth resolves (guest → user id); keep the last
    // answer meanwhile so an open rack never blinks shut on sign-in.
    placeholderData: keepPreviousData,
  });
  if (isError) return false;
  if (!data) return undefined;
  return data.rackEnabled === true;
}
