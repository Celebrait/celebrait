// Local file-system storage operations extracted from background-generator.ts (Phase 1, Step 4).
// Wraps image-storage.ts functions. No orchestration, prompts, DB, or email logic lives here.

import {
  storeImageFromBase64,
  storeUnwatermarkedImage,
  getImageUrl,
  getStoredImage,
  storeUnwatermarkedPngFile
} from '../../image-storage';

/**
 * Save a generated image as both display and unwatermarked copy.
 * Returns the stored URL for display and the original base64/URL.
 * Falls back to the raw imageUrl on failure (non-fatal).
 */
export async function savePngFiles(
  imageUrl: string,
  cardId: number,
  prefix: 'front' | 'inside'
): Promise<{ watermarked: string; original: string }> {
  try {
    // Save clean image as both display and unwatermarked — no watermarking, digital cards are free
    await Promise.all([
      storeImageFromBase64(imageUrl, cardId, prefix),
      storeUnwatermarkedImage(imageUrl, cardId, prefix)
    ]);
    const storedUrl = getImageUrl(cardId, prefix);
    return { watermarked: storedUrl, original: imageUrl };
  } catch (err) {
    console.error(`[BG_GEN] PNG save failed for ${prefix}, using base64 fallback:`, err);
    return { watermarked: imageUrl, original: imageUrl };
  }
}

/**
 * Load a stored image back as a base64 data URL.
 * If storedUrl is a /images/ path, reads from the stored_images directory.
 * Otherwise returns the input unchanged (already a data URL).
 */
export async function loadStoredImageAsBase64(storedUrl: string): Promise<string> {
  if (storedUrl.startsWith('/images/')) {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'stored_images', storedUrl.replace('/images/', ''));
    const fileBuffer = await fs.promises.readFile(filePath);
    return `data:image/png;base64,${fileBuffer.toString('base64')}`;
  }
  return storedUrl;
}

/**
 * Generate 3000×3000 Lanczos3 print-resolution upscales of stored card images.
 * Non-fatal: logs errors but does not throw, so main generation always succeeds.
 */
export async function generatePrintResolutionFiles(cardId: number): Promise<void> {
  try {
    const sharp = (await import('sharp')).default;

    const frontBuffer = await getStoredImage(cardId, 'front');
    if (frontBuffer) {
      const frontPrintBuffer = await sharp(frontBuffer)
        .resize(3000, 3000, { kernel: sharp.kernel.lanczos3, fit: 'inside', withoutEnlargement: false })
        .png({ compressionLevel: 6 })
        .toBuffer();
      const frontPrintBase64 = `data:image/png;base64,${frontPrintBuffer.toString('base64')}`;
      await storeUnwatermarkedPngFile(frontPrintBase64, cardId, 'front_print');
      console.log(`[BG_GEN] Print-resolution front image saved for card ${cardId} (${frontPrintBuffer.length} bytes)`);
    }

    const insideBuffer = await getStoredImage(cardId, 'inside');
    if (insideBuffer) {
      const insidePrintBuffer = await sharp(insideBuffer)
        .resize(3000, 3000, { kernel: sharp.kernel.lanczos3, fit: 'inside', withoutEnlargement: false })
        .png({ compressionLevel: 6 })
        .toBuffer();
      const insidePrintBase64 = `data:image/png;base64,${insidePrintBuffer.toString('base64')}`;
      await storeUnwatermarkedPngFile(insidePrintBase64, cardId, 'inside_print');
      console.log(`[BG_GEN] Print-resolution inside image saved for card ${cardId} (${insidePrintBuffer.length} bytes)`);
    }
  } catch (printErr: any) {
    console.error(`[BG_GEN] Print-resolution upscaling failed for card ${cardId} (non-fatal):`, printErr.message);
  }
}
