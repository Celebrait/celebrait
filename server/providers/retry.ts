// server/providers/retry.ts
//
// Generic retry wrapper for image generation. Sits between the route
// handler and any ImageProvider, adding configurable retry-on-safety
// with per-attempt logging. Same interface for lab and production.

import type { ImageProvider, ImageGenerationRequest, ImageGenerationResult } from './image-provider';
import { ProviderError, isProviderError, classifyOpenAIError, classifyGeminiError, type ProviderErrorKind } from './errors';

export interface RetryOptions {
  /** Max generation attempts (including the first). Default: 3. */
  maxAttempts: number;
  /** Delay in ms between retries. Default: 3000. */
  delayMs: number;
  /** Which error kinds to retry on. Default: safety only. */
  retryOnKinds: Set<ProviderErrorKind>;
  /** Called on each retry (for logging). */
  onRetry?: (attempt: number, maxAttempts: number, error: ProviderError) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delayMs: 3000,
  retryOnKinds: new Set<ProviderErrorKind>(['safety']),
  onRetry: undefined,
};

/**
 * Wraps a provider's generate() call with retry logic. If the provider
 * throws a retryable error whose kind is in `retryOnKinds`, waits
 * `delayMs` and tries again, up to `maxAttempts` total.
 *
 * On final failure, throws a ProviderError with `retryAttempts` set
 * to the number of attempts made.
 */
export async function generateWithRetry(
  provider: ImageProvider,
  req: ImageGenerationRequest,
  opts?: Partial<RetryOptions>,
): Promise<ImageGenerationResult> {
  const options: RetryOptions = { ...DEFAULT_OPTIONS, ...opts };
  let lastError: ProviderError | null = null;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await provider.generate(req);
    } catch (rawErr: unknown) {
      // Ensure we have a ProviderError to work with.
      let provErr: ProviderError;
      if (isProviderError(rawErr)) {
        provErr = rawErr;
      } else {
        // Adapter threw a plain Error — classify it based on provider.
        provErr = classifyByProvider(rawErr, provider.id);
      }

      lastError = provErr;

      // Should we retry?
      const shouldRetry =
        provErr.retryable &&
        options.retryOnKinds.has(provErr.kind) &&
        attempt < options.maxAttempts;

      // Log this attempt.
      const explanationSnippet = provErr.modelExplanation
        ? ` explanation="${provErr.modelExplanation.slice(0, 100)}"`
        : '';
      console.log(
        `[RETRY] provider=${provider.id} attempt=${attempt}/${options.maxAttempts} ` +
          `kind=${provErr.kind} code=${provErr.code} retryable=${shouldRetry}${explanationSnippet}`,
      );

      if (options.onRetry) {
        options.onRetry(attempt, options.maxAttempts, provErr);
      }

      if (!shouldRetry) {
        break;
      }

      // Wait before retrying.
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }

  // All attempts exhausted — enrich the error and throw.
  if (!lastError) {
    // Shouldn't happen, but guard against it.
    lastError = new ProviderError({
      kind: 'unknown',
      code: 'retry_exhausted',
      message: 'All retry attempts failed',
      retryable: false,
      provider: provider.id,
    });
  }

  lastError.retryAttempts = options.maxAttempts;
  throw lastError;
}

/**
 * Fallback classifier when an adapter throws a plain Error instead of
 * a ProviderError. Routes to the appropriate per-provider classifier.
 */
function classifyByProvider(err: unknown, providerId: string): ProviderError {
  switch (providerId) {
    case 'openai':
      return classifyOpenAIError(err, providerId);
    case 'gemini':
      return classifyGeminiError(err, providerId);
    default:
      return new ProviderError({
        kind: 'unknown',
        code: 'unclassified',
        message: (err as any)?.message ?? String(err),
        retryable: false,
        provider: providerId,
        cause: err,
      });
  }
}
