// server/studio/free-card.ts
//
// The free-first-card credit (Moments rewards, Kevin 2026-08-03).
//
// The deal: add 3 key dates → your first card is free (£8.99 struck to
// £0), standard postage (£3.95) still payable. Genuinely free — the CAP
// Code only allows charging the true delivery cost on a "free" offer,
// so postage is never padded to claw the card back.
//
// Design invariants:
//   • Eligibility is DERIVED, never stored: ≥3 key dates AND the user's
//     free_card_redeemed_at is null. No points ledger in V1.
//   • A "key date" mirrors what the client's progress ring counts (a
//     row in /api/user/reminders): a recipient_occasions row with a
//     stored date OR a fixed-date occasion (Christmas etc. store none).
//   • The credit is CONSUMED on the paid flip only — an applied-but-
//     abandoned checkout never burns it.
//   • One per account, enforced by the conditional users UPDATE.
//   • Free orders ship Standard only (fixed, known exposure ≈ 50–70p
//     per redemption; the faster tiers stay a paid-order thing).

import { and, eq, isNull, or, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import { users, recipientOccasions, studioOrders } from '@shared/schema';
import { FIXED_DATE_OCCASIONS } from '@shared/fixed-occasions';

/** How many key dates unlock the free card. Mirrors KEY_DATES_TARGET on
 *  the client (world-section ring / moments page). */
export const FREE_CARD_KEY_DATES = 3;

export interface FreeCardStatus {
  /** Distinct key dates the user has added (capped nowhere — raw count). */
  keyDates: number;
  /** Credit already consumed (order id on the user row). */
  redeemed: boolean;
  /** keyDates ≥ 3 AND not redeemed — apply at checkout when true. */
  eligible: boolean;
}

/** Count the user's key dates the same way the reminders feed does:
 *  occasions with a stored date, plus fixed-date occasions (Christmas,
 *  Valentine's, Mother's/Father's Day) whose date the calendar knows. */
export async function countKeyDates(userId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(recipientOccasions)
    .where(
      and(
        eq(recipientOccasions.userId, userId),
        or(
          sql`${recipientOccasions.date} IS NOT NULL`,
          inArray(recipientOccasions.occasion, Array.from(FIXED_DATE_OCCASIONS)),
        ),
      ),
    );
  return rows[0]?.n ?? 0;
}

export async function getFreeCardStatus(userId: string): Promise<FreeCardStatus> {
  const [keyDates, userRows] = await Promise.all([
    countKeyDates(userId),
    db
      .select({ redeemedAt: users.freeCardRedeemedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);
  const redeemed = !!userRows[0]?.redeemedAt;
  return {
    keyDates,
    redeemed,
    eligible: keyDates >= FREE_CARD_KEY_DATES && !redeemed,
  };
}

/** Consume the credit for a free-card order that just went PAID.
 *  Idempotent + race-safe: the conditional UPDATE only fires while
 *  free_card_redeemed_at is still null, so a second free order paying
 *  (two tabs, two cards) records nothing twice — it just logs. Called
 *  from markOrderPaidAndDispatch, never from checkout-create. */
export async function consumeFreeCardCredit(
  order: typeof studioOrders.$inferSelect,
): Promise<void> {
  if (!order.freeCardApplied || !order.userId) return;
  const updated = await db
    .update(users)
    .set({
      freeCardRedeemedAt: new Date(),
      freeCardOrderId: order.id,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, order.userId), isNull(users.freeCardRedeemedAt)))
    .returning({ id: users.id });
  if (updated.length > 0) {
    console.log(
      `[FREE-CARD] credit consumed by order ${order.id} (user ${order.userId})`,
    );
  } else {
    // Already redeemed by another order — the £8.99 was still not
    // charged on this one, so flag it for a human rather than failing
    // the paid flip (the customer HAS paid postage; the card ships).
    console.warn(
      `[FREE-CARD] order ${order.id} was free but user ${order.userId} had already redeemed — double free card went out`,
    );
  }
}
