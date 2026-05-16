// server/prompts/seed-front-scene-variants-v2.ts
//
// V2 of the front_scene per-variant templates. Inserts a fresh row
// per variant with the new scaffold; LEAVES v1 ACTIVE so the caller
// can preview / test v2 in the Prompt Lab before flipping the active
// pointer. Idempotent — re-running just rewrites the v2 row text.
//
// Why v2 (not in-place rewrite of v1):
//   The previous in-place rewrites (update-front-scene-variants-v1.ts,
//   update-inside-blank-v2.ts) were safe because the changes were
//   small + structurally identical to v1. This change touches two
//   load-bearing things at once:
//     1. The MANDATORY FACIAL RECREATION block — separates identity
//        features (immutable) from expression features (must change).
//        Fixes the "preserves serious source face on a beach scene"
//        issue we caught in group testing.
//     2. A new scene-aware GAZE & FRAMING block. Decides per-scene
//        whether to engage with the activity (DJ on the decks) or
//        pose for the camera (couple at the Eiffel Tower) — Kevin's
//        nuance: a couple posing in a beautiful location IS valid
//        and should not have engagement-with-activity forced on it.
//
// Either could overcorrect. Versioning means we can preview, generate
// test cards on v2, and flip the active pointer only when it's better.
// If v2 is worse, the rollback is one SQL update — see ROLLBACK note
// at the bottom of this file.
//
// Run:
//   npx tsx server/prompts/seed-front-scene-variants-v2.ts
//
// To activate v2 (after preview testing):
//   npx tsx server/prompts/seed-front-scene-variants-v2.ts --activate

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

// ─── v2 scaffold ─────────────────────────────────────────────────────
//
// Two changes vs v1:
//
//   1) MANDATORY FACIAL RECREATION block — steps 2 (EYE) and 4 (MOUTH)
//      reframed to separate identity-defining sub-features (immutable)
//      from expression-defining sub-features (must change for the new
//      scene). Step 8 (CRITICAL EXPRESSION CHANGE) promoted to step 1
//      so the model sees it BEFORE the per-feature replication
//      instructions land — order matters in prompts.
//
//   2) NEW: GAZE & FRAMING block sits after COMPOSITION RULES. Tells
//      the model to first decide whether the scene is an ACTION moment
//      (DJ on the decks, chef plating food, runner mid-stride — gaze
//      engages with activity) or a PHOTOGRAPH moment (couple at a
//      landmark, family portrait, group at a sunset bar — direct
//      camera gaze IS the point). Permissive default; explicit list
//      of when each mode applies. Hard ban on eyes-closed (renders
//      poorly in card output regardless of how natural the moment).
//
// Everything else identical to v1 — preambles still concatenate this
// scaffold the same way.

