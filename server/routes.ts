import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, registerGoogleAuthRoutes } from "./replit_integrations/auth";
import {
  getStorageStats,
  cleanupOldImages,
  scheduleAutomaticCleanup,
  type CleanupConfig
} from "./image-storage";

// Route modules — Studio + Prompt Lab + admin only. Old MVP modules
// (ai, payment, generation, fulfillment, images) deleted 2026-04-26
// as part of pre-launch cleanup. Studio uses studio-* modules; image
// serving is the /images static handler below; PDF generation lives
// in utils/shared.processSupplierOrder for when print fulfilment is
// wired up post-launch.
import { registerPromptRoutes } from "./routes/prompts";
import { registerPhotoRoutes } from "./routes/photos";
import { registerStudioDraftRoutes } from "./routes/studio-drafts";
import { registerStudioBrainstormRoutes } from "./routes/studio-brainstorm";
import { registerStudioChatRoutes } from "./routes/studio-chat";
import { registerStudioSceneSuggestRoutes } from "./routes/studio-scene-suggest";
import { registerStudioCheckoutRoutes } from "./routes/studio-checkout";
import { registerStudioNotificationRoutes } from "./routes/studio-notifications";
// Inside-text AI routes (rewriter + macro composer) — PARKED for
// Celebrait Premium tier (decision 2026-05-17, see
// next_celebrait_premium.md). File kept in repo for future revival.
// import { registerStudioInsideTextRoutes } from "./routes/studio-inside-text";
import { registerAdminCostsRoutes } from "./routes/admin-costs";
import { registerAdminTestEmailRoutes } from "./routes/admin-test-emails";
import { registerAddressBookRoutes } from "./routes/address-book";
import { registerRemindersRoutes } from "./routes/reminders";
import { registerDevTestFailureRoutes } from "./routes/dev-test-failures";
import { scheduleReminderDispatch } from "./reminders/dispatcher";
import { scheduleDropOffRecoveryDispatch, runDropOffRecoveryDispatch } from "./recovery/dispatcher";

