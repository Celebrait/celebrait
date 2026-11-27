// server/make-insights.ts — what people make on the three-card route,
// and where they stop (Aidan 2026-11-27: "can we see what people
// generate to study behaviour?").
//
// Two tables, both created at boot (the ensurePerfTable discipline, no
// manual prod SQL):
//   make_sets  — one row per set drawn for a customer: what they typed
//                and the three fronts we wrote. Never a person: no user
//                id, no IP, no names typed for the front. Admin-only.
//   make_steps — one row per step reached (started, questions done,
//                drawn, picked, finished, buy). Counts, not people: no
//                id joins two rows except the set, which is what makes
//                "picked card 2 of this set" readable.
// Paid comes from studio_orders, so it can never disagree with the money.
//
// GET /api/admin/maker returns the funnel and the latest sets for
// /admin/maker. Per-request DB admin check, as every admin route.

import type { Express, Request, Response } from 'express';
import { sql, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { users } from '@shared/schema';

export const MAKE_STEPS = ['landed', 'started', 'questions', 'drawn', 'picked', 'finished', 'buy'] as const;
/** The photo route's own journey (2026-11-27). 'drawn' and 'finished'
 *  are logged by the generator itself (background-generator.ts), so a
 *  closed tab can't lose them. */
export const PHOTO_STEPS = ['landed', 'started', 'photo', 'scene', 'generate', 'drawn', 'finished', 'buy'] as const;
const ALL_STEPS = ['landed', 'started', 'questions', 'photo', 'scene', 'generate', 'drawn', 'picked', 'finished', 'buy'] as const;
export type MakeRoute = 'maker' | 'photo';
export type MakeStep = (typeof ALL_STEPS)[number];

export async function ensureMakeInsightTables(): Promise<void> {
  try {
    await db.execute(sql`create table if not exists make_sets (
      id bigserial primary key,
      set_id text not null,
      occasion text,
      tone text,
      recipient text,
      interest text,
      dislike text,
      fronts jsonb not null,
      flagged jsonb,
      cost_cents real,
      created_at timestamptz not null default now()
    )`);
    await db.execute(sql`create index if not exists make_sets_created_at_idx on make_sets (created_at)`);
    await db.execute(sql`create index if not exists make_sets_set_id_idx on make_sets (set_id)`);
    await db.execute(sql`create table if not exists make_steps (
      id bigserial primary key,
      step text not null,
      occasion text,
      set_id text,
      detail text,
      source text,
      device text,
      created_at timestamptz not null default now()
    )`);
    await db.execute(sql`create index if not exists make_steps_created_at_idx on make_steps (created_at)`);
    await db.execute(sql`create index if not exists make_steps_set_id_idx on make_steps (set_id)`);
    // 2026-11-27: which route the step belongs to (null = the three-card
    // route, every row written before the photo route was counted).
    await db.execute(sql`alter table make_steps add column if not exists route text`);
  } catch (err) {
    console.warn('[MAKE-INSIGHTS] table check failed:', (err as Error)?.message ?? err);
  }
}

const occ = (s?: string | null) => (s ?? '').trim().toLowerCase().slice(0, 40) || null;

/** Called by the concepts handler for CUSTOMER sets only (/api/make/*). */
export function logMakeSet(s: {
  setId: string; occasion?: string | null; tone?: string | null; recipient?: string | null;
  interest?: string | null; dislike?: string | null;
  fronts: Array<{ front_text: string; art_direction?: string; tone?: string }>;
  flagged?: string[]; costCents?: number;
}): void {
  void db.execute(sql`insert into make_sets (set_id, occasion, tone, recipient, interest, dislike, fronts, flagged, cost_cents)
    values (${s.setId}, ${occ(s.occasion)}, ${s.tone ?? null}, ${s.recipient?.slice(0, 60) ?? null}, ${s.interest?.slice(0, 200) ?? null},
      ${s.dislike?.slice(0, 200) ?? null}, ${JSON.stringify(s.fronts)}::jsonb, ${s.flagged?.length ? JSON.stringify(s.flagged) : null}::jsonb, ${s.costCents ?? null})`)
    .catch((e) => console.warn('[MAKE-INSIGHTS] set log failed (non-fatal):', (e as Error)?.message ?? e));
}

export function logMakeStep(step: MakeStep, o: { route?: MakeRoute; occasion?: string | null; setId?: string | null; detail?: string | null; source?: string | null; device?: string | null }): void {
  void db.execute(sql`insert into make_steps (step, route, occasion, set_id, detail, source, device)
    values (${step}, ${o.route === 'photo' ? 'photo' : null}, ${occ(o.occasion)}, ${o.setId?.slice(0, 16) ?? null}, ${o.detail?.slice(0, 40) ?? null}, ${o.source?.slice(0, 60) ?? null}, ${o.device ?? null})`)
    .catch((e) => console.warn('[MAKE-INSIGHTS] step log failed (non-fatal):', (e as Error)?.message ?? e));
}

const stepSchema = z.object({
  step: z.enum(ALL_STEPS),
  route: z.enum(['maker', 'photo']).optional(),
  occasion: z.string().max(40).nullable().optional(),
  setId: z.string().max(16).nullable().optional(),
  detail: z.string().max(40).nullable().optional(),
  source: z.string().max(60).nullable().optional(),
});

// Same shape as /api/rum's limiter: a page fires a handful of steps, so
// anything beyond this is a script and is dropped quietly.
const recent = new Map<string, { t: number; n: number }>();
function allowed(ip: string): boolean {
  const now = Date.now();
  const r = recent.get(ip);
  if (!r || now - r.t > 60_000) { recent.set(ip, { t: now, n: 1 }); return true; }
  if (r.n >= 40) return false;
  r.n++;
  return true;
}

async function isAdmin(req: Request): Promise<boolean> {
  const id = (req as any).session?.otpUserId;
  if (typeof id !== 'string' || !id) return false;
  const row = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, id)).limit(1);
  return row[0]?.isAdmin === true;
}

