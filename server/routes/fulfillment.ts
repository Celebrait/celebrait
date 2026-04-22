import type { Express } from "express";
import fs, { promises as fsPromises } from "fs";
import path from "path";
import sharp from "sharp";
import { storage } from "../storage";
// NOTE: this file is pre-Studio legacy. Email sends + the
// /api/send-card-ready-notification, /api/send-shipping-notification
// and /api/send-abandonment-email routes were retired 2026-04-21.
// Studio has its own recipient/sender email triggers in
// server/routes/studio-checkout.ts and server/routes/studio-drafts.ts.
import { getStoredImage, getImageUrl } from "../image-storage";
import { generateCardInBackground } from "../background-generator";
import {
  imageCache,
  cardMetadataCache,
  emailLinkCache,
  CACHE_TTL,
  METADATA_CACHE_TTL
} from "../utils/shared";

export function registerFulfillmentRoutes(app: Express): void {
  app.get("/api/cards/ready/:reference", async (req, res) => {
    const startTime = Date.now();
    try {
      const reference = req.params.reference;
      
      // PRIORITY 1: Check preloaded email link cache for instant loading
      const emailCached = emailLinkCache.get(reference);
      if (emailCached && (Date.now() - emailCached.timestamp) < 900000) { // 15 minutes cache
        console.log(`[INSTANT] Serving from preloaded email cache: ${reference} (${Date.now() - startTime}ms)`);
        
        const responseData = {
          card: {
            ...emailCached.card,
            frontImageUrl: `/api/cards/${emailCached.card.id}/fast-front-image`,
            insideImageUrl: emailCached.insideImage ? `/api/cards/${emailCached.card.id}/fast-inside-image` : null,
            // Remove base64 images for ultra-fast loading
            frontImageBase64: null,
            insideImageBase64: null
          },
          reference,
          message: "Card ready for delivery choice"
        };
        
        res.set({
          'Cache-Control': 'public, max-age=600',
          'ETag': `"${reference}"`,
          'X-Cache': 'HIT-PRELOADED',
          'X-Response-Time': `${Date.now() - startTime}ms`,
          'Content-Type': 'application/json; charset=utf-8',
          'Connection': 'keep-alive'
        });
        return res.json(responseData);
      }
      
      // PRIORITY 2: Check metadata cache
      const cacheKey = `ready-${reference}`;
      const cached = cardMetadataCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < METADATA_CACHE_TTL) {
        console.log(`[CACHE] Serving ready card from metadata cache for reference: ${reference}`);
        res.set({
          'Cache-Control': 'public, max-age=300',
          'ETag': `"${reference}"`,
          'X-Cache': 'HIT-METADATA'
        });
        return res.json(cached.data);
      }
      
      console.log(`[PERF] Cache miss - fetching card by ready reference: ${reference}`);
      
      // Extract cardId from reference if it follows pattern
      if (!reference.startsWith('celebrait_ready_')) {
        return res.status(400).json({ message: "Invalid ready reference format" });
      }
      
      // Extract cardId from reference pattern: celebrait_ready_{cardId}_{timestamp}_{random}
      const parts = reference.split('_');
      if (parts.length < 4) {
        return res.status(400).json({ message: "Invalid ready reference format" });
      }
      
      const cardId = parts[2]; // Third part is the cardId
      
      if (!cardId || isNaN(parseInt(cardId))) {
        return res.status(400).json({ message: "Cannot extract card ID from reference" });
      }

      const dbStartTime = Date.now();
      const card = await storage.getCard(parseInt(cardId));
      const dbEndTime = Date.now();
      console.log(`[PERF] Database query for ready card took: ${dbEndTime - dbStartTime}ms`);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // For maximum performance, only send metadata and serve images as separate endpoints
      const optimizedCard = {
        id: card.id,
        userId: card.userId,
        cardType: card.cardType,
        printOption: card.printOption,
        sceneType: card.sceneType,
        status: card.status,
        price: card.price,
        frontImageUrl: card.frontImageUrl ? `/api/cards/${cardId}/fast-front-image` : null,
        insideImageUrl: card.insideImageUrl ? `/api/cards/${cardId}/fast-inside-image` : null,
        // Remove massive base64 data to improve loading speed
        conversationData: card.conversationData || {}
      };
      
      const responseData = {
        card: optimizedCard,
        reference,
        message: "Card ready for delivery choice"
      };
      
      // Cache the response
      cardMetadataCache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now()
      });
      console.log(`[CACHE] Cached ready card metadata for reference: ${reference}`);
      
      // Preload thumbnail images into a SEPARATE thumbnail cache for fast display.
      // Uses thumb-front-* / thumb-inside-* keys, NOT the fast-front-* / fast-inside-* keys,
      // so that display thumbnails never pollute the full-resolution serving path.
      if (card.frontImageUrl) {
        const thumbCacheKey = `thumb-front-${cardId}`;
        if (!imageCache.has(thumbCacheKey)) {
          try {
            let imageBuffer: Buffer;
            
            if (card.frontImageUrl.startsWith('data:image/')) {
              const base64Data = card.frontImageUrl.split(',')[1];
              imageBuffer = Buffer.from(base64Data, 'base64');
            } else if (card.frontImageUrl.startsWith('/images/')) {
              const fs = await import('fs');
              const path = await import('path');
              const frontFilePath = path.join(process.cwd(), 'stored_images', card.frontImageUrl.replace('/images/', ''));
              
              if (fs.existsSync(frontFilePath)) {
                imageBuffer = fs.readFileSync(frontFilePath);
              } else {
                console.warn(`[PRELOAD] PNG front image file not found: ${frontFilePath}`);
                return;
              }
            } else {
              console.warn(`[PRELOAD] Unsupported front image URL format: ${card.frontImageUrl}`);
              return;
            }
            
            const compressedBuffer = await sharp(imageBuffer)
              .jpeg({ quality: 75, progressive: true })
              .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
              .toBuffer();
            
            imageCache.set(thumbCacheKey, {
              data: compressedBuffer,
              timestamp: Date.now(),
              etag: `"thumb-front-${cardId}"`
            });
            console.log(`[PRELOAD] Cached front thumbnail for instant loading: ${cardId} (${imageBuffer.length} bytes → ${compressedBuffer.length} bytes thumbnail)`);
          } catch (e) {
            console.warn(`[PRELOAD] Failed to cache front thumbnail: ${e}`);
          }
        }
      }
      
      if (card.insideImageUrl) {
        const thumbCacheKey = `thumb-inside-${cardId}`;
        if (!imageCache.has(thumbCacheKey)) {
          try {
            let imageBuffer: Buffer;
            
            if (card.insideImageUrl.startsWith('data:image/')) {
              const base64Data = card.insideImageUrl.split(',')[1];
              imageBuffer = Buffer.from(base64Data, 'base64');
            } else if (card.insideImageUrl.startsWith('/images/')) {
              const fs = await import('fs');
              const path = await import('path');
              const insideFilePath = path.join(process.cwd(), 'stored_images', card.insideImageUrl.replace('/images/', ''));
              
              if (fs.existsSync(insideFilePath)) {
                imageBuffer = fs.readFileSync(insideFilePath);
              } else {
                console.warn(`[PRELOAD] PNG inside image file not found: ${insideFilePath}`);
                return;
              }
            } else {
              console.warn(`[PRELOAD] Unsupported inside image URL format: ${card.insideImageUrl}`);
              return;
            }
            
            const compressedBuffer = await sharp(imageBuffer)
              .jpeg({ quality: 75, progressive: true })
              .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
              .toBuffer();
            
            imageCache.set(thumbCacheKey, {
              data: compressedBuffer,
              timestamp: Date.now(),
              etag: `"thumb-inside-${cardId}"`
            });
            console.log(`[PRELOAD] Cached inside thumbnail for instant loading: ${cardId} (${imageBuffer.length} bytes → ${compressedBuffer.length} bytes thumbnail)`);
          } catch (e) {
            console.warn(`[PRELOAD] Failed to cache inside thumbnail: ${e}`);
          }
        }
      }
      
      // Add caching headers for faster subsequent loads
      res.set({
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'X-Cache': 'MISS',
        'ETag': `"${reference}"`
      });
      
      const endTime = Date.now();
      console.log(`[PERF] Total ready card serving time: ${endTime - startTime}ms`);
      
      res.json(responseData);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[PERF] Ready card error after ${endTime - startTime}ms:`, error);
      res.status(400).json({ message: error.message });
    }
  });


  app.get("/api/cards/:id/metadata", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const cacheKey = `metadata-${cardId}`;
      
      // Check cache first
      const cached = cardMetadataCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < METADATA_CACHE_TTL) {
        console.log(`[CACHE] Serving metadata from cache for card ${cardId}`);
        res.set({
          'Cache-Control': 'public, max-age=300',
          'ETag': `"${cardId}-meta"`
        });
        return res.json(cached.data);
      }
      
      console.log(`[PERF] Cache miss - fetching lightweight metadata for card ${cardId}`);
      const dbStartTime = Date.now();
      const card = await storage.getCard(cardId);
      const dbEndTime = Date.now();
      console.log(`[PERF] Lightweight metadata query took: ${dbEndTime - dbStartTime}ms`);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Return only essential metadata - no images
      const metadata = {
        id: card.id,
        userId: card.userId,
        cardType: card.cardType,
        printOption: card.printOption,
        sceneType: card.sceneType,
        status: card.status,
        price: card.price,
        hasImages: !!(card.frontImageUrl && card.insideImageUrl),
        conversationData: card.conversationData
      };
      
      // Cache the lightweight response
      cardMetadataCache.set(cacheKey, {
        data: metadata,
        timestamp: Date.now()
      });
      
      res.set({
        'Cache-Control': 'public, max-age=300',
        'ETag': `"${cardId}-meta"`
      });
      
      const endTime = Date.now();
      console.log(`[PERF] Total metadata serving time: ${endTime - startTime}ms`);
      
      res.json(metadata);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[PERF] Metadata error after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error fetching metadata: " + error.message });
    }
  });


  app.post("/api/remove-watermarks", async (req, res) => {
    try {
      const { cardId } = req.body;

      if (!cardId) {
        return res.status(400).json({ message: "Card ID is required" });
      }

      console.log('Removing watermarks for card:', cardId);

      // Get card from storage
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Switch to unwatermarked file URLs
      const frontFileUrl = getImageUrl(cardId, 'front');
      const insideFileUrl = card.insideImageUrl ? getImageUrl(cardId, 'inside') : null;

      // Update card to use file URLs instead of Base64
      const updatedCard = await storage.updateCard(cardId, {
        frontImageUrl: frontFileUrl,
        insideImageUrl: insideFileUrl,
        status: 'paid'
      });

      console.log('Watermarks removed - switched to file serving');
      res.json({ 
        success: true,
        card: updatedCard
      });

    } catch (error: any) {
      console.error('Watermark removal error:', error);
      res.status(500).json({ message: 'Failed to remove watermarks' });
    }
  });


  app.post("/api/cards/:id/initiate-regeneration", async (req: any, res) => {
    try {
      const cardId = parseInt(req.params.id);
      if (isNaN(cardId)) return res.status(400).json({ message: "Invalid card ID" });

      const card = await storage.getCard(cardId);
      if (!card) return res.status(404).json({ message: "Card not found" });

      const { email, regenerateType, newScene, newArtStyle, newInsideMessage } = req.body;
      if (!email || !regenerateType) {
        return res.status(400).json({ message: "email and regenerateType are required" });
      }

      const priceMap: Record<string, number> = { front: 2500, inside: 1500, both: 3500 };
      const amount = priceMap[regenerateType];
      if (!amount) return res.status(400).json({ message: "Invalid regenerateType. Use front, inside, or both." });

      const reference = `celebrait_regen_${cardId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const callbackUrl = `https://${req.get('host')}/regen/${cardId}?regen_ref=${reference}&regen_type=${regenerateType}`;

      if (!process.env.PAYSTACK_SECRET_KEY) {
        return res.json({ testMode: true, reference, message: "No Paystack key — use execute-regeneration directly in test mode" });
      }

      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          amount,
          currency: 'ZAR',
          reference,
          callback_url: callbackUrl,
          metadata: {
            cardId: cardId.toString(),
            regenerateType,
            newScene: newScene || null,
            newArtStyle: newArtStyle || null,
            newInsideMessage: newInsideMessage || null,
            type: 'regeneration'
          }
        })
      });

      const paystackData = await paystackResponse.json() as any;
      if (paystackData.status) {
        res.json({ paymentUrl: paystackData.data.authorization_url, reference });
      } else {
        throw new Error(paystackData.message || 'Payment initialization failed');
      }
    } catch (error: any) {
      res.status(500).json({ message: "Error initiating regeneration payment: " + error.message });
    }
  });


  app.post("/api/cards/:id/execute-regeneration", async (req: any, res) => {
    try {
      const cardId = parseInt(req.params.id);
      if (isNaN(cardId)) return res.status(400).json({ message: "Invalid card ID" });

      const card = await storage.getCard(cardId);
      if (!card) return res.status(404).json({ message: "Card not found" });

      const { paystackReference, regenerateType, newScene, newArtStyle, newInsideMessage, userEmail, imageDataArray } = req.body;

      // Verify payment with Paystack
      if (paystackReference && process.env.PAYSTACK_SECRET_KEY) {
        const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${paystackReference}`, {
          headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
        });
        const verifyData = await verifyResponse.json() as any;
        if (!verifyData.status || verifyData.data?.status !== 'success') {
          return res.status(402).json({ message: "Payment not verified" });
        }
      }

      // Build updated answers by merging stored conversationData with any new values
      const storedData = (card.conversationData as any) || {};
      const updatedAnswers = {
        ...storedData,
        ...(newScene ? { scene: newScene } : {}),
        ...(newArtStyle ? { art_style: newArtStyle } : {}),
        ...(newInsideMessage !== undefined ? { inside_message: newInsideMessage } : {})
      };

      // Determine what to regenerate
      const doFront = regenerateType === 'front' || regenerateType === 'both';
      const doInside = regenerateType === 'inside' || regenerateType === 'both';

      // Resolve photos: use provided imageDataArray or fall back to stored front image
      let resolvedImageDataArray = imageDataArray;
      if (!resolvedImageDataArray?.length && doFront) {
        const { getStoredImage } = await import('../image-storage');
        const frontBuffer = await getStoredImage(cardId, 'front');
        if (frontBuffer) {
          resolvedImageDataArray = [`data:image/png;base64,${frontBuffer.toString('base64')}`];
        }
      }

      const userName = storedData.name || (userEmail || '').split('@')[0];
      const resolvedEmail = userEmail || storedData.userEmail || '';

      // Create a NEW card for this regeneration — original is preserved
      const newCard = await storage.createCard({
        userId: card.userId,
        parentCardId: cardId,
        cardType: card.cardType,
        printOption: card.printOption || 'front-and-inside',
        sceneType: card.sceneType,
        conversationData: updatedAnswers,
        price: card.price,
        status: 'generating',
      } as any);

      const newCardId = newCard.id;
      console.log(`[REGEN] Created new card ${newCardId} as regen of card ${cardId}`);

      // Respond immediately with newCardId so the client can poll it
      res.json({ success: true, newCardId, message: "Regeneration started. Check your email when it's ready." });

      // Fire generation in background against the NEW card
      const { generateCardInBackground } = await import('../background-generator');
      setImmediate(() => {
        generateCardInBackground({
          cardId: newCardId,
          userEmail: resolvedEmail,
          userName,
          generationType: (updatedAnswers.photo_option === 'upload_and_scene' || resolvedImageDataArray?.length) ? 'scene' : 'text-only',
          imageDataArray: resolvedImageDataArray,
          scenePrompt: updatedAnswers.scene || storedData.scene,
          userArtStyle: updatedAnswers.art_style || storedData.art_style,
          insideText: doInside ? (updatedAnswers.inside_message || storedData.inside_message) : undefined,
          artStyle: updatedAnswers.art_style || storedData.art_style,
          answers: updatedAnswers,
          uploadedPhotoIds: storedData.uploadedPhotoIds
        }).catch(err => {
          console.error(`[REGEN] Error in regeneration for new card ${newCardId}:`, err);
        });
      });

    } catch (error: any) {
      console.error('Execute regeneration error:', error);
      if (!res.headersSent) res.status(500).json({ message: "Regeneration failed: " + error.message });
    }
  });





  app.post("/api/track-abandonment", async (req, res) => {
    try {
      const { cardId, userEmail, userName, stepData, stage } = req.body;
      
      console.log(`Tracking abandonment for card ${cardId}, stage: ${stage}`);
      
      // Update card with abandonment tracking data
      const card = await storage.getCard(cardId);
      if (card) {
        const existingData = (card.conversationData as Record<string, any>) || {};
        await storage.updateCard(cardId, {
          conversationData: {
            ...existingData,
            abandonmentData: {
              userEmail,
              userName,
              stepData,
              stage,
              lastActivity: Date.now()
            }
          }
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking abandonment:', error);
      res.status(500).json({ error: 'Failed to track abandonment' });
    }
  });


  app.get("/api/recover/:recoveryToken", async (req, res) => {
    try {
      const { recoveryToken } = req.params;
      
      // Decode recovery token (format: cardId_timestamp_hash)
      const parts = recoveryToken.split('_');
      if (parts.length < 2) {
        return res.status(400).json({ error: 'Invalid recovery token' });
      }
      
      const cardId = parseInt(parts[0]);
      const card = await storage.getCard(cardId);
      
      if (!card) {
        return res.status(404).json({ error: 'Card not found or expired' });
      }
      
      // Check if card is still recoverable (within 7 days)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      if (card.createdAt && new Date(card.createdAt).getTime() < sevenDaysAgo) {
        return res.status(410).json({ error: 'Recovery period expired' });
      }
      
      // Redirect to appropriate page based on card status
      let redirectUrl = '/create-card';
      
      if (card.status === 'completed' && card.frontImageUrl) {
        redirectUrl = `/complete-order/${cardId}?recovery=true`;
      } else if (card.conversationData) {
        redirectUrl = `/create-card?cardId=${cardId}&recovery=true`;
      }
      
      // Redirect to frontend with recovery data
      res.redirect(redirectUrl);
      
    } catch (error) {
      console.error('Error processing recovery:', error);
      res.status(500).json({ error: 'Recovery failed' });
    }
  });

}
