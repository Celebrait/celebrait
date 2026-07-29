// server/routes/admin-analytics.ts
//
// GET /api/admin/analytics — the "did that DM turn into a card?" screen.
// Same per-request DB admin gate as /admin/customers. Two views of the
// same 30 days:
//   daily[]   — visits, signups, completed cards, paid orders, revenue
//   sources[] — the funnel split by first-touch source: visits (from
//               site_visits) and signups→cards→paid (joined through
//               users.attribution)
//
// "Source" is utm_source when present, else referrer host, else
// 'direct'. Visits and signups use the SAME rule on both tables so the
// two columns line up.
import type { Express, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

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

export function registerAdminAnalyticsRoutes(app: Express): void {
  app.get('/api/admin/analytics', async (req: Request, res: Response) => {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    try {
      const days = Math.min(Number(req.query.days) || 30, 90);

      // ── Daily series ────────────────────────────────────────────
      const daily = await db.execute(sql`
        WITH d AS (
          SELECT generate_series(
            current_date - ${days - 1} * interval '1 day',
            current_date,
            interval '1 day'
          )::date AS day
        )
        SELECT
          d.day::text AS day,
          COALESCE(v.visits, 0)::int  AS visits,
          COALESCE(u.signups, 0)::int AS signups,
          COALESCE(c.cards, 0)::int   AS cards,
          COALESCE(o.paid, 0)::int    AS paid,
          COALESCE(o.revenue, 0)::int AS revenue
        FROM d
        LEFT JOIN (
          SELECT created_at::date AS day, count(*) AS visits
          FROM site_visits GROUP BY 1
        ) v ON v.day = d.day
        LEFT JOIN (
          SELECT created_at::date AS day, count(*) AS signups
          FROM users GROUP BY 1
        ) u ON u.day = d.day
        LEFT JOIN (
          SELECT created_at::date AS day, count(*) AS cards
          FROM cards WHERE status = 'completed' GROUP BY 1
        ) c ON c.day = d.day
        LEFT JOIN (
          SELECT paid_at::date AS day,
                 count(*) AS paid,
                 sum(COALESCE(amount_paid, total_amount)) AS revenue
          FROM studio_orders WHERE payment_status = 'paid' GROUP BY 1
        ) o ON o.day = d.day
        ORDER BY d.day
      `);

      // ── Source funnel ───────────────────────────────────────────
      // Visits per source (window = same N days).
      const visitSources = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(utm_source, ''), NULLIF(referrer_host, ''), 'direct') AS source,
          count(*)::int AS visits
        FROM site_visits
        WHERE created_at >= current_date - ${days - 1} * interval '1 day'
        GROUP BY 1
      `);

      // Signups → cards → paid per first-touch source. Users without
      // attribution (pre-feature accounts) roll up under 'unknown'.
      const signupFunnel = await db.execute(sql`
        WITH su AS (
          SELECT
            id,
            CASE
              WHEN attribution IS NULL THEN 'unknown'
              ELSE COALESCE(
                NULLIF(attribution->>'utmSource', ''),
                NULLIF(attribution->>'referrerHost', ''),
                'direct'
              )
            END AS source
          FROM users
          WHERE created_at >= current_date - ${days - 1} * interval '1 day'
        )
        SELECT
          su.source,
          count(DISTINCT su.id)::int AS signups,
          count(DISTINCT c.id)::int  AS cards,
          count(DISTINCT o.id)::int  AS paid,
          COALESCE(sum(COALESCE(o.amount_paid, o.total_amount)), 0)::int AS revenue
        FROM su
        LEFT JOIN cards c ON c.user_id = su.id AND c.status = 'completed'
        LEFT JOIN studio_orders o ON o.user_id = su.id AND o.payment_status = 'paid'
        GROUP BY su.source
        ORDER BY signups DESC
      `);

      // Merge visits into the signup rows (a source can have visits but
      // no signups, and vice versa).
      const bySource = new Map<string, any>();
      for (const r of signupFunnel.rows as any[]) {
        bySource.set(r.source, { source: r.source, visits: 0, ...r });
      }
      for (const r of visitSources.rows as any[]) {
        const row = bySource.get(r.source);
        if (row) row.visits = r.visits;
        else
          bySource.set(r.source, {
            source: r.source,
            visits: r.visits,
            signups: 0,
            cards: 0,
            paid: 0,
            revenue: 0,
          });
      }
      const sources = Array.from(bySource.values()).sort(
        (a, b) => b.visits + b.signups * 10 - (a.visits + a.signups * 10),
      );

      const dailyRows = daily.rows as any[];
      const totals = dailyRows.reduce(
        (t, r) => ({
          visits: t.visits + r.visits,
          signups: t.signups + r.signups,
          cards: t.cards + r.cards,
          paid: t.paid + r.paid,
          revenue: t.revenue + r.revenue,
        }),
        { visits: 0, signups: 0, cards: 0, paid: 0, revenue: 0 },
      );

      res.json({ days, totals, daily: dailyRows, sources });
    } catch (err: any) {
      console.error('[ADMIN-ANALYTICS]', err);
      res.status(500).json({ message: err?.message ?? 'Analytics query failed' });
    }
  });
}
