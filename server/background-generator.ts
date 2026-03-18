import { storage } from './storage';
import { sendBackgroundEmail, sendEmail } from './email-service';
import FormData from 'form-data';
import { storeImageFromBase64, storeUnwatermarkedImage, getImageUrl } from './image-storage';
import { buildScenePrompt, buildTransformPrompt, buildInsidePrompt } from '../shared/prompts';

export interface BackgroundGenerationParams {
  cardId: number;
  userId?: number;
  userEmail: string;
  userName: string;
  generationType: 'scene' | 'transform' | 'text-only';
  // Scene generation params
  imageDataArray?: string[];
  scenePrompt?: string;
  style?: string;
  includeText?: boolean;
  cardText?: string;
  userClothing?: string;
  userArtStyle?: string;
  // Inside card
  insideText?: string;
  artStyle?: string;
  // Stored answers for conversationData
  answers: Record<string, any>;
  uploadedPhotoIds?: string[];
}

async function callOpenAIImageEdit(params: {
  imageBuffers: { buffer: Buffer; mimeType: string }[];
  prompt: string;
  size?: string;
}): Promise<string> {
  const { imageBuffers, prompt, size = '1024x1024' } = params;

  const formData = new FormData();

  if (imageBuffers.length === 1) {
    formData.append('image', imageBuffers[0].buffer, {
      filename: `image.${imageBuffers[0].mimeType}`,
      contentType: `image/${imageBuffers[0].mimeType}`
    });
  } else {
    imageBuffers.forEach(({ buffer, mimeType }, index) => {
      formData.append('image[]', buffer, {
        filename: `image${index + 1}.${mimeType}`,
        contentType: `image/${mimeType}`
      });
    });
  }

  formData.append('prompt', prompt);
  formData.append('model', 'gpt-image-1.5');
  formData.append('n', '1');
  formData.append('size', size);
  formData.append('quality', 'high');
  formData.append('moderation', 'low');
  formData.append('background', 'auto');

  const fetch = (await import('node-fetch')).default;
  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      ...formData.getHeaders()
    },
    body: formData,
    // @ts-ignore - node-fetch supports timeout
    timeout: 300000
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: any;
    try { errorData = JSON.parse(errorText); } catch { errorData = { error: { message: errorText } }; }
    throw new Error(`OpenAI API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
  }

  const responseData = await response.json() as any;

  if (!responseData?.data?.[0]) {
    throw new Error('Invalid response format from OpenAI API');
  }

  const imageResult = responseData.data[0];
  if (imageResult.b64_json) {
    return `data:image/png;base64,${imageResult.b64_json}`;
  } else if (imageResult.url) {
    return imageResult.url;
  }
  throw new Error('No image data in OpenAI response');
}

function isSafetyViolation(message: string): boolean {
  return (
    message.includes('safety') ||
    message.includes('safety_violations') ||
    message.includes('content_policy') ||
    message.includes('rejected by the safety')
  );
}

async function callOpenAIImageEditWithRetry(
  params: { imageBuffers: { buffer: Buffer; mimeType: string }[]; prompt: string; size?: string },
  cardId: number,
  maxAttempts = 3
): Promise<string> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callOpenAIImageEdit(params);
    } catch (err: any) {
      lastError = err;
      if (isSafetyViolation(err.message)) {
        if (attempt < maxAttempts) {
          console.warn(`[BG_GEN] Safety rejection on attempt ${attempt} for card ${cardId}, retrying in 3s...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.error(`[BG_GEN] All ${maxAttempts} attempts failed for card ${cardId} due to safety rejection`);
        }
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

