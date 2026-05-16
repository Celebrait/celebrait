import path from 'path';
import { promises as fs } from 'fs';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { storage } from './storage';
import { sendCardReadyEmail, sendGenerationFailedEmail } from './email-service';
import { upsertAddressBookFromCard } from './routes/address-book';
import {
  resolveFrontScenePrompt,
  resolveInsidePrompt,
  resolveInsideWritePrompt,
  resolveInsideBlankPrompt,
  type ResolvedPrompt,
} from './prompts/resolver';
import { getProvider } from './providers/registry';
import { ProviderError, isProviderError, type ProviderErrorKind } from './providers/errors';
import { logGeneration } from './prompts/generation-log';
import { buildRefineInstruction, REFINE_SLOT } from './prompts/refine-scaffolds';
import {
  savePngFiles,
  savePngFilesForAttempt,
  snapshotCanonicalToAttempt,
  loadStoredImageAsBase64,
  generatePrintResolutionFiles,
} from './pipeline/storage/LocalStorageAdapter';
import {
  cards,
  cardAttempts,
  photos,
  users,
  regenSettings,
  type CardDraftState,
  type CardSide,
  type PromptProvider,
  type PromptQuality,
  deriveDefaultFrontText,
} from '@shared/schema';
import { resolveStyleDescription } from '@shared/style-descriptions';
import { openai } from './utils/shared';

// Fallback provider / quality used when the active prompt_active row has
// null values. Matches the hardcoded behaviour this function had before
// Phase 4b so existing cards keep generating unchanged.
const FALLBACK_PROVIDER = 'openai';
const FALLBACK_QUALITY = 'high' as const;
const FALLBACK_SIZE = '1024x1024';

// Regens are pinned to Gemini regardless of what the prompt_active
// row says for the slot's INITIAL gen provider (Kevin's call
// 2026-04-30, after openai-2 + openai v1.5 regens both produced full
// re-renders rather than surgical edits).
//
// Reasoning: Gemini Pro's refine path is genuinely better at "change
// THIS thing, keep everything else". OpenAI's /v1/images/edits is a
// fresh-render-conditioned-on-the-input — preserves nothing reliably.
// Different model strengths for different jobs:
//   - Initial gen: whatever prompt_active says (gemini, openai-2,
//     etc. — currently a mix while testing)
//   - Regen / refine / reroll: resolved per-side via the resolution
//     chain below. Studio admins can edit the active engine at
//     /admin/prompts in the "Regen Settings" card.
//
// Resolution chain in resolveRegenConfig():
//   1. regen_settings DB row for the specific side (front / inside)
//   2. regen_settings DB row for 'global' (applies to both sides)
//   3. REGEN_PROVIDER_ID env var (operator escape hatch)
//   4. Hardcoded 'gemini' default (Pro)
const REGEN_PROVIDER_ID_DEFAULT = 'gemini';

interface RegenConfig {
  providerId: string;
  quality: PromptQuality;
  /** Where the value came from — useful for log lines. */
  source: 'db-side' | 'db-global' | 'env' | 'default';
}

/**
 * Resolves which provider + quality to use for a regen of the given side.
 * See the resolution chain above. Always returns something usable; callers
 * never need to handle a null return.
 */
async function resolveRegenConfig(side: CardSide): Promise<RegenConfig> {
  try {
    const rows = await db.select().from(regenSettings);
    const sideRow = rows.find((r) => r.side === side);
    if (sideRow) {
      return {
        providerId: sideRow.provider as string,
        quality: sideRow.quality as PromptQuality,
        source: 'db-side',
      };
    }
    const globalRow = rows.find((r) => r.side === 'global');
    if (globalRow) {
      return {
        providerId: globalRow.provider as string,
        quality: globalRow.quality as PromptQuality,
        source: 'db-global',
      };
    }
  } catch (err) {
    // DB read failed — log and fall through to env / default. Don't fail
    // the regen because the settings table is unreachable.
    console.warn('[STUDIO_GEN] regen_settings read failed, using env/default:', err);
  }

  if (process.env.REGEN_PROVIDER_ID) {
    return {
      providerId: process.env.REGEN_PROVIDER_ID,
      quality: 'high',
      source: 'env',
    };
  }

  return {
    providerId: REGEN_PROVIDER_ID_DEFAULT,
    quality: 'high',
    source: 'default',
  };
}

// ── DEV: Stub AI mode ────────────────────────────────────────────────
// When DEV_STUB_AI=1, ALL provider calls (initial card generation +
// regen) are short-circuited. Used to test the entire studio flow
// end-to-end without burning credits or waiting on the model — Kevin
// asked for this 2026-04-27 because prompt iteration is moving and
// real generations during UX testing are wasted spend.
//
// What gets stubbed:
//   • generateStudioCard front gen → uses first uploaded photo as
//     the "rendered" front
//   • generateStudioCard inside gen → uses the front image as the
//     "rendered" inside
//   • regenerateStudioCardSide → reuses the prior selected image
//     as the new attempt's image
//
// What does NOT get stubbed (intentionally):
//   • Emails — the recipient-card-arrived email, share-link emails,
//     etc. all fire normally so they can be tested for real
//   • Payment / checkout — uses the existing stub PaymentProvider
//     (separate concern; already a stub regardless of this flag)
//   • Image storage, db writes, watermarking, print-resolution
//     upscale — all run as normal, exercising the rest of the
//     pipeline. The stub only replaces the model call.
//
// Each stub call still:
//   • Writes a generation_log row (cost 0, slot suffixed _stub for
//     telemetry separation)
//   • Creates the card_attempts row (regen path)
//   • Saves per-attempt files via savePngFilesForAttempt
//   • Sleeps STUB_DELAY_MS so the spinner / narration is visible
//
// To enable: `DEV_STUB_AI=1 npm run dev` (or add to .env.local).
// Restart to disable. Status logged at server boot.
// Stub-mode state — initialised from env at boot, toggleable at runtime
// via the dev panel. Restart reverts to env. Call sites use isStubMode()
// instead of reading process.env directly so the toggle can flip without
// a restart.
let stubModeOn = process.env.DEV_STUB_AI === '1';