export async function registerRoutes(app: Express): Promise<Server> {

  // Setup auth BEFORE other routes.
  // Since 2026-04, the only auth system is the email OTP flow. setupAuth
  // now just mounts PG-backed session middleware; registerAuthRoutes wires
  // up /api/auth/otp/send, /verify, /logout and /api/auth/user.
  await setupAuth(app);
  registerAuthRoutes(app);
  registerGoogleAuthRoutes(app);

  // Import isAuthenticated middleware for user-specific routes
  const { isAuthenticated } = await import("./replit_integrations/auth/replitAuth");

  // --- Authenticated user routes ---

  app.get("/api/user/cards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.otpUserId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      // Use the lightweight grid projection — see storage.getUserCardsForGrid
      // for why (Neon 64MB response cap + legacy base64 columns).
      const cards = await storage.getUserCardsForGrid(String(userId));
      res.json(cards);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching user cards: " + error.message });
    }
  });

  app.get("/api/user/orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.otpUserId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const orders = await storage.getUserOrders(String(userId));
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching user orders: " + error.message });
    }
  });

  // PATCH /api/user/profile — update the signed-in user's firstName +
  // optional portrait photo. Powers Phase C of PR1 (the welcome capture
  // step on first signup) and the future Settings → Profile editor.
  // Both fields are individually optional in the body — send only what
  // you want to change. Returns the updated user row.
  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.otpUserId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { firstName, lastName, portraitPhotoId } = req.body ?? {};
      const updates: Record<string, any> = { updatedAt: new Date() };

      // firstName: trim + reject empty strings; null clears the field
      if (firstName !== undefined) {
        if (firstName === null) {
          updates.firstName = null;
        } else if (typeof firstName === 'string') {
          const trimmed = firstName.trim();
          if (!trimmed) {
            return res.status(400).json({ message: "First name cannot be empty. Send null to clear." });
          }
          if (trimmed.length > 60) {
            return res.status(400).json({ message: "First name too long (max 60 chars)." });
          }
          updates.firstName = trimmed;
        } else {
          return res.status(400).json({ message: "firstName must be a string or null." });
        }
      }

      if (lastName !== undefined) {
        if (lastName === null) {
          updates.lastName = null;
        } else if (typeof lastName === 'string') {
          updates.lastName = lastName.trim() || null;
        }
      }

      // portraitPhotoId: integer FK to photos.id. Validate ownership
      // — user can only attach their own photos as a portrait, never
      // someone else's. Null clears the portrait.
      if (portraitPhotoId !== undefined) {
        if (portraitPhotoId === null) {
          updates.portraitPhotoId = null;
        } else if (typeof portraitPhotoId === 'number' && Number.isInteger(portraitPhotoId)) {
          const { db } = await import('./db');
          const { photos } = await import('@shared/schema');
          const { and, eq } = await import('drizzle-orm');
          const owned = await db
            .select({ id: photos.id })
            .from(photos)
            .where(and(eq(photos.id, portraitPhotoId), eq(photos.userId, String(userId))))
            .limit(1);
          if (owned.length === 0) {
            return res.status(403).json({ message: "Cannot attach a photo you don't own as a portrait." });
          }
          updates.portraitPhotoId = portraitPhotoId;
        } else {
          return res.status(400).json({ message: "portraitPhotoId must be an integer or null." });
        }
      }

      if (Object.keys(updates).length === 1) {
        // Only updatedAt would be set — caller sent nothing useful.
        return res.status(400).json({ message: "No profile fields provided." });
      }

      const { db } = await import('./db');
      const { users } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, String(userId)))
        .returning();
      res.json({ success: true, user: updated });
    } catch (error: any) {
      console.error("[USER_PROFILE] update error:", error);
      res.status(500).json({ message: "Error updating profile: " + error.message });
    }
  });

  // --- Static image serving ---

  app.use('/images', (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    next();
  }, (req, res) => {
    // `root` (not a pre-joined absolute path) is what makes sendFile
    // reject `..` traversal — path.join collapses encoded dot-segments,
    // which previously let /images/%2e%2e/.env read ANY server file
    // (security audit 2026-07-02).
    res.sendFile(req.path, { root: path.join(process.cwd(), 'stored_images') }, (err) => {
      if (err && !res.headersSent) {
        res.status(404).send('Image not found');
      }
    });
  });

  // Start automatic image cleanup scheduler (runs daily)
  const cleanupConfig: CleanupConfig = {
    retentionDays: 90,
    preservePaidCards: true,
    preserveRecentOrders: true,
    dryRun: false
  };

  scheduleAutomaticCleanup(cleanupConfig);
  console.log(`[CLEANUP] Automatic cleanup scheduled: ${cleanupConfig.retentionDays} day retention, preserve paid cards: ${cleanupConfig.preservePaidCards}`);

  // --- Admin routes ---

  // Admin gate for the two storage routes below. Same DB-backed isAdmin
  // check the other admin modules use — these two were the ONLY
  // /api/admin/* routes with no auth at all, letting anyone on the
  // internet trigger a destructive image cleanup (security audit
  // 2026-07-02).
  const requireStorageAdmin = async (req: any, res: any): Promise<boolean> => {
    try {
      const userId = req.session?.otpUserId;
      if (!userId) {
        res.status(401).json({ message: "Not authenticated" });
        return false;
      }
      const { db } = await import('./db');
      const { users } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const [row] = await db
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, String(userId)))
        .limit(1);
      if (row?.isAdmin !== true) {
        res.status(403).json({ message: "Admin access required" });
        return false;
      }
      return true;
    } catch (err) {
      console.error("[ADMIN] storage admin check failed:", err);
      res.status(500).json({ message: "Auth check failed" });
      return false;
    }
  };

  app.get("/api/admin/storage/stats", async (req, res) => {
    if (!(await requireStorageAdmin(req, res))) return;
    try {
      const stats = await getStorageStats();
      res.json({
        ...stats,
        totalSizeMB: (stats.totalSize / 1024 / 1024).toFixed(2),
        avgFileSizeMB: (stats.avgFileSize / 1024 / 1024).toFixed(2)
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error getting storage stats: " + error.message });
    }
  });

  app.post("/api/admin/storage/cleanup", async (req, res) => {
    if (!(await requireStorageAdmin(req, res))) return;
    try {
      const config: CleanupConfig = {
        retentionDays: req.body.retentionDays || 90,
        preservePaidCards: req.body.preservePaidCards !== false,
        preserveRecentOrders: req.body.preserveRecentOrders !== false,
        dryRun: req.body.dryRun === true
      };

      console.log(`[CLEANUP] Manual cleanup triggered:`, config);
      const results = await cleanupOldImages(config);

      res.json({
        success: true,
        results,
        config,
        message: `${config.dryRun ? 'Simulation: Would delete' : 'Deleted'} ${results.deleted} files, freed ${(results.size / 1024 / 1024).toFixed(2)}MB`
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error running cleanup: " + error.message });
    }
  });

  // --- Register domain route modules ---

  registerPromptRoutes(app);
  registerPhotoRoutes(app);
  registerStudioDraftRoutes(app);
  registerStudioBrainstormRoutes(app);
  registerStudioChatRoutes(app);
  registerStudioSceneSuggestRoutes(app);
  registerStudioCheckoutRoutes(app);
  registerStudioNotificationRoutes(app);
  // registerStudioInsideTextRoutes(app); // PARKED for Premium tier — see next_celebrait_premium.md
  registerAdminCostsRoutes(app);
  registerAdminTestEmailRoutes(app);
  registerAddressBookRoutes(app);
  registerRemindersRoutes(app);
  registerDevTestFailureRoutes(app);

  // Schedule the daily reminder dispatch cron (8am UTC daily).
  // First run fires at the next 8am UTC; subsequent runs 24h later.
  // See server/reminders/dispatcher.ts for the dispatch logic.
  scheduleReminderDispatch();

  // Schedule the daily drop-off recovery dispatch cron (9am UTC).
  // 1h offset from reminders avoids competing Brevo send-volume bursts.
  // See server/recovery/dispatcher.ts for the dispatch logic.
  scheduleDropOffRecoveryDispatch();

  // Admin manual trigger for drop-off recovery — same shape as the
  // reminders admin endpoint (dryRun + asOfDate query params for
  // testing). Auth gate same as other admin endpoints.
  app.post('/api/admin/recovery/dispatch', async (req, res) => {
    try {
      const otpUserId = (req as any).session?.otpUserId;
      if (typeof otpUserId !== 'string' || otpUserId.length === 0) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const { db: dbInst } = await import('./db');
      const { users: usersTbl } = await import('@shared/schema');
      const { eq: eqOp } = await import('drizzle-orm');
      const adminCheck = await dbInst
        .select({ isAdmin: usersTbl.isAdmin })
        .from(usersTbl)
        .where(eqOp(usersTbl.id, otpUserId))
        .limit(1);
      if (adminCheck[0]?.isAdmin !== true) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const dryRun = req.body?.dryRun === true;
      const asOfDateStr = typeof req.body?.asOfDate === 'string' ? req.body.asOfDate : null;
      const asOfDate = asOfDateStr ? new Date(asOfDateStr + 'T00:00:00Z') : undefined;

      const result = await runDropOffRecoveryDispatch({ dryRun, asOfDate });
      res.json(result);
    } catch (err: any) {
      console.error('[DROPOFF] manual dispatch failed:', err);
      res.status(500).json({ message: err?.message ?? 'Dispatch failed' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
