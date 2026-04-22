// server/prompts/seed-v1.ts
//
// Seeds version 1 of the prompt_templates table from the hardcoded prompts
// in shared/prompts.ts. Run once after `db:push` has created the tables:
//
//   npx tsx server/prompts/seed-v1.ts
//
// Idempotent: if version 1 already exists for a slot, it is left alone.
// Activates each v1 template as the default for its slot (cardType = "").
//
// The templates here are carefully crafted to produce BYTE-IDENTICAL output
// to the hardcoded buildScenePrompt / buildInsidePrompt functions when
// rendered with the same inputs. If you change either this file or
// shared/prompts.ts you must update the other or re-snapshot.

import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  promptTemplates,
  promptActive,
  PROMPT_SLOTS,
  type PromptVariable,
} from '@shared/schema';

// ─── front_scene v1 template ─────────────────────────────────────────────────
// Mirrors buildScenePrompt() from shared/prompts.ts. The clothing + style
// sections are inlined via {{#if}} blocks to preserve the original branching.

const FRONT_SCENE_V1 = `MANDATORY: Create a perfectly SQUARE 1024x1024 composition with equal width and height - NOT portrait, NOT landscape. Full bleed square design with no borders, fill entire square frame. ABSOLUTE PRIORITY: FACIAL ACCURACY FIRST - Before applying any artistic style, the EXACT facial likeness from the reference photo(s) must be preserved with absolute precision in the new scene BUT with new expressions to match the new scene. Ensure that the characters always look happy to be a part of the new scene in a natural way to fit the new scene.

{{#if isOnePerson}}{{#if hasMultiplePhotos}}REFERENCE PHOTO CONTEXT: You have been given {{photoCount}} photos of THE SAME PERSON from different angles. These are NOT different people — they are all the same individual. Use ALL photos together to build a comprehensive understanding of this person's facial structure, features, and proportions. The multiple angles give you more identity signal — use it to produce a more accurate likeness than any single photo could achieve.{{/if}}{{/if}}{{#if isMultiIndividual}}REFERENCE PHOTO CONTEXT: You have been given {{photoCount}} SEPARATE reference photos. EACH photo shows a DIFFERENT individual person. All {{photoCount}} people MUST appear together in the final scene — omit no one. For each reference photo: preserve that individual's DISTINCT facial identity — their exact face shape, features, hairstyle, and complexion. Do NOT blend, average, or merge features between the different people. Each person should be rendered as their own distinct self from their own reference photo. Place them together naturally in the scene described below, interacting as the scene calls for.{{/if}}{{#if isGroup}}REFERENCE PHOTO CONTEXT: The reference photo contains MULTIPLE DIFFERENT PEOPLE. You MUST preserve each person's DISTINCT facial identity — do NOT blend or average facial features between subjects. Each person must remain individually recognisable in the output. Pay special attention to distinguishing features that differentiate each person (skin tone differences, face shapes, hair styles, facial hair, etc.).{{/if}}

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

SCENE DESCRIPTION: {{scenePrompt}}

{{#if userClothing}}CLOTHING REQUIREMENTS: The scene description includes specific clothing requirements. Dress the character(s) exactly as described: {{userClothing}}{{/if}}{{#if noClothing}}CLOTHING REQUIREMENTS: Choose scene-appropriate clothing that fits the new environment and activity. Change the clothing completely from the reference photo to match the scenario while maintaining identical faces only.{{/if}}

{{#if userArtStyle}}ARTISTIC STYLE APPLICATION: Apply the user-specified artistic style: {{userArtStyle}}. Render the entire image consistently in this style while maintaining high artistic quality and visual cohesion.{{/if}}{{#if aiDecideStyle}}ARTISTIC STYLE APPLICATION: DYNAMIC STYLE SELECTION: Analyze the scene description and intelligently choose the most appropriate artistic style that best complements the mood, atmosphere, setting, and emotional tone of this specific scene. Consider styles such as watercolor painting, oil painting, digital illustration, fantasy art, storybook illustration, impressionistic, contemporary art, realistic photography style, vintage illustration, comic book style, minimalist design, Renaissance painting, anime/manga style, or art nouveau.{{/if}}

{{#if isMoviePoster}}TYPOGRAPHY LAYOUT (MOVIE POSTER STYLE): Render the card text as LARGE, bold, stylised typography positioned BEHIND and AROUND the character — like a movie poster or comic book cover. The character should be in the foreground, with the text as a massive typographic backdrop filling the background. The text should be the largest element in the composition after the character themselves. Use bold, impactful lettering with style-appropriate treatment: neon glow, metallic sheen, dramatic lighting on the letters, or bold graphic colours. The text should frame and complement the character, creating a dynamic poster-like composition. Place ALL words of the text as ONE cohesive typographic block — do NOT split words across different areas of the image. CRITICAL: The text appears ONCE and ONLY ONCE. Do NOT duplicate or repeat any words. Every word must appear exactly one time in one location.{{/if}}{{#if isSceneIntegrated}}TYPOGRAPHY INTEGRATION (LARGE, DOMINANT, AND NATURALLY PART OF THE SCENE): The card text is the single most important visual element after the character. It MUST occupy at least 25-30% of the image area and be instantly readable at arm's length. HOWEVER, the text must feel like a natural, organic part of the scene — NOT overlaid, NOT floating, NOT pasted on top. This is a key creative feature: the text should look like it belongs in the physical world of the scene. Integration methods: carved into sand with deep, wide grooves; painted in large brushstrokes on a wall or surface; displayed on a prominent sign, banner, or chalkboard within the scene; formed by large natural elements (clouds, flower arrangements, string lights, neon signs); etched into stone or wood as part of the environment; written in frost, snow, or water. The text must be LARGE and BOLD enough to read instantly, while simultaneously feeling like the scene was built around it. Think: a massive "Happy Birthday" carved into a beach at sunset — not small text hidden in a corner. NEVER hide text in small details, embed it subtly into architecture, or make it compete with scene elements for attention. The text must POP within the first second of viewing AND feel like it was always part of this world. CRITICAL: Place ALL text as ONE cohesive block in ONE location — do NOT split words across different areas or repeat any words. Every word appears exactly ONCE.{{/if}}{{#if includeText}}. STRICT TEXT RESTRICTION: Add EXACTLY and ONLY the text "{{cardText}}" - ABSOLUTELY NO OTHER TEXT, WORDS, LETTERS, NUMBERS, SIGNS, LABELS, OR WRITING of any kind should appear anywhere in the image. {{#if isMoviePoster}}Render the text as LARGE, bold, stylised typography positioned behind and around the character as described in the typography layout section above. The text should be a dramatic typographic backdrop, NOT integrated into the physical scene.{{/if}}{{#if isSceneIntegrated}}Do NOT overlay text on top of the image. Instead, naturally integrate ONLY this specific text into the scene as part of the artistic composition — carved, painted, displayed on signs, or formed by natural elements as described in the typography layout section above.{{/if}} FORBIDDEN: Do not add any background text, signage, labels, captions, watermarks, logos, brand names, location names, or any other written content beyond the specified card text. CRITICAL: All letters of the text should be legible within the square frame of the artwork. CRITICAL: DO NOT allow the text to be cropped off the screen in any way; all letters in the text MUST be readable with no cropping of the text whatsoever. CRITICAL: The text appears ONCE and ONLY ONCE — do NOT duplicate or repeat any words.{{/if}}. High-quality artistic rendering, professional artwork.`;

