// server/routes/site-lock.ts
//
// THE PRE-LAUNCH LOCK (Aidan 2026-09-16: "put the website as password
// protected please with a data capture only… I want to lock down the
// site as I am gonna start posting on socials early access vibes").
//
// While locked, visitors see /coming-soon's page (3D card + early-access
// list). They get the real site with the share password, or by being a
// signed-in admin. The switch and the password live in site_settings and
// are edited at /admin/site — no deploy, no env var.
//
//   GET  /api/site-lock              { locked, allowed, hasPassword, rackEnabled, makerEnabled }
//   POST /api/site-lock/unlock       { password } → sets the pass cookie
//   GET  /api/admin/site-lock        { locked, password, rackEnabled, makerEnabled }
//   PUT  /api/admin/site-lock        { locked?, password?, rackEnabled?, makerEnabled? }
//
// THE RACK SWITCH (Aidan 2026-10-09) rides in the same value: the stock
// cards are not part of launch (no stock — a thin rack reads as a failed
// shop), so `rackEnabled` parks every rack surface until there is stock.
// Off unless an admin has saved it on. Flipped at /admin/site, no deploy.
//
// THE MAKER SWITCH (Aidan 2026-10-29: "go photo route only for this
// launch, keep it simple, shut down the 3 card route from user view")
// is the same shape: `makerEnabled` parks the three-card route (/create,
// /make and its /api/make engine doors) for customers. Off unless an
// admin has saved it on. Signed-in admins keep the route either way, so
// the demo and the lab still work.
//
// The client gate is the experience; the server gate below is what stops
// a locked visitor spending generations by calling the APIs directly.

import type { Express, NextFunction, Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { siteSettings, users } from '@shared/schema';
import { requireAdmin } from './admin-card-lab';

interface LockValue { locked: boolean; password: string; rackEnabled: boolean; makerEnabled: boolean }
const KEY = 'site_lock';
const COOKIE = 'celebrait_pass';
const IS_PROD = process.env.NODE_ENV === 'production';
// Until an admin saves one: locked on the live site, open in dev, with a
// starter share password to change at /admin/site.
const DEFAULT: LockValue = { locked: IS_PROD, password: 'unbinnable', rackEnabled: false, makerEnabled: false };

let cache: { at: number; value: LockValue } | null = null;
export async function getSiteLock(): Promise<LockValue> {
  // Cached for the life of the process (2026-10-28). Render health-checks
  // `/` every few seconds and the shell reads this flag, so ANY expiry
  // turns the health check into a periodic database query: at 10 minutes
  // it woke Neon twice an hour, around the clock, ~3 CU-hrs a day on a
  // site with no visitors. The value only changes through the admin PUT
  // below, which clears this cache in the same process (one instance on
  // Render), and a deploy restarts the process. So nothing goes stale.
  if (cache) return cache.value;
  let value = DEFAULT;
  try {
    const rows = await db.select().from(siteSettings).where(eq(siteSettings.key, KEY)).limit(1);
    const v = rows[0]?.value as Partial<LockValue> | undefined;
    if (v) value = { locked: v.locked === true, password: typeof v.password === 'string' ? v.password : DEFAULT.password, rackEnabled: v.rackEnabled === true, makerEnabled: v.makerEnabled === true };
  } catch {
    // Table not there yet (first boot) — the default holds.
  }
  cache = { at: Date.now(), value };
  return value;
}

const passToken = (password: string) =>
  createHmac('sha256', process.env.SESSION_SECRET ?? 'celebrait-site-lock').update(`site-pass:${password}`).digest('hex').slice(0, 40);

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const sameToken = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function isAdminSession(req: Request): Promise<boolean> {
  const id = (req as any).session?.otpUserId;
  if (typeof id !== 'string' || !id) return false;
  try {
    const row = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, id)).limit(1);
    return row[0]?.isAdmin === true;
  } catch { return false; }
}

/** Is the rack (stock cards, £4.99) for sale right now? */
export async function rackOpen(): Promise<boolean> {
  return (await getSiteLock()).rackEnabled;
}

