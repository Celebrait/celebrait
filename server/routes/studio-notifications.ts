// server/routes/studio-notifications.ts
//
// In-app "your card is ready" notifications for the sender.
//
// Why a dedicated lightweight endpoint:
//   • Studio generations take 4–8 minutes end-to-end on `gpt-image-2`
//     at quality=high. Real users navigate away during the wait —
//     dashboard, address book, a non-Studio tab, or close the tab
//     entirely.
//   • The drop-off email already covers the tab-closed case (~24h+).
//     This endpoint covers the still-in-the-app case: the user has
//     come back to a Studio page and we should clearly say "your card
//     is ready — go look."
//   • The full draft poll endpoint (/api/studio/drafts/:id) is ~1s
//     server-side and ships the entire payload. Cross-app polling
//     should not pay that cost just to say "anything ready?".
//
// Persistence model — single column on `cards`:
//   notifiedAt: timestamp | null
//     null     → finished generation, sender hasn't acknowledged
//     non-null → already shown the in-app moment, don't fire again
//
// "Acknowledged" today means any of:
//   • toast was clicked or dismissed
//   • user opened the card-view page for an unread card
//   • user explicitly hit a "mark all seen" button (future)
//
// One-shot semantics: this is the "your generation just finished"
// moment. Once stamped it never reverts — even a regenerate doesn't
// re-arm the notification (regens happen mid-edit, not as the
// reveal moment we're celebrating here).
//
// Note: we intentionally do NOT layer this onto a generic
// `notifications` table yet. One event type doesn't justify the
// infrastructure. When we add a second type (orders shipped, reminders
// fired, etc.) the migration is mechanical.

