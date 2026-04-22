import path from 'path';
import { promises as fs } from 'fs';
import { eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { storage } from './storage';
import { sendGenerationFailedEmail } from './email-service';
import {
  resolveFrontScenePrompt,
  resolveInsidePrompt,
  resolveInsideWritePrompt,
  resolveInsideBlankPrompt,
  type ResolvedPrompt,
} from './prompts/resolver';
import { getProvider } from './providers/registry';
import { logGeneration } from './prompts/generation-log';
import { savePngFiles, loadStoredImageAsBase64, generatePrintResolutionFiles } from './pipeline/storage/LocalStorageAdapter';
import { cards, photos, type CardDraftState, deriveDefaultFrontText } from '@shared/schema';
import { resolveStyleDescription } from '@shared/style-descriptions';

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

    // No auto-email on generation complete — the Studio flow sends
    // the recipient / sender emails on order-paid, not card-ready.
    // (Legacy sendBackgroundEmail path retired 2026-04-21.)
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

// ── Studio card generation (Sprint 3 Phase 6) ────────────────────────────
//
// Reads a Studio draft row by id, translates its CardDraftState into the
// vars the prompt resolvers expect, and runs the full front+inside
// generation. Differences from generateCardInBackground:
//
//   - Reads inputs from cards.conversationData (draft state) rather than
//     taking them as explicit params.
//   - Routes to resolveInsideWritePrompt vs resolveInsideBlankPrompt based
//     on the customer's mode choice.
//   - Concatenates salutation / message / signoff into insideText for
//     write mode; blank mode passes an empty string (the v2 template
//     ignores it).
//   - Loads reference photos from the user's photo library (photos.photoIds
//     in the draft state) rather than accepting pre-encoded base64.
//   - Doesn't send email on completion — Studio clients poll status
//     directly and show the result in-page.
//
// The card's `status` column drives the Studio UI's polling loop:
//   draft → generating → completed (happy path)
//                     → failed     (provider error / safety block / etc.)

export async function generateStudioCard(cardId: number): Promise<void> {
  console.log(`[STUDIO_GEN] Starting Studio generation for card ${cardId}`);

  // ── Load draft state ─────────────────────────────────────────────
  const rows = await db
    .select({
      id: cards.id,
      userId: cards.userId,
      conversationData: cards.conversationData,
    })
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    console.error(`[STUDIO_GEN] Card ${cardId} not found`);
    return;
  }

  const state = row.conversationData as CardDraftState | null;
  if (!state || state.version !== 1) {
    console.error(`[STUDIO_GEN] Card ${cardId} has no valid draft state`);
    await storage.updateCard(cardId, { status: 'failed' });
    return;
  }

  try {
    await storage.updateCard(cardId, { status: 'generating' });

    // ── Load reference photos ────────────────────────────────────
    const photoIds = state.photos?.photoIds ?? [];
    if (photoIds.length === 0) {
      throw new Error('No reference photos on this draft');
    }
    const photoRows = await db
      .select()
      .from(photos)
      .where(inArray(photos.id, photoIds));

    // Order photoRows to match the user's photoIds order. DB doesn't
    // guarantee order on an IN query, and the primary photo is
    // photoIds[0] in the draft.
    const byId = new Map(photoRows.map((p) => [p.id, p]));
    const orderedPhotos = photoIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    // Prefer cropped version (tighter on the face → better likeness
    // after the provider's downscale) when available. Photo paths are
    // relative to stored_images/.
    const referenceImages: string[] = [];
    for (const p of orderedPhotos) {
      const rel = p.croppedStoragePath ?? p.storagePath;
      const abs = path.join(process.cwd(), 'stored_images', rel);
      const buf = await fs.readFile(abs);
      referenceImages.push(`data:${p.mimeType};base64,${buf.toString('base64')}`);
    }

    // ── Build front-scene vars ───────────────────────────────────
    const artStyle = resolveStyleDescription(state.style?.mode, state.style?.custom);
    const cardText = buildCardText(state);
    const includeText = cardText.length > 0;

    const resolvedFront = await resolveFrontScenePrompt({
      scenePrompt: state.scene?.description ?? '',
      userArtStyle: artStyle,
      includeText,
      cardText,
      photoMode: orderedPhotos.length > 1 ? 'group' : 'one_person',
      photoCount: orderedPhotos.length,
      // textLayout is NOT set here — the resolver pulls it from the
      // prompt_active row's vars (see Production View). Passing it
      // explicitly would override the admin's choice.
    });

    console.log(
      `[STUDIO_GEN] Front: provider=${resolvedFront.provider ?? 'openai(fallback)'} ` +
        `quality=${resolvedFront.quality ?? 'high(fallback)'} ` +
        `templateId=${resolvedFront.templateId} v=${resolvedFront.templateVersion}`,
    );

    const frontImageUrl = await generateViaActiveConfig({
      cardId,
      resolved: resolvedFront,
      referenceImages,
    });
    const { watermarked: frontWatermarked } = await savePngFiles(
      frontImageUrl,
      cardId,
      'front',
    );

    // ── Build inside-mode vars + resolve the right template ───────
    const insideMode = state.inside?.mode;
    let resolvedInside: ResolvedPrompt | null = null;
    if (insideMode === 'write') {
      const insideText = buildInsideText(state);
      resolvedInside = await resolveInsideWritePrompt({
        insideText,
        artStyle,
      });
    } else if (insideMode === 'blank') {
      resolvedInside = await resolveInsideBlankPrompt({
        insideText: '',
        artStyle,
      });
    }

    let insideWatermarked: string | null = null;
    if (resolvedInside) {
      console.log(
        `[STUDIO_GEN] Inside (${insideMode}): provider=${resolvedInside.provider ?? 'openai(fallback)'} ` +
          `quality=${resolvedInside.quality ?? 'high(fallback)'} ` +
          `templateId=${resolvedInside.templateId} v=${resolvedInside.templateVersion}`,
      );

      // Inside inherits style from the front via image-to-image edit.
      const frontForInside = await loadStoredImageAsBase64(frontWatermarked);
      const insideImageUrl = await generateViaActiveConfig({
        cardId,
        resolved: resolvedInside,
        referenceImages: [frontForInside],
      });
      const saved = await savePngFiles(insideImageUrl, cardId, 'inside');
      insideWatermarked = saved.watermarked;
    }

    // ── Persist + finalise ───────────────────────────────────────
    await storage.updateCard(cardId, {
      frontImageUrl: frontWatermarked,
      insideImageUrl: insideWatermarked,
      status: 'completed',
    });

    console.log(`[STUDIO_GEN] Card ${cardId} completed`);

    // Print-resolution upscale — non-fatal, same as the legacy flow.
    await generatePrintResolutionFiles(cardId);
  } catch (err: any) {
    console.error(`[STUDIO_GEN] Card ${cardId} FAILED:`, err?.message ?? err);
    try {
      await storage.updateCard(cardId, { status: 'failed' });
    } catch (dbErr) {
      console.error(`[STUDIO_GEN] Failed to update status:`, dbErr);
    }
    // Studio UI polls status — no email needed. Rethrow is deliberate
    // NOT done: this is fire-and-forget from the request handler.
  }
}

/** Build the short text rendered on the card front (customer greeting).
 *  Prefers the user-entered `state.front.text` (the Front step lets them
 *  edit the default); falls back to the auto-derived phrase from recipient
 *  + occasion when the user hasn't overridden.
 *
 *  Returns empty string if we can't form a reasonable phrase (or the user
 *  deliberately blanked it) — the front-scene prompt's `includeText` flag
 *  gates the "render text" instruction on non-empty output. */
function buildCardText(state: CardDraftState): string {
  const userText = state.front?.text?.trim();
  if (userText) return userText;
  return deriveDefaultFrontText(state);
}

/** Concatenate the customer's Dear / Message / From fields into the
 *  single `insideText` variable the v1 inside template expects. Salutation
 *  and sign-off are optional decoration — only the message is required
 *  (enforced by isInsideStepReady in the UI). */
function buildInsideText(state: CardDraftState): string {
  const write = state.inside?.write ?? {};
  const parts: string[] = [];
  if (write.salutation?.trim()) parts.push(write.salutation.trim());
  if (write.message?.trim()) parts.push(write.message.trim());
  if (write.signoff?.trim()) parts.push(write.signoff.trim());
  return parts.join('\n\n');
}
