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
//   GET  /api/site-lock              { locked, allowed, hasPassword }
//   POST /api/site-lock/unlock       { password } → sets the pass cookie
//   GET  /api/admin/site-lock        { locked, password }
//   PUT  /api/admin/site-lock        { locked?, password? }
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

interface LockValue { locked: boolean; password: string }
const KEY = 'site_lock';
const COOKIE = 'celebrait_pass';
const IS_PROD = process.env.NODE_ENV === 'production';
// Until an admin saves one: locked on the live site, open in dev, with a
// starter share password to change at /admin/site.
const DEFAULT: LockValue = { locked: IS_PROD, password: 'unbinnable' };

let cache: { at: number; value: LockValue } | null = null;
export async function getSiteLock(): Promise<LockValue> {
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  let value = DEFAULT;
  try {
    const rows = await db.select().from(siteSettings).where(eq(siteSettings.key, KEY)).limit(1);
    const v = rows[0]?.value as Partial<LockValue> | undefined;
    if (v) value = { locked: v.locked === true, password: typeof v.password === 'string' ? v.password : DEFAULT.password };
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

/** Is this request through the gate? */
export async function siteAllowed(req: Request): Promise<{ locked: boolean; allowed: boolean; hasPassword: boolean }> {
  const lock = await getSiteLock();
  const hasPassword = lock.password.trim().length > 0;
  if (!lock.locked) return { locked: false, allowed: true, hasPassword };
  const cookie = readCookie(req, COOKIE);
  if (hasPassword && cookie && sameToken(cookie, passToken(lock.password))) return { locked: true, allowed: true, hasPassword };
  return { locked: true, allowed: await isAdminSession(req), hasPassword };
}

// The APIs that make things (and cost money) — closed to locked visitors.
const GATED_API = /^\/api\/(make|research|photo|photos|studio|checkout|buy|catalogue\/keep)(\/|$)/;

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

  const putSchema = z.object({ locked: z.boolean().optional(), password: z.string().trim().max(60).optional() });
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
