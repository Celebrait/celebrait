// server/prompts/revert-one-person-to-v2.ts
//
// Revert the active pointer for front_scene/one_person back to v2
// (id=13). Built 2026-05-15 after the v3+v4 scaffold changes (intended
// for the group variant) rippled into one_person via the shared
// FRONT_SCENE_SCAFFOLD. one_person tests on v2 (marathon, chef, DJ,
// beach) were all landing well; v3/v4 weren't explicitly retested for
// regressions on the single-person path. Safer to freeze one_person
// at known-good v2 and iterate group independently going forward.
//
// Variants now diverge by design:
//   one_person       → v2 (id=13)  — frozen at known-good
//   multi_individual → v1 (id=7)   — parked anyway
//   group            → v4 (id=21)  — current iteration target
//
// Future scaffold-level changes need to either (a) target per-variant
// preambles only or (b) explicitly call out which variants are being
// touched + tested.
//
// Run:
//   npx tsx server/prompts/revert-one-person-to-v2.ts

import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { promptActive, PROMPT_SLOTS, PROMPT_VARIANTS } from '@shared/schema';
import { invalidatePromptCache } from './resolver';

const TARGET_TEMPLATE_ID = 13; // front_scene/one_person v2

async function main(): Promise<void> {
  console.log(
    `[REVERT] front_scene/one_person → id=${TARGET_TEMPLATE_ID} (v2, known-good)`,
  );

  const result = await db
    .update(promptActive)
    .set({ activeTemplateId: TARGET_TEMPLATE_ID })
    .where(
      and(
        eq(promptActive.slot, PROMPT_SLOTS.FRONT_SCENE),
        eq(promptActive.variant, PROMPT_VARIANTS.ONE_PERSON),
      ),
    )
    .returning({ activeTemplateId: promptActive.activeTemplateId });

  if (result.length === 0) {
    console.error(
      '[REVERT] No active pointer row for front_scene/one_person — nothing updated.',
    );
    process.exit(1);
  }

  invalidatePromptCache();
  console.log(
    `[REVERT] Done. one_person now points at id=${result[0].activeTemplateId}. Resolver cache flushed.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('[REVERT] Failed:', err);
  process.exit(1);
});
