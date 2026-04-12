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

    if (req.referenceImageBase64) {
      // Strip data URL prefix if present to get raw base64
      const base64Match = req.referenceImageBase64.match(
        /^data:image\/([a-z0-9]+);base64,(.+)$/,
      );
      const mimeType = base64Match ? `image/${base64Match[1]}` : 'image/png';
      const rawBase64 = base64Match
        ? base64Match[2]
        : req.referenceImageBase64;

      parts.push({
        inlineData: {
          mimeType,
          data: rawBase64,
        },
      });

      console.log(
        `[PROVIDER:gemini] → generateContent (model=${this.model} hasRef=true refBytes=${rawBase64.length})`,
      );
    } else {
      console.log(
        `[PROVIDER:gemini] → generateContent (model=${this.model} hasRef=false text-only)`,
      );
    }

    const response = await client.models.generateContent({
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
          personGeneration: 'ALLOW_ALL',
        },
      },
    });

    const elapsed = Date.now() - startTime;
    console.log(
      `[PROVIDER:gemini] ← generateContent returned (${elapsed}ms)`,
    );

    // Extract the generated image from the response.
    // Gemini returns parts — some text, some image. We want the first
    // image part.
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      const finishReason = candidate?.finishReason;
      throw new Error(
        `Gemini returned no content (finishReason=${finishReason ?? 'unknown'}). ` +
          'This may be a safety filter or a billing issue.',
      );
    }

    const imagePart = candidate.content.parts.find(
      (p: any) => p.inlineData?.mimeType?.startsWith('image/'),
    );

    if (!imagePart || !(imagePart as any).inlineData?.data) {
      // Check if there's a text-only response (model declined to
      // generate an image — often a safety refusal).
      const textParts = candidate.content.parts
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join(' ');
      throw new Error(
        `Gemini did not return an image. ${textParts ? `Model said: "${textParts.slice(0, 200)}"` : 'No explanation provided.'}`,
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
}
