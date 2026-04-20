import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import fs, { promises as fsPromises } from "fs";
import path from "path";
import { storage } from "./storage";
import { insertCardSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { addToMarketingList } from './email-service';
import {
  getStorageStats,
  cleanupOldImages,
  scheduleAutomaticCleanup,
  type CleanupConfig
} from "./image-storage";
import { processSupplierOrder } from "./utils/shared";

// Route modules
import { registerAiRoutes } from "./routes/ai";
import { registerImagesRoutes } from "./routes/images";
import { registerGenerationRoutes } from "./routes/generation";
import { registerPaymentRoutes } from "./routes/payment";
import { registerFulfillmentRoutes } from "./routes/fulfillment";
import { registerPromptRoutes } from "./routes/prompts";
import { registerPhotoRoutes } from "./routes/photos";
import { registerStudioDraftRoutes } from "./routes/studio-drafts";
import { registerStudioBrainstormRoutes } from "./routes/studio-brainstorm";
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

  // --- Core routes ---

  app.post("/api/prospects", async (req, res) => {
    try {
      const { email, firstName, lastName, signupSource, cardData } = req.body;

      console.log('Creating prospect for marketing automation:', email);

      if (!email || !firstName) {
        return res.status(400).json({ message: "Email and first name are required" });
      }

      const metadata = {
        recipientName: cardData?.recipientName || 'loved one',
        celebrationType: cardData?.celebrationType || 'celebration',
        signupSource: signupSource || 'signup_form'
      };

      const brevoContactId = await addToMarketingList(email, firstName, lastName, metadata);

      if (brevoContactId) {
        console.log('✅ Marketing automation: Prospect added to Brevo list:', brevoContactId);
        res.json({
          success: true,
          message: "Successfully added to marketing list",
          brevoContactId
        });
      } else {
        console.log('❌ Marketing automation: Failed to add to Brevo list');
        res.status(500).json({
          success: false,
          message: "Failed to add to marketing list"
        });
      }
    } catch (error: any) {
      console.error('Prospect creation error:', error);
      res.status(500).json({ message: "Error creating prospect: " + error.message });
    }
  });

  app.post("/api/cards", async (req, res) => {
    try {
      const { userId, ...cardData } = req.body;

      console.log('Card creation request body:', req.body);

      if (!userId) {
        return res.status(401).json({ message: "Please sign in to create a card" });
      }

      const sanitizedCardData = {
        cardType: cardData.cardType || 'printed',
        printOption: cardData.printOption || 'front-only',
        sceneType: cardData.sceneType || 'with-person',
        conversationData: cardData.conversationData || {},
        price: cardData.price || 12900
      };

      const validatedCardData = insertCardSchema.parse(sanitizedCardData);

      const card = await storage.createCard({
        ...validatedCardData,
        userId: String(userId)
      });

      res.json(card);
    } catch (error: any) {
      console.error('Card creation error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // --- PDF download routes ---

  app.get("/api/download-pdf/:cardId/:side/:format/:dpi", async (req, res) => {
    try {
      const { cardId, side, format, dpi } = req.params;

      if (!['front', 'inside'].includes(side)) {
        return res.status(400).json({ message: "Invalid side. Must be 'front' or 'inside'" });
      }

      if (!['5x5', 'A4', 'Letter'].includes(format)) {
        return res.status(400).json({ message: "Invalid format. Must be '5x5', 'A4', or 'Letter'" });
      }

      if (!['150', '300', '600'].includes(dpi)) {
        return res.status(400).json({ message: "Invalid DPI. Must be 150, 300, or 600" });
      }

      const filename = `card_${cardId}_${side}_${format}_${dpi}dpi.pdf`;
      const filepath = path.join(process.cwd(), 'print_files', filename);

      try {
        await fsPromises.access(filepath);
      } catch (error) {
        return res.status(404).json({ message: "PDF not found. Generate PDFs first by completing payment." });
      }

      const stats = await fsPromises.stat(filepath);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache'
      });

      const readStream = fs.createReadStream(filepath);
      readStream.pipe(res);

      console.log(`[PDF-DOWNLOAD] Served ${filename} (${stats.size} bytes)`);

    } catch (error: any) {
      console.error('PDF download error:', error);
      res.status(500).json({ message: "Error downloading PDF: " + error.message });
    }
  });

  app.get("/api/download-pdf/:cardId/specs", async (req, res) => {
    try {
      const { cardId } = req.params;

      const filename = `card_${cardId}_print_specs.json`;
      const filepath = path.join(process.cwd(), 'print_files', filename);

      try {
        await fsPromises.access(filepath);
      } catch (error) {
        return res.status(404).json({ message: "Print specs not found" });
      }

      const specsData = await fsPromises.readFile(filepath, 'utf8');
      const specs = JSON.parse(specsData);

      res.json(specs);

    } catch (error: any) {
      console.error('Print specs download error:', error);
      res.status(500).json({ message: "Error downloading print specs: " + error.message });
    }
  });

  // --- Test endpoint: Background supplier processing ---

  app.post("/api/test-background-supplier-processing", async (req, res) => {
    try {
      console.log('🧪 Testing background supplier processing workflow...');

      const order = await storage.getOrder(98);
      if (!order) {
        return res.status(404).json({ error: 'Test order not found - use order ID 98' });
      }

      const card = await storage.getCard(order.cardId);
      if (!card) {
        return res.status(404).json({ error: 'Card not found for order' });
      }

      console.log(`📋 Testing background processing with order #${order.id}, card #${card.id}`);

      processSupplierOrder(order.id, card.id).catch(err => {
        console.error('Background processing test failed:', err);
      });

      res.json({
        success: true,
        message: 'Background supplier processing triggered successfully',
        details: {
          orderId: order.id,
          cardId: card.id,
          customerName: order.customerName,
          note: 'Check logs for [SUPPLIER_PROCESSING] messages to track progress (1-2 minutes)'
        }
      });

    } catch (error: any) {
      console.error('❌ Test background supplier processing failed:', error);
      res.status(500).json({ error: 'Failed to trigger test: ' + error.message });
    }
  });

  // --- Register domain route modules ---

  registerAiRoutes(app);
  registerImagesRoutes(app);
  registerGenerationRoutes(app);
  registerPaymentRoutes(app);
  registerFulfillmentRoutes(app);
  registerPromptRoutes(app);
  registerPhotoRoutes(app);
  registerStudioDraftRoutes(app);
  registerStudioBrainstormRoutes(app);
  registerAdminCostsRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