if (stubModeOn) {
  console.warn(
    '[STUDIO_GEN] ⚠ DEV_STUB_AI is ON — initial gens AND regens will skip ' +
      'the provider and reuse the user photo / prior image. Emails still fire ' +
      'normally. Toggle off via the dev panel or unset DEV_STUB_AI.',
  );
}

/** True when stub mode is on (env or runtime override). Use at every
 *  stub branch instead of capturing the env value at module load. */
export function isStubMode(): boolean {
  return stubModeOn;
}

/** Runtime toggle for stub mode. Used by the dev panel. No-op in
 *  production. Doesn't persist across restarts (boot reads env again). */
export function setStubMode(on: boolean): void {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[STUDIO_GEN] Ignored stub-mode toggle attempt in production');
    return;
  }
  stubModeOn = on;
  console.log(`[STUDIO_GEN] Stub mode ${on ? 'ENABLED' : 'DISABLED'} via runtime toggle`);
}

// ── DEV: Test-failure injection ──────────────────────────────────────
// When DEV_STUB_AI=1, the dev test panel can call injectNextTestFailure()
// to force the next stub-mode gen call to throw a synthetic ProviderError
// of the chosen kind instead of returning the happy stub result. Used to
// iterate on the GenerationErrorPanel UI without burning real tokens or
// crafting prompts that actually trip the safety filter.
//
// Auto-clears after one consumption so the next gen succeeds normally
// (lets Kevin test "fail then retry" in one session).
//
// Production guard: injectNextTestFailure is a no-op outside dev. Calls
// from a non-dev context get logged + ignored.
let nextTestFailureKind: ProviderErrorKind | null = null;

export function injectNextTestFailure(kind: ProviderErrorKind | null): void {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[TEST_FAILURE] Ignored injection attempt in production');
    return;
  }
  nextTestFailureKind = kind;
  if (kind) {
    console.log(`[TEST_FAILURE] Next stub gen will fail with kind=${kind}`);
  } else {
    console.log('[TEST_FAILURE] Cleared');
  }
}

/** Throw a synthetic ProviderError if a test-failure has been injected.
 *  Auto-clears the injection after one consumption. Called at the top of
 *  each stub branch in the generator. No-op when no failure is queued. */
function maybeThrowTestFailure(providerId: string): void {
  if (!nextTestFailureKind) return;
  const kind = nextTestFailureKind;
  nextTestFailureKind = null; // consume

  const httpStatus =
    kind === 'safety' ? 400
    : kind === 'rate' ? 429
    : kind === 'auth' ? 401
    : kind === 'server' ? 503
    : 500;

  const modelExplanation =
    kind === 'safety'
      ? '[DEV TEST] Pretending this is OpenAI: "Your request was rejected by the safety system. If you believe this is an error, contact us at help.openai.com and include the request ID req_test_synthetic."'
      : null;

  console.log(`[TEST_FAILURE] Throwing synthetic ${kind} ProviderError`);

  throw new ProviderError({
    kind,
    code: `test_${kind}`,
    message: `[DEV TEST] Synthetic ${kind} failure — injected via dev test panel`,
    retryable: kind === 'server',
    modelExplanation,
    httpStatus,
    provider: `${providerId}-test`,
  });
}

/** Artificial delay per stubbed model call so the spinner / narration
 *  is still observable — instant returns make the UX impossible to
 *  test. 1.5s is long enough to read the state, short enough to iterate
 *  fast. With both initial-gen sides stubbed (front + inside) the total
 *  E2E "create a card" flow is ~3-4s rather than ~45s real. */
