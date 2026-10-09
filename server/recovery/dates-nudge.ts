// server/recovery/dates-nudge.ts
//
// The add-your-dates nudge flow (Aidan 2026-08-04): two emails, then
// silence forever.
//
//   D2 — 2 days after signup, still under 3 key dates:
//        "Your free card's still waiting — you're N dates away."
//   D7 — 7 days after signup, same condition, softer date-aware angle:
//        "Christmas is in N days — whose card will it be?"
//
// Hard rules:
//   • PECR: these are promotional (they push the free-card offer), so
//     ONLY accounts that answered YES to the signup marketing question
//     ever enter the flow. The welcome email (transactional, everyone)
//     carries the day-0 version of this message instead.
//   • Each email sends AT MOST once per account (stamp columns), and
//     the flow exits permanently at 3 key dates or redemption.
//   • Volume guard: this runs daily at 09:30 UTC (offset from the
//     reminder + drop-off crons so Brevo sends don't burst).

import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { countKeyDates, FREE_CARD_KEY_DATES } from '../studio/free-card';
import { sendDatesNudgeEmail } from '../email-service';

interface NudgeTier {
  name: 'd2' | 'd7';
  minAgeDays: number;
  stampColumn: typeof users.datesNudgeD2SentAt | typeof users.datesNudgeD7SentAt;
}

const TIERS: NudgeTier[] = [
  { name: 'd2', minAgeDays: 2, stampColumn: users.datesNudgeD2SentAt },
  { name: 'd7', minAgeDays: 7, stampColumn: users.datesNudgeD7SentAt },
];

export interface DatesNudgeResult {
  examined: number;
  sent: number;
  skippedEnoughDates: number;
  errors: string[];
}

export async function runDatesNudgeDispatch(opts?: {
  dryRun?: boolean;
}): Promise<DatesNudgeResult> {
  const dryRun = opts?.dryRun === true;
  const result: DatesNudgeResult = {
    examined: 0,
    sent: 0,
    skippedEnoughDates: 0,
    errors: [],
  };

  for (const tier of TIERS) {
    const cutoff = new Date(Date.now() - tier.minAgeDays * 86_400_000);
    // Consent + age + never-sent + never-redeemed, in SQL. The key-date
    // count is per-user below (tiny volumes; the count needs the fixed-
    // occasion logic anyway).
    const candidates = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
      })
      .from(users)
      .where(
        and(
          eq(users.marketingOptIn, true),
          isNull(tier.stampColumn),
          isNull(users.freeCardRedeemedAt),
          lt(users.createdAt, cutoff),
          sql`${users.email} IS NOT NULL`,
        ),
      );

    result.examined += candidates.length;

    for (const u of candidates) {
      try {
        const keyDates = await countKeyDates(u.id);
        if (keyDates >= FREE_CARD_KEY_DATES) {
          // Flow exit: they've unlocked — stamp both tiers so we never
          // examine them again.
          result.skippedEnoughDates++;
          if (!dryRun) {
            await db
              .update(users)
              .set({
                datesNudgeD2SentAt: new Date(),
                datesNudgeD7SentAt: new Date(),
              })
              .where(eq(users.id, u.id));
          }
          continue;
        }

        if (dryRun) {
          console.log(
            `[DATES-NUDGE:${tier.name}] DRY RUN would email ${u.email} (${keyDates}/${FREE_CARD_KEY_DATES} dates)`,
          );
          result.sent++;
          continue;
        }

        const ok = await sendDatesNudgeEmail({
          email: u.email as string,
          firstName: u.firstName,
          keyDates,
          variant: tier.name,
        });
        if (ok) {
          await db
            .update(users)
            .set(
              tier.name === 'd2'
                ? { datesNudgeD2SentAt: new Date() }
                : { datesNudgeD7SentAt: new Date() },
            )
            .where(eq(users.id, u.id));
          result.sent++;
          console.log(`[DATES-NUDGE:${tier.name}] sent → ${u.email} (${keyDates}/3)`);
        } else {
          result.errors.push(`${tier.name}:${u.email}: send returned false`);
        }
      } catch (err: any) {
        result.errors.push(`${tier.name}:${u.email}: ${err?.message ?? err}`);
      }
    }
  }

  if (result.examined > 0 || result.errors.length > 0) {
    console.log(
      `[DATES-NUDGE] examined=${result.examined} sent=${result.sent} unlockedExits=${result.skippedEnoughDates} errors=${result.errors.length}`,
    );
  }
  return result;
}

/** Daily at 09:30 UTC — offset from reminders (08:00) and drop-off
 *  recovery (09:00) so Brevo send volume doesn't burst. */
export function scheduleDatesNudgeDispatch(): void {
  const now = new Date();
  const nextRun = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 30, 0),
  );
  if (nextRun <= now) nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  const msUntilFirstRun = nextRun.getTime() - now.getTime();

  console.log(`[DATES-NUDGE] Daily dispatch scheduled. Next run: ${nextRun.toISOString()}`);
  setTimeout(() => {
    void runDatesNudgeDispatch();
    setInterval(() => void runDatesNudgeDispatch(), 24 * 60 * 60 * 1000);
  }, msUntilFirstRun);
}
