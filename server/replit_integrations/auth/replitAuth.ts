import "dotenv/config";

import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

/**
 * If you are NOT running on Replit, you probably don't have these env vars.
 * We'll fall back to a simple dev-auth mode so the app can boot locally.
 */
const HAS_REPLIT_OIDC =
  !!process.env.REPL_ID &&
  process.env.REPL_ID.trim().length > 0 &&
  !!process.env.SESSION_SECRET &&
  process.env.SESSION_SECRET.trim().length > 0;

const DEV_AUTH = !HAS_REPLIT_OIDC && process.env.NODE_ENV !== "production";

const getOidcConfig = memoize(
  async () => {
    // Only used when HAS_REPLIT_OIDC is true
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week

  // In dev (non-Replit), use a memory session store so we don't require the PG sessions table.
  if (DEV_AUTH) {
    return session({
      secret: process.env.SESSION_SECRET || "dev-session-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false, // localhost
        maxAge: sessionTtl,
      },
    });
  }

  // Replit / production path: store sessions in Postgres
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // ===== DEV AUTH MODE (local) =====
  if (DEV_AUTH) {
    console.warn("[auth] Replit OIDC not configured; running in DEV_AUTH mode.");

    passport.serializeUser((user: Express.User, cb) => cb(null, user));
    passport.deserializeUser((user: Express.User, cb) => cb(null, user));

    // Simple login endpoint that "logs in" a dummy user
    app.get("/api/login", (req, res) => {
      const user = {
        claims: {
          sub: "dev-user",
          email: "dev@localhost",
          first_name: "Dev",
          last_name: "User",
          profile_image_url: "",
          exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        },
        access_token: "dev-access-token",
        refresh_token: "dev-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };

      // Passport session login
      req.login(user as any, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        return res.redirect("/");
      });
    });

    // Callback is irrelevant in dev; keep route so frontend doesn't break
    app.get("/api/callback", (_req, res) => res.redirect("/"));

    app.get("/api/logout", (req, res) => {
      req.logout(() => res.redirect("/"));
    });

    return;
  }

  // ===== REPLIT OIDC MODE =====
  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // DEV mode: let everything through (or require /api/login once)
  if (DEV_AUTH) return next();

  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) return next();

  const refreshToken = user.refresh_token;
  if (!refreshToken) return res.status(401).json({ message: "Unauthorized" });

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};