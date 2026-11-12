// server/prompts/seed-front-scene-group-v7.ts
//
// group v7 — teach the group prompt that it may receive MORE THAN ONE
// reference photo of the SAME people (Kevin 2026-07-30).
//
// WHY
//   Likeness on group cards varies roll to roll. Extra reference angles
//   are the cheapest lever we have on that: more views of a face means
//   more identity signal to work from. The provider layer already
//   supports it — background-generator splits referenceImages into
//   primary + additionalReferenceImages, and both OpenAI and Gemini
//   accept the extras — and the draft already carries photoIds as an
//   array. The ONLY things standing in the way are the studio's
//   MAX_PHOTOS.group = 1 cap and this prompt.
//
// THE RISK THIS EXISTS TO PREVENT
//   Every mention of the source in the live template is SINGULAR — it
//   opens "The reference photo contains multiple people". Hand that
//   three photos of the same couple and the obvious failure is the model
//   reading them as three separate groups and rendering six people. So
//   the prompt has to learn the multi-photo contract BEFORE the studio
//   is allowed to send multiple photos. Prompt Lab first; studio second.
//
// THE EDIT (one, deliberately)
//   H. REFERENCE PHOTO CONTEXT → multi-photo aware. Rewrites only the
//      opening context block. Every existing rule in it is preserved
//      word-for-word (no blending/averaging/merging, per-person identity,
//      distinguishing features); what's added is:
//        · one or more photos, showing the SAME people
//        · cast is determined from a SINGLE photo, never by summing
//          across photos — with a concrete example, because "don't add
//          people" alone is too abstract to bind reliably
//        · extra angles strengthen likeness, they don't add cast
//
//   Minimal-diff on purpose. The v4 lesson still stands: a broad rewrite
//   killed the person but lost the front's world. One block, additive.
//
// Sources from the ACTIVE group template (no hardcoded id — robust to
// version drift). Seeds as group version=7, PREVIEW-ONLY (live is
// untouched).
//
// HOW TO TEST IT — this is the whole point, so be specific:
//   In the Prompt Lab, run group v7 with TWO OR THREE photos of the SAME
//   people (different angles/lighting, not burst frames of one moment).
//   What you are checking, in priority order:
//     1. CAST COUNT. Two people in, two people out. Six people = fail,
//        and that is the failure this version exists to prevent.
//     2. LIKENESS. Better than the same scene from a single photo? If it
//        is no better, the extra references aren't earning their cost
//        and the studio change isn't worth shipping.
//     3. NO REGRESSION on a SINGLE photo. v7 must be at least as good as
//        v6 with one photo, since that stays the common case.
//   Activate only once all three pass:
//     npx tsx server/prompts/seed-front-scene-group-v7.ts --activate

import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  promptTemplates,
  promptActive,
  PROMPT_SLOTS,
  PROMPT_VARIANTS,
} from '@shared/schema';
import { invalidatePromptCache } from './resolver';

// ── Edit H — REFERENCE PHOTO CONTEXT becomes multi-photo aware ────────
const H_OLD = `REFERENCE PHOTO CONTEXT: The reference photo contains multiple people. Use the photo as IDENTITY SIGNAL — read each person's distinct facial structure, features, complexion, and hair so you can render each individual recognisably in the new scene. Do NOT blend, average, or merge features between subjects; each person must remain a separate, individually-recognisable identity in the output. Pay special attention to distinguishing features (skin tone differences, face shapes, hair styles, facial hair, etc.).`;

const H_NEW = `REFERENCE PHOTO CONTEXT: You may be given ONE OR MORE reference photos. When there is more than one, they show THE SAME group of people photographed at different moments, angles, or lighting — they are NOT separate groups and NOT extra people. Determine HOW MANY PEOPLE belong on the card from a SINGLE photo (the one showing the most people), never by adding people up across photos: three photos of two people means TWO people on the card, not six. Use all supplied photos TOGETHER as IDENTITY SIGNAL — read each person's distinct facial structure, features, complexion, and hair across every available angle so you can render each individual recognisably in the new scene. Additional angles exist to strengthen likeness, not to enlarge the cast. Do NOT blend, average, or merge features between subjects; each person must remain a separate, individually-recognisable identity in the output. Pay special attention to distinguishing features (skin tone differences, face shapes, hair styles, facial hair, etc.).`;