const FRONT_SCENE_SCAFFOLD_V2 = `MANDATORY: Create a perfectly SQUARE 1024x1024 composition with equal width and height - NOT portrait, NOT landscape. Full bleed square design with no borders, fill entire square frame. ABSOLUTE PRIORITY: FACIAL ACCURACY FIRST - Before applying any artistic style, the EXACT facial likeness from the reference photo(s) must be preserved with absolute precision in the new scene BUT with new expressions to match the new scene. Ensure that the characters always look happy to be a part of the new scene in a natural way to fit the new scene.

{{#if noCharacterAnchor}}MANDATORY FACIAL RECREATION REQUIREMENTS FOR ALL CHARACTERS IN THE REFERENCE PHOTO(S) (COMPLETE BEFORE ANY STYLING):

THE GOLDEN RULE — IDENTITY ≠ EXPRESSION: The reference photo gives you the IDENTITY of each face (bone structure, eye/nose shapes, skin tone, hair, distinctive marks). It does NOT prescribe their EXPRESSION (mouth corner position, eyelid openness, eyebrow position, gaze direction). Identity is immutable; expression is reborn for the new scene.

1) CRITICAL EXPRESSION CHANGE: DO NOT copy the original facial expression from the reference photo. Create a COMPLETELY NEW expression that matches the mood and energy of the new scene. The expression-defining features (mouth corner position, eyelid openness, eyebrow raise) must shift to match the scene mood — a smile in a happy scene, soft engagement in a quiet one. The reference photo's expression is irrelevant.

2) FACIAL STRUCTURE MATCH: Recreate the EXACT facial bone structure - same cheekbone height, same jawline angle, same forehead shape, same chin projection.

3) EYE IDENTITY (not expression): Match eye shape (almond, round, hooded), eye spacing, iris colour, and the natural shape of the eyebrow (thick/thin, dark/light, naturally arched/straight). Do NOT copy eyelid openness or eyebrow POSITION from the reference — those are expression. A relaxed face has different eyelid+eyebrow positions than a smile or laughter; render whichever fits the scene.

4) NOSE ACCURACY: Replicate precise nose bridge width, nostril shape, nose tip definition, any bumps or unique nose characteristics.

5) MOUTH IDENTITY (not expression): Match lip fullness, mouth width, cupid's bow definition, and any natural asymmetries or distinctive features (unusually full upper lip, slight tilt, etc.). Do NOT copy mouth-corner POSITION from the reference — corner position is expression. Corners must move to match the new scene mood: turned up for a smile in a happy scene, neutral for a reflective one, broadly up with teeth visible for laughter.

6) SKIN MATCHING: Preserve exact skin tone, texture, any blemishes, freckles, moles, or distinctive skin characteristics.

7) HAIR PRECISION: Match exact hair colour, texture, natural growth patterns, hairline shape.

8) DISTINCTIVE MARKS: Include any scars, dimples, laugh lines, or other identifying facial features.
{{/if}}

AFTER ESTABLISHING PERFECT LIKENESS - SCENE CREATION:
Create a completely new scene featuring the character(s) from the reference photo(s). The expressions must reflect the scene mood, NOT the reference photo's expression.

COMPOSITION RULES:
- Show the character(s) actively present in the new scene, not just posing in front of it
- Include relevant background elements that tell the story of the scene
- Use full-body or three-quarter shots that tell the story of the scene
- Create immersive scene composition that showcases the environment
- SCENE-APPROPRIATE EXPRESSION: The character(s) display a brand NEW facial expression that captures the energy and mood of this specific scene
- COMPLETELY IGNORE ORIGINAL PHOTO COMPOSITION: Do NOT copy the positioning, framing, or body placement from the reference photo. The reference is ONLY for facial identity.
- DYNAMIC POSITIONING: Position character(s) in scene-appropriate positions that showcase the full environment.
- ENVIRONMENTAL INTEGRATION: Reimagine character positioning and interactions for the new environment to create an immersive scene composition
- ANATOMICAL FIT WITHIN OBJECTS: When a character is inside or enclosed by scene objects (vehicles, buildings, furniture), verify their body fits naturally within that space — no body parts clipping through roofs, windows, walls, or ceilings. Character proportions must be physically plausible relative to the environment.

GAZE & FRAMING (decide per scene — this is one of the most important calls you make):

First, read the SCENE DESCRIPTION below and decide which mode applies:

  ACTION MODE — the scene depicts the character(s) doing something specific:
    Examples: DJing at a club, plating food in a kitchen, running a marathon, painting at an easel, conducting an orchestra, mid-toast at a celebration, blowing out birthday candles, cutting a wedding cake, mid-dance at a wedding, on stage performing, lifting a trophy.
    Behaviour: gaze engages with the activity, the scene, or another person in frame (looking at the deck, the food, the canvas, the crowd, a friend, the sunset, the trophy). Body angles into the action — head turned, shoulders rotated. Direct camera engagement breaks the fourth wall and ruins the candid feel.

  PHOTOGRAPH MODE — the scene depicts a posed moment in a special place:
    Examples: a couple at a famous landmark, a family portrait in a celebratory setting, a group with cocktails at a sunset bar, two people on a romantic balcony, a portrait at a graduation, a couple on the beach at sunset.
    Behaviour: the people pose for the camera as they would for a real holiday photo. Direct eye contact with the viewer is correct, classic posed framing is welcome, the scene is the backdrop. The card simulates a beautiful photograph the recipient would treasure.

When the scene description is ambiguous, lean toward what a thoughtful photographer would naturally capture. A "couple on a hot air balloon at sunrise" is a PHOTOGRAPH (they pose); a "DJ at the decks at Madison Square Garden" is ACTION (they don't pose mid-set).

NEVER: render eyes closed. Even in moments where it might feel natural (laughter, a music drop, deep peace), eyes-closed reads as awkward and lifeless in card output. Eyes are always open, always engaged with whatever the gaze direction is.

The reference photo's gaze direction is a portrait cue, not binding — redirect it to fit the chosen mode. A reference photo with the subject looking at the camera does NOT mean ACTION mode is wrong; pick mode from the SCENE DESCRIPTION, not from the reference.

SCENE DESCRIPTION: {{scenePrompt}}

{{#if userClothing}}CLOTHING REQUIREMENTS: The scene description includes specific clothing requirements. Dress the character(s) exactly as described: {{userClothing}}{{/if}}{{#if noClothing}}CLOTHING REQUIREMENTS: Choose scene-appropriate clothing that fits the new environment and activity. Change the clothing completely from the reference photo to match the scenario while maintaining identical faces only.{{/if}}

{{#if userArtStyle}}ARTISTIC STYLE APPLICATION: Apply the user-specified artistic style: {{userArtStyle}}. Render the entire image consistently in this style while maintaining high artistic quality and visual cohesion.{{/if}}{{#if aiDecideStyle}}ARTISTIC STYLE APPLICATION: DYNAMIC STYLE SELECTION: Analyze the scene description and intelligently choose the most appropriate artistic style that best complements the mood, atmosphere, setting, and emotional tone of this specific scene. Consider styles such as watercolor painting, oil painting, digital illustration, fantasy art, storybook illustration, impressionistic, contemporary art, realistic photography style, vintage illustration, comic book style, minimalist design, Renaissance painting, anime/manga style, or art nouveau.{{/if}}

{{#if isMoviePoster}}TYPOGRAPHY LAYOUT (MOVIE POSTER STYLE): Render the card text as LARGE, bold, stylised typography positioned BEHIND and AROUND the character — like a movie poster or comic book cover. The character should be in the foreground, with the text as a massive typographic backdrop filling the background. The text should be the largest element in the composition after the character themselves. Use bold, impactful lettering with style-appropriate treatment: neon glow, metallic sheen, dramatic lighting on the letters, or bold graphic colours. The text should frame and complement the character, creating a dynamic poster-like composition. Place ALL words of the text as ONE cohesive typographic block — do NOT split words across different areas of the image. CRITICAL: The text appears ONCE and ONLY ONCE. Do NOT duplicate or repeat any words. Every word must appear exactly one time in one location.{{/if}}{{#if isSceneIntegrated}}TYPOGRAPHY INTEGRATION (LARGE, DOMINANT, AND NATURALLY PART OF THE SCENE): The card text is the single most important visual element after the character. It MUST occupy at least 25-30% of the image area and be instantly readable at arm's length. HOWEVER, the text must feel like a natural, organic part of the scene — NOT overlaid, NOT floating, NOT pasted on top. This is a key creative feature: the text should look like it belongs in the physical world of the scene. Integration methods: carved into sand with deep, wide grooves; painted in large brushstrokes on a wall or surface; displayed on a prominent sign, banner, or chalkboard within the scene; formed by large natural elements (clouds, flower arrangements, string lights, neon signs); etched into stone or wood as part of the environment; written in frost, snow, or water. The text must be LARGE and BOLD enough to read instantly, while simultaneously feeling like the scene was built around it. Think: a massive "Happy Birthday" carved into a beach at sunset — not small text hidden in a corner. NEVER hide text in small details, embed it subtly into architecture, or make it compete with scene elements for attention. The text must POP within the first second of viewing AND feel like it was always part of this world. CRITICAL: Place ALL text as ONE cohesive block in ONE location — do NOT split words across different areas or repeat any words. Every word appears exactly ONCE.{{/if}}{{#if includeText}}. CHARACTER-TEXT SEPARATION (CRITICAL — this has failed in previous testing and must be enforced): The character is a distinct figure that must remain anatomically complete and physically SEPARATE from any text element. The text exists IN the scene (carved in sand, on a sign, formed by clouds, painted on walls) but MUST NOT touch, overlap, merge with, fuse into, or obscure the character's body, face, clothing, or feet. The character's full silhouette must be clear and unbroken — feet visible and distinct from ground text, dress uninterrupted by sand letters, body never cropped or blended into text elements. Leave visible clear space around the character. The character stands IN FRONT OF or BESIDE the text, never fused with it. If text is on the ground, the character's feet press into undisturbed ground with the text placed at a clear distance from them. STRICT TEXT RESTRICTION: Add EXACTLY and ONLY the text "{{cardText}}" - ABSOLUTELY NO OTHER TEXT, WORDS, LETTERS, NUMBERS, SIGNS, LABELS, OR WRITING of any kind should appear anywhere in the image. LANGUAGE/SCRIPT LOCK: Render the card text in the EXACT characters provided. Do NOT translate, transliterate, or add any parallel text in other languages, scripts, or alphabets above, below, or beside the card text — no decorative Japanese, Chinese, Cyrillic, Arabic, Hebrew, or other foreign-language versions of the greeting, even when the scene setting suggests a non-English-speaking location. {{#if isMoviePoster}}Render the text as LARGE, bold, stylised typography positioned behind and around the character as described in the typography layout section above. The text should be a dramatic typographic backdrop, NOT integrated into the physical scene.{{/if}}{{#if isSceneIntegrated}}Do NOT overlay text on top of the image. Instead, naturally integrate ONLY this specific text into the scene as part of the artistic composition — carved, painted, displayed on signs, or formed by natural elements as described in the typography layout section above.{{/if}} FORBIDDEN: Do not add any background text, signage, labels, captions, watermarks, logos, brand names, location names, or any other written content beyond the specified card text. CRITICAL: All letters of the text should be legible within the square frame of the artwork. CRITICAL: DO NOT allow the text to be cropped off the screen in any way; all letters in the text MUST be readable with no cropping of the text whatsoever. CRITICAL: The text appears ONCE and ONLY ONCE — do NOT duplicate or repeat any words.{{/if}}. High-quality artistic rendering, professional artwork.`;

