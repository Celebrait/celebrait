// server/providers/openai-image.ts
//
// OpenAI gpt-image-1.5 adapter behind the ImageProvider interface.
// Extracted from the inline logic in server/routes/prompts.ts test-run
// endpoint. Same behaviour, same API calls, just pluggable.

import FormData from 'form-data';
import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from './image-provider';
import { ProviderError, classifyOpenAIError } from './errors';
import { openai } from '../utils/shared';

const COST_BY_QUALITY: Record<string, number> = {
  low: 0.9,    // $0.009
  medium: 3.4, // $0.034
  high: 13.3,  // $0.133
};

export class OpenAIImageProvider implements ImageProvider {
  id = 'openai';
  displayName = 'OpenAI gpt-image-1.5';
  model = 'gpt-image-1.5';

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  getQualityOptions() {
    return [
      { value: 'low' as const, label: 'Low', costDisplay: '$0.009' },
      { value: 'medium' as const, label: 'Medium', costDisplay: '$0.034' },
      { value: 'high' as const, label: 'High', costDisplay: '$0.133' },
    ];
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!openai && !process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();
    const q = req.quality;
    let imageUrl: string | null = null;

    if (req.referenceImageBase64) {
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
      formData.append('size', req.size);
      formData.append('quality', q);
      formData.append('moderation', 'low');
      formData.append('background', 'auto');

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
          size: req.size as any,
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
    const costCents = COST_BY_QUALITY[q] ?? COST_BY_QUALITY.low;
    return {
      imageUrl,
      durationMs,
      costCents,
      costUsd: `$${(costCents / 100).toFixed(3)}`,
      provider: this.id,
      model: this.model,
    };
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
