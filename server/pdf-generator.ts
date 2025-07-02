import { createCanvas, loadImage } from 'canvas';
import { promises as fs } from 'fs';
import path from 'path';

const PRINT_DIR = path.join(process.cwd(), 'print_files');

// Ensure print directory exists
async function ensurePrintDirectory() {
  try {
    await fs.mkdir(PRINT_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create print directory:', error);
  }
}

ensurePrintDirectory();

export interface PrintOptions {
  cardId: number;
  format: '5x5' | 'A4' | 'Letter';
  layout: 'single' | 'double' | 'booklet';
  includeInside: boolean;
  dpi: 150 | 300 | 600;
}

/**
 * Generate high-quality print-ready files for professional printing
 */
export async function generatePrintReadyPDF(options: PrintOptions): Promise<string> {
  const { cardId, format, layout, includeInside, dpi } = options;
  
  try {
    // Load images from file storage
    const frontImagePath = path.join(process.cwd(), 'stored_images', `card_${cardId}_front.png`);
    const insideImagePath = path.join(process.cwd(), 'stored_images', `card_${cardId}_inside.png`);
    
    const frontImage = await loadImage(frontImagePath);
    let insideImage = null;
    
    if (includeInside) {
      try {
        insideImage = await loadImage(insideImagePath);
      } catch (error) {
        console.log('Inside image not found, using front only');
      }
    }
    
    // Calculate dimensions based on format and DPI
    const dimensions = getFormatDimensions(format, dpi);
    const canvas = createCanvas(dimensions.width, dimensions.height);
    const ctx = canvas.getContext('2d');
    
    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    
    // Draw images based on layout
    switch (layout) {
      case 'single':
        // Single card centered
        const cardSize = Math.min(dimensions.width, dimensions.height) * 0.8;
        const x = (dimensions.width - cardSize) / 2;
        const y = (dimensions.height - cardSize) / 2;
        ctx.drawImage(frontImage, x, y, cardSize, cardSize);
        break;
        
      case 'double':
        // Front and inside side by side
        const halfWidth = dimensions.width / 2;
        ctx.drawImage(frontImage, 0, 0, halfWidth, dimensions.height);
        if (insideImage) {
          ctx.drawImage(insideImage, halfWidth, 0, halfWidth, dimensions.height);
        }
        break;
        
      case 'booklet':
        // Booklet format with fold line
        const bookletWidth = dimensions.width / 2;
        // Draw inside on left (will be on right when folded)
        if (insideImage) {
          ctx.drawImage(insideImage, 0, 0, bookletWidth, dimensions.height);
        }
        // Draw front on right (will be on front when folded)
        ctx.drawImage(frontImage, bookletWidth, 0, bookletWidth, dimensions.height);
        
        // Add fold line guide (very light)
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bookletWidth, 0);
        ctx.lineTo(bookletWidth, dimensions.height);
        ctx.stroke();
        break;
    }
    
    // Generate filename and save
    const filename = `card_${cardId}_print_${format}_${layout}_${dpi}dpi.png`;
    const filepath = path.join(PRINT_DIR, filename);
    
    // Convert to high-quality PNG buffer
    const buffer = canvas.toBuffer('image/png', { compressionLevel: 1, filters: canvas.PNG_FILTER_NONE });
    
    await fs.writeFile(filepath, buffer);
    
    console.log(`[PRINT] Generated print file: ${filename} (${buffer.length} bytes, ${dimensions.width}x${dimensions.height} at ${dpi}DPI)`);
    
    return filepath;
    
  } catch (error) {
    console.error('Failed to generate print-ready PDF:', error);
    throw error;
  }
}

/**
 * Get dimensions for different print formats
 */
function getFormatDimensions(format: string, dpi: number): { width: number; height: number } {
  switch (format) {
    case '5x5':
      // 5x5 inches
      return { width: 5 * dpi, height: 5 * dpi };
    case 'A4':
      // A4: 8.27 × 11.69 inches
      return { width: Math.round(8.27 * dpi), height: Math.round(11.69 * dpi) };
    case 'Letter':
      // US Letter: 8.5 × 11 inches
      return { width: Math.round(8.5 * dpi), height: 11 * dpi };
    default:
      return { width: 5 * dpi, height: 5 * dpi };
  }
}

/**
 * Generate print specifications document
 */
export async function generatePrintSpecs(cardId: number): Promise<string> {
  const specs = {
    cardId,
    timestamp: new Date().toISOString(),
    specifications: {
      paperType: "Premium 350gsm cardstock",
      finish: "Matte or Glossy available",
      dimensions: "5\" x 5\" (127mm x 127mm)",
      resolution: "300 DPI minimum",
      colorSpace: "CMYK (converted from RGB)",
      bleed: "0.125\" (3.175mm) all sides",
      safeArea: "0.25\" (6.35mm) from edges"
    },
    printInstructions: [
      "Print at 300 DPI or higher for best quality",
      "Use premium cardstock (300-400gsm recommended)",
      "Ensure color calibration for accurate colors",
      "Add 0.125\" bleed if required by printer",
      "Score and fold along center line for booklet format"
    ]
  };
  
  const filename = `card_${cardId}_print_specs.json`;
  const filepath = path.join(PRINT_DIR, filename);
  
  await fs.writeFile(filepath, JSON.stringify(specs, null, 2));
  
  return filepath;
}