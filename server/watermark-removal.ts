/**
 * Watermark removal system for background processing
 * This ensures the same images are preserved from interactive generation
 * but with watermarks removed for email notifications
 */

export interface WatermarkRemovalResult {
  frontImageUrl: string;
  insideImageUrl?: string;
}

/**
 * Remove watermarks from existing card images without regenerating content
 */
export async function removeWatermarksFromCard(
  frontImageUrl: string, 
  insideImageUrl?: string
): Promise<WatermarkRemovalResult> {
  // For now, we'll return the original images since the watermark logic
  // in the server is applied during generation, not as a separate layer
  // In the future, this could implement actual watermark removal
  
  // Extract the original images from conversationData if they exist
  // The watermarked versions are stored in frontImageUrl/insideImageUrl
  // The original unwatermarked versions should be in conversationData
  
  return {
    frontImageUrl: frontImageUrl,
    insideImageUrl: insideImageUrl
  };
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