const FRONT_SCENE_VARS: PromptVariable[] = [
  { name: 'scenePrompt', type: 'string', required: true, description: "User's description of the scene" },
  { name: 'userArtStyle', type: 'string', required: false, description: "Specific art style, or empty for 'AI decide'" },
  { name: 'userClothing', type: 'string', required: false, description: 'Optional clothing requirements' },
  { name: 'includeText', type: 'boolean', required: false, description: 'Whether to render cardText into the scene' },
  { name: 'cardText', type: 'string', required: false, description: 'The exact text to render, e.g. "Happy Birthday Sarah"' },
];

// ─── inside v1 template ──────────────────────────────────────────────────────
// Mirrors buildInsidePrompt() from shared/prompts.ts. Note the original
// function joins its parts with ", " — we inline that separator here.

const INSIDE_V1 = `Square 1:1 aspect ratio interior design, full bleed with no borders or edges visible, DO NOT include any people, characters, or figures from the front card, {{#if hasStructuredGreeting}}"{{insideText}}" prominently displayed as the main focus with proper greeting card typography hierarchy, GREETING CARD TYPOGRAPHY HIERARCHY: Format the text as a traditional greeting card with proper spacing and hierarchy:{{#if hasDear}} - Greeting "{{dear}}" should appear at the top in elegant, smaller font (14-16pt equivalent){{/if}}{{#if hasMessage}} - Main message "{{message}}" should be prominently displayed in the center with larger, readable font (18-24pt equivalent) and generous line spacing{{/if}}{{#if hasFrom}} - Signature "{{from}}" should be positioned at the bottom in smaller, elegant font (12-14pt equivalent), typically bottom-right or center-bottom{{/if}}. Use traditional greeting card proportions with proper margins and spacing between sections. Ensure clear visual hierarchy and professional greeting card appearance.{{/if}}{{#if noStructuredGreeting}}"{{insideText}}" prominently displayed as the main focus{{/if}}, {{#if artStyle}}Apply the same artistic style as the front card: {{artStyle}}. Maintain visual consistency with the same style treatment, color palette, and visual aesthetic.{{/if}}{{#if noArtStyle}}Use the same artistic style that was intelligently chosen for the front card to maintain visual consistency. Apply the same style treatment, color palette, and visual aesthetic as the front card.{{/if}}, Make subtle reference to the theme on the front of the card, but ensure any reference is kept very subtle so that the main focus is the text which is always to be readable, STRICT TEXT RESTRICTION: Include EXACTLY and ONLY the text "{{insideText}}" - ABSOLUTELY NO OTHER TEXT, WORDS, LETTERS, NUMBERS, SIGNS, LABELS, OR WRITING of any kind should appear anywhere in the image. FORBIDDEN: Do not add any background text, signage, labels, captions, watermarks, logos, brand names, decorative text, or any other written content. TYPOGRAPHY: Integrate ONLY the specified text naturally into the design as an organic part of the composition., text prominently displayed and clearly readable, minimal decorative elements that complement without overwhelming the message, print-ready artwork, no mockup visible`;

