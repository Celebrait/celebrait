// server/providers/openai-image.ts
//
// OpenAI image-generation adapter behind the ImageProvider interface.
// Now variant-aware (2026-04-27): the same class drives both the
// existing gpt-image-1.5 production path AND the new gpt-image-2
// (announced 2026-04-21) for side-by-side A/B testing in the Prompt
// Lab. API surface is identical between versions — same /v1/images/
// generations + /v1/images/edits endpoints, same multipart pattern,
// same low/medium/high quality tiers — only the `model` string and
// the per-quality cost differ.
//
// PL-first: gpt-image-2 is registered in the provider registry and
// exposed in the Prompt Lab. It is NOT wired into Studio production
// until Kevin tests it in the lab and updates `prompt_active`.
// See `project_prompt_lab_first.md` in memory.

import FormData from 'form-data';
import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from './image-provider';
import { ProviderError, classifyOpenAIError } from './errors';
import { openaiSize } from './size';
import { openai } from '../utils/shared';

export interface OpenAIVariantConfig {
  id: string;
  displayName: string;
  model: string;
  /** Cost per image in US cents at each quality tier. */
  costByQuality: Record<'low' | 'medium' | 'high', number>;
  /** Pre-formatted USD price string for the UI quality dropdown. */
  qualityDisplay: Record<'low' | 'medium' | 'high', string>;
  /** When true, a reference-image request GENERATES a new image via the
   *  Responses API (image_generation tool, action:"generate") instead of
   *  editing the source via /v1/images/edits. Edit-mode welds gpt-image-2 to
   *  high input-fidelity → it copies the source's expression + gaze; generate
   *  mode references identity but composes fresh, so it MAY break that
   *  ceiling. Lab-only A/B lever (Kevin 2026-07-17). */
  useResponsesGenerate?: boolean;
  /** Top-level orchestrator model for the Responses API call (it invokes the
   *  image_generation tool). Overridable at runtime via OPENAI_RESPONSES_MODEL
   *  — a hedge since this API surface is newer than the model's knowledge and
   *  the right orchestrator id may need a nudge without a redeploy. */
  responsesModel?: string;
}

export const OPENAI_VARIANTS = {
  /** gpt-image-1.5 — the legacy production model. Kept registered as
   *  the `openai` ID for backwards compatibility with existing
   *  prompt_active rows and the test-refine fallback. */
  v1_5: {
    id: 'openai',
    displayName: 'OpenAI gpt-image-1.5',
    model: 'gpt-image-1.5',
    costByQuality: { low: 0.9, medium: 3.4, high: 13.3 },
    qualityDisplay: {
      low: '$0.009',
      medium: '$0.034',
      high: '$0.133',
    },
  },
  /** gpt-image-2 — first OpenAI image model with native reasoning,
   *  announced 2026-04-21. 2K resolution support, up to 8 batched
   *  images per call (we use n=1), cleaner handling of complex
   *  multi-instruction prompts. Snapshot pinned `gpt-image-2-2026-
   *  04-21`; we use the rolling alias `gpt-image-2` so improvements
   *  flow through automatically.
   *
   *  Pricing per image at 1024×1024 (per OpenAI announcement):
   *    Low:    $0.006  (cheaper than v1.5 low)
   *    Medium: $0.053
   *    High:   $0.211  (~1.6× v1.5 high — premium tier) */
  v2: {
    id: 'openai-2',
    displayName: 'OpenAI gpt-image-2',
    model: 'gpt-image-2',
    costByQuality: { low: 0.6, medium: 5.3, high: 21.1 },
    qualityDisplay: {
      low: '$0.006',
      medium: '$0.053',
      high: '$0.211',
    },
  },
  /** gpt-image-2 via the Responses API GENERATE path — same model + pricing
   *  as v2, but a reference photo is passed as context to compose a NEW image
   *  rather than editing the source. Lab-only A/B lever to test whether
   *  generate-mode frees expression/pose that edit-mode's forced high-fidelity
   *  copies (Kevin 2026-07-17). Not for production until proven in the Lab. */
  v2_gen: {
    id: 'openai-2-gen',
    displayName: 'OpenAI gpt-image-2 (Responses generate)',
    model: 'gpt-image-2',
    costByQuality: { low: 0.6, medium: 5.3, high: 21.1 },
    qualityDisplay: {
      low: '$0.006',
      medium: '$0.053',
      high: '$0.211',
    },
    useResponsesGenerate: true,
    responsesModel: 'gpt-5.6',
  },
} satisfies Record<string, OpenAIVariantConfig>;

