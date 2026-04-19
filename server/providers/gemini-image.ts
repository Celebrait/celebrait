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
import { geminiAspect } from './size';

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

// Nano Banana 2 (Flash) is faster and potentially better at likeness
// for front cards. Nano Banana Pro handles image-to-image tasks
// (inside cards, refine/edit) which Flash can't do reliably.
const MODEL_FLASH = 'gemini-3.1-flash-image-preview'; // Nano Banana 2
const MODEL_PRO = 'nano-banana-pro-preview';           // Nano Banana Pro

export class GeminiImageProvider implements ImageProvider {
  id = 'gemini';
  displayName = 'Gemini';
  model = MODEL_PRO; // default shown in UI

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

    // Use Pro for everything. Flash (Nano Banana 2) was tested but
    // proved unreliable — response times swung from 14s to 196s with
    // no pattern. Pro is consistent at 20-30s for all tasks.
    const activeModel = MODEL_PRO;

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
        `[PROVIDER:gemini] → generateContent (model=${activeModel} refImages=${totalRefImages})`,
      );
    } else {
      console.log(
        `[PROVIDER:gemini] → generateContent (model=${activeModel} text-only)`,
      );
    }

    let response: any;
    try {
      // 60-second timeout on image generation. Flash sometimes hangs
      // for 3+ minutes — this lets the retry wrapper catch it and
      // try again instead of blocking indefinitely.
      response = await Promise.race([
        client.models.generateContent({
          model: activeModel,
          contents: [
            {
              role: 'user',
              parts,
            },
          ],
          config: {
            responseModalities: ['IMAGE', 'TEXT'],
            imageConfig: {
              aspectRatio: geminiAspect(req.size),
              imageSize: '1K',
            },
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Image generation timed out after 60s')), 60000),
        ),
      ]);
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
      model: activeModel,
    };
  }

  /**
   * Take an existing generated image and modify it based on a text
   * instruction. Gemini's generateContent supports this natively —
   * pass the image back as an inline part with the edit instruction.
   * OpenAI cannot do this (each call is stateless).
   */
  async refine(
    imageBase64: string,
    instruction: string,
    referencePhotos?: string[],
  ): Promise<ImageGenerationResult> {
    const client = getClient();
    const startTime = Date.now();

    // Build parts: instruction text + current image + optional reference photos
    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [{ text: instruction }];

    // Add the current generated image
    const base64Match = imageBase64.match(
      /^data:image\/([a-z0-9]+);base64,(.+)$/,
    );
    const mimeType = base64Match ? `image/${base64Match[1]}` : 'image/png';
    const rawBase64 = base64Match ? base64Match[2] : imageBase64;
    parts.push({ inlineData: { mimeType, data: rawBase64 } });

    // Add any reference photos (e.g. for likeness refinement)
    if (referencePhotos?.length) {
      for (const ref of referencePhotos) {
        const refMatch = ref.match(/^data:image\/([a-z0-9]+);base64,(.+)$/);
        const refMime = refMatch ? `image/${refMatch[1]}` : 'image/png';
        const refBase64 = refMatch ? refMatch[2] : ref;
        parts.push({ inlineData: { mimeType: refMime, data: refBase64 } });
      }
    }

    console.log(
      `[PROVIDER:gemini] → refine (model=${this.model} instruction="${instruction.slice(0, 80)}" refPhotos=${referencePhotos?.length ?? 0})`,
    );

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
    console.log(`[PROVIDER:gemini] ← refine returned (${elapsed}ms)`);

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      const finishReason = String(candidate?.finishReason ?? 'unknown');
      throw classifyGeminiError(
        new Error(`Gemini refine returned no content (finishReason=${finishReason})`),
        this.id,
        { finishReason, modelText: null as any },
      );
    }

    const imagePart = candidate.content.parts.find(
      (p: any) => p.inlineData?.mimeType?.startsWith('image/'),
    );

    if (!imagePart || !(imagePart as any).inlineData?.data) {
      const textParts = candidate.content.parts
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join(' ');
      throw classifyGeminiError(
        new Error('Gemini refine did not return an image'),
        this.id,
        { finishReason: String(candidate.finishReason ?? ''), modelText: textParts || null },
      );
    }

    const imgData = (imagePart as any).inlineData;
    const imageUrl = `data:${imgData.mimeType};base64,${imgData.data}`;

    return {
      imageUrl,
      durationMs: Date.now() - startTime,
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
        text: `Analyze the person in this image to create a highly detailed 'Character Anchor' description for facial consistency in AI generation.
Please describe the following with extreme precision:
Face Shape: The specific geometry (e.g., heart-shaped, tapering jaw, high cheekbones).
Eyes: Shape, eyelid fold (monolid, hooded, etc.), and exact iris color.
Nose & Mouth: The bridge shape, nostril width, and the specific curve of the cupid's bow.
Distinctive Markers: Any moles, freckle patterns, scars, or unique skin textures (e.g., crows' feet, matte skin).
Hair: Texture (e.g., 4C curls, fine strands), hairline shape, and exact color gradients.
Goal: Create a 100-word descriptive paragraph that acts as a blueprint to recreate this exact person without distortion or 'beauty-filter' blurring.
Give me the final prompt as the result.`,
      },
    ];

    // Cap at 3 photos for analysis — the text model doesn't need all
    // angles to describe a face, and more photos = larger payload =
    // higher chance of timeout. All photos still go to image generation.
    const analysisImages = images.slice(0, 3);
    for (const img of analysisImages) {
      const base64Match = img.match(/^data:image\/([a-z0-9]+);base64,(.+)$/);
      const mimeType = base64Match ? `image/${base64Match[1]}` : 'image/png';
      const rawBase64 = base64Match ? base64Match[2] : img;
      parts.push({ inlineData: { mimeType, data: rawBase64 } });
    }

    console.log(
      `[PROVIDER:gemini] → analyzeReference (${images.length} image(s))`,
    );

    try {
      // 30-second timeout on the analysis call. If Gemini hangs (which
      // it does occasionally), we fail fast and proceed without the
      // anchor rather than blocking the entire request for 5+ minutes.
      const timeoutMs = 30000;
      const response = await Promise.race([
        client.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts }],
          config: {
            maxOutputTokens: 2000,
            temperature: 0.2,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Character anchor analysis timed out after 30s')), timeoutMs),
        ),
      ]);

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