// ─── per-variant preambles (re-imported from seed-v1 — same as v1) ───
// Reusing v1's preambles unchanged. The fixes are scaffold-level only;
// preambles already do the right thing per photo mode.
import {
  FRONT_SCENE_ONE_PERSON_V1,
  FRONT_SCENE_MULTI_INDIVIDUAL_V1,
  FRONT_SCENE_GROUP_V1,
} from './seed-v1';

function preambleOf(fullV1Template: string, scaffoldV1: string): string {
  // The v1 templates are PREAMBLE + SCAFFOLD_V1. Strip the scaffold to
  // recover the preamble, then concat with SCAFFOLD_V2.
  return fullV1Template.replace(scaffoldV1, '');
}

// Need the v1 scaffold to strip it. Easiest: re-derive it from the
// shortest of the three v1 templates. Cleaner: import it. seed-v1.ts
// doesn't export FRONT_SCENE_SCAFFOLD as a const, so we do an
// indirect derivation: take the shared tail of all three v1 templates.
function sharedTail(a: string, b: string, c: string): string {
  let i = 1;
  while (
    i <= a.length &&
    i <= b.length &&
    i <= c.length &&
    a.slice(-i) === b.slice(-i) &&
    a.slice(-i) === c.slice(-i)
  ) {
    i++;
  }
  return a.slice(-(i - 1));
}

