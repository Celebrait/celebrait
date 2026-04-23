// server/prompts/bulk-set-providers.ts
//
// One-shot migration: sets provider + quality on every row in
// prompt_active that currently has them null. The per-mode variant split
// created new prompt_active rows for each front_scene variant without
// carrying over provider/quality, so every slot fell back to the runtime
// default (OpenAI) even though production was configured for Gemini Pro.
//
// Defaults:
//   provider = 'gemini'   (Pro — nano-banana-pro-preview)
//   quality  = 'high'     (Gemini doesn't have quality tiers; 'high' is
//                          the single-option value the provider accepts)
//
// Idempotent — skips rows that already have a provider set. Cache is
// invalidated at the end so the resolver picks up the change on the
// next generation.
//
// Run:
//   npx tsx server/prompts/bulk-set-providers.ts

import 'dotenv/config';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db';
import { promptActive } from '@shared/schema';
import { invalidatePromptCache } from './resolver';

const DEFAULT_PROVIDER = 'gemini' as const;
const DEFAULT_QUALITY = 'high' as const;

async function main(): Promise<void> {
  console.log('[BULK] Setting provider defaults on active pointers with null provider');

  // List the current state so the log shows what we're touching.
  const all = await db
    .select({
      slot: promptActive.slot,
      cardType: promptActive.cardType,
      variant: promptActive.variant,
      activeTemplateId: promptActive.activeTemplateId,
      provider: promptActive.provider,
      quality: promptActive.quality,
    })
    .from(promptActive);

  console.log(`[BULK] Found ${all.length} active pointer(s):`);
  for (const row of all) {
    console.log(
      `       ${row.slot}/${row.cardType || '""'}/${row.variant || '""'} → ` +
        `template=${row.activeTemplateId} provider=${row.provider ?? 'null'} quality=${row.quality ?? 'null'}`,
    );
  }

  const result = await db
    .update(promptActive)
    .set({
      provider: DEFAULT_PROVIDER,
      quality: DEFAULT_QUALITY,
      updatedAt: new Date(),
      updatedBy: 'bulk-set-providers',
    })
    .where(
      and(
        // Only touch rows with no provider set — don't overwrite any row
        // an admin has already customised via the Production view.
        isNull(promptActive.provider),
      ),
    )
    .returning({
      slot: promptActive.slot,
      variant: promptActive.variant,
      cardType: promptActive.cardType,
    });

  console.log(`[BULK] Updated ${result.length} row(s):`);
  for (const row of result) {
    console.log(
      `       ${row.slot}/${row.cardType || '""'}/${row.variant || '""'} → ${DEFAULT_PROVIDER} / ${DEFAULT_QUALITY}`,
    );
  }

  // Blow away the resolver cache so the next generation reads the fresh
  // provider + quality without waiting for the 60s TTL.
  invalidatePromptCache();

  console.log('[BULK] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[BULK] Failed:', err);
  process.exit(1);
});
