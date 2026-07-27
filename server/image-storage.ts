import { promises as fs } from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { isR2Enabled, r2Put, r2Get, r2Copy, r2PublicUrl, r2DeleteByPrefix } from './r2-storage';

const IMAGES_DIR = path.join(process.cwd(), 'stored_images');
const TEMP_DIR = path.join(process.cwd(), 'temp_images');

/**
 * Browser-facing URL for a stored image. Accepts a bare filename, a
 * legacy `/images/<name>` path, or an already-absolute http(s)/data URL.
 *   • R2 enabled  → the Cloudflare public bucket URL (CDN-cached)
 *   • R2 disabled → the local `/images/<name>` path (served by Express)
 * This is the single source of truth for image URLs — every site that
 * used to hand-build `/images/${x}` should call this so the same code
 * works in both modes.
 */
export function publicImageUrl(pathOrName: string): string {
  if (!pathOrName) return pathOrName;
  if (/^(https?:|data:)/i.test(pathOrName)) return pathOrName;
  const name = pathOrName.startsWith('/images/')
    ? pathOrName.slice('/images/'.length)
    : pathOrName;
  return isR2Enabled() ? r2PublicUrl(name) : `/images/${name}`;
}

/**
 * Resolve a card image's browser URL from its (path, legacy-url) column
 * pair — path preferred, BOTH mapped through publicImageUrl. The legacy
 * fallback previously passed the raw stored URL straight through, so
 * pre-R2 rows handed clients literal '/images/<name>' paths. On
 * ephemeral-disk hosts the local file is gone; the /images route's R2
 * fallback rescues plain <img> loads, but CORS-mode loads (three.js
 * textures, crossOrigin='anonymous') reject cross-origin REDIRECTS —
 * that's the card-234 "3D view couldn't load" bug (2026-07-04). Mapping
 * the legacy URL through publicImageUrl hands the client the direct R2
 * URL instead, which CORS-loads fine. Absolute http(s)/data URLs still
 * pass through untouched.
 */
export function resolveStoredImageUrl(
  path: string | null | undefined,
  url: string | null | undefined,
): string | null {
  const src = path || url;
  return src ? publicImageUrl(src) : null;
}

/**
 * Base stem for a card's image object keys. With an imageKey (the stable
 * per-card random secret on cards.imageKey) the stem is
 * `card_<id>_<imageKey>` — so the public-bucket keys can't be enumerated
 * from the sequential card id (security audit 2026-07-02). Legacy rows
 * with no imageKey fall back to the old `card_<id>` stem so their already-
 * stored URLs keep resolving.
 *
 * Callers append the side/format: `${cardImageBaseName(id, key)}_front.png`.
 */
export function cardImageBaseName(
  cardId: number,
  imageKey?: string | null,
): string {
  return imageKey ? `card_${cardId}_${imageKey}` : `card_${cardId}`;
}

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(IMAGES_DIR, { recursive: true });
    await fs.mkdir(TEMP_DIR, { recursive: true });
    console.log('Image storage directories ready:', { IMAGES_DIR, TEMP_DIR });
  } catch (error) {
    console.error('Failed to create image directories:', error);
  }
}

// Initialize directories on module load
ensureDirectories();

export interface StoredImage {
  filename: string;
  filepath: string;
  size: number;
  format: 'png' | 'jpg' | 'pdf';
}

/**
 * Convert base64 image data to PNG file and store it
 */
/**
 * Write a display-only WebP sibling next to a just-stored PNG.
 *
 * WHY: the model returns ~1.7MB PNGs. Print NEEDS the PNG (Prodigi asset,
 * lossless) — this never touches it. But the on-screen 3D viewer was
 * downloading both PNGs (~3.4MB) and uploading them as WebGL textures,
 * which is the "slow load after generation" beat. A q80 WebP of the same
 * image is ~5–9x smaller, so the viewer loads near-instantly.
 *
 * BEST-EFFORT BY DESIGN: wrapped so a WebP failure can NEVER break the PNG
 * store or the generation flow — if it throws, we log and move on, and the
 * viewer just falls back to the PNG. No upscale (source is already ~1024px)
 * so this is a cheap encode, not the memory-heavy print-res resize that
 * OOMs small instances.
 *
 * Naming convention: `<base>_front.png` → `<base>_front.webp`. The viewer
 * derives the WebP URL by the same swap (card-3d-viewer.tsx).
 */
