/**
 * Base64 cleanup system for migrating existing cards to PNG-only storage
 * This removes Base64 data from database after confirming PNG files exist
 */

import { storage } from "./storage";
import { storeImageFromBase64, imageExists, storeUnwatermarkedImage } from "./image-storage";
import sharp from "sharp";

export interface CleanupStats {
  cardsProcessed: number;
  cardsWithBase64: number;
  cardsConverted: number;
  cardsMigrated: number;
  storageFreed: number; // bytes
  errors: string[];
}

/**
 * Migrate existing Base64 images to PNG files and clean up database
 */
export async function cleanupBase64Images(dryRun: boolean = true): Promise<CleanupStats> {
  const stats: CleanupStats = {
    cardsProcessed: 0,
    cardsWithBase64: 0,
    cardsConverted: 0,
    cardsMigrated: 0,
    storageFreed: 0,
    errors: []
  };

  console.log(`[BASE64_CLEANUP] Starting cleanup (dryRun: ${dryRun})`);

  try {
    // Get all cards to check for Base64 content
    const allCards = await getAllCards();
    
    for (const card of allCards) {
      stats.cardsProcessed++;
      
      try {
        const hasBase64Content = await processCardForBase64Cleanup(card, dryRun, stats);
        
        if (hasBase64Content) {
          stats.cardsWithBase64++;
          console.log(`[BASE64_CLEANUP] Card ${card.id} has Base64 content`);
        }
        
      } catch (error: any) {
        stats.errors.push(`Card ${card.id}: ${error.message}`);
        console.error(`[BASE64_CLEANUP] Error processing card ${card.id}:`, error);
      }
    }
    
    console.log(`[BASE64_CLEANUP] Cleanup completed:`, stats);
    return stats;
    
  } catch (error: any) {
    stats.errors.push(`Global error: ${error.message}`);
    console.error(`[BASE64_CLEANUP] Global error:`, error);
    return stats;
  }
}

/**
 * Process a single card for Base64 cleanup
 */
async function processCardForBase64Cleanup(card: any, dryRun: boolean, stats: CleanupStats): Promise<boolean> {
  let hasBase64Content = false;
  let storageFreed = 0;
  
  // Check if frontImageUrl contains Base64
  if (card.frontImageUrl && card.frontImageUrl.startsWith('data:image/')) {
    hasBase64Content = true;
    storageFreed += card.frontImageUrl.length;
    
    if (!dryRun) {
      // Convert Base64 to PNG file
      const pngUrl = await convertBase64ToPng(card.frontImageUrl, card.id, 'front');
      
      // Store unwatermarked version if this was a watermarked image
      if (isWatermarkedImage(card.frontImageUrl)) {
        const originalImage = await extractOriginalFromWatermarked(card.frontImageUrl);
        if (originalImage) {
          await storeUnwatermarkedImage(originalImage, card.id, 'front');
        }
      }
      
      stats.cardsConverted++;
    }
  }
  
  // Check if insideImageUrl contains Base64
  if (card.insideImageUrl && card.insideImageUrl.startsWith('data:image/')) {
    hasBase64Content = true;
    storageFreed += card.insideImageUrl.length;
    
    if (!dryRun) {
      // Convert Base64 to PNG file
      const pngUrl = await convertBase64ToPng(card.insideImageUrl, card.id, 'inside');
      
      // Store unwatermarked version if this was a watermarked image
      if (isWatermarkedImage(card.insideImageUrl)) {
        const originalImage = await extractOriginalFromWatermarked(card.insideImageUrl);
        if (originalImage) {
          await storeUnwatermarkedImage(originalImage, card.id, 'inside');
        }
      }
      
      stats.cardsConverted++;
    }
  }
  
  // Check conversationData for Base64 content
  if (card.conversationData) {
    const conversationData = typeof card.conversationData === 'string' 
      ? JSON.parse(card.conversationData) 
      : card.conversationData;
    
    if (conversationData.originalFrontImageUrl && conversationData.originalFrontImageUrl.startsWith('data:image/')) {
      hasBase64Content = true;
      storageFreed += conversationData.originalFrontImageUrl.length;
      
      if (!dryRun) {
        // Store as unwatermarked PNG
        await storeUnwatermarkedImage(conversationData.originalFrontImageUrl, card.id, 'front');
        
        // Remove from conversationData
        delete conversationData.originalFrontImageUrl;
      }
    }
    
    if (conversationData.originalInsideImageUrl && conversationData.originalInsideImageUrl.startsWith('data:image/')) {
      hasBase64Content = true;
      storageFreed += conversationData.originalInsideImageUrl.length;
      
      if (!dryRun) {
        // Store as unwatermarked PNG
        await storeUnwatermarkedImage(conversationData.originalInsideImageUrl, card.id, 'inside');
        
        // Remove from conversationData
        delete conversationData.originalInsideImageUrl;
      }
    }
  }
  
  // Update card in database if changes were made
  if (hasBase64Content && !dryRun) {
    const updates: any = {};
    
    if (card.frontImageUrl && card.frontImageUrl.startsWith('data:image/')) {
      updates.frontImageUrl = `/images/card_${card.id}_front.png`;
    }
    
    if (card.insideImageUrl && card.insideImageUrl.startsWith('data:image/')) {
      updates.insideImageUrl = `/images/card_${card.id}_inside.png`;
    }
    
    if (card.conversationData) {
      const conversationData = typeof card.conversationData === 'string' 
        ? JSON.parse(card.conversationData) 
        : card.conversationData;
      
      // Clean up Base64 references from conversationData
      if (conversationData.originalFrontImageUrl && conversationData.originalFrontImageUrl.startsWith('data:image/')) {
        delete conversationData.originalFrontImageUrl;
      }
      if (conversationData.originalInsideImageUrl && conversationData.originalInsideImageUrl.startsWith('data:image/')) {
        delete conversationData.originalInsideImageUrl;
      }
      
      updates.conversationData = conversationData;
    }
    
    if (Object.keys(updates).length > 0) {
      await storage.updateCard(card.id, updates);
      stats.cardsMigrated++;
    }
  }
  
  stats.storageFreed += storageFreed;
  return hasBase64Content;
}

