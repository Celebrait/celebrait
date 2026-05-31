// server/prompts/seed-front-scene-one-person-v5.ts
//
// V5 of the one_person front_scene template. Built from the LIVE id=16
// template (the most-developed one_person in the DB — it already has the
// discard-source-pose block + action-only gaze, despite being labelled
// "v3"). We do NOT rebuild from the seed-file constants because the DB
// has drifted past them.
//
// The north star (founder, 2026-05-27): every rule defends ONE illusion —
// "this person is genuinely THERE, living a real moment that never
// happened" — the emotional opposite of "a head pasted on a backdrop".
// Four guards of that one illusion: action (not pose), born-in-scene
// expression, a populated world, and HONEST population (strangers at
// public venues yes, fabricated intimates never).
//
// Three surgical edits vs id=16, each fixing a hand-tested failure:
//
//   A. SCENE ENERGY — the relationship-test logic was right but
//      over-corrected: "when in doubt, atmosphere not people" produced an
//      EMPTY beach (a beach is public and should be populated). Flip the
//      default: public venues MUST be populated with strangers; only
//      genuinely private scenes go atmosphere-only. AND name the red flag
//      explicitly — a private intimate moment ringed by strangers (e.g.
//      blowing out birthday candles at home surrounded by non-family) is
//      WORSE than empty: it betrays the meaning of the moment.
//
//   B. GAZE — add two clauses: (1) vague-verb → invent-action (scenes like
//      "looking joyful"/"living it up" name a FEELING not an action, so
//      the model defaults to a standing portrait/selfie — force it to turn
//      the feeling into a verb); (2) explicit anti-selfie.
//
//   C. EXPRESSION — light always-on reinforcement that the new expression
//      must be visibly born in the scene, not the mild reference carried
//      over (a face unchanged from source reads as pasted-in).
//
// Seeds as version=5, PREVIEW-ONLY (live stays on id=16). Activate later:
//   npx tsx server/prompts/seed-front-scene-one-person-v5.ts --activate
//
// Run (preview-only):
//   npx tsx server/prompts/seed-front-scene-one-person-v5.ts

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

const SOURCE_ID = 16; // live one_person (most-developed base)

// ── Edit A — SCENE ENERGY default flip + red-flag naming ──────────────
const A_OLD = `When in doubt: add ATMOSPHERIC DETAILS (weather, light, props, decor, distant venue activity) instead of people. Atmosphere always lands; fabricated relationships always feel wrong.`;

const A_NEW = `PUBLIC vs PRIVATE is the call that matters most here:
  - If the venue is PUBLIC (a beach, park, street, bar, restaurant, café, festival, market, station, gym, club) it MUST be populated with anonymous strangers. An empty public scene reads as a cutout pasted on a backdrop and breaks the whole illusion that the person is really there. Populating public scenes is MANDATORY, not optional.
  - If the scene is genuinely PRIVATE (their own home, their own rooftop, an intimate dinner, a quiet bedroom) render the person SOLO and bring it alive with ATMOSPHERE only (candles, presents, fairy lights, decor, weather, light, props) — never invented people.

THE RED FLAG TO NEVER PRODUCE: a private, intimate moment ringed by strangers — e.g. someone blowing out birthday candles AT HOME surrounded by people who are clearly not their family. This is WORSE than an empty scene, because it betrays the very meaning of the moment: those faces should be loved ones, but the model cannot know who the loved ones are, so it invents the wrong ones — and the viewer feels it instantly. When a scene is intimate, the only honest answer is the person SOLO plus atmosphere. Atmosphere always lands; fabricated relationships always feel wrong and dismissible.`;

// ── Edit B — GAZE: invent-action for vibe-only scenes + anti-selfie ───
const B_OLD = `  "At a famous landmark" (any) → walking past it, looking up at it, leaning over a railing to see, NEVER posed in front of it

NEVER render a stiff side-by-side facing-camera portrait.`;

const B_NEW = `  "At a famous landmark" (any) → walking past it, looking up at it, leaning over a railing to see, NEVER posed in front of it

For scenes that give only a MOOD or VIBE with no action verb at all ("looking joyful", "living it up", "having the time of their life", "celebrating", "relaxing", "having fun") — those words name a FEELING, not a thing to do, and the model's lazy default for a feeling is a standing portrait or a selfie. Do NOT do that. Turn the feeling into a concrete VERB that fits the setting, and express the feeling THROUGH that action: "living it up on a yacht" → mid-laugh raising a glass with friends, leaning on the rail watching the coast, dancing on the deck; "joyful on a beach" → mid-stride through the shallows with arms wide, kicking up water, spinning to watch the sunset. Never let a feeling collapse into a pose.

NEVER render a selfie — the character never holds the camera, never extends an arm toward the lens, never frames their own face in close-up. The camera is an invisible observer of the moment, never something the character is holding or posing for. NEVER render a stiff side-by-side facing-camera portrait.`;

