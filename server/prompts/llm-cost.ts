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

const PRICES_PER_MTOK_USD: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
};

/** Fallback for unlisted models: priced like gpt-4o so an unpriced model
 *  OVERCOUNTS rather than vanishes from the ledger. */
const FALLBACK = { input: 2.5, output: 10.0 };

/** Cost in US cents (e.g. 0.42 = $0.0042), ready for logGeneration's
 *  costCents field. */
export function llmCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICES_PER_MTOK_USD[model] ?? FALLBACK;
  const usd =
    (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
  return usd * 100;
}
