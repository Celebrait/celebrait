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
- THE SUBJECT CHOOSES THE GROUND, NOT A HOUSE HABIT. If the thing they love owns a colour — a club's red, a cab's yellow, a snooker table's green, a bottle of Guinness — that colour belongs on the card, and putting it on a pale ground wastes the strongest thing the subject gave you. Reach for a deep, saturated, confident ground FIRST and only fall back to a warm neutral (bone, oat, chalk, clay, greige, putty, stone) when quietness is genuinely what the card wants. Pale grounds are one option, never the default. What is banned is not saturation but MUD and NOISE: a saturated ground with fluorescent inks fighting it, or three inks all at the same volume with nothing leading.
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

⚠️ SOMEONE ELSE'S PROPERTY — EVOKE IT, NEVER REPRODUCE IT. This card gets printed and sold, so anything you draw is merchandise. When the subject is a film, book, game, band, team or brand, you may use its COLOURS, its MOOD, and the ORDINARY REAL-WORLD OBJECTS its fans actually own. You may NOT draw the invented things that belong to it: no named artefact, creature, gadget, vehicle, weapon, building or costume that exists only inside that property, and never a logo, crest, badge, emblem, insignia, mascot or uniform. If an object would be sold in that property's official gift shop, it is out.
Worked example — a wizarding-school story: DRAW a striped scarf in two colours, an owl, a stack of battered spellbooks, a candle stub, a brass key, a night sky. DO NOT DRAW the winged golden ball, the school crest, a house badge, the castle, a named character, or any symbol from the books. The card still reads as that world; it just does it with things anyone could own.
This is a hard limit, not a stylistic preference. Substitute a generic equivalent and move on.

TYPOGRAPHY — DRAWN WITH REAL CRAFT, AND CHOSEN TO SUIT THE CARD. These cards are won and lost here:
- ⚠️ THE TYPEFACE IS A DESIGN DECISION, NOT A DEFAULT. Greeting cards are eclectic: a fishing card and a disco card must not wear the same lettering. The TYPE line below names the personality chosen for THIS card — obey it, and draw that lettering with the confidence of someone who knows the idiom. The families available include: a fat retro serif with generous ball terminals (Cooper/Bookman, warm and nostalgic); a high-contrast Didone display serif (elegant, glamorous); a bold grotesk (modern, deadpan, urban); a condensed poster gothic (punchy, sporting, newsprint); groovy 70s revival with swollen curves (music, parties); a confident sign-painter's brush script (pubs, markets, seaside); a chunky slab (outdoors, workwear); vintage woodblock or letterpress (heritage, ale, cricket); geometric art deco (cocktails, jazz, glamour); a typewriter mono (literary, dry admin humour). Pick the one the SUBJECT and the ANGLE ask for.
- CHARACTER IS WELCOME; MESS IS NOT. Hand-drawn, brush-painted and wonky letterforms are all allowed and often right — what is banned is a letterform that looks UNFINISHED. The distinction matters: a brush script has deliberate texture built INTO the stroke, which is craft; a glyph with speckles, ghosting or a stray tail hanging off it is a fault. Whatever the style, every letter is fully formed, evenly inked and confidently made, as if a signwriter did it in one pass and meant every mark.
- THE INK-PROCESS EFFECTS NEVER TOUCH THE TYPE. This is the rule that keeps lettering from going wrong, and it applies to EVERY typeface above including the hand-drawn ones: no misregistration on the letters, no plate offset, no faint second pass of the same word, no mottling or roller texture across the glyphs, no distressing, and no stray marks, scribbles, specks or half-formed shapes anywhere near a word. The artwork carries the print process; the lettering stays crisp. A smudge or squiggle beside a word is a failure of the whole card.
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

/** Named artefacts we will not print (Aidan 2026-08-16, "narrow it but
 *  don't kill the thing").
 *
 *  This is a FLOOR, not a fence. It cannot enumerate every franchise, and
 *  it is not meant to: the real guard is the "evoke, never reproduce"
 *  rule in the style DNA, which is generic and covers properties nobody
 *  has thought of. This list exists because prompt-only guards have been
 *  walked past repeatedly in this file, and because `art_direction` comes
 *  in from the client and goes to the image model almost verbatim.
 *
 *  Deliberately narrow: only the invented, instantly-identifiable objects
 *  that would sit in an official gift shop. Generic props a fan could own
 *  — a striped scarf, an owl, a cauldron, a starfield — stay legal and
 *  are what keeps the cards worth buying. */
