// server/prompts/seed-front-scene-group-v5.ts
//
// group v5 — built from the live group v4 (id 21) per the senior audit in
// next_group_prompt_iteration.md (2026-05-31). Five surgical edits, each
// tied to a hand-tested failure from the 16-scene group matrix. All serve
// the one-illusion / four-guards model; ports the proven one_person v5
// wins (concrete always-on expression) + adds the group-specific headline:
// SIZE-AWARE engagement.
//
//   A. EXPRESSION REBORN — replace the abstract high-position expression
//      line with the concrete, always-on, group-pluralised block (+ "not
//      identical across people" — a uniform smile is the posed-row tell).
//   B. SIZE-AWARE engagement — scope the "animate each independently" to
//      small groups; add a block that branches 2-4 (independent action) vs
//      5+ (warm gathered relational moment). THE headline fix: the old
//      unconditional independent-action line manufactures the uncanny
//      8-person cluster.
//   C. CELEBRATION TRAP — replace the GAZE line that wrongly calls
//      "mid-toast" already-solved with a dedicated anti-facing-camera beat
//      naming toast/festival/dinner.
//   D. ACCESSORY adaptation — caps/sunglasses are styling, not identity;
//      adapt to scene+outfit (no snapback with a suit).
//   E. GROUND-TEXT separation hardening — reserve a clear band for ALL
//      feet; move text off the ground if it can't fit (sand-on-legs fix).
//
// Seeds as group version=5, PREVIEW-ONLY (live stays on v4/id=21).
// Validate against the retest matrix in the audit before activating:
//   npx tsx server/prompts/seed-front-scene-group-v5.ts --activate

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

const SOURCE_ID = 21; // live group v4

// ── Edit A — concrete always-on EXPRESSION REBORN (group-pluralised) ──
const A_OLD = `CRITICAL — IDENTITY ≠ EXPRESSION: The photo provides the IDENTITY of each face (bone structure, eye/nose/mouth shapes, skin tone, hair). It does NOT prescribe their EXPRESSIONS. Every face in the new scene must wear a brand NEW expression that fits the mood and energy of the scene — not the expression they happened to be making in the reference photo. Identity stays; expressions are reborn for the scene.`;

const A_NEW = `EXPRESSION IS REBORN — THE #1 PRIORITY (this has been the single biggest failure):
The reference photo gives you the IDENTITY of each face — bone structure, feature shapes, skin, hair, distinctive marks. It does NOT give you their EXPRESSIONS. Every face on the card wears an expression generated FRESH for THIS scene's mood, and EACH MUST visibly differ from the photo. The reference is almost certainly a posed group shot where everyone holds the same mild, closed-mouth, camera-ready smile — that shared posed expression is the clearest fingerprint of a pasted-in cutout and MUST be discarded. If the scene is a joyful celebration, faces show open, animated, delighted expressions — broad smiles, open laughs, eyes alight, brows lifted — NOT the uniform calm smile carried over from the photo. Critically, the new expressions are NOT identical across people: one mid-laugh with head tipped back, another grinning at the person beside them, another caught mid-word — never a row of matching smiles. Every single time: keep each IDENTITY, REBUILD every EXPRESSION to fit the scene, and break the uniformity.`;

// ── Edit B1 — scope the independent-action lead-in to small groups ────
const B1_OLD = `For EVERY scene (Celebrait is action-only — see GAZE & FRAMING block in the scaffold):`;
const B1_NEW = `For EVERY scene, break the posed pairing (Celebrait is action-only — see GAZE & FRAMING block in the scaffold). The independent-action guidance immediately below is calibrated for SMALL groups (2-4 people); for 5 or more, follow the SCALE THE ENGAGEMENT block that comes after this one instead:`;