const STUB_DELAY_MS = 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

    let frontUrl: string | null = null;
    let frontOriginal: string | null = null;
    let insideUrl: string | null = null;
    let insideOriginal: string | null = null;

    // --- FRONT CARD ---
    // ── ACTIVE PATH: scene generation (the only supported flow) ──
    if (generationType === 'scene' && params.imageDataArray?.length) {
      // Legacy flow predates variant split — single-photo card, always
      // one_person. If multi-photo ever reaches this code path the
      // Studio flow above is the one to thread photoMode through instead.
      const resolvedFront = await resolveFrontScenePrompt({
        scenePrompt: params.scenePrompt || '',
        userArtStyle: params.userArtStyle,
        userClothing: params.userClothing,
        includeText: params.includeText,
        cardText: params.cardText,
        photoMode: 'one_person',
        photoCount: params.imageDataArray.length,
      });

      console.log(
        `[BG_GEN] Generating front for card ${cardId} via provider=${resolvedFront.provider ?? FALLBACK_PROVIDER} ` +
          `quality=${resolvedFront.quality ?? FALLBACK_QUALITY} ` +
          `variant=${resolvedFront.variant ?? 'null'} ` +
          `(prompt source=${resolvedFront.source}, templateId=${resolvedFront.templateId}, v=${resolvedFront.templateVersion})`,
      );
      const sceneImageUrl = await generateViaActiveConfig({
        cardId,
        resolved: resolvedFront,
        referenceImages: params.imageDataArray,
      });
      frontUrl = await savePngFiles(sceneImageUrl, cardId, 'front');
      frontOriginal = sceneImageUrl;

    } else {
      console.error(`[BG_GEN] Unsupported generation type or missing images: ${generationType}`);
      await storage.updateCard(cardId, { status: 'failed' });
      await sendGenerationFailedEmail(userEmail, userName, cardId);
      return;
    }

    // --- INSIDE CARD ---
    const insideText = params.insideText || answers.inside_message;
    if (insideText && frontUrl) {
      const artStyle = params.artStyle || params.userArtStyle || 'artistic';
      const resolvedInside = await resolveInsidePrompt({ insideText, artStyle });

      console.log(
        `[BG_GEN] Generating inside for card ${cardId} via provider=${resolvedInside.provider ?? FALLBACK_PROVIDER} ` +
          `quality=${resolvedInside.quality ?? FALLBACK_QUALITY} ` +
          `(prompt source=${resolvedInside.source}, templateId=${resolvedInside.templateId}, v=${resolvedInside.templateVersion})`,
      );

      // Read the front PNG file for use as reference — the inside card
      // inherits the front's style via the image-to-image edit path.
      const frontImageForInside = await loadStoredImageAsBase64(frontUrl);

      const insideImageUrl = await generateViaActiveConfig({
        cardId,
        resolved: resolvedInside,
        referenceImages: [frontImageForInside],
      });
      insideUrl = await savePngFiles(insideImageUrl, cardId, 'inside');
      insideOriginal = insideImageUrl;
    }

    // --- UPDATE CARD IN DB ---
    // Note: `originalFront/InsideImageUrl` retained for any legacy
    // conversationData consumers; the `watermarked*ImageUrl` keys are
    // gone since there's no longer a watermarked variant. Modern reads
    // should use `frontImageUrl` / `insideImageUrl` on the cards row.
    const conversationData = {
      ...answers,
      uploadedPhotoIds: uploadedPhotoIds || [],
      originalFrontImageUrl: frontOriginal,
      originalInsideImageUrl: insideOriginal,
    };

    await storage.updateCard(cardId, {
      frontImageUrl: frontUrl,
      insideImageUrl: insideUrl,
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

    // photoMode is read from the draft state — the user picked it on
    // the Studio photo step. Legacy drafts predate the toggle, so we
    // fall back to one_person (the overwhelmingly common case).
    const photoMode = state.photos?.mode ?? 'one_person';

    const resolvedFront = await resolveFrontScenePrompt({
      scenePrompt: state.scene?.description ?? '',
      userArtStyle: artStyle,
      includeText,
      cardText,
      photoMode,
      photoCount: orderedPhotos.length,
      // textLayout is NOT set here — the resolver pulls it from the
      // prompt_active row's vars (see Production View). Passing it
      // explicitly would override the admin's choice.
    });

    console.log(
      `[STUDIO_GEN] Front: provider=${resolvedFront.provider ?? 'openai(fallback)'} ` +
        `quality=${resolvedFront.quality ?? 'high(fallback)'} ` +
        `variant=${resolvedFront.variant ?? 'null'} ` +
        `templateId=${resolvedFront.templateId} v=${resolvedFront.templateVersion}`,
    );

    // ── DEV STUB or REAL ─────────────────────────────────────────────
    // Stub mode (DEV_STUB_AI=1) reuses the first reference photo as the
    // "rendered" front so the user's identity stays in the placeholder.
    // Logs to generation_log with a _stub slot suffix and 0 cost so
    // Cost Ledger / spend telemetry stays clean.
    let frontImageUrl: string;
    if (isStubMode() && referenceImages[0]) {
      maybeThrowTestFailure(resolvedFront.provider ?? FALLBACK_PROVIDER);
      await sleep(STUB_DELAY_MS);
      frontImageUrl = referenceImages[0];
      await logGeneration({
        cardId,
        slot: 'front_scene_stub',
        templateId: resolvedFront.templateId,
        templateVersion: resolvedFront.templateVersion,
        provider: `${resolvedFront.provider ?? FALLBACK_PROVIDER}-stub`,
        model: 'stub',
        quality: resolvedFront.quality ?? FALLBACK_QUALITY,
        costCents: 0,
        durationMs: STUB_DELAY_MS,
        success: true,
      });
      console.log(`[STUDIO_GEN] STUB front for card ${cardId} (no provider call, $0)`);
    } else {
      frontImageUrl = await generateViaActiveConfig({
        cardId,
        resolved: resolvedFront,
        referenceImages,
      });
    }
    const frontStoredUrl = await savePngFiles(frontImageUrl, cardId, 'front');

    // Persist the front URL immediately while the inside is still
    // drafting. The client's polling loop can now reveal the rendered
    // front mid-flight (Stage 2 of the GeneratingView) instead of
    // waiting another ~20s for the whole card to complete. Status
    // stays 'generating' — the final updateCard below flips it to
    // 'completed' once the inside has landed (or if inside is skipped).
    await storage.updateCard(cardId, {
      frontImageUrl: frontStoredUrl,
    });

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

    let insideStoredUrl: string | null = null;
    if (resolvedInside) {
      console.log(
        `[STUDIO_GEN] Inside (${insideMode}): provider=${resolvedInside.provider ?? 'openai(fallback)'} ` +
          `quality=${resolvedInside.quality ?? 'high(fallback)'} ` +
          `templateId=${resolvedInside.templateId} v=${resolvedInside.templateVersion}`,
      );

      // Inside inherits style from the front via image-to-image edit.
      const frontForInside = await loadStoredImageAsBase64(frontStoredUrl);
      let insideImageUrl: string;
      if (isStubMode()) {
        maybeThrowTestFailure(resolvedInside.provider ?? FALLBACK_PROVIDER);
        await sleep(STUB_DELAY_MS);
        insideImageUrl = frontForInside; // reuse the front as the inside
        await logGeneration({
          cardId,
          slot: `${insideMode === 'write' ? 'inside_write' : 'inside_blank'}_stub`,
          templateId: resolvedInside.templateId,
          templateVersion: resolvedInside.templateVersion,
          provider: `${resolvedInside.provider ?? FALLBACK_PROVIDER}-stub`,
          model: 'stub',
          quality: resolvedInside.quality ?? FALLBACK_QUALITY,
          costCents: 0,
          durationMs: STUB_DELAY_MS,
          success: true,
        });
        console.log(`[STUDIO_GEN] STUB inside for card ${cardId} (no provider call, $0)`);
      } else {
        insideImageUrl = await generateViaActiveConfig({
          cardId,
          resolved: resolvedInside,
          referenceImages: [frontForInside],
        });
      }
      insideStoredUrl = await savePngFiles(insideImageUrl, cardId, 'inside');
    }

    // ── Persist + finalise ───────────────────────────────────────
    await storage.updateCard(cardId, {
      frontImageUrl: frontStoredUrl,
      insideImageUrl: insideStoredUrl,
      status: 'completed',
    });

    console.log(`[STUDIO_GEN] Card ${cardId} completed`);

    // Print-resolution upscale — non-fatal, same as the legacy flow.
    await generatePrintResolutionFiles(cardId);

    // ── Notify the sender that their card is ready ─────────────────
    // Studio's biggest funnel-recovery email: the user kicked off a
    // ~45s generation and may have navigated away. Without this,
    // the success path was silent (Comms PR1 audit, 2026-04-28).
    // Non-fatal — generation succeeded, the email is icing.
    try {
      await sendCardReadyEmailForCard(cardId, state, row.userId);
    } catch (mailErr) {
      console.error(`[STUDIO_GEN] card-ready email failed for ${cardId}:`, mailErr);
    }

    // ── Auto-save the recipient into the address book ──────────────
    // First-card-for-Mum lands her in /studio/people/address-book
    // automatically. Future cards typeahead-suggest her name. Fire-
    // and-forget — failure is a quality-of-life dip, not a card-
    // generation failure. See routes/address-book.ts for the dedup
    // logic (case-insensitive name match, no-op if entry exists).
    try {
      await upsertAddressBookFromCard(cardId);
    } catch (abErr) {
      console.error(`[STUDIO_GEN] address-book upsert failed for ${cardId}:`, abErr);
    }
  } catch (err: any) {
    console.error(`[STUDIO_GEN] Card ${cardId} FAILED:`, err?.message ?? err);
    try {
      // Persist failure metadata when we have a typed ProviderError so
      // <GenerationErrorPanel> can render kind-specific copy + suggestions
      // instead of the generic "didn't land" view. Plain Errors fall
      // through to status='failed' with metadata null — the panel's
      // generic fallback handles those.
      const failurePayload = isProviderError(err)
        ? {
            status: 'failed' as const,
            failureKind: err.kind,
            failureMessage: err.message,
            failureModelExplanation: err.modelExplanation,
            failureProvider: err.provider,
            failureCode: err.code,
            failureSuggestions: err.suggestions,
            failureAt: new Date(),
          }
        : { status: 'failed' as const };
      await db
        .update(cards)
        .set(failurePayload)
        .where(eq(cards.id, cardId));
    } catch (dbErr) {
      console.error(`[STUDIO_GEN] Failed to update status:`, dbErr);
    }
    // Studio UI polls status — no email needed. Rethrow is deliberate
    // NOT done: this is fire-and-forget from the request handler.
  }
}

