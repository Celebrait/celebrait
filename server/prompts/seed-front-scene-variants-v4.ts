// server/prompts/seed-front-scene-variants-v4.ts
//
// V4 of the front_scene per-variant templates. Single change vs v3:
// the GAZE & FRAMING block drops PHOTOGRAPH mode entirely. ACTION is
// now the ONLY mode.
//
// Why:
//   The product position (Kevin call 2026-05-15): "I'd actually lean
//   more towards action only — I think that is a USP of the product,
//   it's a surprise moment."
//
//   Celebrait's value isn't producing posed photos — that's what a
//   phone camera is for. The USP is the surprise of seeing the
//   recipient INSIDE a scene doing something memorable. Letting the
//   model fall back to "posed in front of a backdrop" undercuts that
//   USP every time it fires.
//
//   v3 still allowed PHOTOGRAPH mode behind explicit trigger words.
//   In testing (Eiffel Tower wedding scene, 2026-05-15), even with
//   the ACTION-default v3, the model produced a posed couple shot
//   when the scene description had portrait-staging language ("at the
//   Eiffel Tower", "iron lattice rising behind them"). The escape
//   hatch was getting taken too easily.
//
//   v4 closes the hatch entirely. Every scene renders as captured
//   action. Naturally-static scenes (at a landmark, by the fireplace,
//   on a balcony) get explicit guidance for the subtle action that
//   makes the moment alive — leaning into each other, mid-toast,
//   reaching for a glass.
//
// Same versioning safety: insert as v4 rows, leave v3 active by
// default, caller previews + flips with --activate when ready. v3
// stays available for instant rollback.
//
// Run:
//   npx tsx server/prompts/seed-front-scene-variants-v4.ts
//
// To activate v4 (after preview testing):
//   npx tsx server/prompts/seed-front-scene-variants-v4.ts --activate

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
  FRONT_SCENE_ONE_PERSON_V3,
  FRONT_SCENE_MULTI_INDIVIDUAL_V3,
  FRONT_SCENE_GROUP_V3,
} from './seed-front-scene-variants-v3';

// ─── v4 GAZE block — ACTION ONLY ─────────────────────────────────────

const GAZE_BLOCK_V4 = `GAZE & FRAMING — every scene is captured ACTION (this is the Celebrait product USP):

The product's core promise is putting people INTO scenes, not in front of them. Every card is a captured moment, not a portrait taken. There is no "posed at the camera" mode — that's what a phone camera is for. Celebrait's job is the surprise of seeing the recipient INSIDE the scene, doing something memorable. Stiff posed shots in front of a backdrop undercut the entire product.

Every scene renders as a captured ACTION moment. The character(s) are LIVING the scene:
  - Gaze engages with the activity, the scene, or another person in frame
  - Body angles into the moment — head turned, shoulders rotated, often mid-motion
  - The scene environment is around them, not behind them as backdrop

For obviously-active scenes (DJing, marathon, cooking, dancing, mid-toast) this is intuitive — the action verb in the scene description IS the gaze direction.

For scenes that SOUND static (at a landmark, at home, on a balcony, by the fireplace, "at" or "in front of" anything) — there is ALWAYS a subtle action that makes the moment alive. Pick one and render it:

  "At the Eiffel Tower" → walking along the bridge mid-step, looking at each other or up at the tower
  "On the cliffs of Dover" → mid-walk along the path, hand-in-hand, hair lifted by the wind, eyes on the sea
  "By the fireplace at home" → leaning into each other, one reaching for the wine, the other watching the flames
  "On a balcony at sunset" → mid-toast, glasses meeting in the air, gaze on the city
  "At the family Christmas tree" → mid-present-opening, mid-laugh, eyes wide on the gift
  "On their wedding day" → mid-first-dance, foreheads close, soft sway
  "At a fancy restaurant" → mid-laugh across the table, one tilting their head back, the other mid-gesture
  "In a beautiful garden" → mid-stroll, leaning to smell a flower, looking up at something one of them is pointing at
  "At a famous landmark" (any) → walking past it, looking up at it, leaning over a railing to see, NEVER posed in front of it

NEVER render a stiff side-by-side facing-camera portrait. NEVER render the people as static figures in front of a backdrop. NEVER render eye contact with the viewer as the primary gaze.

Camera engagement is allowed ONLY when the action naturally produces it — e.g., a quick smile up from cooking, a hero raising-a-trophy moment with arms wide and a roar, a kid grinning up from blowing out candles. These are mid-action gazes that incidentally include the camera, NOT poses for the camera.

NEVER: render eyes closed. Even in moments where it might feel natural (laughter, a music drop, deep peace), eyes-closed reads as awkward and lifeless in card output. Eyes are always open, always engaged with whatever the gaze direction is.

The reference photo's gaze direction is a portrait cue, NOT binding. The reference photo's pose composition is a portrait cue, NOT binding. Use the reference for IDENTITY only — break every pose, redirect every gaze, animate every body. The card simulates a candid moment from the day, not the portrait the recipient sat for.`;

