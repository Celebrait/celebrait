// server/routes/admin-card-lab.ts
//
// CARD LAB — the illustrated-card test bench (Aidan 2026-08-15).
//
// The bet under test: users who don't know what they want give us a
// snapshot (who / occasion / a detail or two) and we deal them THREE
// finished card concepts — gag + artwork in a locked house style — for
// pennies. Thortful has 6,000 illustrators; we have one model and a
// per-customer print run of one.
//
// Two endpoints, mirroring the product's real shape:
//   concepts — ONE LLM call → 3 concepts (the gag is the product;
//              text is nearly free, so bad ideas die before pixels)
//   render   — ONE gpt-image-2 LOW render of a chosen concept's front
//              (~$0.006). The client fires 3 in parallel and reveals
//              them as they land.
//
// Admin-gated lab, not customer-facing. Spend logs slot 'card_lab'
// with cardId null → reads as R&D in the ledger, same as Prompt Lab.
//
// DESIGN DECISIONS BAKED IN (move deliberately, not accidentally):
// - Graceful-degradation ladder: contrast joke (loves vs can't-stand)
//   → single-detail joke → relationship+occasion joke. A thin brief
//   must produce a decent card, NEVER a scolding or a wrongly-specific
//   one — "works for everyone" lives or dies here.
// - No humans in the artwork. Illustrated strangers standing in for
//   real people are uncanny AND blur the photo product's lane.
//   Characterful animals + objects are the Thortful-proven language.
// - Front text ≤ 10 words, inside ≤ 28: inside renders as clean
//   typography (like the main product), so only the FRONT text has to
//   survive in-image rendering, and short lines render clean.
// - Cheeky is opt-in and capped at mild British ("bloody", "daft",
//   "arse") — provider moderation judges the OUTPUT image, so the
//   front stays clean and any edge lives inside.

import type { Express, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { users } from '@shared/schema';
import { openai } from '../utils/shared';
import { getProvider } from '../providers/registry';
import { logGeneration } from '../prompts/generation-log';
import { llmCostCents } from '../prompts/llm-cost';

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const otpUserId = (req as any).session?.otpUserId;
  if (typeof otpUserId !== 'string' || otpUserId.length === 0) {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  const row = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, otpUserId))
    .limit(1);
  if (row[0]?.isAdmin !== true) {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
}

// ── THE HOUSE STYLE — "Celebrait Quirky" ─────────────────────────────
// Direction locked from Aidan's three references (2026-08-15): the
// lemons pattern card ("simply the zest"), the vintage seed-packet
// tomatoes card, the Aperol editorial print. Their shared DNA is the
// style; their three distinct FORMATS are how "varied" stays coherent.
// Object-led, never characters — the earlier animals-in-hats direction
// is dead: quirky-classy means still-life motifs doing visual puns.
const QUIRKY_DNA_BASE = `STYLE DNA — "Celebrait Quirky" v3 (applies to the whole image, always):
A CONTEMPORARY ART PRINT, not a greeting card cliché — the kind of bold flat-illustration piece trending in independent print shops and on gallery walls right now.

COLOUR — DISCIPLINE IS WHAT LOOKS EXPENSIVE:
- Exactly THREE inks, four at the absolute most, plus the ground. Fewer colours used bravely always beats more colours used timidly; a fourth ink has to earn its place.
- THE INKS MUST BE REAL COLOURS. Grey, silver, black and white are NOT inks and do NOT count towards the three — they are what you get when colour is missing. A card carrying three genuine colours reads rich; a card carrying one colour plus two greys reads washed out, and washed out is the failure mode to fear most. METAL IS NOT SILVER: a shaker, a reel, a kettle, a trophy is drawn as a FLAT SHAPE in the palette's own colours, exactly like everything else — never rendered in grey with metallic shading.
- THE GROUND IS USUALLY QUIET. Default to a warm neutral — bone, oat, chalk, clay, greige, putty, soft stone — and let the inks do the shouting against it. A fully saturated ground is allowed, but never a saturated ground AND fluorescent inks together: that is loud, not vibrant.
- ONE ACCENT INK, USED SPARINGLY. Pick the hottest colour in the palette and let it cover LESS THAN 10% of the card — a thin offset sliver behind a shape, one word of the type, a single small object. Held back it sings; spread everywhere it is just noise.
- The SPECIFIC colours are given per card in the PALETTE line below: obey it exactly, it was chosen from the subject's own world.

PRINTED, NOT RENDERED — this is the whole difference between real and AI-looking. Imagine this card was SCREEN-PRINTED BY HAND in 3-4 separate ink passes, and show the evidence of that process IN THE ARTWORK:
- OVERPRINT: where two inks overlap they make a THIRD, darker colour — never a clean digital layer on top. Use those overlaps deliberately; they are part of the palette.
- MISREGISTRATION: one or two colour plates sit a hair off, so a sliver of ink peeks past an edge. Best used DELIBERATELY as a design device — a clean offset edge of the accent ink hugging one side of a shape, like a shadow made of colour. Charming, not sloppy.
- INK BEHAVIOUR: solid areas are NOT perfectly solid — slight mottling, roller texture, denser at the edges of a shape. The paper's tooth interrupts the ink and shows THROUGH it, rather than a grain filter sitting over the top.
- HAND-CUT EDGES: shapes are confident but not vector-perfect — Matisse-cutout wobble, edges a real hand made.
⚠️ EVERY INK-PROCESS EFFECT ABOVE APPLIES TO THE ARTWORK ONLY — NEVER TO THE LETTERING. See TYPOGRAPHY.
ABSOLUTELY NOT: gradients, airbrush, drop shadows, 3D form, glossy highlights, chrome, photographic rendering, or product-shot realism. This applies MOST STRICTLY to cars, gadgets and branded objects — a car on this card is a FLAT SHAPE in 3 inks, never a rendered vehicle with reflections. If a motif is starting to look like a photograph or a 3D model, you have failed.
COMPOSITION: oversized motifs, brave cropping, asymmetry, overlapping objects with real rhythm — NEVER a small object floating centred in empty space, NEVER evenly-spaced clip-art scattered on a background (both are the AI tell).
MOTIFS: __MOTIF_RULE__ Retro-modern garnish welcome in moderation: a checkerboard edge, wavy stripes, a sunburst, abstract blobs.

TYPOGRAPHY — TYPESET, NOT HANDWRITTEN. These cards are won and lost here:
- The words are SET IN A REAL TYPEFACE, cleanly and confidently drawn. Choose one that suits the card: a fat serif with generous ball terminals (Cooper Black / Bookman lineage), a high-contrast display serif, or a bold humanist grotesk. Wobbly hand-lettering, brush-script scrawl and "painted by hand" letterforms are OUT — they read as the AI tell, and they are exactly where lettering goes wrong.
- THE TYPE PRINTS PERFECTLY CLEAN. It is the ONE element with no ink texture, no mottling, no misregistration, no overprint ghosting, no distressing, no faint second pass of the same word, and no stray marks, scribbles, specks or half-formed shapes anywhere near a letter. Every glyph solid, evenly inked, crisply edged. A smudge or squiggle around a word is a failure of the whole card.
- SET IT LIKE A DESIGNER: stack the line into 2-3 short lines, aligned flush on ONE side with a ragged other edge, broken where the SENSE breaks. Line-spacing tight, so the lines read as one block. Never let a long word run out of room and shrink to fit — restack it instead.
- COLOUR AS EMPHASIS: set the whole line in one ink, then flip a SINGLE key word to the accent ink. One word, never two.
- GIVE IT ITS OWN ROOM: the type sits in a clear zone of plain ground. It never overlaps a motif, never has artwork running behind it, never sits on a busy patch. Type and picture are neighbours, not layers.
- ⚠️ SAFE MARGIN — THE MOST COMMON FAILURE: every letter must sit WELL INSIDE the card, with a clear band of ground at least a tenth of the card's width between the type and EVERY edge. Nothing may touch, bleed off or be sliced by the frame — not the top of a capital, not a descender, not the first or last letter of a line. This card gets TRIMMED when it is printed, so type near an edge is type that gets cut off. If the words will not fit inside that margin at the size you want, make them smaller or stack them into more lines. Artwork may run off the edges; TYPE NEVER DOES.
- Every word correctly spelled, every letter fully formed, nothing cropped.
The bar: it should look like a limited-run screen print you'd frame — current, collectible, unmistakably made by a human hand.`;

