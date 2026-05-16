// server/prompts/generation-log.ts
//
// Writes one row per image generation to generation_log. Every provider
// call — production card generation, Prompt Lab test run, regeneration,
// anything — should route through here so we have a single audit trail.
//
// Schema: see shared/models/prompts.ts. Intentionally minimal — enough
// to answer "which template generated card X" and roll up daily spend.
// Richer columns (safety category, token counts) can be added without
// breaking existing rows.
//
// PRE-BETA GATING (2026-04-28 — Kevin's call):
// During dev/testing, every gen Kevin runs is either stubbed
// (DEV_STUB_AI=1, $0 cost) or noise (his own test traffic, not real
// customer behaviour). Logging it pollutes the table — when beta
// launches we want clean signal from real customers, not 6 weeks of
// Kevin-testing data drowning out the first few real users' traction.
//
// Gating rules:
//   • If DEV_STUB_AI is on  → skip logging (cost is $0, no signal).
//   • If DEV_GEN_LOG=1 is set → opt-in, log even outside production
//     (use this for short windows where you want real data — e.g.
//     pricing experiments before beta opens).
//   • Otherwise outside production → skip logging.
//   • In production → always log (this is real customer data).

import { db } from '../db';
import { generationLog, type InsertGenerationLog } from '@shared/schema';

const STUB_AI_ON = process.env.DEV_STUB_AI === '1';
const DEV_LOG_OPT_IN = process.env.DEV_GEN_LOG === '1';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function shouldSkipLogging(): boolean {
  if (IS_PRODUCTION) return false; // always log in prod
  if (DEV_LOG_OPT_IN) return false; // explicit dev opt-in
  return true; // default: skip in dev (stub or otherwise)
}

if (shouldSkipLogging()) {
  console.warn(
    `[GEN_LOG] ⚠ generation_log writes DISABLED in this environment. ` +
      `Reason: ${STUB_AI_ON ? 'DEV_STUB_AI is on (no real cost data)' : 'NODE_ENV != production (test data pollutes beta metrics)'}. ` +
      `Set DEV_GEN_LOG=1 to opt in for real-data dev runs.`,
  );
}

export interface LogGenerationInput {
  /** Card row the generation belongs to. Null for lab-only test runs. */
  cardId: number | null;
  /** Slot the generation was for: 'front_scene', 'inside', etc. */
  slot: string;
  /** Template resolved for this generation, if any. Null if the resolver
   *  fell through to the hardcoded shared/prompts.ts fallback. */
  templateId: number | null;
  templateVersion: number | null;
  /** Provider adapter used (e.g. 'openai', 'gemini', 'flux'). */
  provider: string;
  /** Model identifier the provider reported (e.g. 'gpt-image-1.5'). */
  model: string;
  /** Quality tier actually passed to the provider. */
  quality: 'low' | 'medium' | 'high' | null;
  /** Cost in US cents — e.g. 13.3 for $0.133. Stored ×100 for sub-cent
   *  precision. */
  costCents: number;
  durationMs: number;
  success: boolean;
  /** Structured error kind on failure; null on success. */
  errorCode?: string | null;
}

export async function logGeneration(input: LogGenerationInput): Promise<void> {
  // Pre-beta gate — see file header. Skip silently in dev unless
  // explicitly opted in. Cost Ledger is built FOR beta data, not
  // Kevin's testing.
  if (shouldSkipLogging()) return;

  // Best-effort — a failed log write should never abort the generation.
  try {
    const row: InsertGenerationLog = {
      cardId: input.cardId,
      slot: input.slot,
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      provider: input.provider,
      model: input.model,
      quality: input.quality,
      costCentsX100: Math.round(input.costCents * 100),
      durationMs: input.durationMs,
      success: input.success,
      errorCode: input.errorCode ?? null,
    };
    await db.insert(generationLog).values(row);
  } catch (err: any) {
    console.error('[GEN_LOG] Failed to write generation_log row:', err?.message ?? err);
  }
}
