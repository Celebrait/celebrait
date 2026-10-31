import OpenAI from "openai";
import Stripe from "stripe";
import sharp from "sharp";
import { storage } from "../storage";
// Legacy supplier email import removed 2026-04-21 — new print
// provider integration will handle its own dispatch via the
// PrintProvider abstraction (server/studio/print-provider.ts).
import { generateSeparatePDFs, generatePrintSpecs, packagePDFsForSupplier } from "../pdf-generator";
import { publicImageUrl } from "../image-storage";
import { isR2Enabled, r2Put } from "../r2-storage";

// --- API Clients ---

const hasOpenAI = !!process.env.OPENAI_API_KEY;
export const hasStripe = !!process.env.STRIPE_SECRET_KEY;
export const hasPaystack = !!process.env.PAYSTACK_SECRET_KEY;

export const openai = hasOpenAI ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

export const stripe = hasStripe ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
}) : null;

// --- Performance Caches ---

export const imageCache = new Map<string, {
  data: Buffer;
  timestamp: number;
  etag: string;
}>();

export const cardMetadataCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

export const emailLinkCache = new Map<string, {
  card: any;
  frontImage: Buffer;
  insideImage: Buffer | null;
  timestamp: number;
}>();

export const pngProcessingQueue = new Map<number, Promise<any>>();

export const CACHE_TTL = 60 * 60 * 1000; // 1 hour
export const METADATA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clear expired cache entries periodically
setInterval(() => {
  const now = Date.now();

  const imageKeysToDelete: string[] = [];
  imageCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL) {
      imageKeysToDelete.push(key);
    }
  });
  imageKeysToDelete.forEach(key => imageCache.delete(key));

  const metadataKeysToDelete: string[] = [];
  cardMetadataCache.forEach((value, key) => {
    if (now - value.timestamp > METADATA_CACHE_TTL) {
      metadataKeysToDelete.push(key);
    }
  });
  metadataKeysToDelete.forEach(key => cardMetadataCache.delete(key));
}, 10 * 60 * 1000);

// --- Helper Functions ---

export async function convertBase64ToPngFile(base64Data: string, cardId: number, imageType: string): Promise<string> {
  try {
    const processingKey = cardId;
    if (pngProcessingQueue.has(processingKey)) {
      console.log(`[PNG_CONVERSION] Waiting for existing PNG processing for card ${cardId} to complete...`);
      await pngProcessingQueue.get(processingKey);
      console.log(`[PNG_CONVERSION] Previous PNG processing for card ${cardId} completed, continuing...`);
    }

    console.log(`[PNG_CONVERSION] Converting ${imageType} image for card ${cardId} from Base64 to PNG file`);

    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    const startTime = Date.now();
    const pngBuffer = await sharp(imageBuffer)
      .png({
        compressionLevel: 6,
        quality: 100,
        progressive: false
      })
      .toBuffer();

    const processingTime = Date.now() - startTime;
    console.log(`[PNG_CONVERSION] Sharp processing took ${processingTime}ms for ${imageType} image (${pngBuffer.length} bytes)`);

    const filename = `card_${cardId}_${imageType}.png`;

    if (isR2Enabled()) {
      await r2Put(filename, pngBuffer, 'image/png');
    } else {
      const fs = await import('fs');
      const path = await import('path');
      const filepath = path.join(process.cwd(), 'stored_images', filename);
      await fs.promises.writeFile(filepath, pngBuffer);
    }

    console.log(`[PNG_CONVERSION] Successfully converted ${imageType} image for card ${cardId} to PNG file: ${filename} (${pngBuffer.length} bytes)`);

    return publicImageUrl(filename);

  } catch (error: any) {
    console.error(`[PNG_CONVERSION] Error converting ${imageType} image for card ${cardId}:`, error);
    throw new Error(`Failed to convert ${imageType} image to PNG file: ${error?.message || 'Unknown error'}`);
  } finally {
    pngProcessingQueue.delete(cardId);
  }
}

