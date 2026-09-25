// server/routes/reminders.ts
//
// Two endpoint groups:
//
//   USER:
//     GET  /api/user/reminders        — upcoming reminders + per-occasion next-fire date
//     POST /api/user/reminders/:occId/suppress    — skip this year (sets suppressedUntil)
//     POST /api/user/reminders/:occId/unsuppress  — clear suppression
//
//   ADMIN:
//     POST /api/admin/reminders/dispatch         — manually trigger the cron, optionally
//                                                  with ?dryRun=1 or ?asOfDate=YYYY-MM-DD
//
// The user-list endpoint returns occasions with derived next-occurrence
// dates + days-until counts so the client can group by horizon
// without re-implementing the date math. The admin dispatch endpoint
// is the V1 testing mechanism — fire it after manipulating an
// occasion's date to verify the cron + email pipeline E2E.

import type { Express, Request, Response } from 'express';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  addressBookEntries,
  recipientOccasions,
  users,
} from '@shared/schema';
import {
  FIXED_DATE_OCCASIONS,
  isFixedDateOccasion,
  nextFixedOccasionDate,
} from '@shared/fixed-occasions';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';
import { runReminderDispatch } from '../reminders/dispatcher';

function getUserId(req: Request): string | null {
  const id = (req as any).session?.otpUserId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

async function isAdmin(req: Request): Promise<boolean> {
  const otpUserId = (req as any).session?.otpUserId;
  if (typeof otpUserId !== 'string' || otpUserId.length === 0) return false;
  const row = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, otpUserId))
    .limit(1);
  return row[0]?.isAdmin === true;
}

interface UpcomingReminder {
  occasionId: number;
  entryId: number;
  recipientName: string;
  relationship: string | null;
  occasion: string;
  /** ISO date — the actual date the occasion falls on this cycle. */
  occurrenceDate: string;
  /** Days from today (UTC) to the next occurrence. Negative = past
   *  (we filter those out in V1). */
  daysUntil: number;
  /** Whether reminders are currently suppressed for this occasion. */
  suppressed: boolean;
  /** When the suppression clears, if any. */
  suppressedUntil: string | null;
}

