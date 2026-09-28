// server/prompts/seed-front-scene-one-person-v6-condensed.ts
//
// V6 = a SUPER-CONDENSED challenger to the validated v5 (id=22). Same
// behaviour, ~21.5k → ~4.5k chars. Restructured around "one goal, four
// rules" so the goal is stated up front (models comply better when told
// the why, not just the constraint). Every VALIDATED guard from v5 is
// preserved; what's cut is repetition, redundant emphasis, and the long
// example lists.
//
// Purpose (founder, 2026-05-27): test whether a much shorter prompt (a)
// speeds up generation and (b) holds quality. NOTE: generation time is
// dominated by image synthesis, not prompt length — the speed win may be
// small. The likelier upside is FOCUS (less dilution) + maintainability.
//
// Seeds as one_person version=6, PREVIEW-ONLY (live stays on v5/id=22).
// Validate against the same test matrix before activating. Activate:
//   npx tsx server/prompts/seed-front-scene-one-person-v6-condensed.ts --activate

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

const SOURCE_ID = 22; // v5 — for reusing the `variables` field

const CONDENSED = `{{#if hasMultiplePhotos}}REFERENCE PHOTOS: {{photoCount}} photos of THE SAME PERSON from different angles — use them together for a more accurate likeness.

{{/if}}You are creating a greeting-card image. The single goal: the person looks GENUINELY PRESENT in a real, lived moment — never a head pasted onto a backdrop. Four rules serve that one goal.

1. IDENTITY != EXPRESSION (the #1 priority). The reference photo gives you the person's IDENTITY only — bone structure, feature shapes, skin, hair, distinctive marks. It does NOT give you their expression. Build a FRESH expression for this scene's mood; it MUST visibly differ from the photo. A calm, closed-mouth selfie in a joyful scene becomes an open, animated smile or laugh — eyes alight, brows lifted. A face that looks unchanged from the source is the clearest sign of a pasted-in cutout, and the most common failure of all. Keep the identity; rebuild the expression, every time.{{#if noCharacterAnchor}} Match precisely: bone structure, eye shape/spacing/colour, natural brow shape, nose, lip fullness + mouth width, skin tone + marks, hair colour/texture/hairline. Do NOT copy the expression-defining features (mouth-corner position, eyelid openness, brow position) — those are reborn for the scene.{{/if}}

2. ENGAGED, NEVER POSED. The person is absorbed in the moment, not presenting themselves to a camera. Discard the photo's pose, head tilt, framing and eye-contact entirely — the scene sets the body and the gaze. For active scenes (DJing, marathon, dancing) the action is obvious. For vibe-only scenes ("living it up", "looking joyful") the feeling shows through ENGAGEMENT, which may be ACTIVE (mid-laugh raising a glass, mid-stride through the surf) OR STILL (leaning on the rail watching the sunset, relaxing with a drink) — stillness is welcome and often more premium. The ONE thing always wrong is posing FOR THE CAMERA — squared to the lens, eye contact with the viewer, "having my photo taken" body language. Never a selfie (no arm reaching to the lens, no close-up self-framing). Keep eyes open and engaged with the moment. Camera engagement is fine ONLY when the action incidentally produces it (a glance up from cooking, a trophy roar).

3. POPULATE HONESTLY. The world should feel alive — but only with people the model can legitimately invent.
   - PUBLIC venues (beach, bar, park, street, festival, market, restaurant, gym, station) MUST be populated with anonymous strangers sharing the space. An empty public scene reads as a cutout.
   - PRIVATE / intimate scenes (their own home, own rooftop, an intimate dinner, blowing out candles at home) are SOLO + atmosphere only (candles, fairy lights, decor, weather, props). NEVER invent the person's social circle — friends, family, partner, kids, wedding party. A private moment ringed by strangers (e.g. birthday candles at home surrounded by non-family) is WORSE than empty: it betrays the meaning of the moment and the viewer feels it instantly. When private, the honest answer is always solo + atmosphere.

4. ANATOMY. Keep the body anatomically complete and plausibly scaled to the scene; no limbs clipping through objects when enclosed (vehicles, furniture, buildings).

SCENE DESCRIPTION: {{scenePrompt}}

COMPOSITION: a perfectly SQUARE 1024x1024 full-bleed image, no borders. Full-body or three-quarter framing that showcases the environment around the person.

{{#if userClothing}}CLOTHING: dress the character exactly as described: {{userClothing}}{{/if}}{{#if noClothing}}CLOTHING: scene-appropriate clothing, changed completely from the reference to fit the setting; keep the face only.{{/if}}

{{#if userArtStyle}}ART STYLE: render the entire image in this style with high quality and visual cohesion: {{userArtStyle}}{{/if}}{{#if aiDecideStyle}}ART STYLE: choose the style that best fits the scene's mood (watercolour, oil, digital illustration, storybook, anime, etc.).{{/if}}

{{#if includeText}}{{#if isSceneIntegrated}}TEXT: integrate EXACTLY and ONLY "{{cardText}}" as a large, dominant, naturally-part-of-the-scene element (at least 25% of the image) — carved in sand, on a sign or banner, painted, etched, or formed by lights or natural elements — never overlaid or floating. Instantly readable; appears ONCE, in ONE place, every word exactly once.{{/if}}{{#if isMoviePoster}}TEXT: render EXACTLY and ONLY "{{cardText}}" as large, bold movie-poster typography behind and around the character, one cohesive block, once.{{/if}} CHARACTER-TEXT SEPARATION: the text must NOT touch, overlap, fuse with or obscure the character — the full silhouette stays clear and unbroken, feet visible, with clear space around them; the character is in front of or beside the text, never merged. NO other text, letters, numbers, signs, logos, captions, or foreign-language versions anywhere. Render the card text in the exact characters given — no translation or transliteration. All letters legible, none cropped.{{/if}}

High-quality artistic rendering, professional artwork.`;

