import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { db } from "../../db";
import { otpCodes, users } from "@shared/models/auth";
import { eq, and, gt } from "drizzle-orm";
import { sendOtpEmail } from "../../email-service";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user - supports both Replit Auth and OTP sessions
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      // OTP session: user stored directly on session
      if (req.session?.otpUserId) {
        const user = await authStorage.getUser(req.session.otpUserId);
        if (user) return res.json(user);
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Replit Auth: user stored via passport
      if (!req.isAuthenticated || !req.isAuthenticated() || !req.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
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
      await sendOtpEmail(normalizedEmail, code);

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
