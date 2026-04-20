// server/routes/admin-costs.ts
//
// Admin Cost Ledger endpoint. Powers /admin/costs — turns the
// generation_log rows into the metrics that inform Sprint 4 pricing.
//
// One endpoint by design: GET /api/admin/costs?window=today|7d|30d
// Returns every aggregate the dashboard renders. Saves a stack of
// round-trips and lets us compute related metrics (e.g. spend +
// regen rate over the same window) atomically.
//
// Auth: admin-only, mirrors the prompt-routes pattern (session OTP
// user → users.is_admin flag).
//
// All metrics in the customer-facing slice filter out lab test runs
// (cardId IS NULL). Lab spend is a separate concern and isn't useful
// for pricing decisions.
//
// Spec: memory/next_cost_ledger_ui.md (Prompt Lab Phase 5a).

import type { Express, Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';

type Window = 'today' | '7d' | '30d';

function parseWindow(raw: unknown): Window {
  if (raw === '7d' || raw === '30d' || raw === 'today') return raw;
  return '7d';
}

// Returns the SQL fragment that filters generation_log rows to the
// requested window. `today` = since UTC midnight; `7d`/`30d` = trailing N days.
function windowFilter(window: Window) {
  if (window === 'today') {
    return sql`created_at >= date_trunc('day', now() at time zone 'utc')`;
  }
  const days = window === '7d' ? 7 : 30;
  return sql`created_at >= now() - (${sql.raw(String(days))} || ' days')::interval`;
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

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!(await isAdmin(req))) {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
}

export function registerAdminCostsRoutes(app: Express): void {
  app.get('/api/admin/costs', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;

    try {
      const window = parseWindow(req.query.window);
      const filter = windowFilter(window);

      // ── Spend totals across the three standard windows. Always
      //    return all three so the at-a-glance cards don't need
      //    separate calls per window switch. Filter out lab runs.
      const spendTotalsRaw = await db.execute(sql`
        select
          coalesce(sum(case when created_at >= date_trunc('day', now() at time zone 'utc') then cost_cents_x100 else 0 end), 0) as today,
          coalesce(sum(case when created_at >= now() - interval '7 days' then cost_cents_x100 else 0 end), 0) as week,
          coalesce(sum(case when created_at >= now() - interval '30 days' then cost_cents_x100 else 0 end), 0) as month
        from generation_log
        where card_id is not null
      `);
      const spendTotals = spendTotalsRaw.rows[0] as { today: number; week: number; month: number };

      // ── Window-scoped aggregates. Everything below is for the
      //    selected window so the dashboard responds when the user
      //    flips between today/7d/30d.

      // Total spend + total rows + success rate inside the window.
      const overviewRaw = await db.execute(sql`
        select
          coalesce(sum(cost_cents_x100), 0) as total_cents_x100,
          count(*) as total_rows,
          count(*) filter (where success = true) as success_rows,
          count(distinct card_id) as distinct_cards
        from generation_log
        where card_id is not null and ${filter}
      `);
      const overview = overviewRaw.rows[0] as {
        total_cents_x100: number;
        total_rows: number;
        success_rows: number;
        distinct_cards: number;
      };

      // Per-card cost. Sum cents over all rows for each cardId, then
      // average those sums. = "what does an end-to-end card attempt
      // cost, including any retries / regens?"
      const perCardRaw = await db.execute(sql`
        with per_card as (
          select card_id, sum(cost_cents_x100) as card_cents
          from generation_log
          where card_id is not null and ${filter}
          group by card_id
        )
        select
          coalesce(avg(card_cents), 0)::float as avg_cents,
          coalesce(max(card_cents), 0) as max_cents,
          coalesce(min(card_cents), 0) as min_cents
        from per_card
      `);
      const perCard = perCardRaw.rows[0] as {
        avg_cents: number;
        max_cents: number;
        min_cents: number;
      };

      // Regen rate proxy. Average rows per cardId across the window.
      // Without an explicit attempt_id column we can't distinguish
      // "front + inside of one attempt" from "user re-rolled twice."
      // For now: rows per card. Memory note 'Data nuances' acknowledges
      // this — improve when attempt_id ships.
      const regenRaw = await db.execute(sql`
        with per_card as (
          select card_id, count(*) as row_count
          from generation_log
          where card_id is not null and ${filter}
          group by card_id
        )
        select coalesce(avg(row_count), 0)::float as avg_rows_per_card
        from per_card
      `);
      const regen = regenRaw.rows[0] as { avg_rows_per_card: number };

      // Breakdown by provider.
      const byProviderRaw = await db.execute(sql`
        select
          provider,
          count(*) as rows,
          coalesce(sum(cost_cents_x100), 0) as cents_x100
        from generation_log
        where card_id is not null and ${filter}
        group by provider
        order by cents_x100 desc
      `);

      // Breakdown by slot.
      const bySlotRaw = await db.execute(sql`
        select
          slot,
          count(*) as rows,
          coalesce(sum(cost_cents_x100), 0) as cents_x100
        from generation_log
        where card_id is not null and ${filter}
        group by slot
        order by cents_x100 desc
      `);

      // Top 10 expensive (template, version) pairs in window. Useful for
      // "which prompt version is bleeding money."
      const topTemplatesRaw = await db.execute(sql`
        select
          template_id,
          template_version,
          count(*) as rows,
          coalesce(sum(cost_cents_x100), 0) as cents_x100
        from generation_log
        where card_id is not null and template_id is not null and ${filter}
        group by template_id, template_version
        order by cents_x100 desc
        limit 10
      `);

      // Daily series for the trend charts. One row per day in the window:
      // total spend, distinct cards, total rows. Lets the client compute
      // cost-per-card per day + regen-rate per day client-side.
      const dailyRaw = await db.execute(sql`
        select
          date_trunc('day', created_at)::date as day,
          coalesce(sum(cost_cents_x100), 0) as cents_x100,
          count(*) as rows,
          count(distinct card_id) as cards
        from generation_log
        where card_id is not null and ${filter}
        group by day
        order by day asc
      `);

      // Recent expensive cards — last 20 distinct cardIds in window
      // ordered by their summed cost. Sanity check for outliers.
      const recentExpensiveRaw = await db.execute(sql`
        select
          card_id,
          coalesce(sum(cost_cents_x100), 0) as cents_x100,
          count(*) as rows,
          max(created_at) as last_row_at
        from generation_log
        where card_id is not null and ${filter}
        group by card_id
        order by cents_x100 desc
        limit 20
      `);

      res.json({
        window,
        // All three totals so the at-a-glance cards don't need separate calls.
        spendTotals: {
          todayCentsX100: Number(spendTotals.today),
          weekCentsX100: Number(spendTotals.week),
          monthCentsX100: Number(spendTotals.month),
        },
        overview: {
          totalCentsX100: Number(overview.total_cents_x100),
          totalRows: Number(overview.total_rows),
          successRows: Number(overview.success_rows),
          successRate:
            Number(overview.total_rows) > 0
              ? Number(overview.success_rows) / Number(overview.total_rows)
              : 0,
          distinctCards: Number(overview.distinct_cards),
        },
        perCard: {
          avgCentsX100: Number(perCard.avg_cents),
          maxCentsX100: Number(perCard.max_cents),
          minCentsX100: Number(perCard.min_cents),
        },
        regen: {
          avgRowsPerCard: Number(regen.avg_rows_per_card),
        },
        byProvider: byProviderRaw.rows.map((r: any) => ({
          provider: r.provider as string,
          rows: Number(r.rows),
          centsX100: Number(r.cents_x100),
        })),
        bySlot: bySlotRaw.rows.map((r: any) => ({
          slot: r.slot as string,
          rows: Number(r.rows),
          centsX100: Number(r.cents_x100),
        })),
        topTemplates: topTemplatesRaw.rows.map((r: any) => ({
          templateId: Number(r.template_id),
          templateVersion: r.template_version != null ? Number(r.template_version) : null,
          rows: Number(r.rows),
          centsX100: Number(r.cents_x100),
        })),
        daily: dailyRaw.rows.map((r: any) => ({
          day: String(r.day),
          centsX100: Number(r.cents_x100),
          rows: Number(r.rows),
          cards: Number(r.cards),
        })),
        recentExpensive: recentExpensiveRaw.rows.map((r: any) => ({
          cardId: Number(r.card_id),
          centsX100: Number(r.cents_x100),
          rows: Number(r.rows),
          lastRowAt: r.last_row_at,
        })),
      });
    } catch (err) {
      console.error('[ADMIN_COSTS] error:', err);
      res.status(500).json({ message: 'Failed to load cost ledger' });
    }
  });
}
