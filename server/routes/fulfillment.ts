import type { Express } from "express";
import fs, { promises as fsPromises } from "fs";
import path from "path";
import sharp from "sharp";
import { storage } from "../storage";
import { sendEmail, generateCardReadyNotificationEmail } from "../email-service";
import { generateAbandonmentRecoveryEmail, generateShippingNotificationEmail } from "../missing-email-functions";
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


  app.post("/api/send-card-ready-notification", async (req, res) => {
    try {
      const { cardId, customerEmail, customerName } = req.body;

      if (!cardId || !customerEmail || !customerName) {
        return res.status(400).json({ message: "Card ID, customer email, and name are required" });
      }

      console.log('Starting email notification process for card:', cardId);

      // Function to check if card is ready
      const isCardReady = async () => {
        const card = await storage.getCard(parseInt(cardId));
        if (!card) {
          return { ready: false, error: "Card not found" };
        }
        
        console.log(`Card ${cardId} raw data:`, JSON.stringify(card, null, 2));

        // Check if both front and inside images are ready (support both base64 and PNG file URLs)
        const frontReady = card.frontImageUrl && (card.frontImageUrl.startsWith('data:image/') || card.frontImageUrl.startsWith('/images/'));
        const insideReady = !card.insideImageUrl || card.insideImageUrl.startsWith('data:image/') || card.insideImageUrl.startsWith('/images/');

        console.log(`Card ${card.id} image readiness check:`, {
          frontImageUrl: card.frontImageUrl ? 'present' : 'null',
          frontImageUrlValue: card.frontImageUrl,
          frontReady,
          insideImageUrl: card.insideImageUrl ? 'present' : 'null',
          insideImageUrlValue: card.insideImageUrl,
          insideReady,
          status: card.status
        });

        if (!frontReady || !insideReady) {
          return { ready: false, card };
        }

        // Check if image data is substantial (support both base64 and PNG files)
        if (card.frontImageUrl) {
          try {
            if (card.frontImageUrl.startsWith('data:image/')) {
              // Validate base64 data URLs
              const frontBase64Data = card.frontImageUrl.split(',')[1];
              if (!frontBase64Data || frontBase64Data.length < 100) {
                console.log(`Card ${card.id} front image base64 data too small:`, frontBase64Data?.length || 0, 'characters');
                return { ready: false, card };
              }
              console.log(`Card ${card.id} base64 images validated successfully:`, {
                frontSize: frontBase64Data.length,
                hasInside: !!card.insideImageUrl,
                status: card.status
              });
            } else if (card.frontImageUrl.startsWith('/images/')) {
              // Validate PNG file URLs by checking file existence
              const fs = await import('fs');
              const path = await import('path');
              const frontFilePath = path.join(process.cwd(), 'stored_images', card.frontImageUrl.replace('/images/', ''));
              
              if (!fs.existsSync(frontFilePath)) {
                console.log(`Card ${card.id} front PNG file not found:`, frontFilePath);
                return { ready: false, card };
              }
              
              const frontFileSize = fs.statSync(frontFilePath).size;
              if (frontFileSize < 1000) { // Minimum 1KB for PNG file
                console.log(`Card ${card.id} front PNG file too small:`, frontFileSize, 'bytes');
                return { ready: false, card };
              }
              
              console.log(`Card ${card.id} PNG images validated successfully:`, {
                frontSize: frontFileSize,
                hasInside: !!card.insideImageUrl,
                status: card.status
              });
            }
            return { ready: true, card };
          } catch (parseError) {
            console.log(`Card ${card.id} image validation error:`, parseError);
            return { ready: false, card };
          }
        }
        
        return { ready: false, card };
      };

      // Poll for card completion with 10-second intervals, 5-minute timeout
      const maxAttempts = 30; // 5 minutes total
      let attempts = 0;

      const pollForCard = async (): Promise<any> => {
        attempts++;
        console.log(`Polling attempt ${attempts}/${maxAttempts} for card ${cardId}`);

        const { ready, card, error } = await isCardReady();

        if (error) {
          throw new Error(error);
        }

        if (ready && card) {
          console.log('Card is ready for email notification:', {
            cardId: card.id,
            hasFront: !!card.frontImageUrl,
            hasInside: !!card.insideImageUrl,
            status: card.status
          });
          return card;
        }

        if (attempts >= maxAttempts) {
          throw new Error('Card generation timeout - images not ready after 5 minutes');
        }

        // Wait 10 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 10000));
        return pollForCard();
      };

      const card = await pollForCard();
      console.log('Images validated successfully - proceeding with email notification');

      // Extract actual user name from conversation data if available
      let actualCustomerName = customerName;
      if (card.conversationData) {
        try {
          const conversationData = typeof card.conversationData === 'string' 
            ? JSON.parse(card.conversationData) 
            : card.conversationData;
          
          // Try to get user's actual name from conversation data
          if (conversationData.user_first_name) {
            actualCustomerName = `${conversationData.user_first_name} ${conversationData.user_last_name || ''}`.trim();
          } else if (conversationData.sender_name) {
            actualCustomerName = conversationData.sender_name;
          }
          
          console.log('[EMAIL PERSONALIZATION] Name extraction:', {
            originalName: customerName,
            extractedName: actualCustomerName,
            hasUserFirstName: !!conversationData.user_first_name,
            hasSenderName: !!conversationData.sender_name
          });
        } catch (parseError) {
          console.warn('Failed to parse conversation data for name extraction:', parseError);
        }
      }

      // Create a temporary reference for the delivery choice flow that includes cardId
      const reference = `celebrait_ready_${cardId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create order data structure for the email template
      const orderData = {
        customerEmail,
        customerName: actualCustomerName, // Use the extracted actual name
        paymentReference: reference,
        cardId: cardId,
        cardType: card.cardType // Include delivery method to skip delivery choice page
      };

      // Preload card data into cache for instant email link access
      try {
        console.log('Preloading card data for instant email access...');
        
        // Load PNG images from file system for caching
        let frontImageBuffer: Buffer | null = null;
        let insideImageBuffer: Buffer | null = null;
        
        // Handle both PNG file URLs and legacy base64 data URLs
        if (card.frontImageUrl) {
          if (card.frontImageUrl.startsWith('/images/')) {
            // PNG file URL - read from file system
            const fs = await import('fs');
            const path = await import('path');
            const frontFilePath = path.join(process.cwd(), 'stored_images', card.frontImageUrl.replace('/images/', ''));
            
            if (fs.existsSync(frontFilePath)) {
              frontImageBuffer = fs.readFileSync(frontFilePath);
              console.log(`[PRELOAD] Loaded PNG front image: ${frontImageBuffer.length} bytes`);
            } else {
              console.log(`[PRELOAD] PNG front image file not found: ${frontFilePath}`);
              // FALLBACK: Try to get base64 from conversationData if PNG file doesn't exist
              const conversationData = card.conversationData || {};
              let fallbackBase64 = null;
              if (conversationData.frontImageUrl && conversationData.frontImageUrl.startsWith('data:image/')) {
                fallbackBase64 = conversationData.frontImageUrl.split(',')[1];
              } else if (conversationData.photo_upload && conversationData.photo_upload.startsWith('data:image/')) {
                fallbackBase64 = conversationData.photo_upload.split(',')[1];
              }
              
              if (fallbackBase64) {
                frontImageBuffer = Buffer.from(fallbackBase64, 'base64');
                console.log(`[PRELOAD] Fallback - loaded base64 front image from conversationData: ${frontImageBuffer.length} bytes`);
              }
            }
          } else if (card.frontImageUrl.startsWith('data:image/')) {
            // Legacy base64 data URL
            const frontBase64 = card.frontImageUrl.split(',')[1];
            frontImageBuffer = Buffer.from(frontBase64, 'base64');
            console.log(`[PRELOAD] Loaded base64 front image: ${frontImageBuffer.length} bytes`);
          }
        }
        
        if (card.insideImageUrl) {
          if (card.insideImageUrl.startsWith('/images/')) {
            // PNG file URL - read from file system
            const fs = await import('fs');
            const path = await import('path');
            const insideFilePath = path.join(process.cwd(), 'stored_images', card.insideImageUrl.replace('/images/', ''));
            
            if (fs.existsSync(insideFilePath)) {
              insideImageBuffer = fs.readFileSync(insideFilePath);
              console.log(`[PRELOAD] Loaded PNG inside image: ${insideImageBuffer.length} bytes`);
            } else {
              console.log(`[PRELOAD] PNG inside image file not found: ${insideFilePath}`);
              // FALLBACK: Try to get base64 from conversationData if PNG file doesn't exist
              const conversationData = card.conversationData || {};
              let fallbackBase64 = null;
              if (conversationData.insideImageUrl && conversationData.insideImageUrl.startsWith('data:image/')) {
                fallbackBase64 = conversationData.insideImageUrl.split(',')[1];
              } else if (conversationData.photo_upload && conversationData.photo_upload.startsWith('data:image/')) {
                fallbackBase64 = conversationData.photo_upload.split(',')[1];
              }
              
              if (fallbackBase64) {
                insideImageBuffer = Buffer.from(fallbackBase64, 'base64');
                console.log(`[PRELOAD] Fallback - loaded base64 inside image from conversationData: ${insideImageBuffer.length} bytes`);
              }
            }
          } else if (card.insideImageUrl.startsWith('data:image/')) {
            // Legacy base64 data URL
            const insideBase64 = card.insideImageUrl.split(',')[1];
            insideImageBuffer = Buffer.from(insideBase64, 'base64');
            console.log(`[PRELOAD] Loaded base64 inside image: ${insideImageBuffer.length} bytes`);
          }
        }
        
        // Cache complete card data for instant email link loading
        if (frontImageBuffer) {
          const conversationData = card.conversationData || {};
          
          emailLinkCache.set(reference, {
            card: {
              id: card.id,
              userId: card.userId,
              cardType: card.cardType,
              printOption: card.printOption,
              sceneType: card.sceneType,
              status: card.status,
              price: card.price,
              conversationData: conversationData
            },
            frontImage: frontImageBuffer,
            insideImage: insideImageBuffer,
            timestamp: Date.now()
          });
          
          // AGGRESSIVE PRELOADING: Also cache individual images for ultra-fast API serving
          imageCache.set(`front-${card.id}`, {
            data: frontImageBuffer,
            timestamp: Date.now(),
            etag: `"${card.id}-front"`
          });
          
          if (insideImageBuffer) {
            imageCache.set(`inside-${card.id}`, {
              data: insideImageBuffer,
              timestamp: Date.now(),
              etag: `"${card.id}-inside"`
            });
          }
          
          console.log(`[PRELOAD] Successfully cached all data for reference: ${reference} (front: ${frontImageBuffer.length} bytes, inside: ${insideImageBuffer ? insideImageBuffer.length : 0} bytes)`);
        } else {
          console.log('[PRELOAD] No front image buffer available for caching');
        }
        
        console.log('Card data preloaded successfully for reference:', reference);
      } catch (cacheError) {
        console.error('Failed to preload card data, but continuing with email:', cacheError);
      }

      // Send card ready notification email (this should take user to delivery choice)
      try {
        const requestHost = req.get('host') || 'localhost:5050';
        console.log(`[EMAIL_DEBUG] /api/send-card-ready-notification req.get('host')=${req.get('host')} requestHost=${requestHost}`);
        const emailParams = generateCardReadyNotificationEmail(orderData, requestHost);
        const emailSent = await sendEmail(emailParams);
        
        if (emailSent) {
          console.log('Card ready notification email sent successfully to:', customerEmail);
          res.json({
            success: true,
            message: 'Card ready notification sent successfully',
            reference
          });
        } else {
          console.error('Failed to send card ready notification email - SendGrid error');
          res.status(500).json({ 
            message: "Failed to send card ready notification - email service error",
            error: "SendGrid may have exceeded its credit limit or configuration issue"
          });
        }
      } catch (emailError) {
        console.error('Failed to send card ready notification email:', emailError);
        res.status(500).json({ message: "Failed to send card ready notification" });
      }

    } catch (error: any) {
      res.status(500).json({ message: "Error sending card ready notification: " + error.message });
    }
  });


  app.post("/api/send-shipping-notification", async (req, res) => {
    try {
      const { orderId, trackingNumber } = req.body;

      if (!orderId || !trackingNumber) {
        return res.status(400).json({ message: "Order ID and tracking number are required" });
      }

      const order = await storage.getOrder(parseInt(orderId));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Update order with tracking number
      const updatedOrder = await storage.updateOrder(order.id, {
        orderStatus: 'shipped',
        trackingNumber
      });

      // Send shipping notification email
      try {
        const emailParams = generateShippingNotificationEmail(order, trackingNumber);
        await sendEmail(emailParams);
        console.log('Shipping notification email sent successfully');

        res.json({
          ...updatedOrder,
          message: 'Shipping notification sent successfully'
        });
      } catch (emailError) {
        console.error('Failed to send shipping notification email:', emailError);
        res.status(500).json({ message: "Failed to send shipping notification" });
      }

    } catch (error: any) {
      res.status(500).json({ message: "Error sending shipping notification: " + error.message });
    }
  });


  app.post("/api/track-abandonment", async (req, res) => {
    try {
      const { cardId, userEmail, userName, stepData, stage } = req.body;
      
      console.log(`Tracking abandonment for card ${cardId}, stage: ${stage}`);
      
      // Update card with abandonment tracking data
      const card = await storage.getCard(cardId);
      if (card) {
        await storage.updateCard(cardId, {
          abandonmentData: JSON.stringify({
            userEmail,
            userName,
            stepData,
            stage,
            lastActivity: Date.now()
          })
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
      if (new Date(card.createdAt).getTime() < sevenDaysAgo) {
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


  app.post("/api/send-abandonment-email", async (req, res) => {
    try {
      const { cardId, userEmail, userName } = req.body;
      
      if (!userEmail || !cardId) {
        return res.status(400).json({ error: 'Card ID and email are required' });
      }
      
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }
      
      // Generate recovery token
      const recoveryToken = `${cardId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const recoveryUrl = `${req.protocol}://${req.get('host')}/api/recover/${recoveryToken}`;
      
      // Send abandonment recovery email
      const emailParams = generateAbandonmentRecoveryEmail(
        card,
        userEmail,
        userName || 'Friend',
        recoveryUrl
      );
      
      const emailSent = await sendEmail(emailParams);
      
      if (emailSent) {
        // Update card with recovery info
        await storage.updateCard(cardId, {
          recoveryEmailSent: new Date().toISOString(),
          recoveryToken
        });
        
        res.json({ 
          success: true, 
          message: 'Recovery email sent successfully',
          recoveryUrl 
        });
      } else {
        res.status(500).json({ error: 'Failed to send recovery email' });
      }
      
    } catch (error) {
      console.error('Error sending abandonment email:', error);
      res.status(500).json({ error: 'Failed to send abandonment email' });
    }
  });

}