/** Characters are a three-level opt-in ladder (Aidan 2026-08-15).
 *  Objects can be witty, but only a creature can have an ATTITUDE, and
 *  some subjects — Sunday league, ballroom, a book club — simply ARE
 *  people doing things. The constraint that keeps figures safe is that
 *  they are graphic SHAPES, never portraits: no face means no uncanny
 *  AI tell, no confusion with the photo product's "that's actually
 *  them", and no "is that meant to BE him?" doubt. Recognisable real
 *  people stay banned at every level. */
export type CharacterLevel = 'objects' | 'animals' | 'figures';

const MOTIF_OBJECTS_ONLY =
  'objects, food, drink, botanicals, the kit of a hobby — still-life only: no humans, no faces, no animals, no characters of any kind.';

const MOTIF_WITH_ANIMALS =
  "PRIMARILY objects, food, drink, botanicals, the kit of a hobby. A characterful ANIMAL is PERMITTED but never required — use one only if this subject's own world genuinely contains that animal. Animals are drawn in the same flat hand-illustrated style, never cutesy-greetings-card, never in novelty human costume beyond one deadpan prop. STILL absolutely no humans and no human faces.";

const MOTIF_WITH_FIGURES =
  "PRIMARILY objects, food, drink, botanicals, the kit of a hobby. Animals and human figures are PERMITTED but never required. Where the subject genuinely needs a person present, HUMAN FIGURES AS GRAPHIC SHAPES. Figures are vintage-travel-poster silhouettes, NEVER portraits: shown from behind, cropped at the shoulders, small in the frame, or reduced to flat coloured shapes. Faces are absent or a bare suggestion (never rendered features, never eyes and mouth drawn in detail). A figure is a shape doing an action, not a person being depicted. NEVER a recognisable real individual — living or dead, famous or otherwise.";

export function quirkyDna(level: CharacterLevel = 'objects'): string {
  const rule =
    level === 'figures' ? MOTIF_WITH_FIGURES
    : level === 'animals' ? MOTIF_WITH_ANIMALS
    : MOTIF_OBJECTS_ONLY;
  return QUIRKY_DNA_BASE.replace('__MOTIF_RULE__', rule);
}

