// server/prompts/seed-front-scene-variants-v3.ts
//
// V3 of the front_scene per-variant templates. Single change vs v2:
// the GAZE & FRAMING block flips its default. v2 had ACTION vs
// PHOTOGRAPH as a balanced "decide per scene" choice; v3 makes ACTION
// the strong default and PHOTOGRAPH a rare exception that only fires
// on explicit trigger words ("posing", "portrait", "photograph",
// "snapshot", etc.).
//
// Why:
//   The v2 PHOTOGRAPH mode was producing safe-but-flat outputs even
//   when the BETTER card output was clearly a candid moment. Tested
//   2026-05-15: Eiffel Tower at golden hour scene → got a stiff
//   posed couple shot. Kevin's call: "Really do we need poses direct
//   to camera? Action all the way?" — and yes, that's right. Even at
//   wedding-day-at-Eiffel-Tower scenes, the candid moment lands more
//   emotionally than the posed shot. PHOTOGRAPH was effectively
//   "permission for the model to take the lazy route" — preserving
//   the source's posed composition. By default that's the wrong
//   choice for a card; a candid moment captured beats a stock
//   wedding-photographer portrait every time.
//
// Same versioning safety as v2: insert as v3 rows, leave v2 active
// by default, caller previews + flips with --activate when ready.
// v2 stays available for instant rollback.
//
// Run:
//   npx tsx server/prompts/seed-front-scene-variants-v3.ts
//
// To activate v3 (after preview testing):
//   npx tsx server/prompts/seed-front-scene-variants-v3.ts --activate
//
// Rollback to v2: re-flip active pointers via the Prompt Lab UI, or
// re-run seed-front-scene-variants-v2.ts --activate.

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
import { invalidatePromptCache } from './resolver';
import { FRONT_SCENE_VARS } from './seed-v1';
import {
  FRONT_SCENE_ONE_PERSON_V2,
  FRONT_SCENE_MULTI_INDIVIDUAL_V2,
  FRONT_SCENE_GROUP_V2,
} from './seed-front-scene-variants-v2';

// ─── v3 scaffold ─────────────────────────────────────────────────────
//
// Identical to v2 EXCEPT the GAZE & FRAMING block. Identity≠expression
// rules, scene energy, anatomical-fit, eyes-not-closed, character-text-
// separation — all unchanged.
//
// New GAZE block:
//   • ACTION mode is the strong default
//   • PHOTOGRAPH mode requires explicit trigger words in the scene
//     description ("posing", "portrait", "photograph", "snapshot",
//     "for the photo", etc.)
//   • Even when PHOTOGRAPH mode fires, the rendering is "candid pose"
//     (mid-laugh, leaning in, eyes meeting) — never the stiff
//     side-by-side facing-camera shot
//   • Concrete examples reframe even photogenic scenes (Eiffel Tower,
//     wedding day, Christmas morning) as ACTION renderings

const GAZE_BLOCK_V3 = `GAZE & FRAMING (default to ACTION — PHOTOGRAPH is the rare exception):

The default for every scene is ACTION mode. Card recipients want emotional moments captured, not stiff posed portraits. Even scenes that look like they could be posed photo opportunities (couple at a landmark, wedding day, family Christmas) are MORE memorable when rendered as candid moments — laughter mid-walk, hand-in-hand on a bridge, glasses raised mid-toast, eyes meeting in a quiet moment.

ACTION MODE — apply by default, even when the setting is photogenic:
  Behaviour: gaze engages with the activity, the scene, or another person in frame. Body angles into the moment — head turned, shoulders rotated, often mid-motion. The character is LIVING the scene, not standing in front of it.
  Examples — scene description vs. ACTION rendering:
    "At the Eiffel Tower at sunset" → walking along the bridge with the tower behind, mid-step, looking at each other or up at the tower
    "On their wedding day at the venue" → mid-first-dance, foreheads close, soft sway
    "Christmas morning at home" → mid-laugh opening a present, eyes wide on the gift
    "DJing at a club" → head down on the deck, hand on the fader, eyes on the crowd
    "A family at the beach" → walking along the shoreline together, looking at something one of them is pointing at
  In ALL these examples, direct camera engagement breaks the moment.

PHOTOGRAPH MODE — apply ONLY when the scene description explicitly signals a posed moment:
  Trigger words/phrases the scene description must contain to qualify: "posing", "posed", "portrait", "photograph", "snapshot", "for the photo", "for a photo", "looking at the camera", "smiling for the photo".
  Behaviour even in PHOTOGRAPH mode: render as a CANDID POSE — leaning into each other, mid-laugh, eyes meeting, soft warmth. NEVER stiff side-by-side facing the camera with no emotion. The pose is the framing; the emotion is the content.
  Examples:
    "A couple posing for a photograph at the Eiffel Tower" → leaning into each other, his arm around her, both smiling toward camera but with warmth — not statue-stiff
    "A family portrait by the Christmas tree" → arranged together but mid-laugh, kids fidgeting, soft and warm — not lined up like a school photo
    "Posed engagement photo on the cliffs of Dover" → bride leaning into groom, both smiling at camera, the warmth of an emotional moment — not formal portrait stiff

When in doubt: ACTION. The model defaults to ACTION mode unless the scene description explicitly contains a PHOTOGRAPH trigger word from the list above.

NEVER: render eyes closed. Even in moments where it might feel natural (laughter, a music drop, deep peace), eyes-closed reads as awkward and lifeless in card output. Eyes are always open, always engaged with whatever the gaze direction is.

The reference photo's gaze direction is a portrait cue, not binding — redirect it to fit the chosen mode. A reference photo with the subject looking at the camera does NOT mean PHOTOGRAPH mode is right; pick mode from the SCENE DESCRIPTION based on the explicit trigger words above (or default to ACTION).`;

