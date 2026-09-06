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
  /** EDIT the primary reference rather than compose a new image from it
   *  (the cameo: "this card, with them painted in"). Forces OpenAI onto
   *  /v1/images/edits even when the variant prefers reference-conditioned
   *  generation. Providers without a distinct edit path ignore it. */
  editMode?: boolean;
  /** How faithfully an edit preserves the input images' detail (faces,
   *  lettering). OpenAI edits only. */
  inputFidelity?: 'low' | 'high';
  /** Quality tier. Providers that don't support tiers ignore this. */
  quality: 'low' | 'medium' | 'high';
  /** Target image dimensions. Default: '1024x1024'. */
  size: string;
  /** Which slot is being generated — providers can use different models
   *  per slot (e.g. Flash for front, Pro for inside). */
  slot?: string;
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
  /** Image-to-image edit: take an existing generated image and modify
   *  it per a short text instruction. Used by the regen flow when the
   *  user supplies a tweak — the existing card is the base and the
   *  tweak becomes the instruction, so composition/character/text are
   *  preserved and only the requested change is applied.
   *
   *  Providers that don't support native image editing (e.g. older
   *  OpenAI fallback) leave this undefined; the caller falls back to
   *  the regular `generate()` path.
   *
   *  `referencePhotos` are extra likeness anchors (the original user
   *  photos), passed alongside the base image for identity grounding. */
  refine?(
    imageBase64: string,
    instruction: string,
    referencePhotos?: string[],
  ): Promise<ImageGenerationResult>;
  /** Analyse reference photo(s) and return a detailed face description
   *  ("character anchor") that can be prepended to the generation prompt
   *  to improve identity preservation. Uses the provider's vision model.
   *  Returns null if the provider doesn't support face analysis. */
  analyzeReference?(images: string[]): Promise<string | null>;
}

/** Serialisable summary returned by GET /api/admin/prompts/providers. */
export interface ProviderInfo {
  id: string;
  displayName: string;
  model: string;
  available: boolean;
  /** True when this provider implements `refine` — i.e. it can edit
   *  an existing image with a text instruction. UI uses this to grey
   *  out provider buttons in the refine/regen toggle. */
  supportsRefine: boolean;
  qualityOptions: Array<{
    value: string;
    label: string;
    costDisplay: string;
  }>;
}