/** Look up the sender + fire the card-ready email. Tolerant of
 *  missing data (anonymous draft, user without firstName) — fall back
 *  to email-prefix as the greeting name so we never address a real
 *  email "Hi kevin@adc.business,". Returns silently on any miss; the
 *  caller logs failures.
 *
 *  Pulled out of the success branch for readability; lives here rather
 *  than in email-service.ts because the lookup is Studio-specific. */
async function sendCardReadyEmailForCard(
  cardId: number,
  state: CardDraftState,
  userId: string | null,
): Promise<void> {
  if (!userId) return; // anonymous / orphaned draft; nothing to email

  const userRows = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user?.email) return;

  // displayName fallback: user.firstName → email-local-part. Beats
  // "Hi kevin@adc.business," in the inbox if the capture flow hasn't
  // populated firstName yet.
  const senderName =
    user.firstName?.trim() ||
    user.email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ||
    null;

  await sendCardReadyEmail({
    senderEmail: user.email,
    senderName,
    recipientName: state.recipient?.name?.trim() || null,
    occasion: state.recipient?.occasion?.trim() || null,
    cardId,
  });
}

/** Build the short text rendered on the card front (customer greeting).
 *  Prefers the user-entered `state.front.text` (the Front step lets them
 *  edit the default); falls back to the auto-derived phrase from recipient
 *  + occasion when the user hasn't overridden.
 *
 *  Returns empty string if:
 *    - The user explicitly opted out via `state.front.mode === 'none'`
 *      (added 2026-04-27 — mirrors inside.mode='blank'). Front-scene prompt's
 *      `includeText` flag gates the "render text" instruction on non-empty
 *      output, so empty here = scene rendered with no headline.
 *    - We can't form any reasonable phrase from recipient + occasion. */
function buildCardText(state: CardDraftState): string {
  if (state.front?.mode === 'none') return '';
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

// ─────────────────────────────────────────────────────────────────────
// REGEN — per-side generation
//
// User regen flow (from /api/studio/drafts/:id/regenerate):
//   1. Server validates ownership + soft cap
//   2. Inserts a card_attempts row (status='generating', attemptNumber++)
//   3. Builds the resolved prompt for THIS side, optionally folding a
//      user tweak into the relevant input via applySceneTweak /
//      applyInsideStyleTweak (gpt-4o-mini)
//   4. Runs the provider, savePngFiles
//   5. Updates the attempt row → 'completed' with image url/path
//   6. Promotes: cards.{front|inside}ImageUrl + selectedFrontAttemptId /
//      selectedInsideAttemptId point at this attempt
//
// On failure: attempt row gets status='failed', cards stays untouched —
// the previously selected attempt remains the displayed one. Client
// sees the failed attempt's status and shows the error toast.
//
// generateStudioCard (initial generation) does NOT yet write
// card_attempts rows — that backfill happens lazily on first regen
// (we synthesize attempt #1 from the existing cards.* columns). This
// keeps the initial-gen path untouched and avoids data backfill of
// existing rows.
// ─────────────────────────────────────────────────────────────────────

/** LLM-rewrite a scene description to integrate a user's tweak. Used
 *  on front regens with a tweak. Falls back to "{original}. {tweak}"
 *  if OpenAI is unavailable so the regen still runs (degraded). */
async function applySceneTweak(
  originalScene: string,
  tweak: string,
): Promise<string> {
  if (!openai) return `${originalScene}. ${tweak}`;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You rewrite scene descriptions for a personalised greeting card. Take the original scene + the user tweak, return ONE coherent paragraph that integrates the tweak. The tweak may add detail, change atmosphere, or substitute elements (e.g. "change the dog to a cat"). When substituting, REMOVE the original element. Keep the recipient and core subject intact unless the tweak says otherwise. 30-60 words. Plain prose. No quotes, no preamble.',
        },
        {
          role: 'user',
          content: `Original scene: ${originalScene}\n\nUser tweak: ${tweak}\n\nReturn the rewritten scene only.`,
        },
      ],
      temperature: 0.6,
      max_tokens: 200,
    });
    const out = completion.choices[0]?.message?.content?.trim();
    return out && out.length > 0 ? out : `${originalScene}. ${tweak}`;
  } catch (err) {
    console.warn('[STUDIO_GEN] applySceneTweak fallback:', err);
    return `${originalScene}. ${tweak}`;
  }
}

