/**
 * Watermark removal system for background processing
 * This ensures the same images are preserved from interactive generation
 * but with watermarks removed for email notifications
 */

import { storage } from "./storage";
import { hasUnwatermarkedFiles, getUnwatermarkedImageUrl } from "./image-storage";

export interface WatermarkRemovalResult {
  frontImageUrl: string;
  insideImageUrl?: string;
}

/**
 * Remove watermarks from existing card images by switching to unwatermarked PNG files
 * PNG-ONLY WORKFLOW: Uses unwatermarked PNG files created during generation
 */
export async function removeWatermarksFromCard(
  cardId: number
): Promise<WatermarkRemovalResult> {
  try {
    console.log(`[WATERMARK_REMOVAL] Starting PNG-only watermark removal for card ${cardId}`);

    const card = await storage.getCard(cardId);
    if (!card) {
      throw new Error(`Card ${cardId} not found`);
    }

    // Check if unwatermarked PNG files exist (new PNG-only workflow)
    const fs = await import('fs');
    const path = await import('path');
    
    const frontUnwatermarkedPath = path.join(process.cwd(), 'stored_images', `card_${cardId}_front_unwatermarked.png`);
    const insideUnwatermarkedPath = path.join(process.cwd(), 'stored_images', `card_${cardId}_inside_unwatermarked.png`);
    
    const frontExists = await fs.promises.access(frontUnwatermarkedPath).then(() => true).catch(() => false);
    const insideExists = await fs.promises.access(insideUnwatermarkedPath).then(() => true).catch(() => false);
    
    if (!frontExists) {
      throw new Error(`No unwatermarked front PNG file found for card ${cardId}`);
    }

    // Generate URLs for unwatermarked PNG files (PNG-only workflow)
    const frontImageUrl = `/images/card_${cardId}_front_unwatermarked.png`;
    const insideImageUrl = insideExists ? `/images/card_${cardId}_inside_unwatermarked.png` : null;

    // Update card to use unwatermarked PNG files
    await storage.updateCard(cardId, {
      frontImageUrl: frontImageUrl,
      insideImageUrl: insideImageUrl || card.insideImageUrl
    });

    console.log(`[WATERMARK_REMOVAL] Watermarks removed for card ${cardId} using PNG-only workflow`);
    console.log(`[WATERMARK_REMOVAL] Front PNG: ${frontImageUrl}, Inside PNG: ${insideImageUrl || 'N/A'}`);

    return {
      frontImageUrl: frontImageUrl,
      insideImageUrl: insideImageUrl || ''
    };
  } catch (error: any) {
    console.error(`[WATERMARK_REMOVAL] Error removing watermarks for card ${cardId}:`, error);
    throw error;
  }
}

/**
 * Get original unwatermarked images from card's conversationData
 */
export function getOriginalImagesFromCard(card: any): WatermarkRemovalResult {
  const conversationData = card.conversationData || {};
  
  // Check if original images are stored in conversationData
  const originalFront = conversationData.originalFrontImage || card.frontImageUrl;
  const originalInside = conversationData.originalInsideImage || card.insideImageUrl;
  
  return {
    frontImageUrl: originalFront,
    insideImageUrl: originalInside
  };
}