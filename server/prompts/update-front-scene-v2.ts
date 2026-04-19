// server/prompts/update-front-scene-v2.ts
//
// In-place update of the active front_scene v2 template. Two changes:
//   1. Strip the hardcoded "SQUARE 1024x1024" opener so the template
//      works at any aspect ratio (the size is set via the API call +
//      server-side override header for non-square test runs).
//   2. Add a CHARACTER-TEXT SEPARATION rule. Without this the model
//      merges the character's body into text elements — most visibly
//      at narrow aspect ratios where person and text compete for
//      vertical space. Baked in via a rule labelled as a prior failure
//      mode, which models empirically pay more attention to.
//
// Run:
//   npx tsx server/prompts/update-front-scene-v2.ts
//
// Idempotent in spirit — re-running just overwrites v2 with the same
// text. No activation change (v2's active-pointer stays wherever it is).

import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { promptTemplates, PROMPT_SLOTS } from '@shared/schema';

const FRONT_SCENE_V2_UPDATED = `Create a full bleed card image, no borders. PRIORITY: facial likeness from the reference photo(s) must be preserved with precision in the new scene, with a NEW expression matching the scene mood.

{{#if isOnePerson}}{{#if hasMultiplePhotos}}These {{photoCount}} photos are the SAME PERSON from different angles. Use all for identity.{{/if}}{{/if}}{{#if isGroup}}The photo contains MULTIPLE PEOPLE. Preserve each person's distinct identity — do NOT blend features.{{/if}}

{{#if noCharacterAnchor}}FACIAL RECREATION: Match the reference photo(s) precisely — same face shape, bone structure, eyes (shape, colour, spacing), nose (bridge, tip, nostrils), mouth (lip fullness, width), skin tone and texture (freckles, moles, lines), hair (colour, texture, hairline). Create a COMPLETELY NEW expression matching the scene — do NOT copy the original expression.{{/if}}

SCENE ENERGY: Even if the scene description mentions only one person, fill the environment with life — background figures enjoying the setting, ambient activity appropriate to the location (other beachgoers, passing boats, street performers, fellow diners), warm atmospheric details (string lights, floating lanterns, drifting confetti, flying birds). The scene should feel alive and populated, never empty or sterile. The uploaded person is the HERO of the scene but they should not look alone in the world.

SCENE: {{scenePrompt}}

{{#if userClothing}}CLOTHING: {{userClothing}}{{/if}}{{#if noClothing}}CLOTHING: Scene-appropriate, completely different from reference photo.{{/if}}

STYLE: {{userArtStyle}}

COMPOSITION: Three-quarter or full body shot, actively participating in the scene. IGNORE the reference photo's pose and framing — create dynamic new positioning that showcases the environment. The character should look naturally immersed in the scene.

CHARACTER-TEXT SEPARATION (CRITICAL — this has failed in previous testing and must be enforced): The character is a distinct figure that must remain anatomically complete and physically SEPARATE from any text element. The text exists IN the scene (carved in sand, on a sign, formed by clouds, painted on walls) but MUST NOT touch, overlap, merge with, fuse into, or obscure the character's body, face, clothing, or feet. The character's full silhouette must be clear and unbroken — feet visible and distinct from ground text, dress uninterrupted by sand letters, body never cropped or blended into text elements. Leave visible clear space around the character. The character stands IN FRONT OF or BESIDE the text, never fused with it. If text is on the ground, the character's feet press into undisturbed ground with the text placed at a clear distance from them.

{{#if isMoviePoster}}TEXT LAYOUT: Render {{cardText}} as LARGE, bold typography positioned BEHIND and AROUND the character like a movie poster. The character is in the foreground, text is a massive typographic backdrop. Bold, impactful lettering with style-appropriate treatment (neon glow, metallic sheen, dramatic lighting). Text appears as ONE cohesive block, ONCE only — no duplicates, no splitting across areas.{{/if}}{{#if isSceneIntegrated}}TEXT LAYOUT: {{cardText}} must occupy 25-30% of the image and be instantly readable. Integrate naturally into the scene — carved in sand, painted on walls, displayed on signs, formed by natural elements (clouds, lights, flowers). Must feel like part of the physical world, not overlaid. Text appears as ONE cohesive block, ONCE only.{{/if}}{{#if includeText}} Add EXACTLY and ONLY {{cardText}} — no other text, signage, labels, watermarks, or writing of any kind. All letters legible and uncropped.{{/if}}`;

async function main(): Promise<void> {
  console.log('[UPDATE] front_scene v2: stripping square hardcoding + adding character-text separation');

  const existing = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.slot, PROMPT_SLOTS.FRONT_SCENE),
        eq(promptTemplates.version, 2),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    console.error('  [FAIL] front_scene v2 not found — nothing to update. Did the seed run?');
    process.exit(1);
  }

  const row = existing[0];
  const prevLen = row.templateText.length;
  const nextLen = FRONT_SCENE_V2_UPDATED.length;

  await db
    .update(promptTemplates)
    .set({ templateText: FRONT_SCENE_V2_UPDATED })
    .where(eq(promptTemplates.id, row.id));

  console.log(`  [OK] updated template id=${row.id}: ${prevLen} → ${nextLen} chars`);
  console.log('[UPDATE] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[UPDATE] Failed:', err);
  process.exit(1);
});
