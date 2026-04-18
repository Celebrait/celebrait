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

import { db } from '../db';
import { generationLog, type InsertGenerationLog } from '@shared/schema';

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
