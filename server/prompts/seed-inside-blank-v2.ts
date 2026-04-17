// server/prompts/seed-inside-blank-v2.ts
//
// Seeds a v2 of the `inside` slot: a "blank-inside" variant that produces
// a decorated card interior with a clean, unadorned central area where
// the user handwrites their own message. The point is to offer customers
// who prefer the handwritten moment (the emotional core of a greeting
// card for many people) a beautifully framed empty page rather than
// AI-generated text.
//
// The template does NOT take an insideText variable — there is no text
// to render. It reuses the same artStyle variable as v1 so the inside
// still visually matches the front.
//
// Run once after Sprint 3 merges:
//   npx tsx server/prompts/seed-inside-blank-v2.ts
//
// Idempotent: skips if v2 already exists. Does NOT activate — the
// active pointer stays on v1 until we decide this is good enough to
// ship. Switch in the Prompt Lab UI ("Versions" picker) to test.

import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  promptTemplates,
  PROMPT_SLOTS,
  type PromptVariable,
} from '@shared/schema';

const INSIDE_BLANK_V2 = `Design the INSIDE of a premium greeting card that the recipient will personally handwrite in. The output is a clean, print-ready card interior — NOT a mockup, NOT a photograph of a card on a surface, just the pure interior artwork, full bleed, no borders or edges visible, square 1:1 aspect ratio.

CRITICAL STRUCTURE — three zones:

1. TOP ZONE (roughly top 15-20% of the card): A small, elegant decorative header — this could be a tasteful floral arrangement, a ribbon motif, a geometric flourish, a scattering of stars, or another decorative element appropriate to the card's occasion and style. Keep it airy and refined. Optionally include a simple handwritten-style salutation "Dear..." in elegant script to hint at where the sender would continue writing, but nothing more than that single word followed by three dots.

2. MIDDLE ZONE (roughly 60-70% of the card — THE LARGEST ZONE): A GENUINELY BLANK, UNADORNED central writing area. This must be:
   - Clean paper texture (warm cream, soft white, or very light cream with a paper grain)
   - NO text whatsoever — no handwritten words, no typed words, no placeholder text, no "your message here", no Lorem Ipsum, nothing
   - NO drawings, no doodles, no decorative flourishes, no patterns, no watermarks
   - JUST a clean empty surface ready to be written on by hand
   - This is the most important part of the card — the sender's handwriting goes here, so it must be completely empty

3. BOTTOM ZONE (roughly bottom 15-20% of the card): A small, tasteful closing flourish or signature decoration. Could be a small motif matching the top, a sign-off like "With love," in faint script followed by empty space for a signature, or a subtle decorative line. Keep it minimal — this zone is subordinate to the top.

{{#if artStyle}}STYLE: Apply the same artistic style as the front card: {{artStyle}}. Maintain visual consistency — same colour palette, same style of decorative elements, same overall mood. The decorative zones (top + bottom) should feel stylistically continuous with the front card.{{/if}}{{#if noArtStyle}}STYLE: Use the same artistic style as the front card for visual consistency. Match its colour palette, decorative style, and overall mood in the top and bottom decorative zones.{{/if}}

CRITICAL REPETITIONS (this is the part models most often get wrong):
- The central writing zone MUST BE EMPTY. No text, no AI-generated handwriting, no placeholder words, no Latin filler, no dedication. It is a blank canvas for the sender's own handwriting.
- Do NOT add "[Your message here]" or "[Write your message]" or any similar instructional text.
- Do NOT draw handwritten lines suggesting where to write — the paper should be unmarked.
- If you feel the urge to add ANY text to the central zone, resist it. The emptiness is the feature.
- The top and bottom decorative zones MAY include brief stylised words ("Dear...", "With love,") but these are optional design accents, not substitutes for the user's message.

OUTPUT: Print-ready artwork only, no mockup framing, no drop shadows on the card itself. The result should look like a photograph of the open interior of a premium greeting card, with a clean empty centre where the sender will handwrite their personal message.`;

const INSIDE_BLANK_VARS: PromptVariable[] = [
  {
    name: 'artStyle',
    type: 'string',
    required: false,
    description: "Specific art style, or empty to inherit the front card's style",
  },
];

async function main(): Promise<void> {
  console.log('[SEED] inside v2 (blank) seeding starting…');

  const slot = PROMPT_SLOTS.INSIDE;
  const version = 2;

  // Idempotency check — bail if v2 already exists.
  const existing = await db
    .select()
    .from(promptTemplates)
    .where(and(eq(promptTemplates.slot, slot), eq(promptTemplates.version, version)))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  [SKIP] ${slot} v${version} already exists (id=${existing[0].id})`);
    process.exit(0);
  }

  const [inserted] = await db
    .insert(promptTemplates)
    .values({
      slot,
      cardType: null,
      name: 'Inside card v2 (blank — user handwrites)',
      version,
      templateText: INSIDE_BLANK_V2,
      variables: INSIDE_BLANK_VARS,
      notes:
        'Generates a decorated card interior with a clean, unadorned central zone for handwriting. Test-only — not activated. Flip in the Prompt Lab Versions picker to compare against v1.',
      createdBy: 'seed-inside-blank-v2',
    })
    .returning();

  console.log(
    `  [INSERT] ${slot} v${version} (id=${inserted.id}, ${INSIDE_BLANK_V2.length} chars)`,
  );
  console.log('[SEED] Done — not activated. Switch to v2 in the Prompt Lab Versions picker to test.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[SEED] Failed:', err);
  process.exit(1);
});