// ── Edit B2 — insert the SIZE-AWARE engagement block (the headline) ───
const B2_OLD = `There is no PHOTOGRAPH carve-out — Celebrait does not produce posed-portrait outputs.

SCENE ENERGY (decide per scene — PUBLIC vs PRIVATE):`;
const B2_NEW = `There is no PHOTOGRAPH carve-out — Celebrait does not produce posed-portrait outputs.

SCALE THE ENGAGEMENT TO THE HEADCOUNT (read the number of faces in the photo):
The right kind of "togetherness" depends on how many people are in the scene. Read the headcount from the reference and choose:

2-4 people — INDEPENDENT ACTION (break the pairing). Each person is absorbed in their own thread of the moment from their own angle and depth: one closer, one further; one in profile mid-laugh, one three-quarter reaching for something; distinct activities, distinct expressions, distinct gazes. They share the scene without mirroring each other. This is the small-group win — keep it.

5 or more people — A WARM GATHERED MOMENT (relational, never a lineup). Do NOT scatter a large group into many separate independent activities — that reads chaotic and the model loses coherence and half-reverts to a posed group photo (the uncanny "kind-of-posing" cluster). Instead, gather them around ONE shared focus — the cake, the toast, the gift being opened, the view, the table, the game — and render them ENGAGED WITH EACH OTHER and with that focus: clustered at natural depths, some leaning in, some turned to the person beside them mid-laugh, some looking at the shared focus, a hand on a shoulder, heads tipped together. The unifying force is the SHARED MOMENT, not a shared camera. It is a candid caught in the middle of a real gathering — warmth and connection between the people — NEVER a stiff row of bodies squared to the lens with matching smiles. Even when the scene is "a big celebration", the camera is an unnoticed observer of a gathering already in full swing.

For ANY size: the failure to avoid is a row (or cluster) of people facing the lens, shoulders squared, holding the same smile. Whether 2 or 12, no one is presenting themselves to a photographer.

SCENE ENERGY (decide per scene — PUBLIC vs PRIVATE):`;

// ── Edit C — CELEBRATION TRAP beat (replace the false-comfort line) ───
const C_OLD = `For obviously-active scenes (DJing, marathon, cooking, dancing, mid-toast) this is intuitive — the action verb in the scene description IS the gaze direction.`;
const C_NEW = `For physically-active scenes (DJing, marathon, cooking, dancing) the action verb IS the gaze direction — render it directly.

CELEBRATION SCENES ARE A TRAP — TOAST, CHEERS, DINNER, PARTY, FESTIVAL, "CELEBRATING". These words trigger the model's strongest posed-group prior: everyone turns to the camera, raises a glass, and smiles for the photo. THAT IS THE EXACT FAILURE TO AVOID. A real toast is people clinking glasses with each other, eyes meeting across the table, mid-laugh at something just said — the glasses meet in the air between them, not raised toward the viewer. A festival is bodies immersed in the crowd and the music, arms up because the drop hit, faces turned to the stage or to each other — NOT a hands-up lineup grinning at the lens. Anchor every person to a focus WITHIN the celebration (another person, the cake, the stage, the clinking glasses), never to the camera. If you find yourself rendering the group squared-up and smiling outward, you have produced a posed photo and failed.`;

// ── Edit D — ACCESSORY adaptation (always-on, after clothing block) ───
const D_OLD = `Change the clothing completely from the reference photo to match the scenario while maintaining identical faces only.{{/if}}

{{#if userArtStyle}}`;
const D_NEW = `Change the clothing completely from the reference photo to match the scenario while maintaining identical faces only.{{/if}}

ACCESSORIES ADAPT TO THE SCENE AND OUTFIT. Hats, caps, sunglasses, and other accessories visible in the reference photo are NOT fixed identity — they are styling, and they must suit the new scene and clothing. Keep an accessory only if it fits; otherwise re-style or drop it. A casual snapback that survives onto a person now in a suit at a formal dinner is wrong — swap it for headwear that matches the formality (or none), exactly as you would adapt the clothing. Identity lives in the face, never in the hat.

{{#if userArtStyle}}`;