const ACTIVATE = process.argv.includes('--activate');

async function main(): Promise<void> {
  console.log(
    `[SEED] one_person → V6 CONDENSED ${ACTIVATE ? '(WILL ACTIVATE)' : '(preview only — live stays on v5/id=22)'} — ${CONDENSED.length} chars`,
  );

  const srcRows = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, SOURCE_ID))
    .limit(1);
  const src = srcRows[0];
  if (!src) throw new Error(`v6 seed: source v5 id=${SOURCE_ID} not found`);

  const name = 'Front scene — one person v6 (super-condensed challenger)';
  const notes = `V6: ~${CONDENSED.length}-char condense of v5 (was ~21.5k). Same validated guards (expression-reborn, engaged-not-posed, anti-selfie, honest public/private population + candle red-flag, discard-pose, identity, text-separation), restructured as "one goal, four rules". Preview-only; A/B vs v5 for speed + quality.`;

  const existing = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.slot, PROMPT_SLOTS.FRONT_SCENE),
        eq(promptTemplates.variant, PROMPT_VARIANTS.ONE_PERSON),
        eq(promptTemplates.version, 6),
      ),
    )
    .limit(1);

  let templateId: number;
  if (existing.length > 0) {
    templateId = existing[0].id;
    await db
      .update(promptTemplates)
      .set({ templateText: CONDENSED, name, notes })
      .where(eq(promptTemplates.id, templateId));
    console.log(`  [REWRITE] one_person v6 (id=${templateId}, ${CONDENSED.length} chars)`);
  } else {
    const [inserted] = await db
      .insert(promptTemplates)
      .values({
        slot: PROMPT_SLOTS.FRONT_SCENE,
        variant: PROMPT_VARIANTS.ONE_PERSON,
        cardType: null,
        name,
        version: 6,
        templateText: CONDENSED,
        variables: src.variables,
        notes,
        createdBy: 'seed-front-scene-one-person-v6-condensed',
      })
      .returning();
    templateId = inserted.id;
    console.log(`  [INSERT] one_person v6 (id=${templateId}, ${CONDENSED.length} chars)`);
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
      `\n[SEED] V6 inserted as id=${templateId} but NOT active. Select v6 in the Prompt Lab to A/B against v5.`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[SEED] V6 failed:', err);
  process.exit(1);
});