export const QUIRKY_FORMATS: Record<string, string> = {
  statement: `COMPOSITION — STATEMENT (MINIMAL): this card is almost EMPTY, and that is its power. THE NEGATIVE SPACE IS THE SUBJECT — at least 60% of the card is untouched ground, and it must feel deliberate, like a gallery wall, never like something is missing. ONE motif, beautifully drawn, ANCHORED: sitting on an implied baseline low in the frame, or held against one edge — never floating dead-centre in the middle of nowhere. ⚠️ BECAUSE THIS CARD IS MOSTLY EMPTY, THE MOTIF IS THE ONLY COLOUR EVENT ON IT — so it must be SATURATED and confident, carrying the palette's strongest ink at full strength. A muted or greyish object on a pale ground makes this card look washed out and unfinished, which is the one way the minimal card fails. Minimal means FEW elements, never WEAK colour. The type takes its own corner, flush-aligned, small and precise, at the opposite end of the card from the motif so the two hold the composition open between them — but kept well inside the safe margin, never crowded against the frame. No pattern, no border, no garnish, no texture-filling: restraint IS the design. Gallery-minimal.`,
  hero: `COMPOSITION — HERO (BALANCED): ONE object drawn HUGE and cropped HARD by the frame edges so it reads as a fragment of something bigger. SCALE IS THE WHOLE IDEA and the crop should feel brave — an object that merely fills the frame has not gone far enough. Confident contour, flat fills, one loose colour-block or swash behind it, calm ground visible around. The type claims the clear band of ground the object leaves, set big enough to hold its own against it. Poster energy, not busy.`,
  pattern: `COMPOSITION — PATTERN (DENSE): the motif repeats bold across the whole card at varied scales, some cropped off the edges — an underlying grid with its rhythm BROKEN DELIBERATELY in one or two places (one motif turned, one scaled up, one in the odd colour) so it never reads as wallpaper. CRUCIALLY, RESERVE A CLEAN AREA FOR THE TYPE: a calm panel, band or generous clearing where the plain ground shows through and the words sit alone. Do NOT thread the lettering through the gaps between motifs — that is how a dense card turns to mush. Rich and full, but organised.`,
  label: `COMPOSITION — LABEL (DENSE): a punchy modern packet/label lockup — one bold simple border framing the card, the motif bunched large in the centre, halftone shading in a single ink. THE TYPE IS THE STRUCTURE: a stacked lockup with a clear hierarchy — one dominant line, one smaller supporting line — sitting in its own reserved band above or below the motif, never printed over it. Craft-beer-label energy, structured-busy.`,
};
/** The INSIDE is a quieter room than the front. Same shop, lower
 *  volume: the words are the hero, the artwork only frames them. The
 *  photo studio's inside_write prompt taught the shape — dear at top,
 *  message centre, signature bottom, never repeat the cover, never a
 *  person — and this is that shape in the Quirky voice. */
export const QUIRKY_INSIDE = `INSIDE OF A GREETING CARD — the text is the hero, the artwork is the frame.
LAYOUT: a calm, generous page. The written message sits in the middle with real breathing room and a clear typographic hierarchy. Illustration is REDUCED to a light frame or a small motif echo — a sprig in one corner, a thin border, a few scattered accents. NEVER a busy pattern, NEVER a large object competing with the words. At least 60% of this page is clean, calm space you could read at a glance.
COLOUR: the SAME palette family as the front card but LIGHTER and quieter — use the palest colour as the ground so handwriting would be legible on it, and keep the inks for the lettering and the small accents only.
TYPOGRAPHY: the same TYPESET treatment as the front — a real typeface, cleanly drawn, printing perfectly clean with no ink texture, no misregistration and no stray marks near any letter — but calmer and smaller. Set the message in a clear hierarchy: the greeting small at the top, the message in the middle at reading size, the sign-off smaller beneath. Every word perfectly legible and correctly spelled.
NEVER: no people, no faces, no hands, no figures of any kind. Never repeat the front card's main subject at full size — the inside of a real card never re-prints its own cover.`;

const conceptsSchema = z.object({
  who: z.string().max(60),
  occasion: z.string().max(60),
  from: z.string().max(60).optional(),
  // ONE interest, required. Choosing between three takes on the same
  // subject is a card-shop choice ("which do I like?"); choosing
  // between three subjects was a question about the recipient, which
  // the sender had already answered by typing them. Required because
  // "the thing they love" IS the product — an empty brief isn't its job.
  interest: z.string().min(1).max(160),
  insideMode: z.enum(['auto', 'own', 'blank']).default('auto'),
  ownInsideText: z.string().max(300).optional(),
  /** Opt-in cheek. Deliberately permissive in the LAB so we can find
   *  where provider moderation actually draws the line — the customer
   *  build should be more conservative than whatever survives here. */
  cheeky: z.boolean().default(false),
  /** Character ladder — see quirkyDna(). */
  characters: z.enum(['objects', 'animals', 'figures']).default('objects'),
});

interface CardConcept {
  angle: string;
  format?: string;
  front_text: string;
  inside_text: string;
  art_direction: string;
  palette?: string;
}

