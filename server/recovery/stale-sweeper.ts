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

import { and, eq, gt, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { activitySince, checkoutSettling } from '../activity';
import { cards, cardAttempts, studioOrders } from '@shared/schema';
import { inFlightCards } from '../generation-registry';
import {
  applyFulfillmentUpdate,
  markOrderPaidAndDispatch,
  noPrintOrdersOpen,
  printOrdersMayBeOpenNow,
  submitPrintOrder,
} from '../routes/studio-checkout';
import { getPaymentProvider } from '../studio/payment-provider';
import { getPrintProvider } from '../studio/print-provider';
import { sendPrintAlert } from '../studio/print-alerts';
import { sendAdminAlertEmail } from '../email-service';
import { expectedBy, formatDayMonth, shouldBePostedBy } from '@shared/pricing';

const GENERATING_STATUSES = ['generating', 'generating-front', 'generating-inside'];
const ATTEMPT_STALE_MS = 10 * 60 * 1000;
const ORDER_STALE_MS = 10 * 60 * 1000;
const FIRST_SWEEP_DELAY_MS = 8 * 60 * 1000;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
// How often orders sitting at the printer are looked in on. The printer's
// webhook is the fast path; this is the backstop for the webhook that
// never came, so it can be slow, and slow matters: each look wakes the
// database (see IDLE SITES DO NOT SWEEP below).
const PRINT_WATCH_EVERY_MS = 3 * 60 * 60 * 1000;

/** Friendly failure payload for a swept card — mirrors the ProviderError
 *  shape background-generator writes so the failure panel renders its
 *  normal kind copy + retry affordance. 'server' kind reads as a
 *  transient hiccup, which an interrupted deploy effectively is. */
function interruptedFailurePayload(failStatus: 'failed' | 'inside-failed') {
  return {
    status: failStatus,
    failureKind: 'server',
    failureMessage:
      'The generation was interrupted mid-flight, most likely a brief service restart, not anything about your card.',
    failureModelExplanation: null,
    failureProvider: null,
    failureCode: 'generation_interrupted',
    failureSuggestions: [
      'Hit retry. Your photos and details are all saved.',
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

/** THE WEBHOOK SAFETY NET. "Paid" is flipped by the Stripe webhook or by
 *  the customer landing on the success page. If the webhook isn't
 *  registered on prod — or its secret is wrong, or Stripe can't reach us
 *  — a buyer who pays and closes the tab has money taken and an order
 *  stuck 'pending' forever, and until 2026-10-06 nothing ever looked
 *  (audit, P0). This asks Stripe directly for every pending Stripe order
 *  old enough that a webhook would have landed and young enough to still
 *  matter, and settles it through the same idempotent path the webhook
 *  uses. Zero network calls when there is nothing pending. */
const PAYMENT_RECONCILE_MIN_AGE_MS = 10 * 60 * 1000;
const PAYMENT_RECONCILE_MAX_AGE_MS = 48 * 60 * 60 * 1000;
export async function sweepUnreconciledPayments(): Promise<number> {
  const provider = getPaymentProvider();
  // Stripe only. PayFast (MARKET=ZA) has no status API for once-off
  // payments: its getStatus just echoes our own row, so asking it would
  // never settle anything. There the verified ITN is the source of truth,
  // and a payment whose ITN never lands has to be settled by hand from
  // the PayFast dashboard (the ITN-rejected admin alert says so).
  if (provider.name !== 'stripe') return 0;
  const now = Date.now();
  const pending = await db
    .select({ id: studioOrders.id, paymentReference: studioOrders.paymentReference })
    .from(studioOrders)
    .where(
      and(
        eq(studioOrders.paymentStatus, 'pending'),
        eq(studioOrders.paymentProvider, 'stripe'),
        isNotNull(studioOrders.paymentReference),
        lt(studioOrders.createdAt, new Date(now - PAYMENT_RECONCILE_MIN_AGE_MS)),
        gt(studioOrders.createdAt, new Date(now - PAYMENT_RECONCILE_MAX_AGE_MS)),
      ),
    );
  let reconciled = 0;
  for (const order of pending) {
    try {
      const st = await provider.getStatus(order.paymentReference!);
      if (st.status !== 'paid') continue;
      console.warn(`[STALE-SWEEP] order ${order.id} is PAID at Stripe but pending here — no webhook landed. Settling.`);
      await markOrderPaidAndDispatch(order.id, st.amountPaid);
      reconciled += 1;
    } catch (err: any) {
      console.error(`[STALE-SWEEP] payment reconcile failed for order ${order.id}:`, err?.message ?? err);
    }
  }
  return reconciled;
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

/** LOOK IN ON EVERY ORDER THE PRINTER IS HOLDING (launch audit
 *  2026-11-26).
 *
 *  Once an order was accepted by the printer nothing here ever asked
 *  about it again. We heard what the printer chose to tell us by webhook
 *  and nothing else, so an order it had stopped on (artwork it could not
 *  download, an item it could not make) or simply never got round to
 *  looked identical to a healthy one until the customer wrote in asking
 *  where their card was.
 *
 *  For each paid order at 'submitted' or 'printed' this asks the printer
 *  for the live status and runs it through the SAME transition the
 *  webhook uses (so a missed "shipped" webhook is healed and its email
 *  sent, exactly once), which also raises any issue the printer reports.
 *  Then, if it still has not been posted by the day it should have been,
 *  the operator is told while there is still post time in hand.
 *
 *  Returns how many orders still need watching (accepted and not yet
 *  posted, or paid and not yet accepted), so the scheduler knows whether
 *  an idle server has any reason to wake the database for this. */
let lastPrintWatchAt = 0;
export async function watchOpenPrintOrders(): Promise<number> {
  lastPrintWatchAt = Date.now();
  const provider = getPrintProvider();
  const held = await db
    .select()
    .from(studioOrders)
    .where(
      and(
        eq(studioOrders.paymentStatus, 'paid'),
        eq(studioOrders.includesPrint, true),
        isNotNull(studioOrders.providerOrderId),
        inArray(studioOrders.fulfillmentStatus, ['submitted', 'printed']),
        // Only what the CURRENT provider holds: a stub id from a test run
        // means nothing to Prodigi, and would be asked about for ever.
        eq(studioOrders.printProvider, provider.name),
      ),
    )
    .limit(200);
  // A stub accepts everything and posts nothing; a human printer works
  // from /admin/fulfilment and is their own status. Neither is "watched".
  const watchable = provider.name !== 'stub' && provider.name !== 'manual';

  let stillOpen = 0;
  let unreachable = 0;
  let lastError = '';
  for (const order of watchable ? held : []) {
    let status: Awaited<ReturnType<typeof provider.getStatus>>;
    try {
      status = await provider.getStatus(order.providerOrderId!);
      await applyFulfillmentUpdate(order, status);
    } catch (err: any) {
      unreachable += 1;
      stillOpen += 1;
      lastError = err?.message ?? String(err);
      console.error(`[PRINT-WATCH] could not check order ${order.id}:`, lastError);
      continue;
    }
    if (status.status !== 'submitted' && status.status !== 'printed') continue; // posted, or failed (alerted there)
    stillOpen += 1;
    const paidAt = order.paidAt ?? order.createdAt ?? new Date();
    if (Date.now() < shouldBePostedBy(new Date(paidAt)).getTime()) continue;
    const days = Math.floor((Date.now() - new Date(paidAt).getTime()) / 86_400_000);
    await sendPrintAlert('stalled', order.id, 'not-posted', `Order ${order.id} has NOT been posted after ${days} days`, [
      `Paid ${formatDayMonth(new Date(paidAt))}; the printer (${order.printProvider} ${order.providerOrderId}) still shows it as "${status.status}", not posted.`,
      `The customer was told to expect it by ${formatDayMonth(expectedBy(new Date(paidAt)))}.`,
      order.needByDate ? `They said they need it by ${order.needByDate}.` : '',
      `Customer: ${order.customerName ?? '?'} <${order.customerEmail ?? '?'}>`,
      '',
      'Look the order up in the Prodigi dashboard, or ask Prodigi support what is holding it. The customer has NOT been told anything.',
    ].filter((l, i, all) => l !== '' || all[i - 1] !== '')).catch(() => {});
  }
  if (unreachable) {
    await sendPrintAlert('check-failed', 'printer', 'unreachable', `Could not check ${unreachable} order(s) with the printer`, [
      `We asked ${provider.name} about ${unreachable} order(s) that are being printed and got no usable answer.`,
      `Last error: ${lastError}`,
      'If this comes back tomorrow, check the Prodigi API key on Render and Prodigi\'s status page.',
    ]).catch(() => {});
  }

  // Paid and not yet accepted by the printer: sweepStrandedPaidOrders
  // retries these, but only if the pass runs, so they count as open too.
  const stranded = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(studioOrders)
    .where(
      and(
        eq(studioOrders.paymentStatus, 'paid'),
        eq(studioOrders.includesPrint, true),
        isNull(studioOrders.providerOrderId),
        inArray(studioOrders.fulfillmentStatus, ['pending', 'failed']),
      ),
    );
  const open = stillOpen + (stranded[0]?.n ?? 0);
  if (open === 0) noPrintOrdersOpen();
  return open;
}

function printWatchDue(): boolean {
  return printOrdersMayBeOpenNow() && Date.now() - lastPrintWatchAt >= PRINT_WATCH_EVERY_MS;
}

async function runSweeps(): Promise<void> {
  try {
    const gen = await sweepStaleGenerations();
    const paid = await sweepUnreconciledPayments();
    const orders = await sweepStrandedPaidOrders();
    if (printWatchDue()) {
      const open = await watchOpenPrintOrders();
      if (open) console.log(`[PRINT-WATCH] ${open} print order(s) still open; checking again in ${PRINT_WATCH_EVERY_MS / 3_600_000}h`);
    }
    const emptied = await purgeUntouchedDrafts();
    if (gen.cardsSwept || gen.attemptsSwept || paid || orders || emptied) {
      console.log(
        `[STALE-SWEEP] pass done: ${gen.cardsSwept} card(s), ${gen.attemptsSwept} attempt(s), ${paid} payment(s) reconciled, ${orders} order re-drive(s), ${emptied} empty draft(s) purged`,
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

/** IDLE SITES DO NOT SWEEP.
 *
 *  The pass runs three queries, and it ran every ten minutes forever —
 *  144 times a day on a site nobody has visited yet. Neon suspends a
 *  compute after five minutes idle and bills for the time it is up, so
 *  that timer alone was enough to keep the database awake more or less
 *  permanently: $36 of compute in a month with no customers
 *  (2026-09-28).
 *
 *  Skipping when nothing has happened is safe rather than merely cheap,
 *  because everything this sweep looks for is DOWNSTREAM of a request —
 *  a generation can only go stale if someone started one, an order can
 *  only strand if someone paid, a draft can only be abandoned if someone
 *  made it. No request since the last pass means there is nothing new to
 *  find, so the pass would query three tables to learn nothing.
 *
 *  The cadence is unchanged when the site IS being used, so nothing gets
 *  slower for a real customer. */
export function scheduleStaleSweeps(): void {
  let lastPassAt = 0;
  const pass = () => {
    // The one thing that is NOT downstream of a request: an order already
    // at the printer goes wrong (or just goes nowhere) while the site is
    // quiet. So a quiet site still passes when there is a print order
    // open and its check is due, and only then: with nothing at the
    // printer this stays as idle as before.
    if (!activitySince(lastPassAt) && !checkoutSettling() && !printWatchDue()) return;  // nobody here since the last one, no checkout still settling, no print to look in on
    lastPassAt = Date.now();
    void runSweeps();
  };
  setTimeout(() => {
    lastPassAt = Date.now();
    void runSweeps();
    setInterval(pass, SWEEP_INTERVAL_MS);
  }, FIRST_SWEEP_DELAY_MS);
  console.log(
    `[STALE-SWEEP] scheduled — first pass in ${FIRST_SWEEP_DELAY_MS / 60000} min, then every ${SWEEP_INTERVAL_MS / 60000} min when the site has been used`,
  );
}
