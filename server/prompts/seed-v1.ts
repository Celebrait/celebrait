// server/prompts/seed-v1.ts
//
// Seeds version 1 of the prompt_templates table from the hardcoded prompts
// in shared/prompts.ts. Run once after `db:push` has created the tables:
//
//   npx tsx server/prompts/seed-v1.ts
//
// Idempotent: if version 1 already exists for a (slot, variant), it is left
// alone. Activates each v1 template as the default pointer for its (slot,
// variant).
//
// The non-variant front_scene template and the inside template are kept
// byte-identical to what they were pre-split so existing prompt_active rows
// stay valid. Per-variant front_scene templates (one_person / multi_individual
// / group) are introduced fresh — see PROMPT_VARIANTS.

import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import {
  promptTemplates,
  promptActive,
  PROMPT_SLOTS,
  PROMPT_VARIANTS,
  type PromptVariable,
  type PromptVariant,
} from '@shared/schema';

// ─── front_scene shared scaffold ─────────────────────────────────────────────
// The 80% of the prompt that's identical across all three photo-mode variants:
// facial recreation, scene creation, clothing, art style, typography, text
// restriction. Each variant prepends its own preamble and then concatenates
// this scaffold.

const FRONT_SCENE_SCAFFOLD = `MANDATORY: Create a perfectly SQUARE 1024x1024 composition with equal width and height - NOT portrait, NOT landscape. Full bleed square design with no borders, fill entire square frame. ABSOLUTE PRIORITY: FACIAL ACCURACY FIRST - Before applying any artistic style, the EXACT facial likeness from the reference photo(s) must be preserved with absolute precision in the new scene BUT with new expressions to match the new scene. Ensure that the characters always look happy to be a part of the new scene in a natural way to fit the new scene.

{{#if noCharacterAnchor}}MANDATORY FACIAL RECREATION REQUIREMENTS FOR ALL CHARACTERS IN THE REFERENCE PHOTO(S) (COMPLETE BEFORE ANY STYLING):
1) FACIAL STRUCTURE MATCH: Recreate the EXACT facial bone structure - same cheekbone height, same jawline angle, same forehead shape, same chin projection (but with new facial expression to match the new scene and mood)
2) EYE PRECISION: Match exact eye shape (almond, round, hooded), eye spacing, eyelid fold pattern, iris color, eyebrow shape and arch
3) NOSE ACCURACY: Replicate precise nose bridge width, nostril shape, nose tip definition, any bumps or unique nose characteristics
4) MOUTH DUPLICATION: Copy exact lip fullness, mouth width, corner shape, any asymmetries or distinctive mouth features
5) SKIN MATCHING: Preserve exact skin tone, texture, any blemishes, freckles, moles, or distinctive skin characteristics
6) HAIR PRECISION: Match exact hair color, texture, natural growth patterns, hairline shape
7) DISTINCTIVE MARKS: Include any scars, dimples, laugh lines, or other identifying facial features
8) CRITICAL EXPRESSION CHANGE: DO NOT copy the original facial expression from the reference photo. You must create a COMPLETELY NEW facial expression that matches the mood and energy of the new scene
{{/if}}
AFTER ESTABLISHING PERFECT LIKENESS - SCENE CREATION:
Create a completely new scene featuring the character(s) from the reference photo(s). CRITICAL: Ensure the characters facial expressions capture the mood of the new scene. DO NOT COPY the original expressions.

COMPOSITION RULES:
- Show the character(s) actively participating in the new scene, not just posing
- Include relevant background elements that tell the story of the scene
- Use full-body or three-quarter shots that tell the story of the scene
- Create immersive scene composition that showcases the environment
- SCENE-APPROPRIATE EXPRESSION: The character(s) must display a brand NEW facial expression that perfectly captures the energy and mood of this specific scene
- COMPLETELY IGNORE ORIGINAL PHOTO COMPOSITION: Do NOT copy the positioning, framing, or body placement from the reference photo. The reference is ONLY for facial features
- CREATIVE POSITIONING REQUIRED: Position character(s) in completely different positions that showcase the full scene context
- DYNAMIC POSES AND INTERACTIONS: Create completely new poses that are appropriate for the scene activity and energy level
- ENVIRONMENTAL INTEGRATION: Reimagine character positioning and interactions for the new environment to create an immersive scene composition
- ANATOMICAL FIT WITHIN OBJECTS: When a character is inside or enclosed by scene objects (vehicles, buildings, furniture), verify their body fits naturally within that space — no body parts clipping through roofs, windows, walls, or ceilings. Character proportions must be physically plausible relative to the environment.

SCENE DESCRIPTION: {{scenePrompt}}

{{#if userClothing}}CLOTHING REQUIREMENTS: The scene description includes specific clothing requirements. Dress the character(s) exactly as described: {{userClothing}}{{/if}}{{#if noClothing}}CLOTHING REQUIREMENTS: Choose scene-appropriate clothing that fits the new environment and activity. Change the clothing completely from the reference photo to match the scenario while maintaining identical faces only.{{/if}}

{{#if userArtStyle}}ARTISTIC STYLE APPLICATION: Apply the user-specified artistic style: {{userArtStyle}}. Render the entire image consistently in this style while maintaining high artistic quality and visual cohesion.{{/if}}{{#if aiDecideStyle}}ARTISTIC STYLE APPLICATION: DYNAMIC STYLE SELECTION: Analyze the scene description and intelligently choose the most appropriate artistic style that best complements the mood, atmosphere, setting, and emotional tone of this specific scene. Consider styles such as watercolor painting, oil painting, digital illustration, fantasy art, storybook illustration, impressionistic, contemporary art, realistic photography style, vintage illustration, comic book style, minimalist design, Renaissance painting, anime/manga style, or art nouveau.{{/if}}

{{#if isMoviePoster}}TYPOGRAPHY LAYOUT (MOVIE POSTER STYLE): Render the card text as LARGE, bold, stylised typography positioned BEHIND and AROUND the character — like a movie poster or comic book cover. The character should be in the foreground, with the text as a massive typographic backdrop filling the background. The text should be the largest element in the composition after the character themselves. Use bold, impactful lettering with style-appropriate treatment: neon glow, metallic sheen, dramatic lighting on the letters, or bold graphic colours. The text should frame and complement the character, creating a dynamic poster-like composition. Place ALL words of the text as ONE cohesive typographic block — do NOT split words across different areas of the image. CRITICAL: The text appears ONCE and ONLY ONCE. Do NOT duplicate or repeat any words. Every word must appear exactly one time in one location.{{/if}}{{#if isSceneIntegrated}}TYPOGRAPHY INTEGRATION (LARGE, DOMINANT, AND NATURALLY PART OF THE SCENE): The card text is the single most important visual element after the character. It MUST occupy at least 25-30% of the image area and be instantly readable at arm's length. HOWEVER, the text must feel like a natural, organic part of the scene — NOT overlaid, NOT floating, NOT pasted on top. This is a key creative feature: the text should look like it belongs in the physical world of the scene. Integration methods: carved into sand with deep, wide grooves; painted in large brushstrokes on a wall or surface; displayed on a prominent sign, banner, or chalkboard within the scene; formed by large natural elements (clouds, flower arrangements, string lights, neon signs); etched into stone or wood as part of the environment; written in frost, snow, or water. The text must be LARGE and BOLD enough to read instantly, while simultaneously feeling like the scene was built around it. Think: a massive "Happy Birthday" carved into a beach at sunset — not small text hidden in a corner. NEVER hide text in small details, embed it subtly into architecture, or make it compete with scene elements for attention. The text must POP within the first second of viewing AND feel like it was always part of this world. CRITICAL: Place ALL text as ONE cohesive block in ONE location — do NOT split words across different areas or repeat any words. Every word appears exactly ONCE.{{/if}}{{#if includeText}}. CHARACTER-TEXT SEPARATION (CRITICAL — this has failed in previous testing and must be enforced): The character is a distinct figure that must remain anatomically complete and physically SEPARATE from any text element. The text exists IN the scene (carved in sand, on a sign, formed by clouds, painted on walls) but MUST NOT touch, overlap, merge with, fuse into, or obscure the character's body, face, clothing, or feet. The character's full silhouette must be clear and unbroken — feet visible and distinct from ground text, dress uninterrupted by sand letters, body never cropped or blended into text elements. Leave visible clear space around the character. The character stands IN FRONT OF or BESIDE the text, never fused with it. If text is on the ground, the character's feet press into undisturbed ground with the text placed at a clear distance from them. STRICT TEXT RESTRICTION: Add EXACTLY and ONLY the text "{{cardText}}" - ABSOLUTELY NO OTHER TEXT, WORDS, LETTERS, NUMBERS, SIGNS, LABELS, OR WRITING of any kind should appear anywhere in the image. LANGUAGE/SCRIPT LOCK: Render the card text in the EXACT characters provided. Do NOT translate, transliterate, or add any parallel text in other languages, scripts, or alphabets above, below, or beside the card text — no decorative Japanese, Chinese, Cyrillic, Arabic, Hebrew, or other foreign-language versions of the greeting, even when the scene setting suggests a non-English-speaking location. {{#if isMoviePoster}}Render the text as LARGE, bold, stylised typography positioned behind and around the character as described in the typography layout section above. The text should be a dramatic typographic backdrop, NOT integrated into the physical scene.{{/if}}{{#if isSceneIntegrated}}Do NOT overlay text on top of the image. Instead, naturally integrate ONLY this specific text into the scene as part of the artistic composition — carved, painted, displayed on signs, or formed by natural elements as described in the typography layout section above.{{/if}} FORBIDDEN: Do not add any background text, signage, labels, captions, watermarks, logos, brand names, location names, or any other written content beyond the specified card text. CRITICAL: All letters of the text should be legible within the square frame of the artwork. CRITICAL: DO NOT allow the text to be cropped off the screen in any way; all letters in the text MUST be readable with no cropping of the text whatsoever. CRITICAL: The text appears ONCE and ONLY ONCE — do NOT duplicate or repeat any words.{{/if}}. High-quality artistic rendering, professional artwork.`;

