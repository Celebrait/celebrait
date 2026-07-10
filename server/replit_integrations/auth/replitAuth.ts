// server/replit_integrations/auth/replitAuth.ts
//
// (Name kept for backwards compatibility with existing imports; the module
// no longer has anything to do with Replit Auth.)
//
// Since 2026-04, Celebrait uses a SINGLE auth system: email OTP.
// See `./routes.ts` for the OTP endpoints themselves. This file owns:
//   - Session middleware setup (PG-backed, same in dev and prod)
//   - The `isAuthenticated` middleware used to protect user-scoped routes
//
// Previously this file hosted a Replit OIDC / passport stack and a
// DEV_AUTH memory-session shortcut that created a fake `dev@localhost`
// user. Both have been removed. Local dev now uses the real OTP flow with
// the PG sessions table — and to avoid needing Brevo locally, the OTP
// verify endpoint accepts a hardcoded bypass code (see `./routes.ts`).

import "dotenv/config";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";

// ─── Session middleware ──────────────────────────────────────────────────────

export function getSession() {
  // 30 days + rolling (below): greeting cards are an OCCASIONAL buy, so a
  // 1-week fixed window meant returning users re-OTP'd constantly. Rolling
  // extends the window on every visit, so anyone active within 30 days
  // stays signed in and only genuinely-lapsed users re-auth (Kevin
  // 2026-07-09). Passwordless stays low-friction for return visits.
  const sessionTtl = 30 * 24 * 60 * 60 * 1000; // 30 days
  const isProd = process.env.NODE_ENV === "production";

  // Session store strategy:
  //   • PROD → PG-backed (sessions survive deploys, multi-instance ready)
  //   • DEV  → in-memory (express-session default)
  //
  // The PG store costs a Neon round-trip on every authenticated request
  // (200–400ms over the serverless WebSocket). In prod that's the price
  // of a real auth system; in dev it was adding 5–10s to every Studio
  // page load. The previous "same in both envs" comment listed
  // "sessions survive restarts" as the benefit — but `tsx watch` only
  // restarts on server-file saves, and the OTP bypass code in
  // ./routes.ts makes re-login a 2-second paste. Not worth the tax.
  //
  // Trade-off accepted: editing server code in dev → log back in once.
  // We get instant API responses everywhere else in return.
  let sessionStore: session.Store | undefined;
  if (isProd) {
    const pgStore = connectPg(session);
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      // The `sessions` table is in shared/models/auth.ts and is created via
      // db:push. Don't let connect-pg-simple auto-create a competing copy.
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  }
  // dev: leave `store` undefined → express-session uses MemoryStore.
  // It logs a warning on boot ("MemoryStore is not designed for a
  // production environment") — that's the intended signal in dev and
  // would be a red flag if it ever shows up in prod logs.

  return session({
    secret: process.env.SESSION_SECRET || "celebrait-dev-session-secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    // Re-issue the cookie (reset maxAge) on each response so an active
    // user's 30-day window keeps sliding forward — they stay signed in.
    rolling: true,
    cookie: {
      httpOnly: true,
      // Secure cookies require HTTPS — fine in prod, breaks on localhost.
      secure: isProd,
      maxAge: sessionTtl,
      sameSite: "lax",
    },
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────

export async function setupAuth(app: Express): Promise<void> {
  app.set("trust proxy", 1);
  app.use(getSession());
}

// ─── Middleware: require OTP session ─────────────────────────────────────────

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const otpUserId = (req as any).session?.otpUserId;
  if (typeof otpUserId === "string" && otpUserId.length > 0) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