/** LLM-rewrite an art-style description to integrate a user's tweak.
 *  Inside-side tweaks affect the *rendering style* of the inside (e.g.
 *  "tidier handwriting", "warmer tone") not the message text itself,
 *  which the user wrote and we don't touch. */
async function applyInsideStyleTweak(
  originalStyle: string,
  tweak: string,
): Promise<string> {
  if (!openai) return `${originalStyle}. ${tweak}`;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You rewrite an art-style description for the inside of a personalised greeting card. Take the original style + a user tweak, return ONE coherent line that integrates the tweak. Tweaks affect handwriting style, layout, atmosphere, palette — NOT the message text. 15-30 words. Plain prose. No quotes, no preamble.',
        },
        {
          role: 'user',
          content: `Original style: ${originalStyle}\n\nUser tweak: ${tweak}\n\nReturn the rewritten style description only.`,
        },
      ],
      temperature: 0.6,
      max_tokens: 100,
    });
    const out = completion.choices[0]?.message?.content?.trim();
    return out && out.length > 0 ? out : `${originalStyle}. ${tweak}`;
  } catch (err) {
    console.warn('[STUDIO_GEN] applyInsideStyleTweak fallback:', err);
    return `${originalStyle}. ${tweak}`;
  }
}

/** Hard cap on regens per (card, side). Effectively lifted for now
 *  (Kevin's call 2026-05-05) — set to 999 so iteration during the
 *  pre-launch testing window isn't blocked. Real strategy + tier
 *  thresholds revisit pre-launch as part of the pricing/regen-economics
 *  work (see memory: next_pricing_and_regen_economics.md).
 *
 *  Override at runtime via the REGEN_CAP_PER_SIDE env var; default 999
 *  is "unbounded for testing." Production launch should drop this
 *  back to a sane value (10–20) once paid usage is in.
 *
 *  Kept here rather than in the route so the limit lives next to the
 *  gen path that enforces it. The route also pre-checks and returns a
 *  friendly 429 when hit. */
export const REGEN_HARD_CAP_PER_SIDE: number =
  parseInt(process.env.REGEN_CAP_PER_SIDE ?? '999', 10) || 999;

/** Look up the next attempt number for (card, side). Used both by the
 *  regen entry point AND by the lazy backfill of attempt #1 on first
 *  regen of a card whose initial gen predated this table. */
async function getNextAttemptNumber(
  cardId: number,
  side: CardSide,
): Promise<number> {
  const rows = await db
    .select({ attemptNumber: cardAttempts.attemptNumber })
    .from(cardAttempts)
    .where(and(eq(cardAttempts.cardId, cardId), eq(cardAttempts.side, side)))
    .orderBy(desc(cardAttempts.attemptNumber))
    .limit(1);
  const last = rows[0]?.attemptNumber ?? 0;
  return last + 1;
}

/** Before the first regen on a side, the existing cards.{front|inside}
 *  image is "attempt #1" — but no card_attempts row exists for it yet.
 *  Insert one so the versions strip can show v1 and let the user
 *  switch back if their regen turns out worse. */
async function ensureInitialAttemptRow(
  cardId: number,
  side: CardSide,
): Promise<void> {
  const existing = await db
    .select({ id: cardAttempts.id })
    .from(cardAttempts)
    .where(and(eq(cardAttempts.cardId, cardId), eq(cardAttempts.side, side)))
    .limit(1);
  if (existing.length > 0) return;

  const cardRows = await db
    .select({
      front: cards.frontImageUrl,
      frontPath: cards.frontImagePath,
      inside: cards.insideImageUrl,
      insidePath: cards.insideImagePath,
    })
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  const card = cardRows[0];
  if (!card) return;

  const url = side === 'front' ? card.front : card.inside;
  const filePath = side === 'front' ? card.frontPath : card.insidePath;
  if (!url && !filePath) return; // nothing to backfill

  // Insert with canonical url/path for now — we may swap to a
  // per-attempt path once we've snapshotted the file below. Without
  // its own file, attempt #1 would silently mutate every time the
  // user regens (canonical filename gets overwritten), so the
  // versions strip would lie.
  const [inserted] = await db
    .insert(cardAttempts)
    .values({
      cardId,
      side,
      attemptNumber: 1,
      imageUrl: url,
      imagePath: filePath,
      status: 'completed',
    })
    .returning({ id: cardAttempts.id });
  if (!inserted) return;

  // Snapshot the current canonical PNG into a per-attempt file
  // (card_X_front_a{id}.png) so attempt #1 is preserved when later
  // regens overwrite the canonical filename. If the canonical file
  // doesn't exist on disk (only frontImageUrl was set, e.g. legacy
  // pre-storage cards) this no-ops and the attempt keeps its
  // original url — selectAttempt back to it later will grab whatever
  // the URL points at, which is the best we can do for those rows.
  const snapshotted = await snapshotCanonicalToAttempt(cardId, side, inserted.id);
  if (snapshotted) {
    await db
      .update(cardAttempts)
      .set({
        imageUrl: `/images/${snapshotted}`,
        imagePath: snapshotted,
      })
      .where(eq(cardAttempts.id, inserted.id));
  }

  // Point the selected_*_attempt_id at the backfilled attempt so the
  // UI knows which version is currently displayed.
  await db
    .update(cards)
    .set(
      side === 'front'
        ? { selectedFrontAttemptId: inserted.id }
        : { selectedInsideAttemptId: inserted.id },
    )
    .where(eq(cards.id, cardId));
}

