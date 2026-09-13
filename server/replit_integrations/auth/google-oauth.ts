// server/replit_integrations/auth/google-oauth.ts
//
// Google OAuth 2.0 flow — Authorization Code with PKCE-less server-side
// secret. Direct fetch to Google's endpoints; no `passport-google-oauth20`
// dependency (it would just be ~50 LOC of indirection over what we do
// here).
//
// Flow:
//   1. GET /api/auth/google
//        → generate `state` (CSRF token), stash in session, redirect to
//          Google's OAuth consent screen with our client_id + redirect_uri.
//   2. User picks an account / consents on accounts.google.com.
//   3. Google redirects to /api/auth/google/callback?code=…&state=…
//   4. We verify state, exchange the code for tokens at oauth2.googleapis.com,
//      fetch userinfo, upsert by email (account merge with OTP-only users
//      who share the same email), establish the OTP session pattern
//      (req.session.otpUserId = user.id) so the rest of the app's
//      auth checks need no changes.
//   5. Redirect to the post-login destination (?redirect=… from step 1, or /studio).
//
// Why this matches the OTP path:
// - Sessions live in PG-backed connect-pg-simple via `setupAuth()`. Both
//   flows just write the same `req.session.otpUserId` so any downstream
//   check (`req.session.otpUserId` in /api/auth/user) works untouched.
// - User upsert by email mirrors the OTP verify upsert, so Google sign-in
//   for an email that already has an OTP-only account silently merges
//   (no duplicate row). Per `next_auth_and_landing.md` decision.
//
// Note on env vars: read at handler time, not module load. Lets the dev
// server boot even when GOOGLE_* aren't set yet (the routes will then
// 503 with a useful error). Cheap defence against typos in .env.

