// client/src/hooks/use-beta.ts
//
// BETA TESTING (Aidan 2026-11-05: "a landing page BETA — NO payments —
// testing only — then I will lock the site down"). Two facts ride on the
// /api/site-lock request SiteGate already makes on every load (same query
// key, so react-query dedupes it):
//
//   betaMode  — the switch at /admin/site. While on, the checkout door
//               refuses everyone but admins (server/routes/site-lock.ts),
//               so every Buy CTA swaps to "give feedback".
//   beta      — THIS visitor joined at /beta (tester cookie). Testers get
//               both routes (use-maker.ts) and through the lock.
//
// Admins see the real buttons: Aidan rehearses checkout while testers
// can't reach it.
import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

interface LockState {
  locked: boolean; allowed: boolean; hasPassword: boolean;
  rackEnabled?: boolean; makerEnabled?: boolean;
  betaMode?: boolean; beta?: boolean; betaNeedsCode?: boolean;
}

function useLockState() {
  const { user } = useAuth();
  const u = user as { id?: string; isAdmin?: boolean } | null | undefined;
  const q = useQuery<LockState>({
    queryKey: ['/api/site-lock', u?.id ?? 'guest'],
    queryFn: async () => {
      const r = await fetch('/api/site-lock', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    staleTime: 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });
  return { ...q, isAdmin: u?.isAdmin === true };
}

/** Everything the /beta page needs in one go. */
export function useBetaState(): { betaMode: boolean; tester: boolean; needsCode: boolean; loaded: boolean } {
  const { data, isError } = useLockState();
  return {
    betaMode: data?.betaMode === true,
    tester: data?.beta === true,
    needsCode: data?.betaNeedsCode === true,
    loaded: !!data || isError,
  };
}

/** true = beta mode is on and this visitor is NOT an admin → no money
 *  buttons anywhere, "give feedback" in their place. */
export function useBetaMode(): boolean {
  const { data, isAdmin } = useLockState();
  if (isAdmin) return false;
  return data?.betaMode === true;
}

/** true = this visitor joined the beta at /beta. */
export function useBetaTester(): boolean {
  const { data } = useLockState();
  return data?.beta === true;
}

/** true = this visitor is a beta tester and NOT an admin → the header
 *  and footer drop every site link (Aidan 2026-11-05: "remove all other
 *  site links so nobody can fish around - inc. from the menu"). */
export function useBetaMinimalChrome(): boolean {
  const { data, isAdmin } = useLockState();
  return !isAdmin && data?.beta === true;
}

/** No sign-up for testers: mint the throwaway studio account and wait
 *  until the auth query agrees, so the next page sees them signed in. */
export async function openBetaSession(qc: QueryClient): Promise<void> {
  await apiRequest('POST', '/api/beta/session', {});
  await qc.invalidateQueries({ queryKey: ['/api/auth/user'] });
  void qc.invalidateQueries({ queryKey: ['/api/site-lock'] });
}

/** Where every "give feedback" CTA goes. */
export function betaFeedbackHref(opts: { cardId?: number | string | null; route?: 'photo' | 'maker' } = {}): string {
  const q = new URLSearchParams();
  if (opts.cardId != null && opts.cardId !== '') q.set('card', String(opts.cardId));
  if (opts.route) q.set('route', opts.route);
  const s = q.toString();
  return `/beta/feedback${s ? `?${s}` : ''}`;
}
