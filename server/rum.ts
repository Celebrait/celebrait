// server/rum.ts — REAL-USER TIMING (2026-09-08)
//
// The speed audit was a one-off; this makes it continuous. Every public
// page load posts one small sample (see client/src/lib/rum.ts); the
// admin analytics page rolls them up per route (p50 / p75 LCP, TTFB).
// Cookieless and anonymous: a path and a handful of millisecond
// numbers, nothing else. The table is created here at boot so prod
// needs no manual schema push.

import type { Express, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { perfSamples } from '@shared/schema';

const ms = z.number().int().min(0).max(120_000).nullable().optional();
const sampleSchema = z.object({
  path: z.string().min(1).max(200),
  ttfb: ms, dcl: ms, load: ms, lcp: ms,
  cls: z.number().int().min(0).max(100_000).nullable().optional(),
  device: z.enum(['mobile', 'desktop']).nullable().optional(),
  conn: z.string().max(16).nullable().optional(),
});

export async function ensurePerfTable(): Promise<void> {
  try {
    await db.execute(sql`create table if not exists perf_samples (
      id bigserial primary key,
      path text not null,
      ttfb integer, dcl integer, load integer, lcp integer, cls integer,
      device text, conn text,
      created_at timestamp not null default now()
    )`);
    await db.execute(sql`create index if not exists perf_samples_created_at_idx on perf_samples (created_at)`);
  } catch (err) {
    console.warn('[RUM] table check failed:', (err as Error)?.message ?? err);
  }
}

// Per-IP soft cap so a stuck tab can't flood the table: 60 samples/min.
const recent = new Map<string, { t: number; n: number }>();
function allowed(ip: string): boolean {
  const now = Date.now();
  const r = recent.get(ip);
  if (!r || now - r.t > 60_000) { recent.set(ip, { t: now, n: 1 }); return true; }
  if (r.n >= 60) return false;
  r.n++;
  return true;
}

export function registerRum(app: Express): void {
  app.post('/api/rum', async (req: Request, res: Response) => {
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').split(',')[0].trim();
    if (!allowed(ip)) return res.status(204).end();
    // sendBeacon may arrive as text/plain — parse ourselves.
    let body: unknown = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    const parsed = sampleSchema.safeParse(body);
    if (!parsed.success) return res.status(204).end();
    const s = parsed.data;
    try {
      await db.insert(perfSamples).values({
        // Path only — strip anything that isn't the route (ids are fine,
        // query strings are not).
        path: s.path.split('?')[0].slice(0, 200),
        ttfb: s.ttfb ?? null, dcl: s.dcl ?? null, load: s.load ?? null, lcp: s.lcp ?? null, cls: s.cls ?? null,
        device: s.device ?? null, conn: s.conn ?? null,
      });
    } catch (err) {
      console.warn('[RUM] insert failed:', (err as Error)?.message ?? err);
    }
    res.status(204).end();
  });
}

export interface PerfRouteRow {
  path: string; n: number;
  ttfb_p75: number | null; lcp_p50: number | null; lcp_p75: number | null;
  mobile_lcp_p75: number | null; mobile_n: number;
}

/** Per-route rollup for the admin analytics page (last `days` days). */
export async function perfRollup(days: number): Promise<PerfRouteRow[]> {
  const r = await db.execute(sql`
    select path,
      count(*)::int as n,
      percentile_cont(0.75) within group (order by ttfb)::int as ttfb_p75,
      percentile_cont(0.5)  within group (order by lcp)::int  as lcp_p50,
      percentile_cont(0.75) within group (order by lcp)::int  as lcp_p75,
      percentile_cont(0.75) within group (order by lcp) filter (where device = 'mobile')::int as mobile_lcp_p75,
      count(*) filter (where device = 'mobile')::int as mobile_n
    from perf_samples
    where created_at > now() - (${days} || ' days')::interval
    group by path
    order by n desc
    limit 20`);
  return r.rows as unknown as PerfRouteRow[];
}