async function storeDisplayWebpSibling(
  pngFilename: string,
  imageBuffer: Buffer,
): Promise<void> {
  if (!pngFilename.endsWith('.png')) return;
  const webpFilename = pngFilename.replace(/\.png$/, '.webp');
  try {
    const { default: sharp } = await import('sharp');
    const webp = await sharp(imageBuffer).webp({ quality: 80 }).toBuffer();
    if (isR2Enabled()) {
      await r2Put(webpFilename, webp, 'image/webp');
    } else {
      await fs.writeFile(path.join(IMAGES_DIR, webpFilename), webp);
    }
    console.log(
      `[STORAGE] display webp ${webpFilename} (${webp.length} bytes, ` +
        `${Math.round((1 - webp.length / imageBuffer.length) * 100)}% smaller than png)`,
    );
  } catch (err) {
    // Never fatal — the viewer falls back to the PNG.
    console.warn(`[STORAGE] display webp skipped for ${pngFilename}:`, (err as Error)?.message ?? err);
  }
}

export async function storeImageFromBase64(
  base64Data: string,
  cardId: number,
  imageType: 'front' | 'inside',
  imageKey?: string | null,
): Promise<StoredImage> {
  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    // Generate filename with card ID + unguessable key + type
    const filename = `${cardImageBaseName(cardId, imageKey)}_${imageType}.png`;

    if (isR2Enabled()) {
      await r2Put(filename, imageBuffer, 'image/png');
      console.log(`[STORAGE] Stored ${imageType} image for card ${cardId} → R2: ${filename} (${imageBuffer.length} bytes)`);
      await storeDisplayWebpSibling(filename, imageBuffer);
      return { filename, filepath: filename, size: imageBuffer.length, format: 'png' };
    }

    const filepath = path.join(IMAGES_DIR, filename);

    // Write PNG file to disk
    await fs.writeFile(filepath, imageBuffer);

    const stats = await fs.stat(filepath);

    console.log(`[STORAGE] Stored ${imageType} image for card ${cardId}: ${filename} (${stats.size} bytes)`);

    await storeDisplayWebpSibling(filename, imageBuffer);

    return {
      filename,
      filepath,
      size: stats.size,
      format: 'png'
    };
  } catch (error) {
    console.error(`Failed to store ${imageType} image for card ${cardId}:`, error);
    throw error;
  }
}

/**
 * Read a stored_images-relative file (e.g. a reference photo at
 * `photos/<userId>/original_<id>.jpg`): local disk first, R2 fallback.
 *
 * Why (audit 2026-07-27, P0-1): photo uploads are mirrored to R2 under
 * the SAME relative key, but Render's local disk is wiped on every
 * deploy — so any generation resuming a draft after a deploy used to
 * ENOENT on fs.readFile and fail forever. On an R2 hit the bytes are
 * re-cached locally (best-effort) so subsequent reads in this process
 * are fast again. Returns null only when BOTH stores miss.
 */
export async function loadStoredFileBuffer(relPath: string): Promise<Buffer | null> {
  const abs = path.join(process.cwd(), 'stored_images', relPath);
  try {
    return await fs.readFile(abs);
  } catch {
    /* local miss — fall through to R2 */
  }
  if (!isR2Enabled()) return null;
  try {
    const buf = await r2Get(relPath);
    if (buf) {
      console.log(`[STORAGE] local miss for ${relPath} — recovered from R2 (${buf.length} bytes)`);
      // Re-cache locally so the rest of this generation (and process
      // lifetime) reads from disk. Best-effort.
      try {
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, buf);
      } catch {
        /* cache write is best-effort */
      }
    }
    return buf;
  } catch (err: any) {
    console.warn(`[STORAGE] R2 fallback failed for ${relPath}:`, err?.message ?? err);
    return null;
  }
}