export function registerMakeInsights(app: Express): void {
  app.post('/api/make/step', (req: Request, res: Response) => {
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').split(',')[0].trim();
    if (!allowed(ip)) return res.status(204).end();
    // Our own checks (?_noanalytics=1 on the page) stay out of the counts.
    const ref = String(req.headers.referer ?? '');
    if (ref.includes('_noanalytics')) return res.status(204).end();
    let body: unknown = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    const p = stepSchema.safeParse(body);
    if (!p.success) return res.status(204).end();
    const ua = String(req.headers['user-agent'] ?? '');
    if (/bot|crawl|spider|headless|lighthouse/i.test(ua)) return res.status(204).end();
    logMakeStep(p.data.step, { ...p.data, device: /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop' });
    res.status(204).end();
  });

  app.get('/api/admin/maker', async (req: Request, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ message: 'Admin access required' });
    try {
      const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
      const o = occ(typeof req.query.occasion === 'string' ? req.query.occasion : '') ;
      const route: MakeRoute = req.query.route === 'photo' ? 'photo' : 'maker';
      if (route === 'photo') return res.json(await photoInsights(days, o));
      const steps = await db.execute(sql`
        select step, count(*)::int as n,
               count(*) filter (where source = 'meta')::int as from_meta
        from make_steps
        where created_at >= now() - ${days} * interval '1 day'
          and (${o}::text is null or occasion = ${o})
          and route is null
        group by step`);
      const paid = await db.execute(sql`
        select count(*)::int as n
        from studio_orders so join cards c on c.id = so.card_id
        where so.payment_status = 'paid' and c.source = 'maker'
          and so.paid_at >= now() - ${days} * interval '1 day'
          and (${o}::text is null or lower(trim(c.conversation_data->'brief'->>'occasion')) = ${o})`);
      const sets = await db.execute(sql`
        select s.set_id, s.created_at, s.occasion, s.tone, s.recipient, s.interest, s.dislike, s.fronts, s.flagged,
               pk.detail as picked,
               fc.id as card_id,
               (fc.id is not null and exists (
                 select 1 from studio_orders so where so.card_id = fc.id and so.payment_status = 'paid'
               )) as paid
        from make_sets s
        left join lateral (
          select detail from make_steps st where st.set_id = s.set_id and st.step = 'picked'
          order by st.created_at desc limit 1
        ) pk on true
        left join lateral (
          select id from cards c where c.source = 'maker' and c.conversation_data->'concept'->>'setId' = s.set_id
          order by c.id desc limit 1
        ) fc on true
        where s.created_at >= now() - ${days} * interval '1 day'
          and (${o}::text is null or s.occasion = ${o})
        order by s.created_at desc
        limit 150`);
      const counts: Record<string, { n: number; fromMeta: number }> = {};
      for (const r of steps.rows as Array<{ step: string; n: number; from_meta: number }>) counts[r.step] = { n: r.n, fromMeta: r.from_meta };
      res.json({
        days, occasion: o, route: 'maker',
        funnel: [...MAKE_STEPS.map((s) => ({ step: s, n: counts[s]?.n ?? 0, fromMeta: counts[s]?.fromMeta ?? 0 })),
          { step: 'paid', n: (paid.rows[0] as { n: number } | undefined)?.n ?? 0, fromMeta: null }],
        sets: sets.rows,
      });
    } catch (err) {
      console.error('[MAKE-INSIGHTS] admin read failed:', err);
      res.status(500).json({ message: 'Could not load the maker data' });
    }
  });
}