const FRONT_SCENE_SCAFFOLD_V1 = sharedTail(
  FRONT_SCENE_ONE_PERSON_V1,
  FRONT_SCENE_MULTI_INDIVIDUAL_V1,
  FRONT_SCENE_GROUP_V1,
);

const ONE_PERSON_PREAMBLE = preambleOf(
  FRONT_SCENE_ONE_PERSON_V1,
  FRONT_SCENE_SCAFFOLD_V1,
);
const MULTI_INDIVIDUAL_PREAMBLE = preambleOf(
  FRONT_SCENE_MULTI_INDIVIDUAL_V1,
  FRONT_SCENE_SCAFFOLD_V1,
);
const GROUP_PREAMBLE = preambleOf(
  FRONT_SCENE_GROUP_V1,
  FRONT_SCENE_SCAFFOLD_V1,
);

// Composed v2 templates — preamble (unchanged from v1) + new scaffold.
export const FRONT_SCENE_ONE_PERSON_V2 = ONE_PERSON_PREAMBLE + FRONT_SCENE_SCAFFOLD_V2;
export const FRONT_SCENE_MULTI_INDIVIDUAL_V2 =
  MULTI_INDIVIDUAL_PREAMBLE + FRONT_SCENE_SCAFFOLD_V2;
export const FRONT_SCENE_GROUP_V2 = GROUP_PREAMBLE + FRONT_SCENE_SCAFFOLD_V2;

