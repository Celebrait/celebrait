import type { Express } from "express";
import { randomInt } from "crypto";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { db } from "../../db";
import { otpCodes, users } from "@shared/models/auth";
import { eq, and, gt, ne } from "drizzle-orm";
import { sendOtpEmail, sendWelcomeEmail } from "../../email-service";
import { rateLimitHit, rateLimitClear, clientIp } from "../../simple-rate-limit";

// Local dev bypass: when DEV_AUTH_ACCEPT_ANY_CODE=1, the OTP verify endpoint
// will accept any of these codes without the user needing to receive a real
// email. Lets you log in as any email locally without Brevo configured.
//
// HARD GUARDED: the bypass is refused in production regardless of the env
// var, so you can't accidentally ship it.
const DEV_OTP_BYPASS_CODES = new Set(["000000", "123456"]);
const IS_DEV_BYPASS_ENABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.DEV_AUTH_ACCEPT_ANY_CODE === "1";

function generateOtp(): string {
  // crypto.randomInt — Math.random() is predictable enough to weaken a
  // 6-digit code space (security audit 2026-07-02).
  return randomInt(100000, 1000000).toString();
}

// ── Abuse ceilings (security audit 2026-07-02) ─────────────────────────
// The OTP surface previously had NO limits: unlimited verify guesses
// against a 6-digit code = practical account takeover; unlimited sends =
// inbox-bombing third parties + Brevo cost abuse. Ceilings are generous
// for humans, hostile to scripts.
const SEND_PER_EMAIL_COOLDOWN_MS = 30 * 1000; //   1 send / 30s / email
const SEND_PER_EMAIL_HOURLY = 6; //   6 sends / hour / email
const SEND_PER_IP_HOURLY = 30; //  30 sends / hour / IP
const VERIFY_PER_IP_PER_MIN = 30; //  30 verify attempts / min / IP
const VERIFY_FAILS_PER_CODE = 5; //   5 wrong guesses → code invalidated

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  if (IS_DEV_BYPASS_ENABLED) {
    console.warn(
      "[auth] DEV_AUTH_ACCEPT_ANY_CODE is ON — OTP verify will accept code '000000' or '123456' for any email. DO NOT SHIP.",
    );
  }

  // Get current authenticated user. Single source of truth post-unification:
  // only the OTP session matters. The old passport/Replit OIDC path has
  // been removed.
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      const otpUserId = req.session?.otpUserId;
      if (!otpUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await authStorage.getUser(otpUserId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Send OTP code to email
  app.post("/api/auth/otp/send", async (req: any, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ message: "Valid email required" });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Abuse ceilings — per-email cooldown + hourly cap, and a per-IP
      // cap so one attacker can't spray many emails. 429 with a human
      // message (the client surfaces `message` directly).
      const ip = clientIp(req);
      if (
        rateLimitHit(`otp-send:email-cd:${normalizedEmail}`, 1, SEND_PER_EMAIL_COOLDOWN_MS) ||
        rateLimitHit(`otp-send:email-hr:${normalizedEmail}`, SEND_PER_EMAIL_HOURLY, 60 * 60 * 1000) ||
        rateLimitHit(`otp-send:ip:${ip}`, SEND_PER_IP_HOURLY, 60 * 60 * 1000)
      ) {
        return res.status(429).json({
          message: "Too many code requests — please wait a moment and try again.",
        });
      }

      // Dev bypass: skip Brevo entirely. The verify endpoint accepts a
      // hardcoded code so there's no need to actually generate/persist
      // one. Tell the client so the UI can hint at the code.
      if (IS_DEV_BYPASS_ENABLED) {
        console.log(
          `[auth] DEV_BYPASS: OTP send for ${normalizedEmail} — use code 000000 or 123456`,
        );
        return res.json({
          success: true,
          message: "Dev bypass active. Use code 000000 or 123456.",
          devBypass: true,
        });
      }

      const code = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // ORDER MATTERS (audit 2026-07-27): insert the NEW code first and
      // retire old ones only AFTER the new email actually sends. The old
      // delete-first flow meant an impatient double-request + out-of-order
      // email delivery invalidated the code the user was holding — they'd
      // type the code from the first email and get "Invalid code". Letting
      // codes briefly coexist costs nothing (verify burns all codes for
      // the email after 5 wrong guesses).
      const [inserted] = await db
        .insert(otpCodes)
        .values({
          email: normalizedEmail,
          code,
          expiresAt,
        })
        .returning({ id: otpCodes.id });

      const emailSent = await sendOtpEmail(normalizedEmail, code);
      if (!emailSent) {
        // The new code never reached an inbox. It used to be DELETED
        // here, which kept the table tidy but erased the evidence — the
        // people hurt most by a deliverability problem left no trace at
        // all. Mark it instead: 'send_failed' is not 'false', so verify
        // (which matches used = 'false') still refuses it, and older
        // delivered codes stay valid because the retire-old step below
        // only runs on success. Same behaviour, now countable — see
        // /api/admin/signup-dropoffs.
        await db
          .update(otpCodes)
          .set({ used: "send_failed" })
          .where(eq(otpCodes.id, inserted.id))
          .catch(() => {});
        return res.status(503).json({ message: "Failed to send verification email. Please try again shortly." });
      }

      // New code is in flight — retire the older ones now.
      await db
        .delete(otpCodes)
        .where(and(eq(otpCodes.email, normalizedEmail), ne(otpCodes.id, inserted.id)));

      res.json({ success: true, message: "Verification code sent" });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  // Verify OTP code and create session
  app.post("/api/auth/otp/verify", async (req: any, res) => {
    try {
      const { email, code, firstName, lastName, attribution } = req.body;
      if (!email || !code) {
        return res.status(400).json({ message: "Email and code required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const now = new Date();

      // Per-IP throttle — a 6-digit code must not be brute-forceable.
      const ip = clientIp(req);
      if (rateLimitHit(`otp-verify:ip:${ip}`, VERIFY_PER_IP_PER_MIN, 60 * 1000)) {
        return res.status(429).json({
          message: "Too many attempts — please wait a minute and try again.",
        });
      }

      // Dev bypass: accept a hardcoded code so local development doesn't
      // need Brevo configured. Guarded by NODE_ENV !== 'production'.
      const isBypassCode = IS_DEV_BYPASS_ENABLED && DEV_OTP_BYPASS_CODES.has(code);

      if (!isBypassCode) {
        // Wrong-guess lockout: after N failed guesses for this email,
        // burn any outstanding codes — the attacker must trigger a fresh
        // send (itself rate-limited) and start over. Counter lives in
        // memory (10-min window matches the code lifetime) and the codes
        // are deleted at the threshold, so a process restart clearing the
        // counter doesn't resurrect a half-guessed code.
        const failKey = `otp-verify:fails:${normalizedEmail}`;

        // Find valid, unused OTP
        const [otp] = await db
          .select()
          .from(otpCodes)
          .where(
            and(
              eq(otpCodes.email, normalizedEmail),
              eq(otpCodes.code, code),
              eq(otpCodes.used, "false"),
              gt(otpCodes.expiresAt, now)
            )
          )
          .limit(1);

        if (!otp) {
          if (rateLimitHit(failKey, VERIFY_FAILS_PER_CODE, 10 * 60 * 1000)) {
            await db.delete(otpCodes).where(eq(otpCodes.email, normalizedEmail));
            return res.status(429).json({
              message: "Too many incorrect codes — request a new one to continue.",
            });
          }
          return res.status(400).json({ message: "Invalid or expired code. Please try again." });
        }

        // Mark OTP as used + reset the failure counter
        await db.update(otpCodes).set({ used: "true" }).where(eq(otpCodes.id, otp.id));
        rateLimitClear(failKey);
      } else {
        console.log(`[auth] DEV_BYPASS: accepting code for ${normalizedEmail}`);
      }

      // Upsert user - find by email first.
      // `isNewUser` flag (added 2026-04-28 for PR1 Phase C) tells the
      // client whether to show the welcome capture step (name + portrait)
      // after this verify completes. True only on the first-ever sign-in
      // for this email — returning users skip the step regardless of
      // whether their firstName is populated.
      const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
      const isNewUser = !existingUser;

      let user;
      if (existingUser) {
        // Update name if provided and not already set
        const updates: any = { updatedAt: new Date() };
        if (firstName && !existingUser.firstName) updates.firstName = firstName;
        if (lastName && !existingUser.lastName) updates.lastName = lastName;
        const [updated] = await db.update(users).set(updates).where(eq(users.id, existingUser.id)).returning();
        user = updated;
      } else {
        // Create new user
        const [newUser] = await db.insert(users).values({
          email: normalizedEmail,
          firstName: firstName || null,
          lastName: lastName || null,
          // First-touch attribution from the client (see
          // client/src/lib/attribution.ts). Stored ONCE, at creation —
          // shape-checked loosely; it's analytics, not trust.
          attribution:
            attribution && typeof attribution === 'object' && !Array.isArray(attribution)
              ? attribution
              : null,
        }).returning();
        user = newUser;
        // Welcome email — once, on account creation. Fire-and-forget so it
        // never blocks or fails sign-in.
        sendWelcomeEmail({ email: normalizedEmail, firstName: firstName || null }).catch((err) =>
          console.error("[AUTH] welcome email failed:", err),
        );
      }

      // Establish session. Regenerate first so the pre-auth session ID is
      // discarded — otherwise a session ID planted before login (shared
      // device, injected cookie) would become an authenticated session
      // (session fixation; security audit 2026-07-02).
      req.session.regenerate((regenErr: any) => {
        if (regenErr) {
          console.error("Session regenerate error:", regenErr);
          return res.status(500).json({ message: "Session error" });
        }
        req.session.otpUserId = user.id;
        req.session.save((err: any) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ message: "Session error" });
          }
          res.json({ success: true, user, isNewUser });
        });
      });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // Logout for OTP sessions (clears session without OIDC redirect)
  app.post("/api/auth/otp/logout", (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) console.error("Session destroy error:", err);
      res.json({ success: true });
    });
  });
}