import type { Express, Request, Response } from 'express';
import { and, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { cards } from '@shared/schema';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';
import { publicImageUrl } from '../image-storage';

function getUserId(req: Request): string | null {
  const id = (req as any).session?.otpUserId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Hard cap on how many unread items we return per call. The cross-app
 *  poll only needs to know "is there anything? what's the most recent?"
 *  — paginating beyond this isn't useful. If a user somehow accumulates
 *  more than 10 unread "ready" cards, they'll see the most recent and
 *  the rest stay unread until they get to them. */
const UNREAD_LIMIT = 10;

/** TTL window for "unread" eligibility. Cards completed older than
 *  this stop firing toasts even if `notifiedAt` is still null. Without
 *  this, cards from days/weeks ago that the user X-dismissed (rather
 *  than clicked-through) keep re-toasting on every page reload. 48h
 *  is the right window — newly-completed cards are still relevant
 *  enough to nudge, anything older is something the user has actively
 *  chosen not to engage with.
 *
 *  Note: `notifiedAt` stays null in the DB even when older cards age
 *  out of this window. That preserves the dashboard's "Just finished"
 *  badge logic (which uses isJustFinished derived from notifiedAt) for
 *  any card that was never explicitly viewed — it just stops the toast
 *  from firing. */
const UNREAD_TTL_HOURS = 48;

export function registerStudioNotificationRoutes(app: Express) {
  // ── GET /api/studio/notifications/unread ─────────────────────────
  // Cheap status check. Single indexed query against cards. Used by
  // useCardReadyNotifications() polling every 30s while the user is
  // inside /studio/*. Returns just enough to render the toast — no
  // attempts, no conversation state, no failure metadata.
  app.get(
    '/api/studio/notifications/unread',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      try {
        // Only return cards completed within the TTL window — see the
        // UNREAD_TTL_HOURS comment for why.
        const cutoff = new Date(Date.now() - UNREAD_TTL_HOURS * 60 * 60 * 1000);

        // CRITICAL: do NOT select cards.conversationData here. That JSONB
        // column historically holds multi-MB base64 photo blobs on legacy
        // rows (same trap the dashboard `CardGridItem` projection calls
        // out in shared/schema.ts:145). Pulling it over the Neon
        // WebSocket every 30s poll was the root cause of 3-second
        // notification calls. Extract just the two scalar strings we
        // actually need with Postgres JSON path operators so the wire
        // payload stays tiny (~200 bytes/row instead of MBs).
        //
        // `->'recipient'->>'name'` returns NULL if `recipient` is
        // missing or if `name` isn't a string — same graceful fallback
        // the previous JS guards gave us.
        // Two classes of "there's something for you" event, unified into
        // one cheap poll:
        //   • completed  → the one-shot reveal celebration. Deduped via
        //     notifiedAt (stamped when the user engages), so it fires once.
        //   • front-ready / inside-ready → the front-first flow PAUSES in
        //     these states waiting for the user to come approve a side.
        //     These are LIVE actionable states (they clear themselves the
        //     moment the card advances), so they intentionally ignore
        //     notifiedAt — that column is reserved for the completion
        //     celebration. Client-side dedupe (per cardId+status, plus
        //     "am I already on this card?") keeps them from spamming.
        const rows = await db
          .select({
            cardId: cards.id,
            status: cards.status,
            recipientName: sql<string | null>`${cards.conversationData}->'recipient'->>'name'`,
            occasion: sql<string | null>`${cards.conversationData}->'recipient'->>'occasion'`,
            frontImagePath: cards.frontImagePath,
            frontImageUrl: cards.frontImageUrl,
            createdAt: cards.createdAt,
          })
          .from(cards)
          .where(
            and(
              eq(cards.userId, userId),
              gte(cards.createdAt, cutoff),
              or(
                and(eq(cards.status, 'completed'), isNull(cards.notifiedAt)),
                inArray(cards.status, ['front-ready', 'inside-ready']),
              ),
            ),
          )
          .orderBy(desc(cards.createdAt))
          .limit(UNREAD_LIMIT);

        // Normalise: trim whitespace on the name (Postgres doesn't trim
        // for us) and prefer the disk-served /images/ path over any
        // legacy base64 data: URL stashed in frontImageUrl.
        const unread = rows.map((r) => ({
          cardId: r.cardId,
          status: r.status,
          recipientName: r.recipientName?.trim() || null,
          occasion: r.occasion || null,
          frontImageUrl: r.frontImagePath
            ? publicImageUrl(r.frontImagePath)
            : r.frontImageUrl,
          createdAt: r.createdAt,
        }));

        res.json({ unread });
      } catch (err) {
        console.error('[notifications] GET unread failed', err);
        res.status(500).json({ message: 'Failed to load notifications' });
      }
    },
  );

  // ── POST /api/studio/notifications/seen ──────────────────────────
  // Batch mark as seen. Body: { cardIds: number[] }. Used by:
  //   • toast click / dismiss → mark the single card
  //   • card-view mount for an unread card → mark on view
  //   • future "mark all seen" UX → batch the visible IDs
  //
  // Idempotent — re-marking an already-seen card is a no-op (the
  // notifiedAt column gets a fresh timestamp but no behavioural
  // change, and we keep the IS NULL filter on the unread endpoint).
  app.post(
    '/api/studio/notifications/seen',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const cardIds = Array.isArray(req.body?.cardIds)
        ? (req.body.cardIds as unknown[])
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n))
        : [];

      if (cardIds.length === 0) {
        return res.status(400).json({ message: 'No cardIds provided' });
      }

      try {
        // Ownership-gated update — the WHERE userId clause ensures a
        // user can't mark someone else's card as seen even if they
        // guess the id.
        const result = await db
          .update(cards)
          .set({ notifiedAt: new Date() })
          .where(
            and(
              eq(cards.userId, userId),
              inArray(cards.id, cardIds),
              isNull(cards.notifiedAt),
            ),
          )
          .returning({ id: cards.id });

        res.json({ marked: result.map((r) => r.id) });
      } catch (err) {
        console.error('[notifications] POST seen failed', err);
        res.status(500).json({ message: 'Failed to mark seen' });
      }
    },
  );
}
