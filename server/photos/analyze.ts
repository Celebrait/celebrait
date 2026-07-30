// server/photos/analyze.ts
//
// Vision-derived photo analysis. Runs in the background after a photo
// upload completes; writes a minimal summary back onto the photos row
// for the inside-text helper to consume later.
//
// Why this exists:
//   The inside-text helper (Phase 4 of the pre-launch plan) needs to
//   ground its suggestions in what the card's photos actually show —
//   otherwise it can only reason from the recipient name + occasion,
//   which produces generic "wishing you a wonderful year" output.
//   A short visual summary per photo gives the helper enough context
//   to write something specific.
//
// What it captures (deliberately minimal):
//   personCount    — 0 / 1 / 2 / 3+ (3+ is a single bucket; exact
//                    counts beyond 2 don't change downstream behaviour)
//   visualSummary  — 25–60 words of generic composition + mood + setting
//                    NEVER identifying language ("Sarah and her husband")
//                    NEVER inferred relationships beyond what's visible
//
// What it does NOT do:
//   • Identify or name anyone
//   • Guess relationships ("a couple", "a family")
//   • Read text in the image
//   • Inform brainstorm / scene-suggest (those use the photoMode hint)
//
// Cost model:
//   gemini-2.5-flash (multimodal LLM) at ~$0.075 per 1M input tokens +
//   ~$0.30 per 1M output tokens. A thumbnail-sized image + short prompt
//   + ~60-word output ≈ $0.0001–0.0002 per analysis. Trivial.
//
// Failure mode:
//   Logged and silently absorbed. analyzedAt is stamped even on failure
//   so we don't retry in a tight loop (vision-model errors usually
//   indicate something durable like a corrupted image). The downstream
//   helper handles "no summary" gracefully.

import { GoogleGenAI } from '@google/genai';
import { promises as fs } from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { photos } from '@shared/schema';
import { logGeneration } from '../prompts/generation-log';
import { llmCostCents } from '../prompts/llm-cost';
import { LLM_SLOTS } from '@shared/schema';

const ANALYSIS_MODEL = 'gemini-2.5-flash';

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

const ANALYSIS_PROMPT = `Look at this photo and respond with a single JSON object describing it. Strict rules:

1. NEVER identify or name people. Even if you recognise someone famous, treat them as a generic "person" / "adult".
2. NEVER infer relationships you can't directly see ("a couple", "a family"). Stick to what's visually evident.
3. NEVER describe ethnicity, body type, or anything sensitive about appearance.
4. NEVER transcribe text visible in the photo.

Return JSON with these fields:

{
  "personCount": 0 | 1 | 2 | 3,
    // exact count up to 2; use 3 for any group of 3 or more.
  "visualSummary": string
    // 25 to 60 words. Describe the composition, mood, setting, and any
    // notable elements (lighting, time of day, what people are doing,
    // what the environment suggests). Avoid identifying details.
    // Examples of GOOD summaries:
    //   "Two adults laughing in a sunlit kitchen, one holding a coffee mug. Warm morning light through the window, casual home setting, relaxed and intimate mood."
    //   "Solo portrait of a smiling woman outdoors, soft golden-hour light behind her. Soft-focus greenery in the background, candid and warm."
    //   "Group of four gathered around a dinner table, candles lit, raising glasses. Indoor evening setting, celebratory and warm."
}

Output JSON only. No markdown fences, no preamble.`;

interface AnalysisResult {
  personCount: number;
  visualSummary: string;
}

function parseAnalysisJson(raw: string): AnalysisResult | null {
  // Strip common fence variants the model sometimes emits despite the
  // instruction. Be permissive — better to recover than retry.
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const obj = JSON.parse(trimmed);
    const personCount = Number(obj?.personCount);
    const visualSummary = String(obj?.visualSummary ?? '').trim();
    if (!Number.isFinite(personCount) || !visualSummary) return null;
    return {
      personCount: Math.max(0, Math.min(3, Math.round(personCount))),
      visualSummary,
    };
  } catch {
    return null;
  }
}

/**
 * Run the vision pass over raw image bytes. THE single place the model,
 * prompt and parsing live.
 *
 * Extracted so the admin Photo Lab exercises the EXACT path production
 * uses (2026-07-30). A lab that reimplements the call is worthless the
 * moment the two drift — and drift is invisible, because both sides
 * keep "working". Everything that decides the answer is in here;
 * analyzePhoto adds only persistence and cost logging on top.
 *
 * Returns null `result` when the key is missing or the model's JSON
 * won't parse. Never throws.
 */
