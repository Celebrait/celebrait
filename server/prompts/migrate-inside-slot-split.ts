// server/prompts/migrate-inside-slot-split.ts
//
// One-off migration: rename the unified `inside` slot to `inside_write` +
// `inside_blank`. Part of Prompt Lab Phase 4c — see
// PROMPT_LAB_PLAN.md + the handover memory for context.
//
// Before: prompt_templates has rows with slot='inside' (v1 = text-bearing,
//         v2 = decorative-blank). prompt_active has one row for slot='inside'
//         pointing at whichever version the admin activated (probably v1).
// After:  prompt_templates v1 is renamed to slot='inside_write' v1.
//         prompt_templates v2 is renamed to slot='inside_blank' v1
//         (version reset to 1 — it's v1 of the new slot).
//         prompt_active's old row is renamed to slot='inside_write'.
//         A new prompt_active row for slot='inside_blank' is inserted
//         pointing at the renamed blank template, so Blank mode has an
//         active template from day one.
//
// Idempotent: re-running after the migration completes is a no-op. Safe
// to run in production.
//
// Run:
//   npx tsx server/prompts/migrate-inside-slot-split.ts

import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { promptTemplates, promptActive } from '@shared/schema';

async function main(): Promise<void> {
  console.log('[MIGRATE] inside → inside_write/inside_blank — starting');

  // Quick bail-out: if inside_write templates already exist, we've already
  // migrated. Re-running is safe but log it and exit so we don't walk
  // through the work for nothing.
  const alreadyMigrated = await db
    .select({ id: promptTemplates.id })
    .from(promptTemplates)
    .where(eq(promptTemplates.slot, 'inside_write'))
    .limit(1);
  if (alreadyMigrated.length > 0) {
    console.log('[MIGRATE] Already migrated — inside_write templates exist. No-op.');
    process.exit(0);
  }

  // ── 1. Find existing inside templates ─────────────────────────────
  const existing = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.slot, 'inside'));

  console.log(`[MIGRATE] Found ${existing.length} existing 'inside' template rows`);

  // Partition: v1 (and anything not blank-like) → inside_write. Known
  // blank is v2 per the seed scripts. We match by version for safety
  // but also recognise the blank notes/name pattern as a fallback.
  const writeRows = existing.filter((r) => r.version === 1);
  const blankRows = existing.filter(
    (r) =>
      r.version !== 1 &&
      (r.version === 2 ||
        /blank/i.test(r.name) ||
        /blank/i.test(r.notes ?? '')),
  );
  const unclassified = existing.filter(
    (r) => !writeRows.includes(r) && !blankRows.includes(r),
  );

  if (unclassified.length > 0) {
    console.warn(
      `[MIGRATE] ${unclassified.length} 'inside' template row(s) could not be classified ` +
        `as write or blank. They will be migrated to inside_write by default. ` +
        `Rows: ${unclassified.map((r) => `v${r.version}(${r.name})`).join(', ')}`,
    );
    // Treat unclassified as write (safer — v1 is the main path).
    writeRows.push(...unclassified);
  }

  // ── 2. Rename templates ───────────────────────────────────────────
  // inside_write: same version numbers as before (v1 → v1, v3 → v3, ...)
  for (const row of writeRows) {
    await db
      .update(promptTemplates)
      .set({ slot: 'inside_write' })
      .where(eq(promptTemplates.id, row.id));
    console.log(`  [WRITE] id=${row.id} v${row.version} "${row.name}" → slot=inside_write`);
  }

  // inside_blank: reset version to 1 (it's v1 of the new slot, not v2).
  // If there are multiple blank versions later they can re-number as v2+.
  let blankVersionCounter = 1;
  for (const row of blankRows) {
    const newVersion = blankVersionCounter++;
    await db
      .update(promptTemplates)
      .set({ slot: 'inside_blank', version: newVersion })
      .where(eq(promptTemplates.id, row.id));
    console.log(
      `  [BLANK] id=${row.id} v${row.version} "${row.name}" → slot=inside_blank v${newVersion}`,
    );
  }

  // ── 3. Migrate the active pointer(s) ──────────────────────────────
  const activeRows = await db
    .select()
    .from(promptActive)
    .where(eq(promptActive.slot, 'inside'));

  console.log(`[MIGRATE] Found ${activeRows.length} active 'inside' pointer row(s)`);

  for (const act of activeRows) {
    // Figure out what the active template became after renaming.
    const [tpl] = await db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, act.activeTemplateId))
      .limit(1);
    if (!tpl) {
      console.warn(
        `[MIGRATE] active pointer refs template id=${act.activeTemplateId} which no longer exists — skipping`,
      );
      continue;
    }

    // Update the old row to the new slot (either inside_write or inside_blank
    // depending on which slot the renamed template ended up in).
    await db
      .update(promptActive)
      .set({ slot: tpl.slot })
      .where(
        and(eq(promptActive.slot, 'inside'), eq(promptActive.cardType, act.cardType)),
      );
    console.log(
      `  [ACTIVE] slot=inside cardType="${act.cardType}" → slot=${tpl.slot}`,
    );
  }

  // ── 4. Ensure inside_blank has an active pointer if a blank template exists ──
  // If the admin had only activated the v1 (write) template, the blank slot
  // has no pointer — Studio's Blank mode would throw. Seed a default blank
  // pointer to the first blank template we found.
  if (blankRows.length > 0) {
    const [existingBlankActive] = await db
      .select()
      .from(promptActive)
      .where(and(eq(promptActive.slot, 'inside_blank'), eq(promptActive.cardType, '')))
      .limit(1);

    if (!existingBlankActive) {
      const [firstBlank] = await db
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.slot, 'inside_blank'))
        .limit(1);
      if (firstBlank) {
        await db.insert(promptActive).values({
          slot: 'inside_blank',
          cardType: '',
          activeTemplateId: firstBlank.id,
          updatedBy: 'migrate-inside-slot-split',
        });
        console.log(
          `  [ACTIVE] seeded slot=inside_blank → template id=${firstBlank.id} (v${firstBlank.version})`,
        );
      }
    }
  }

  console.log('[MIGRATE] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[MIGRATE] Failed:', err);
  process.exit(1);
});