// ─── front_scene per-variant preambles ───────────────────────────────────────

const ONE_PERSON_PREAMBLE = `{{#if hasMultiplePhotos}}REFERENCE PHOTO CONTEXT: You have been given {{photoCount}} photos of THE SAME PERSON from different angles. These are NOT different people — they are all the same individual. Use ALL photos together to build a comprehensive understanding of this person's facial structure, features, and proportions. The multiple angles give you more identity signal — use it to produce a more accurate likeness than any single photo could achieve.

{{/if}}SCENE ENERGY: Even if the scene description mentions only one person, fill the environment with life — background figures enjoying the setting, ambient activity appropriate to the location (other beachgoers, passing boats, street performers, fellow diners), warm atmospheric details (string lights, floating lanterns, drifting confetti, flying birds). The scene should feel alive and populated, never empty or sterile. The uploaded person is the HERO of the scene but they should not look alone in the world.

`;

const MULTI_INDIVIDUAL_PREAMBLE = `TOP-PRIORITY DIRECTIVE — MULTI-PERSON SCENE (read before anything else): This card features {{photoCount}} CO-PROTAGONISTS. You have been given {{photoCount}} SEPARATE reference photos — EACH photo shows a DIFFERENT person. ALL {{photoCount}} people MUST appear together as EQUAL FOREGROUND characters in the final scene. This is non-negotiable.

MULTI-PERSON RULES (apply strictly):
- Every one of the {{photoCount}} people must be clearly visible in the foreground, at a size where their face is fully recognisable — not silhouettes, not tiny figures in the distance, not anonymous extras.
- Each person's face must be rendered from THEIR OWN reference photo. Preserve their distinct face shape, skin tone, features, hairstyle, and complexion. Do NOT blend, average, or merge features between people.
- Arrange the {{photoCount}} people as a cohesive group interacting with each other and with the scene — a natural gathering, not a row of portraits.
- If the card text names a single person (e.g. "Happy Birthday Sarah"), that person is the recipient of the card — but ALL {{photoCount}} people are still the subjects of the scene. Do NOT drop the other {{photoCount}} subjects just because only one is named in the text.
- Populate any incidental bystanders (crowd, other beachgoers, etc.) ONLY if the scene calls for it — and they must remain clearly secondary to the {{photoCount}} reference people.

`;