import type { Express, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '@shared/models/auth';
import { sendWelcomeEmail } from '../../email-service';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

// What we ask Google for. `openid email profile` = the standard set —
// gives us the verified email + name + picture without asking for any
// scopes that trigger the "verified app" review process.
const SCOPES = ['openid', 'email', 'profile'].join(' ');

interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Read env at handler invocation, not module load — see header. */
function readGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

/** Allow-list redirect targets to same-origin paths to avoid open-redirect
 *  attacks via the ?redirect= query param. */
function safeRedirectPath(input: unknown): string {
  if (typeof input !== 'string') return '/studio';
  if (input.startsWith('/') && !input.startsWith('//')) return input;
  return '/studio';
}

interface GoogleUserInfo {
  sub: string;        // Google's stable user ID
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export function registerGoogleAuthRoutes(app: Express): void {
  const cfg = readGoogleConfig();
  if (!cfg) {
    console.warn(
      '[google-oauth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI not set — /api/auth/google routes will 503 until configured.',
    );
  } else {
    console.log('[google-oauth] Routes registered. Redirect URI:', cfg.redirectUri);
  }

  // ── Step 0 ─ is this even switched on?
  //
  // The client used to decide whether to render "Continue with Google"
  // from a hardcoded flag, which meant the button and the server config
  // could disagree in both directions — a dead button that 503s, or a
  // working provider nobody can reach. This lets the client ask.
  //
  // Deliberately public and deliberately boring: a boolean saying
  // whether three env vars are present. It leaks nothing an attacker
  // couldn't learn by clicking the button.
  app.get('/api/auth/google/available', (_req: Request, res: Response) => {
    res.json({ available: readGoogleConfig() !== null });
  });

  // ── Step 1 ─ kickoff. Redirect the browser to Google's consent screen.
  app.get('/api/auth/google', (req: Request, res: Response) => {
    const cfg = readGoogleConfig();
    if (!cfg) {
      return res.status(503).json({
        message: 'Google sign-in not configured on this server.',
      });
    }

    // CSRF protection: a per-request nonce that Google echoes back at
    // the callback. Verified before exchanging the code.
    const state = randomBytes(24).toString('hex');
    const finalRedirect = safeRedirectPath((req.query as any).redirect);

    // Stash both pieces in the session — `state` for CSRF, `redirect`
    // so we know where to send the user post-callback.
    (req.session as any).googleOAuthState = state;
    (req.session as any).googleOAuthRedirect = finalRedirect;

    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: 'code',
      scope: SCOPES,
      state,
      // `access_type=offline` would give us a refresh token; we don't
      // need long-lived access (no Calendar/Drive APIs), so skip it.
      // `prompt=select_account` always shows the chooser even if the
      // user is already signed into a single Google account — better UX
      // for a shared device.
      prompt: 'select_account',
    });

    res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  // ── Step 3 ─ callback. Verify state, exchange code, fetch userinfo,
  //              upsert user, establish session, redirect.
  app.get('/api/auth/google/callback', async (req: Request, res: Response) => {
    const cfg = readGoogleConfig();
    if (!cfg) {
      return res.status(503).send('Google sign-in not configured.');
    }

    const { code, state, error } = req.query as Record<string, string>;

    // User cancelled or Google returned an error. Bounce to /login with
    // a hint — the login UI will show a toast.
    if (error) {
      console.warn('[google-oauth] Provider error:', error);
      return res.redirect(`/login?error=${encodeURIComponent(error)}`);
    }
    if (!code || !state) {
      return res.redirect('/login?error=missing_code');
    }

    // CSRF check — must match the state we stashed at kickoff.
    const expectedState = (req.session as any).googleOAuthState;
    if (!expectedState || expectedState !== state) {
      console.warn('[google-oauth] State mismatch — possible CSRF or stale session');
      return res.redirect('/login?error=state_mismatch');
    }
    const finalRedirect = safeRedirectPath((req.session as any).googleOAuthRedirect);

    // Clear single-use values from the session before doing the network
    // round-trip — defence in depth against replay.
    delete (req.session as any).googleOAuthState;
    delete (req.session as any).googleOAuthRedirect;

    try {
      // ── Step 4a ─ exchange code for tokens.
      const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!tokenResp.ok) {
        const body = await tokenResp.text();
        console.error('[google-oauth] Token exchange failed:', tokenResp.status, body);
        return res.redirect('/login?error=token_exchange');
      }
      const tokens = (await tokenResp.json()) as { access_token: string };

      // ── Step 4b ─ fetch userinfo.
      const userinfoResp = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!userinfoResp.ok) {
        console.error('[google-oauth] Userinfo fetch failed:', userinfoResp.status);
        return res.redirect('/login?error=userinfo');
      }
      const info = (await userinfoResp.json()) as GoogleUserInfo;

      if (!info.email) {
        return res.redirect('/login?error=no_email');
      }
      // Defensive: only trust emails Google has verified. Unverified
      // emails would let an attacker register an account claiming any
      // email (Google issues short-lived unverified entries for some
      // legacy flows). Standard hardening.
      if (info.email_verified === false) {
        return res.redirect('/login?error=email_unverified');
      }

      const normalizedEmail = info.email.toLowerCase().trim();

      // ── Step 4c ─ upsert by email. Mirrors OTP verify's pattern so
      //              both auth paths converge on the same `users` row.
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      let user;
      if (existingUser) {
        // Account merge: same email = same user. Only fill in fields
        // Google supplies AND the existing row hasn't already set —
        // never clobber a name the user typed via OTP signup with the
        // Google-provided one (per next_auth_and_landing.md decision).
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (info.given_name && !existingUser.firstName) updates.firstName = info.given_name;
        if (info.family_name && !existingUser.lastName) updates.lastName = info.family_name;
        if (info.picture && !existingUser.profileImageUrl) updates.profileImageUrl = info.picture;

        const [updated] = await db
          .update(users)
          .set(updates)
          .where(eq(users.id, existingUser.id))
          .returning();
        user = updated;
      } else {
        // New user — populate everything Google gave us. Welcome step
        // is skipped for these because firstName is already known.
        const [newUser] = await db
          .insert(users)
          .values({
            email: normalizedEmail,
            firstName: info.given_name || null,
            lastName: info.family_name || null,
            profileImageUrl: info.picture || null,
          })
          .returning();
        user = newUser;
        // Welcome email — once, on Google signup. Fire-and-forget.
        sendWelcomeEmail({ email: normalizedEmail, firstName: info.given_name || null }).catch(
          (err) => console.error('[AUTH] welcome email failed (google):', err),
        );
      }

      // ── Step 4d ─ establish session. Reuse the OTP session key so
      //              every existing auth check (including /api/auth/user)
      //              works without modification.
      (req.session as any).otpUserId = user.id;
      req.session.save((err: any) => {
        if (err) {
          console.error('[google-oauth] Session save error:', err);
          return res.redirect('/login?error=session');
        }
        res.redirect(finalRedirect);
      });
    } catch (err) {
      console.error('[google-oauth] Callback failure:', err);
      res.redirect('/login?error=callback');
    }
  });
}