// ⚠️ Every pattern must tolerate PLURALS. The first draft used \bsnitch\b,
// which sails straight past "golden snitches" — caught only because the
// test exercised the regex directly rather than trusting it by eye.
const PROTECTED_ARTEFACTS: Array<[RegExp, string]> = [
  [/\b(golden )?snitch(es)?\b|\bquaffle(s)?\b|\bbludger(s)?\b/i, 'Quidditch equipment'],
  [/\bdeathly hallows\b|\bhogwarts\b|\bsorting hat(s)?\b|\bmarauder'?s map\b|\bhouse (crest|badge)(s)?\b/i, 'Harry Potter emblems'],
  [/\blightsab(er|re)(s)?\b|\bdeath star\b|\bmillennium falcon\b|\bx-wing(s)?\b|\btie fighter(s)?\b|\bstormtrooper(s)?\b/i, 'Star Wars hardware'],
  [/\btardis\b|\bdalek(s)?\b/i, 'Doctor Who property'],
  [/\bmjolnir\b|\binfinity gauntlet\b|\bbat-?signal\b|\bweb-?shooter(s)?\b/i, 'superhero artefacts'],
  [/\bpok(e|é)ball(s)?\b|\bpikachu\b/i, 'Pokémon property'],
  [/\bone ring\b|\bthe precious\b/i, 'Tolkien property'],
  [/\bmickey (mouse )?ears\b|\bglass slipper(s)?\b/i, 'Disney property'],
  [/\b(club|team) (crest|badge|logo)(s)?\b|\bkit sponsor(s)?\b/i, 'club crests and badges'],
  [/\b(logo|crest|emblem|insignia|badge|coat of arms)(s|es)?\b/i, 'logos, crests and badges'],
];

/** Which protected artefacts a free-text art brief names, if any. */
export function namedArtefacts(brief: string | undefined): string[] {
  if (!brief) return [];
  const hits: string[] = [];
  for (const [pattern, label] of PROTECTED_ARTEFACTS) {
    if (pattern.test(brief) && !hits.includes(label)) hits.push(label);
  }
  return hits;
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
  /** The writer's shortlist for this angle, strongest first. The judge
   *  picks one and the winner is copied into front_text, so everything
   *  downstream (render, edit-text, the client) still sees a single
   *  line and needs no changes. */
  front_candidates?: string[];
  front_text: string;
  inside_text: string;
  art_direction: string;
  palette?: string;
  /** The lettering personality this card wears — chosen per card by the
   *  art director, same as the palette. Without it every set drifted to
   *  the same clean sans (Aidan 2026-08-16: "greetings cards are
   *  eclectic, why limit ourselves?"). */
  typeface?: string;
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

IF THE SUBJECT IS A FICTIONAL WORLD, FRANCHISE, BAND OR TEAM, THE WORDS DO THE HEAVY LIFTING. The artwork is deliberately restricted for these subjects — we never draw their invented artefacts, logos or crests, because we print and sell these cards — so the picture alone CANNOT say which world this is. That job falls to the line, and the line must be up to it.
  Mine that world's OWN VOCABULARY, which is where a property is unmistakable without reproducing anything: its invented words, its famous single lines, the phrases that got out into ordinary speech. Words are the safe half of a franchise; artwork is the risky half — and happily the famous layer of any world is mostly WORDS, while the deep cuts are mostly objects, so aiming at what everyone knows keeps us legal and keeps the buyer with us at the same time.
  IF THE WORLD HAS ONE FAMOUS WORD, THAT WORD MUST DO THE WORK, NEVER SIT AS FILLER. Observed failure: "Wand-erful Sister, Always Charming" for a Harry Potter fan. It contains "Always" — the single most quoted word in those books — and wastes it as an ordinary adverb, while "wand-erful" and "charming" describe generic witchcraft that would suit any witch card ever printed. The card that should have been written was built on "Always".

THE THREE ANGLES — one card each, in this order.
⚠️ QUIRK IS THE HOUSE VOICE, NOT ONE OF THREE FLAVOURS. All three cards must contain a TURN — a small moment that makes the reader do a double-take. The angles are three different WAYS TO DELIVER that turn; they are not "one funny card and two straight ones". A line with no turn is DRY, and dry is what makes a card feel like it came off a supermarket rack.
1. WORDPLAY — the turn is in the LANGUAGE. A pun or a twist on a phrase from that world's own vocabulary. Must pass the pub test.
2. DEADPAN — the turn is in the UNDER-REACTION. This is the QUIETEST card, but quiet is not empty: deadpan only works when something genuinely ABSURD is being reported completely straight. Mine the daft truth of that world — the nine wasted hours, the £400 of kit for a £2 fish, the 5am alarm on a day off, the shed nobody else is allowed in — and state it flatly, with no wink and no punchline signposting. BEFORE you write this line, name to yourself ONE specific absurd fact about this world, ideally carrying a number, a ritual or a wasted effort. The line then REPORTS that fact. If you find yourself reaching for the birthday instead of the absurdity ("Another year, another …"), you have not mined hard enough — go back and find the daft fact. NO ABSURDITY MEANS NO JOKE: "Manchester United Comes First" and "The only mixologist in the family" are statements of fact with nothing being under-reacted to, and they came out dry. "Nine Hours, No Fish" works, because something ridiculous is being reported with a straight face.
3. PROUD — the turn is in the DISPROPORTION. Crown them with total sincerity, in a grand register, for something gloriously SMALL and specific. The honour is real; the kingdom is tiny. Generic praise for a generic skill is not a proud card, it is a job title — "Master of the Martini", "Master of the Tackle Box" and "Born to Stand Out" all failed this way, and "Master of the ___" has now turned up in most sets. BANNED FORMULAS, reject on sight: "Master of the ___", "The only ___ in the family", "King/Queen/Lord of ___", "Born to ___". Find the specific little kingdom instead.

WRITE WIDE, THEN SHORTLIST: draft at least SIX candidate lines per angle, then be a ruthless editor. A line SURVIVES only if it passes ALL of:
   - THE PUB TEST: said aloud to a friend, it lands instantly — no explanation, no "get it?". If a pun needs unpacking, it is DEAD.
   - IT PARSES: a real, natural sentence. Nonsense mashups ("Fatherhood at DC10 beats dropper") are the cardinal failure.
   - IT IS ABOUT THEM AND THIS THING: their interest is doing the work, not the occasion. "Level up for your birthday!" is generic filler — dead.
   - COVER THE PICTURE: read the line on its own, with the artwork hidden. Does it still tell you WHICH subject this card is about? If it only works because of the picture, the words are freeloading and the line is DEAD. "Wand-erful Sister, Always Charming" fails this: hide the picture and it is a generic witch card.
   - ⚠️ THE BUYER TEST — the one most likely to lose us the sale. THE PERSON BUYING THIS CARD IS NOT THE FAN. A daughter buying for her Harry Potter dad may never have read a word of it; a mate buying for a United fan may not care about football. If she cannot tell at a glance that the card is good, she does not buy it, and the recipient never sees it. So the reference must come from the FAMOUS layer of that world — the handful of things that escaped the fandom and reached everybody: platform nine and three-quarters, "always", "may the fourth", "I am your father". NOT the deep cut: a minor character, an obscure spell, a squad number, an album track. Ask yourself: would someone who has never touched this subject, but has heard of it, still get this instantly? If only a proper fan would get it, the line FAILS — however clever it is.
     This does NOT mean be vague. The famous layer is still specific; it is just specific in a way that carries beyond the fandom. Aim at the thing a non-fan would name if you asked them what they know about it.
   - THE TURN TEST: say to yourself, in five words or fewer, what the SURPRISE in this line is — "puns on reel/real", "under-reacts to nine wasted hours", "crowns him king of the pier". If you cannot name the turn, the line is DRY and it dies here, however true, warm or well written it is. This is the test most weak lines fail.
   - NO CRINGE ZONE: no "vibe(s)" as a noun, no "boss/legend/hero" clichés, no hashtag-speak, at most ONE exclamation mark per card.
⚠️ DO NOT PICK A WINNER. Keep the THREE BEST survivors per angle and return all three, strongest first. An independent editor chooses between them afterwards, and choosing is easier than repairing — so your job is to hand over three genuinely different, genuinely usable lines, NOT one favourite plus two throwaways you never intended. If you find yourself writing a filler line to pad the list, replace it: three real options or the shortlist has failed.
The three candidates for an angle must all be DIFFERENT ROUTES to that angle's turn, not one line reworded three ways — and every one of them must work with THAT SAME CARD'S artwork, because the picture is already decided by art_direction. A clean deadpan ALWAYS beats a strained pun.

Each returned concept:
- angle: "wordplay", "deadpan" or "proud" — one of each, in that order.
- format: one of "statement", "hero", "pattern", "label" — composition recipes at three densities. THE SET MUST SPAN THE RANGE: exactly one "statement" (minimal), one "hero" (balanced), one "pattern" or "label" (dense). Pair each with whichever angle it flatters — the deadpan line usually suits statement.
- front_candidates: an array of EXACTLY THREE surviving lines for this angle, strongest first. Each one MAXIMUM 8 words. Each must CONNECT to the picture — words and motif complete each other — and each must SET WELL as display type: breaking naturally into 2-3 short stacked lines, avoiding words longer than 10 letters, since very long words in big type are where lettering goes wrong. Where two lines are equally good, prefer the one with shorter words.
- inside_text: MAXIMUM 28 words. Lands the affection, may extend the joke, warm enough to sign. Never restates the front.
- art_direction: one sentence — the MOTIF and how it sits in the chosen format. ${characters === 'objects'
    ? 'Objects, food, botanicals, the kit of that world ONLY — NEVER humans, NEVER animals, NEVER characters.'
    : `OBJECTS ARE THE DEFAULT for every card. ${characters === 'figures'
        ? 'A characterful ANIMAL, or a HUMAN FIGURE as a graphic silhouette (from behind, cropped, small in frame, faceless — never a portrait, never detailed features, never a recognisable real individual), is PERMITTED'
        : 'A characterful ANIMAL is PERMITTED (never humans or human faces)'} but is a CEILING, not an instruction.
    AT MOST ONE of the three cards may use a character, and only if it passes this test: does this subject's OWN WORLD naturally contain that creature or person? A dog-lover's world contains a dog. A Sunday league team contains players. A BAND'S WORLD DOES NOT CONTAIN KANGAROOS — inventing a mascot to satisfy a permission is the failure to avoid ("Wonderwallabies" for Oasis: the pun exists only because an animal was forced in, and the card says nothing about the band).
    If the subject's world contains no creature or person naturally, all three cards are objects. That is a good outcome, not a limitation — the single best Oasis card was a cassette labelled "Oasis Mix".`} THE THREE CARDS MUST SHOW DIFFERENT CORNERS OF THE WORLD — not the same object three times (fishing: a tackle box of lures / a lone flask at dawn / a wall of floats — not three fish).
  ⚠️ NEVER NAME SOMEONE ELSE'S PROPERTY IN THIS BRIEF. We print and sell these cards, so an art brief that asks for an invented artefact is asking us to manufacture merchandise. Do not write the name of any object, creature, vehicle, weapon, building, costume, logo, crest or badge that exists only inside a film, book, game, brand or club. Observed failures on Harry Potter and Star Wars briefs: "a Golden Snitch, Quaffle and Bludger", "the Marauder's Map", "a mug with a lightsaber handle", "small screens showing iconic scenes". Every one of those is merchandise.
  Ask instead for the ORDINARY objects that world is full of, which anyone could own and nobody owns the rights to: a striped scarf in two colours, an owl, a stack of battered spellbooks, a candle stub, a brass key, a train ticket, a starfield, a desert horizon, a worn paperback, a takeaway coffee. The PALETTE and the words carry the reference. If you cannot describe the picture without naming a protected thing, choose a different corner of that world.
- palette: you are the art director. Name the GROUND colour first, then exactly THREE inks (four only if one truly earns it), and say which single ink is the ACCENT — the hot one, held back to under 10% of the card. Draw them all from that world. ⚠️ NEVER NAME GREY, SILVER, CHROME, GOLD, METALLIC OR WHITE AS AN INK. They are not colours, and naming one invites a rendered metal object with 3D shading, which breaks the flat-print style outright — a palette that said "skyscraper silver" produced a photorealistic chrome fishing reel. Metal objects are drawn FLAT in the palette's real colours: a reel is rust and cream, not silver. Every ink you name must be a colour someone could squeeze out of a tube.
START FROM THE SUBJECT'S OWN COLOURS. If that world owns a colour, use it — a United card wants red, a New York card wants cab yellow, a fishing card can want deep river green. Wasting a subject's signature colour on a beige card is the commonest way these come out mundane.
GROUNDS MUST SPAN THE SET, and they must span it UPWARDS: AT LEAST ONE of the three takes a deep saturated ground (ink blue, oxblood, forest, terracotta, bottle green, aubergine, a hot mustard), AT MOST ONE takes a pale neutral (bone, oat, chalk, clay, greige, putty, stone), and the third goes wherever the subject leads — often a strong mid-tone. THREE PALE GROUNDS IS A FAILED SET, and so is a pale ground on a subject famous for a colour. Where a card does take a pale ground, its motif must carry saturated ink so the card still has something to look at. All three come from ONE subject, so distinguish them by MOOD: e.g. dawn-muted, midday-bright, dusk-rich. No two cards sharing a colour family.
- typeface: you are also the typographer. In under fifteen words, name the LETTERING PERSONALITY this particular card should wear and why it fits — e.g. "condensed poster gothic, terrace-chant energy", "sign-painter's brush script, seaside pub", "high-contrast Didone, cocktail-hour glamour", "chunky slab, workwear and tackle boxes", "groovy 70s revival with swollen curves". Choose from the subject and the angle, not from habit: a deadpan card usually wants restraint, a proud card can carry a grand display face, a wordplay card can be playful. THE THREE CARDS MUST NOT SHARE A TYPEFACE PERSONALITY — a set where all three wear the same clean sans is a set that has wasted two thirds of its range. Greeting cards are eclectic; make them so.

CHEEKY MODE (cheeky=true only):
British pub cheek is now allowed and encouraged — "bloody", "arse", "knobhead", "git", "sod", "bugger", "piss-up", "on the lash", innuendo and mild filth. Keep it AFFECTIONATE — the recipient laughs, never winces; we are taking the mickey out of someone we love. Absolutely no slurs, nothing about race/sexuality/religion/disability, nothing sexual beyond seaside-postcard innuendo, nothing cruel about age, weight or death. Put the strongest word on the FRONT if it's genuinely funnier there — we are testing what renders. When cheeky=false, stay completely clean.

RULES:
- Classy always: no clip-art energy, no emoji.
- BRITISH MONEY AND MEASURES. These cards are printed and posted in the UK. Any sum of money is in POUNDS — "£400 gear, £2 fish", never "$400". Miles, not kilometres. A dollar sign on the front is a card we cannot sell here.
- Brands/bands/places evoked through objects and colours (a cassette and bucket hat; never logos, never lyrics, never real faces). Song/film TITLES may be name-dropped if the line still parses naturally.
- Occasion lives in the INSIDE text; the front is about THEM.
- INSIDE MODE: auto → write inside_text. own or blank → inside_text = "".

FINAL CHECK — do this LAST, immediately before returning: read all NINE candidate lines once more and name the TURN in each one out loud to yourself. REPLACE any line that has no nameable turn, OR contains "vibe"/"vibes", "level up", "boss", "legend", "goals" or "mode", OR uses a banned title formula ("Master/King/Queen/Lord of ___", "The only ___ in the family", "Born to ___", "Another year ___"), OR would need explaining in a pub, OR is about the occasion instead of their interest. Every candidate you hand over must be one you would be happy to see chosen — a shortlist with two dead lines in it is a shortlist of one.

Return JSON: {"concepts":[{...},{...},{...}]} — one subject, three angles, three formats, three palettes, and three candidate lines inside each.`;
}

/** THE JUDGE — a second, INDEPENDENT pass (Aidan 2026-08-15).
 *
 *  The writer already self-edits, but marking your own homework inside
 *  one call is weak: the model is attached to what it just wrote. This
 *  is a fresh call that never saw the drafting, only the brief and the
 *  finished cards, and its job is to be hard to please.
 *
 *  SELECTOR, NOT REPAIRMAN (Aidan 2026-08-16). It used to see one line
 *  per angle and rewrite the weak ones, which is the hard version of
 *  the job — turning a dud into a winner from cold. Now the writer
 *  hands over a shortlist of three per angle and this pass CHOOSES.
 *  Picking the best of three is a far easier task than repairing one,
 *  and it attacks the real problem, which was variance rather than
 *  ceiling: the good lines were already being written, they just
 *  weren't always the ones that got picked. Rewriting survives only as
 *  a fallback for when all three candidates are dry.
 *
 *  ~£0.003 and ~3s. Cheap insurance on the thing that actually sells
 *  the card. */
function judgeSystemPrompt(): string {
  return `You are a ruthless greeting-card editor at a good independent card shop. You are shown a brief and three card concepts written by someone else. Each concept has its artwork already decided, and a SHORTLIST OF THREE candidate front lines. Your ONLY loyalty is to the person who will receive the card.

YOUR JOB IS TO CHOOSE. For each concept, pick the single best candidate line from its shortlist. You are not looking for a line you would have written — you are looking for the strongest of the three in front of you. Only if ALL THREE are dry may you write a replacement yourself.

Judge every candidate line, and the inside_text, against these, in order:

1. RECOGNITION — would the recipient INSTANTLY know this card is about their thing? The reference must be unmistakable to someone who loves that subject. Vague nods fail: a card about a comedian that could equally be about any comedian is a FAIL. Ask yourself: could I swap the subject for something else and this line still works? If yes, it FAILS.
   COVER THE PICTURE when you test this. The artwork is deliberately generic for films, books, games, bands and teams — we do not draw anyone's invented artefacts or logos — so the LINE has to carry the recognition by itself. A line that only lands because the picture is doing the work is a FAIL. Worked example: "Wand-erful Sister, Always Charming" over wizarding artwork is a generic witch card in words, and it squanders "Always", the one word from those books that everybody knows.
2. THE BUYER — remember who is actually paying. The person choosing this card is usually NOT the fan: a daughter buying for her Harry Potter dad, a mate buying for a United supporter. If she cannot tell at a glance that the card is good, she never buys it and the fan never sees it. So the reference must sit in the FAMOUS layer of that world — what a non-fan would name if you asked them what they know about it — and not in a deep cut only the devoted would catch. A line that requires fandom to appreciate is a FAIL, however clever. Specific is still right; obscure is not.
3. UK AUDIENCE — British English and British sensibility. No Americanisms ("gotten", "candy", "vacation", "y'all", "awesome", "buddy"), no US-centric references, no American spelling. ⚠️ MONEY IS IN POUNDS: a "$" on a card posted from Britain to a British address is an instant fail — "£400 gear, £2 fish", never "$400". Same for miles not kilometres, and British measures generally. It should sound like it was written in Britain, because it was.
4. THE TURN — the test that matters most. EVERY card, all three angles, must contain a surprise you can name in five words or fewer. Quirk is the house voice here, not one of three flavours: a line with NO turn is DRY, and dry is a FAIL even when the line is true, warm, well written and correctly aimed. Judge the turn by its angle:
   • wordplay: the turn is in the LANGUAGE. The pun must be smooth and must actually land. A groan is a fail; a pun that needs explaining is a fail.
   • deadpan: the turn is in the UNDER-REACTION — something absurd reported with a completely straight face. A flat statement of fact with nothing daft in it is the classic dry fail ("Manchester United Comes First", "The only mixologist in the family"). Quiet is fine; empty is not.
   • proud: the turn is in the DISPROPORTION — a grand, sincere honour for a gloriously small and specific domain. Generic praise is a job title, not a card. REJECT ON SIGHT: "Master of the ___", "The only ___ in the family", "King/Queen/Lord of ___", "Born to ___".
5. FIT — right for this relationship and occasion. A card for a nan shouldn't sound like one for a mate.
6. PICTURE — the words and the described artwork must complete each other. If the line would work over ANY picture, it FAILS.
7. CLEAN CRAFT — parses as a natural sentence, correctly spelled, max one exclamation mark, no "vibes/level up/boss/legend/goals/mode".

HOW TO CHOOSE between three candidates that all pass: take the one with the STRONGEST TURN — the biggest double-take for the least effort from the reader. Where two are equally sharp, prefer the more SPECIFIC to this person's world, then the shorter. Never pick a line just because it is safest; a safe line is a dry line wearing a coat.

For each of the three concepts return:
- chosen_index: 0, 1 or 2 — which candidate from that concept's shortlist you picked. Use this whenever any candidate is usable.
- verdict: "pick" when you chose one of the three; "fix" ONLY when all three are dry and you are writing a replacement.
- reason: one short clause. When picking, say what won it ("strongest turn, most specific"). When fixing, name what was wrong with all three.
- front_text: the exact text of the candidate you chose, copied verbatim. If and only if verdict is "fix", your own replacement instead (same angle, must fit the described artwork, max 8 words, must have a nameable turn, must not use a banned formula).
- inside_text: the original if it works; a rewrite if it does not (max 28 words; "" if the original was "").

Be genuinely hard on the shortlist, but remember that choosing is the job. Rewriting all three concepts means you have ignored nine lines someone else already filtered — if you are reaching for "fix" more than once in a set, you are marking your own taste rather than editing.

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
        // Nine candidate lines instead of three — 700 truncated the JSON
        // and the whole set failed to parse.
        max_tokens: 1400,
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
      let concepts: CardConcept[] = (parsed.concepts ?? []).slice(0, 3);

      // The ban list is enforced in CODE, not hope — two prompt passes
      // still leaked "vibes". One corrective retry naming the offenders;
      // if that also fails we ship anyway (logged) rather than error.
      const BANNED_WORDS = /\b(vibes?|level up|bossin?|legend|goals|beast mode|mode)\b/i;
      // Title formulas. The proud angle kept collapsing into a job title —
      // "Master of the Martini", "Master of the Tackle Box", "The only
      // mixologist in the family" — and all three walked past the judge,
      // so this one needs a deterministic floor too (Aidan 2026-08-16).
      //
      // Deliberately NOT banning "Champion/Captain of the ___": the crown
      // isn't the problem, the generic domain is. "Champion of the Perfect
      // Cast" is dry; "Champion of the 6am pier" is exactly the small,
      // specific kingdom the proud angle is supposed to find. So the second
      // pattern bans the generic-flattery domain instead of the title.
      const BANNED_FORMULAS =
        /\b(master|king|queen|lord|ruler) of\b|\bthe only \w+ in the (family|house|world|village)\b|\bborn to\b|\b(of|at) the (perfect|ultimate|finest|greatest|best)\b|\banother year\b/i;
      const isBanned = (t: string) => BANNED_WORDS.test(t) || BANNED_FORMULAS.test(t);

      // The shortlist changed the shape of this check. A banned line is no
      // longer fatal to the card — it is one option out of three, so we
      // strike it and let the judge choose from what is left. Only a
      // concept whose ENTIRE shortlist is banned needs a retry.
      const shortlistOf = (c: CardConcept): string[] => {
        const raw = Array.isArray(c.front_candidates) && c.front_candidates.length
          ? c.front_candidates
          : [c.front_text];
        return raw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim());
      };
      const cleanse = (list: CardConcept[]): CardConcept[] =>
        list.map((c) => {
          const all = shortlistOf(c);
          const clean = all.filter((t) => !isBanned(t));
          if (clean.length < all.length) {
            console.warn('[CARD-LAB] struck banned candidates:', all.filter((t) => isBanned(t)));
          }
          // Keep the banned list only as a last resort so a wiped shortlist
          // still yields a card rather than an empty one.
          return { ...c, front_candidates: clean.length ? clean : all };
        });

      concepts = cleanse(concepts);
      const wiped = concepts.filter((c) => shortlistOf(c).every((t) => isBanned(t)));
      if (wiped.length > 0) {
        const retry = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: conceptSystemPrompt(body.characters) },
            { role: 'user', content: briefLines.join('\n') },
            { role: 'assistant', content: completion.choices[0]?.message?.content ?? '' },
            { role: 'user', content: `Every candidate line for these angles was rejected: ${wiped.map((o) => o.angle).join(', ')}. They used a banned word ("vibe(s)", "level up", "boss", "legend", "goals", "mode") or a banned TITLE FORMULA — "Master/King/Queen/Lord of ___", "The only ___ in the family", "Born to ___", "Another year ___" — which reads as a job title rather than a card. Replace the WHOLE three-line shortlist for those angles only, leaving the other concepts untouched. Every replacement must have a TURN you could name in five words: a pun, an absurdity under-reacted to, or a grand honour for a gloriously tiny domain. Return the complete corrected JSON.` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.5,
          max_tokens: 1400,
        });
        try {
          const reparsed = JSON.parse(retry.choices[0]?.message?.content ?? '{}');
          const fixed: CardConcept[] = (reparsed.concepts ?? []).slice(0, 3);
          if (fixed.length === 3) concepts = cleanse(fixed);
        } catch { /* keep originals */ }
        const still = concepts.filter((c) => shortlistOf(c).every((t) => isBanned(t)));
        if (still.length) console.warn('[CARD-LAB] shortlists still fully banned after retry:', still.map((c) => c.angle));
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
      // Until the judge picks, front_text is just the writer's own first
      // preference — so the set still works if the judge pass dies.
      let judged = concepts.map((c) => ({ ...c, front_text: shortlistOf(c)[0] ?? c.front_text }));
      const notes: Array<{ index: number; kind: 'pick' | 'rewrite'; reason: string; was: string }> = [];
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
                  [
                    `${i + 1}. angle=${c.angle} format=${c.format ?? '?'}`,
                    `   ARTWORK: ${c.art_direction}`,
                    '   SHORTLIST — pick one:',
                    ...shortlistOf(c).map((t, j) => `     [${j}] ${t}`),
                    `   INSIDE: ${c.inside_text}`,
                  ].join('\n'),
                ),
              ].join('\n'),
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.4,
          max_tokens: 900,
        });
        const verdicts = JSON.parse(review.choices[0]?.message?.content ?? '{}').cards ?? [];
        if (verdicts.length === 3) {
          judged = concepts.map((c, i) => {
            const v = verdicts[i] ?? {};
            const shortlist = shortlistOf(c);
            const inside = typeof v.inside_text === 'string' && v.inside_text.trim()
              ? v.inside_text.trim()
              : c.inside_text;

            // A rewrite is the exception, allowed only when the judge says
            // every candidate was dry — and still screened, because the
            // judge runs after the deterministic ban check and its output
            // used to go out unchecked ("Champion of the Perfect Cast").
            if (v.verdict === 'fix' && typeof v.front_text === 'string' && v.front_text.trim()) {
              const rewrite = v.front_text.trim();
              if (isBanned(rewrite)) {
                console.warn('[CARD-LAB] judge rewrite hit the ban list, keeping the shortlist:', rewrite);
                return { ...c, front_text: shortlist[0] ?? c.front_text, inside_text: inside };
              }
              notes.push({ index: i, kind: 'rewrite', reason: String(v.reason ?? 'all three were dry'), was: shortlist.join(' / ') });
              return { ...c, front_text: rewrite, inside_text: inside };
            }

            // Normal path: the judge chose one of the shortlist. Trust the
            // index, but verify it against the text it claims to have
            // picked — a judge that hallucinates an index would otherwise
            // silently ship a different line than the one it reasoned about.
            const idx = Number(v.chosen_index);
            const byIndex = Number.isInteger(idx) && idx >= 0 && idx < shortlist.length ? shortlist[idx] : undefined;
            const byText = typeof v.front_text === 'string'
              ? shortlist.find((t) => t.toLowerCase() === v.front_text.trim().toLowerCase())
              : undefined;
            const chosen = byText ?? byIndex ?? shortlist[0] ?? c.front_text;
            if (byIndex && byText && byIndex !== byText) {
              console.warn('[CARD-LAB] judge index/text disagreed, taking the text:', { byIndex, byText });
            }
            if (chosen !== shortlist[0]) {
              notes.push({ index: i, kind: 'pick', reason: String(v.reason ?? 'stronger turn'), was: shortlist[0] });
            }
            return { ...c, front_text: chosen, inside_text: inside };
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
      typeface: z.string().max(200).optional(),
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
      typeface: z.string().max(200).optional(),
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
        body.typeface ? `TYPE (obey exactly — this card's lettering personality): ${body.typeface}. Draw the words in that idiom, and draw it well.` : '',
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
      typeface: z.string().max(200).optional(),
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

    // art_direction reaches the image model verbatim, and it arrives from
    // the client, so the DNA's "evoke, never reproduce" rule is not the
    // last line of defence — this is. Named artefacts get an explicit
    // override rather than a refusal, so the card still gets made.
    const named = namedArtefacts(body.art_direction);
    if (named.length) {
      console.warn('[CARD-LAB] art_direction named protected artefacts, overriding:', named);
    }

    const prompt = [
      quirkyDna(body.characters),
      '',
      QUIRKY_FORMATS[body.format === 'editorial' ? 'hero' : body.format],
      '',
      `ILLUSTRATION: ${body.art_direction}`,
      named.length
        ? `⚠️ OVERRIDE — the brief above names ${named.join(', ')}, which belong to someone else's property and must NOT appear. Do not draw them in any form, however stylised, and do not draw a near-copy under another name. Replace each with an ORDINARY generic object from the same world that anyone could own, and keep everything else about the composition. The palette and mood carry the reference; the protected objects do not.`
        : '',
      body.palette ? `PALETTE (obey exactly): ${body.palette}` : '',
      body.typeface ? `TYPE (obey exactly — this card's lettering personality): ${body.typeface}. Draw the words in that idiom, and draw it well.` : '',
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