// The v2 GAZE block we're replacing — anchor for the search/replace
// against each variant's full template text.
const GAZE_BLOCK_V2 = `GAZE & FRAMING (decide per scene — this is one of the most important calls you make):

First, read the SCENE DESCRIPTION below and decide which mode applies:

  ACTION MODE — the scene depicts the character(s) doing something specific:
    Examples: DJing at a club, plating food in a kitchen, running a marathon, painting at an easel, conducting an orchestra, mid-toast at a celebration, blowing out birthday candles, cutting a wedding cake, mid-dance at a wedding, on stage performing, lifting a trophy.
    Behaviour: gaze engages with the activity, the scene, or another person in frame (looking at the deck, the food, the canvas, the crowd, a friend, the sunset, the trophy). Body angles into the action — head turned, shoulders rotated. Direct camera engagement breaks the fourth wall and ruins the candid feel.

  PHOTOGRAPH MODE — the scene depicts a posed moment in a special place:
    Examples: a couple at a famous landmark, a family portrait in a celebratory setting, a group with cocktails at a sunset bar, two people on a romantic balcony, a portrait at a graduation, a couple on the beach at sunset.
    Behaviour: the people pose for the camera as they would for a real holiday photo. Direct eye contact with the viewer is correct, classic posed framing is welcome, the scene is the backdrop. The card simulates a beautiful photograph the recipient would treasure.

When the scene description is ambiguous, lean toward what a thoughtful photographer would naturally capture. A "couple on a hot air balloon at sunrise" is a PHOTOGRAPH (they pose); a "DJ at the decks at Madison Square Garden" is ACTION (they don't pose mid-set).

NEVER: render eyes closed. Even in moments where it might feel natural (laughter, a music drop, deep peace), eyes-closed reads as awkward and lifeless in card output. Eyes are always open, always engaged with whatever the gaze direction is.

The reference photo's gaze direction is a portrait cue, not binding — redirect it to fit the chosen mode. A reference photo with the subject looking at the camera does NOT mean ACTION mode is wrong; pick mode from the SCENE DESCRIPTION, not from the reference.`;

function swapGazeBlock(v2Template: string): string {
  if (!v2Template.includes(GAZE_BLOCK_V2)) {
    throw new Error(
      'v3 seed: could not find v2 GAZE block in template — has the scaffold drifted? Update GAZE_BLOCK_V2 to match the current text.',
    );
  }
  return v2Template.replace(GAZE_BLOCK_V2, GAZE_BLOCK_V3);
}

// Composed v3 templates — v2 with the GAZE block swapped.
export const FRONT_SCENE_ONE_PERSON_V3 = swapGazeBlock(FRONT_SCENE_ONE_PERSON_V2);
export const FRONT_SCENE_MULTI_INDIVIDUAL_V3 = swapGazeBlock(
  FRONT_SCENE_MULTI_INDIVIDUAL_V2,
);
export const FRONT_SCENE_GROUP_V3 = swapGazeBlock(FRONT_SCENE_GROUP_V2);

