// server/prompts/update-front-scene-variants-v1.ts
//
// Rewrites the active V1 template text for each front_scene variant with
// the current composed constants in seed-v1.ts, in place. No version bump.
//
// Why in place: the four fixes rolled in here (SCENE ENERGY restore,
// CHARACTER-TEXT SEPARATION, LANGUAGE/SCRIPT LOCK, ANATOMICAL FIT) were
// always intended as V1 behaviour — they only got "lost" when the
// monolithic front_scene V1 was split into three variant rows that
// inherited a pre-fix baseline. V2 stays reserved for the next rewrite
// pass (tighter, per-variant, more focussed).
//
// Also cleans up any v2 rows / v2 pointers that an earlier, backed-out
// migration may have created, so V1 is unambiguously the only active
// pointer.
//
// Idempotent. Run:
//   npx tsx server/prompts/update-front-scene-variants-v1.ts

import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  promptTemplates,
  promptActive,
  PROMPT_SLOTS,
  PROMPT_VARIANTS,
  type PromptVariant,
} from '@shared/schema';
import {
  FRONT_SCENE_ONE_PERSON_V1,
  FRONT_SCENE_MULTI_INDIVIDUAL_V1,
  FRONT_SCENE_GROUP_V1,
} from './seed-v1';

interface VariantSpec {
  variant: PromptVariant;
  templateText: string;
  notes: string;
}

const VARIANT_SPECS: VariantSpec[] = [
  {
    variant: PROMPT_VARIANTS.ONE_PERSON,
    templateText: FRONT_SCENE_ONE_PERSON_V1,
    notes:
      'V1 sweep: restored SCENE ENERGY; added CHARACTER-TEXT SEPARATION, LANGUAGE/SCRIPT LOCK, ANATOMICAL FIT to shared scaffold.',
  },
  {
    variant: PROMPT_VARIANTS.MULTI_INDIVIDUAL,
    templateText: FRONT_SCENE_MULTI_INDIVIDUAL_V1,
    notes:
      'V1 sweep: added CHARACTER-TEXT SEPARATION, LANGUAGE/SCRIPT LOCK, ANATOMICAL FIT to shared scaffold.',
  },
  {
    variant: PROMPT_VARIANTS.GROUP,
    templateText: FRONT_SCENE_GROUP_V1,
    notes:
      'V1 sweep: added CHARACTER-TEXT SEPARATION, LANGUAGE/SCRIPT LOCK, ANATOMICAL FIT to shared scaffold.',
  },
];

async function updateV1(spec: VariantSpec): Promise<number> {
  const slot = PROMPT_SLOTS.FRONT_SCENE;

  const existing = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.slot, slot),
        eq(promptTemplates.variant, spec.variant),
        eq(promptTemplates.version, 1),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    throw new Error(
      `No v1 row for ${slot}/${spec.variant} — run seed-v1 first.`,
    );
  }

  const row = existing[0];
  const prevLen = row.templateText.length;
  const nextLen = spec.templateText.length;
  if (row.templateText === spec.templateText) {
    console.log(
      `  [NOOP] ${slot}/${spec.variant} v1 (id=${row.id}, already matches, ${nextLen} chars)`,
    );
    return row.id;
  }

  await db
    .update(promptTemplates)
    .set({
      templateText: spec.templateText,
      notes: spec.notes,
    })
    .where(eq(promptTemplates.id, row.id));
  console.log(
    `  [UPDATE] ${slot}/${spec.variant} v1 (id=${row.id}, ${prevLen} → ${nextLen} chars)`,
  );
  return row.id;
}

async function pointPointerAtV1(variant: PromptVariant, v1Id: number): Promise<void> {
  const slot = PROMPT_SLOTS.FRONT_SCENE;
  const existing = await db
    .select()
    .from(promptActive)
    .where(
      and(
        eq(promptActive.slot, slot),
        eq(promptActive.cardType, ''),
        eq(promptActive.variant, variant),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(promptActive).values({
      slot,
      cardType: '',
      variant,
      activeTemplateId: v1Id,
      updatedBy: 'update-front-scene-variants-v1',
    });
    console.log(`  [ACTIVATE] ${slot}/${variant} → template ${v1Id} (new pointer)`);
    return;
  }

  if (existing[0].activeTemplateId === v1Id) {
    console.log(`  [NOOP] ${slot}/${variant} already points at ${v1Id}`);
    return;
  }

  await db
    .update(promptActive)
    .set({
      activeTemplateId: v1Id,
      updatedAt: new Date(),
      updatedBy: 'update-front-scene-variants-v1',
    })
    .where(
      and(
        eq(promptActive.slot, slot),
        eq(promptActive.cardType, ''),
        eq(promptActive.variant, variant),
      ),
    );
  console.log(
    `  [ACTIVATE] ${slot}/${variant} → template ${v1Id} (repointed from ${existing[0].activeTemplateId})`,
  );
}

async function dropStrayV2s(): Promise<void> {
  const slot = PROMPT_SLOTS.FRONT_SCENE;
  // Find any v2 rows for front_scene variants — cleanup from the backed-out
  // V2 migration. Safe to delete because no pointer references them after
  // we repoint to V1 above.
  const v2Rows = await db
    .select()
    .from(promptTemplates)
    .where(
      and(eq(promptTemplates.slot, slot), eq(promptTemplates.version, 2)),
    );
  for (const row of v2Rows) {
    if (row.variant === null) continue; // leave non-variant v2 alone
    await db.delete(promptTemplates).where(eq(promptTemplates.id, row.id));
    console.log(
      `  [DELETE] stray ${slot}/${row.variant} v2 (id=${row.id})`,
    );
  }
}

async function main(): Promise<void> {
  console.log('[UPDATE] front_scene variants → V1 in place');
  console.log('[UPDATE] sweep: SCENE ENERGY + CHARACTER-TEXT SEPARATION + LANGUAGE/SCRIPT LOCK + ANATOMICAL FIT');

  const ids: Array<{ variant: PromptVariant; id: number }> = [];
  for (const spec of VARIANT_SPECS) {
    const id = await updateV1(spec);
    ids.push({ variant: spec.variant, id });
  }

  // Repoint first (so no pointer references a row we're about to delete),
  // then drop any stray V2 rows left over from the backed-out migration.
  for (const { variant, id } of ids) {
    await pointPointerAtV1(variant, id);
  }
  await dropStrayV2s();

  console.log('[UPDATE] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[UPDATE] Failed:', err);
  process.exit(1);
});