export class OpenAIImageProvider implements ImageProvider {
  readonly id: string;
  readonly displayName: string;
  readonly model: string;
  private readonly costByQuality: Record<'low' | 'medium' | 'high', number>;
  private readonly qualityDisplay: Record<'low' | 'medium' | 'high', string>;
  private readonly useResponsesGenerate: boolean;
  private readonly responsesModel: string;

  constructor(variant: OpenAIVariantConfig = OPENAI_VARIANTS.v1_5) {
    this.id = variant.id;
    this.displayName = variant.displayName;
    this.model = variant.model;
    this.costByQuality = variant.costByQuality;
    this.qualityDisplay = variant.qualityDisplay;
    this.useResponsesGenerate = variant.useResponsesGenerate ?? false;
    this.responsesModel = variant.responsesModel ?? 'gpt-5.6';
  }

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  getQualityOptions() {
    return [
      { value: 'low' as const, label: 'Low', costDisplay: this.qualityDisplay.low },
      { value: 'medium' as const, label: 'Medium', costDisplay: this.qualityDisplay.medium },
      { value: 'high' as const, label: 'High', costDisplay: this.qualityDisplay.high },
    ];
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!openai && !process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();
    const q = req.quality;
    let imageUrl: string | null = null;

    if (req.referenceImageBase64 && this.useResponsesGenerate && !req.editMode) {
      // ── Reference-conditioned GENERATE via the Responses API ──
      // The photo is context for identity; the model composes a NEW image
      // rather than editing the source pixels. See generateViaResponses.
      imageUrl = await this.generateViaResponses(req, q, startTime);
    } else if (req.referenceImageBase64) {
      // ── Image-to-image via /v1/images/edits ──
      // Collect all reference images (primary + additional).
      // OpenAI supports multiple via image[] array syntax.
      const allImages: string[] = [req.referenceImageBase64];
      if (req.additionalReferenceImages?.length) {
        allImages.push(...req.additionalReferenceImages);
      }

      const formData = new FormData();

      if (allImages.length === 1) {
        // Single image: use 'image' field
        const base64Match = allImages[0].match(
          /^data:image\/([a-z0-9]+);base64,(.+)$/,
        );
        const mimeType = base64Match ? base64Match[1] : 'png';
        const rawBase64 = base64Match ? base64Match[2] : allImages[0];
        const imageBuffer = Buffer.from(rawBase64, 'base64');
        formData.append('image', imageBuffer, {
          filename: `reference.${mimeType}`,
          contentType: `image/${mimeType}`,
        });
      } else {
        // Multiple images: use 'image[]' array syntax
        allImages.forEach((img, index) => {
          const base64Match = img.match(
            /^data:image\/([a-z0-9]+);base64,(.+)$/,
          );
          const mimeType = base64Match ? base64Match[1] : 'png';
          const rawBase64 = base64Match ? base64Match[2] : img;
          const imageBuffer = Buffer.from(rawBase64, 'base64');
          formData.append('image[]', imageBuffer, {
            filename: `reference${index + 1}.${mimeType}`,
            contentType: `image/${mimeType}`,
          });
        });
      }
      formData.append('prompt', req.prompt);
      formData.append('model', this.model);
      formData.append('n', '1');
      formData.append('size', openaiSize(req.size));
      formData.append('quality', q);
      formData.append('moderation', 'low');
      formData.append('background', 'auto');
      // input_fidelity is a gpt-image-1-only parameter; gpt-image-2
      // rejects it outright ("does not support"), so only send it there.
      if (req.inputFidelity && this.model === 'gpt-image-1') formData.append('input_fidelity', req.inputFidelity);

      const fetch = (await import('node-fetch')).default;
      const totalImageBytes = allImages.reduce((sum, img) => {
        const match = img.match(/^data:image\/[a-z0-9]+;base64,(.+)$/);
        return sum + (match ? match[1].length : img.length);
      }, 0);
      console.log(
        `[PROVIDER:openai] → POST /v1/images/edits (quality=${q} images=${allImages.length} totalBytes=${totalImageBytes})`,
      );
      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders(),
        },
        body: formData as any,
        // Historically this fetch had NO timeout → a stalled OpenAI
        // request hung the card forever (cycling wait-stage quotes,
        // nothing happening). Abort after 6 min so a true stall surfaces
        // as a failure → retry. gpt-image 'high' is ~5 min worst case, so
        // this only fires on a genuine hang, not a legitimately-slow gen.
        signal: AbortSignal.timeout(6 * 60 * 1000),
      });
      console.log(
        `[PROVIDER:openai] ← ${response.status} ${response.statusText} (${Date.now() - startTime}ms)`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try { errorData = JSON.parse(errorText); } catch { errorData = { error: { message: errorText } }; }
        throw classifyOpenAIError(
          { ...errorData, status: response.status },
          this.id,
        );
      }

      const json = (await response.json()) as any;
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) {
        throw new ProviderError({
          kind: 'server',
          code: 'empty_response',
          message: 'OpenAI returned no image data',
          retryable: true,
          provider: this.id,
        });
      }
      imageUrl = `data:image/png;base64,${b64}`;
    } else {
      // ── Text-only via SDK ──
      if (!openai) {
        throw new ProviderError({
          kind: 'auth',
          code: 'no_client',
          message: 'OpenAI client not initialised',
          retryable: false,
          provider: this.id,
        });
      }
      console.log(`[PROVIDER:openai] → images.generate (quality=${q})`);
      let gen: any;
      try {
        gen = await openai.images.generate({
          model: this.model,
          prompt: req.prompt,
          n: 1,
          size: openaiSize(req.size) as any,
          quality: q,
        } as any);
      } catch (sdkErr: unknown) {
        throw classifyOpenAIError(sdkErr, this.id);
      }
      console.log(
        `[PROVIDER:openai] ← images.generate returned (${Date.now() - startTime}ms)`,
      );

      const data = gen?.data?.[0];
      const b64 = data?.b64_json;
      if (b64) {
        imageUrl = `data:image/png;base64,${b64}`;
      } else if (data?.url) {
        imageUrl = data.url;
      }
      if (!imageUrl) {
        throw new ProviderError({
          kind: 'server',
          code: 'empty_response',
          message: 'OpenAI returned no image data',
          retryable: true,
          provider: this.id,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const costCents = this.costByQuality[q] ?? this.costByQuality.low;
    return {
      imageUrl,
      durationMs,
      costCents,
      costUsd: `$${(costCents / 100).toFixed(3)}`,
      provider: this.id,
      model: this.model,
    };
  }

  /**
   * Reference-conditioned GENERATE via the Responses API.
   *
   * Unlike /v1/images/edits (which edits the source photo's pixels and, on
   * gpt-image-2, is welded to high input-fidelity → it copies the source's
   * expression + gaze), this passes the photo as CONTEXT and asks the
   * image_generation tool to compose a NEW image. Same identity signal, but
   * built fresh — the hypothesis being it frees the pose/expression that edit
   * mode preserves. Lab-only A/B lever; unproven until tested.
   *
   * Shape verified against OpenAI's live docs 2026-07-17:
   *   POST /v1/responses
   *   { model, input:[{role:'user', content:[{type:'input_text',text},
   *     {type:'input_image',image_url}]}],
   *     tools:[{type:'image_generation', action:'generate', size, quality}] }
   *   → output[].{type:'image_generation_call'}.result  (base64 PNG)
   *
   * Returns a data: URL, matching the generate() output contract.
   */
  private async generateViaResponses(
    req: ImageGenerationRequest,
    q: 'low' | 'medium' | 'high',
    startTime: number,
  ): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new ProviderError({
        kind: 'auth',
        code: 'no_key',
        message: 'OpenAI API key not configured',
        retryable: false,
        provider: this.id,
      });
    }
    // Orchestrator model is env-overridable — this API surface is newer than
    // the model's knowledge, so the right id can be nudged without a redeploy.
    const model = process.env.OPENAI_RESPONSES_MODEL || this.responsesModel;

    const refs = [req.referenceImageBase64, ...(req.additionalReferenceImages ?? [])]
      .filter((s): s is string => !!s)
      .map((img) => (img.startsWith('data:') ? img : `data:image/png;base64,${img}`));

    const content: any[] = [{ type: 'input_text', text: req.prompt }];
    for (const image_url of refs) content.push({ type: 'input_image', image_url });

    const body = {
      model,
      input: [{ role: 'user', content }],
      tools: [
        {
          type: 'image_generation',
          action: 'generate',
          size: openaiSize(req.size),
          quality: q,
        },
      ],
    };

    const fetch = (await import('node-fetch')).default;
    console.log(
      `[PROVIDER:openai] → POST /v1/responses (model=${model} image_generation:generate quality=${q} refs=${refs.length})`,
    );
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6 * 60 * 1000),
    });
    console.log(
      `[PROVIDER:openai] ← ${response.status} ${response.statusText} (${Date.now() - startTime}ms)`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any;
      try { errorData = JSON.parse(errorText); } catch { errorData = { error: { message: errorText } }; }
      throw classifyOpenAIError({ ...errorData, status: response.status }, this.id);
    }

    const json = (await response.json()) as any;
    const call = Array.isArray(json?.output)
      ? json.output.find((o: any) => o?.type === 'image_generation_call')
      : null;
    const b64 = call?.result;
    if (!b64) {
      throw new ProviderError({
        kind: 'server',
        code: 'empty_response',
        message:
          'Responses API returned no image (no image_generation_call.result in output). ' +
          `Raw output types: ${JSON.stringify((json?.output ?? []).map((o: any) => o?.type))}`,
        retryable: true,
        provider: this.id,
      });
    }
    return `data:image/png;base64,${b64}`;
  }

  /**
   * Refine an existing image with a text instruction. OpenAI doesn't
   * have a separate "edit-with-instruction" API like Gemini's
   * generateContent — but /v1/images/edits accepts an image + prompt
   * and produces a modified version, which is functionally equivalent.
   *
   * Implementation: delegate to generate() with the prior image as the
   * primary reference. The existing /v1/images/edits plumbing handles
   * the rest (multipart, multi-image array, error classification).
   *
   * NOTE: result quality vs Gemini is meaningfully different. Gemini's
   * refine preserves composition and character likeness more reliably;
   * OpenAI tends to re-roll more of the scene. Use as a fallback when
   * Gemini is overloaded, not as an equal alternative.
   */
  async refine(
    imageBase64: string,
    instruction: string,
    referencePhotos?: string[],
  ): Promise<ImageGenerationResult> {
    return this.generate({
      prompt: instruction,
      referenceImageBase64: imageBase64,
      additionalReferenceImages: referencePhotos,
      quality: 'high',
      size: '1024x1024',
    });
  }

  async analyzeReference(images: string[]): Promise<string | null> {
    if (images.length === 0 || !openai) return null;

    // Use GPT-4o vision to analyse the face
    const imageContent = images.slice(0, 3).map((img) => {
      const url = img.startsWith('data:') ? img : `data:image/png;base64,${img}`;
      return {
        type: 'image_url' as const,
        image_url: { url, detail: 'high' as const },
      };
    });

    console.log(
      `[PROVIDER:openai] → analyzeReference (${images.length} image(s) via GPT-4o)`,
    );

    try {
      const response = await Promise.race([
        openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 300,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are an art director preparing detailed reference notes for a professional illustrator who needs to draw a stylised portrait based on these reference photos. The illustrator cannot see the photos — they can ONLY work from your written description. Your notes must be precise enough that the illustrator captures this specific individual's unique visual characteristics.

Describe the following visual features for the illustrator:

FACE GEOMETRY: jaw angle, chin shape, cheekbone prominence, forehead proportions, overall face shape and length-to-width ratio
EYES: shape, size relative to face, spacing, eyelid style, iris colour, eyebrow shape and thickness
NOSE: bridge profile, tip shape, nostril width, overall proportions
MOUTH: lip proportions (upper vs lower), width, cupid's bow, any asymmetry
SKIN: tone and undertone, any freckle patterns, texture characteristics, visible expression lines
FACIAL HAIR: style, density, colour, coverage pattern (or note if clean-shaven)
HAIR: colour with any variation (roots, highlights), texture, length, styling, hairline shape
KEY DISTINGUISHING FEATURES: the 3-5 visual details that make this individual immediately recognisable in a crowd — what a friend would mention first when describing them

Write your art direction as flowing descriptive text, one category per line. No labels, no preamble — start directly with the face geometry description. Do not describe clothing, background, or pose.`,
              },
              ...imageContent,
            ],
          },
        ],
      }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Character anchor analysis timed out after 30s')), 30000),
        ),
      ]) as any;

      const text = response.choices?.[0]?.message?.content?.trim();
      console.log(
        `[PROVIDER:openai] ← analyzeReference returned (${text?.length ?? 0} chars)`,
      );

      if (!text) return null;
      // Only catch hard refusals — the art-direction framing should
      // avoid most of these, but guard against it just in case.
      if (/^I'm sorry|^I can't|^I cannot|^I'm unable|not able to help|violates.*policy/i.test(text)) {
        console.log(`[PROVIDER:openai] analyzeReference: detected refusal, skipping anchor`);
        return null;
      }

      return text;
    } catch (err: any) {
      console.error(`[PROVIDER:openai] analyzeReference failed:`, err.message);
      return null;
    }
  }
}
