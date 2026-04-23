// server/prompts/retire-gemini-flash-2-5.ts
//
// One-shot migration: retires the bogus `gemini-flash-2-5` provider.
// No such image-generation model exists on Google's API — the ID I
// guessed (gemini-2.5-flash-image-preview) 404s. 2.5 Flash is text /
// vision-input only.
//
// Any prompt_active row currently pointing at `gemini-flash-2-5` gets
// repointed to `gemini-flash` — the real Flash (Nano Banana 2, a.k.a.
// gemini-3.1-flash-image-preview). This is what "Gemini Flash" has
// always meant in practice; the 2.5 entry was a parallel ghost.
//
// Idempotent. Run:
//   npx tsx server/prompts/retire-gemini-flash-2-5.ts

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { promptActive } from '@shared/schema';
import { invalidatePromptCache } from './resolver';

// `gemini-flash-2-5` is no longer part of the PromptProvider union
// (we just narrowed it). Reference the literal via sql`...` so the
// narrowed column type doesn't reject it at query-build time.
const STUCK_PROVIDER = sql`${promptActive.provider} = 'gemini-flash-2-5'`;

async function main(): Promise<void> {
  console.log('[RETIRE] gemini-flash-2-5 → gemini-flash repoint');

  const stuck = await db
    .select({
      slot: promptActive.slot,
      cardType: promptActive.cardType,
      variant: promptActive.variant,
      provider: promptActive.provider,
    })
    .from(promptActive)
    .where(STUCK_PROVIDER);

  if (stuck.length === 0) {
    console.log('[RETIRE] No rows to update — nothing pointed at the bogus provider.');
    process.exit(0);
  }

  console.log(`[RETIRE] Found ${stuck.length} row(s) to repoint:`);
  for (const row of stuck) {
    console.log(
      `       ${row.slot}/${row.cardType || '""'}/${row.variant || '""'} → ${row.provider}`,
    );
  }

  const result = await db
    .update(promptActive)
    .set({
      provider: 'gemini-flash',
      updatedAt: new Date(),
      updatedBy: 'retire-gemini-flash-2-5',
    })
    .where(STUCK_PROVIDER)
    .returning({
      slot: promptActive.slot,
      variant: promptActive.variant,
    });

  console.log(`[RETIRE] Repointed ${result.length} row(s) to gemini-flash.`);

  invalidatePromptCache();
  console.log('[RETIRE] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[RETIRE] Failed:', err);
  process.exit(1);
});
