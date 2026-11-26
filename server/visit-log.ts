// server/visit-log.ts
//
// First-party page-view logging (2026-07-29). One middleware, mounted
// before the routes: logs HTML page views only (not assets, not API,
// not bots), fire-and-forget so it can never add latency to a request.
//
// PRIVACY BY DESIGN — this is why no consent banner is needed:
//   • no cookie is set, ever
//   • no IP address is stored
//   • no user id is stored (attribution to signups happens separately,
//     client-side first-touch → users.attribution, with the user's
//     account — not here)
//   • the query string is dropped except for the three utm_* fields
//
// Bot filtering is a UA regex — imperfect by design. Headless crawlers
// that lie about their UA will slip through; at our scale direction
// matters more than precision, and skipping obvious bots keeps the
// table honest without maintaining a bot-detection arms race.

import { createHash } from 'crypto';
import { touchActivity } from './activity';
import type { Express, Request } from 'express';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { siteVisits, users } from '@shared/schema';
import { isKnownRoutePath } from '@shared/seo';

const BOT_RE =
  /bot|crawler|spider|crawling|preview|scraper|curl|wget|python|httpx|axios|headless|lighthouse|pingdom|monitor|facebookexternalhit|slurp|duckduck|baidu|yandex|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|amazonbot|applebot/i;

/** Paths that are page views. Everything else (assets, api, files with
 *  extensions) is noise. */
function isPageView(req: Request): boolean {
  if (req.method !== 'GET') return false;
  const p = req.path;
  if (p.startsWith('/api/') || p.startsWith('/assets/')) return false;
  // Anything with a file extension (.js, .css, .webp, .xml, .txt …)
  if (/\.[a-z0-9]{2,5}$/i.test(p)) return false;
  // Only requests that actually want HTML.
  const accept = req.headers.accept ?? '';
  if (!accept.includes('text/html')) return false;
  return true;
}

// ── Who is a visitor (Aidan 2026-11-26: "why so many visitors sporadic
// ... the site aint being marketed anywhere") ─────────────────────────
// The UA regex only catches bots that say they are bots. Two more holes
// let the rest in, and both are closed here:
//
//   1. ANY path counted, real page or not — so a scanner walking
//      /wp-admin, /backup, /config … arrived as a burst of "visitors".
//      A visit now has to be to a page the site actually serves
//      (shared/seo's route mirror, the same list the 404 fallback uses).
//      Our own tooling pages are not an audience either.
//
//   2. A bot that CLAIMS to be Chrome counted as a person. A real
//      browser opening a page says so in headers a script almost never
//      bothers to fake: Accept-Language (always), and Sec-Fetch-Dest:
//      document + Sec-Fetch-Mode: navigate (every current browser).
//      Safari before 16.4, and the in-app browsers built on it, send no
//      Sec-Fetch headers at all, so a WebKit-only UA without them still
//      counts — an old iPhone arriving from an ad must not vanish. A
//      "Chrome" without them is not Chrome.
//
// Nothing new is stored: these are read off the request and dropped.
const INTERNAL_RE = /^\/(admin|card-capture|og|research|demo|door2?|hero-poc)(\/|$)/;

function isRealPage(path: string): boolean {
  return isKnownRoutePath(path) && !INTERNAL_RE.test(path);
}

function isBrowserNavigation(req: Request): boolean {
  if (!req.headers['accept-language']) return false;
  // Chrome fetching a page ahead of a click the visitor may never make.
  const purpose = `${req.headers['sec-purpose'] ?? ''} ${req.headers['purpose'] ?? ''} ${req.headers['x-moz'] ?? ''}`;
  if (/prefetch|prerender/i.test(purpose)) return false;
  const dest = req.headers['sec-fetch-dest'];
  const mode = req.headers['sec-fetch-mode'];
  if (dest || mode) return dest === 'document' && mode === 'navigate';
  const ua = String(req.headers['user-agent'] ?? '');
  return /AppleWebKit/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
}

/** Exported for the admin screen, which labels old rows that the rules
 *  above would no longer count. */
export function isCountedPath(path: string): boolean {
  return isRealPage(path);
}

function referrerHost(req: Request): string | null {
  const ref = req.headers.referer;
  if (!ref) return null;
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    // Self-referrals (SPA navigations, internal links) aren't a source.
    // Both market domains count as self (the old co.uk 301s to co.za).
    if (/(^|\.)celebrait\.co\.(uk|za)$/.test(host) || host === 'localhost') return null;
    return host.slice(0, 100);
  } catch {
    return null;
  }
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, 100) : null;

