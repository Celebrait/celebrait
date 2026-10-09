// server/studio/comp-code.ts
//
// Validation + consumption for comp codes. Deliberately mirrors
// free-card.ts: derive eligibility fresh at checkout-create, consume
// ONLY on the paid flip. An abandoned session must never burn a
// creator's code — they'd come back, find it dead, and we'd have made
// a bad first impression on someone we're courting.
//
// The server is the sole authority on what a code is worth. The client
// sends a string; everything else (which lines it zeroes, whether it's
// spent) is read from the database. A crafted POST can't invent a
// discount.

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { compCodes, normaliseCompCode, type CompCode } from '@shared/schema';
import type { studioOrders } from '@shared/schema';

export interface CompCodeResult {
  ok: boolean;
  /** Present when ok — the row, already checked for active/expiry/budget. */
  code?: CompCode;
  /** Why it was refused, in words we're happy to show a creator. */
  reason?: string;
}

/** Look a code up and decide whether it can be redeemed RIGHT NOW.
 *  Does not mutate anything — see consumeCompCode. */
export async function validateCompCode(raw: unknown): Promise<CompCodeResult> {
  const code = normaliseCompCode(raw);
  if (!code) return { ok: false, reason: 'Enter a valid code.' };

  const [row] = await db
    .select()
    .from(compCodes)
    .where(eq(compCodes.code, code))
    .limit(1);

  // One message for "no such code" and "switched off". Distinguishing
  // them tells a stranger which guesses were close.
  if (!row || !row.active) {
    return { ok: false, reason: "That code isn't valid." };
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'That code has expired.' };
  }
  if (row.uses >= row.maxUses) {
    return { ok: false, reason: 'That code has already been used.' };
  }
  return { ok: true, code: row };
}

/** Burn one use. Called from the paid flip, never from checkout-create.
 *
 *  The `uses < max_uses` predicate lives in the UPDATE itself so two
 *  simultaneous paid webhooks can't both take the last use — whichever
 *  loses the race updates zero rows and is logged rather than throwing.
 *  Never fail a paid flip here: the order is already paid and the card
 *  must ship regardless of our bookkeeping. */
export async function consumeCompCode(
  order: typeof studioOrders.$inferSelect,
): Promise<void> {
  if (!order.compCode) return;

  const updated = await db
    .update(compCodes)
    .set({ uses: sql`${compCodes.uses} + 1` })
    .where(
      and(
        eq(compCodes.code, order.compCode),
        sql`${compCodes.uses} < ${compCodes.maxUses}`,
      ),
    )
    .returning({ code: compCodes.code, uses: compCodes.uses });

  if (updated.length > 0) {
    console.log(
      `[COMP-CODE] ${order.compCode} consumed by order ${order.id} (use ${updated[0].uses})`,
    );
  } else {
    // Over-redeemed: the discount was already given and the card is
    // paid, so this ships anyway. Worth a loud line — it means either a
    // race we didn't foresee or a code being passed around.
    console.warn(
      `[COMP-CODE] order ${order.id} used ${order.compCode} but its budget was already spent — comped card shipped over budget`,
    );
  }
}
