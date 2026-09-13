// client/src/hooks/use-card-ready-notifications.tsx
//
// Studio notifications driver (Tier 2). Mounted once via the header
// <NotificationBell />. Responsibilities:
//
//   1. Poll /api/studio/notifications/unread every 30s while signed in.
//      Returns the unread feed — completed reveals + front-first
//      await-sign-off states (front-ready / inside-ready) — newest first.
//
//   2. Expose that feed (`items` + `unreadCount`) for the BELL, which is
//      the calm, persistent home for this state. A returning user with
//      work in flight just sees a quiet badge — NOT a wall of toasts.
//
//   3. Toast ONLY on genuine transitions that happen WHILE the user is in
//      the app (a card finishing, a front becoming ready). The backlog
//      present on entry is never toasted — it lives in the bell. This is
//      the key behaviour change from the Tier-1 "toast everything on
//      entry" model that buried the screen.
//
//   4. Tab-title flicker when backgrounded with unread items.
//
// Intentionally NOT done: browser push / SSE. 30s polling is fine
// pre-launch. The "seen" model is still the single `cards.notifiedAt`
// column (completed only); await states clear themselves when the card
// advances. A generic notifications table is the durable upgrade.

import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

export interface StudioNotification {
  cardId: number;
  /** 'completed' (reveal celebration) | 'front-ready' | 'inside-ready'
   *  (front-first await-sign-off states). */
  status: string;
  recipientName: string | null;
  occasion: string | null;
  frontImageUrl: string | null;
  createdAt: string;
}

interface UnreadResponse {
  unread: StudioNotification[];
}

const POLL_INTERVAL_MS = 30_000;

const ENDPOINT = '/api/studio/notifications/unread';
const SEEN_ENDPOINT = '/api/studio/notifications/seen';

export function useStudioNotifications() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location, navigate] = useLocation();

  // Keys (cardId:status) known as of the previous poll. Anything not in
  // here on a later poll is a genuine NEW transition worth a toast. Seeded
  // on the first poll so the entry backlog is silent (bell-only).
  const knownKeysRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const enabled = isAuthenticated && !isAuthLoading;

  const { data } = useQuery<UnreadResponse>({
    queryKey: [ENDPOINT],
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
    staleTime: POLL_INTERVAL_MS,
  });

  const items = data?.unread ?? [];
  const unreadCount = items.length;
  const hasUnread = unreadCount > 0;

  // ── Toast ONLY on genuine new transitions (not the entry backlog) ──
  useEffect(() => {
    if (!enabled || !data) return;
    const current = data.unread;
    const currentKeys = new Set(current.map((n) => `${n.cardId}:${n.status}`));

    // First poll → seed the ledger and stay silent. The bell shows the
    // backlog; we don't toast a user about state that was already there.
    if (!initializedRef.current) {
      initializedRef.current = true;
      knownKeysRef.current = currentKeys;
      return;
    }

    // Items that appeared since the last poll (and aren't for the card the
    // user is already on) = real-time transitions worth a single toast.
    const fresh = current.filter((n) => {
      const key = `${n.cardId}:${n.status}`;
      return (
        !knownKeysRef.current.has(key) &&
        !location.includes(`/card/${n.cardId}`)
      );
    });
    knownKeysRef.current = currentKeys;

    for (const n of fresh) {
      const who = n.recipientName?.trim() || null;
      if (n.status === 'completed') {
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
      } else {
        const side = n.status === 'front-ready' ? 'front' : 'inside';
        toast({
          title: who ? `${who}'s ${side} is ready` : `Your ${side} is ready`,
          description: `Come take a look and sign off the ${side}.`,
          variant: 'info',
          action: (
            <ToastAction
              altText={`Review the ${side}`}
              onClick={() => navigate(`/studio/card/${n.cardId}/edit`)}
            >
              Review it
            </ToastAction>
          ),
        });
      }
    }
  }, [data, enabled, toast, queryClient, navigate, location]);

  // ── Tab-title flicker when backgrounded AND has unread ─────────────
  useEffect(() => {
    if (!enabled) return;
    const originalTitle = 'Celebrait';
    const apply = () => {
      const focused = document.visibilityState === 'visible';
      if (!focused && hasUnread) {
        document.title =
          unreadCount === 1
            ? '✨ Something’s waiting — Celebrait'
            : `✨ ${unreadCount} waiting — Celebrait`;
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
  }, [hasUnread, unreadCount, enabled]);

  return { items, unreadCount, hasUnread };
}

/** Fire-and-forget mark-seen with optimistic cache update. Used by the
 *  bell, the card-ready toast, and the card-view page on mount. */
async function markSeen(
  cardIds: number[],
  queryClient: QueryClient,
): Promise<void> {
  queryClient.setQueryData<UnreadResponse>([ENDPOINT], (prev) => {
    if (!prev) return prev;
    return { unread: prev.unread.filter((n) => !cardIds.includes(n.cardId)) };
  });

  try {
    await apiRequest('POST', SEEN_ENDPOINT, { cardIds });
    queryClient.invalidateQueries({ queryKey: ['/api/user/cards'] });
  } catch (err) {
    console.warn('[notifications] mark-seen failed', err);
  }
}

/** Stamp a card's "ready" notification seen — used by the card-view page
 *  on mount and the maker when it reveals a completed card. Idempotent
 *  (server filters on notifiedAt IS NULL). */
export function useMarkCardSeen() {
  const queryClient = useQueryClient();
  return (cardId: number) => {
    void markSeen([cardId], queryClient);
  };
}