interface Edit {
  label: string;
  oldStr: string;
  newStr: string;
}
const EDITS: Edit[] = [{ label: 'H:multi-reference-photos', oldStr: H_OLD, newStr: H_NEW }];

const ACTIVATE = process.argv.includes('--activate');

async function main(): Promise<void> {
  console.log(
    `[SEED] group → V7 ${ACTIVATE ? '(WILL ACTIVATE)' : '(preview only — live untouched)'}`,
  );

  // Source from whatever group template is currently ACTIVE.
  const activeRows = await db
    .select()
    .from(promptActive)
    .where(
      and(
        eq(promptActive.slot, PROMPT_SLOTS.FRONT_SCENE),
        eq(promptActive.variant, PROMPT_VARIANTS.GROUP),
      ),
    )
    .limit(1);
  const activeId = activeRows[0]?.activeTemplateId;
  if (!activeId) throw new Error('group v7 seed: no active group template found');

  const srcRows = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, activeId))
    .limit(1);
  const src = srcRows[0];
  if (!src) throw new Error(`group v7 seed: active source id=${activeId} not found`);
  console.log(`  [SOURCE] active group id=${activeId} (${src.templateText.length} chars)`);

  let text = src.templateText;
  for (const edit of EDITS) {
    if (!text.includes(edit.oldStr)) {
      throw new Error(
        `group v7 seed: could not find ${edit.label} anchor in active id=${activeId} — template drifted? Update the OLD constant.`,
      );
    }
    text = text.replace(edit.oldStr, edit.newStr);
    console.log(`  [EDIT] applied ${edit.label}`);
  }

  const name = 'Front scene — group v7 (accepts multiple reference photos of the same people)';
  const notes =
    'V7 from the active group prompt (Kevin 2026-07-30). ONE edit (H): the REFERENCE PHOTO CONTEXT block now states that one OR MORE photos may be supplied, that multiple photos show THE SAME people from different angles, and — critically — that cast size is read from a SINGLE photo and never summed across photos ("three photos of two people means TWO people, not six"). Every pre-existing rule in that block is preserved verbatim. Unblocks raising MAX_PHOTOS.group above 1 in the studio; do NOT make that studio change until this is activated. Test priority: (1) cast count stays correct with 2-3 photos, (2) likeness beats single-photo, (3) no regression on a single photo. Preview-only.';

  const existing = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.slot, PROMPT_SLOTS.FRONT_SCENE),
        eq(promptTemplates.variant, PROMPT_VARIANTS.GROUP),
        eq(promptTemplates.version, 7),
      ),
    )
    .limit(1);

  let templateId: number;
  if (existing.length > 0) {
    templateId = existing[0].id;
    await db
      .update(promptTemplates)
      .set({ templateText: text, name, notes })
      .where(eq(promptTemplates.id, templateId));
    console.log(`  [REWRITE] group v7 (id=${templateId}, ${text.length} chars)`);
  } else {
    const [inserted] = await db
      .insert(promptTemplates)
      .values({
        slot: PROMPT_SLOTS.FRONT_SCENE,
        variant: PROMPT_VARIANTS.GROUP,
        cardType: null,
        name,
        version: 7,
        templateText: text,
        variables: src.variables,
        notes,
        createdBy: 'seed-front-scene-group-v7',
      })
      .returning();
    templateId = inserted.id;
    console.log(`  [INSERT] group v7 (id=${templateId}, ${text.length} chars)`);
  }

  if (ACTIVATE) {
    await db
      .update(promptActive)
      .set({ activeTemplateId: templateId })
      .where(
        and(
          eq(promptActive.slot, PROMPT_SLOTS.FRONT_SCENE),
          eq(promptActive.variant, PROMPT_VARIANTS.GROUP),
        ),
      );
    invalidatePromptCache();
    console.log(`  [ACTIVATE] group → id=${templateId}. Cache flushed.`);
  } else {
    console.log(
      `\n[SEED] group V7 inserted as id=${templateId} but NOT active. Select group v7 in the Prompt Lab and run it with 2-3 photos of the SAME people — check the cast count first, then likeness.`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[SEED] group V7 failed:', err);
  process.exit(1);
});
