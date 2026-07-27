// server/reminders/dispatcher.ts
//
// The reminder cron + dispatch engine. Runs daily; for every saved
// occasion with a date, computes whether a tier reminder is due
// today, fires the email if so + logs the firing. Idempotent via
// the (occasionId, tier, year) dedup key on reminder_log.
//
// Tier ladder (Reminders V1):
//   T-21  → warm prompt 3 weeks before
//   T-7   → 1 week before
//   T-3   → digital pivot (only fires if no print order placed)
//
// Smart-skip rules (cron skips firing when these are true):
//   • Card with matching recipient name + occasion already exists
//     in 'completed'/paid state from the past 30 days
//   • Occasion has suppressedUntil >= today
//   • Year-specific occasion's date has already passed
//   • A T-3 fire would be on an occasion where a print order already
//     exists for the matched card (don't pivot to digital — they're
//     already getting a printed card)
//
// Time zone (V1): everything in UTC. Cron fires daily at 8am UTC.
// Acceptable for SA (10am) + UK (9am). Real timezone awareness is
// V1.5 (would need users.timezone).

import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { publicImageUrl } from '../image-storage';
import {
  addressBookEntries,
  recipientOccasions,
  reminderLog,
  studioOrders,
  cards,
  users,
} from '@shared/schema';
import {
  FIXED_DATE_OCCASIONS,
  isFixedDateOccasion,
  nextFixedOccasionDate,
} from '@shared/fixed-occasions';
import {
  sendReminderEmail,
  type ReminderTier,
} from '../email-service';

interface DispatchOptions {
  /** Override "today" — used by the admin trigger endpoint to test
   *  a future date without touching the system clock. */
  asOfDate?: Date;
  /** When true, skip actually sending emails — useful for dry-run
   *  inspections + automated tests. Logs are still written so the
   *  caller can see what would have fired. */
  dryRun?: boolean;
}

interface DispatchResult {
  examined: number;
  fired: number;
  skipped: Array<{ occasionId: number; tier: ReminderTier; reason: string }>;
  errors: Array<{ occasionId: number; tier: ReminderTier; error: string }>;
}

/** Run a full dispatch pass. Idempotent — calling twice on the same
 *  day fires nothing the second time (logs prevent double-send). */
