// client/src/hooks/use-card-ready-notifications.tsx
//
// In-app "your card is ready" notification driver. Mounted once at
// the Studio layout level. Responsible for three user-facing effects:
//
//   1. Polling for unread "your card is ready" events. Reads from
//      /api/studio/notifications/unread every 30s while the user is
//      anywhere under /studio/*. Cheap query — single indexed select
//      against `cards` — and only runs when the user is authenticated.
//
//   2. Toast on first sight of a newly-arrived unread event. Each
//      cardId is toasted at most once per component mount (a session
//      dedupe ledger lives in a ref). The toast carries a "View it"
//      action button that marks the notification seen and routes to
//      the card view page. Dismissing via X leaves `notifiedAt` null
//      — the toast re-fires on next page mount/refresh, which is the
//      right behaviour for "there's still a card waiting for you."
//
//   3. Tab-title flicker when the tab is in the background AND unread
//      events are present. Restores on focus. Works alongside the
//      drop-off email — email covers tab-closed, this covers
//      still-open-on-another-tab.
//
// What this hook intentionally does NOT do:
//   • Browser push notifications (Notification API + service worker).
//     Requires HTTPS, permission prompt, more infrastructure. Deferred
//     until there's signal from real users.
//   • Real-time push via SSE/WebSocket. 30s polling is fine pre-launch
//     and adds nothing the user can perceive. Revisit if cost reports
//     show this as a hot endpoint.
//   • Auto-mark-on-display. The toast is the celebration moment —
//     we only stamp `notifiedAt` when the user engages (action button
//     click, or card-view page mount). Dismissal via X is informal.

import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

interface UnreadNotification {
  cardId: number;
  /** 'completed' (reveal celebration) | 'front-ready' | 'inside-ready'
   *  (front-first await-sign-off nudges). */
  status: string;
  recipientName: string | null;
  occasion: string | null;
  frontImageUrl: string | null;
  createdAt: string;
}

interface UnreadResponse {
  unread: UnreadNotification[];
}

const POLL_INTERVAL_MS = 30_000;

const ENDPOINT = '/api/studio/notifications/unread';
const SEEN_ENDPOINT = '/api/studio/notifications/seen';

