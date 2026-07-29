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

import type { Express, Request } from 'express';
import { db } from './db';
import { siteVisits } from '@shared/schema';

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

function referrerHost(req: Request): string | null {
  const ref = req.headers.referer;
  if (!ref) return null;
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    // Self-referrals (SPA navigations, internal links) aren't a source.
    if (host.endsWith('celebrait.co.uk') || host === 'localhost') return null;
    return host.slice(0, 100);
  } catch {
    return null;
  }
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, 100) : null;

export function registerVisitLogging(app: Express): void {
  app.use((req, _res, next) => {
    try {
      if (isPageView(req)) {
        const ua = req.headers['user-agent'] ?? '';
        if (ua && !BOT_RE.test(ua)) {
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
