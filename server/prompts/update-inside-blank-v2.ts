// server/prompts/update-inside-blank-v2.ts
//
// Second in-place rewrite of the active inside_blank template (v1).
//
// Why this exists:
//   The first rewrite (update-inside-blank-v1.ts, 2026-04-XX) fixed
//   two real bugs — text bleeding onto the writing area, and the
//   front scene reproducing wholesale on the inside. But it
//   overcorrected. The "ZERO scene elements" rule killed the visual
//   continuity Kevin wants for the handover-in-person experience:
//   the inside should feel like the SAME card as the front, just
//   with breathing room for handwriting. Picture a shop-bought
//   greeting card — the inside isn't a generic decorated border, it's
//   a softer, airier echo of the front's world.
//
// Kevin's repro 2026-05-13:
//   Generated a card with `inside: 'blank'`. The inside came back
//   "generic and nothing like the front" — confirming the v1-rewrite
//   prompt had stripped continuity entirely.
//
// What this rewrite changes vs the v1 rewrite:
//   • KEEPS the absolute "ZERO TEXT" rule. That worked — leave it.
//   • REPLACES "ZERO scene elements" with explicit guidance to
//     borrow motifs (objects, patterns, palette) from the front
//     reference and redistribute them as airy decoration around a
//     clear central writing zone. The model is told NOT to redraw
//     the primary subject of the front (the person, the cake at
//     full size, the main composition) — but smaller motifs, scene
//     elements abstracted into pattern, palette echoes are all
//     desired.
//   • RELAXES the rigid "top 10% / bottom 10%" border bands. The
//     decoration can frame, drift inward at the corners, or wash
//     softly across the canvas — provided a clearly-writable zone
//     exists in the middle. Models do this well when asked for
//     "shop-bought greeting card interior" framing.
//
// Idempotent. Run:
//   npx tsx server/prompts/update-inside-blank-v2.ts

import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { promptTemplates, PROMPT_SLOTS } from '@shared/schema';
import { invalidatePromptCache } from './resolver';

const INSIDE_BLANK_V1_REWRITE_2 = `Design the INSIDE of a premium greeting card with a clear, writable central area for the recipient to handwrite their own message. Print-ready card interior, full bleed, no borders or edges visible, square 1:1 aspect ratio, no mockup framing, no drop shadows on the card itself.

REFERENCE FRAMING:
Think of the inside of a thoughtfully-designed shop-bought greeting card — the kind a person buys to handwrite a personal message in. The inside is visibly part of the SAME card as the front: same world, same palette, same style — just opened up and quieter. It is NOT a generic decorated border. It is NOT a separate piece of artwork. It is the second page of one greeting card.

ABSOLUTE RULES — these override any other interpretation:

1. ZERO TEXT ANYWHERE on the entire card.
   - NO "Dear..." NO "With love," NO salutations, NO signoffs, NO placeholders.
   - NO words, letters, numbers, characters, glyphs in any language or script.
   - NO signage, labels, captions, watermarks, or written content.
   - NO suggested writing lines, dotted lines, or guides indicating where to write.
   - If tempted to add even one character, do not. Total emptiness of text is the feature.

2. CLEAR CENTRAL WRITING ZONE — large enough that someone can comfortably handwrite a personal message of three or four lines:
   - Soft, warm cream or off-white paper feel (around #fdfaf2). Subtle paper grain is fine.
   - The writing zone may carry very faint atmospheric colour — a soft watercolour wash in the front's palette, a subtle gradient — but it must NOT compete with handwritten ink on top of it. A medium-tone pen stroke must read cleanly across this area.
   - NO dense imagery, NO repeating patterns, NO illustrations, NO motifs INSIDE this writing zone. Just clean (or near-clean) paper.

3. CONTINUITY WITH THE FRONT — borrow visually from the reference image, but redistribute, don't repeat:
   - DO carry the front's COLOUR PALETTE through the entire inside.
   - DO carry the front's RENDERING STYLE (illustration style, brushwork, line weight, lighting feel).
   - DO borrow MOTIFS from the front and scatter them as airy decoration around the writing zone — for example, if the front features a celebration, smaller versions of confetti / petals / leaves / stars / sparkles drawn from the same scene can drift around the edges and into the corners.
   - DO let the decoration breathe — sparse, scattered, framing — rather than dense or busy.
   - DO NOT reproduce the front's primary subject at scale. If the front shows a person, do NOT draw that person again on the inside. If the front shows a cake, do NOT draw the same cake. Subjects of the front belong to the front.
   - DO NOT redraw the front's specific scene composition (the table, the room, the setting). The inside is a softer, more abstract echo — palette and motif only.
   - DO NOT include any people, faces, characters, or figures on the inside. Continuity is via colour, style, and abstracted decorative motifs only.

4. LAYOUT FREEDOM:
   - The decoration can frame the writing zone like a wreath, drift inward from the corners, wash softly across the top and bottom, or flow as a gentle vignette — whatever reads as a single cohesive interior page.
   - Do NOT confine decoration to rigid top and bottom bands. The result should feel composed, not slotted.
   - The single test: does the inside, viewed alongside the front, read as the SAME greeting card?

{{#if artStyle}}STYLE: Apply the same artistic style as the front card — {{artStyle}} — to all decorative elements. The writing zone stays clean cream paper regardless of the chosen style.{{/if}}{{#if noArtStyle}}STYLE: Match the artistic style and colour palette of the front card across all decorative elements. The writing zone stays clean cream paper regardless of the chosen style.{{/if}}

OUTPUT REQUIREMENTS:
- Visibly continuous with the front card in palette, style, and decorative motifs.
- A clear writable area in the middle of the canvas — generous, low-contrast, ready to receive handwriting.
- Zero text anywhere on the canvas.
- No people, no faces, no characters, no figures, no full-scene reproduction.
- Print-ready interior artwork only — no mockup framing, no drop shadows on the card itself.`;

async function main(): Promise<void> {
  const slot = PROMPT_SLOTS.INSIDE_BLANK;
  console.log(
    `[UPDATE] ${slot} v1: rewriting for visual continuity with front (motifs + palette + style, no text, no full-scene repro)`,
  );

  const existing = await db
    .select()
    .from(promptTemplates)
    .where(and(eq(promptTemplates.slot, slot), eq(promptTemplates.version, 1)))
    .limit(1);

  if (existing.length === 0) {
    console.error(
      `  [FAIL] ${slot} v1 not found. Run seed-inside-blank-v2 first.`,
    );
    process.exit(1);
  }

  const row = existing[0];
  const prevLen = row.templateText.length;
  const nextLen = INSIDE_BLANK_V1_REWRITE_2.length;

  await db
    .update(promptTemplates)
    .set({
      templateText: INSIDE_BLANK_V1_REWRITE_2,
      notes:
        'Continuity rewrite: keeps zero-text rule, restores visual continuity with front (palette + style + redistributed motifs), forbids only the front\'s primary subject + figures + full-scene reproduction. Replaces the over-aggressive "zero scene elements" rule that produced generic-feeling insides.',
    })
    .where(eq(promptTemplates.id, row.id));

  // Flush the resolver cache so the next generation picks up the new
  // text without waiting on the 60s TTL.
  invalidatePromptCache();

  console.log(
    `  [OK] Updated template id=${row.id}: ${prevLen} → ${nextLen} chars`,
  );
  console.log(
    '[UPDATE] Done. Next blank-inside generation uses the new prompt.',
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('[UPDATE] Failed:', err);
  process.exit(1);
});