// The v3 GAZE block we're replacing — anchor for the search/replace.
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

function swapGazeBlock(v3Template: string): string {
  if (!v3Template.includes(GAZE_BLOCK_V3)) {
    throw new Error(
      'v4 seed: could not find v3 GAZE block in template — has the scaffold drifted? Update GAZE_BLOCK_V3 constant to match.',
    );
  }
  return v3Template.replace(GAZE_BLOCK_V3, GAZE_BLOCK_V4);
}

export const FRONT_SCENE_ONE_PERSON_V4 = swapGazeBlock(FRONT_SCENE_ONE_PERSON_V3);
export const FRONT_SCENE_MULTI_INDIVIDUAL_V4 = swapGazeBlock(
  FRONT_SCENE_MULTI_INDIVIDUAL_V3,
);
export const FRONT_SCENE_GROUP_V4 = swapGazeBlock(FRONT_SCENE_GROUP_V3);

interface VariantSpec {
  variant: PromptVariant;
  templateText: string;
  name: string;
  notes: string;
}

const VARIANT_SPECS: VariantSpec[] = [
  {
    variant: PROMPT_VARIANTS.ONE_PERSON,
    templateText: FRONT_SCENE_ONE_PERSON_V4,
    name: 'Front scene — one person v4 (action-only, USP)',
    notes:
      'V4: PHOTOGRAPH mode dropped entirely. Every scene renders as captured action. Subtle-action examples for naturally-static scenes (at landmark, by fireplace, on balcony).',
  },
  {
    variant: PROMPT_VARIANTS.MULTI_INDIVIDUAL,
    templateText: FRONT_SCENE_MULTI_INDIVIDUAL_V4,
    name: 'Front scene — multi individual v4 (action-only, USP)',
    notes:
      'V4: PHOTOGRAPH mode dropped. Multi-individual preamble unchanged from v3.',
  },
  {
    variant: PROMPT_VARIANTS.GROUP,
    templateText: FRONT_SCENE_GROUP_V4,
    name: 'Front scene — group photo v4 (action-only, USP)',
    notes:
      'V4: PHOTOGRAPH mode dropped. Group preamble (BREAK THE PAIRING) unchanged from v3.',
  },
];

const ACTIVATE = process.argv.includes('--activate');

async function main(): Promise<void> {
  console.log(
    `[SEED] front_scene variants → V4 ${ACTIVATE ? '(WILL ACTIVATE)' : '(insert only — v3 stays active)'}`,
  );

  for (const spec of VARIANT_SPECS) {
    const slot = PROMPT_SLOTS.FRONT_SCENE;
    const version = 4;

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
          createdBy: 'seed-front-scene-variants-v4',
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
    console.log('[SEED] V4 active. Resolver cache flushed.');
  } else {
    console.log(
      '\n[SEED] V4 rows inserted but NOT active. Preview in Prompt Lab. To activate: re-run with --activate flag.',
    );
  }

  console.log(
    '\nROLLBACK to v3: re-run seed-front-scene-variants-v3.ts --activate (sets active pointers back to v3 ids 16/17/18).',
  );
  process.exit(0);
}

const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith('/seed-front-scene-variants-v4.ts');
if (isDirectRun) {
  main().catch((err) => {
    console.error('[SEED] Failed:', err);
    process.exit(1);
  });
}
