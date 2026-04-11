import { storage } from './storage';
import { sendBackgroundEmail, sendGenerationFailedEmail } from './email-service';
import { resolveFrontScenePrompt, resolveInsidePrompt } from './prompts/resolver';
import { callOpenAIImageEditWithRetry } from './pipeline/providers/OpenAIProvider';
import { savePngFiles, loadStoredImageAsBase64, generatePrintResolutionFiles } from './pipeline/storage/LocalStorageAdapter';

export interface BackgroundGenerationParams {
  cardId: number;
  userId?: number;
  userEmail: string;
  userName: string;
  // NOTE: only 'scene' is actually supported at runtime. 'text-only' is accepted
  // here so callers (e.g. regeneration in fulfillment.ts) can pass it through,
  // but it will fail gracefully via sendGenerationFailedEmail until the Prompt
  // Lab work adds a real text-only path.
  generationType: 'scene' | 'text-only';
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



function base64ToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const mimeMatch = dataUrl.match(/^data:image\/([a-z]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'png';
  const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
  return { buffer: Buffer.from(base64Data, 'base64'), mimeType };
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
    // ── ACTIVE PATH: scene generation (the only supported flow) ──
    if (generationType === 'scene' && params.imageDataArray?.length) {
      const imageBuffers = params.imageDataArray.map(base64ToBuffer);
      const resolvedFront = await resolveFrontScenePrompt({
        scenePrompt: params.scenePrompt || '',
        userArtStyle: params.userArtStyle,
        userClothing: params.userClothing,
        includeText: params.includeText,
        cardText: params.cardText,
      });
      const prompt = resolvedFront.text;

      console.log(
        `[BG_GEN] Calling OpenAI scene edit for card ${cardId} (prompt source=${resolvedFront.source}, templateId=${resolvedFront.templateId}, v=${resolvedFront.templateVersion})`,
      );
      const sceneImageUrl = await callOpenAIImageEditWithRetry({ imageBuffers, prompt }, cardId);
      const { watermarked: sw, original: so } = await savePngFiles(sceneImageUrl, cardId, 'front');
      frontWatermarked = sw;
      frontOriginal = so;

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
      const resolvedInside = await resolveInsidePrompt({ insideText, artStyle });
      const insidePrompt = resolvedInside.text;
      console.log(
        `[BG_GEN] Inside prompt source=${resolvedInside.source}, templateId=${resolvedInside.templateId}, v=${resolvedInside.templateVersion}`,
      );

      // Read the front PNG file for use as reference
      const frontImageForInside = await loadStoredImageAsBase64(frontWatermarked);

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

    // --- GENERATE PRINT-RESOLUTION FILES (non-fatal) ---
    await generatePrintResolutionFiles(cardId);

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
