import { storage } from './storage';
import { sendBackgroundEmail, sendGenerationFailedEmail } from './email-service';
import { resolveFrontScenePrompt, resolveInsidePrompt, type ResolvedPrompt } from './prompts/resolver';
import { getProvider } from './providers/registry';
import { logGeneration } from './prompts/generation-log';
import { savePngFiles, loadStoredImageAsBase64, generatePrintResolutionFiles } from './pipeline/storage/LocalStorageAdapter';

// Fallback provider / quality used when the active prompt_active row has
// null values. Matches the hardcoded behaviour this function had before
// Phase 4b so existing cards keep generating unchanged.
const FALLBACK_PROVIDER = 'openai';
const FALLBACK_QUALITY = 'high' as const;
const FALLBACK_SIZE = '1024x1024';

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



// Ensure a data URL, not a raw base64 string. The modern provider registry
// expects data URLs (data:image/png;base64,...). Legacy callers sometimes
// pass raw base64 — wrap if necessary.
function ensureDataUrl(s: string): string {
  return s.startsWith('data:image/') ? s : `data:image/png;base64,${s}`;
}

// Run a resolved prompt through the active provider, log the result, and
// return the generated image as a data URL ready for savePngFiles. Handles
// the null-fallback convention (null provider → openai; null quality → high)
// so the caller doesn't branch on it. Writes exactly one generation_log row
// per call (success OR failure) — callers must not double-log.
async function generateViaActiveConfig(params: {
  cardId: number;
  resolved: ResolvedPrompt;
  referenceImages: string[];
}): Promise<string> {
  const { cardId, resolved, referenceImages } = params;
  const providerId = resolved.provider ?? FALLBACK_PROVIDER;
  const quality = resolved.quality ?? FALLBACK_QUALITY;
  const provider = getProvider(providerId);

  const [primary, ...additional] = referenceImages.map(ensureDataUrl);

  try {
    const result = await provider.generate({
      prompt: resolved.text,
      referenceImageBase64: primary,
      additionalReferenceImages: additional.length ? additional : undefined,
      quality,
      size: FALLBACK_SIZE,
      slot: resolved.slot,
    });

    await logGeneration({
      cardId,
      slot: resolved.slot,
      templateId: resolved.templateId,
      templateVersion: resolved.templateVersion,
      provider: result.provider,
      model: result.model,
      quality,
      costCents: result.costCents,
      durationMs: result.durationMs,
      success: true,
    });

    return result.imageUrl;
  } catch (err: any) {
    await logGeneration({
      cardId,
      slot: resolved.slot,
      templateId: resolved.templateId,
      templateVersion: resolved.templateVersion,
      provider: providerId,
      // The provider throws before returning its model, so fall back to
      // whatever we know from the registry for correlation purposes.
      model: provider.model,
      quality,
      costCents: 0,
      durationMs: 0,
      success: false,
      errorCode: err?.kind ?? err?.code ?? 'unknown',
    });
    throw err;
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
    // ── ACTIVE PATH: scene generation (the only supported flow) ──
    if (generationType === 'scene' && params.imageDataArray?.length) {
      const resolvedFront = await resolveFrontScenePrompt({
        scenePrompt: params.scenePrompt || '',
        userArtStyle: params.userArtStyle,
        userClothing: params.userClothing,
        includeText: params.includeText,
        cardText: params.cardText,
      });

      console.log(
        `[BG_GEN] Generating front for card ${cardId} via provider=${resolvedFront.provider ?? FALLBACK_PROVIDER} ` +
          `quality=${resolvedFront.quality ?? FALLBACK_QUALITY} ` +
          `(prompt source=${resolvedFront.source}, templateId=${resolvedFront.templateId}, v=${resolvedFront.templateVersion})`,
      );
      const sceneImageUrl = await generateViaActiveConfig({
        cardId,
        resolved: resolvedFront,
        referenceImages: params.imageDataArray,
      });
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
      const artStyle = params.artStyle || params.userArtStyle || 'artistic';
      const resolvedInside = await resolveInsidePrompt({ insideText, artStyle });

      console.log(
        `[BG_GEN] Generating inside for card ${cardId} via provider=${resolvedInside.provider ?? FALLBACK_PROVIDER} ` +
          `quality=${resolvedInside.quality ?? FALLBACK_QUALITY} ` +
          `(prompt source=${resolvedInside.source}, templateId=${resolvedInside.templateId}, v=${resolvedInside.templateVersion})`,
      );

      // Read the front PNG file for use as reference — the inside card
      // inherits the front's style via the image-to-image edit path.
      const frontImageForInside = await loadStoredImageAsBase64(frontWatermarked);

      const insideImageUrl = await generateViaActiveConfig({
        cardId,
        resolved: resolvedInside,
        referenceImages: [frontImageForInside],
      });
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
