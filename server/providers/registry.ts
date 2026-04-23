// server/providers/registry.ts
//
// Provider registry. Maps provider IDs to concrete adapter instances.
// The test-run endpoint and the /api/admin/prompts/providers listing
// both go through this.

import type { ImageProvider, ProviderInfo } from './image-provider';
import { OpenAIImageProvider } from './openai-image';
import { GeminiImageProvider, GEMINI_VARIANTS } from './gemini-image';

const providers = new Map<string, ImageProvider>();

// Register adapters. Add new providers here as they're built.
providers.set('openai', new OpenAIImageProvider());
// Three Gemini model variants exposed side-by-side for A/B testing in
// the Prompt Lab. The default `gemini` ID maps to Pro for backwards
// compatibility with existing prompt_active rows and test-refine.
// flash-2-5 is a testing-window entry — shut-down in July–Oct 2026.
providers.set(GEMINI_VARIANTS.pro.id, new GeminiImageProvider(GEMINI_VARIANTS.pro));
providers.set(GEMINI_VARIANTS.flash.id, new GeminiImageProvider(GEMINI_VARIANTS.flash));
providers.set(GEMINI_VARIANTS.flash25.id, new GeminiImageProvider(GEMINI_VARIANTS.flash25));

/** Look up a provider by ID. Throws if unknown. */
export function getProvider(id: string): ImageProvider {
  const p = providers.get(id);
  if (!p) {
    const available = Array.from(providers.keys()).join(', ');
    throw new Error(`Unknown provider "${id}". Available: ${available}`);
  }
  return p;
}

/** List all registered providers with availability status. Used by the
 *  GET /api/admin/prompts/providers endpoint. */
export function listProviders(): ProviderInfo[] {
  return Array.from(providers.values()).map((p) => ({
    id: p.id,
    displayName: p.displayName,
    model: p.model,
    available: p.isAvailable(),
    qualityOptions: p.getQualityOptions(),
  }));
}
