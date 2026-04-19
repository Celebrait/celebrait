import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { db } from "../../db";
import { otpCodes, users } from "@shared/models/auth";
import { eq, and, gt } from "drizzle-orm";
import { sendOtpEmail, sendGenerationStartedEmail } from "../../email-service";

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
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

      // Delete any existing unused codes for this email
      await db.delete(otpCodes).where(eq(otpCodes.email, normalizedEmail));

      // Insert new code
      await db.insert(otpCodes).values({
        email: normalizedEmail,
        code,
        expiresAt,
      });

      // Send email
      const emailSent = await sendOtpEmail(normalizedEmail, code);
      if (!emailSent) {
        return res.status(503).json({ message: "Failed to send verification email. Please try again shortly." });
      }

      res.json({ success: true, message: "Verification code sent" });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  // Verify OTP code and create session
  app.post("/api/auth/otp/verify", async (req: any, res) => {
    try {
      const { email, code, firstName, lastName } = req.body;
      if (!email || !code) {
        return res.status(400).json({ message: "Email and code required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const now = new Date();

      // Dev bypass: accept a hardcoded code so local development doesn't
      // need Brevo configured. Guarded by NODE_ENV !== 'production'.
      const isBypassCode = IS_DEV_BYPASS_ENABLED && DEV_OTP_BYPASS_CODES.has(code);

      if (!isBypassCode) {
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
          return res.status(400).json({ message: "Invalid or expired code. Please try again." });
        }

        // Mark OTP as used
        await db.update(otpCodes).set({ used: "true" }).where(eq(otpCodes.id, otp.id));
      } else {
        console.log(`[auth] DEV_BYPASS: accepting code for ${normalizedEmail}`);
      }

      // Upsert user - find by email first
      const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

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
        }).returning();
        user = newUser;
      }

      // Send immediate confirmation email (fire-and-forget)
      sendGenerationStartedEmail(normalizedEmail, user.firstName || null, !existingUser)
        .then(sent => console.log(`[OTP] Confirmation email ${sent ? 'sent' : 'skipped'} to ${normalizedEmail}`))
        .catch(err => console.error('[OTP] Confirmation email error:', err));

      // Establish session
      req.session.otpUserId = user.id;
      req.session.save((err: any) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        res.json({ success: true, user });
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