/**
 * Get stored image as buffer for serving
 */
export async function getStoredImage(cardId: number, imageType: 'front' | 'inside', imageKey?: string | null): Promise<Buffer | null> {
  const filename = `${cardImageBaseName(cardId, imageKey)}_${imageType}.png`;
  try {
    if (isR2Enabled()) {
      return await r2Get(filename);
    }
    const filepath = path.join(IMAGES_DIR, filename);
    const imageBuffer = await fs.readFile(filepath);
    console.log(`[STORAGE] Retrieved ${imageType} image for card ${cardId}: ${imageBuffer.length} bytes`);
    return imageBuffer;
  } catch (error) {
    console.log(`[STORAGE] Image not found: ${filename}`);
    return null;
  }
}

/**
 * Generate PDF version of card for printing
 */
export async function generateCardPDF(
  cardId: number,
  options: {
    includeInside?: boolean;
    paperSize?: 'A4' | 'Letter' | '5x5';
  } = {}
): Promise<StoredImage> {
  try {
    const { includeInside = true, paperSize = '5x5' } = options;
    
    // Load front image
    const frontImagePath = path.join(IMAGES_DIR, `card_${cardId}_front.png`);
    const frontImage = await loadImage(frontImagePath);
    
    // Set canvas dimensions based on paper size
    let canvasWidth = 360; // 5 inches at 72 DPI
    let canvasHeight = 360;
    
    if (paperSize === 'A4') {
      canvasWidth = 595; // A4 width in points
      canvasHeight = 842; // A4 height in points
    } else if (paperSize === 'Letter') {
      canvasWidth = 612; // Letter width in points
      canvasHeight = 792; // Letter height in points
    }
    
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    
    // Fill white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    if (includeInside) {
      // Two-page layout: front and inside side by side
      const pageWidth = canvasWidth / 2;
      
      // Draw front image on left side
      ctx.drawImage(frontImage, 0, 0, pageWidth, canvasHeight);
      
      // Try to load and draw inside image on right side
      try {
        const insideImagePath = path.join(IMAGES_DIR, `card_${cardId}_inside.png`);
        const insideImage = await loadImage(insideImagePath);
        ctx.drawImage(insideImage, pageWidth, 0, pageWidth, canvasHeight);
      } catch (error) {
        console.log('Inside image not found, using front image only');
      }
    } else {
      // Single page: just front image
      ctx.drawImage(frontImage, 0, 0, canvasWidth, canvasHeight);
    }
    
    // Convert canvas to PNG buffer (PDFs would require additional library)
    const buffer = canvas.toBuffer('image/png');
    
    // Save print-ready file
    const filename = `card_${cardId}_print_${paperSize.toLowerCase()}.png`;
    const filepath = path.join(IMAGES_DIR, filename);
    
    await fs.writeFile(filepath, buffer);
    
    console.log(`[PDF] Generated print-ready file for card ${cardId}: ${filename} (${buffer.length} bytes)`);
    
    return {
      filename,
      filepath,
      size: buffer.length,
      format: 'png'
    };
  } catch (error) {
    console.error(`Failed to generate PDF for card ${cardId}:`, error);
    throw error;
  }
}

export interface CleanupConfig {
  retentionDays: number;
  preservePaidCards: boolean;
  preserveRecentOrders: boolean;
  dryRun: boolean;
}

/**
 * Clean up old image files with configurable retention policy
 */
