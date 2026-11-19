// server/prompts/llm-cost.ts
//
// Token → USD-cents cost for the TEXT/VISION LLM calls (the image
// providers carry their own per-image cost tables). Added 2026-07-29
// when the Cost Ledger audit found three LLM surfaces spending real
// money with no generation_log rows: photo analysis (every upload),
// scene suggestions, and the brainstorm chat.
//
// ⚠️ PRICES DRIFT. These are per-1M-token USD list prices as last
// checked; verify against the actual OpenAI/Google invoices monthly and
// correct HERE — this table is the single source. Unknown models log at
// the CONSERVATIVE fallback rather than silently costing £0, so a new
// model can never spend invisibly.

const PRICES_PER_MTOK_USD: Record<string, { input: number; output: number; cached?: number }> = {
  'gpt-4o': { input: 2.5, output: 10.0, cached: 1.25 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cached: 0.075 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  // Checked against developers.openai.com/api/docs/pricing, 2026-09-16.
  // The earlier placeholder ($10 output) UNDERcounted gpt-5.4 by a third
  // — the card writer's reasoning tokens bill as output.
  'gpt-5.5': { input: 5.0, output: 30.0, cached: 0.5 },
  'gpt-5.4': { input: 2.5, output: 15.0, cached: 0.25 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5, cached: 0.075 },
};

/** Fallback for unlisted models: priced like gpt-4o so an unpriced model
 *  OVERCOUNTS rather than vanishes from the ledger. */
const FALLBACK = { input: 5.0, output: 30.0 };

/** Cost in US cents (e.g. 0.42 = $0.0042), ready for logGeneration's
 *  costCents field. */
export function llmCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
  /** Of `inputTokens`, how many were served from the prompt cache
   *  (usage.prompt_tokens_details.cached_tokens) — billed at the cached rate. */
  cachedInputTokens = 0,
): number {
  const p = PRICES_PER_MTOK_USD[model] ?? FALLBACK;
  const cached = Math.min(cachedInputTokens, inputTokens);
  const usd =
    ((inputTokens - cached) / 1_000_000) * p.input +
    (cached / 1_000_000) * (p.cached ?? p.input) +
    (outputTokens / 1_000_000) * p.output;
  return usd * 100;
}

/** The same, straight from a chat.completions `usage` block. */
export function chatUsageCents(model: string, usage: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } | null } | undefined | null): number {
  return llmCostCents(model, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0, usage?.prompt_tokens_details?.cached_tokens ?? 0);
}