// ── GROUP_PREAMBLE rewrite (2026-05-15) ──────────────────────────────
// Third pass on this preamble. After the May-14 rewrite (identity-signal
// framing + IDENTITY≠EXPRESSION callout + scene energy), group cards
// were STILL coming back with the people locked in their source's
// side-by-side posed pairing — even with v2's GAZE block in the
// scaffold telling the model to engage with action.
//
// The missing piece: nothing in the prompt explicitly addressed that
// group source photos are almost always POSED PORTRAITS (side-by-side,
// facing camera, formal positioning), and that this composition is
// the wrong template for almost every action scene. The model reads
// the source's "two people side-by-side" as relationship information
// to preserve, not as a portrait composition to discard.
//
// This pass adds an explicit BREAK-THE-PAIRING rule with concrete
// directives: animate each person independently, distribute through
// scene depth, mix gaze directions, mix postures. Reframes the source
// from "the relationship template" to "two face references that
// happen to be in the same image".
const GROUP_PREAMBLE = `REFERENCE PHOTO CONTEXT: The reference photo contains multiple people. Use the photo as IDENTITY SIGNAL — read each person's distinct facial structure, features, complexion, and hair so you can render each individual recognisably in the new scene. Do NOT blend, average, or merge features between subjects; each person must remain a separate, individually-recognisable identity in the output. Pay special attention to distinguishing features (skin tone differences, face shapes, hair styles, facial hair, etc.).

CRITICAL — IDENTITY ≠ EXPRESSION: The photo provides the IDENTITY of each face (bone structure, eye/nose/mouth shapes, skin tone, hair). It does NOT prescribe their EXPRESSIONS. Every face in the new scene must wear a brand NEW expression that fits the mood and energy of the scene — not the expression they happened to be making in the reference photo. Identity stays; expressions are reborn for the scene.

CRITICAL — BREAK THE SOURCE'S POSED PAIRING (this is the most-common group failure mode):
The reference photo is almost certainly a posed portrait — the people standing side-by-side, similar postures, both facing the camera, paired together as a unit. THIS COMPOSITION IS THE WRONG TEMPLATE for almost every scene. Treat the reference as TWO INDEPENDENT FACE REFERENCES that happen to be in the same image — NOT as a relationship blueprint to copy.

For EVERY scene (Celebrait is action-only — see GAZE & FRAMING block in the scaffold):
  - Animate each person INDEPENDENTLY. They are NOT a side-by-side matched pair.
  - Distribute through scene depth and angle: one closer to camera, one further; one leaning into the moment, one upright; one in three-quarter view, one in profile. Variety in positioning is what sells the candid feel.
  - Each person engages with the activity from their own angle: one looking at the cards, one looking at their partner; one stirring the pot, one chopping; one mid-laugh facing right, one tipping their head back. They are NOT both staring forward in unison.
  - Each face wears a scene-appropriate expression independently — if one is mid-laugh with mouth open, the other might be mid-smile, or grinning at them, or focused on the activity. NOT identical expressions in lockstep.
  - The source's side-by-side pose is to be DISCARDED for every scene. If you find yourself rendering two people standing or sitting paired-up facing the viewer, you have failed this rule.
  - Even for "posed" sounding scene descriptions (couple at a landmark, anniversary balcony shot, family portrait): break the pairing, render as the captured action moment described in the GAZE & FRAMING block. There is no PHOTOGRAPH carve-out — Celebrait does not produce posed-portrait outputs.

SCENE ENERGY (decide per scene — PUBLIC vs PRIVATE):

First, classify the scene from the SCENE DESCRIPTION below.

PUBLIC scenes — places where strangers are naturally present:
  Examples: beach, bar, restaurant, marathon, concert, festival, park, market, gallery, club, gym, station, conference, wedding venue, holiday destination, sports stadium, street.
  Behaviour: fill the environment with life — background figures enjoying the setting, ambient activity (other beachgoers, passing boats, street performers, fellow diners), warm atmospheric details (string lights, floating lanterns, drifting confetti, flying birds). Never empty or sterile.

PRIVATE scenes — places where ONLY the people from the reference photo would naturally be present:
  Examples: at home (kitchen, living room, bedroom, garden), an intimate dinner for two, blowing out birthday candles at home, opening Christmas presents on the sofa, reading by the fireplace, a quiet picnic for two in a remote spot, a hot tub at a private cabin, a candlelit bath, watching a film together at home, breakfast in bed.
  Behaviour: ONLY render the people from the reference photo. NO background figures. NO ambient strangers, NO "fellow diners", NO "passers-by", NO "family in the background" who weren't in the photo. Atmospheric details (candles, fairy lights, fireplace glow, garden lanterns, plants, decor, presents under the tree) are still welcome — but no people who aren't the subjects.

When the scene description is ambiguous, lean PRIVATE. Strangers showing up uninvited in an intimate moment ruins the card; an empty background in a public scene only feels muted.

`;