export async function runPhotoVision(args: {
  imageBytes: Buffer;
  mimeType: string;
}): Promise<{
  result: AnalysisResult | null;
  raw: string;
  model: string;
  durationMs: number;
  promptTokens: number;
  outputTokens: number;
  noApiKey?: true;
}> {
  const startedAt = Date.now();
  const client = getClient();
  if (!client) {
    return {
      result: null, raw: '', model: ANALYSIS_MODEL,
      durationMs: 0, promptTokens: 0, outputTokens: 0, noApiKey: true,
    };
  }
  const response = await client.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: ANALYSIS_PROMPT },
          { inlineData: { mimeType: args.mimeType, data: args.imageBytes.toString('base64') } },
        ],
      },
    ],
    config: {
      // ── This block is why analysis silently failed 100% of the time
      //    from launch until 2026-07-30. Do not "tidy" it. ────────────
      //
      // gemini-2.5-flash is a THINKING model, and thinking tokens are
      // charged against maxOutputTokens. The prompt's four strict NEVER
      // rules reliably provoke ~240-360 thinking tokens, which swallowed
      // the entire 256 budget: the call came back finishReason
      // MAX_TOKENS with 10 visible tokens — `{"personCount": 2,` — so
      // the JSON never parsed. 99 photos, 80 attempts, 0 successes, and
      // it never once surfaced because the failure path just stamps
      // analyzedAt and moves on.
      //
      // thinkingBudget 0 is the right fix rather than simply raising the
      // ceiling: this is flat extraction, not reasoning, so the thinking
      // bought nothing — and paying for ~360 thinking tokens on every
      // single upload is real money for no gain. Measured after the fix:
      // 0 thinking, ~75 output, finishReason STOP.
      thinkingConfig: { thinkingBudget: 0 },
      // Headroom anyway, so a future model that ignores thinkingBudget
      // degrades to "costs a bit more" rather than "silently broken".
      maxOutputTokens: 512,
      // Low temperature — we want consistent factual descriptions.
      temperature: 0.2,
    },
  });
  const raw = response.text ?? '';
  return {
    result: parseAnalysisJson(raw),
    raw,
    model: ANALYSIS_MODEL,
    durationMs: Date.now() - startedAt,
    promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/**
 * Analyse a photo and persist the summary onto its row. Resolves
 * regardless of success — failures are logged but never thrown, since
 * this runs as a fire-and-forget after the upload response has already
 * been sent.
 */
export async function analyzePhoto(args: {
  photoId: number;
  /** Absolute path to the image file to analyse. Prefer the cropped
   *  derivative when available — it's smaller and reflects the framing
   *  the user intends. */
  imageAbsPath: string;
  /** MIME type for the inline-data part. */
  mimeType: string;
}): Promise<void> {
  const { photoId, imageAbsPath, mimeType } = args;

  try {
    const imageBytes = await fs.readFile(imageAbsPath);
    const vision = await runPhotoVision({ imageBytes, mimeType });

    if (vision.noApiKey) {
      // No GEMINI_API_KEY in this environment. Don't retry endlessly —
      // mark analyzedAt so the row is in a settled state, and bail.
      console.warn(
        `[photos.analyze] GEMINI_API_KEY not set; skipping analysis for photo ${photoId}`,
      );
      await db
        .update(photos)
        .set({ analyzedAt: new Date() })
        .where(eq(photos.id, photoId));
      return;
    }

    const rawText = vision.raw;
    const parsed = vision.result;

    // Cost Ledger (audit 2026-07-29): photo analysis fires on EVERY
    // upload and was spending unrecorded money. No cardId exists yet at
    // upload time; the slot itself is the roll-up. Fire-and-forget.
    void logGeneration({
      cardId: null,
      slot: LLM_SLOTS.PHOTO_ANALYSIS,
      templateId: null,
      templateVersion: null,
      provider: 'gemini',
      model: vision.model,
      quality: null,
      costCents: llmCostCents(vision.model, vision.promptTokens, vision.outputTokens),
      durationMs: vision.durationMs,
      success: !!parsed,
      errorCode: parsed ? null : 'parse_failed',
    });

    if (parsed) {
      await db
        .update(photos)
        .set({
          personCount: parsed.personCount,
          visualSummary: parsed.visualSummary,
          analyzedAt: new Date(),
        })
        .where(eq(photos.id, photoId));
      console.log(
        `[photos.analyze] photo ${photoId} → count=${parsed.personCount} (${parsed.visualSummary.length} chars)`,
      );
    } else {
      // Couldn't parse — stamp analyzedAt anyway to prevent retries.
      console.warn(
        `[photos.analyze] photo ${photoId}: failed to parse JSON. Raw: ${rawText.slice(0, 200)}`,
      );
      await db
        .update(photos)
        .set({ analyzedAt: new Date() })
        .where(eq(photos.id, photoId));
    }
  } catch (err) {
    console.error(`[photos.analyze] photo ${photoId} failed:`, err);
    // Stamp analyzedAt on error too so we don't retry-loop. A genuinely
    // transient failure is acceptable to lose — the inside-text helper
    // copes gracefully with no summary.
    try {
      await db
        .update(photos)
        .set({ analyzedAt: new Date() })
        .where(eq(photos.id, photoId));
    } catch (writeErr) {
      console.error(
        `[photos.analyze] photo ${photoId}: failed to stamp analyzedAt on error`,
        writeErr,
      );
    }
  }
}

/** Resolve the absolute disk path for the right image to analyse.
 *  Prefers the cropped derivative (smaller, framed correctly) and falls
 *  back to the original. Returns null if neither exists. */
export function resolveAnalysisSource(args: {
  croppedStoragePath: string | null;
  storagePath: string;
}): { absPath: string; mimeType: string } | null {
  const relPath = args.croppedStoragePath ?? args.storagePath;
  if (!relPath) return null;
  return {
    absPath: path.join(process.cwd(), 'stored_images', relPath),
    // Cropped derivatives are always JPEG (see photos upload route).
    // Originals can be jpeg/png/webp — we don't have the mime threaded
    // through here, so the photos-route caller passes it explicitly.
    mimeType: args.croppedStoragePath ? 'image/jpeg' : 'image/jpeg',
  };
}