export function registerRemindersRoutes(app: Express): void {
  // GET /api/user/reminders — upcoming dates with derived metadata
  app.get('/api/user/reminders', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
      const rows = await db
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
          and(
            eq(recipientOccasions.userId, userId),
            // Include occasions with a stored date OR a fixed-date type
            // (Christmas etc. store no date — we resolve it dynamically).
            or(
              sql`${recipientOccasions.date} IS NOT NULL`,
              inArray(recipientOccasions.occasion, Array.from(FIXED_DATE_OCCASIONS)),
            ),
          ),
        );

      const today = stripTime(new Date());
      const upcoming: UpcomingReminder[] = [];

      for (const r of rows) {
        // Fixed-date occasions resolve their date from the calendar (no
        // stored date); everything else rolls its stored month/day.
        const next = isFixedDateOccasion(r.occasion.occasion)
          ? nextFixedOccasionDate(r.occasion.occasion, today)
          : r.occasion.date
            ? computeNextOccurrence(
                parseDateUTC(r.occasion.date as string),
                r.occasion.yearSpecific,
                today,
              )
            : null;
        if (!next) continue; // year-specific past, or no resolvable date

        const daysUntil = Math.round(
          (next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
        );
        const suppressed =
          !!r.occasion.suppressedUntil &&
          parseDateUTC(r.occasion.suppressedUntil) >= today;

        upcoming.push({
          occasionId: r.occasion.id,
          entryId: r.entry.id,
          recipientName: r.entry.name,
          relationship: r.entry.relationship,
          occasion: r.occasion.occasion,
          occurrenceDate: next.toISOString().slice(0, 10),
          daysUntil,
          suppressed,
          suppressedUntil: r.occasion.suppressedUntil
            ? new Date(r.occasion.suppressedUntil).toISOString().slice(0, 10)
            : null,
        });
      }

      // Sort by daysUntil ascending — soonest first.
      upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

      res.json(upcoming);
    } catch (err: any) {
      console.error('[REMINDERS] list failed:', err);
      res.status(500).json({ message: 'Could not load reminders' });
    }
  });

  // POST /api/user/reminders/:occId/suppress — skip this year
  app.post(
    '/api/user/reminders/:occId/suppress',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const occId = parseInt(req.params.occId, 10);
      if (!Number.isFinite(occId)) {
        return res.status(400).json({ message: 'Invalid id' });
      }

      try {
        // "Skip this year" means: suppress until next Jan 1 (after the
        // current year's date passes, the suppression auto-clears).
        // Compute as next-Jan-1 in UTC.
        const today = stripTime(new Date());
        const nextJan1 = new Date(
          Date.UTC(today.getUTCFullYear() + 1, 0, 1),
        );
        const suppressedUntilStr = nextJan1.toISOString().slice(0, 10);

        const [updated] = await db
          .update(recipientOccasions)
          .set({
            suppressedUntil: suppressedUntilStr,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(recipientOccasions.id, occId),
              eq(recipientOccasions.userId, userId),
            ),
          )
          .returning();

        if (!updated) return res.status(404).json({ message: 'Not found' });
        res.json({ ok: true, suppressedUntil: suppressedUntilStr });
      } catch (err: any) {
        console.error('[REMINDERS] suppress failed:', err);
        res.status(500).json({ message: 'Could not suppress' });
      }
    },
  );

  // POST /api/user/reminders/:occId/unsuppress — clear suppression
  app.post(
    '/api/user/reminders/:occId/unsuppress',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const occId = parseInt(req.params.occId, 10);
      if (!Number.isFinite(occId)) {
        return res.status(400).json({ message: 'Invalid id' });
      }

      try {
        const [updated] = await db
          .update(recipientOccasions)
          .set({ suppressedUntil: null, updatedAt: new Date() })
          .where(
            and(
              eq(recipientOccasions.id, occId),
              eq(recipientOccasions.userId, userId),
            ),
          )
          .returning();

        if (!updated) return res.status(404).json({ message: 'Not found' });
        res.json({ ok: true });
      } catch (err: any) {
        console.error('[REMINDERS] unsuppress failed:', err);
        res.status(500).json({ message: 'Could not unsuppress' });
      }
    },
  );

  // POST /api/admin/reminders/dispatch — manually trigger the cron
  // Body: { dryRun?: boolean, asOfDate?: 'YYYY-MM-DD' }
  app.post(
    '/api/admin/reminders/dispatch',
    async (req: Request, res: Response) => {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const schema = z.object({
        dryRun: z.boolean().optional(),
        asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      });
      const parsed = schema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Invalid input',
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      try {
        const result = await runReminderDispatch({
          dryRun: parsed.data.dryRun,
          asOfDate: parsed.data.asOfDate
            ? new Date(parsed.data.asOfDate + 'T00:00:00Z')
            : undefined,
        });
        res.json(result);
      } catch (err: any) {
        console.error('[REMINDERS] manual dispatch failed:', err);
        res.status(500).json({ message: err?.message ?? 'Dispatch failed' });
      }
    },
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers (duplicate of the dispatcher's helpers — kept here so the
// list endpoint doesn't need to import from a sibling file. Small
// enough to inline; extract to shared module if a third caller needs them.)
// ─────────────────────────────────────────────────────────────────────

function stripTime(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseDateUTC(value: string | Date): Date {
  if (value instanceof Date) return stripTime(value);
  const [yStr, mStr, dStr] = value.split('-');
  return new Date(Date.UTC(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10)));
}

function computeNextOccurrence(
  occasionDate: Date,
  yearSpecific: boolean,
  today: Date,
): Date | null {
  if (yearSpecific) {
    return occasionDate >= today ? occasionDate : null;
  }
  const month = occasionDate.getUTCMonth();
  const day = occasionDate.getUTCDate();
  const todayYear = today.getUTCFullYear();
  let candidate = new Date(Date.UTC(todayYear, month, day));
  if (candidate < today) {
    candidate = new Date(Date.UTC(todayYear + 1, month, day));
  }
  return candidate;
}