// ─── composed front_scene templates ──────────────────────────────────────────

// Exported so one-off update scripts (see update-front-scene-variants-v2.ts)
// can re-use the exact same composition rules as the initial seed.
export const FRONT_SCENE_ONE_PERSON_V1 = ONE_PERSON_PREAMBLE + FRONT_SCENE_SCAFFOLD;
export const FRONT_SCENE_MULTI_INDIVIDUAL_V1 = MULTI_INDIVIDUAL_PREAMBLE + FRONT_SCENE_SCAFFOLD;
export const FRONT_SCENE_GROUP_V1 = GROUP_PREAMBLE + FRONT_SCENE_SCAFFOLD;

export const FRONT_SCENE_VARS: PromptVariable[] = [
  { name: 'scenePrompt', type: 'string', required: true, description: "User's description of the scene" },
  { name: 'userArtStyle', type: 'string', required: false, description: "Specific art style, or empty for 'AI decide'" },
  { name: 'userClothing', type: 'string', required: false, description: 'Optional clothing requirements' },
  { name: 'includeText', type: 'boolean', required: false, description: 'Whether to render cardText into the scene' },
  { name: 'cardText', type: 'string', required: false, description: 'The exact text to render, e.g. "Happy Birthday Sarah"' },
];

// ─── inside v1 template ──────────────────────────────────────────────────────
// Mirrors buildInsidePrompt() from shared/prompts.ts.

