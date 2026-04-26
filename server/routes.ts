import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
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
import { registerStudioSceneSuggestRoutes } from "./routes/studio-scene-suggest";
import { registerStudioCheckoutRoutes } from "./routes/studio-checkout";
import { registerAdminCostsRoutes } from "./routes/admin-costs";

export async function registerRoutes(app: Express): Promise<Server> {

  // Setup auth BEFORE other routes.
  // Since 2026-04, the only auth system is the email OTP flow. setupAuth
  // now just mounts PG-backed session middleware; registerAuthRoutes wires
  // up /api/auth/otp/send, /verify, /logout and /api/auth/user.
  await setupAuth(app);
  registerAuthRoutes(app);

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

  // --- Static image serving ---

  app.use('/images', (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    next();
  }, (req, res) => {
    const imagePath = path.join(process.cwd(), 'stored_images', req.path);
    res.sendFile(imagePath, (err) => {
      if (err) {
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

  app.get("/api/admin/storage/stats", async (req, res) => {
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
  registerStudioSceneSuggestRoutes(app);
  registerStudioCheckoutRoutes(app);
  registerAdminCostsRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