// applyWatermark + applyWatermarkToPngFile removed 2026-05-12.
// Both were unused dead code. Watermarking is not a Celebrait feature —
// digital cards are free, users can download/screenshot their work.
// The diagonal-text "CELEBRAIT PREVIEW" canvas overlay function lived
// here for a while but was never wired into any send/download path.

export async function compressImageForDigital(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const compressedBuffer = await sharp(imageBuffer)
      .resize(600, 600, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 82,
        progressive: true,
        mozjpeg: true,
        optimiseScans: true
      })
      .toBuffer();

    console.log(`[COMPRESSION] Compressed image from ${imageBuffer.length} to ${compressedBuffer.length} bytes (${Math.round(compressedBuffer.length / imageBuffer.length * 100)}% of original)`);
    return compressedBuffer;
  } catch (error) {
    console.error('[COMPRESSION] Error compressing image:', error);
    return imageBuffer;
  }
}

export async function processSupplierOrder(orderId: number, cardId: number): Promise<void> {
  const startTime = Date.now();
  console.log(`[SUPPLIER_PROCESSING] Starting background processing for order #${orderId}, card #${cardId}`);

  try {
    const order = await storage.getOrder(orderId);
    const card = await storage.getCard(cardId);

    if (!order || !card) {
      console.error(`[SUPPLIER_PROCESSING] Order or card not found: order=${orderId}, card=${cardId}`);
      return;
    }

    console.log(`[SUPPLIER_PROCESSING] Processing order for: ${order.customerName}, delivery: ${(order as any).deliveryMethod}`);

    // Step 1: Generate PDFs
    console.log(`[SUPPLIER_PROCESSING] Step 1/3: Generating PDFs...`);
    let pdfs;
    try {
      pdfs = await generateSeparatePDFs({
        cardId: card.id,
        format: '5x5',
        dpi: 300
      });
      console.log(`[SUPPLIER_PROCESSING] ✅ PDFs generated successfully:`, pdfs);
    } catch (pdfError: any) {
      console.error(`[SUPPLIER_PROCESSING] ❌ PDF generation failed:`, pdfError);
      return;
    }

    // Step 2: Create zip package
    console.log(`[SUPPLIER_PROCESSING] Step 2/3: Creating zip package...`);
    let zipFilePath: string | null = null;
    let zipFileName: string | null = null;

    try {
      const { promises: fs } = await import('fs');
      const pathModule = await import('path');

      const frontPdfPath = pathModule.join(process.cwd(), 'print_files', `card_${card.id}_front_5x5_300dpi.pdf`);
      const insidePdfPath = pathModule.join(process.cwd(), 'print_files', `card_${card.id}_inside_5x5_300dpi.pdf`);

      let frontExists = false;
      let insideExists = false;

      try { await fs.access(frontPdfPath); frontExists = true; } catch (e) {}
      try { await fs.access(insidePdfPath); insideExists = true; } catch (e) {}

      if (!frontExists) {
        console.error(`[SUPPLIER_PROCESSING] ❌ Cannot create zip without front PDF`);
        return;
      }

      let printSpecsPath: string | undefined;
      try { printSpecsPath = await generatePrintSpecs(card.id); } catch (e) {}

      zipFilePath = await packagePDFsForSupplier(
        card.id,
        order.customerName,
        frontPdfPath,
        insideExists ? insidePdfPath : null,
        printSpecsPath
      );

      zipFileName = pathModule.basename(zipFilePath);
      console.log(`[SUPPLIER_PROCESSING] ✅ Zip package created: ${zipFileName}`);

    } catch (zipError: any) {
      console.error(`[SUPPLIER_PROCESSING] ❌ Zip creation failed:`, zipError);
      return;
    }

    // Step 3: legacy supplier email removed 2026-04-21. The zip
    // package lives at zipFilePath; future print-provider
    // integration (Gelato/Prodigi via PrintProvider abstraction)
    // consumes it directly.
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SUPPLIER_PROCESSING] ✅ Zip ready in ${elapsedTime}s: ${zipFilePath}`);

  } catch (error: any) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[SUPPLIER_PROCESSING] ❌ CRITICAL ERROR after ${elapsedTime}s:`, error);
  }
}
