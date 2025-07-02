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

/**
 * Clean up old image files (older than 30 days)
 */
export async function cleanupOldImages(): Promise<void> {
  try {
    const files = await fs.readdir(IMAGES_DIR);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    for (const file of files) {
      const filepath = path.join(IMAGES_DIR, file);
      const stats = await fs.stat(filepath);
      
      if (stats.mtime.getTime() < thirtyDaysAgo) {
        await fs.unlink(filepath);
        console.log(`[CLEANUP] Removed old image file: ${file}`);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup old images:', error);
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