export interface RegenerateOptions {
  /** Optional user tweak — folded into the relevant input (scene
   *  description for front; art-style description for inside) via
   *  an LLM rewrite. Empty / null → pure regen, same prompt, new
   *  attempt. */
  tweak?: string;
}

/**
 * Synchronous setup phase of a regen — backfills attempt #1 if needed,
 * allocates the next attempt number, inserts a new row in 'generating'
 * state, and returns the new attemptId + attemptNumber. Cheap (a few
 * DB operations); intended to be awaited by the route so the response
 * can return immediately with the attemptId for the client to poll.
 *
 * The actual generation work (provider call, file save, attempt-state
 * update) lives in {@link runRegenAttempt} and runs separately — fire-
 * and-forget from the route, polling-driven from the client.
 *
 * Split out 2026-05-15 to fix the regen "spinner stalls" UX bug. The
 * old monolithic regenerateStudioCardSide() awaited the entire 3–5min
 * gen, which kept the API request — and the client mutation's
 * `isPending` — alive for the full duration. Splitting separates the
 * API duration from the gen duration; the client now derives spinner
 * state from polled attempt status, not from the request lifecycle.
 */
export async function createRegenAttemptRow(
  cardId: number,
  side: CardSide,
  options: RegenerateOptions = {},
): Promise<{ attemptId: number; attemptNumber: number }> {
  console.log(`[STUDIO_GEN] Create regen attempt row: ${side} for card ${cardId}`, {
    hasTweak: !!options.tweak,
  });

  // ── Backfill attempt #1 if missing (legacy / pre-attempts cards) ─
  await ensureInitialAttemptRow(cardId, side);

  // ── Allocate next attempt number ──────────────────────────────────
  const attemptNumber = await getNextAttemptNumber(cardId, side);
  if (attemptNumber > REGEN_HARD_CAP_PER_SIDE + 1) {
    // +1 because attempt #1 is the original; the hard cap counts
    // regens. caller (route) should pre-check, but defence in depth.
    throw new Error(`Hard cap reached for ${side} on card ${cardId}`);
  }

  // ── Insert attempt row in 'generating' state ──────────────────────
  const [attempt] = await db
    .insert(cardAttempts)
    .values({
      cardId,
      side,
      attemptNumber,
      tweak: options.tweak?.trim() || null,
      status: 'generating',
    })
    .returning({ id: cardAttempts.id });
  if (!attempt) throw new Error('Failed to create attempt row');
  return { attemptId: attempt.id, attemptNumber };
}

/**
 * Async work phase of a regen — does the heavy lifting: load draft +
 * photos, build prompt, call provider (3-5min on high-quality gpt-
 * image-2), save image files, update the attempt row to 'completed'
 * or 'failed', and promote the new attempt as the card's selected
 * version on success.
 *
 * Caller must already have created the attempt row via
 * {@link createRegenAttemptRow} (which returns the attemptId).
 *
 * On error: attempt row is updated to status='failed' with errorCode
 * before re-throwing. The throw lets fire-and-forget callers catch +
 * log; client polling will see status='failed' regardless.
 */