export async function cleanupOldImages(config: CleanupConfig = {
  retentionDays: 90,
  preservePaidCards: true,
  preserveRecentOrders: true,
  dryRun: false
}): Promise<{ deleted: number; preserved: number; size: number }> {
  
  console.log(`[CLEANUP] Starting image cleanup (${config.dryRun ? 'DRY RUN' : 'LIVE'})`, config);
  
  try {
    const results = { deleted: 0, preserved: 0, size: 0 };
    const cutoffDate = Date.now() - (config.retentionDays * 24 * 60 * 60 * 1000);
    
    // Process stored images
    const imageFiles = await fs.readdir(IMAGES_DIR);
    for (const file of imageFiles) {
      const result = await processFileForCleanup(IMAGES_DIR, file, cutoffDate, config);
      results.deleted += result.deleted;
      results.preserved += result.preserved;
      results.size += result.size;
    }
    
    // Process print files
    try {
      const printFiles = await fs.readdir(path.join(process.cwd(), 'print_files'));
      for (const file of printFiles) {
        const result = await processFileForCleanup(path.join(process.cwd(), 'print_files'), file, cutoffDate, config);
        results.deleted += result.deleted;
        results.preserved += result.preserved;
        results.size += result.size;
      }
    } catch (error) {
      console.log('[CLEANUP] Print files directory not found, skipping');
    }
    
    console.log(`[CLEANUP] Completed: ${results.deleted} deleted, ${results.preserved} preserved, ${(results.size / 1024 / 1024).toFixed(2)}MB freed`);
    return results;
    
  } catch (error) {
    console.error('[CLEANUP] Failed to cleanup images:', error);
    throw error;
  }
}

async function processFileForCleanup(
  directory: string, 
  file: string, 
  cutoffDate: number, 
  config: CleanupConfig
): Promise<{ deleted: number; preserved: number; size: number }> {
  
  const filepath = path.join(directory, file);
  const stats = await fs.stat(filepath);
  const fileAge = Date.now() - stats.mtime.getTime();
  const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
  
  // Skip if file is newer than retention period
  if (stats.mtime.getTime() > cutoffDate) {
    console.log(`[CLEANUP] Preserving recent file: ${file} (${(fileAge / 24 / 60 / 60 / 1000).toFixed(1)} days old)`);
    return { deleted: 0, preserved: 1, size: 0 };
  }
  
  // Extract card ID from filename
  const cardIdMatch = file.match(/card_(\d+)_/);
  const cardId = cardIdMatch ? parseInt(cardIdMatch[1]) : null;
  
  // Check preservation rules
  if (cardId && config.preservePaidCards) {
    const shouldPreserve = await shouldPreserveCard(cardId);
    if (shouldPreserve) {
      console.log(`[CLEANUP] Preserving paid card: ${file} (card ${cardId})`);
      return { deleted: 0, preserved: 1, size: 0 };
    }
  }
  
  // Delete the file
  if (!config.dryRun) {
    await fs.unlink(filepath);
  }
  
  console.log(`[CLEANUP] ${config.dryRun ? 'Would delete' : 'Deleted'}: ${file} (${fileSizeMB}MB, ${(fileAge / 24 / 60 / 60 / 1000).toFixed(1)} days old)`);
  return { deleted: 1, preserved: 0, size: stats.size };
}

async function shouldPreserveCard(cardId: number): Promise<boolean> {
  try {
    // This would integrate with your storage system to check if card has been paid for
    // For now, return false to allow cleanup
    // TODO: Integrate with storage.getCard() and check order status
    return false;
  } catch (error) {
    console.error(`[CLEANUP] Error checking card ${cardId} preservation status:`, error);
    return true; // Preserve on error to be safe
  }
}

/**
 * Schedule automatic cleanup to run daily
 */