// ── Edit E — GROUND-TEXT separation hardening ─────────────────────────
const E_OLD = `If text is on the ground, the character's feet press into undisturbed ground with the text placed at a clear distance from them.`;
const E_NEW = `If text is on the ground (sand, snow, grass), it occupies its OWN clear zone of the frame — a band of ground that NO ONE is standing on. Every person's feet and legs press into plain, undisturbed ground; ground lettering NEVER runs under, across, or behind anyone's legs or feet. With multiple people, reserve a continuous clear strip for ALL of their feet and place the ground text in a separate region (foreground apron, mid-distance, or to one side) with a clear gap between the nearest letter and the nearest foot. If the people and a legible ground-text band cannot both fit cleanly, move the text OFF the ground onto a sign, banner, wall, or sky element rather than letting it bleed onto legs.`;

interface Edit {
  label: string;
  oldStr: string;
  newStr: string;
}
const EDITS: Edit[] = [
  { label: 'A:expression-reborn', oldStr: A_OLD, newStr: A_NEW },
  { label: 'B1:scope-independent-to-small', oldStr: B1_OLD, newStr: B1_NEW },
  { label: 'B2:size-aware-block', oldStr: B2_OLD, newStr: B2_NEW },
  { label: 'C:celebration-trap', oldStr: C_OLD, newStr: C_NEW },
  { label: 'D:accessory-adapt', oldStr: D_OLD, newStr: D_NEW },
  { label: 'E:ground-text-harden', oldStr: E_OLD, newStr: E_NEW },
];

const ACTIVATE = process.argv.includes('--activate');

async function main(): Promise<void> {
  console.log(
    `[SEED] group → V5 ${ACTIVATE ? '(WILL ACTIVATE)' : '(preview only — live stays on v4/id=21)'}`,
  );

  const srcRows = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, SOURCE_ID))
    .limit(1);
  const src = srcRows[0];
  if (!src) throw new Error(`group v5 seed: source id=${SOURCE_ID} not found`);

  let text = src.templateText;
  for (const edit of EDITS) {
    if (!text.includes(edit.oldStr)) {
      throw new Error(
        `group v5 seed: could not find ${edit.label} anchor in id=${SOURCE_ID} — template drifted? Update the OLD constant.`,
      );
    }
    text = text.replace(edit.oldStr, edit.newStr);
    console.log(`  [EDIT] applied ${edit.label}`);
  }

  const name = 'Front scene — group v5 (size-aware engagement + expression reborn)';
  const notes =
    'V5 from live group v4 (id 21) per next_group_prompt_iteration.md audit: (A) concrete always-on EXPRESSION REBORN + break-the-uniformity; (B) SIZE-AWARE engagement — 2-4 independent action, 5+ warm gathered relational (the headline fix; old "each their own activity" manufactured the 8-person cluster); (C) celebration-trap anti-facing-camera beat (toast/festival); (D) accessory adaptation; (E) ground-text separation hardening. Keeps BREAK THE PAIRING + PUBLIC/PRIVATE split. Preview-only until retest matrix passes.';

  const existing = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.slot, PROMPT_SLOTS.FRONT_SCENE),
        eq(promptTemplates.variant, PROMPT_VARIANTS.GROUP),
        eq(promptTemplates.version, 5),
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
    console.log(`  [REWRITE] group v5 (id=${templateId}, ${text.length} chars)`);
  } else {
    const [inserted] = await db
      .insert(promptTemplates)
      .values({
        slot: PROMPT_SLOTS.FRONT_SCENE,
        variant: PROMPT_VARIANTS.GROUP,
        cardType: null,
        name,
        version: 5,
        templateText: text,
        variables: src.variables,
        notes,
        createdBy: 'seed-front-scene-group-v5',
      })
      .returning();
    templateId = inserted.id;
    console.log(`  [INSERT] group v5 (id=${templateId}, ${text.length} chars)`);
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
      `\n[SEED] group V5 inserted as id=${templateId} but NOT active. Select group v5 in the Prompt Lab to run the retest matrix.`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[SEED] group V5 failed:', err);
  process.exit(1);
});