export async function runRegenAttempt(
  attemptId: number,
  attemptNumber: number,
  cardId: number,
  side: CardSide,
  options: RegenerateOptions = {},
): Promise<void> {
  try {
    // ── Load draft state + photos ────────────────────────────────────
    const cardRows = await db
      .select({
        conversationData: cards.conversationData,
        frontImageUrl: cards.frontImageUrl,
        frontImagePath: cards.frontImagePath,
        insideImageUrl: cards.insideImageUrl,
        insideImagePath: cards.insideImagePath,
      })
      .from(cards)
      .where(eq(cards.id, cardId))
      .limit(1);
    const card = cardRows[0];
    if (!card) throw new Error(`Card ${cardId} not found`);
    const state = card.conversationData as CardDraftState | null;
    if (!state || state.version !== 1) throw new Error('No valid draft state');

    const photoIds = state.photos?.photoIds ?? [];
    const photoRows = photoIds.length
      ? await db.select().from(photos).where(inArray(photos.id, photoIds))
      : [];
    const byId = new Map(photoRows.map((p) => [p.id, p]));
    const orderedPhotos = photoIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    const referenceImages: string[] = [];
    for (const p of orderedPhotos) {
      const rel = p.croppedStoragePath ?? p.storagePath;
      const abs = path.join(process.cwd(), 'stored_images', rel);
      const buf = await fs.readFile(abs);
      referenceImages.push(`data:${p.mimeType};base64,${buf.toString('base64')}`);
    }

    // ── Build prompt + generate (per-side branching) ────────────────
    const baseArtStyle = resolveStyleDescription(
      state.style?.mode,
      state.style?.custom,
    );
    const cardText = buildCardText(state);
    const includeText = cardText.length > 0;
    const photoMode = state.photos?.mode ?? 'one_person';

    let generatedDataUrl: string;
    if (side === 'front') {
      // Resolve the front-scene template once. We need it either way:
      //   • the refine path uses it only to know which provider is
      //     active (Gemini in production, per prompt_active)
      //   • the re-roll path uses both the prompt text + provider
      const baseScene = state.scene?.description ?? '';
      const scene = options.tweak
        ? await applySceneTweak(baseScene, options.tweak)
        : baseScene;
      const resolvedFront = await resolveFrontScenePrompt({
        scenePrompt: scene,
        userArtStyle: baseArtStyle,
        includeText,
        cardText,
        photoMode,
        photoCount: orderedPhotos.length,
      });

      // REGEN provider override — resolved through DB → env → default
      // chain. See resolveRegenConfig() at the top of this file.
      const regenCfg = await resolveRegenConfig('front');
      const providerId = regenCfg.providerId;
      console.log(
        `[STUDIO_GEN] regen front using provider=${providerId} ` +
          `quality=${regenCfg.quality} (source=${regenCfg.source})`,
      );
      const provider = getProvider(providerId);

      const priorFrontDataUrl = card.frontImagePath
        ? await loadStoredImageAsBase64(`/images/${card.frontImagePath}`)
        : card.frontImageUrl
          ? await loadStoredImageAsBase64(card.frontImageUrl)
          : null;

      // ── DEV STUB PATH ──────────────────────────────────────────────
      // Skip the provider call entirely when DEV_STUB_REGEN=1. Returns
      // the prior front image as the "new" output — same image, new
      // attempt row, new file URL, fast + free. Lets us iterate on the
      // edit-mode UX without burning $0.13 + 30s per regen.
      if (isStubMode() && priorFrontDataUrl) {
        maybeThrowTestFailure(providerId);
        await sleep(STUB_DELAY_MS);
        await logGeneration({
          cardId,
          slot: `${REFINE_SLOT.front}_stub`,
          templateId: null,
          templateVersion: null,
          provider: providerId,
          model: `${provider.model}-stub`,
          quality: resolvedFront.quality ?? FALLBACK_QUALITY,
          costCents: 0,
          durationMs: STUB_DELAY_MS,
          success: true,
        });
        generatedDataUrl = priorFrontDataUrl;
        console.log(
          `[STUDIO_GEN] STUB regen front for card ${cardId} (no provider call, $0)`,
        );
      } else if (options.tweak && provider.refine && priorFrontDataUrl) {
      // ── REFINE PATH ────────────────────────────────────────────────
      // When the user supplies a tweak AND the active provider supports
      // image editing (Gemini does via generateContent's multi-part
      // input — see GeminiImageProvider.refine), use the edit endpoint:
      // base image = the prior selected front, instruction = the user's
      // tweak. This preserves composition, character likeness and
      // on-card text while only changing what the tweak asks for.
      // It's what the Prompt Lab does, and what Kevin expected when he
      // tried "santa outfit" and got a totally re-rendered card with
      // a new face and broken text.
      //
      // We deliberately do NOT pass the LLM-rewritten scene to refine —
      // that's a "create a new card with this scene" prompt, which
      // pulls the model away from edit mode. The raw user tweak is
      // tighter and more reliably image-anchored.
        // Wrapper text comes from the shared module (refine-scaffolds.ts)
        // so the Prompt Lab's /test-refine route uses the exact same
        // instruction. Iterate on the wrapper there, not here. Inline
        // strings are a smell — see project_prompt_lab_first.md.
        const editInstruction = buildRefineInstruction('front', options.tweak);

        try {
          const result = await provider.refine(
            priorFrontDataUrl,
            editInstruction,
            referenceImages, // raw photos as identity anchors
          );
          await logGeneration({
            cardId,
            slot: REFINE_SLOT.front,
            templateId: null,
            templateVersion: null,
            provider: result.provider,
            model: result.model,
            quality: resolvedFront.quality ?? FALLBACK_QUALITY,
            costCents: result.costCents,
            durationMs: result.durationMs,
            success: true,
          });
          generatedDataUrl = result.imageUrl;
          console.log(
            `[STUDIO_GEN] Regen front via refine() (provider=${providerId}, tweak="${options.tweak.slice(0, 60)}")`,
          );
        } catch (err: any) {
          await logGeneration({
            cardId,
            slot: REFINE_SLOT.front,
            templateId: null,
            templateVersion: null,
            provider: providerId,
            model: provider.model,
            quality: resolvedFront.quality ?? FALLBACK_QUALITY,
            costCents: 0,
            durationMs: 0,
            success: false,
            errorCode: err?.kind ?? err?.code ?? 'unknown',
          });
          throw err;
        }
      } else {
        // ── RE-ROLL PATH ────────────────────────────────────────────
        // No tweak, or provider can't refine, or no prior front to
        // refine from (legacy data). Run the regular front-scene
        // generation against the original photos — produces a fresh
        // composition, which is what the user wants when they hit
        // "Try again" without a tweak.
        generatedDataUrl = await generateViaActiveConfig({
          cardId,
          resolved: resolvedFront,
          referenceImages,
        });
      }
    } else {
      const insideMode = state.inside?.mode;
      if (insideMode !== 'write' && insideMode !== 'blank') {
        throw new Error(`Inside mode is ${insideMode}; nothing to regen`);
      }
      const tweakedStyle = options.tweak
        ? await applyInsideStyleTweak(baseArtStyle, options.tweak)
        : baseArtStyle;
      const resolvedInside =
        insideMode === 'write'
          ? await resolveInsideWritePrompt({
              insideText: buildInsideText(state),
              artStyle: tweakedStyle,
            })
          : await resolveInsideBlankPrompt({
              insideText: '',
              artStyle: tweakedStyle,
            });

      // Inside takes the FRONT image as its style reference (image-to-
      // image so the inside reads as the same artist's hand as the front).
      if (!card.frontImageUrl && !card.frontImagePath) {
        throw new Error('Cannot regen inside before front exists');
      }
      const frontRef = card.frontImagePath
        ? await loadStoredImageAsBase64(`/images/${card.frontImagePath}`)
        : await loadStoredImageAsBase64(card.frontImageUrl!);

      // REGEN provider override — resolved per-side through DB → env
      // → default chain. See resolveRegenConfig() at top of file.
      const insideRegenCfg = await resolveRegenConfig('inside');
      const insideProviderId = insideRegenCfg.providerId;
      console.log(
        `[STUDIO_GEN] regen inside using provider=${insideProviderId} ` +
          `quality=${insideRegenCfg.quality} (source=${insideRegenCfg.source})`,
      );
      const insideProvider = getProvider(insideProviderId);

      const priorInsideDataUrl = card.insideImagePath
        ? await loadStoredImageAsBase64(`/images/${card.insideImagePath}`)
        : card.insideImageUrl
          ? await loadStoredImageAsBase64(card.insideImageUrl)
          : null;

      // Same refine-vs-reroll branching as the front. Inside tweaks
      // ("tidier handwriting", "warmer tone") almost always want the
      // existing inside preserved with a focused edit — using refine
      // gives that. The front image rides along as a style anchor so
      // the two sides stay visually linked even mid-edit.
      //
      // DEV STUB: same short-circuit as the front regen — reuse the
      // prior inside as the new attempt's image, log to generation_log
      // with _stub slot suffix and 0 cost, sleep so the spinner shows.
      if (isStubMode() && priorInsideDataUrl) {
        maybeThrowTestFailure(insideProviderId);
        await sleep(STUB_DELAY_MS);
        await logGeneration({
          cardId,
          slot: `${REFINE_SLOT.inside}_stub`,
          templateId: null,
          templateVersion: null,
          provider: insideProviderId,
          model: `${insideProvider.model}-stub`,
          quality: resolvedInside.quality ?? FALLBACK_QUALITY,
          costCents: 0,
          durationMs: STUB_DELAY_MS,
          success: true,
        });
        generatedDataUrl = priorInsideDataUrl;
        console.log(
          `[STUDIO_GEN] STUB regen inside for card ${cardId} (no provider call, $0)`,
        );
      } else if (options.tweak && insideProvider.refine && priorInsideDataUrl) {
        // Same shared wrapper as the front path; sided semantics live
        // in buildRefineInstruction. See refine-scaffolds.ts.
        const editInstruction = buildRefineInstruction('inside', options.tweak);
        try {
          const result = await insideProvider.refine(
            priorInsideDataUrl,
            editInstruction,
            [frontRef], // style anchor
          );
          await logGeneration({
            cardId,
            slot: REFINE_SLOT.inside,
            templateId: null,
            templateVersion: null,
            provider: result.provider,
            model: result.model,
            quality: resolvedInside.quality ?? FALLBACK_QUALITY,
            costCents: result.costCents,
            durationMs: result.durationMs,
            success: true,
          });
          generatedDataUrl = result.imageUrl;
          console.log(
            `[STUDIO_GEN] Regen inside via refine() (provider=${insideProviderId}, tweak="${options.tweak.slice(0, 60)}")`,
          );
        } catch (err: any) {
          await logGeneration({
            cardId,
            slot: REFINE_SLOT.inside,
            templateId: null,
            templateVersion: null,
            provider: insideProviderId,
            model: insideProvider.model,
            quality: resolvedInside.quality ?? FALLBACK_QUALITY,
            costCents: 0,
            durationMs: 0,
            success: false,
            errorCode: err?.kind ?? err?.code ?? 'unknown',
          });
          throw err;
        }
      } else {
        // No tweak (clean re-roll) or no prior inside / refine support.
        // Run the regular inside template against the front as a style
        // reference — same path the initial gen uses.
        generatedDataUrl = await generateViaActiveConfig({
          cardId,
          resolved: resolvedInside,
          referenceImages: [frontRef],
        });
      }
    }

    // ── Save files + promote ─────────────────────────────────────────
    // Per-attempt filenames are essential here. Before this fix every
    // regen wrote to the canonical card_X_front.png, so:
    //   1. all cardAttempts rows pointed at the same URL → versions
    //      strip showed the same image for every attempt
    //   2. the browser cached that URL on first load and refused to
    //      re-fetch when the file changed → the user saw THE SAME
    //      image even after a successful regen with a different prompt
    // savePngFilesForAttempt writes card_X_side_a{id}.png (unique
    // URL → no cache hit) AND mirrors to canonical (so PDF/print
    // /fulfillment, which read by canonical name, see the new version).
    const { url: attemptUrl, attemptFilename } = await savePngFilesForAttempt(
      generatedDataUrl,
      cardId,
      side,
      attemptId,
    );
    const imagePathRel = attemptFilename;

    await db
      .update(cardAttempts)
      .set({
        status: 'completed',
        imageUrl: attemptUrl,
        imagePath: imagePathRel,
      })
      .where(eq(cardAttempts.id, attemptId));

    // Point cards at this new attempt as the displayed version.
    if (side === 'front') {
      await db
        .update(cards)
        .set({
          frontImageUrl: attemptUrl,
          frontImagePath: imagePathRel,
          selectedFrontAttemptId: attemptId,
        })
        .where(eq(cards.id, cardId));
      // Re-run print-resolution upscale for the new front (non-fatal).
      await generatePrintResolutionFiles(cardId).catch((err) =>
        console.warn(`[STUDIO_GEN] print-res after front regen failed:`, err),
      );
    } else {
      await db
        .update(cards)
        .set({
          insideImageUrl: attemptUrl,
          insideImagePath: imagePathRel,
          selectedInsideAttemptId: attemptId,
        })
        .where(eq(cards.id, cardId));
    }

    console.log(`[STUDIO_GEN] Regen ${side} #${attemptNumber} for card ${cardId} OK`);
  } catch (err: any) {
    console.error(
      `[STUDIO_GEN] Regen ${side} #${attemptNumber} for card ${cardId} FAILED:`,
      err?.message ?? err,
    );
    await db
      .update(cardAttempts)
      .set({
        status: 'failed',
        errorCode: err?.code ?? 'server',
      })
      .where(eq(cardAttempts.id, attemptId))
      .catch(() => {});
    throw err;
  }
}

/**
 * Backward-compatible wrapper around {@link createRegenAttemptRow} +
 * {@link runRegenAttempt}. Awaits the full sequence and returns the
 * attemptId — same signature as the pre-split version. Existing
 * callers that wanted "kick off + wait until done" still work, but
 * the recommended pattern for any new caller is to use the two
 * functions directly so the API request can return without blocking
 * on the gen.
 */
export async function regenerateStudioCardSide(
  cardId: number,
  side: CardSide,
  options: RegenerateOptions = {},
): Promise<number> {
  const { attemptId, attemptNumber } = await createRegenAttemptRow(
    cardId,
    side,
    options,
  );
  await runRegenAttempt(attemptId, attemptNumber, cardId, side, options);
  return attemptId;
}