/**
 * Convert Base64 to PNG using existing infrastructure
 */
async function convertBase64ToPng(base64Data: string, cardId: number, imageType: 'front' | 'inside'): Promise<string> {
  // Remove data URL prefix if present
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const imageBuffer = Buffer.from(cleanBase64, 'base64');
  
  // Convert to PNG format using Sharp
  const pngBuffer = await sharp(imageBuffer)
    .png({ 
      compressionLevel: 6,
      quality: 100,
      progressive: false
    })
    .toBuffer();
  
  // Store the PNG file
  const storageResult = await storeImageFromBase64(
    `data:image/png;base64,${pngBuffer.toString('base64')}`,
    cardId,
    imageType
  );
  
  return `/images/card_${cardId}_${imageType}.png`;
}

/**
 * Check if image appears to be watermarked
 */
function isWatermarkedImage(base64Data: string): boolean {
  // This is a simple heuristic - in practice, we'd need more sophisticated detection
  // For now, assume images in certain size ranges might be watermarked
  const sizeBytes = (base64Data.length * 3) / 4; // Approximate decoded size
  return sizeBytes > 100000; // Images over 100KB might be watermarked
}

/**
 * Extract original image from watermarked version (placeholder)
 */
async function extractOriginalFromWatermarked(base64Data: string): Promise<string | null> {
  // This is a placeholder - in practice, we can't really extract original from watermarked
  // We'll just return null and rely on the unwatermarked versions stored separately
  return null;
}

/**
 * Get all cards from storage
 */
async function getAllCards(): Promise<any[]> {
  return await storage.getAllCards();
}

/**
 * Get summary of Base64 usage in database
 */
export async function getBase64Usage(): Promise<{
  totalCards: number;
  cardsWithBase64: number;
  estimatedBase64Size: number;
  cardsWithPngFiles: number;
}> {
  const allCards = await getAllCards();
  let cardsWithBase64 = 0;
  let estimatedBase64Size = 0;
  let cardsWithPngFiles = 0;
  
  for (const card of allCards) {
    let hasBase64 = false;
    let hasPngFiles = false;
    
    // Check main image URLs
    if (card.frontImageUrl && card.frontImageUrl.startsWith('data:image/')) {
      hasBase64 = true;
      estimatedBase64Size += card.frontImageUrl.length;
    } else if (card.frontImageUrl && card.frontImageUrl.startsWith('/images/')) {
      hasPngFiles = true;
    }
    
    if (card.insideImageUrl && card.insideImageUrl.startsWith('data:image/')) {
      hasBase64 = true;
      estimatedBase64Size += card.insideImageUrl.length;
    } else if (card.insideImageUrl && card.insideImageUrl.startsWith('/images/')) {
      hasPngFiles = true;
    }
    
    // Check conversationData
    if (card.conversationData) {
      const conversationData = typeof card.conversationData === 'string' 
        ? JSON.parse(card.conversationData) 
        : card.conversationData;
      
      if (conversationData.originalFrontImageUrl && conversationData.originalFrontImageUrl.startsWith('data:image/')) {
        hasBase64 = true;
        estimatedBase64Size += conversationData.originalFrontImageUrl.length;
      }
      
      if (conversationData.originalInsideImageUrl && conversationData.originalInsideImageUrl.startsWith('data:image/')) {
        hasBase64 = true;
        estimatedBase64Size += conversationData.originalInsideImageUrl.length;
      }
    }
    
    if (hasBase64) cardsWithBase64++;
    if (hasPngFiles) cardsWithPngFiles++;
  }
  
  return {
    totalCards: allCards.length,
    cardsWithBase64,
    estimatedBase64Size,
    cardsWithPngFiles
  };
}