export async function runReminderDispatch(
  opts: DispatchOptions = {},
): Promise<DispatchResult> {
  const today = stripTime(opts.asOfDate ?? new Date());
  const result: DispatchResult = {
    examined: 0,
    fired: 0,
    skipped: [],
    errors: [],
  };

  console.log(
    `[REMINDERS] Dispatch starting for ${today.toISOString().slice(0, 10)}${opts.dryRun ? ' (DRY RUN)' : ''}`,
  );

  // Pull every occasion with a date set. ~tiny query at our scale;
  // optimisations (per-user partitioning, batched-by-tier-date queries)
  // come if the table grows past tens-of-thousands.
  const allOccasions = await db
    .select({
      occasion: recipientOccasions,
      entry: addressBookEntries,
    })
    .from(recipientOccasions)
    .innerJoin(
      addressBookEntries,
      eq(recipientOccasions.addressBookEntryId, addressBookEntries.id),
    )
    .where(
      // A stored date OR a fixed-date occasion type (Christmas etc. store
      // no date — the date is resolved from the calendar below).
      or(
        sql`${recipientOccasions.date} IS NOT NULL`,
        inArray(recipientOccasions.occasion, Array.from(FIXED_DATE_OCCASIONS)),
      ),
    );

  result.examined = allOccasions.length;

  for (const row of allOccasions) {
    const { occasion, entry } = row;

    // Suppression check first — short-circuits everything.
    if (occasion.suppressedUntil && parseDateUTC(occasion.suppressedUntil) >= today) {
      result.skipped.push({
        occasionId: occasion.id,
        tier: 't_21',
        reason: 'suppressed',
      });
      continue;
    }

    // Fixed-date occasions resolve from the calendar (no stored date);
    // everything else rolls its stored month/day forward.
    const nextOccurrence = isFixedDateOccasion(occasion.occasion)
      ? nextFixedOccasionDate(occasion.occasion, today)
      : occasion.date
        ? computeNextOccurrence(parseDateUTC(occasion.date as string), occasion.yearSpecific, today)
        : null;
    if (!nextOccurrence) {
      // Year-specific date has passed — historical, won't recur.
      result.skipped.push({
        occasionId: occasion.id,
        tier: 't_21',
        reason: 'past year-specific occasion',
      });
      continue;
    }

    const daysUntil = daysBetween(today, nextOccurrence);
    const dueTier = tierForDaysUntil(daysUntil);
    if (!dueTier) continue; // not a reminder day for this occasion

    // Smart-skip: card already made + paid for this person+occasion
    // in the recent window? Don't nudge.
    if (await isCardAlreadyHandled(entry.userId, entry.name, occasion.occasion, today)) {
      result.skipped.push({
        occasionId: occasion.id,
        tier: dueTier,
        reason: 'card already sent',
      });
      continue;
    }

    // T-3 specifically: skip if a print order is already placed.
    // Don't tell someone who's getting a print to "send digital instead".
    if (dueTier === 't_3' && (await isPrintOrderPlaced(entry.userId, entry.name, today))) {
      result.skipped.push({
        occasionId: occasion.id,
        tier: dueTier,
        reason: 'print order already placed',
      });
      continue;
    }

    // Dedup: have we already fired this (occasion, tier, year)?
    const year = nextOccurrence.getUTCFullYear();
    const alreadyFired = await db
      .select({ id: reminderLog.id })
      .from(reminderLog)
      .where(
        and(
          eq(reminderLog.occasionId, occasion.id),
          eq(reminderLog.tier, dueTier),
          eq(reminderLog.year, year),
        ),
      )
      .limit(1);
    if (alreadyFired.length > 0) {
      result.skipped.push({
        occasionId: occasion.id,
        tier: dueTier,
        reason: 'already fired this year',
      });
      continue;
    }

    // Fire (or dry-run).
    if (opts.dryRun) {
      console.log(
        `[REMINDERS] DRY RUN would fire ${dueTier} for occasion ${occasion.id} (${entry.name}'s ${occasion.occasion}) — daysUntil=${daysUntil}`,
      );
      // Don't write a log row in dry-run; we want to allow real cron
      // to fire it later.
      result.fired += 1;
      continue;
    }

    try {
      // Look up the sender's email + name (cron context — no req.user).
      const senderRows = await db
        .select({ email: users.email, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, entry.userId))
        .limit(1);
      const sender = senderRows[0];
      if (!sender?.email) {
        result.skipped.push({
          occasionId: occasion.id,
          tier: dueTier,
          reason: 'sender email missing',
        });
        continue;
      }

      const startCardUrl = buildStartCardUrl(entry.name, occasion.occasion);
      // Retention-paradox fix: surface the most recent card sent to this
      // recipient inside the email itself. Without this, the reminder
      // trains the user to remember the *date* (they then go wherever's
      // cheapest); with it, the email anchors the act to Celebrait
      // specifically — *"this is the card you sent last time"*. See
      // next_address_book_reminders_retention.md.
      const lastCard = await findLastSentCardImages(entry.userId, entry.name);
      const emailSent = await sendReminderEmail({
        senderEmail: sender.email,
        senderName: sender.firstName,
        recipientName: entry.name,
        occasion: occasion.occasion,
        daysUntil,
        tier: dueTier,
        startCardUrl,
        lastCardImageUrl: lastCard.front,
        lastInsideImageUrl: lastCard.inside,
      });

      // Log regardless of send success — prevents retry loops.
      await db.insert(reminderLog).values({
        userId: entry.userId,
        occasionId: occasion.id,
        tier: dueTier,
        year,
        emailSent,
        failureReason: emailSent ? null : 'transport returned false',
      }).onConflictDoNothing();

      if (emailSent) {
        result.fired += 1;
        console.log(
          `[REMINDERS] Fired ${dueTier} for occasion ${occasion.id} (${entry.name}'s ${occasion.occasion}) → ${sender.email}`,
        );
      } else {
        result.errors.push({
          occasionId: occasion.id,
          tier: dueTier,
          error: 'transport returned false',
        });
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      result.errors.push({
        occasionId: occasion.id,
        tier: dueTier,
        error: msg,
      });
      // Log the failure so we don't retry. The next tier will get a
      // chance.
      try {
        await db.insert(reminderLog).values({
          userId: entry.userId,
          occasionId: occasion.id,
          tier: dueTier,
          year,
          emailSent: false,
          failureReason: msg.slice(0, 500),
        }).onConflictDoNothing();
      } catch (logErr) {
        console.error('[REMINDERS] Failed to write failure log row:', logErr);
      }
    }
  }

  console.log(
    `[REMINDERS] Dispatch complete: examined=${result.examined} fired=${result.fired} skipped=${result.skipped.length} errors=${result.errors.length}`,
  );
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/** Strip time-of-day; comparisons are date-only. UTC throughout for V1. */
function stripTime(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Parse a YYYY-MM-DD string from a date column into a UTC Date at
 *  midnight. Postgres `date` columns come back as either `Date` or
 *  string depending on pg adapter — handle both. */
function parseDateUTC(value: string | Date): Date {
  if (value instanceof Date) return stripTime(value);
  const [yStr, mStr, dStr] = value.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Compute the next occurrence of a date.
 *  - Recurring (yearSpecific=false): roll the year forward until the
 *    month-day is today-or-future. Returns the next occurrence.
 *  - One-off (yearSpecific=true): return literal date if future, null
 *    if past. */
function computeNextOccurrence(
  occasionDate: Date,
  yearSpecific: boolean,
  today: Date,
): Date | null {
  if (yearSpecific) {
    return occasionDate >= today ? occasionDate : null;
  }
  // Recurring — find next month/day on-or-after today.
  const month = occasionDate.getUTCMonth();
  const day = occasionDate.getUTCDate();
  const todayYear = today.getUTCFullYear();
  let candidate = new Date(Date.UTC(todayYear, month, day));
  if (candidate < today) {
    candidate = new Date(Date.UTC(todayYear + 1, month, day));
  }
  return candidate;
}

/** Inclusive whole-day difference between two UTC-midnight dates. */
function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** Map a daysUntil count to the tier we'd fire today. Returns null
 *  when no tier is due (most days). Exact match — we don't fire T-21
 *  on day 22 to "catch up"; the daily cron means we'd hit it on day 21
 *  precisely. */
function tierForDaysUntil(days: number): ReminderTier | null {
  if (days === 21) return 't_21';
  if (days === 7) return 't_7';
  if (days === 3) return 't_3';
  return null;
}

/** Has this user already made + paid for a card to this recipient for
 *  this occasion in the recent window? Smart-skip signal — don't
 *  prompt someone to start a card they've already sent. */
async function isCardAlreadyHandled(
  userId: string,
  recipientName: string,
  occasion: string,
  today: Date,
): Promise<boolean> {
  // Look back 30 days. If we've sent Mum a birthday card any time in
  // the past month, suppress further reminders for this birthday.
  const windowStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: cards.id })
    .from(cards)
    .where(
      and(
        eq(cards.userId, userId),
        eq(cards.status, 'completed'),
        sql`${cards.createdAt} >= ${windowStart}`,
        sql`(${cards.conversationData}->'recipient'->>'name') ILIKE ${recipientName}`,
        sql`(${cards.conversationData}->'recipient'->>'occasion') = ${occasion}`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Has the user placed a paid PRINT order for this recipient recently?
 *  Used to suppress the T-3 digital pivot — if they've ordered print,
 *  don't tell them to send digital. */
async function isPrintOrderPlaced(
  userId: string,
  recipientName: string,
  today: Date,
): Promise<boolean> {
  const windowStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: studioOrders.id })
    .from(studioOrders)
    .innerJoin(cards, eq(studioOrders.cardId, cards.id))
    .where(
      and(
        eq(studioOrders.userId, userId),
        eq(studioOrders.includesPrint, true),
        sql`${studioOrders.createdAt} >= ${windowStart}`,
        sql`(${cards.conversationData}->'recipient'->>'name') ILIKE ${recipientName}`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Look up the front image of the most recent completed card a user
 *  sent to a recipient (matched case-insensitively by name). Returns
 *  null if nothing's been sent. Mirrors the helper of the same name in
 *  routes/address-book.ts — duplicated rather than shared because the
 *  query is 12 lines and shared/ doesn't have a server-only home for
 *  query helpers yet. If a third caller appears, extract to server/lib/. */
async function findLastSentCardImages(
  userId: string,
  recipientName: string,
): Promise<{ front: string | null; inside: string | null }> {
  const trimmed = recipientName.trim();
  if (!trimmed) return { front: null, inside: null };
  const rows = await db
    .select({
      frontImagePath: cards.frontImagePath,
      frontImageUrl: cards.frontImageUrl,
      insideImagePath: cards.insideImagePath,
      insideImageUrl: cards.insideImageUrl,
    })
    .from(cards)
    .where(
      and(
        eq(cards.userId, userId),
        eq(cards.status, 'completed'),
        sql`lower(${cards.conversationData}->'recipient'->>'name') = lower(${trimmed})`,
      ),
    )
    .orderBy(desc(cards.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return { front: null, inside: null };
  return {
    front: row.frontImagePath ? publicImageUrl(row.frontImagePath) : row.frontImageUrl,
    inside: row.insideImagePath ? publicImageUrl(row.insideImagePath) : row.insideImageUrl,
  };
}

/** Build the deep-link URL for the reminder email's CTA. Pre-fills
 *  recipient name + occasion via query string so the new-card flow
 *  knows who this is for. */
function buildStartCardUrl(recipientName: string, occasion: string): string {
  const origin = process.env.PUBLIC_APP_ORIGIN ?? 'https://celebrait.co.uk';
  const params = new URLSearchParams({
    recipient: recipientName,
    occasion,
  });
  return `${origin}/studio/new-card?${params.toString()}`;
}

// Suppress unused-import warning for ilike — used in the joined queries
// above via the sql tag, kept available for future direct-LIKE queries.
void ilike;

// ─────────────────────────────────────────────────────────────────────
// Cron scheduling
// ─────────────────────────────────────────────────────────────────────

const DAILY_MS = 24 * 60 * 60 * 1000;

/** Schedule the dispatch to run daily. First run fires at the next
 *  8am UTC after process start; subsequent runs are 24h later.
 *
 *  In dev, the dispatcher still runs but is mostly idle (most users
 *  have no occasions at no due tiers). The admin trigger endpoint is
 *  the realistic test path. */
export function scheduleReminderDispatch(): void {
  const FIRST_RUN_HOUR_UTC = 8;
  const now = new Date();
  const nextRun = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      FIRST_RUN_HOUR_UTC,
      0,
      0,
    ),
  );
  if (nextRun <= now) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }
  const msUntilFirstRun = nextRun.getTime() - now.getTime();

  console.log(
    `[REMINDERS] Daily dispatch scheduled. Next run: ${nextRun.toISOString()}`,
  );

  setTimeout(() => {
    void runReminderDispatch().catch((err) =>
      console.error('[REMINDERS] First daily dispatch failed:', err),
    );
    setInterval(() => {
      void runReminderDispatch().catch((err) =>
        console.error('[REMINDERS] Daily dispatch failed:', err),
      );
    }, DAILY_MS);
  }, msUntilFirstRun);
}
