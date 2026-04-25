// client/src/lib/studio-card-buckets.ts
//
// Shared helpers for bucketing cards into dashboard surfaces (Home /
// Drafts / Ready / Sent). Kept in one place so the sidebar, Home's
// activity layout, and each filtered page all agree on the same rules.
//
// Status values on `cards.status` (as of Sprint 3+):
//   'draft'      — user hasn't completed the maker flow yet
//   'generating' — image render in progress (brief window)
//   'failed'     — generation failed; user retries from the review step
//   'completed'  — image rendered. Purchase state lives on studio_orders,
//                  NOT on cards.status — a 'completed' card may be
//                  ready-to-send (no paid order) or sent (paid order).
//
// Dashboard buckets:
//   Drafts = 'draft' | 'generating' | 'failed'       (unfinished)
//   Ready  = 'completed' AND !hasPaidOrder           (rendered, unpaid)
//   Sent   = 'completed' AND  hasPaidOrder           (rendered, paid)
//
// hasPaidOrder is derived server-side in getUserCardsForGrid via an
// EXISTS on studio_orders.payment_status='paid'. Keep the client
// logic pure-boolean so the buckets can evolve without an API change.

import type { CardGridItem } from '@shared/schema';

const DRAFT_STATUSES = new Set(['draft', 'generating', 'failed']);

export function isDraftStatus(status: string | null | undefined): boolean {
  return status != null && DRAFT_STATUSES.has(status);
}

/** A card counts as "generated" once its front has rendered. Purchase
 *  state is a separate axis — see bucketCards for the Ready/Sent split. */
export function isGeneratedStatus(status: string | null | undefined): boolean {
  if (status == null) return false;
  // Historical values 'paid' and 'purchased' appear on some legacy rows
  // where the flow did flip the cards.status column. Treat them as
  // generated too — the LEFT JOIN will still produce accurate
  // hasPaidOrder for the Ready/Sent split.
  return status === 'completed' || status === 'paid' || status === 'purchased';
}

export function bucketCards(cards: CardGridItem[]): {
  drafts: CardGridItem[];
  ready: CardGridItem[];
  sent: CardGridItem[];
} {
  const drafts: CardGridItem[] = [];
  const ready: CardGridItem[] = [];
  const sent: CardGridItem[] = [];
  for (const c of cards) {
    if (isDraftStatus(c.status)) {
      drafts.push(c);
    } else if (isGeneratedStatus(c.status)) {
      if (c.hasPaidOrder) sent.push(c);
      else ready.push(c);
    }
    // Unknown statuses fall through — not shown on any surface.
  }
  const byDateDesc = (a: CardGridItem, b: CardGridItem) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  };
  return {
    drafts: drafts.sort(byDateDesc),
    ready: ready.sort(byDateDesc),
    sent: sent.sort(byDateDesc),
  };
}

/** Derive a warm title from a card row. Mirrors card-thumbnail.tsx's
 *  deriveTitle so the dashboard reads the same across surfaces. */
export function deriveCardTitle(card: CardGridItem): string {
  const name = card.recipientName?.trim() || null;
  const occasion = card.occasion?.trim() || null;
  if (name && occasion) return `${name}'s ${occasion}`;
  if (name) return `For ${name}`;
  if (occasion) return `${occasion.charAt(0).toUpperCase()}${occasion.slice(1)} card`;
  return 'Untitled card';
}
