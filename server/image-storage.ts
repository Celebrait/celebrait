import { promises as fs } from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

const IMAGES_DIR = path.join(process.cwd(), 'stored_images');
const TEMP_DIR = path.join(process.cwd(), 'temp_images');

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
export async function storeImageFromBase64(
  base64Data: string, 
  cardId: number, 
  imageType: 'front' | 'inside'
): Promise<StoredImage> {
  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    
    // Generate filename with card ID and type
    const filename = `card_${cardId}_${imageType}.png`;
    const filepath = path.join(IMAGES_DIR, filename);
    
    // Write PNG file to disk
    await fs.writeFile(filepath, imageBuffer);
    
    const stats = await fs.stat(filepath);
    
    console.log(`[STORAGE] Stored ${imageType} image for card ${cardId}: ${filename} (${stats.size} bytes)`);
    
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
 * Get stored image as buffer for serving
 */
export async function getStoredImage(cardId: number, imageType: 'front' | 'inside'): Promise<Buffer | null> {
  try {
    const filename = `card_${cardId}_${imageType}.png`;
    const filepath = path.join(IMAGES_DIR, filename);
    
    const imageBuffer = await fs.readFile(filepath);
    console.log(`[STORAGE] Retrieved ${imageType} image for card ${cardId}: ${imageBuffer.length} bytes`);
    
    return imageBuffer;
  } catch (error) {
    console.log(`[STORAGE] Image not found: card_${cardId}_${imageType}.png`);
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
export function getImageUrl(cardId: number, imageType: 'front' | 'inside' | 'print'): string {
  const filename = imageType === 'print' 
    ? `card_${cardId}_print_5x5.png`
    : `card_${cardId}_${imageType}.png`;
  
  return `/images/${filename}`;
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
 * Check if unwatermarked files exist for watermark removal
 */
export async function hasUnwatermarkedFiles(cardId: number): Promise<{ front: boolean; inside: boolean }> {
  const frontExists = await imageExists(cardId, 'front');
  const insideExists = await imageExists(cardId, 'inside');
  
  return {
    front: frontExists,
    inside: insideExists
  };
}