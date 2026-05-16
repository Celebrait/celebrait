// server/prompts/seed-one-person-v3.ts
//
// V3 of the ONE_PERSON variant ONLY. Built 2026-05-15 after Kevin
// confirmed (via private-scene tests on the unchanged v2) that the
// SCENE ENERGY + source-pose-preservation bugs we already fixed for
// group also bite single-person:
//   • Test "Blowing out birthday candles at home" → random people
//     clapping in background (SCENE ENERGY bug)
//   • Tests across all three scenes → same head tilt + closed-mouth
//     slight-smile preserved from source (i2i source-pose bug)
//
// This script touches ONE_PERSON ONLY — group + multi_individual
// pointers stay where they are. Avoids the side-effect footgun where
// the v4 group seed flipped one_person back to v4 every time.
//
// Same versioning safety: insert v3 row, leave v2 active by default,
// caller previews + flips with --activate when ready. v2 (id=13)
// stays available for instant rollback.
//
// Run:
//   npx tsx server/prompts/seed-one-person-v3.ts
//
// To activate v3 for one_person ONLY (after preview testing):
//   npx tsx server/prompts/seed-one-person-v3.ts --activate
//
// Rollback to v2: npx tsx server/prompts/revert-one-person-to-v2.ts

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
import { FRONT_SCENE_VARS } from './seed-v1';
import { FRONT_SCENE_ONE_PERSON_V4 } from './seed-front-scene-variants-v4';

// ─── new ONE_PERSON_PREAMBLE_V3 ──────────────────────────────────────
//
// Three additions vs the v1/v2 preamble (which is preserved as-is in
// the v2 row Kevin's frozen at):
//
//   1. DISCARD SOURCE POSE block — single-person equivalent of group's
//      BREAK THE PAIRING. Tells the model the source's head tilt, body
//      framing, and camera-facing eye contact are PORTRAIT cues to
//      discard. Includes a failure-state callout so the model can
//      self-detect.
//
//   2. SCENE ENERGY rewritten as PUBLIC vs PRIVATE — same scene-aware
//      block we ported into group v4. Adapted wording for "the person"
//      (singular) instead of "the people". Includes the lean-PRIVATE-
//      when-ambiguous fallback.
//
//   3. The hasMultiplePhotos block from v2 is kept verbatim — it does
//      useful identity-signal work and isn't part of either bug.
//
// Action-only USP (the v4 GAZE block) comes from the SCAFFOLD which we
// inherit by importing FRONT_SCENE_ONE_PERSON_V4 and stripping its old
// preamble below. So this v3 ALSO gets the v4 scaffold treatment —
// action-only, no PHOTOGRAPH escape hatch.

const ONE_PERSON_PREAMBLE_V3 = `{{#if hasMultiplePhotos}}REFERENCE PHOTO CONTEXT: You have been given {{photoCount}} photos of THE SAME PERSON from different angles. These are NOT different people — they are all the same individual. Use ALL photos together to build a comprehensive understanding of this person's facial structure, features, and proportions. The multiple angles give you more identity signal — use it to produce a more accurate likeness than any single photo could achieve.

{{/if}}CRITICAL — DISCARD THE SOURCE'S POSE COMPOSITION:
The reference photo is almost always a portrait — head tilted at the angle for the camera, body framed close-up, eye contact with the lens. THESE COMPOSITION CUES ARE WRONG for almost every scene. Treat the reference as ONE FACE REFERENCE that happens to come with portrait framing — NOT as a pose template to copy.

The scene defines the body position, head angle, and gaze — not the source. Specifically:
  - The source's HEAD ANGLE / TILT is a portrait cue, NOT binding. The new scene's action determines the head angle.
  - The source's BODY FRAMING (close-up face, half-body crop, full-body) is a portrait cue, NOT binding. The new scene's composition determines the framing.
  - The source's EYE CONTACT WITH CAMERA is a portrait cue, NOT binding. The new scene's action determines where the eyes look.
  - If you find yourself rendering the source's exact head tilt with the source's exact framing in the new scene, you have failed this rule.

SCENE ENERGY — the RELATIONSHIP TEST for background figures:

Before adding any background person to the scene, apply this test: WOULD THIS ADDED FIGURE APPEAR TO KNOW THE RECIPIENT? If yes, do not add them unless they are in the reference photo. If no (they read as anonymous strangers sharing the same venue), add them freely.

ADD background people freely when they read as STRANGERS — anonymous others sharing the same venue:
  - Other patrons at a bar, restaurant, café, club, lounge
  - Other beachgoers, park-goers, concert attendees, festival-goers
  - Passers-by on a street, fellow commuters at a station, other shoppers in a market
  - Other runners + spectators at a race, other guests at a hotel, other diners across the room
  - Crowd at a sports event, audience at a theatre, other gym-goers
  These figures fill out the world. They are clearly part of the venue, not part of the recipient's life. Without them, public scenes feel post-apocalyptic.

DO NOT ADD background people who would read as the recipient's SOCIAL CIRCLE — friends, family, partner, kids, siblings, teammates, colleagues, wedding party — unless they are actually present in the reference photo:
  - At a birthday at home: NO "family clapping", NO "friends watching", NO "kids at the table"
  - At an intimate dinner: NO "their date across the table", NO "another couple at the next table acting familiar"
  - At Christmas morning: NO "siblings", NO "kids", NO "partner unwrapping next to them"
  - At a wedding: NO "bridesmaids/groomsmen near the recipient", NO "the wedding party hovering"
  - At a fireplace at home: NO "partner on the sofa next to them", NO "family member opposite"
  In these cases, render ONLY the person from the reference photo. The scene comes alive through atmosphere (candles, presents, fairy lights, decor, weather, light, props) — never through fabricated relationships.

The test is RELATIONSHIP, not VENUE TYPE. A bar can be richly populated with anonymous patrons. A kitchen can have warm clutter (mug, presents, fairy lights, plants, decor) but never invented "family". A wedding venue can have guests in the distance, but not a fabricated bridal party near the recipient. A rooftop is empty if it sounds private (your own rooftop) and populated if it sounds public (rooftop bar, rooftop lounge).

When in doubt: add ATMOSPHERIC DETAILS (weather, light, props, decor, distant venue activity) instead of people. Atmosphere always lands; fabricated relationships always feel wrong.

`;

