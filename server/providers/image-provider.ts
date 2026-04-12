// server/providers/image-provider.ts
//
// Shared interface for image generation providers. Every provider (OpenAI,
// Gemini, Flux, etc.) implements ImageProvider so the Prompt Lab test panel
// can swap models from a dropdown without touching any generation logic.
//
// Phase 4 of the Prompt Lab — see PROMPT_LAB_PLAN.md §4.

export interface ImageGenerationRequest {
  /** The fully rendered prompt text (template already substituted). */
  prompt: string;
  /** Optional primary reference image — user's face photo (front_scene)
   *  or a previously generated front card (inside). Data URL or raw base64. */
  referenceImageBase64?: string;
  /** Additional reference images of the same subject (e.g. different
   *  angles of the same person). Providers that support multi-reference
   *  (Gemini: up to 14) pass them all. Providers that don't (OpenAI)
   *  silently ignore these. */
  additionalReferenceImages?: string[];
  /** Quality tier. Providers that don't support tiers ignore this. */
  quality: 'low' | 'medium' | 'high';
  /** Target image dimensions. Default: '1024x1024'. */
  size: string;
}

export interface ImageGenerationResult {
  /** Generated image as a data:image/png;base64,... URL. */
  imageUrl: string;
  /** Wall-clock time for the API round-trip. */
  durationMs: number;
  /** Estimated cost in US cents (e.g. 13.3 = $0.133). */
  costCents: number;
  /** Formatted cost for display (e.g. "$0.133"). */
  costUsd: string;
  /** Provider identifier (e.g. 'openai', 'gemini'). */
  provider: string;
  /** Model identifier (e.g. 'gpt-image-1.5', 'gemini-3-pro-image-preview'). */
  model: string;
}

export interface ImageProvider {
  /** Unique identifier used in the registry and request body. */
  id: string;
  /** Human-readable name shown in the UI dropdown. */
  displayName: string;
  /** Model identifier shown in results metadata. */
  model: string;
  /** Whether this provider has a configured API key and is ready to use. */
  isAvailable(): boolean;
  /** Available quality tiers with display prices. Providers with no quality
   *  differentiation return a single entry. */
  getQualityOptions(): Array<{
    value: 'low' | 'medium' | 'high';
    label: string;
    costDisplay: string;
  }>;
  /** Generate an image from a prompt and optional reference image. */
  generate(req: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

/** Serialisable summary returned by GET /api/admin/prompts/providers. */
export interface ProviderInfo {
  id: string;
  displayName: string;
  model: string;
  available: boolean;
  qualityOptions: Array<{
    value: string;
    label: string;
    costDisplay: string;
  }>;
}
