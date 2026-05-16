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
  const [, navigate] = useLocation();

  // Track which cardIds we've already toasted so a single ready card
  // doesn't fire a new toast on every poll. Pure dedupe ledger — kept
  // in a ref so it never causes a re-render.
  const toastedRef = useRef<Set<number>>(new Set());

  const enabled = isAuthenticated && !isAuthLoading;

  const { data } = useQuery<UnreadResponse>({
    queryKey: [ENDPOINT],
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const unread = data?.unread ?? [];
  const hasUnread = unread.length > 0;

  // ── Toast on newly-arrived unread events ───────────────────────────
  useEffect(() => {
    if (!enabled) return;
    for (const n of unread) {
      if (toastedRef.current.has(n.cardId)) continue;
      toastedRef.current.add(n.cardId);

      const who = n.recipientName ? `for ${n.recipientName}` : '';
      const description = who
        ? `The card ${who} has arrived. Open it to see the reveal.`
        : 'Your card has arrived. Open it to see the reveal.';

      toast({
        title: '🎉 Your card is ready',
        description,
        // ToastAction = the engagement path. Click marks-seen + nav.
        // Dismissal via X leaves notifiedAt null on the server, so
        // the toast re-fires on next mount — correct behaviour for
        // "there's still a card waiting for you, here's another nudge."
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
  }, [unread, enabled, toast, queryClient, navigate]);

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
            ? '🎉 Card ready — Celebrait'
            : `🎉 ${count} cards ready — Celebrait`;
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
