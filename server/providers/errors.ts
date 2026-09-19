// server/providers/errors.ts
//
// Typed error class for image generation providers. Every adapter throws
// ProviderError (not plain Error) so the retry wrapper and route handler
// can make decisions based on the error kind without string-matching.

export type ProviderErrorKind =
  | 'safety'   // content policy / moderation block — NOT retryable (deterministic;
               //   retrying the same prompt won't change the model's mind, just
               //   wastes ~3s of user wait + a billed attempt per retry)
  | 'auth'     // bad or missing API key — NOT retryable
  | 'rate'     // rate limit / quota — retryable after backoff
  | 'server'   // provider-side 5xx or empty response — retryable
  | 'unknown'; // anything else

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly code: string;
  readonly retryable: boolean;
  /** Explanation text from the model itself, if the provider returned one
   *  (Gemini often does on safety refusals; OpenAI rarely does). */
  readonly modelExplanation: string | null;
  /** Appropriate HTTP status for the route to return. */
  readonly httpStatus: number;
  /** Which provider threw this. */
  readonly provider: string;
  /** How many retry attempts were made before this error was thrown.
   *  Set by the retry wrapper, not by the adapter. */
  retryAttempts: number;
  /** User-facing suggestions for how to fix the issue. Static per kind. */
  suggestions: string[];

  constructor(opts: {
    kind: ProviderErrorKind;
    code: string;
    message: string;
    retryable: boolean;
    modelExplanation?: string | null;
    httpStatus?: number;
    provider: string;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = 'ProviderError';
    this.kind = opts.kind;
    this.code = opts.code;
    this.retryable = opts.retryable;
    this.modelExplanation = opts.modelExplanation ?? null;
    this.provider = opts.provider;
    this.retryAttempts = 0;
    this.suggestions = getSuggestionsForKind(opts.kind);
    this.httpStatus = opts.httpStatus ?? httpStatusForKind(opts.kind);
    if (opts.cause) {
      this.cause = opts.cause;
    }
  }
}

export function isProviderError(err: unknown): err is ProviderError {
  return err instanceof ProviderError;
}

// ─── Safety detection: OpenAI ────────────────────────────────────────────────

// Reuses the same codes from shared/openaiErrorHandler.ts SAFETY_CODES
const OPENAI_SAFETY_CODES = new Set([
  'content_policy_violation',
  'moderation_blocked',
  'safety_system',
]);

const OPENAI_SAFETY_PATTERN = /safety.system|content.policy|moderation|rejected by the safety/i;

/**
 * Classify an OpenAI API error into a ProviderError. Works with both
 * raw fetch error bodies (parsed JSON) and OpenAI SDK thrown errors.
 */
export function classifyOpenAIError(
  rawError: unknown,
  providerId: string,
): ProviderError {
  // Try to extract structured fields from the error.
  const err = rawError as any;
  const errorObj = err?.error ?? err;
  const code: string = errorObj?.code ?? errorObj?.type ?? '';
  const message: string = errorObj?.message ?? err?.message ?? String(rawError);
  const status: number = err?.status ?? err?.statusCode ?? 500;

  // Safety?
  if (OPENAI_SAFETY_CODES.has(code) || OPENAI_SAFETY_PATTERN.test(message)) {
    return new ProviderError({
      kind: 'safety',
      code: code || 'safety_unknown',
      message: `Safety filter: ${message}`,
      // Deterministic — same prompt, same answer. Don't retry. Surface
      // the friendly panel immediately and let the user edit the input.
      retryable: false,
      modelExplanation: message,
      httpStatus: 400,
      provider: providerId,
      cause: rawError,
    });
  }

  // Auth?
  if (status === 401 || code === 'invalid_api_key') {
    return new ProviderError({
      kind: 'auth',
      code: code || 'auth_error',
      message: `Authentication error: ${message}`,
      retryable: false,
      httpStatus: 401,
      provider: providerId,
      cause: rawError,
    });
  }

  // Rate limit?
  if (status === 429 || code === 'rate_limit_exceeded') {
    return new ProviderError({
      kind: 'rate',
      code: code || 'rate_limit',
      message: `Rate limit: ${message}`,
      retryable: true,
      httpStatus: 429,
      provider: providerId,
      cause: rawError,
    });
  }

  // Server error?
  if (status >= 500) {
    return new ProviderError({
      kind: 'server',
      code: code || 'server_error',
      message: `Server error: ${message}`,
      retryable: true,
      httpStatus: 503,
      provider: providerId,
      cause: rawError,
    });
  }

  // Unknown
  return new ProviderError({
    kind: 'unknown',
    code: code || 'unknown',
    message,
    retryable: false,
    httpStatus: 500,
    provider: providerId,
    cause: rawError,
  });
}

// ─── Safety detection: Gemini ────────────────────────────────────────────────

