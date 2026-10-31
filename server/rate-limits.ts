// server/rate-limits.ts
//
// Per-user generation cap. Sprint 3 ships a single blanket limit:
// 20 card generations per user per rolling 24-hour window. The cap
// exists to contain cost and abuse in the pre-payments era — real
// pricing (pay-per-card, subscription, etc.) lands in Sprint 4 and
// will replace this with business-model-aware limits.
//
// Source of truth: `generation_log`. Every production generation
// writes one row per slot (front, inside); we count the number of
// *distinct cards* the user has generated in the window, not log
// rows, so multi-slot cards aren't double-counted and retries on
// the same card don't tick the counter up.
//
// Lab-only test runs (generation_log.cardId IS NULL) are excluded
// by the join — admin testing doesn't count against the cap.

import { and, eq, gt } from 'drizzle-orm';
import { db } from './db';
import { cards, generationLog } from '@shared/schema';

export const DAILY_GENERATION_LIMIT = 20;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface RateLimitStatus {
  /** Whether the user can start another generation right now. */
  allowed: boolean;
  /** Distinct cards the user has generated in the last 24 hours. */
  used: number;
  /** Cap — same for everyone in Sprint 3. */
  limit: number;
  /** When the oldest counted generation rolls out of the window, so
   *  the UI can show "try again in X" if we want later. ISO string
   *  for transport; null if the user has zero generations in window. */
  oldestCountedAt: string | null;
}

/**
 * Check the daily generation count for a user. Does NOT increment —
 * call this before dispatching a generation, then let the generator
 * write its own generation_log rows on completion.
 *
 * Window is rolling 24h, not calendar-day. Avoids the "midnight spike"
 * of everyone waiting for UTC 00:00 to reset.
 */
export async function checkDailyGenerationLimit(
  userId: string,
): Promise<RateLimitStatus> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  // Distinct cardIds in the window, owned by this user. Join to cards
  // for the ownership filter; inner join naturally excludes
  // generation_log rows with cardId=null (lab test runs).
  const rows = await db
    .selectDistinct({
      cardId: generationLog.cardId,
      createdAt: generationLog.createdAt,
    })
    .from(generationLog)
    .innerJoin(cards, eq(generationLog.cardId, cards.id))
    .where(
      and(
        eq(cards.userId, userId),
        gt(generationLog.createdAt, windowStart),
        // Failed provider calls don't count against the user — they got
        // nothing for them (audit 2026-07-27).
        eq(generationLog.success, true),
      ),
    );

  // DISTINCT CARDS, not rows (audit 2026-07-27): every log row has a
  // unique createdAt, so distinct-on-(cardId, createdAt) was just a row
  // count — front+inside = 2, each regen +1 — inflating `used` ~2-3× and
  // capping testers at ~7 real cards while claiming "20". The rows keep
  // createdAt for the reset estimate below; dedupe here.
  const used = new Set(rows.map((r) => r.cardId)).size;
  const oldest = rows.reduce<Date | null>((earliest, r) => {
    if (!earliest) return r.createdAt;
    return r.createdAt < earliest ? r.createdAt : earliest;
  }, null);

  return {
    allowed: used < DAILY_GENERATION_LIMIT,
    used,
    limit: DAILY_GENERATION_LIMIT,
    oldestCountedAt: oldest ? oldest.toISOString() : null,
  };
}