async function callOpenAITextGeneration(prompt: string, size = '1024x1024'): Promise<string> {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size,
      quality: 'high',
      output_format: 'b64_json'
    }),
    // @ts-ignore
    timeout: 300000
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: any;
    try { errorData = JSON.parse(errorText); } catch { errorData = { error: { message: errorText } }; }
    throw new Error(`OpenAI text generation error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
  }

  const responseData = await response.json() as any;
  const imageResult = responseData?.data?.[0];
  if (!imageResult) throw new Error('No image data in OpenAI text generation response');
  if (imageResult.b64_json) return `data:image/png;base64,${imageResult.b64_json}`;
  if (imageResult.url) return imageResult.url;
  throw new Error('No image data in OpenAI text generation response');
}

async function sendGenerationFailedEmail(userEmail: string, userName: string, cardId: number): Promise<void> {
  try {
    await sendEmail({
      to: userEmail,
      from: 'greetings@celebrait.co.za',
      subject: 'We hit a snag with your Celebrait card',
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #fff; border-radius: 16px;">
          <h2 style="color: #7c3aed; margin: 0 0 16px;">Hi ${userName || 'there'},</h2>
          <p style="color: #374151; line-height: 1.6;">We ran into a problem generating your card (ID #${cardId}). This sometimes happens when our AI provider's safety system is overly cautious about an uploaded photo.</p>
          <p style="color: #374151; line-height: 1.6;"><strong>What to do:</strong> Head back to Celebrait and try again — you can either try a different photo, or choose the text-only card option which never has this issue.</p>
          <a href="https://celebrait.co.za" style="display: inline-block; margin-top: 20px; padding: 12px 28px; background: linear-gradient(135deg, #7c3aed, #db2777); color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600;">Try Again</a>
          <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">Sorry for the inconvenience — your card generation was not charged.</p>
        </div>
      `
    });
  } catch (e) {
    console.error(`[BG_GEN] Failed to send failure notification email:`, e);
  }
}


