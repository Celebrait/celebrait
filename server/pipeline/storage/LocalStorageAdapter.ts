// Local file-system storage operations extracted from background-generator.ts (Phase 1, Step 4).
// Wraps image-storage.ts functions. No orchestration, prompts, DB, or email logic lives here.
//
// History: until 2026-05-12 every save wrote two identical files per
// image (`card_X_front.png` and `card_X_front_unwatermarked.png`) —
// vestigial from a watermarking system that never shipped. The
// duplicate writes were removed; the public `savePngFiles` return type
// was simplified from `{ watermarked, original }` to a plain string.

import {
  storeImageFromBase64,
  storeImageToCustomFilename,
  copyStoredFile,
  getImageUrl,
  getStoredImage,
  storePngWithSharp,
} from '../../image-storage';

/**
 * Save a generated image to the canonical filename. Returns the
 * stored URL on success; falls back to the raw imageUrl on failure
 * (non-fatal).
 */
export async function savePngFiles(
  imageUrl: string,
  cardId: number,
  prefix: 'front' | 'inside'
): Promise<string> {
  try {
    await storeImageFromBase64(imageUrl, cardId, prefix);
    return getImageUrl(cardId, prefix);
  } catch (err) {
    console.error(`[BG_GEN] PNG save failed for ${prefix}, using base64 fallback:`, err);
    return imageUrl;
  }
}

/**
 * Per-attempt filename helpers. Each card_attempts row gets its own
 * file on disk so:
 *   - the versions strip can show every attempt the user has tried
 *   - selectAttempt can switch back to an old attempt without losing it
 *   - the browser sees a unique URL per attempt and doesn't show a
 *     stale cached image when a new regen lands
 *
 * The canonical filename (card_X_front.png) still exists — it mirrors
 * whichever attempt is currently selected, so PDF / print-resolution
 * upscale / fulfilment consumers keep working unchanged.
 */
export function attemptDisplayFilename(
  cardId: number,
  side: 'front' | 'inside',
  attemptId: number,
): string {
  return `card_${cardId}_${side}_a${attemptId}.png`;
}

function canonicalDisplayFilename(cardId: number, side: 'front' | 'inside'): string {
  return `card_${cardId}_${side}.png`;
}

/**
 * Save a regen result with per-attempt filenames AND mirror to the
 * canonical filename in one go (so on success this attempt is the
 * displayed one without needing an extra file copy).
 *
 * Returns the per-attempt URL — that's what we want to write into
 * cards.frontImagePath / cardAttempts.imagePath, since unique URLs
 * defeat the browser cache that was making 3 regens look identical.
 */
export async function savePngFilesForAttempt(
  imageUrl: string,
  cardId: number,
  side: 'front' | 'inside',
  attemptId: number,
): Promise<{ url: string; attemptFilename: string }> {
  const attemptFilename = attemptDisplayFilename(cardId, side, attemptId);
  const canonical = canonicalDisplayFilename(cardId, side);

  try {
    // Per-attempt files are the source of truth (they survive
    // selectAttempt and aren't overwritten by future regens). The
    // canonical mirror keeps PDF / print / fulfilment readers working
    // by a stable name.
    await Promise.all([
      storeImageToCustomFilename(imageUrl, attemptFilename),
      storeImageToCustomFilename(imageUrl, canonical),
    ]);
    return { url: `/images/${attemptFilename}`, attemptFilename };
  } catch (err) {
    console.error(
      `[BG_GEN] Per-attempt PNG save failed for ${side} a${attemptId}, falling back to base64:`,
      err,
    );
    return { url: imageUrl, attemptFilename };
  }
}

/**
 * Promote a per-attempt file to the canonical filename on selectAttempt.
 * No-op-friendly: returns false if the source file doesn't exist
 * (legacy attempts that never had per-attempt files).
 */
export async function promoteAttemptToCanonical(
  cardId: number,
  side: 'front' | 'inside',
  attemptId: number,
): Promise<boolean> {
  const attemptFilename = attemptDisplayFilename(cardId, side, attemptId);
  const canonical = canonicalDisplayFilename(cardId, side);
  return copyStoredFile(attemptFilename, canonical);
}

/**
 * Snapshot the current canonical file into a per-attempt filename.
 * Used when we lazily synthesise attempt #1 on first regen — the
 * pre-attempts initial generation only wrote a canonical file, so we
 * need to give attempt #1 its own copy or selecting back to it later
 * would silently grab whatever the canonical points at right then
 * (i.e. the wrong attempt).
 */
export async function snapshotCanonicalToAttempt(
  cardId: number,
  side: 'front' | 'inside',
  attemptId: number,
): Promise<string | null> {
  const attemptFilename = attemptDisplayFilename(cardId, side, attemptId);
  const canonical = canonicalDisplayFilename(cardId, side);
  const ok = await copyStoredFile(canonical, attemptFilename);
  return ok ? attemptFilename : null;
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
      await storePngWithSharp(frontPrintBase64, cardId, 'front_print');
      console.log(`[BG_GEN] Print-resolution front image saved for card ${cardId} (${frontPrintBuffer.length} bytes)`);
    }

    const insideBuffer = await getStoredImage(cardId, 'inside');
    if (insideBuffer) {
      const insidePrintBuffer = await sharp(insideBuffer)
        .resize(3000, 3000, { kernel: sharp.kernel.lanczos3, fit: 'inside', withoutEnlargement: false })
        .png({ compressionLevel: 6 })
        .toBuffer();
      const insidePrintBase64 = `data:image/png;base64,${insidePrintBuffer.toString('base64')}`;
      await storePngWithSharp(insidePrintBase64, cardId, 'inside_print');
      console.log(`[BG_GEN] Print-resolution inside image saved for card ${cardId} (${insidePrintBuffer.length} bytes)`);
    }
  } catch (printErr: any) {
    console.error(`[BG_GEN] Print-resolution upscaling failed for card ${cardId} (non-fatal):`, printErr.message);
  }
}
