// server/providers/flux-image.ts
//
// FLUX.2 Pro adapter via fal.ai. Two endpoints:
//   - fal-ai/flux-2-pro       → text-to-image (no reference photo)
//   - fal-ai/flux-2-pro/edit  → image editing with reference photos
//
// FLUX.2 Pro: ~$0.03/image at 1024x1024. Supports up to 9 reference
// images. Strong identity preservation reported.

import { createFalClient } from '@fal-ai/client';
import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from './image-provider';
import { ProviderError, classifyGeminiError } from './errors';

const COST_CENTS = 3.0; // ~$0.03 per 1MP image (1024x1024)

let _client: ReturnType<typeof createFalClient> | null = null;

function getClient() {
  if (!_client) {
    const key = process.env.FAL_KEY;
    if (!key) throw new Error('FAL_KEY not configured');
    _client = createFalClient({ credentials: key });
  }
  return _client;
}

export class FluxImageProvider implements ImageProvider {
  id = 'flux';
  displayName = 'FLUX.2 Pro';
  model = 'fal-ai/flux-2-pro';

  isAvailable(): boolean {
    return !!process.env.FAL_KEY;
  }

  getQualityOptions() {
    // FLUX.2 Pro has no quality tiers — one price.
    return [
      { value: 'high' as const, label: 'Standard', costDisplay: '$0.030' },
    ];
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const client = getClient();
    const startTime = Date.now();

    // Collect all reference images
    const allImages: string[] = [];
    if (req.referenceImageBase64) allImages.push(req.referenceImageBase64);
    if (req.additionalReferenceImages?.length) {
      allImages.push(...req.additionalReferenceImages);
    }

    let imageUrl: string | null = null;

    if (allImages.length > 0) {
      // ── Edit endpoint: reference images + prompt ──
      console.log(
        `[PROVIDER:flux] → fal-ai/flux-2-pro/edit (refImages=${allImages.length})`,
      );

      try {
        const result = await client.subscribe('fal-ai/flux-2-pro/edit', {
          input: {
            prompt: req.prompt,
            image_urls: allImages,
            image_size: 'square_hd',
            output_format: 'png',
            safety_tolerance: 5,
          },
        });

        const elapsed = Date.now() - startTime;
        console.log(
          `[PROVIDER:flux] ← edit returned (${elapsed}ms)`,
        );

        const output = result.data as any;
        const img = output?.images?.[0];
        if (!img?.url) {
          throw new ProviderError({
            kind: 'server',
            code: 'empty_response',
            message: 'FLUX returned no image data',
            retryable: true,
            provider: this.id,
          });
        }
        imageUrl = img.url;
      } catch (err: any) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError({
          kind: err.status === 422 ? 'safety' : 'server',
          code: err.status ? `http_${err.status}` : 'flux_error',
          message: err.message ?? String(err),
          retryable: err.status !== 422,
          modelExplanation: err.body?.detail ?? null,
          provider: this.id,
          cause: err,
        });
      }
    } else {
      // ── Text-only: no reference images ──
      console.log(
        `[PROVIDER:flux] → fal-ai/flux-2-pro (text-only)`,
      );

      try {
        const result = await client.subscribe('fal-ai/flux-2-pro', {
          input: {
            prompt: req.prompt,
            image_size: 'square_hd',
            output_format: 'png',
            safety_tolerance: 5,
          },
        });

        const elapsed = Date.now() - startTime;
        console.log(
          `[PROVIDER:flux] ← generate returned (${elapsed}ms)`,
        );

        const output = result.data as any;
        const img = output?.images?.[0];
        if (!img?.url) {
          throw new ProviderError({
            kind: 'server',
            code: 'empty_response',
            message: 'FLUX returned no image data',
            retryable: true,
            provider: this.id,
          });
        }
        imageUrl = img.url;
      } catch (err: any) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError({
          kind: err.status === 422 ? 'safety' : 'server',
          code: err.status ? `http_${err.status}` : 'flux_error',
          message: err.message ?? String(err),
          retryable: err.status !== 422,
          modelExplanation: err.body?.detail ?? null,
          provider: this.id,
          cause: err,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      imageUrl: imageUrl!,
      durationMs,
      costCents: COST_CENTS,
      costUsd: `$${(COST_CENTS / 100).toFixed(3)}`,
      provider: this.id,
      model: allImages.length > 0 ? 'flux-2-pro/edit' : 'flux-2-pro',
    };
  }
}
