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

    if (req.additionalReferenceImages?.length) {
      console.log(
        `[PROVIDER:openai] NOTE: ${req.additionalReferenceImages.length} additional reference image(s) ignored — OpenAI only supports 1 reference. Use Gemini for multi-photo.`,
      );
    }

    if (req.referenceImageBase64) {
      // ── Image-to-image via /v1/images/edits ──
      const base64Match = req.referenceImageBase64.match(
        /^data:image\/([a-z0-9]+);base64,(.+)$/,
      );
      const mimeType = base64Match ? base64Match[1] : 'png';
      const rawBase64 = base64Match ? base64Match[2] : req.referenceImageBase64;
      const imageBuffer = Buffer.from(rawBase64, 'base64');

      const formData = new FormData();
      formData.append('image', imageBuffer, {
        filename: `reference.${mimeType}`,
        contentType: `image/${mimeType}`,
      });
      formData.append('prompt', req.prompt);
      formData.append('model', this.model);
      formData.append('n', '1');
      formData.append('size', req.size);
      formData.append('quality', q);
      formData.append('moderation', 'low');
      formData.append('background', 'auto');

      const fetch = (await import('node-fetch')).default;
      console.log(
        `[PROVIDER:openai] → POST /v1/images/edits (quality=${q} imageBytes=${imageBuffer.length})`,
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
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 300,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze the person in this image to create a highly detailed 'Character Anchor' description for facial consistency in AI image generation.

Describe the following with extreme precision:
- Face Shape: specific geometry (e.g., heart-shaped, tapering jaw, high cheekbones, round, square)
- Eyes: shape, eyelid fold (monolid, hooded, double lid), exact iris color, eyebrow shape and thickness
- Nose & Mouth: bridge shape, nostril width, nose tip, lip fullness, cupid's bow shape, mouth width
- Distinctive Markers: any moles, freckle patterns, scars, dimples, unique skin textures, facial hair
- Hair: texture, length, hairline shape, exact color including any gradients or highlights
- Skin: exact tone, undertone (warm/cool/neutral), any visible texture or characteristics
- Build: face proportions, jaw definition, neck width, overall impression

Create a 100-150 word descriptive paragraph that acts as a precise blueprint to recreate this exact person in a stylised illustration. Focus on the features that make this person UNIQUE — the things that distinguish them from a generic face. Do NOT describe clothing or background.

Return ONLY the character anchor paragraph, nothing else.`,
              },
              ...imageContent,
            ],
          },
        ],
      });

      const text = response.choices?.[0]?.message?.content?.trim();
      console.log(
        `[PROVIDER:openai] ← analyzeReference returned (${text?.length ?? 0} chars)`,
      );
      return text || null;
    } catch (err: any) {
      console.error(`[PROVIDER:openai] analyzeReference failed:`, err.message);
      return null;
    }
  }
}