export function useCardReadyNotifications() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location, navigate] = useLocation();

  // Track which (cardId + status) events we've already toasted so a card
  // sitting in an actionable state doesn't re-fire on every 30s poll.
  // Keyed by `${cardId}:${status}` so a card that moves front-ready →
  // inside-ready → completed earns a fresh nudge at each stage. Pure
  // dedupe ledger — kept in a ref so it never causes a re-render.
  const toastedRef = useRef<Set<string>>(new Set());

  const enabled = isAuthenticated && !isAuthLoading;

  const { data } = useQuery<UnreadResponse>({
    queryKey: [ENDPOINT],
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
    // Match staleTime to poll interval. Without this, every navigation
    // inside /studio/* re-fires the endpoint (staleTime: 0 = always
    // stale on mount). The hook is mounted at the layout level so it
    // technically only mounts once per app load — but staleTime: 0 is
    // still wrong in spirit: we already KNOW the data is fresh for
    // ~30s because that's how often we poll. This makes any future
    // sibling consumer of the same query key a free read.
    staleTime: POLL_INTERVAL_MS,
  });

  const unread = data?.unread ?? [];
  const hasUnread = unread.length > 0;

  // ── Toast on newly-arrived unread events ───────────────────────────
  useEffect(() => {
    if (!enabled) return;

    // Ignore anything for a card the user is already looking at / editing —
    // that surface already shows the state.
    const relevant = unread.filter(
      (n) => !location.includes(`/card/${n.cardId}`),
    );

    // ── Completed: one-shot reveal celebrations. Fire individually
    //    (server-deduped via notifiedAt, so they rarely pile up). ──────
    for (const n of relevant) {
      if (n.status !== 'completed') continue;
      const key = `${n.cardId}:completed`;
      if (toastedRef.current.has(key)) continue;
      toastedRef.current.add(key);

      const who = n.recipientName?.trim() || null;
      toast({
        title: 'Your card is ready',
        variant: 'success',
        description: who
          ? `${who}'s card has arrived. Open it to see the reveal.`
          : 'Your card has arrived. Open it to see the reveal.',
        action: (
          <ToastAction
            altText="View card"
            onClick={() => {
              void markSeen([n.cardId], queryClient);
              navigate(`/studio/card/${n.cardId}`);
            }}
          >
            View it
          </ToastAction>
        ),
      });
    }

    // ── Await-sign-off (front-ready / inside-ready): COLLAPSE to a single
    //    toast. A user with several half-made cards should get one gentle
    //    nudge, not a wall. These are live-state reminders with no server
    //    dedupe, so we key on the exact SET of waiting cards — a new
    //    arrival re-nudges, the same set stays quiet for the session.
    //    (Longer term these belong in the Tier-2 bell, not a toast.) ────
    const awaiting = relevant.filter(
      (n) => n.status === 'front-ready' || n.status === 'inside-ready',
    );
    if (awaiting.length > 0) {
      const sig =
        'awaiting:' +
        awaiting
          .map((n) => `${n.cardId}:${n.status}`)
          .sort()
          .join(',');
      if (!toastedRef.current.has(sig)) {
        toastedRef.current.add(sig);
        // Feed is ordered newest-first, so awaiting[0] is the most recent.
        const newest = awaiting[0];
        if (awaiting.length === 1) {
          const side = newest.status === 'front-ready' ? 'front' : 'inside';
          const who = newest.recipientName?.trim() || null;
          toast({
            title: who ? `${who}'s ${side} is ready` : `Your ${side} is ready`,
            description: `Come take a look and sign off the ${side}.`,
            variant: 'info',
            action: (
              <ToastAction
                altText={`Review the ${side}`}
                onClick={() => navigate(`/studio/card/${newest.cardId}/edit`)}
              >
                Review it
              </ToastAction>
            ),
          });
        } else {
          toast({
            title: `${awaiting.length} cards waiting for you`,
            description: 'A few cards are ready to review and sign off.',
            variant: 'info',
            action: (
              <ToastAction
                altText="Review the newest"
                onClick={() => navigate(`/studio/card/${newest.cardId}/edit`)}
              >
                Review
              </ToastAction>
            ),
          });
        }
      }
    }
  }, [unread, enabled, toast, queryClient, navigate, location]);

  // ── Tab-title flicker when tab is in background AND has unread ─────
  useEffect(() => {
    if (!enabled) return;
    const originalTitle = 'Celebrait';

    const apply = () => {
      const focused = document.visibilityState === 'visible';
      if (!focused && hasUnread) {
        const count = unread.length;
        document.title =
          count === 1
            ? '✨ Something’s waiting — Celebrait'
            : `✨ ${count} waiting — Celebrait`;
      } else if (focused) {
        document.title = originalTitle;
      }
    };

    apply();
    document.addEventListener('visibilitychange', apply);
    return () => {
      document.removeEventListener('visibilitychange', apply);
      document.title = originalTitle;
    };
  }, [hasUnread, unread.length, enabled]);

  return { unread, hasUnread };
}

/** Fire-and-forget mark-seen with optimistic cache update. Used by the
 *  toast action button and the card-view page on mount. */
async function markSeen(
  cardIds: number[],
  queryClient: QueryClient,
): Promise<void> {
  // Optimistic update — drop the marked IDs from the unread list so
  // the UI reflects engagement immediately without waiting for poll.
  queryClient.setQueryData<UnreadResponse>([ENDPOINT], (prev) => {
    if (!prev) return prev;
    return { unread: prev.unread.filter((n) => !cardIds.includes(n.cardId)) };
  });

  try {
    await apiRequest('POST', SEEN_ENDPOINT, { cardIds });
    // Invalidate the dashboard cards query so the "Just finished"
    // violet treatment on this card's tile clears the next time the
    // user lands on the Ready / Home page. Without this the tile
    // would keep its glow until the user did a hard refresh or the
    // query's natural staleTime expired.
    queryClient.invalidateQueries({ queryKey: ['/api/user/cards'] });
  } catch (err) {
    // Next poll re-fetches authoritative state, so a swallowed error
    // costs at most one stale 30s window.
    console.warn('[notifications] mark-seen failed', err);
  }
}

/** Helper for surfaces that want to explicitly stamp a card as seen
 *  — typically the card-view page on mount. Safe to call on every
 *  mount: the server filter `WHERE notifiedAt IS NULL` makes already-
 *  seen marks a no-op. */
export function useMarkCardSeen() {
  const queryClient = useQueryClient();
  return (cardId: number) => {
    void markSeen([cardId], queryClient);
  };
}