interface VariantSpec {
  variant: PromptVariant;
  templateText: string;
  name: string;
  notes: string;
}

const VARIANT_SPECS: VariantSpec[] = [
  {
    variant: PROMPT_VARIANTS.ONE_PERSON,
    templateText: FRONT_SCENE_ONE_PERSON_V3,
    name: 'Front scene — one person v3 (action-by-default gaze)',
    notes:
      'V3: GAZE block flipped — ACTION is the strong default; PHOTOGRAPH only fires on explicit trigger words. Even in PHOTOGRAPH mode, render as candid pose, never stiff portrait.',
  },
  {
    variant: PROMPT_VARIANTS.MULTI_INDIVIDUAL,
    templateText: FRONT_SCENE_MULTI_INDIVIDUAL_V3,
    name: 'Front scene — multi individual v3 (action-by-default gaze)',
    notes:
      'V3: GAZE block flipped — ACTION default; PHOTOGRAPH explicit-trigger only. Multi-individual preamble unchanged from v2.',
  },
  {
    variant: PROMPT_VARIANTS.GROUP,
    templateText: FRONT_SCENE_GROUP_V3,
    name: 'Front scene — group photo v3 (action-by-default gaze)',
    notes:
      'V3: GAZE block flipped — ACTION default; PHOTOGRAPH explicit-trigger only. Group preamble (BREAK THE PAIRING) unchanged from v2.',
  },
];

const ACTIVATE = process.argv.includes('--activate');

async function main(): Promise<void> {
  console.log(
    `[SEED] front_scene variants → V3 ${ACTIVATE ? '(WILL ACTIVATE)' : '(insert only — v2 stays active)'}`,
  );

  for (const spec of VARIANT_SPECS) {
    const slot = PROMPT_SLOTS.FRONT_SCENE;
    const version = 3;

    // Idempotent: rewrite if v3 already exists, insert otherwise.
    const existing = await db
      .select()
      .from(promptTemplates)
      .where(
        and(
          eq(promptTemplates.slot, slot),
          eq(promptTemplates.variant, spec.variant),
          eq(promptTemplates.version, version),
        ),
      )
      .limit(1);

    let templateId: number;
    if (existing.length > 0) {
      const row = existing[0];
      await db
        .update(promptTemplates)
        .set({
          templateText: spec.templateText,
          name: spec.name,
          notes: spec.notes,
        })
        .where(eq(promptTemplates.id, row.id));
      templateId = row.id;
      console.log(
        `  [REWRITE] ${slot}/${spec.variant} v${version} (id=${templateId}, ${spec.templateText.length} chars)`,
      );
    } else {
      const [inserted] = await db
        .insert(promptTemplates)
        .values({
          slot,
          variant: spec.variant,
          cardType: null,
          name: spec.name,
          version,
          templateText: spec.templateText,
          variables: FRONT_SCENE_VARS,
          notes: spec.notes,
          createdBy: 'seed-front-scene-variants-v3',
        })
        .returning();
      templateId = inserted.id;
      console.log(
        `  [INSERT] ${slot}/${spec.variant} v${version} (id=${templateId}, ${spec.templateText.length} chars)`,
      );
    }

    if (ACTIVATE) {
      await db
        .update(promptActive)
        .set({ activeTemplateId: templateId })
        .where(
          and(
            eq(promptActive.slot, slot),
            eq(promptActive.variant, spec.variant),
          ),
        );
      console.log(`    [ACTIVATE] ${slot}/${spec.variant} → id=${templateId}`);
    }
  }

  if (ACTIVATE) {
    invalidatePromptCache();
    console.log('[SEED] V3 active. Resolver cache flushed.');
  } else {
    console.log(
      '\n[SEED] V3 rows inserted but NOT active. Preview in Prompt Lab. To activate: re-run with --activate flag.',
    );
  }

  console.log(
    '\nROLLBACK to v2: re-run seed-front-scene-variants-v2.ts --activate (sets active pointers back to v2 ids 13/14/15).',
  );
  process.exit(0);
}

// Same import-side-effect guard as the v2 sibling — when v4 (or any
// future iteration) imports the FRONT_SCENE_*_V3 constants for the
// scaffold swap, we don't want this file's main() to fire and race
// against the importer's seed run.
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith('/seed-front-scene-variants-v3.ts');
if (isDirectRun) {
  main().catch((err) => {
    console.error('[SEED] Failed:', err);
    process.exit(1);
  });
}
