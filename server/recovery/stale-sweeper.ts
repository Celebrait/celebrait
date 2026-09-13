// server/recovery/stale-sweeper.ts
//
// Crash-recovery sweeps (pre-launch audit 2026-07-27, P0-2 + P0-4).
//
// Generations run in-process for 4–8 minutes and Render restarts the
// process on every deploy. Before this module, three things a restart
// left behind were TERMINAL — no cron, no user recovery, only manual SQL:
//
//   1. Cards stuck in `generating` / `generating-front` /
//      `generating-inside` forever (the client poll has no timeout — the
//      progress bar just sits at "almost there"). The retry routes are
//      status-gated so the user has no escape.
//   2. Regen attempts stuck at status 'generating', which 409-block that
//      side's regenerate route permanently ("already in progress").
//   3. PAID orders whose Prodigi submission failed or never ran
//      (crash between the paid-flip and submitOrder): money taken,
//      nothing prints, silence.
//
// Sweep design:
//   • Cards: `cards` has no updatedAt, so age can't be used. Instead the
//     in-flight registry (server/generation-registry.ts) marks every card
//     with a LIVE generation in THIS process; anything in `generating*`
//     that is NOT registered has no living generation behind it
//     (generations never survive a restart) and flips to failed with the
//     standard friendly failure fields — the existing failure panel +
//     retry UI takes over from there.
//     The FIRST sweep is delayed 8 minutes after boot: during a
//     zero-downtime deploy the dying twin instance may still be
//     mid-generation on a card this process has never seen; by +8 min its
//     run has either completed (status moved on — not swept) or died
//     (correctly swept).
//   • Attempts: `card_attempts.created_at` IS the attempt start, so plain
//     age works: 'generating' older than 10 min (in-process watchdog is
//     6 min) is dead.
//   • Orders: paid + includes_print + providerOrderId IS NULL + not
//     touched for 10 min → re-run submitPrintOrder (which re-checks
//     providerOrderId, so this can never double-submit). Alert the
//     operator if a re-drive fails again.

import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { cards, cardAttempts, studioOrders } from '@shared/schema';
import { inFlightCards } from '../generation-registry';
import { submitPrintOrder } from '../routes/studio-checkout';
import { sendAdminAlertEmail } from '../email-service';

const GENERATING_STATUSES = ['generating', 'generating-front', 'generating-inside'];
const ATTEMPT_STALE_MS = 10 * 60 * 1000;
const ORDER_STALE_MS = 10 * 60 * 1000;
const FIRST_SWEEP_DELAY_MS = 8 * 60 * 1000;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

/** Friendly failure payload for a swept card — mirrors the ProviderError
 *  shape background-generator writes so the failure panel renders its
 *  normal kind copy + retry affordance. 'server' kind reads as a
 *  transient hiccup, which an interrupted deploy effectively is. */
function interruptedFailurePayload(failStatus: 'failed' | 'inside-failed') {
  return {
    status: failStatus,
    failureKind: 'server',
    failureMessage:
      'The generation was interrupted mid-flight — most likely a brief service restart, not anything about your card.',
    failureModelExplanation: null,
    failureProvider: null,
    failureCode: 'generation_interrupted',
    failureSuggestions: [
      'Hit retry — your photos and details are all saved.',
      'If it happens twice in a row, give it a couple of minutes first.',
    ],
    failureAt: new Date(),
  };
}

export async function sweepStaleGenerations(): Promise<{
  cardsSwept: number;
  attemptsSwept: number;
}> {
  let cardsSwept = 0;
  let attemptsSwept = 0;

  // ── 1. Orphaned generating* cards ─────────────────────────────────
  const generating = await db
    .select({ id: cards.id, status: cards.status })
    .from(cards)
    .where(inArray(cards.status, GENERATING_STATUSES));

  for (const card of generating) {
    if (inFlightCards.has(card.id)) continue; // live in this process
    const failStatus =
      card.status === 'generating-inside' ? 'inside-failed' : 'failed';
    await db
      .update(cards)
      .set(interruptedFailurePayload(failStatus))
      .where(
        and(
          eq(cards.id, card.id),
          // Re-check the status in the WHERE so a generation that
          // completed between our SELECT and now is never clobbered.
          inArray(cards.status, GENERATING_STATUSES),
        ),
      );
    cardsSwept += 1;
    console.warn(
      `[STALE-SWEEP] card ${card.id}: orphaned '${card.status}' → '${failStatus}'`,
    );
  }

  // ── 2. Stuck regen attempts (age-based) ───────────────────────────
  const attemptCutoff = new Date(Date.now() - ATTEMPT_STALE_MS);
  const staleAttempts = await db
    .update(cardAttempts)
    .set({ status: 'failed' })
    .where(
      and(
        eq(cardAttempts.status, 'generating'),
        lt(cardAttempts.createdAt, attemptCutoff),
      ),
    )
    .returning({ id: cardAttempts.id, cardId: cardAttempts.cardId });
  attemptsSwept = staleAttempts.length;
  for (const a of staleAttempts) {
    console.warn(
      `[STALE-SWEEP] attempt ${a.id} (card ${a.cardId}): stuck 'generating' → 'failed'`,
    );
  }

  return { cardsSwept, attemptsSwept };
}