/** Is the three-card route (/create, /make) open to customers? */
export async function makerOpen(): Promise<boolean> {
  return (await getSiteLock()).makerEnabled;
}

/** Is this request through the gate? (+ the rack and maker flags, so the
 *  SPA learns them from the one request it already makes on every load.
 *  The maker flag is the raw switch; the client lets admins through.) */
export async function siteAllowed(req: Request): Promise<{ locked: boolean; allowed: boolean; hasPassword: boolean; rackEnabled: boolean; makerEnabled: boolean }> {
  const lock = await getSiteLock();
  const hasPassword = lock.password.trim().length > 0;
  const { rackEnabled, makerEnabled } = lock;
  if (!lock.locked) return { locked: false, allowed: true, hasPassword, rackEnabled, makerEnabled };
  const cookie = readCookie(req, COOKIE);
  if (hasPassword && cookie && sameToken(cookie, passToken(lock.password))) return { locked: true, allowed: true, hasPassword, rackEnabled, makerEnabled };
  return { locked: true, allowed: await isAdminSession(req), hasPassword, rackEnabled, makerEnabled };
}

// The APIs that make things (and cost money) — closed to locked visitors.
const GATED_API = /^\/api\/(make|research|photo|photos|studio|checkout|buy|catalogue\/keep)(\/|$)/;

// The three-card route's customer doors (admin-card-lab.ts registers the
// engine ones, make.ts the save). Closed while the maker is parked,
// except to signed-in admins. /api/make/cards/:id/claim stays open: it
// only adopts a card already made, it spends nothing. The admin and
// research doors (/api/admin/*, /api/research/*) are untouched.
const MAKER_API = /^\/api\/make\/(concepts|render|render-inside|ip-safe-art|cameo-check|cards)\/?$/;

// A few tries per address, then a pause — the password is a share code,
// not a login, but it shouldn't be guessable by brute force.
const tries = new Map<string, { n: number; at: number }>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const t = tries.get(ip);
  if (!t || now - t.at > 10 * 60_000) { tries.set(ip, { n: 1, at: now }); return false; }
  t.n += 1;
  return t.n > 12;
}

export function registerSiteLock(app: Express): void {
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (!MAKER_API.test(req.path)) return next();
    try {
      if ((await getSiteLock()).makerEnabled || (await isAdminSession(req))) return next();
      return res.status(409).json({ message: "That way of making a card isn't open yet", code: 'closed' });
    } catch {
      return next();
    }
  });

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (!GATED_API.test(req.path)) return next();
    try {
      const s = await siteAllowed(req);
      if (s.allowed) return next();
      return res.status(423).json({ message: 'Celebrait is launching soon.' });
    } catch {
      return next();
    }
  });

  app.get('/api/site-lock', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await siteAllowed(req));
  });

  app.post('/api/site-lock/unlock', async (req, res) => {
    const ip = String(req.headers['x-forwarded-for'] ?? req.ip ?? '').split(',')[0].trim();
    if (tooMany(ip)) return res.status(429).json({ message: 'Too many tries. Have a breather and try again shortly.' });
    const given = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    const lock = await getSiteLock();
    const want = lock.password.trim();
    if (!want || !given || !sameToken(passToken(given.toLowerCase()), passToken(want.toLowerCase()))) {
      return res.status(401).json({ message: 'That’s not the password.' });
    }
    res.cookie(COOKIE, passToken(lock.password), {
      httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge: 60 * 24 * 60 * 60 * 1000, path: '/',
    });
    res.json({ ok: true });
  });

  app.get('/api/admin/site-lock', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    cache = null;
    res.json(await getSiteLock());
  });

  const putSchema = z.object({ locked: z.boolean().optional(), password: z.string().trim().max(60).optional(), rackEnabled: z.boolean().optional(), makerEnabled: z.boolean().optional() });
  app.put('/api/admin/site-lock', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid settings.' });
    cache = null;
    const next = { ...(await getSiteLock()), ...parsed.data };
    await db.insert(siteSettings).values({ key: KEY, value: next })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: next, updatedAt: sql`now()` } });
    cache = null;
    res.json(next);
  });
}
