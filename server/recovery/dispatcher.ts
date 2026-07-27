// server/recovery/dispatcher.ts
//
// Drop-off recovery cron — Comms PR2 (2026-04-30), expanded to 3-touch
// cadence on 2026-05-10.
//
// Daily pass: examine all completed cards owned by a real user with no
// paid order, and fire whichever drop-off email is currently due. Three
// tiers, each with its own cutoff + stamp column, all independent +
// idempotent:
//
//   T+24h  → dropoffEmailSentAt    — gentle "still waiting"
//   T+4d   → tweakEmailSentAt      — "want to tweak it?" iteration framing
//   T+10d  → lastCallEmailSentAt   — soft urgency, terminal
//
// After the last-call tier, silence — the card stays in the gallery but
// we stop nudging.
//
// Non-blocking by design — best-effort across rows; one failure doesn't
// halt the rest. Idempotent via the column stamps; safe to run twice.
//
// Cron timing: 9am UTC daily (= 11am SA / 10am UK). Inbox prime time
// for both markets, slightly later than the reminder cron (8am UTC) so
// the two don't compete on send-volume burst.

import { and, eq, isNull, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '../db';
import {
  cards,
  studioOrders,
  users,
  type CardDraftState,
} from '@shared/schema';
import {
  sendDropOffRecoveryEmail,
  sendDropOffTweakEmail,
  sendDropOffLastCallEmail,
} from '../email-service';

interface DispatchOptions {
  /** Override "now" — used by the admin trigger endpoint to test
   *  with a fake clock. */
  asOfDate?: Date;
  /** When true, no emails sent + no log column written. Useful for
   *  dry-run inspections. */
  dryRun?: boolean;
}

interface DispatchResult {
  examined: number;
  fired: number;
  skipped: Array<{ cardId: number; reason: string }>;
  errors: Array<{ cardId: number; error: string }>;
}

// ─────────────────────────────────────────────────────────────────────
// Per-tier configuration
// ─────────────────────────────────────────────────────────────────────

type TierName = 'dropoff' | 'tweak' | 'lastcall';

interface TierConfig {
  name: TierName;
  /** Hours since card.createdAt before the email becomes eligible. */
  cutoffHours: number;
  /** Drizzle column whose timestamp gates this tier — null = eligible,
   *  non-null = already sent. Each tier has its own column so they're
   *  independent. */
  stampColumn: PgColumn;
  /** Email function for this tier. All three share the same param
   *  shape so they're swappable here. */
  send: (params: {
    senderEmail: string;
    senderName: string | null;
    recipientName: string | null;
    occasion: string | null;
    cardId: number;
  }) => Promise<boolean>;
  /** Stamp setter — has to be a fresh object per tier so drizzle's
   *  set() picks the right column name. */
  stampPatch: () => Record<string, Date>;
}

const TIERS: TierConfig[] = [
  {
    name: 'dropoff',
    cutoffHours: 24,
    stampColumn: cards.dropoffEmailSentAt,
    send: sendDropOffRecoveryEmail,
    stampPatch: () => ({ dropoffEmailSentAt: new Date() }),
  },
  {
    name: 'tweak',
    cutoffHours: 24 * 4, // Day 4
    stampColumn: cards.tweakEmailSentAt,
    send: sendDropOffTweakEmail,
    stampPatch: () => ({ tweakEmailSentAt: new Date() }),
  },
  {
    name: 'lastcall',
    cutoffHours: 24 * 10, // Day 10 — terminal
    stampColumn: cards.lastCallEmailSentAt,
    send: sendDropOffLastCallEmail,
    stampPatch: () => ({ lastCallEmailSentAt: new Date() }),
  },
];

// ─────────────────────────────────────────────────────────────────────
// Public dispatch
// ─────────────────────────────────────────────────────────────────────

/** Run a full dispatch pass across all three tiers. Idempotent —
 *  each tier's stamp column gates its own email, so calling twice
 *  fires nothing the second time. */
export async function runDropOffRecoveryDispatch(
  opts: DispatchOptions = {},
): Promise<DispatchResult> {
  const now = opts.asOfDate ?? new Date();
  const result: DispatchResult = {
    examined: 0,
    fired: 0,
    skipped: [],
    errors: [],
  };

  console.log(
    `[DROPOFF] Dispatch starting${opts.dryRun ? ' (DRY RUN)' : ''}. asOf=${now.toISOString()}`,
  );

  // Run each tier independently. They share no state — a card eligible
  // for the tweak tier can't trip the lastcall tier in the same pass
  // because the tweak stamp gets set first. (And even if a card somehow
  // missed an earlier tier, the next tier's gate is independent — it
  // fires on its own time cutoff, not "AND prior tier was sent.")
  for (const tier of TIERS) {
    const tierResult = await runTier(tier, now, opts);
    result.examined += tierResult.examined;
    result.fired += tierResult.fired;
    result.skipped.push(...tierResult.skipped);
    result.errors.push(...tierResult.errors);
  }

  console.log(
    `[DROPOFF] Dispatch complete: examined=${result.examined} fired=${result.fired} skipped=${result.skipped.length} errors=${result.errors.length}`,
  );
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Per-tier pass
// ─────────────────────────────────────────────────────────────────────

async function runTier(
  tier: TierConfig,
  now: Date,
  opts: DispatchOptions,
): Promise<DispatchResult> {
  const cutoff = new Date(now.getTime() - tier.cutoffHours * 60 * 60 * 1000);
  const result: DispatchResult = {
    examined: 0,
    fired: 0,
    skipped: [],
    errors: [],
  };

  // Pull eligible cards: completed, older than this tier's cutoff,
  // never sent THIS tier's email, owned by a real user WHO OPTED IN.
  //
  // The marketingOptIn join is a PECR requirement, not a nicety
  // (audit 2026-07-27): drop-off nudges are unsolicited direct
  // marketing, and the sign-up checkbox ("Email me card reminders and
  // the occasional offer") writes users.marketing_opt_in — which no
  // send path read until now. Anyone who left it unticked must never
  // enter this pipeline. Occasion reminders are different (user
  // explicitly created them) and stay un-gated.
  const eligible = await db
    .select({ card: cards })
    .from(cards)
    .innerJoin(users, eq(cards.userId, users.id))
    .where(
      and(
        eq(cards.status, 'completed'),
        sql`${cards.createdAt} < ${cutoff}`,
        isNull(tier.stampColumn),
        eq(users.marketingOptIn, true),
      ),
    );

  result.examined = eligible.length;
  if (eligible.length > 0) {
    console.log(`[DROPOFF:${tier.name}] ${eligible.length} candidate card(s)`);
  }

  for (const row of eligible) {
    const card = row.card;
    if (!card.userId) {
      result.skipped.push({ cardId: card.id, reason: 'no userId' });
      continue;
    }

    // Skip if there's any paid order against this card. Same paid
    // gate for all tiers — once they convert, no more drop-off emails.
    const paidOrder = await db
      .select({ id: studioOrders.id })
      .from(studioOrders)
      .where(
        and(
          eq(studioOrders.cardId, card.id),
          sql`${studioOrders.paymentStatus} = 'paid'`,
        ),
      )
      .limit(1);
    if (paidOrder.length > 0) {
      result.skipped.push({ cardId: card.id, reason: 'paid order exists' });
      continue;
    }

    // Resolve sender email + name.
    const userRows = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, card.userId))
      .limit(1);
    const user = userRows[0];
    if (!user?.email) {
      result.skipped.push({ cardId: card.id, reason: 'sender email missing' });
      continue;
    }

    // Pull recipient + occasion from the draft state.
    const state = (card.conversationData as CardDraftState | null) ?? null;
    const recipientName = state?.recipient?.name?.trim() || null;
    const occasion = state?.recipient?.occasion?.trim() || null;
    const senderName =
      user.firstName?.trim() ||
      user.email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ||
      null;

    if (opts.dryRun) {
      console.log(
        `[DROPOFF:${tier.name}] DRY RUN would email ${user.email} for card ${card.id} (${recipientName ?? 'unnamed'})`,
      );
      result.fired += 1;
      continue;
    }

    try {
      const sent = await tier.send({
        senderEmail: user.email,
        senderName,
        recipientName,
        occasion,
        cardId: card.id,
      });

      // Stamp regardless of send-success. If the transport failed, the
      // user won't get spammed by repeated retries; the next tier (or
      // a future cron) handles the next stage. Trade-off: a transport
      // failure means this tier's email is lost for this card —
      // acceptable vs daily spam loops.
      await db
        .update(cards)
        .set(tier.stampPatch())
        .where(eq(cards.id, card.id));

      if (sent) {
        result.fired += 1;
        console.log(
          `[DROPOFF:${tier.name}] Sent for card ${card.id} → ${user.email}`,
        );
      } else {
        result.errors.push({
          cardId: card.id,
          error: `${tier.name}: transport returned false`,
        });
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      result.errors.push({ cardId: card.id, error: `${tier.name}: ${msg}` });
      // Stamp anyway — same reasoning as above.
      try {
        await db
          .update(cards)
          .set(tier.stampPatch())
          .where(eq(cards.id, card.id));
      } catch (logErr) {
        console.error(`[DROPOFF:${tier.name}] Failed to stamp after error:`, logErr);
      }
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Cron scheduling
// ─────────────────────────────────────────────────────────────────────

const DAILY_MS = 24 * 60 * 60 * 1000;

/** Schedule the dispatch to run daily at 9am UTC.
 *  - 9am UTC = 11am SA = 10am UK = inbox-prime-time
 *  - 1h offset from the reminder cron (8am UTC) avoids competing
 *    send-volume bursts from the same Brevo account.
 *
 *  First run fires at the next 9am UTC after process start; subsequent
 *  runs are 24h later. One pass handles all three tiers (dropoff +
 *  tweak + lastcall) for every eligible card.
 */
export function scheduleDropOffRecoveryDispatch(): void {
  const HOUR_UTC = 9;
  const now = new Date();
  const nextRun = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      HOUR_UTC,
      0,
      0,
    ),
  );
  if (nextRun <= now) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }
  const msUntilFirstRun = nextRun.getTime() - now.getTime();

  console.log(
    `[DROPOFF] Daily dispatch scheduled. Next run: ${nextRun.toISOString()}`,
  );

  setTimeout(() => {
    void runDropOffRecoveryDispatch().catch((err) =>
      console.error('[DROPOFF] First daily dispatch failed:', err),
    );
    setInterval(() => {
      void runDropOffRecoveryDispatch().catch((err) =>
        console.error('[DROPOFF] Daily dispatch failed:', err),
      );
    }, DAILY_MS);
  }, msUntilFirstRun);
}