export async function sweepStrandedPaidOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - ORDER_STALE_MS);
  const stranded = await db
    .select()
    .from(studioOrders)
    .where(
      and(
        eq(studioOrders.paymentStatus, 'paid'),
        eq(studioOrders.includesPrint, true),
        isNull(studioOrders.providerOrderId),
        inArray(studioOrders.fulfillmentStatus, ['pending', 'failed']),
        lt(studioOrders.updatedAt, cutoff),
      ),
    );

  let redriven = 0;
  for (const order of stranded) {
    console.warn(
      `[STALE-SWEEP] order ${order.id}: paid with no print submission (${order.fulfillmentStatus}) — re-driving`,
    );
    try {
      await submitPrintOrder(order);
      redriven += 1;
    } catch (err: any) {
      // submitPrintOrder handles its own failures (status + alert email),
      // but guard the loop so one pathological order can't stop the rest.
      console.error(
        `[STALE-SWEEP] re-drive threw for order ${order.id}:`,
        err?.message ?? err,
      );
    }
  }
  return redriven;
}

async function runSweeps(): Promise<void> {
  try {
    const gen = await sweepStaleGenerations();
    const orders = await sweepStrandedPaidOrders();
    const emptied = await purgeUntouchedDrafts();
    if (gen.cardsSwept || gen.attemptsSwept || orders || emptied) {
      console.log(
        `[STALE-SWEEP] pass done: ${gen.cardsSwept} card(s), ${gen.attemptsSwept} attempt(s), ${orders} order re-drive(s), ${emptied} empty draft(s) purged`,
      );
      // Orphaned cards after a deploy are expected; a stranded PAID order
      // is not — sweepStrandedPaidOrders already alerts per-failure via
      // submitPrintOrder, so no extra aggregate alert here.
    }
  } catch (err: any) {
    console.error('[STALE-SWEEP] pass failed:', err?.message ?? err);
    void sendAdminAlertEmail('Stale sweeper pass failed', [
      String(err?.message ?? err),
      'Stuck generations/orders may be accumulating — check Render logs.',
    ]);
  }
}

/** Schedule: first pass 8 min after boot (lets a deploy's dying twin
 *  finish its last generation), then every 10 min. */
/** Delete drafts nothing was ever entered into. Opening the card maker
 *  creates the row immediately, so every abandoned "new card" tap leaves
 *  an empty husk — noise in the customer's shelf, the CRM and analytics
 *  (Aidan 2026-08-04). They're already hidden from both lists; this
 *  stops them accumulating in the table. Only rows older than 2h, so an
 *  in-progress session is never touched.
 */
export async function purgeUntouchedDrafts(): Promise<number> {
  const res = await db.execute(sql`
    DELETE FROM cards
    WHERE status = 'draft'
      AND front_image_url IS NULL
      AND inside_image_url IS NULL
      AND created_at < now() - interval '2 hours'
      AND COALESCE(conversation_data->'recipient'->>'name', '') = ''
      AND COALESCE(conversation_data->'recipient'->>'occasion', '') = ''
      AND COALESCE(conversation_data->'scene'->>'description', '') = ''
      AND COALESCE(jsonb_array_length(conversation_data->'photos'->'photoIds'), 0) = 0
      AND NOT EXISTS (SELECT 1 FROM studio_orders so WHERE so.card_id = cards.id)
  `);
  return res.rowCount ?? 0;
}

export function scheduleStaleSweeps(): void {
  setTimeout(() => {
    void runSweeps();
    setInterval(() => void runSweeps(), SWEEP_INTERVAL_MS);
  }, FIRST_SWEEP_DELAY_MS);
  console.log(
    `[STALE-SWEEP] scheduled — first pass in ${FIRST_SWEEP_DELAY_MS / 60000} min, then every ${SWEEP_INTERVAL_MS / 60000} min`,
  );
}
