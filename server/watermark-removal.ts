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
 */
export async function removeWatermarksFromCard(
  cardId: number
): Promise<WatermarkRemovalResult> {
  try {
    console.log(`[WATERMARK_REMOVAL] Starting PNG-based watermark removal for card ${cardId}`);

    const card = await storage.getCard(cardId);
    if (!card) {
      throw new Error(`Card ${cardId} not found`);
    }

    // Check if unwatermarked PNG files exist
    const unwatermarkedFiles = await hasUnwatermarkedFiles(cardId);
    
    if (!unwatermarkedFiles.front) {
      throw new Error(`No unwatermarked front image found for card ${cardId}`);
    }

    // Generate URLs for unwatermarked PNG files
    const frontImageUrl = getUnwatermarkedImageUrl(cardId, 'front');
    const insideImageUrl = unwatermarkedFiles.inside ? getUnwatermarkedImageUrl(cardId, 'inside') : null;

    // Update card to use unwatermarked PNG files
    await storage.updateCard(cardId, {
      frontImageUrl: frontImageUrl,
      insideImageUrl: insideImageUrl || card.insideImageUrl
    });

    console.log(`[WATERMARK_REMOVAL] Watermarks removed for card ${cardId} using PNG files`);

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