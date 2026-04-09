import type { Express } from "express";
import fs, { promises as fsPromises } from "fs";
import path from "path";
import sharp from "sharp";
import { storage } from "../storage";
import { getStoredImage } from "../image-storage";
import { migrateCardImages, cardNeedsMigration } from "../image-migration";
import {
  imageCache,
  cardMetadataCache,
  emailLinkCache,
  CACHE_TTL,
  METADATA_CACHE_TTL
} from "../utils/shared";

export function registerImagesRoutes(app: Express): void {
  app.get("/api/cards/:id/fast-metadata", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const cacheKey = `fast-metadata-${cardId}`;
      
      // ULTRA-AGGRESSIVE CACHING: Extended TTL for instant response
      const cached = cardMetadataCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < (METADATA_CACHE_TTL * 24)) {
        console.log(`[INSTANT] Fast metadata from extended cache for card ${cardId}`);
        res.set({
          'Cache-Control': 'public, max-age=86400, immutable',
          'ETag': `"fast-${cardId}-v2"`,
          'X-Cache': 'HIT'
        });
        return res.json(cached.data);
      }
      
      console.log(`[PERF] Cache miss - database query for fast metadata: ${cardId}`);
      const dbStartTime = Date.now();
      
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      console.log(`[PERF] Fast metadata database query took: ${Date.now() - dbStartTime}ms`);
      
      // Metadata for instant loading — include image URL flags so card preview can show inside tab
      const fastMetadata = {
        id: card.id,
        cardType: card.cardType,
        status: card.status,
        price: card.price,
        frontImageUrl: card.frontImageUrl ? `/api/cards/${cardId}/fast-front-image` : null,
        insideImageUrl: card.insideImageUrl ? `/api/cards/${cardId}/fast-inside-image` : null,
        conversationData: card.conversationData || {}
      };
      
      // ULTRA-AGGRESSIVE CACHING: Extended memory cache and longer browser cache  
      cardMetadataCache.set(cacheKey, {
        data: fastMetadata,
        timestamp: Date.now()
      });
      
      // Also cache with alternative key patterns for broader cache hits
      cardMetadataCache.set(`card-${cardId}`, {
        data: card, // Full card data for complete-order page
        timestamp: Date.now()
      });
      
      // Use ETag-based validation so browsers always re-check when card data changes
      res.set({
        'Cache-Control': 'no-cache',
        'ETag': `"fast-${cardId}-v5"`,
        'X-Cache': 'MISS',
        'X-Performance': `db-${Date.now() - dbStartTime}ms`
      });
      
      res.json(fastMetadata);
    } catch (error) {
      console.error("[PERF] Fast metadata error:", error);
      res.status(500).json({ message: "Error fetching fast metadata" });
    }
  });


  app.get("/api/cards/:id/status", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      if (isNaN(cardId)) return res.status(400).json({ message: "Invalid card ID" });
      const card = await storage.getCard(cardId);
      if (!card) return res.status(404).json({ message: "Card not found" });
      res.set('Cache-Control', 'no-store');
      res.json({ id: cardId, status: card.status, hasFront: !!card.frontImageUrl, hasInside: !!card.insideImageUrl });
    } catch (err: any) {
      res.status(500).json({ message: "Error fetching status: " + err.message });
    }
  });


  app.get("/api/cards/:id", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      
      console.log(`[PERF] Fetching card ${cardId} metadata...`);
      const dbStartTime = Date.now();
      const card = await storage.getCard(cardId);
      const dbEndTime = Date.now();
      console.log(`[PERF] Card metadata query took: ${dbEndTime - dbStartTime}ms`);

      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // For performance, only send metadata and serve images as separate endpoints
      const optimizedCard = {
        id: card.id,
        userId: card.userId,
        cardType: card.cardType,
        printOption: card.printOption,
        sceneType: card.sceneType,
        status: card.status,
        price: card.price,
        frontImageUrl: card.frontImageUrl ? `/api/cards/${cardId}/front-image` : null,
        insideImageUrl: card.insideImageUrl ? `/api/cards/${cardId}/inside-image` : null,
        conversationData: card.conversationData || {}
      };
      
      // Add caching headers for faster subsequent loads
      res.set({
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'ETag': `"${cardId}-${card.status}"`
      });
      
      const endTime = Date.now();
      console.log(`[PERF] Total card metadata serving time: ${endTime - startTime}ms`);
      
      res.json(optimizedCard);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[PERF] Card metadata error after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error fetching card: " + error.message });
    }
  });


  app.get("/api/cards/:id/front-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const cacheKey = `front-${cardId}`;
      const etag = `"${cardId}-front"`;
      
      // Check client cache first
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        console.log(`[CACHE] 304 Not Modified for front image ${cardId}`);
        return res.status(304).end();
      }
      
      // PRIORITY 1: Check preloaded email link cache for instant serving
      emailLinkCache.forEach((emailData, reference) => {
        if (emailData.card.id === cardId && emailData.frontImage && (Date.now() - emailData.timestamp) < 900000) {
          console.log(`[INSTANT] Serving front image ${cardId} from preloaded email cache (${emailData.frontImage.length} bytes) - ${Date.now() - startTime}ms`);
          res.set({
            'Content-Type': 'image/png',
            'Content-Length': emailData.frontImage.length.toString(),
            'Cache-Control': 'public, max-age=31536000',
            'ETag': etag,
            'X-Cache': 'HIT-PRELOADED'
          });
          res.send(emailData.frontImage);
          return;
        }
      });
      
      // If we already sent a response from the cache, return early
      if (res.headersSent) return;
      
      // PRIORITY 2: Check server cache
      const cached = imageCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log(`[CACHE] Serving front image ${cardId} from memory cache (${cached.data.length} bytes)`);
        res.set({
          'Content-Type': 'image/png',
          'Content-Length': cached.data.length.toString(),
          'Cache-Control': 'public, max-age=31536000',
          'ETag': etag,
          'X-Cache': 'HIT-MEMORY'
        });
        return res.send(cached.data);
      }
      
      console.log(`[PERF] Cache miss - fetching card ${cardId} for front image...`);
      const dbStartTime = Date.now();
      const card = await storage.getCard(cardId);
      const dbEndTime = Date.now();
      console.log(`[PERF] Database query took: ${dbEndTime - dbStartTime}ms`);

      if (!card || !card.frontImageUrl) {
        return res.status(404).json({ message: "Front image not found" });
      }

      // Handle PNG file URLs (new system) vs Base64 data (legacy)
      let imageBuffer: Buffer;
      const conversionStartTime = Date.now();
      
      if (card.frontImageUrl.startsWith('/images/')) {
        // NEW: PNG file URL - serve from stored PNG files
        console.log(`[PNG_SERVE] Serving front image from PNG file: ${card.frontImageUrl}`);
        
        try {
          const filename = path.basename(card.frontImageUrl);
          const filepath = path.join(process.cwd(), 'stored_images', filename);
          imageBuffer = await fsPromises.readFile(filepath);
          console.log(`[PNG_SERVE] Successfully loaded PNG file: ${filename} (${imageBuffer.length} bytes)`);
        } catch (error) {
          console.error(`[PNG_SERVE] Failed to load PNG file: ${card.frontImageUrl}`, error);
          return res.status(404).json({ message: "Front image file not found" });
        }
      } else {
        // LEGACY: Base64 data - convert to buffer
        console.log(`[BASE64_SERVE] Processing Base64 front image data (${card.frontImageUrl.length} chars)`);
        const base64Data = card.frontImageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      }
      
      // Use high-quality JPEG with optimal settings for fast loading
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 95, 
          progressive: true,
          mozjpeg: true,
          optimiseScans: true
        })
        .toBuffer();
      
      const conversionEndTime = Date.now();
      console.log(`[PERF] Base64 conversion and optimization took: ${conversionEndTime - conversionStartTime}ms`);
      
      // Cache the processed image
      imageCache.set(cacheKey, {
        data: optimizedBuffer,
        timestamp: Date.now(),
        etag
      });
      console.log(`[CACHE] Cached front image ${cardId} (${optimizedBuffer.length} bytes)`);
      
      // Set headers and send
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': optimizedBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000',
        'ETag': etag
      });
      
      const endTime = Date.now();
      console.log(`[PERF] Total front image serving time: ${endTime - startTime}ms`);
      
      res.send(optimizedBuffer);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[PERF] Front image error after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error serving front image: " + error.message });
    }
  });


  app.get("/api/cards/:id/inside-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const cacheKey = `inside-${cardId}`;
      const etag = `"${cardId}-inside"`;
      
      // Check client cache first
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        console.log(`[CACHE] 304 Not Modified for inside image ${cardId}`);
        return res.status(304).end();
      }
      
      // PRIORITY 1: Check preloaded email link cache for instant serving
      emailLinkCache.forEach((emailData, reference) => {
        if (emailData.card.id === cardId && emailData.insideImage && (Date.now() - emailData.timestamp) < 900000) {
          console.log(`[INSTANT] Serving inside image ${cardId} from preloaded email cache (${emailData.insideImage.length} bytes) - ${Date.now() - startTime}ms`);
          res.set({
            'Content-Type': 'image/png',
            'Content-Length': emailData.insideImage.length.toString(),
            'Cache-Control': 'public, max-age=31536000',
            'ETag': etag,
            'X-Cache': 'HIT-PRELOADED'
          });
          res.send(emailData.insideImage);
          return;
        }
      });
      
      // If we already sent a response from the cache, return early
      if (res.headersSent) return;
      
      // PRIORITY 2: Check server cache
      const cached = imageCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log(`[CACHE] Serving inside image ${cardId} from memory cache (${cached.data.length} bytes)`);
        res.set({
          'Content-Type': 'image/png',
          'Content-Length': cached.data.length.toString(), 
          'Cache-Control': 'public, max-age=31536000',
          'ETag': etag,
          'X-Cache': 'HIT-MEMORY'
        });
        return res.send(cached.data);
      }
      
      console.log(`[PERF] Cache miss - fetching card ${cardId} for inside image...`);
      const dbStartTime = Date.now();
      const card = await storage.getCard(cardId);
      const dbEndTime = Date.now();
      console.log(`[PERF] Database query took: ${dbEndTime - dbStartTime}ms`);

      if (!card || !card.insideImageUrl) {
        return res.status(404).json({ message: "Inside image not found" });
      }

      // Handle PNG file URLs (new system) vs Base64 data (legacy)
      let imageBuffer: Buffer;
      const conversionStartTime = Date.now();
      
      if (card.insideImageUrl.startsWith('/images/')) {
        // NEW: PNG file URL - serve from stored PNG files
        console.log(`[PNG_SERVE] Serving inside image from PNG file: ${card.insideImageUrl}`);
        
        try {
          const filename = path.basename(card.insideImageUrl);
          const filepath = path.join(process.cwd(), 'stored_images', filename);
          imageBuffer = await fsPromises.readFile(filepath);
          console.log(`[PNG_SERVE] Successfully loaded PNG file: ${filename} (${imageBuffer.length} bytes)`);
        } catch (error) {
          console.error(`[PNG_SERVE] Failed to load PNG file: ${card.insideImageUrl}`, error);
          return res.status(404).json({ message: "Inside image file not found" });
        }
      } else {
        // LEGACY: Base64 data - convert to buffer
        console.log(`[BASE64_SERVE] Processing Base64 inside image data (${card.insideImageUrl.length} chars)`);
        const base64Data = card.insideImageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      }
      
      // Use high-quality JPEG with optimal settings for fast loading
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 95, 
          progressive: true,
          mozjpeg: true,
          optimiseScans: true
        })
        .toBuffer();
      
      const conversionEndTime = Date.now();
      console.log(`[PERF] Base64 conversion and optimization took: ${conversionEndTime - conversionStartTime}ms`);
      
      // Cache the processed image
      imageCache.set(cacheKey, {
        data: optimizedBuffer,
        timestamp: Date.now(),
        etag
      });
      console.log(`[CACHE] Cached inside image ${cardId} (${optimizedBuffer.length} bytes)`);
      
      // Set headers and send
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': optimizedBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000',
        'ETag': etag
      });
      
      const endTime = Date.now();
      console.log(`[PERF] Total inside image serving time: ${endTime - startTime}ms`);
      
      res.send(optimizedBuffer);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[PERF] Inside image error after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error serving inside image: " + error.message });
    }
  });


  app.get("/api/cards/:id/fast-front-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const cacheKey = `fast-front-${cardId}`;
      
      // PRIORITY 1: Check preloaded email link cache for instant serving
      emailLinkCache.forEach((emailData, reference) => {
        if (emailData.card.id === cardId && emailData.frontImage && (Date.now() - emailData.timestamp) < 900000) {
          console.log(`[INSTANT] Serving fast front image ${cardId} from preloaded email cache (${emailData.frontImage.length} bytes) - ${Date.now() - startTime}ms`);
          
          // Use preloaded image data for instant serving
          const optimizedBuffer = emailData.frontImage;
          res.set({
            'Content-Type': 'image/png',
            'Content-Length': optimizedBuffer.length.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': `"preloaded-front-${cardId}"`,
            'X-Cache': 'HIT-PRELOADED'
          });
          res.send(optimizedBuffer);
          return;
        }
      });
      
      // If we already sent a response from the preloaded cache, return early
      if (res.headersSent) return;
      
      // PRIORITY 2: Check memory cache
      const cached = imageCache.get(cacheKey);
      if (cached) {
        console.log(`[CACHE] Serving fast front image ${cardId} from memory cache - ${Date.now() - startTime}ms`);
        res.set({
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': cached.etag
        });
        return res.send(cached.data);
      }
      
      const card = await storage.getCard(cardId);
      if (!card?.frontImageUrl) {
        return res.status(404).json({ message: "Front image not found" });
      }
      
      // Handle both base64 data and PNG file URLs
      let imageBuffer: Buffer;
      
      if (card.frontImageUrl.startsWith('data:image/')) {
        // Handle base64 data URLs
        const base64Data = card.frontImageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (card.frontImageUrl.startsWith('/images/')) {
        // Handle PNG file URLs - read the file from disk
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'stored_images', card.frontImageUrl.replace('/images/', ''));
        
        try {
          imageBuffer = await fs.promises.readFile(filePath);
        } catch (error) {
          console.log(`[FAST-FRONT] PNG file not found: ${filePath}, falling back to base64`);
          // FALLBACK: Try to get base64 from conversationData if PNG file doesn't exist
          const conversationData = (card.conversationData as any) || {};
          
          // Check multiple possible sources for base64 data
          let fallbackBase64 = null;
          if (conversationData.frontImageUrl && conversationData.frontImageUrl.startsWith('data:image/')) {
            fallbackBase64 = conversationData.frontImageUrl.split(',')[1];
          } else if (conversationData.photo_upload && conversationData.photo_upload.startsWith('data:image/')) {
            fallbackBase64 = conversationData.photo_upload.split(',')[1];
          }
          
          if (fallbackBase64) {
            imageBuffer = Buffer.from(fallbackBase64, 'base64');
            console.log(`[FAST-FRONT] Using fallback base64 image: ${imageBuffer.length} bytes`);
          } else {
            console.log(`[FAST-FRONT] No fallback base64 image found in conversationData`);
            throw error; // Re-throw if no fallback available
          }
        }
      } else {
        throw new Error('Invalid front image URL format');
      }
      
      // Use maximum quality JPEG with optimal settings for fast loading
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 98, 
          progressive: true,
          mozjpeg: true,
          optimiseScans: true
        })
        .toBuffer();
      
      // Cache the optimized image
      const etag = `"optimized-front-${cardId}"`;
      imageCache.set(cacheKey, {
        data: optimizedBuffer,
        timestamp: Date.now(),
        etag
      });
      
      res.set({
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag
      });
      
      res.send(optimizedBuffer);
    } catch (error: any) {
      console.error("[PERF] Fast front image error:", error);
      res.status(500).json({ message: "Error serving fast front image" });
    }
  });


  app.get("/api/cards/:id/fast-inside-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const cacheKey = `fast-inside-${cardId}`;
      
      // PRIORITY 1: Check preloaded email link cache for instant serving
      emailLinkCache.forEach((emailData, reference) => {
        if (emailData.card.id === cardId && emailData.insideImage && (Date.now() - emailData.timestamp) < 900000) {
          console.log(`[INSTANT] Serving fast inside image ${cardId} from preloaded email cache (${emailData.insideImage.length} bytes) - ${Date.now() - startTime}ms`);
          
          // Use preloaded image data for instant serving
          const optimizedBuffer = emailData.insideImage;
          res.set({
            'Content-Type': 'image/png',
            'Content-Length': optimizedBuffer.length.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': `"preloaded-inside-${cardId}"`,
            'X-Cache': 'HIT-PRELOADED'
          });
          res.send(optimizedBuffer);
          return;
        }
      });
      
      // If we already sent a response from the preloaded cache, return early
      if (res.headersSent) return;
      
      // PRIORITY 2: Check memory cache
      const cached = imageCache.get(cacheKey);
      if (cached) {
        console.log(`[CACHE] Serving fast inside image ${cardId} from memory cache - ${Date.now() - startTime}ms`);
        res.set({
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': cached.etag
        });
        return res.send(cached.data);
      }
      
      const card = await storage.getCard(cardId);
      if (!card?.insideImageUrl) {
        return res.status(404).json({ message: "Inside image not found" });
      }
      
      // Handle both base64 data and PNG file URLs
      let imageBuffer: Buffer;
      
      if (card.insideImageUrl.startsWith('data:image/')) {
        // Handle base64 data URLs
        const base64Data = card.insideImageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (card.insideImageUrl.startsWith('/images/')) {
        // Handle PNG file URLs - read the file from disk
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'stored_images', card.insideImageUrl.replace('/images/', ''));
        
        try {
          imageBuffer = await fs.promises.readFile(filePath);
        } catch (error) {
          console.log(`[FAST-INSIDE] PNG file not found: ${filePath}, falling back to base64`);
          // FALLBACK: Try to get base64 from conversationData if PNG file doesn't exist
          const conversationData = (card.conversationData as any) || {};
          
          // Check multiple possible sources for base64 data
          let fallbackBase64 = null;
          if (conversationData.insideImageUrl && conversationData.insideImageUrl.startsWith('data:image/')) {
            fallbackBase64 = conversationData.insideImageUrl.split(',')[1];
          } else if (conversationData.photo_upload && conversationData.photo_upload.startsWith('data:image/')) {
            fallbackBase64 = conversationData.photo_upload.split(',')[1];
          }
          
          if (fallbackBase64) {
            imageBuffer = Buffer.from(fallbackBase64, 'base64');
            console.log(`[FAST-INSIDE] Using fallback base64 image: ${imageBuffer.length} bytes`);
          } else {
            console.log(`[FAST-INSIDE] No fallback base64 image found in conversationData`);
            throw error; // Re-throw if no fallback available
          }
        }
      } else {
        throw new Error('Invalid inside image URL format');
      }
      
      // Use maximum quality JPEG with optimal settings for fast loading
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 98, 
          progressive: true,
          mozjpeg: true,
          optimiseScans: true
        })
        .toBuffer();
      
      // Cache the optimized image
      const etag = `"optimized-inside-${cardId}"`;
      imageCache.set(cacheKey, {
        data: optimizedBuffer,
        timestamp: Date.now(),
        etag
      });
      
      res.set({
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag
      });
      
      res.send(optimizedBuffer);
    } catch (error: any) {
      console.error("[PERF] Fast inside image error:", error);
      res.status(500).json({ message: "Error serving fast inside image" });
    }
  });


  app.get("/api/cards/:id/digital-front-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const etag = `"${cardId}-digital-front"`;
      
      // Check client cache first
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        console.log(`[CACHE] 304 Not Modified for digital front image ${cardId}`);
        return res.status(304).end();
      }
      
      console.log(`[DIGITAL] Fetching optimized digital front image for card ${cardId}`);
      
      // Get the card and check if it exists
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Check if migration is needed
      if (cardNeedsMigration(card)) {
        console.log(`[MIGRATION] Migrating card ${cardId} images on-demand`);
        await migrateCardImages(card);
      }
      
      // Get the original unwatermarked image from conversationData (if available)
      let imageBuffer;
      const conversationData = card.conversationData as any || {};
      
      if (conversationData.originalFrontImageUrl) {
        // Use the original unwatermarked image from conversationData
        console.log(`[DIGITAL] Using original unwatermarked front image for card ${cardId}`);
        const base64Data = conversationData.originalFrontImageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // Fall back to stored image if no original is available
        console.log(`[DIGITAL] Using stored front image for card ${cardId} (no original found)`);
        imageBuffer = await getStoredImage(cardId, 'front');
      }
      
      if (!imageBuffer) {
        return res.status(404).json({ message: "Front image not found" });
      }
      
      // Use high-quality JPEG with optimal settings for fast loading
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 95, 
          progressive: true,
          mozjpeg: true,
          optimiseScans: true
        })
        .toBuffer();
      
      // Set caching headers
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': optimizedBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'ETag': etag
      });
      
      const endTime = Date.now();
      console.log(`[DIGITAL] Digital front image served in ${endTime - startTime}ms (${optimizedBuffer.length} bytes)`);
      
      res.send(optimizedBuffer);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[DIGITAL] Error serving digital front image after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error serving digital front image: " + error.message });
    }
  });


  app.get("/api/cards/:id/download-front-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const etag = `"${cardId}-download-front"`;
      
      // Check client cache first
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end();
      }
      
      console.log(`[DOWNLOAD] Fetching full-resolution front image for card ${cardId}`);
      
      let imageBuffer: Buffer | null = null;
      
      // Try to get original unwatermarked image first
      const card = await storage.getCard(cardId);
      if (card?.conversationData) {
        const originalImageUrl = (card.conversationData as any).originalFrontImageUrl;
        if (originalImageUrl) {
          console.log(`[DOWNLOAD] Using original unwatermarked front image for card ${cardId}`);
          imageBuffer = Buffer.from(originalImageUrl.replace('data:image/png;base64,', ''), 'base64');
        }
      }
      
      if (!imageBuffer) {
        // Try print-resolution file first (3000×3000, generated after background gen)
        const fsModule = await import('fs');
        const pathModule2 = await import('path');
        const printPath = pathModule2.join(process.cwd(), 'stored_images', `card_${cardId}_front_print.png`);
        try {
          await fsModule.promises.access(printPath);
          imageBuffer = await fsModule.promises.readFile(printPath);
          console.log(`[DOWNLOAD] Serving print-resolution front image for card ${cardId} (${imageBuffer.length} bytes)`);
        } catch {
          // Fall back to standard stored image
          console.log(`[DOWNLOAD] Using stored front image for card ${cardId} (no original, no print file found)`);
          imageBuffer = await getStoredImage(cardId, 'front');
        }
      } else {
        // Check if a higher-res print file is available, prefer it
        const fsModule = await import('fs');
        const pathModule2 = await import('path');
        const printPath = pathModule2.join(process.cwd(), 'stored_images', `card_${cardId}_front_print.png`);
        try {
          await fsModule.promises.access(printPath);
          const printBuffer = await fsModule.promises.readFile(printPath);
          imageBuffer = printBuffer;
          console.log(`[DOWNLOAD] Upgraded to print-resolution front image for card ${cardId} (${imageBuffer.length} bytes)`);
        } catch {
          // Print file not yet available, serve what we have
        }
      }
      
      if (!imageBuffer) {
        return res.status(404).json({ message: "Front image not found" });
      }
      
      // Set download headers (no compression for full resolution)
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length.toString(),
        'Content-Disposition': `attachment; filename="celebrait-card-front-${cardId}.png"`,
        'Cache-Control': 'public, max-age=3600',
        'ETag': etag
      });
      
      const endTime = Date.now();
      console.log(`[DOWNLOAD] Full-resolution front image served in ${endTime - startTime}ms (${imageBuffer.length} bytes)`);
      
      res.send(imageBuffer);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[DOWNLOAD] Error serving full-resolution front image after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error serving full-resolution front image: " + error.message });
    }
  });


  app.get("/api/cards/:id/download-inside-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const etag = `"${cardId}-download-inside"`;
      
      // Check client cache first
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end();
      }
      
      console.log(`[DOWNLOAD] Fetching full-resolution inside image for card ${cardId}`);
      
      let imageBuffer: Buffer | null = null;
      
      // Try to get original unwatermarked image first
      const card = await storage.getCard(cardId);
      if (card?.conversationData) {
        const originalImageUrl = (card.conversationData as any).originalInsideImageUrl;
        if (originalImageUrl) {
          console.log(`[DOWNLOAD] Using original unwatermarked inside image for card ${cardId}`);
          imageBuffer = Buffer.from(originalImageUrl.replace('data:image/png;base64,', ''), 'base64');
        }
      }
      
      if (!imageBuffer) {
        // Try print-resolution file first (3000×3000, generated after background gen)
        const fsModule2 = await import('fs');
        const pathModule3 = await import('path');
        const printPath2 = pathModule3.join(process.cwd(), 'stored_images', `card_${cardId}_inside_print.png`);
        try {
          await fsModule2.promises.access(printPath2);
          imageBuffer = await fsModule2.promises.readFile(printPath2);
          console.log(`[DOWNLOAD] Serving print-resolution inside image for card ${cardId} (${imageBuffer.length} bytes)`);
        } catch {
          console.log(`[DOWNLOAD] Using stored inside image for card ${cardId} (no original, no print file found)`);
          imageBuffer = await getStoredImage(cardId, 'inside');
        }
      } else {
        // Check if a higher-res print file is available, prefer it
        const fsModule2 = await import('fs');
        const pathModule3 = await import('path');
        const printPath2 = pathModule3.join(process.cwd(), 'stored_images', `card_${cardId}_inside_print.png`);
        try {
          await fsModule2.promises.access(printPath2);
          const printBuffer2 = await fsModule2.promises.readFile(printPath2);
          imageBuffer = printBuffer2;
          console.log(`[DOWNLOAD] Upgraded to print-resolution inside image for card ${cardId} (${imageBuffer.length} bytes)`);
        } catch {
          // Print file not yet available, serve what we have
        }
      }
      
      if (!imageBuffer) {
        return res.status(404).json({ message: "Inside image not found" });
      }
      
      // Set download headers (no compression for full resolution)
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length.toString(),
        'Content-Disposition': `attachment; filename="celebrait-card-inside-${cardId}.png"`,
        'Cache-Control': 'public, max-age=3600',
        'ETag': etag
      });
      
      const endTime = Date.now();
      console.log(`[DOWNLOAD] Full-resolution inside image served in ${endTime - startTime}ms (${imageBuffer.length} bytes)`);
      
      res.send(imageBuffer);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[DOWNLOAD] Error serving full-resolution inside image after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error serving full-resolution inside image: " + error.message });
    }
  });


  app.get("/api/cards/:id/digital-inside-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const etag = `"${cardId}-digital-inside"`;
      
      // Check client cache first
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        console.log(`[CACHE] 304 Not Modified for digital inside image ${cardId}`);
        return res.status(304).end();
      }
      
      console.log(`[DIGITAL] Fetching optimized digital inside image for card ${cardId}`);
      
      // Get the card and check if it exists
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Check if migration is needed
      if (cardNeedsMigration(card)) {
        console.log(`[MIGRATION] Migrating card ${cardId} images on-demand`);
        await migrateCardImages(card);
      }
      
      // Get the original unwatermarked image from conversationData (if available)
      let imageBuffer;
      const conversationData = card.conversationData as any || {};
      
      if (conversationData.originalInsideImageUrl) {
        // Use the original unwatermarked image from conversationData
        console.log(`[DIGITAL] Using original unwatermarked inside image for card ${cardId}`);
        const base64Data = conversationData.originalInsideImageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // Fall back to stored image if no original is available
        console.log(`[DIGITAL] Using stored inside image for card ${cardId} (no original found)`);
        imageBuffer = await getStoredImage(cardId, 'inside');
      }
      
      if (!imageBuffer) {
        return res.status(404).json({ message: "Inside image not found" });
      }
      
      // Use high-quality JPEG with optimal settings for fast loading
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 95, 
          progressive: true,
          mozjpeg: true,
          optimiseScans: true
        })
        .toBuffer();
      
      // Set caching headers
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': optimizedBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'ETag': etag
      });
      
      const endTime = Date.now();
      console.log(`[DIGITAL] Digital inside image served in ${endTime - startTime}ms (${optimizedBuffer.length} bytes)`);
      
      res.send(optimizedBuffer);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[DIGITAL] Error serving digital inside image after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error serving digital inside image: " + error.message });
    }
  });


  app.get("/api/cards/:cardId/download-image/:side", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const side = req.params.side; // 'front' or 'inside'
      
      if (!cardId || isNaN(cardId)) {
        return res.status(400).json({ message: "Invalid card ID" });
      }
      
      if (side !== 'front' && side !== 'inside') {
        return res.status(400).json({ message: "Side must be 'front' or 'inside'" });
      }
      
      // Look for unwatermarked PNG files first (best quality for customers)
      const unwatermarkedPath = path.join(process.cwd(), 'stored_images', `card_${cardId}_${side}_unwatermarked.png`);
      
      try {
        await fsPromises.access(unwatermarkedPath);
        
        // File exists, send it with mobile-friendly headers
        const stats = await fsPromises.stat(unwatermarkedPath);
        const filename = `Celebrait_Card_${side.charAt(0).toUpperCase() + side.slice(1)}.png`;
        
        res.set({
          'Content-Type': 'image/png',
          'Content-Length': stats.size.toString(),
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
          'Access-Control-Allow-Origin': '*' // Allow mobile apps to download
        });
        
        const readStream = fs.createReadStream(unwatermarkedPath);
        readStream.pipe(res);
        
        console.log(`📱 Mobile image download: ${side} for card ${cardId}`);
        return;
        
      } catch (unwatermarkedError) {
        // Fall back to regular watermarked image if unwatermarked not available
        const watermarkedPath = path.join(process.cwd(), 'stored_images', `card_${cardId}_${side}.png`);
        
        try {
          await fsPromises.access(watermarkedPath);
          
          const stats = await fsPromises.stat(watermarkedPath);
          const filename = `Celebrait_Card_${side.charAt(0).toUpperCase() + side.slice(1)}.png`;
          
          res.set({
            'Content-Type': 'image/png',
            'Content-Length': stats.size.toString(),
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
          });
          
          const readStream = fs.createReadStream(watermarkedPath);
          readStream.pipe(res);
          
          console.log(`📱 Mobile image download (watermarked): ${side} for card ${cardId}`);
          return;
          
        } catch (watermarkedError) {
          console.error(`Image not found for card ${cardId} ${side}:`, watermarkedError);
          return res.status(404).json({ message: "Image not found for this card" });
        }
      }
      
    } catch (error: any) {
      console.error('Mobile image download error:', error);
      res.status(500).json({ message: "Error downloading image: " + error.message });
    }
  });

}