const INSIDE_V1 = `Square 1:1 aspect ratio interior design, full bleed with no borders or edges visible, DO NOT include any people, characters, or figures from the front card, {{#if hasStructuredGreeting}}"{{insideText}}" prominently displayed as the main focus with proper greeting card typography hierarchy, GREETING CARD TYPOGRAPHY HIERARCHY: Format the text as a traditional greeting card with proper spacing and hierarchy:{{#if hasDear}} - Greeting "{{dear}}" should appear at the top in elegant, smaller font (14-16pt equivalent){{/if}}{{#if hasMessage}} - Main message "{{message}}" should be prominently displayed in the center with larger, readable font (18-24pt equivalent) and generous line spacing{{/if}}{{#if hasFrom}} - Signature "{{from}}" should be positioned at the bottom in smaller, elegant font (12-14pt equivalent), typically bottom-right or center-bottom{{/if}}. Use traditional greeting card proportions with proper margins and spacing between sections. Ensure clear visual hierarchy and professional greeting card appearance.{{/if}}{{#if noStructuredGreeting}}"{{insideText}}" prominently displayed as the main focus{{/if}}, {{#if artStyle}}Apply the same artistic style as the front card: {{artStyle}}. Maintain visual consistency with the same style treatment, color palette, and visual aesthetic.{{/if}}{{#if noArtStyle}}Use the same artistic style that was intelligently chosen for the front card to maintain visual consistency. Apply the same style treatment, color palette, and visual aesthetic as the front card.{{/if}}, Make subtle reference to the theme on the front of the card, but ensure any reference is kept very subtle so that the main focus is the text which is always to be readable, STRICT TEXT RESTRICTION: Include EXACTLY and ONLY the text "{{insideText}}" - ABSOLUTELY NO OTHER TEXT, WORDS, LETTERS, NUMBERS, SIGNS, LABELS, OR WRITING of any kind should appear anywhere in the image. FORBIDDEN: Do not add any background text, signage, labels, captions, watermarks, logos, brand names, decorative text, or any other written content. TYPOGRAPHY: Integrate ONLY the specified text naturally into the design as an organic part of the composition., text prominently displayed and clearly readable, minimal decorative elements that complement without overwhelming the message, print-ready artwork, no mockup visible`;

const INSIDE_VARS: PromptVariable[] = [
  { name: 'insideText', type: 'string', required: true, description: 'The full inside card text' },
  { name: 'artStyle', type: 'string', required: false, description: "Specific art style, or empty for 'inherit from front'" },
  { name: 'dear', type: 'string', required: false, description: 'Greeting line (structured card)' },
  { name: 'message', type: 'string', required: false, description: 'Main message (structured card)' },
  { name: 'from', type: 'string', required: false, description: 'Signature line (structured card)' },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

async function upsertVersion1(
  slot: string,
  variant: PromptVariant | null,
  name: string,
  templateText: string,
  variables: PromptVariable[],
  notes: string,
): Promise<number> {
  // Check if v1 already exists for (slot, variant)
  const existing = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.slot, slot),
        eq(promptTemplates.version, 1),
        variant === null
          ? isNull(promptTemplates.variant)
          : eq(promptTemplates.variant, variant),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    console.log(
      `  [SKIP] ${slot}${variant ? `/${variant}` : ''} v1 already exists (id=${existing[0].id})`,
    );
    return existing[0].id;
  }

  const [inserted] = await db
    .insert(promptTemplates)
    .values({
      slot,
      cardType: null,
      variant,
      name,
      version: 1,
      templateText,
      variables,
      notes,
      createdBy: 'seed-v1',
    })
    .returning();

  console.log(
    `  [INSERT] ${slot}${variant ? `/${variant}` : ''} v1 (id=${inserted.id}, ${templateText.length} chars)`,
  );
  return inserted.id;
}