interface VariantSpec {
  variant: PromptVariant;
  templateText: string;
  name: string;
  notes: string;
}

const VARIANT_SPECS: VariantSpec[] = [
  {
    variant: PROMPT_VARIANTS.ONE_PERSON,
    templateText: FRONT_SCENE_ONE_PERSON_V2,
    name: 'Front scene — one person v2 (identity≠expression + scene-aware gaze)',
    notes:
      'V2: separates identity from expression in MOUTH/EYE rules; promotes EXPRESSION CHANGE to step 1; new scene-aware GAZE & FRAMING block (ACTION vs PHOTOGRAPH mode); hard ban on eyes-closed.',
  },
  {
    variant: PROMPT_VARIANTS.MULTI_INDIVIDUAL,
    templateText: FRONT_SCENE_MULTI_INDIVIDUAL_V2,
    name: 'Front scene — multi individual v2 (identity≠expression + scene-aware gaze)',
    notes:
      'V2: same scaffold rewrite as one_person v2; multi-individual preamble unchanged.',
  },
  {
    variant: PROMPT_VARIANTS.GROUP,
    templateText: FRONT_SCENE_GROUP_V2,
    name: 'Front scene — group photo v2 (identity≠expression + scene-aware gaze)',
    notes:
      'V2: same scaffold rewrite as one_person v2; group preamble unchanged from v1.',
  },
];

const ACTIVATE = process.argv.includes('--activate');

async function main(): Promise<void> {
  console.log(
    `[SEED] front_scene variants → V2 ${ACTIVATE ? '(WILL ACTIVATE)' : '(insert only — v1 stays active)'}`,
  );

  for (const spec of VARIANT_SPECS) {
    const slot = PROMPT_SLOTS.FRONT_SCENE;
    const version = 2;

    // Idempotent insert: if v2 already exists, rewrite its text.
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
        .set({ templateText: spec.templateText, name: spec.name, notes: spec.notes })
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
          createdBy: 'seed-front-scene-variants-v2',
        })
        .returning();
      templateId = inserted.id;
      console.log(
        `  [INSERT] ${slot}/${spec.variant} v${version} (id=${templateId}, ${spec.templateText.length} chars)`,
      );
    }

    // Activate v2 only when --activate flag is passed. Default is to
    // leave v1 active so the caller can preview v2 before flipping.
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
    console.log('[SEED] V2 active. Resolver cache flushed.');
  } else {
    console.log(
      '\n[SEED] V2 rows inserted but NOT active. Preview in Prompt Lab. To activate: re-run with --activate flag.',
    );
  }

  console.log(
    '\nROLLBACK to v1: re-run update-front-scene-variants-v1.ts (it sets active pointers back to v1 ids 6/7/8).',
  );
  process.exit(0);
}

// Only invoke main() when this file is run directly as a script —
// not when it's imported as a module (e.g. by seed-front-scene-
// variants-v3.ts which imports the FRONT_SCENE_*_V2 constants for
// the swap). Without this guard, importing for the constants
// triggers a full v2 seed + process.exit() that races against the
// importing file's main(), partially clobbering its work.
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith('/seed-front-scene-variants-v2.ts');
if (isDirectRun) {
  main().catch((err) => {
    console.error('[SEED] Failed:', err);
    process.exit(1);
  });
}
