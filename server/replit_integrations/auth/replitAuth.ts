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
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const isProd = process.env.NODE_ENV === "production";

  // Use the PG-backed store in BOTH dev and prod. This means dev sessions
  // survive server restarts (no more re-logging-in after every `npm run
  // dev`) and there's one less axis of prod-vs-dev divergence.
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    // The `sessions` table is in shared/models/auth.ts and is created via
    // db:push. Don't let connect-pg-simple auto-create a competing copy.
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET || "celebrait-dev-session-secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
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