// ── Noise filters (Aidan 2026-08-04: "says 39 visits today — maybe some
// of them are from me?"). They were: our own testing and verification
// reloads dominated the count, so the first real traffic would have been
// invisible inside it. Three cheap defences, none of which store
// anything new about a visitor:
//
//   1. ADMIN SKIP — signed-in admins aren't an audience. Admin ids are
//      cached in memory (refreshed every 10 min) so the check stays
//      synchronous and adds no query to a page view.
//   2. REPEAT COLLAPSE — the same browser reloading the same path inside
//      10 minutes counts once. The key is a hash of user-agent +
//      language + path held ONLY in memory, never written down; it dies
//      with the process. (Trade-off: two genuinely different visitors on
//      identical devices, same page, inside 10 minutes would collapse
//      into one. At current volumes a reload spree is far the bigger
//      distortion — revisit if traffic grows.)
//   3. ?_noanalytics=1 — an explicit escape hatch for our own checks.
//
const adminIds = new Set<string>();
async function refreshAdminIds(): Promise<void> {
  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isAdmin, true));
    adminIds.clear();
    for (const r of rows) adminIds.add(r.id);
  } catch {
    /* leave the last known set in place */
  }
}

const REPEAT_WINDOW_MS = 10 * 60 * 1000;
const recentViews = new Map<string, number>();

function isRepeat(req: Request): boolean {
  const key = createHash('sha1')
    .update(
      [
        req.headers['user-agent'] ?? '',
        req.headers['accept-language'] ?? '',
        req.path,
      ].join('|'),
    )
    .digest('hex');
  const now = Date.now();
  const seen = recentViews.get(key);
  if (seen && now - seen < REPEAT_WINDOW_MS) {
    recentViews.set(key, now); // slide the window while they're active
    return true;
  }
  recentViews.set(key, now);
  // Opportunistic prune so the map can't grow unbounded.
  if (recentViews.size > 5000) {
    Array.from(recentViews.entries()).forEach(([k, t]) => {
      if (now - t > REPEAT_WINDOW_MS) recentViews.delete(k);
    });
  }
  return false;
}

/** Refreshed LAZILY, on traffic, not on a timer. The old ten-minute
 *  interval queried `users` forever whether or not anyone was on the
 *  site, and on Neon that is enough on its own to stop the compute ever
 *  suspending (see server/activity.ts). An idle site now makes no
 *  queries at all; a busy one re-reads the admin list once an hour,
 *  which is far more often than it changes. */
const ADMIN_REFRESH_MS = 60 * 60 * 1000;
let adminIdsAt = 0;

export function registerVisitLogging(app: Express): void {
  void refreshAdminIds().then(() => { adminIdsAt = Date.now(); });

  // Only a request that CHANGES something counts as activity for the
  // background sweeps. Everything the sweeper looks for starts with a
  // write (a generation, a draft, an order), and the first week of
  // October showed why GETs must not count: crawlers, uptime pings and
  // a health check are enough "traffic" to run a sweep every ten minutes
  // on a site nobody has visited — each one a 5-minute Neon wake
  // (2026-10-07). The admin-id refresh moved below, into the branch that
  // is about to write a visit row anyway, so it never wakes the
  // database on its own.
  app.use((req, _res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS' && req.path.startsWith('/api/')) {
      touchActivity();
    }
    next();
  });

  app.use((req, _res, next) => {
    try {
      if (isPageView(req) && isRealPage(req.path) && isBrowserNavigation(req)) {
        const ua = req.headers['user-agent'] ?? '';
        const selfId = (req as any).session?.otpUserId;
        const skip =
          req.query._noanalytics !== undefined ||
          (typeof selfId === 'string' && adminIds.has(selfId)) ||
          isRepeat(req);
        if (ua && !BOT_RE.test(ua) && !skip) {
          // The database is about to be woken for the insert — piggyback
          // the hourly admin-list refresh on the same wake.
          if (Date.now() - adminIdsAt > ADMIN_REFRESH_MS) {
            adminIdsAt = Date.now(); // claim it first so concurrent requests don't stampede
            void refreshAdminIds();
          }
          // Fire-and-forget: a logging failure must never touch the
          // request, and the request must never wait for the insert.
          void db
            .insert(siteVisits)
            .values({
              path: req.path.slice(0, 200),
              referrerHost: referrerHost(req),
              utmSource: str(req.query.utm_source),
              utmMedium: str(req.query.utm_medium),
              utmCampaign: str(req.query.utm_campaign),
              device: /mobile|iphone|android/i.test(ua) ? 'mobile' : 'desktop',
            })
            .catch((err) => {
              // Most likely cause: table missing on this DB (schema not
              // pushed yet). Log once per boot-ish, don't spam.
              if (!loggedInsertError) {
                loggedInsertError = true;
                console.warn('[VISITS] insert failed (schema pushed?):', err?.message ?? err);
              }
            });
        }
      }
    } catch {
      /* never let analytics break a request */
    }
    next();
  });
}

let loggedInsertError = false;
