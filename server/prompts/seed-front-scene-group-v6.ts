// server/prompts/seed-front-scene-group-v6.ts
//
// group v6 — built from the live/active group prompt. TWO surgical edits,
// both aimed at the recurring "expressions get planted, not adapted" group
// failure (Kevin 2026-07-24, gladiator-battle example: two men on a sofa
// with mild posed smiles → two gladiators mid-swordfight wearing the SAME
// mild sofa smiles).
//
// ROOT CAUSE: the prompt kept naming "happy/smiling" as the target
// ("always look happy"; EXPRESSION REBORN only illustrates JOYFUL faces),
// so for a non-happy scene the model reasons "the reference smile is
// already happy → keep it" and never adapts. There was NO target for
// fierce / intense / effortful expressions.
//
//   F. HAPPY → POSITIVELY IMMERSED. Replace the base scaffold's blanket
//      "always look happy" line. Keep the protection it was there for (no
//      sad/blank/awkward/menacing faces on a card) but decouple it from a
//      mild smile: the emotional CORE stays positive; the FORM of that
//      positivity flexes with the scene's true energy (fierce/triumphant
//      for a battle, awe for a vista, warmth for a tender beat, laughter
//      for a party).
//   G. EXPRESSION SPECTRUM. Extend the EXPRESSION IS REBORN block (which
//      only illustrated joyful celebration) with an ACTION/COMPETITION
//      branch — effort + ferocity, mouths mid-shout/roar, gritted teeth,
//      blazing eyes — and the rule "smiling is correct only for genuinely
//      happy scenes; a mild smile on a fierce scene is the pasted-cutout
//      tell."
//
// Sources from the ACTIVE group template (no hardcoded id — robust to
// version drift). Seeds as group version=6, PREVIEW-ONLY (live is
// untouched). Split-test it in the Prompt Lab against the current live
// group prompt on the gladiator photo + a spread of NON-happy scenes
// (battle, race, storm, dramatic) AND happy ones (party, beach) to confirm
// it fixes the fierce case WITHOUT regressing the joyful default or making
// faces look grim/angry. Activate only once it passes:
//   npx tsx server/prompts/seed-front-scene-group-v6.ts --activate

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

// ── Edit F — "always happy" → "positively immersed" (form flexes) ─────
const F_OLD = `Ensure that the characters always look happy to be a part of the new scene in a natural way to fit the new scene.`;

const F_NEW = `Every character always reads as POSITIVELY IMMERSED in the moment — loving being here, looking their best — and NEVER sad, blank, awkward, uncomfortable, or genuinely angry/menacing (this is a celebration card). But "positive" is NOT always a mild smile: match the FORM of that positivity to the scene's true energy. A party → open, delighted laughter. A battle, fight, race or contest → a fierce, triumphant, exhilarated grin or war-cry, the look of a hero LOVING the thick of it (empowered and alive, never grim, hostile or in pain). A grand view or awe-inspiring moment → wide-eyed joyful wonder. A tender, quiet scene → soft, contented warmth. A high-effort scene → focused, exhilarated intensity. Keep the joy at the core; change its SHAPE to fit the scene. A calm, closed-mouth camera-smile carried over from the photo onto a fierce or high-energy scene is the tell-tale pasted-cutout failure.`;

// ── Edit G — EXPRESSION IS REBORN: add the non-joyful ACTION branch ────
const G_OLD = `If the scene is a joyful celebration, faces show open, animated, delighted expressions — broad smiles, open laughs, eyes alight, brows lifted — NOT the uniform calm smile carried over from the photo.`;

const G_NEW = `If the scene is a joyful celebration, faces show open, animated, delighted expressions — broad smiles, open laughs, eyes alight, brows lifted — NOT the uniform calm smile carried over from the photo. If instead the scene is high-intensity ACTION or COMPETITION (a battle, a fight, a race, a sport, a dramatic showdown), the faces show EFFORT and FEROCITY — mouths open mid-shout or roar, teeth bared or gritted, brows drawn down and tense, eyes narrowed and blazing, jaws set — the exhilarated intensity of a hero in the thick of it, NEVER a calm pleasant smile. Read the scene's actual energy and pick the matching emotion: smiling is correct only for genuinely happy scenes, and a mild smile on a fierce scene is the clearest pasted-cutout failure.`;

interface Edit {
  label: string;
  oldStr: string;
  newStr: string;
}
const EDITS: Edit[] = [
  { label: 'F:happy-to-immersed', oldStr: F_OLD, newStr: F_NEW },
  { label: 'G:expression-action-branch', oldStr: G_OLD, newStr: G_NEW },
];

const ACTIVATE = process.argv.includes('--activate');

async function main(): Promise<void> {
  console.log(
    `[SEED] group → V6 ${ACTIVATE ? '(WILL ACTIVATE)' : '(preview only — live untouched)'}`,
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
  if (!activeId) throw new Error('group v6 seed: no active group template found');

  const srcRows = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, activeId))
    .limit(1);
  const src = srcRows[0];
  if (!src) throw new Error(`group v6 seed: active source id=${activeId} not found`);
  console.log(`  [SOURCE] active group id=${activeId} (${src.templateText.length} chars)`);

  let text = src.templateText;
  for (const edit of EDITS) {
    if (!text.includes(edit.oldStr)) {
      throw new Error(
        `group v6 seed: could not find ${edit.label} anchor in active id=${activeId} — template drifted? Update the OLD constant.`,
      );
    }
    text = text.replace(edit.oldStr, edit.newStr);
    console.log(`  [EDIT] applied ${edit.label}`);
  }

  const name = 'Front scene — group v6 (expression matches scene energy, not always a smile)';
  const notes =
    'V6 from the active group prompt (Kevin 2026-07-24, gladiator example — posed sofa smiles survived onto a battle). (F) "always look happy" → "positively immersed": keeps the no-sad/blank/menacing protection but decouples it from a mild smile — form flexes with scene energy. (G) EXPRESSION IS REBORN gains an ACTION/COMPETITION branch (effort + ferocity, mouths mid-shout, gritted teeth, blazing eyes) + the rule "smiling only for genuinely happy scenes". Preview-only; split-test on fierce AND happy scenes before activating.';

  const existing = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.slot, PROMPT_SLOTS.FRONT_SCENE),
        eq(promptTemplates.variant, PROMPT_VARIANTS.GROUP),
        eq(promptTemplates.version, 6),
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
    console.log(`  [REWRITE] group v6 (id=${templateId}, ${text.length} chars)`);
  } else {
    const [inserted] = await db
      .insert(promptTemplates)
      .values({
        slot: PROMPT_SLOTS.FRONT_SCENE,
        variant: PROMPT_VARIANTS.GROUP,
        cardType: null,
        name,
        version: 6,
        templateText: text,
        variables: src.variables,
        notes,
        createdBy: 'seed-front-scene-group-v6',
      })
      .returning();
    templateId = inserted.id;
    console.log(`  [INSERT] group v6 (id=${templateId}, ${text.length} chars)`);
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
      `\n[SEED] group V6 inserted as id=${templateId} but NOT active. Select group v6 in the Prompt Lab to split-test against the live group prompt.`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[SEED] group V6 failed:', err);
  process.exit(1);
});