async function activate(
  slot: string,
  variant: PromptVariant | null,
  templateId: number,
): Promise<void> {
  const v = variant ?? ''; // "" sentinel = default pointer
  const existing = await db
    .select()
    .from(promptActive)
    .where(
      and(
        eq(promptActive.slot, slot),
        eq(promptActive.cardType, ''),
        eq(promptActive.variant, v),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(promptActive)
      .set({ activeTemplateId: templateId, updatedAt: new Date(), updatedBy: 'seed-v1' })
      .where(
        and(
          eq(promptActive.slot, slot),
          eq(promptActive.cardType, ''),
          eq(promptActive.variant, v),
        ),
      );
    console.log(
      `  [ACTIVATE] ${slot}${variant ? `/${variant}` : ''} → template ${templateId} (updated)`,
    );
  } else {
    await db.insert(promptActive).values({
      slot,
      cardType: '',
      variant: v,
      activeTemplateId: templateId,
      updatedBy: 'seed-v1',
    });
    console.log(
      `  [ACTIVATE] ${slot}${variant ? `/${variant}` : ''} → template ${templateId} (new)`,
    );
  }
}

async function main(): Promise<void> {
  console.log('[SEED] Prompt Lab v1 seeding starting...');

  // front_scene — three variant-specific templates. Each gets its own
  // prompt_templates row and its own prompt_active pointer.
  const onePersonId = await upsertVersion1(
    PROMPT_SLOTS.FRONT_SCENE,
    PROMPT_VARIANTS.ONE_PERSON,
    'Front scene — one person v1',
    FRONT_SCENE_ONE_PERSON_V1,
    FRONT_SCENE_VARS,
    'Split from monolith; one-person preamble over shared scaffold.',
  );
  await activate(PROMPT_SLOTS.FRONT_SCENE, PROMPT_VARIANTS.ONE_PERSON, onePersonId);

  const multiIndividualId = await upsertVersion1(
    PROMPT_SLOTS.FRONT_SCENE,
    PROMPT_VARIANTS.MULTI_INDIVIDUAL,
    'Front scene — multi individual v1',
    FRONT_SCENE_MULTI_INDIVIDUAL_V1,
    FRONT_SCENE_VARS,
    'Split from monolith; promoted multi-person directive above scaffold.',
  );
  await activate(
    PROMPT_SLOTS.FRONT_SCENE,
    PROMPT_VARIANTS.MULTI_INDIVIDUAL,
    multiIndividualId,
  );

  const groupId = await upsertVersion1(
    PROMPT_SLOTS.FRONT_SCENE,
    PROMPT_VARIANTS.GROUP,
    'Front scene — group photo v1',
    FRONT_SCENE_GROUP_V1,
    FRONT_SCENE_VARS,
    'Split from monolith; group-photo preamble over shared scaffold.',
  );
  await activate(PROMPT_SLOTS.FRONT_SCENE, PROMPT_VARIANTS.GROUP, groupId);

  // inside_write — variant-less (no split today)
  const insideId = await upsertVersion1(
    PROMPT_SLOTS.INSIDE_WRITE,
    null,
    'Inside card v1 (baseline)',
    INSIDE_V1,
    INSIDE_VARS,
    'Initial baseline migrated from shared/prompts.ts buildInsidePrompt()',
  );
  await activate(PROMPT_SLOTS.INSIDE_WRITE, null, insideId);

  console.log('[SEED] Done.');
  process.exit(0);
}

// Only run main() when invoked directly (e.g. `npx tsx server/prompts/seed-v1.ts`).
// Importing from this file to reuse the exported template constants must not
// trigger a seed run.
const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error('[SEED] Failed:', err);
    process.exit(1);
  });
}