/** The photo route's half of /admin/maker. Its cards live in `cards`
 *  (source 'photo', drawn in the studio pipeline, guests included), so
 *  "what people made" is read from there: the scene they wrote and the
 *  words for the front, never their photo. */
async function photoInsights(days: number, o: string | null) {
  const steps = await db.execute(sql`
    select step, count(*)::int as n,
           count(*) filter (where source = 'meta')::int as from_meta
    from make_steps
    where created_at >= now() - ${days} * interval '1 day'
      and (${o}::text is null or occasion = ${o})
      and route = 'photo'
    group by step`);
  const paid = await db.execute(sql`
    select count(*)::int as n
    from studio_orders so join cards c on c.id = so.card_id
    where so.payment_status = 'paid' and c.source = 'photo'
      and so.paid_at >= now() - ${days} * interval '1 day'
      and (${o}::text is null or lower(trim(c.conversation_data->'recipient'->>'occasion')) = ${o})`);
  const made = await db.execute(sql`
    select c.id as card_id, c.created_at, c.status,
           c.conversation_data->'recipient'->>'name' as recipient,
           lower(trim(c.conversation_data->'recipient'->>'occasion')) as occasion,
           c.conversation_data->'scene'->>'description' as scene,
           c.conversation_data->'front'->>'mode' as front_mode,
           c.conversation_data->'front'->>'text' as front_text,
           (u.email like '%@guests.celebrait.co.uk') as guest,
           exists (select 1 from studio_orders so where so.card_id = c.id and so.payment_status = 'paid') as paid
    from cards c left join users u on u.id = c.user_id
    where c.source = 'photo'
      and c.created_at >= now() - ${days} * interval '1 day'
      and (${o}::text is null or lower(trim(c.conversation_data->'recipient'->>'occasion')) = ${o})
      and coalesce(c.conversation_data->'scene'->>'description', '') <> ''
      and coalesce(u.is_admin, false) = false
    order by c.created_at desc
    limit 150`);
  const counts: Record<string, { n: number; fromMeta: number }> = {};
  for (const r of steps.rows as Array<{ step: string; n: number; from_meta: number }>) counts[r.step] = { n: r.n, fromMeta: r.from_meta };
  return {
    days, occasion: o, route: 'photo' as const,
    funnel: [...PHOTO_STEPS.map((s) => ({ step: s, n: counts[s]?.n ?? 0, fromMeta: counts[s]?.fromMeta ?? 0 })),
      { step: 'paid', n: (paid.rows[0] as { n: number } | undefined)?.n ?? 0, fromMeta: null }],
    sets: [],
    photoCards: made.rows,
  };
}