// ── Edit C — EXPRESSION: light always-on reinforcement ────────────────
const C_OLD = `- SCENE-APPROPRIATE EXPRESSION: The character(s) display a brand NEW facial expression that captures the energy and mood of this specific scene`;

const C_NEW = `- SCENE-APPROPRIATE EXPRESSION: The character(s) display a brand NEW facial expression that captures the energy and mood of this specific scene — visibly born in THIS moment, never the mild default expression carried over from the reference photo. If the reference is a calm selfie and the scene is joyful action, the face MUST change to match (open laugh, wind-blown delight, eyes alight) — a face that looks unchanged from the source reads as pasted-in and kills the illusion that they are really here`;

interface Edit {
  label: string;
  oldStr: string;
  newStr: string;
}
const EDITS: Edit[] = [
  { label: 'A:scene-energy', oldStr: A_OLD, newStr: A_NEW },
  { label: 'B:gaze-invent-action+anti-selfie', oldStr: B_OLD, newStr: B_NEW },
  { label: 'C:expression-reinforce', oldStr: C_OLD, newStr: C_NEW },
];

const ACTIVATE = process.argv.includes('--activate');

async function main(): Promise<void> {
  console.log(
    `[SEED] one_person → V5 ${ACTIVATE ? '(WILL ACTIVATE)' : '(preview only — live stays on id=16)'}`,
  );

  const srcRows = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, SOURCE_ID))
    .limit(1);
  const src = srcRows[0];
  if (!src) throw new Error(`v5 seed: source template id=${SOURCE_ID} not found`);

  let text = src.templateText;
  for (const edit of EDITS) {
    if (!text.includes(edit.oldStr)) {
      throw new Error(
        `v5 seed: could not find ${edit.label} anchor in id=${SOURCE_ID} — has the template drifted? Update the OLD constant.`,
      );
    }
    text = text.replace(edit.oldStr, edit.newStr);
    console.log(`  [EDIT] applied ${edit.label}`);
  }

  const name =
    'Front scene — one person v5 (honest scene energy + invent-action + anti-selfie)';
  const notes =
    'V5 from live id=16: (A) scene energy default flipped — public venues MUST populate with strangers, private = solo+atmosphere, candle-with-strangers named as red flag; (B) gaze gains vibe-only→invent-action + explicit anti-selfie; (C) expression reinforced always-on. One illusion, four guards. Preview-only until tested.';

  const existing = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.slot, PROMPT_SLOTS.FRONT_SCENE),
        eq(promptTemplates.variant, PROMPT_VARIANTS.ONE_PERSON),
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
    console.log(`  [REWRITE] one_person v5 (id=${templateId}, ${text.length} chars)`);
  } else {
    const [inserted] = await db
      .insert(promptTemplates)
      .values({
        slot: PROMPT_SLOTS.FRONT_SCENE,
        variant: PROMPT_VARIANTS.ONE_PERSON,
        cardType: null,
        name,
        version: 5,
        templateText: text,
        variables: src.variables,
        notes,
        createdBy: 'seed-front-scene-one-person-v5',
      })
      .returning();
    templateId = inserted.id;
    console.log(`  [INSERT] one_person v5 (id=${templateId}, ${text.length} chars)`);
  }

  if (ACTIVATE) {
    await db
      .update(promptActive)
      .set({ activeTemplateId: templateId })
      .where(
        and(
          eq(promptActive.slot, PROMPT_SLOTS.FRONT_SCENE),
          eq(promptActive.variant, PROMPT_VARIANTS.ONE_PERSON),
        ),
      );
    invalidatePromptCache();
    console.log(`  [ACTIVATE] one_person → id=${templateId}. Cache flushed.`);
  } else {
    console.log(
      `\n[SEED] V5 inserted as id=${templateId} but NOT active. Select v5 in the Prompt Lab to preview.`,
    );
    console.log(
      'To activate after testing: re-run with --activate. Rollback: re-point one_person active to id=16.',
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[SEED] V5 failed:', err);
  process.exit(1);
});
