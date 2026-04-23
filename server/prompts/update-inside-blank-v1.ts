// server/prompts/update-inside-blank-v1.ts
//
// In-place rewrite of the active inside_blank template (v1, id=4). The
// previous text had two fatal defects:
//
//   1. It explicitly ALLOWED "Dear..." and "With love," as decorative
//      accents. The model obeyed — rendering those placeholders on the
//      central writing area where customers are meant to handwrite.
//   2. It didn't explicitly forbid scene elements from the front
//      reference (people, furniture, the card's setting). Inside
//      generation uses the front card as an image-to-image reference,
//      so the model was bleeding the front scene into the inside's
//      decorative zones (a man at a table, a "HAPPY" sign, etc.).
//
// New prompt is absolutist on both:
//   - ZERO text anywhere — no salutation, no signoff, no placeholder.
//   - ZERO scene elements — front reference is ONLY for colour palette
//     + rendering style inheritance, never for content.
//
// Idempotent. Run:
//   npx tsx server/prompts/update-inside-blank-v1.ts

import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { promptTemplates, PROMPT_SLOTS } from '@shared/schema';
import { invalidatePromptCache } from './resolver';

const INSIDE_BLANK_V1_UPDATED = `Design the INSIDE of a premium greeting card with a COMPLETELY BLANK central writing area for the recipient to handwrite in. Print-ready card interior, full bleed, no borders or edges visible, square 1:1 aspect ratio, no mockup framing, no drop shadows on the card itself.

ABSOLUTE RULES — these override any other interpretation:

1. ZERO TEXT ANYWHERE on the entire card.
   - NO "Dear..." NO "With love," NO salutations, NO signoffs, NO placeholders.
   - NO words, letters, numbers, characters, glyphs in any language or script.
   - NO signage, labels, captions, watermarks, or written content.
   - NO suggested writing lines, dotted lines, or guides indicating where to write.
   - If tempted to add even one character, do not. Total emptiness is the feature.

2. ZERO SCENE ELEMENTS from the front reference image.
   - Do NOT render people, characters, figures, animals, or subjects of any kind.
   - Do NOT render buildings, rooms, furniture, tables, food, drinks, candles, backgrounds, or any environment from the front.
   - Do NOT continue or echo the front card's scene, story, or composition.
   - The reference image you received is ONLY for palette + style inheritance. Treat it as a colour-and-texture sample, not as content to carry forward.
   - If any element of the front threatens to appear on the inside, do not include it.

3. CLEAN CENTRAL WRITING AREA — the largest zone of the card (at least 75% of the canvas height):
   - Smooth cream or very warm off-white paper (approx #fdfaf2 or similar). Subtle paper grain is fine. No texture stronger than that.
   - COMPLETELY EMPTY. No text, no drawings, no doodles, no patterns, no watermarks, no imagery, no tint washes.
   - Just clean paper ready to be written on by hand.

4. SUBTLE DECORATIVE BORDER only — narrow top band (max 10% of canvas height) and narrow bottom band (max 10% of canvas height):
   - Small tasteful motifs appropriate to the occasion: sparse florals, scattered confetti, stars, a geometric flourish, a thin ribbon trim, a delicate leaf arrangement.
   - Keep motifs BORDER-LIKE — thin, airy, concentrated at the extreme top and bottom edges. The border should read as trim, not as scene.
   - Do NOT fill the top/bottom bands with dense illustration, figures, or scene fragments.
   - The border's single job: visually echo the front card's palette + rendering style. Nothing more.

{{#if artStyle}}STYLE PALETTE (borders only): Use the same colour palette and rendering style as the front card ({{artStyle}}) in the top and bottom decorative bands. The central writing zone stays clean cream paper regardless of front style.{{/if}}{{#if noArtStyle}}STYLE PALETTE (borders only): Use the same colour palette and rendering style as the front card in the top and bottom decorative bands. The central writing zone stays clean cream paper regardless.{{/if}}

OUTPUT REQUIREMENTS:
- Central 80% of canvas is completely empty cream paper.
- Top 10% and bottom 10% carry subtle border decoration in the front's palette.
- Zero text anywhere on the canvas.
- Zero scene elements (people, objects, backgrounds) anywhere on the canvas.
- Print-ready interior artwork only.`;

async function main(): Promise<void> {
  const slot = PROMPT_SLOTS.INSIDE_BLANK;
  console.log(`[UPDATE] ${slot} v1: rewriting for hard-block on text + scene bleed`);

  const existing = await db
    .select()
    .from(promptTemplates)
    .where(and(eq(promptTemplates.slot, slot), eq(promptTemplates.version, 1)))
    .limit(1);

  if (existing.length === 0) {
    console.error(`  [FAIL] ${slot} v1 not found. Run seed-inside-blank-v2 first.`);
    process.exit(1);
  }

  const row = existing[0];
  const prevLen = row.templateText.length;
  const nextLen = INSIDE_BLANK_V1_UPDATED.length;

  await db
    .update(promptTemplates)
    .set({
      templateText: INSIDE_BLANK_V1_UPDATED,
      notes:
        'Hard-block rewrite: zero text (no "Dear..."/"With love,"/placeholders), zero scene elements from front reference (decorative borders only, never scenes).',
    })
    .where(eq(promptTemplates.id, row.id));

  // Flush the resolver cache so the next generation picks up the new
  // text without waiting on the 60s TTL.
  invalidatePromptCache();

  console.log(
    `  [OK] Updated template id=${row.id}: ${prevLen} → ${nextLen} chars`,
  );
  console.log('[UPDATE] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[UPDATE] Failed:', err);
  process.exit(1);
});