// Includes Google's modern IMAGE-model refusal codes. Gemini image
// gen/edit now declines with IMAGE_SAFETY / PROHIBITED_CONTENT /
// IMAGE_OTHER / SPII (e.g. when asked to EDIT a photo of a real person),
// none of which were in the old set — so those refusals were silently
// misclassified as 'unknown' and surfaced as a useless error.
const GEMINI_SAFETY_REASONS = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_OTHER',
  'PROHIBITED_CONTENT',
  'SPII',
]);

/**
 * Classify a Gemini error. Can be called with either a thrown SDK error
 * or with the response candidate when it's missing image parts.
 */
export function classifyGeminiError(
  rawError: unknown,
  providerId: string,
  opts?: {
    finishReason?: string;
    modelText?: string;
  },
): ProviderError {
  const err = rawError as any;
  const message: string = err?.message ?? String(rawError);
  const finishReason = opts?.finishReason ?? '';
  const modelText = opts?.modelText ?? null;

  // Safety refusal (detected from finishReason or from error message)
  if (
    GEMINI_SAFETY_REASONS.has(finishReason) ||
    /safety|blocked|harmful|policy/i.test(message)
  ) {
    return new ProviderError({
      kind: 'safety',
      code: finishReason || 'safety_blocked',
      message: `Safety filter: ${modelText?.slice(0, 200) || message}`,
      // Deterministic — same prompt, same answer. Don't retry. Surface
      // the friendly panel immediately and let the user edit the input.
      retryable: false,
      modelExplanation: modelText?.slice(0, 500) || null,
      httpStatus: 400,
      provider: providerId,
      cause: rawError,
    });
  }

  // Auth only — tight match. The previous `/api.key/i` regex fired on
  // boilerplate BadRequest payloads that mention "API key" in passing
  // (e.g. a 400 echoing back "check your API key configuration"),
  // mis-labelling real user-input errors as auth failures. Now requires
  // either an explicit 401 status or a clear invalid-key phrase /
  // Google's API_KEY_INVALID reason code.
  const status: number = err?.status ?? err?.statusCode ?? 0;
  const reason: string = err?.error?.details?.[0]?.reason ?? err?.reason ?? '';
  if (
    status === 401 ||
    reason === 'API_KEY_INVALID' ||
    /\b(401|unauthorized)\b/i.test(message) ||
    /api[\s_-]?key\s+(not\s+valid|invalid|expired|missing)/i.test(message) ||
    /invalid\s+api[\s_-]?key/i.test(message)
  ) {
    return new ProviderError({
      kind: 'auth',
      code: 'auth_error',
      message: `Authentication error: ${message}`,
      retryable: false,
      httpStatus: 401,
      provider: providerId,
      cause: rawError,
    });
  }

  // Rate limit
  if (/429|quota|rate.limit|resource.exhausted/i.test(message)) {
    return new ProviderError({
      kind: 'rate',
      code: 'rate_limit',
      message: `Rate limit: ${message}`,
      retryable: true,
      httpStatus: 429,
      provider: providerId,
      cause: rawError,
    });
  }

  // Server
  if (/500|502|503|504|internal|unavailable/i.test(message)) {
    return new ProviderError({
      kind: 'server',
      code: 'server_error',
      message: `Server error: ${message}`,
      retryable: true,
      httpStatus: 503,
      provider: providerId,
      cause: rawError,
    });
  }

  // Unknown — fold the finishReason + any model text into the message so
  // the panel's technical details are diagnosable instead of a bare
  // "unknown" (the reason was being thrown away here).
  const detail = [
    finishReason && `finishReason=${finishReason}`,
    modelText?.slice(0, 200),
  ]
    .filter(Boolean)
    .join(' · ');
  return new ProviderError({
    kind: 'unknown',
    code: finishReason || 'unknown',
    message: detail ? `${message} (${detail})` : message,
    retryable: false,
    httpStatus: 500,
    modelExplanation: modelText?.slice(0, 500) || null,
    provider: providerId,
    cause: rawError,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function httpStatusForKind(kind: ProviderErrorKind): number {
  switch (kind) {
    case 'safety': return 400;
    case 'auth': return 401;
    case 'rate': return 429;
    case 'server': return 503;
    default: return 500;
  }
}

function getSuggestionsForKind(kind: ProviderErrorKind): string[] {
  switch (kind) {
    case 'safety':
      return [
        'Try a different reference photo (clearer face, neutral expression)',
        'Simplify the scene description — remove anything potentially edgy',
        'Change the art style (some styles trigger safety filters more than others)',
        'If using a group photo, try a single-person photo instead',
        'Remove references to specific real people, brands, or copyrighted characters',
      ];
    case 'rate':
      return ['Wait 30 seconds and try again', 'Switch to a different provider'];
    case 'auth':
      return ['Check the API key in your .env file', 'Verify billing is enabled for this provider'];
    case 'server':
      return ['Try again in a minute', 'Switch to a different provider'];
    default:
      return ['Try again with different inputs'];
  }
}