function conceptSystemPrompt(characters: CharacterLevel): string {
  return `You write QUIRKY greeting-card concepts for Celebrait — flat-illustrated, classy, visual-pun-led cards in the spirit of good independent card shops ("you are simply the zest" over lemons; "I love you from my head tomatoes" as a vintage seed packet).

You are given who the card is for, the occasion, who it's from, and ONE thing the recipient loves. Return THREE concepts as JSON — all three about THAT ONE THING, as three genuinely different cards a good shop would rack side by side. The customer is choosing which EXECUTION they like, so the three must differ in angle, composition AND colour — never three drafts of one idea.

MINE THE SUBJECT FIRST — do this internally before writing:
List the world of that interest: its objects and kit, its rituals, its jargon and catchphrases, its colours, its sounds, its clichés, the moment its fans love most. The best cards come from the SPECIFIC corners of that world, not its most obvious symbol. (Fishing is not only a fish: it is tackle boxes, dawn flasks, the one that got away, sitting in silence for nine hours and calling it relaxing.)

IF THE SUBJECT IS A PERSON (a celebrity, a character, a public figure, a sports star), mine THEIR OWN unmistakable signatures — the objects they are never without, their gestures, their palette, their catchphrase, the thing only they do. Then build all three cards from THOSE.
  DANGER: do NOT drift to the person's CITY, COUNTRY or GENERIC FIELD. That is the standard failure. A card about a New York figure that shows the Empire State is a card about New York — it would work identically for anyone who likes the place, so it says nothing about them.
  WORKED: a red cap with white lettering, an overlong red tie, gold everything — unmistakable, no face required.
  FAILED: a skyline, a generic podium, "a famous building" — could be anybody.
  You must be able to say WHY each motif belongs to this person and nobody else. If you cannot, mine again.

THE THREE ANGLES — one card each, in this order:
1. WORDPLAY — a pun or twist from that world's own language. Must pass the pub test.
2. DEADPAN — an affectionate, observational truth about them and this thing. Understated, no pun. Often the best card of the three.
3. PROUD — a warm declaration that celebrates them through it. Sincere, not soppy.

WRITE WIDE, THEN EDIT: draft THREE candidate lines per angle (nine total), then be a ruthless editor. A line SURVIVES only if it passes ALL of:
   - THE PUB TEST: said aloud to a friend, it lands instantly — no explanation, no "get it?". If a pun needs unpacking, it is DEAD.
   - IT PARSES: a real, natural sentence. Nonsense mashups ("Fatherhood at DC10 beats dropper") are the cardinal failure.
   - IT IS ABOUT THEM AND THIS THING: their interest is doing the work, not the occasion. "Level up for your birthday!" is generic filler — dead.
   - NO CRINGE ZONE: no "vibe(s)" as a noun, no "boss/legend/hero" clichés, no hashtag-speak, at most ONE exclamation mark per card.
Pick the single best survivor per angle. A clean deadpan ALWAYS beats a strained pun.

Each returned concept:
- angle: "wordplay", "deadpan" or "proud" — one of each, in that order.
- format: one of "statement", "hero", "pattern", "label" — composition recipes at three densities. THE SET MUST SPAN THE RANGE: exactly one "statement" (minimal), one "hero" (balanced), one "pattern" or "label" (dense). Pair each with whichever angle it flatters — the deadpan line usually suits statement.
- front_text: the surviving line. MAXIMUM 8 words. It must CONNECT to the picture — words and motif complete each other. It must also SET WELL as display type: it should break naturally into 2-3 short stacked lines, and it should avoid words longer than 10 letters — very long words in big type are where lettering goes wrong. Given two equally good lines, take the one with the shorter words.
- inside_text: MAXIMUM 28 words. Lands the affection, may extend the joke, warm enough to sign. Never restates the front.
- art_direction: one sentence — the MOTIF and how it sits in the chosen format. ${characters === 'objects'
    ? 'Objects, food, botanicals, the kit of that world ONLY — NEVER humans, NEVER animals, NEVER characters.'
    : `OBJECTS ARE THE DEFAULT for every card. ${characters === 'figures'
        ? 'A characterful ANIMAL, or a HUMAN FIGURE as a graphic silhouette (from behind, cropped, small in frame, faceless — never a portrait, never detailed features, never a recognisable real individual), is PERMITTED'
        : 'A characterful ANIMAL is PERMITTED (never humans or human faces)'} but is a CEILING, not an instruction.
    AT MOST ONE of the three cards may use a character, and only if it passes this test: does this subject's OWN WORLD naturally contain that creature or person? A dog-lover's world contains a dog. A Sunday league team contains players. A BAND'S WORLD DOES NOT CONTAIN KANGAROOS — inventing a mascot to satisfy a permission is the failure to avoid ("Wonderwallabies" for Oasis: the pun exists only because an animal was forced in, and the card says nothing about the band).
    If the subject's world contains no creature or person naturally, all three cards are objects. That is a good outcome, not a limitation — the single best Oasis card was a cassette labelled "Oasis Mix".`} THE THREE CARDS MUST SHOW DIFFERENT CORNERS OF THE WORLD — not the same object three times (fishing: a tackle box of lures / a lone flask at dawn / a wall of floats — not three fish).
- palette: you are the art director. Name the GROUND colour first, then exactly THREE inks (four only if one truly earns it), and say which single ink is the ACCENT — the hot one, held back to under 10% of the card. Draw them all from that world. GROUNDS MUST SPAN THE SET — this is a hard requirement, because three neutral grounds make three cards that look like one card. Give TWO cards a warm neutral ground (bone, oat, chalk, clay, greige, putty, stone, warm grey) and give exactly ONE card a DEEP SATURATED ground — a rich, confident colour from that world (ink blue, forest, oxblood, terracotta, bottle green, aubergine) with calmer inks sitting on it. And make the two neutrals genuinely different from each other: a cool chalk next to a warm clay, not oat next to bone. All three come from ONE subject, so distinguish them by MOOD: e.g. dawn-muted, midday-bright, dusk-rich. No two cards sharing a colour family.

CHEEKY MODE (cheeky=true only):
British pub cheek is now allowed and encouraged — "bloody", "arse", "knobhead", "git", "sod", "bugger", "piss-up", "on the lash", innuendo and mild filth. Keep it AFFECTIONATE — the recipient laughs, never winces; we are taking the mickey out of someone we love. Absolutely no slurs, nothing about race/sexuality/religion/disability, nothing sexual beyond seaside-postcard innuendo, nothing cruel about age, weight or death. Put the strongest word on the FRONT if it's genuinely funnier there — we are testing what renders. When cheeky=false, stay completely clean.

RULES:
- Classy always: no clip-art energy, no emoji.
- Brands/bands/places evoked through objects and colours (a cassette and bucket hat; never logos, never lyrics, never real faces). Song/film TITLES may be name-dropped if the line still parses naturally.
- Occasion lives in the INSIDE text; the front is about THEM.
- INSIDE MODE: auto → write inside_text. own or blank → inside_text = "".

FINAL CHECK — do this LAST, immediately before returning: read your three front_texts once more. If ANY contains "vibe" or "vibes", "level up", "boss", "legend", "goals", or "mode", OR would need explaining in a pub, OR is about the occasion instead of their interest, OR repeats another card's motif — REPLACE it with the runner-up before answering. This check has caught a failure in most previous runs; assume it will catch one in yours.

Return JSON: {"concepts":[{...},{...},{...}]} — one subject, three angles, three formats, three palettes.`;
}

/** THE JUDGE — a second, INDEPENDENT pass (Aidan 2026-08-15).
 *
 *  The writer already self-edits, but marking your own homework inside
 *  one call is weak: the model is attached to what it just wrote. This
 *  is a fresh call that never saw the drafting, only the brief and the
 *  finished cards, and its job is to be hard to please. It doesn't just
 *  flag — it REWRITES anything that fails, so the caller always gets
 *  three usable cards.
 *
 *  ~£0.003 and ~3s. Cheap insurance on the thing that actually sells
 *  the card. */
function judgeSystemPrompt(): string {
  return `You are a ruthless greeting-card editor at a good independent card shop. You are shown a brief and three finished card concepts written by someone else. Your ONLY loyalty is to the person who will receive the card.

Judge EVERY card's front_text and inside_text against these, in order:

1. RECOGNITION — would the recipient INSTANTLY know this card is about their thing? The reference must be unmistakable to someone who loves that subject. Vague nods fail: a card about a comedian that could equally be about any comedian is a FAIL. Ask yourself: could I swap the subject for something else and this line still works? If yes, it FAILS.
2. UK AUDIENCE — British English and British sensibility. No Americanisms ("gotten", "candy", "vacation", "y'all", "awesome", "buddy"), no US-centric references, no American spelling. It should sound like it was written in Britain, because it was.
3. WIT, APPROPRIATE TO ITS ANGLE —
   • wordplay: must ACTUALLY be funny and the pun must be smooth. A groan is a fail. A pun that needs explaining is a fail.
   • deadpan: must be TRUE and dry — an affectionate observation with a straight face. Jokey-jokey is a fail here.
   • proud: warm and specific. Greeting-card mush ("you mean the world") is a fail.
4. FIT — right for this relationship and occasion. A card for a nan shouldn't sound like one for a mate.
5. PICTURE — the words and the described artwork must complete each other. If the line would work over ANY picture, it FAILS.
6. CLEAN CRAFT — parses as a natural sentence, correctly spelled, max one exclamation mark, no "vibes/level up/boss/legend/goals/mode".

For each of the three cards return:
- verdict: "pass" or "fix"
- reason: one short clause naming the specific failure (only when fixing)
- front_text: the ORIGINAL if it passed; a REWRITTEN one if it failed (same angle, same format, must fit the described artwork, max 8 words)
- inside_text: same rule (max 28 words; "" if the original was "")

Be genuinely hard. A typical set contains at least one weak card — find it. But NEVER weaken a line that already works, and never rewrite just to leave your mark.

Return JSON: {"cards":[{...},{...},{...}]} in the same order you were given.`;
}

export function registerAdminCardLabRoutes(app: Express): void {
  // ── POST /api/admin/card-lab/concepts ────────────────────────────
  app.post('/api/admin/card-lab/concepts', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    if (!openai) return res.status(503).json({ message: 'OpenAI not configured' });
    let body: z.infer<typeof conceptsSchema>;
    try {
      body = conceptsSchema.parse(req.body);
    } catch {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const briefLines = [
      `Recipient: ${body.who}`,
      `Occasion: ${body.occasion}`,
      body.from?.trim() ? `From: ${body.from.trim()}` : '',
      `The thing they love: ${body.interest.trim()}`,
      `insideMode=${body.insideMode}`,
      `cheeky=${body.cheeky}`,
      `characters=${body.characters}`,
    ].filter(Boolean);

    const startedAt = Date.now();
    try {
      // gpt-4o, not mini: wit is the product here and mini's jokes are
      // flat. Still ~£0.003/call — the art costs 2× more than the words.
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: conceptSystemPrompt(body.characters) },
          { role: 'user', content: briefLines.join('\n') },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 700,
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
      let concepts: CardConcept[] = (parsed.concepts ?? []).slice(0, 3);

      // The ban list is enforced in CODE, not hope — two prompt passes
      // still leaked "vibes". One corrective retry naming the offenders;
      // if that also fails we ship anyway (logged) rather than error.
      const BANNED = /\b(vibes?|level up|bossin?|legend|goals|beast mode|mode)\b/i;
      const offenders = concepts.filter((c) => BANNED.test(c.front_text ?? ''));
      if (offenders.length > 0) {
        const retry = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: conceptSystemPrompt(body.characters) },
            { role: 'user', content: briefLines.join('\n') },
            { role: 'assistant', content: completion.choices[0]?.message?.content ?? '' },
            { role: 'user', content: `These front lines broke the banned-word rule: ${offenders.map((o) => `"${o.front_text}"`).join(', ')}. Replace ONLY those concepts' front_text (and inside_text if it echoed the line) with clean survivors — no "vibe(s)", "level up", "boss", "legend", "goals", "mode". Return the complete corrected JSON.` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.5,
          max_tokens: 700,
        });
        try {
          const reparsed = JSON.parse(retry.choices[0]?.message?.content ?? '{}');
          const fixed: CardConcept[] = (reparsed.concepts ?? []).slice(0, 3);
          if (fixed.length === 3) concepts = fixed;
        } catch { /* keep originals */ }
        const still = concepts.filter((c) => BANNED.test(c.front_text ?? ''));
        if (still.length) console.warn('[CARD-LAB] banned words survived retry:', still.map((c) => c.front_text));
      }

      void logGeneration({
        cardId: null,
        slot: 'card_lab',
        templateId: null,
        templateVersion: null,
        provider: 'openai',
        model: 'gpt-4o',
        quality: null,
        costCents: llmCostCents(
          'gpt-4o',
          completion.usage?.prompt_tokens ?? 0,
          completion.usage?.completion_tokens ?? 0,
        ),
        durationMs: Date.now() - startedAt,
        success: concepts.length === 3,
      });

      if (concepts.length !== 3) {
        return res.status(502).json({ message: 'Concept generation came back malformed — try again' });
      }

      // ── Independent judge pass ──────────────────────────────────
      // Never let a judge failure cost the user their cards: on any
      // error we ship the originals.
      let judged = concepts;
      const notes: Array<{ index: number; reason: string; was: string }> = [];
      try {
        const review = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: judgeSystemPrompt() },
            {
              role: 'user',
              content: [
                'BRIEF:',
                briefLines.join('\n'),
                '',
                'THE THREE CARDS:',
                ...concepts.map((c, i) =>
                  `${i + 1}. angle=${c.angle} format=${c.format ?? '?'}\n   FRONT: ${c.front_text}\n   INSIDE: ${c.inside_text}\n   ARTWORK: ${c.art_direction}`,
                ),
              ].join('\n'),
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.4,
          max_tokens: 700,
        });
        const verdicts = JSON.parse(review.choices[0]?.message?.content ?? '{}').cards ?? [];
        if (verdicts.length === 3) {
          judged = concepts.map((c, i) => {
            const v = verdicts[i] ?? {};
            if (v.verdict === 'fix' && typeof v.front_text === 'string' && v.front_text.trim()) {
              notes.push({ index: i, reason: String(v.reason ?? 'weak'), was: c.front_text });
              return {
                ...c,
                front_text: v.front_text.trim(),
                inside_text: typeof v.inside_text === 'string' ? v.inside_text.trim() : c.inside_text,
              };
            }
            return c;
          });
        }
        void logGeneration({
          cardId: null, slot: 'card_lab', templateId: null, templateVersion: null,
          provider: 'openai', model: 'gpt-4o', quality: null,
          costCents: llmCostCents('gpt-4o', review.usage?.prompt_tokens ?? 0, review.usage?.completion_tokens ?? 0),
          durationMs: 0, success: true,
        });
      } catch (e) {
        console.warn('[CARD-LAB] judge pass failed, shipping originals:', e);
      }

      res.json({ concepts: judged, notes });
    } catch (err) {
      console.error('[CARD-LAB] concepts error:', err);
      res.status(500).json({ message: 'Concept generation failed' });
    }
  });

  // ── POST /api/admin/card-lab/render-inside ──────────────────────
  // Signed-off front → the inside. Three modes, matching the studio:
  //   auto  — render the AI-written message as designed typography
  //   own   — render the sender's own words the same way
  //   blank — a styled but EMPTY page they can handwrite on
  // dear/from render as the greeting-card hierarchy the photo studio
  // already uses (To Dad … at the top, Love Aidan … underneath).
  app.post('/api/admin/card-lab/render-inside', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const schema = z.object({
      mode: z.enum(['auto', 'own', 'blank']).default('auto'),
      message: z.string().max(300).optional(),
      dear: z.string().max(60).optional(),
      from: z.string().max(60).optional(),
      palette: z.string().max(300).optional(),
      art_direction: z.string().max(500).optional(),
      characters: z.enum(['objects', 'animals', 'figures']).default('objects'),
    });
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(req.body);
    } catch {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const dear = body.dear?.trim();
    const from = body.from?.trim();
    const message = body.message?.trim();

    // A blank inside is still DESIGNED — a plain white square reads as a
    // printing error, but a busy one is unwritable. Palest ground, one
    // whisper of a motif, nothing else.
    const textBlock = body.mode === 'blank'
      ? 'ZERO TEXT: this inside page is deliberately EMPTY so the sender can handwrite their own message. Render NO words, letters or numbers anywhere. Just the palest ground from the palette with one small, delicate motif echo in a single corner and generous clean space everywhere else.'
      : [
          'TEXT — render EXACTLY these words and nothing else, typeset per the TYPOGRAPHY block (a real typeface, printing perfectly clean, no texture or stray marks on the letters):',
          dear ? `Top of the page, smaller and quieter: "${dear}"` : '',
          message ? `Centre of the page, the largest and most prominent text, with generous line spacing: "${message}"` : '',
          from ? `Bottom of the page, smaller and quieter, sitting below the message: "${from}"` : '',
          'Clear vertical hierarchy and real space between the three parts. NO other text of any kind anywhere in the image.',
        ].filter(Boolean).join(' ');

    const prompt = [
      quirkyDna(body.characters),
      '',
      QUIRKY_INSIDE,
      '',
      body.palette ? `PALETTE (same family as the front, but use its palest tone as the ground): ${body.palette}` : '',
      body.art_direction ? `THE FRONT OF THIS CARD SHOWED: ${body.art_direction}. Echo it only faintly — a small motif in a corner or a light border. Do NOT reproduce it at size.` : '',
      '',
      textBlock,
      '',
      'Square 1024x1024 full-bleed greeting-card INSIDE page.',
    ].filter(Boolean).join('\n');

    try {
      const result = await getProvider('openai-2').generate({
        prompt, quality: 'low', size: '1024x1024', slot: 'card_lab',
      });
      void logGeneration({
        cardId: null, slot: 'card_lab', templateId: null, templateVersion: null,
        provider: result.provider, model: result.model, quality: 'low',
        costCents: result.costCents, durationMs: result.durationMs, success: true,
      });
      res.json({ imageUrl: result.imageUrl, costUsd: result.costUsd, durationMs: result.durationMs });
    } catch (err: any) {
      console.error('[CARD-LAB] render-inside error:', err?.message ?? err);
      res.status(502).json({ message: err?.message ?? 'Inside render failed' });
    }
  });

  // ── POST /api/admin/card-lab/edit-text ──────────────────────────
  // Gemini image-to-image: change ONLY the lettering, keep the artwork
  // pixel-identical. This is what makes a near-perfect card salvageable
  // — one wonky letter used to mean re-rolling the whole thing.
  app.post('/api/admin/card-lab/edit-text', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const schema = z.object({
      imageUrl: z.string().min(20),          // data URL from a previous render
      newText: z.string().min(1).max(120),
      currentText: z.string().max(120).optional(),
      // Everything needed to RE-RENDER instead of edit, when the layout
      // has to change (see the routing note below).
      format: z.enum(['statement', 'hero', 'pattern', 'label', 'editorial']).optional(),
      art_direction: z.string().max(500).optional(),
      palette: z.string().max(300).optional(),
      characters: z.enum(['objects', 'animals', 'figures']).default('objects'),
    });
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(req.body);
    } catch {
      return res.status(400).json({ message: 'Invalid request' });
    }

    // ── ROUTE BY FORMAT (Aidan 2026-08-15) ──────────────────────────
    // On a DENSE card the artwork is composed AROUND the lettering —
    // taxis and pretzels wedged into the holes the words left. New text
    // is a different shape, so those holes are in the wrong places and
    // no surgical edit can fix it: the layout itself must be rebuilt.
    // So: sparse formats (statement/hero) get Gemini's pixel-preserving
    // swap; dense formats (pattern/label) get a full re-render from the
    // SAME art_direction + palette + format — same design language, new
    // composition, correct text. Re-rendering is also 10x cheaper
    // ($0.006 vs $0.067) — the better tool is no editor at all.
    const dense = body.format === 'pattern' || body.format === 'label';
    if (dense && body.art_direction) {
      const prompt = [
        quirkyDna(body.characters),
        '',
        QUIRKY_FORMATS[body.format === 'label' ? 'label' : 'pattern'],
        '',
        `ILLUSTRATION: ${body.art_direction}`,
        body.palette ? `PALETTE (obey exactly): ${body.palette}` : '',
        '',
        `FRONT TEXT — render EXACTLY and ONLY: "${body.newText.trim()}". Set it per the TYPOGRAPHY block: a real typeface, stacked into 2-3 flush-aligned lines, printing perfectly clean with no texture, distressing or stray marks on the letters. Compose the artwork AROUND these words, leaving them a clear zone of plain ground to sit in — the motifs fill the space the type leaves, never run behind it. Every word legible, nothing cropped. ABSOLUTELY NO other text anywhere in the image.`,
        '',
        'Square 1024x1024 full-bleed greeting-card front.',
      ].filter(Boolean).join('\n');
      try {
        const result = await getProvider('openai-2').generate({
          prompt, quality: 'low', size: '1024x1024', slot: 'card_lab',
        });
        void logGeneration({
          cardId: null, slot: 'card_lab', templateId: null, templateVersion: null,
          provider: result.provider, model: result.model, quality: 'low',
          costCents: result.costCents, durationMs: result.durationMs, success: true,
        });
        return res.json({
          imageUrl: result.imageUrl, costUsd: result.costUsd,
          durationMs: result.durationMs,
          drawnBy: 'redrawn (dense layout — art re-composed around the new words)',
        });
      } catch (err: any) {
        console.error('[CARD-LAB] dense re-render failed:', err?.message ?? err);
        return res.status(502).json({ message: err?.message ?? 'Re-render failed' });
      }
    }

    const provider = getProvider('gemini-flash');
    if (!provider.refine) {
      return res.status(503).json({ message: 'Active Gemini provider has no refine support' });
    }

    // ⚠️ The lettering must be RE-SET, not overwritten. v1 told Gemini to
    // keep the same placement — so a longer replacement was drawn on the
    // same single baseline and ran straight into the artwork ("Reel good,
    // Dad" collided with the float, Aidan 2026-08-15). New text has
    // different VOLUME to old text: the type may restack, resize and
    // reflow to fit its space; only the ARTWORK is untouchable.
    const instruction = [
      body.currentText?.trim()
        ? `The hand-lettered text on this greeting card currently reads "${body.currentText.trim()}".`
        : 'This greeting card has hand-lettered text on it.',
      'STEP 1 — ERASE: completely remove the existing lettering. Paint the background cleanly over every letter so no trace, ghost or fragment of the old words remains. This is not optional: leaving any of the old text visible is a total failure (a previous attempt left "Reel legend" sitting under the new line).',
      `STEP 2 — WRITE: on the now-clean background, draw the new lettering reading EXACTLY: "${body.newText.trim()}". These are the ONLY words on the card. If any word from the old text also appears in the new text, it must be drawn fresh as part of the new lettering — never left behind from the original.`,
      'Keep the SAME hand-lettered style, the same ink colours and the same character — it must look like the same artist wrote it.',
      'RE-SET the type to fit its space properly: you MAY break it across two or three stacked lines, adjust the size, and re-balance it within the clear area it occupies. Do NOT simply overwrite the old words on one line — the new text is a different length and must be composed to fit.',
      'The lettering must NEVER overlap, touch or obscure any illustrated element. Keep clear breathing space between the type and the artwork; if the new text needs more room, make the letters smaller rather than letting them collide.',
      'Change NOTHING else: every illustrated element, the background colour, the texture and the layout stay exactly as they are. Do not add, remove, move or resize any artwork.',
      'Every letter correctly spelled, fully legible, nothing cropped by the frame.',
    ].join(' ');

    const startedAt = Date.now();
    // Gemini intermittently answers CONVERSATIONALLY — "I have removed the
    // original lettering and added…" — with finishReason=STOP and no image
    // part. Benched 2026-08-15: identical input failed once, succeeded on
    // retry, while other inputs went first time. It is flakiness, not
    // moderation, so retry once with a blunter instruction before giving up.
    const attemptEdit = async (extra = '') => {
      const result = await provider.refine!(body.imageUrl, instruction + extra);
      void logGeneration({
        cardId: null,
        slot: 'card_lab',
        templateId: null,
        templateVersion: null,
        provider: result.provider,
        model: result.model,
        quality: null,
        costCents: result.costCents,
        durationMs: result.durationMs,
        success: true,
      });
      return result;
    };

    try {
      let result;
      try {
        result = await attemptEdit();
      } catch (first: any) {
        if (!/did not return an image/i.test(String(first?.message ?? ''))) throw first;
        console.warn('[CARD-LAB] gemini answered in prose, retrying for an image');
        result = await attemptEdit(
          ' Return the edited IMAGE itself. Do not reply with a description, explanation or any text response — output only the finished card image.',
        );
      }
      res.json({
        imageUrl: result.imageUrl,
        costUsd: result.costUsd,
        durationMs: Date.now() - startedAt,
        drawnBy: 'gemini (text edit)',
      });
    } catch (err: any) {
      console.error('[CARD-LAB] edit-text error:', err?.message ?? err);
      res.status(502).json({ message: err?.message ?? 'Text edit failed' });
    }
  });

  // ── POST /api/admin/card-lab/render ──────────────────────────────
  // One front, gpt-image-2 LOW (~$0.006). The client fires three of
  // these in parallel — no batching server-side so each card can land
  // and reveal the moment it's ready.
  app.post('/api/admin/card-lab/render', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const schema = z.object({
      front_text: z.string().min(1).max(120),
      art_direction: z.string().min(1).max(500),
      format: z.enum(['statement', 'hero', 'pattern', 'label', 'editorial']).default('hero'),
      palette: z.string().max(300).optional(),
      characters: z.enum(['objects', 'animals', 'figures']).default('objects'),
      /** Tier is switchable so the lab can compare artefact profiles —
       *  all tiers output 1024x1024, so this changes CRISPNESS, not
       *  resolution. Print re-renders would use 'high'. */
      quality: z.enum(['low', 'medium', 'high']).default('low'),
    });
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(req.body);
    } catch {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const prompt = [
      quirkyDna(body.characters),
      '',
      QUIRKY_FORMATS[body.format === 'editorial' ? 'hero' : body.format],
      '',
      `ILLUSTRATION: ${body.art_direction}`,
      body.palette ? `PALETTE (obey exactly): ${body.palette}` : '',
      '',
      `FRONT TEXT — render EXACTLY and ONLY: "${body.front_text}". Set it per the TYPOGRAPHY block: a real typeface, stacked into 2-3 flush-aligned lines, printing perfectly clean with no texture, distressing or stray marks on the letters, sitting in its own clear zone of ground. Every word legible, nothing cropped. ABSOLUTELY NO other text, letters, numbers, signatures or watermarks anywhere in the image.`,
      '',
      'Square 1024x1024 full-bleed greeting-card front.',
    ].join('\n');

    // OpenAI first. If its safety layer refuses (common once cheek is
    // on), fall back to Gemini — different provider, different
    // thresholds — and report WHICH one drew it so the lab teaches us
    // where each wall actually sits.
    const attempt = async (providerId: string) => {
      const provider = getProvider(providerId);
      const result = await provider.generate({
        prompt,
        quality: body.quality,
        size: '1024x1024',
        slot: 'card_lab',
      });
      void logGeneration({
        cardId: null,
        slot: 'card_lab',
        templateId: null,
        templateVersion: null,
        provider: result.provider,
        model: result.model,
        quality: body.quality,
        costCents: result.costCents,
        durationMs: result.durationMs,
        success: true,
      });
      return result;
    };

    const looksBlocked = (e: any) => {
      const m = String(e?.message ?? e).toLowerCase();
      return /safety|content polic|moderation|rejected|not allowed|violat/.test(m);
    };

    try {
      const result = await attempt('openai-2');
      res.json({
        imageUrl: result.imageUrl, costUsd: result.costUsd,
        durationMs: result.durationMs, drawnBy: 'openai',
      });
    } catch (err: any) {
      if (!looksBlocked(err)) {
        console.error('[CARD-LAB] render error:', err?.message ?? err);
        return res.status(502).json({ message: err?.message ?? 'Render failed' });
      }
      console.warn('[CARD-LAB] openai refused, trying gemini:', err?.message);
      try {
        const result = await attempt('gemini-flash');
        res.json({
          imageUrl: result.imageUrl, costUsd: result.costUsd,
          durationMs: result.durationMs, drawnBy: 'gemini (openai refused)',
        });
      } catch (err2: any) {
        res.status(502).json({
          message: 'Both providers refused this one — too spicy.',
          blocked: true,
        });
      }
    }
  });
}