// ─── derive v4 scaffold from existing FRONT_SCENE_ONE_PERSON_V4 ──────
// FRONT_SCENE_ONE_PERSON_V4 = OLD_ONE_PERSON_PREAMBLE + V4_SCAFFOLD.
// We strip the OLD preamble by splitting at the scaffold's first
// stable line ("MANDATORY: Create a perfectly SQUARE 1024x1024..."),
// which is unchanged across v1→v4 of the scaffold.

const SCAFFOLD_MARKER = 'MANDATORY: Create a perfectly SQUARE';

function deriveV4Scaffold(): string {
  const idx = FRONT_SCENE_ONE_PERSON_V4.indexOf(SCAFFOLD_MARKER);
  if (idx < 0) {
    throw new Error(
      `Could not find scaffold marker "${SCAFFOLD_MARKER}" in FRONT_SCENE_ONE_PERSON_V4. Has the scaffold drifted?`,
    );
  }
  return FRONT_SCENE_ONE_PERSON_V4.substring(idx);
}

const V4_SCAFFOLD = deriveV4Scaffold();
const FRONT_SCENE_ONE_PERSON_V3 = ONE_PERSON_PREAMBLE_V3 + V4_SCAFFOLD;

const ACTIVATE = process.argv.includes('--activate');

async function main(): Promise<void> {
  console.log(
    `[SEED] front_scene/one_person → V3 ${ACTIVATE ? '(WILL ACTIVATE)' : '(insert only — v2 stays active)'}`,
  );

  const slot = PROMPT_SLOTS.FRONT_SCENE;
  const variant = PROMPT_VARIANTS.ONE_PERSON;
  const version = 3;

  // Idempotent: rewrite if v3 already exists, insert otherwise.
  const existing = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.slot, slot),
        eq(promptTemplates.variant, variant),
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
        templateText: FRONT_SCENE_ONE_PERSON_V3,
        name: 'Front scene — one person v3 (scene-aware energy + discard-source-pose + action-only)',
        notes:
          'V3: scene-aware SCENE ENERGY (PUBLIC vs PRIVATE — fixes random extras in private scenes); DISCARD SOURCE POSE block (head tilt, body framing, camera-eye contact are portrait cues to ignore); inherits v4 scaffold (action-only USP). Built only for one_person; group/multi_individual untouched.',
      })
      .where(eq(promptTemplates.id, row.id));
    templateId = row.id;
    console.log(
      `  [REWRITE] one_person v${version} (id=${templateId}, ${FRONT_SCENE_ONE_PERSON_V3.length} chars)`,
    );
  } else {
    const [inserted] = await db
      .insert(promptTemplates)
      .values({
        slot,
        variant,
        cardType: null,
        name: 'Front scene — one person v3 (scene-aware energy + discard-source-pose + action-only)',
        version,
        templateText: FRONT_SCENE_ONE_PERSON_V3,
        variables: FRONT_SCENE_VARS,
        notes:
          'V3: scene-aware SCENE ENERGY (PUBLIC vs PRIVATE — fixes random extras in private scenes); DISCARD SOURCE POSE block (head tilt, body framing, camera-eye contact are portrait cues to ignore); inherits v4 scaffold (action-only USP). Built only for one_person; group/multi_individual untouched.',
        createdBy: 'seed-one-person-v3',
      })
      .returning();
    templateId = inserted.id;
    console.log(
      `  [INSERT] one_person v${version} (id=${templateId}, ${FRONT_SCENE_ONE_PERSON_V3.length} chars)`,
    );
  }

  if (ACTIVATE) {
    await db
      .update(promptActive)
      .set({ activeTemplateId: templateId })
      .where(
        and(
          eq(promptActive.slot, slot),
          eq(promptActive.variant, variant),
        ),
      );
    invalidatePromptCache();
    console.log(`  [ACTIVATE] one_person → id=${templateId}`);
    console.log('[SEED] Done. Resolver cache flushed.');
  } else {
    console.log(
      '\n[SEED] V3 row inserted but NOT active. Preview in Prompt Lab. To activate: re-run with --activate flag.',
    );
  }

  console.log(
    '\nROLLBACK to v2: npx tsx server/prompts/revert-one-person-to-v2.ts',
  );
  process.exit(0);
}

const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith('/seed-one-person-v3.ts');
if (isDirectRun) {
  main().catch((err) => {
    console.error('[SEED] Failed:', err);
    process.exit(1);
  });
}
