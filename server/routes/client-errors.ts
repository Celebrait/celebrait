// server/routes/client-errors.ts
//
// Client crash reporting — the missing half of the error boundary.
//
// WHY: customers were hitting "Something went wrong" (the React error
// boundary) on prod, repeatedly, and we had NOTHING — the error and
// component stack went to the customer's own console and died there
// (Kevin 2026-07-31: "I've seen it a few times tbh, what is it?" was
// unanswerable). The boundary now POSTs here; we write it to stderr so
// it lands in the Render logs Kevin already reads, prefixed
// [CLIENT_ERROR] so it's grep-able.
//
// Deliberately NOT a DB table yet: logs are enough to diagnose, and a
// table invites building a dashboard before we know we need one.
//
// Unauthenticated BY DESIGN — crashes happen to logged-out users too —
// which is why the guards below are strict:
//   · in-memory per-IP rate limit (a crash loop or a hostile client
//     can't flood the logs)
//   · every field truncated server-side (client-supplied lengths are
//     not trusted)
//   · nothing echoed back; fixed 204 regardless.

import type { Express, Request, Response } from 'express';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, { count: number; windowStart: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  h.count += 1;
  return h.count > MAX_PER_WINDOW;
}

// Bounded cleanup so the map can't grow forever on a long-lived process.
setInterval(() => {
  const now = Date.now();
  hits.forEach((h, ip) => {
    if (now - h.windowStart > WINDOW_MS * 5) hits.delete(ip);
  });
}, WINDOW_MS).unref();

const trunc = (v: unknown, n: number): string => String(v ?? '').slice(0, n);

export function registerClientErrorRoutes(app: Express): void {
  app.post('/api/client-error', (req: Request, res: Response) => {
    try {
      const ip = String(req.ip ?? 'unknown');
      if (!rateLimited(ip)) {
        const b = req.body ?? {};
        console.error(
          '[CLIENT_ERROR]',
          JSON.stringify({
            at: new Date().toISOString(),
            path: trunc(b.path, 200),
            label: trunc(b.label, 60),
            message: trunc(b.message, 500),
            stack: trunc(b.stack, 2000),
            componentStack: trunc(b.componentStack, 2000),
            userAgent: trunc(req.headers['user-agent'], 300),
          }),
        );
      }
    } catch {
      /* reporting must never throw */
    }
    res.status(204).end();
  });
}
