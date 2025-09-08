import PDFDocument from 'pdfkit';
import { promises as fs } from 'fs';
import path from 'path';

const PRINT_DIR = path.join(process.cwd(), 'print_files');
const IMAGES_DIR = path.join(process.cwd(), 'stored_images');

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
  dpi: 150 | 300 | 600;
}

/**
 * Generate separate high-quality PDFs for front and inside of the card
 */
export async function generateSeparatePDFs(options: PrintOptions): Promise<{ frontPdf: string; insidePdf: string | null }> {
  const { cardId, format, dpi } = options;
  
  try {
    // Generate front PDF
    const frontPdf = await generateSingleCardPDF(cardId, 'front', format, dpi);
    
    // Try to generate inside PDF
    let insidePdf = null;
    try {
      insidePdf = await generateSingleCardPDF(cardId, 'inside', format, dpi);
    } catch (error) {
      console.log('Inside image not found, generating front PDF only');
    }
    
    console.log(`[PDF] Generated separate PDFs for card ${cardId}: front=${frontPdf}, inside=${insidePdf}`);
    
    return { frontPdf, insidePdf };
    
  } catch (error) {
    console.error('Failed to generate separate PDFs:', error);
    throw error;
  }
}

/**
 * Generate a single PDF for either front or inside of the card
 */
async function generateSingleCardPDF(
  cardId: number, 
  side: 'front' | 'inside', 
  format: string, 
  dpi: number
): Promise<string> {
  // Load unwatermarked image
  const imagePath = path.join(IMAGES_DIR, `card_${cardId}_${side}_unwatermarked.png`);
  
  // Check if image exists
  try {
    await fs.access(imagePath);
  } catch (error) {
    throw new Error(`Unwatermarked ${side} image not found for card ${cardId}`);
  }
  
  // Get format dimensions in points (72 DPI)
  const dimensions = getFormatDimensions(format);
  
  // Create PDF document
  const doc = new PDFDocument({
    size: [dimensions.width, dimensions.height],
    margin: 0,
    compress: false // Maintain maximum quality
  });
  
  // Generate filename
  const filename = `card_${cardId}_${side}_${format}_${dpi}dpi.pdf`;
  const filepath = path.join(PRINT_DIR, filename);
  
  // Create write stream
  const stream = doc.pipe(await fs.open(filepath, 'w').then(handle => handle.createWriteStream()));
  
  // Add the image to PDF
  // Calculate image size to fit the page while maintaining aspect ratio
  const imageBuffer = await fs.readFile(imagePath);
  
  // For greeting cards, we want to fill the entire page
  doc.image(imageBuffer, 0, 0, {
    width: dimensions.width,
    height: dimensions.height,
    fit: [dimensions.width, dimensions.height],
    align: 'center',
    valign: 'center'
  });
  
  // Finalize the PDF
  doc.end();
  
  // Wait for the stream to finish
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  
  const stats = await fs.stat(filepath);
  console.log(`[PDF] Generated ${side} PDF for card ${cardId}: ${filename} (${stats.size} bytes, ${dimensions.width}x${dimensions.height}pt)`);
  
  return filepath;
}

/**
 * Get dimensions for different print formats in points (72 DPI)
 */
function getFormatDimensions(format: string): { width: number; height: number } {
  switch (format) {
    case '5x5':
      // 5x5 inches = 360x360 points
      return { width: 360, height: 360 };
    case 'A4':
      // A4: 8.27 × 11.69 inches = 595x842 points
      return { width: 595, height: 842 };
    case 'Letter':
      // US Letter: 8.5 × 11 inches = 612x792 points
      return { width: 612, height: 792 };
    default:
      return { width: 360, height: 360 };
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
      "Print front and inside on separate sheets, then fold/bind as needed"
    ]
  };
  
  const filename = `card_${cardId}_print_specs.json`;
  const filepath = path.join(PRINT_DIR, filename);
  
  await fs.writeFile(filepath, JSON.stringify(specs, null, 2));
  
  return filepath;
}

/**
 * Get download URLs for generated PDFs
 */
export function getPDFDownloadUrls(cardId: number, format: string = '5x5', dpi: number = 300) {
  const baseUrl = '/api/download-pdf';
  
  return {
    front: `${baseUrl}/${cardId}/front/${format}/${dpi}`,
    inside: `${baseUrl}/${cardId}/inside/${format}/${dpi}`,
    specs: `${baseUrl}/${cardId}/specs`
  };
}