export function scheduleAutomaticCleanup(config: CleanupConfig): NodeJS.Timeout {
  const DAILY_MS = 24 * 60 * 60 * 1000;
  
  console.log(`[CLEANUP] Scheduling automatic cleanup every 24 hours with ${config.retentionDays} day retention`);
  
  return setInterval(async () => {
    try {
      console.log('[CLEANUP] Running scheduled cleanup...');
      await cleanupOldImages(config);
    } catch (error) {
      console.error('[CLEANUP] Scheduled cleanup failed:', error);
    }
  }, DAILY_MS);
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  totalFiles: number;
  totalSize: number;
  oldestFile: Date | null;
  newestFile: Date | null;
  avgFileSize: number;
}> {
  try {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      oldestFile: null as Date | null,
      newestFile: null as Date | null,
      avgFileSize: 0
    };
    
    const directories = [IMAGES_DIR, path.join(process.cwd(), 'print_files')];
    
    for (const dir of directories) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          const filepath = path.join(dir, file);
          const fileStat = await fs.stat(filepath);
          
          stats.totalFiles++;
          stats.totalSize += fileStat.size;
          
          if (!stats.oldestFile || fileStat.mtime < stats.oldestFile) {
            stats.oldestFile = fileStat.mtime;
          }
          
          if (!stats.newestFile || fileStat.mtime > stats.newestFile) {
            stats.newestFile = fileStat.mtime;
          }
        }
      } catch (error) {
        console.log(`[STATS] Directory ${dir} not accessible, skipping`);
      }
    }
    
    stats.avgFileSize = stats.totalFiles > 0 ? stats.totalSize / stats.totalFiles : 0;
    
    return stats;
  } catch (error) {
    console.error('[STATS] Failed to get storage stats:', error);
    throw error;
  }
}

/**
 * Get file URL for serving static images
 */
export function getImageUrl(cardId: number, imageType: 'front' | 'inside' | 'print', imageKey?: string | null): string {
  const base = cardImageBaseName(cardId, imageKey);
  const filename = imageType === 'print'
    ? `${base}_print_5x5.png`
    : `${base}_${imageType}.png`;

  return publicImageUrl(filename);
}

/**
 * Check if image file exists
 */