const INSIDE_VARS: PromptVariable[] = [
  { name: 'insideText', type: 'string', required: true, description: 'The full inside card text' },
  { name: 'artStyle', type: 'string', required: false, description: "Specific art style, or empty for 'inherit from front'" },
  { name: 'dear', type: 'string', required: false, description: 'Greeting line (structured card)' },
  { name: 'message', type: 'string', required: false, description: 'Main message (structured card)' },
  { name: 'from', type: 'string', required: false, description: 'Signature line (structured card)' },
];

async function upsertVersion1(
  slot: string,
  name: string,
  templateText: string,
  variables: PromptVariable[],
  notes: string,
): Promise<number> {
  // Check if v1 already exists for (slot, cardType=null)
  const existing = await db
    .select()
    .from(promptTemplates)
    .where(and(eq(promptTemplates.slot, slot), eq(promptTemplates.version, 1)))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  [SKIP] ${slot} v1 already exists (id=${existing[0].id})`);
    return existing[0].id;
  }

  const [inserted] = await db
    .insert(promptTemplates)
    .values({
      slot,
      cardType: null,
      name,
      version: 1,
      templateText,
      variables,
      notes,
      createdBy: 'seed-v1',
    })
    .returning();

  console.log(`  [INSERT] ${slot} v1 (id=${inserted.id}, ${templateText.length} chars)`);
  return inserted.id;
}

async function activate(slot: string, templateId: number): Promise<void> {
  // cardType = "" is the default-pointer sentinel (see shared/models/prompts.ts)
  const existing = await db
    .select()
    .from(promptActive)
    .where(and(eq(promptActive.slot, slot), eq(promptActive.cardType, '')))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(promptActive)
      .set({ activeTemplateId: templateId, updatedAt: new Date(), updatedBy: 'seed-v1' })
      .where(and(eq(promptActive.slot, slot), eq(promptActive.cardType, '')));
    console.log(`  [ACTIVATE] ${slot} → template ${templateId} (updated existing pointer)`);
  } else {
    await db.insert(promptActive).values({
      slot,
      cardType: '',
      activeTemplateId: templateId,
      updatedBy: 'seed-v1',
    });
    console.log(`  [ACTIVATE] ${slot} → template ${templateId} (new pointer)`);
  }
}

async function main(): Promise<void> {
  console.log('[SEED] Prompt Lab v1 seeding starting...');

  const frontSceneId = await upsertVersion1(
    PROMPT_SLOTS.FRONT_SCENE,
    'Front scene v1 (baseline)',
    FRONT_SCENE_V1,
    FRONT_SCENE_VARS,
    'Initial baseline migrated from shared/prompts.ts buildScenePrompt()',
  );
  await activate(PROMPT_SLOTS.FRONT_SCENE, frontSceneId);

  const insideId = await upsertVersion1(
    PROMPT_SLOTS.INSIDE_WRITE,
    'Inside card v1 (baseline)',
    INSIDE_V1,
    INSIDE_VARS,
    'Initial baseline migrated from shared/prompts.ts buildInsidePrompt()',
  );
  await activate(PROMPT_SLOTS.INSIDE_WRITE, insideId);

  console.log('[SEED] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[SEED] Failed:', err);
  process.exit(1);
});
