// server/providers/gemini-image.ts
//
// Google Gemini 3 Pro Image (Nano Banana Pro) adapter behind the
// ImageProvider interface. Uses the @google/genai SDK.
//
// Key differences from the OpenAI adapter:
//   - Single API call (`generateContent`) for both text-only and
//     image+text — no separate "edits" endpoint.
//   - Reference images are passed as inline_data parts in the same
//     content array as the text prompt.
//   - No quality tiers — one price per resolution.
//   - Supports up to 14 reference images (we currently use 1).
//   - personGeneration: 'ALLOW_ALL' is required for face generation.

import { GoogleGenAI } from '@google/genai';
import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from './image-provider';
import { ProviderError, classifyGeminiError } from './errors';

// Single cost for 1K resolution (1024×1024). Gemini 3 Pro Image doesn't
// have quality tiers like OpenAI — you get one quality level at $0.134.
const COST_CENTS_1K = 13.4;

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

export class GeminiImageProvider implements ImageProvider {
  id = 'gemini';
  displayName = 'Gemini 3 Pro Image';
  model = 'gemini-3-pro-image-preview';

  isAvailable(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  getQualityOptions() {
    // Gemini doesn't have quality tiers. We return a single "standard"
    // option mapped to 'high' so the UI quality selector can stay
    // consistent (it expects one of low/medium/high). The actual API
    // call ignores the quality param.
    return [
      { value: 'high' as const, label: 'Standard', costDisplay: '$0.134' },
    ];
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const client = getClient();
    const startTime = Date.now();

    // Build the content parts array. Text prompt first, then optional
    // reference image(s) as inline_data.
    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [{ text: req.prompt }];

    // Collect all reference images (primary + additional). Gemini supports
    // up to 14 inline images in a single call. More reference photos of the
    // same person = better identity preservation.
    const allRefImages: string[] = [];
    if (req.referenceImageBase64) allRefImages.push(req.referenceImageBase64);
    if (req.additionalReferenceImages?.length) {
      allRefImages.push(...req.additionalReferenceImages);
    }

    for (const refImg of allRefImages) {
      const base64Match = refImg.match(
        /^data:image\/([a-z0-9]+);base64,(.+)$/,
      );
      const mimeType = base64Match ? `image/${base64Match[1]}` : 'image/png';
      const rawBase64 = base64Match ? base64Match[2] : refImg;
      parts.push({
        inlineData: {
          mimeType,
          data: rawBase64,
        },
      });
    }

    const totalRefImages = allRefImages.length;
    if (totalRefImages > 0) {
      console.log(
        `[PROVIDER:gemini] → generateContent (model=${this.model} refImages=${totalRefImages})`,
      );
    } else {
      console.log(
        `[PROVIDER:gemini] → generateContent (model=${this.model} text-only)`,
      );
    }

    let response: any;
    try {
      response = await client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          imageConfig: {
            aspectRatio: '1:1',
            imageSize: '1K',
          },
        },
      });
    } catch (sdkErr: unknown) {
      throw classifyGeminiError(sdkErr, this.id);
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[PROVIDER:gemini] ← generateContent returned (${elapsed}ms)`,
    );

    // Extract the generated image from the response.
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      const finishReason = String(candidate?.finishReason ?? 'unknown');
      throw classifyGeminiError(
        new Error(`Gemini returned no content (finishReason=${finishReason})`),
        this.id,
        { finishReason, modelText: null as any },
      );
    }

    const imagePart = candidate.content.parts.find(
      (p: any) => p.inlineData?.mimeType?.startsWith('image/'),
    );

    if (!imagePart || !(imagePart as any).inlineData?.data) {
      // Text-only response = safety refusal or other model refusal.
      const textParts = candidate.content.parts
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join(' ');
      const finishReason = String(candidate.finishReason ?? '');
      throw classifyGeminiError(
        new Error(`Gemini did not return an image`),
        this.id,
        { finishReason, modelText: textParts || null },
      );
    }

    const imgData = (imagePart as any).inlineData;
    const imageUrl = `data:${imgData.mimeType};base64,${imgData.data}`;

    const durationMs = Date.now() - startTime;
    return {
      imageUrl,
      durationMs,
      costCents: COST_CENTS_1K,
      costUsd: `$${(COST_CENTS_1K / 100).toFixed(3)}`,
      provider: this.id,
      model: this.model,
    };
  }

  async analyzeReference(images: string[]): Promise<string | null> {
    if (images.length === 0) return null;
    const client = getClient();

    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [
      {
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
    ];

    // Add all reference images
    for (const img of images) {
      const base64Match = img.match(/^data:image\/([a-z0-9]+);base64,(.+)$/);
      const mimeType = base64Match ? `image/${base64Match[1]}` : 'image/png';
      const rawBase64 = base64Match ? base64Match[2] : img;
      parts.push({ inlineData: { mimeType, data: rawBase64 } });
    }

    console.log(
      `[PROVIDER:gemini] → analyzeReference (${images.length} image(s))`,
    );

    try {
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }],
        config: {
          maxOutputTokens: 300,
          temperature: 0.3,
        },
      });

      const text = response.candidates?.[0]?.content?.parts
        ?.filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join(' ')
        .trim();

      console.log(
        `[PROVIDER:gemini] ← analyzeReference returned (${text?.length ?? 0} chars)`,
      );

      return text || null;
    } catch (err: any) {
      console.error(`[PROVIDER:gemini] analyzeReference failed:`, err.message);
      return null;
    }
  }
}