export async function imageExists(cardId: number, imageType: 'front' | 'inside'): Promise<boolean> {
  try {
    const filename = `card_${cardId}_${imageType}.png`;
    const filepath = path.join(IMAGES_DIR, filename);
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Store a base64 image as a PNG, piped through sharp for optimal
 * compression. Distinct from `storeImageFromBase64` which writes the
 * raw buffer — this one does a sharp encode pass, useful for the
 * print-resolution upscale path where compression actually matters.
 *
 * (Previously named `storeUnwatermarkedPngFile` — renamed 2026-05-12
 * after the watermarking system was removed. There was never any
 * actual watermarking, just the misleading filename suffix.)
 */
export async function storePngWithSharp(
  base64Data: string,
  cardId: number,
  imageType: string,
  imageKey?: string | null,
): Promise<StoredImage> {
  try {
    const { default: sharp } = await import('sharp');
    
    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    
    // Convert to PNG format using Sharp for optimal compression
    const pngBuffer = await sharp(imageBuffer)
      .png({ 
        compressionLevel: 6, // Balanced compression
        quality: 100,        // Lossless quality
        progressive: false   // Standard PNG
      })
      .toBuffer();
    
    // Generate filename
    const filename = `${cardImageBaseName(cardId, imageKey)}_${imageType}.png`;

    if (isR2Enabled()) {
      await r2Put(filename, pngBuffer, 'image/png');
      console.log(`[PNG_STORAGE] Stored sharp-processed PNG for card ${cardId} → R2: ${filename} (${pngBuffer.length} bytes)`);
      return { filename, filepath: filename, size: pngBuffer.length, format: 'png' };
    }

    const filepath = path.join(IMAGES_DIR, filename);

    // Write PNG file to disk
    await fs.writeFile(filepath, pngBuffer);

    const stats = await fs.stat(filepath);

    console.log(`[PNG_STORAGE] Stored sharp-processed PNG for card ${cardId}: ${filename} (${stats.size} bytes)`);

    return {
      filename,
      filepath,
      size: stats.size,
      format: 'png'
    };
  } catch (error) {
    console.error(`Failed to store sharp-processed PNG for card ${cardId}:`, error);
    throw error;
  }
}

/**
 * Write a base64 PNG to an arbitrary filename in the stored_images dir.
 * Used by the per-attempt save path so each card_attempts row can have
 * its own file (e.g. card_123_front_a4.png) — keeps regen history,
 * gives the browser a unique URL per attempt so cached images don't
 * mask new ones, and lets selectAttempt switch by file copy.
 */
export async function storeImageToCustomFilename(
  base64Data: string,
  filename: string,
): Promise<StoredImage> {
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const imageBuffer = Buffer.from(cleanBase64, 'base64');

  if (isR2Enabled()) {
    await r2Put(filename, imageBuffer, 'image/png');
    console.log(`[STORAGE] Stored ${filename} → R2 (${imageBuffer.length} bytes)`);
    await storeDisplayWebpSibling(filename, imageBuffer);
    return { filename, filepath: filename, size: imageBuffer.length, format: 'png' };
  }

  const filepath = path.join(IMAGES_DIR, filename);
  await fs.writeFile(filepath, imageBuffer);
  const stats = await fs.stat(filepath);
  console.log(`[STORAGE] Stored ${filename} (${stats.size} bytes)`);
  await storeDisplayWebpSibling(filename, imageBuffer);
  return { filename, filepath, size: stats.size, format: 'png' };
}

/**
 * Copy one stored image file to another filename. Used when promoting
 * a per-attempt file to the canonical name on selectAttempt — the
 * canonical name (card_X_front.png) is what print/PDF/fulfillment
 * read, so it has to mirror whichever attempt the user picked.
 *
 * Silently no-ops if the source doesn't exist (legacy cards, partial
 * state on bad rows). Logs but doesn't throw.
 */
export async function copyStoredFile(
  srcFilename: string,
  destFilename: string,
): Promise<boolean> {
  try {
    if (isR2Enabled()) {
      const ok = await r2Copy(srcFilename, destFilename);
      if (ok) console.log(`[STORAGE] Copied ${srcFilename} → ${destFilename} (R2)`);
      return ok;
    }
    const src = path.join(IMAGES_DIR, srcFilename);
    const dest = path.join(IMAGES_DIR, destFilename);
    await fs.copyFile(src, dest);
    console.log(`[STORAGE] Copied ${srcFilename} → ${destFilename}`);
    return true;
  } catch (err: any) {
    console.warn(
      `[STORAGE] Could not copy ${srcFilename} → ${destFilename}: ${err?.message ?? err}`,
    );
    return false;
  }
}

/**
 * Delete EVERY stored image belonging to a card — the canonical
 * front/inside/print files AND all per-attempt regen files
 * (`card_<id>_front_aN.png`, etc.) — from wherever they actually live
 * (R2 when enabled, otherwise local disk + print/temp dirs).
 *
 * Keys/filenames are matched on the `card_<id>_` prefix; the trailing
 * underscore keeps card 2 from also matching card 20/234.
 *
 * This is the storage half of "right to erasure": when a card is
 * deleted, its images must not linger in the bucket. Best-effort — a
 * missing file or storage hiccup must never block the DB delete — so it
 * swallows errors and returns the count removed.
 */
export async function deleteCardImages(cardId: number): Promise<number> {
  const prefix = `card_${cardId}_`;
  try {
    if (isR2Enabled()) {
      return await r2DeleteByPrefix(prefix);
    }
    let removed = 0;
    const dirs = [IMAGES_DIR, TEMP_DIR, path.join(process.cwd(), 'print_files')];
    for (const dir of dirs) {
      let files: string[];
      try {
        files = await fs.readdir(dir);
      } catch {
        continue; // dir may not exist in this environment
      }
      for (const file of files) {
        if (file.startsWith(prefix)) {
          await fs.unlink(path.join(dir, file)).catch(() => {});
          removed++;
        }
      }
    }
    return removed;
  } catch (err) {
    console.error(`[STORAGE] deleteCardImages(${cardId}) failed:`, err);
    return 0;
  }
}

// hasUnwatermarkedFiles removed 2026-05-12 along with the rest of the
// vestigial watermarking pipeline — was unreferenced.