function base64ToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const mimeMatch = dataUrl.match(/^data:image\/([a-z]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'png';
  const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
  return { buffer: Buffer.from(base64Data, 'base64'), mimeType };
}

async function savePngFiles(imageUrl: string, cardId: number, prefix: 'front' | 'inside'): Promise<{ watermarked: string; original: string }> {
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

export async function generateCardInBackground(params: BackgroundGenerationParams): Promise<void> {
  const { cardId, userEmail, userName, generationType, answers, uploadedPhotoIds } = params;

  console.log(`[BG_GEN] Starting background generation for card ${cardId}, type: ${generationType}`);

  try {
    await storage.updateCard(cardId, { status: 'generating' });

    let frontWatermarked: string | null = null;
    let frontOriginal: string | null = null;
    let insideWatermarked: string | null = null;
    let insideOriginal: string | null = null;

    // --- FRONT CARD ---
    if (generationType === 'scene' && params.imageDataArray?.length) {
      const imageBuffers = params.imageDataArray.map(base64ToBuffer);
      const prompt = buildScenePrompt({
        scenePrompt: params.scenePrompt || '',
        userArtStyle: params.userArtStyle,
        userClothing: params.userClothing,
        includeText: params.includeText,
        cardText: params.cardText
      });

      console.log(`[BG_GEN] Calling OpenAI scene edit for card ${cardId}`);
      const sceneImageUrl = await callOpenAIImageEditWithRetry({ imageBuffers, prompt }, cardId);
      const { watermarked: sw, original: so } = await savePngFiles(sceneImageUrl, cardId, 'front');
      frontWatermarked = sw;
      frontOriginal = so;

    } else if (generationType === 'transform' && params.imageDataArray?.length) {
      const artStyle = params.artStyle || params.style || 'semi-realistic illustration';
      const imageBuffers = params.imageDataArray.map(base64ToBuffer);
      const prompt = buildTransformPrompt(artStyle, params.cardText);

      console.log(`[BG_GEN] Calling OpenAI transform for card ${cardId}`);
      const transformImageUrl = await callOpenAIImageEditWithRetry({ imageBuffers, prompt }, cardId);
      const { watermarked: tw, original: to_ } = await savePngFiles(transformImageUrl, cardId, 'front');
      frontWatermarked = tw;
      frontOriginal = to_;

    } else if (generationType === 'text-only' || (!params.imageDataArray?.length)) {
      console.log(`[BG_GEN] Text-only generation for card ${cardId}`);
      const prompt = buildScenePrompt({ scenePrompt: params.scenePrompt || answers.scene || 'A beautiful celebratory scene', userArtStyle: params.userArtStyle, includeText: params.includeText, cardText: params.cardText });
      const imageUrl = await callOpenAITextGeneration(prompt);
      const { watermarked, original } = await savePngFiles(imageUrl, cardId, 'front');
      frontWatermarked = watermarked;
      frontOriginal = original;

    } else {
      console.error(`[BG_GEN] Unsupported generation type or missing images: ${generationType}`);
      await storage.updateCard(cardId, { status: 'failed' });
      await sendGenerationFailedEmail(userEmail, userName, cardId);
      return;
    }

    // --- INSIDE CARD ---
    const insideText = params.insideText || answers.inside_message;
    if (insideText && frontWatermarked) {
      console.log(`[BG_GEN] Generating inside card for card ${cardId}`);
      const artStyle = params.artStyle || params.userArtStyle || 'artistic';
      const insidePrompt = buildInsidePrompt(insideText, artStyle);

      // Read the front PNG file for use as reference
      let frontImageForInside: string;
      if (frontWatermarked.startsWith('/images/')) {
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'stored_images', frontWatermarked.replace('/images/', ''));
        const fileBuffer = await fs.promises.readFile(filePath);
        frontImageForInside = `data:image/png;base64,${fileBuffer.toString('base64')}`;
      } else {
        frontImageForInside = frontWatermarked;
      }

      const insideImageBuffers = [base64ToBuffer(frontImageForInside)];
      const insideImageUrl = await callOpenAIImageEditWithRetry({ imageBuffers: insideImageBuffers, prompt: insidePrompt }, cardId);
      const { watermarked: iw, original: io } = await savePngFiles(insideImageUrl, cardId, 'inside');
      insideWatermarked = iw;
      insideOriginal = io;
    }

    // --- UPDATE CARD IN DB ---
    const conversationData = {
      ...answers,
      uploadedPhotoIds: uploadedPhotoIds || [],
      originalFrontImageUrl: frontOriginal,
      originalInsideImageUrl: insideOriginal,
      watermarkedFrontImageUrl: frontWatermarked,
      watermarkedInsideImageUrl: insideWatermarked
    };

    await storage.updateCard(cardId, {
      frontImageUrl: frontWatermarked,
      insideImageUrl: insideWatermarked,
      status: 'completed',
      conversationData
    });

    console.log(`[BG_GEN] Card ${cardId} generation completed successfully`);

    // --- GENERATE PRINT-RESOLUTION FILES (3000×3000 Lanczos3 upscale) ---
    // These are stored as card_${id}_front_print.png / inside_print.png for use
    // in PDF generation and high-quality downloads. Failure here is non-fatal.
    try {
      const { getStoredImage, storeUnwatermarkedPngFile } = await import('./image-storage');
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

    // --- SEND EMAIL ---
    try {
      const sent = await sendBackgroundEmail(cardId, userEmail, userName);
      console.log(`[BG_GEN] Email ${sent ? 'sent' : 'failed'} for card ${cardId} to ${userEmail}`);
    } catch (emailErr) {
      console.error(`[BG_GEN] Email error for card ${cardId}:`, emailErr);
    }

  } catch (err: any) {
    console.error(`[BG_GEN] Background generation FAILED for card ${cardId}:`, err.message);
    try {
      await storage.updateCard(cardId, { status: 'failed' });
    } catch (dbErr) {
      console.error(`[BG_GEN] Failed to update card status to failed:`, dbErr);
    }
    // Notify the user so they know to try again
    await sendGenerationFailedEmail(userEmail, userName, cardId);
  }
}
