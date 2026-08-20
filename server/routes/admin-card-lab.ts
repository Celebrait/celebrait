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
import { desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { db } from '../db';
import { cardGenerations, cardTemplates, users } from '@shared/schema';
import { isMilestone } from '@shared/catalogue';
import { publicImageUrl } from '../image-storage';
import { isR2Enabled, r2Put } from '../r2-storage';
import { openai } from '../utils/shared';
import { getProvider } from '../providers/registry';
import { logGeneration } from '../prompts/generation-log';
import { llmCostCents } from '../prompts/llm-cost';

/** The model behind the concept writer AND the judge. gpt-4o until
 *  2026-08-17, when Aidan called the flatness ("doesn't feel great") and
 *  the account turned out to reach gpt-5.5 — four generations newer.
 *  Env-overridable so an A/B is one restart, no deploy:
 *    CARD_LAB_LLM=gpt-4o npm run dev   # the old writer, for comparison */
export const CONCEPT_MODEL = process.env.CARD_LAB_LLM ?? 'gpt-5.4';

/** Params that differ across model generations. The gpt-5 family takes
 *  max_completion_tokens (which ALSO covers its internal reasoning, so
 *  the cap gets 4× headroom or the JSON is starved) and pins its own
 *  temperature; gpt-4o keeps the classic knobs. */
function conceptParams(maxTokens: number, temperature: number) {
  if (CONCEPT_MODEL.startsWith('gpt-4')) {
    return { model: CONCEPT_MODEL, max_tokens: maxTokens, temperature };
  }
  // NOTE: reasoning_effort looked like the latency dial but the chat
  // completions API rejects it for the gpt-5.5 alias ("invalid model
  // ID") — measured 2026-08-17, don't re-add without testing. Latency
  // is chosen by MODEL instead; see the timing table in the commit.
  return { model: CONCEPT_MODEL, max_completion_tokens: maxTokens * 4 };
}

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

⚠️ SOMEONE ELSE'S PROPERTY — EVOKE IT, NEVER REPRODUCE IT. This card gets printed and sold, so anything you draw is merchandise. There are TWO different cases and they have different lines:

  A) FICTIONAL WORLDS (a film, book, game, comic): the invented things ARE the property. No named artefact, creature, gadget, vehicle, weapon, building or costume that exists only inside that story.
  ⚠️ REWORK THE WORLD, NEVER THE THING. This is a creative instruction, not a refusal — a blank, cautious card is a failure too. Do NOT draw the protected object with modifications, because a near-copy is MORE dangerous than an honest one: recognisably-similar is precisely what gets challenged. Instead, go and find a DIFFERENT object from the same world — one nobody owns — and make it unmistakably that world through STYLE: its colour signature, its era, its light, its texture, its typography. A wizarding card can be candles, a brass key, a battered trunk, a night sky, all in bottle green and tarnished gold. A space card can be a horizon with two suns' worth of light and a sand-scoured helmet-less pilot's kit. The fan knows instantly; nothing on the card belongs to anyone else. Every card we make is already redrawn from scratch in a flat three-ink print style — lean on that, it is real transformation, and it is ours.

  B) BRANDS AND SERVICES (Netflix, Guinness, Tesco, a football club, a supermarket): these have no invented artefacts — what they own is the MARK. So the line moves, and much more is open to you. OUT: the logo, the wordmark, the brand's name rendered in its own lettering, a crest, a badge, an official mascot, a packaging label copied faithfully. IN, and encouraged: the brand's own COLOUR SIGNATURE, the SHAPES of the everyday objects involved, the on-screen or in-shop LANGUAGE everybody knows, the rituals and the running jokes of using it. A streaming card in deep red and near-black, with a remote, a paused screen and the words everyone recognises, is unmistakably that brand and reproduces nothing.
  The test for a brand is NOT "would this appear in their gift shop" — it is "could someone mistake this for something the company itself made or endorsed". A knowing card about the EXPERIENCE fails that test in the good way: nobody thinks the company made it.
  GENERIC PRODUCTS ARE ALWAYS FINE. A jar of mayonnaise, a tin of beans, a pint of stout, a takeaway carton — draw them freely. Only the specific brand's label, logo or name-in-its-own-typeface is out; the object underneath belongs to everybody.
  C) THE REAL WORLD — DRAW IT. Nobody owns reality, and being timid here has cost us far more cards than it ever saved. This case exists because it was MISSING, and its absence read as a ban (Aidan 2026-08-18: "we might be overblocking... we can draw Old Trafford").
  ✅ REAL PLACES AND REAL BUILDINGS ARE OPEN, and they are usually the most specific thing available. Old Trafford, Anfield, the Kop, Wembley, the Blackpool Tower, a Balearic headland, the Northern Quarter, a specific pub, a stretch of the Pennine Way, a lido, a pier. Draw them confidently — a stadium under floodlights says WHICH club without going anywhere near the crest, and that is exactly the specificity our football cards have been missing.
  ✅ SO IS THE REST OF THE REAL WORLD: real streets, real weather, real landscapes, real transport, real food, real events, real eras. A card can be unmistakably Ibiza by drawing Ibiza.
  ⚠️ THE LINE IS THE MARK, NOT THE PLACE. Draw the ground; do not paint the club's crest on the stand. Draw the high street; do not letter the shopfronts with real logos.
  Worked example — a wizarding-school story: DRAW a striped scarf in two colours, an owl, a stack of battered spellbooks, a candle stub, a brass key, a night sky. DO NOT DRAW the winged golden ball, the school crest, a house badge, the castle, a named character, or any symbol from the books. The card still reads as that world; it just does it with things anyone could own.
The bans above are hard limits, not stylistic preferences. Substitute a generic equivalent and move on. But do not let them make you cautious about case C — a real place, drawn well, is free specificity.

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
  `PRIMARILY objects, food, drink, botanicals, the kit of a hobby. Animals and human figures are PERMITTED but never required. Where the subject genuinely needs a person present, HUMAN FIGURES AS GRAPHIC SHAPES. Figures are ILLUSTRATED, never photographic.
  ✅ FACES ARE ALLOWED WHEN THE MEDIUM CARRIES THEM. A mid-century children's-book face, a linocut face, a papercut face, a fashion-illustration face — drawn with the same marks as everything else on the card and simplified to the level that medium works at. Two dots and a line is a face, and a good one. This is how greeting cards have always looked, and being frightened of it left every person on our cards an anonymous silhouette.
  ⛔ WHAT IS BANNED IS THE RENDERED FACE: photographic or semi-photographic skin, modelled shading, wet glossy eyes, the almost-real face that lands in the uncanny valley. That is the single most visible way a printed card fails, and it is a RENDERING failure, not a face failure. If the face is drawn in the same hand as the rest of the card, it is right; if it looks like a photograph someone has painted over, it is wrong.
  Silhouettes, back views and cropped figures are still excellent choices and often the strongest — they are just no longer the only option. A figure is someone DOING something, not a portrait posed for a camera.
  ✅ A PUBLIC FIGURE MAY BE CARICATURED (Aidan 2026-08-18: 'we can even sketch donald trump — we have to be a little daring here'). Politicians, and people famous for a public role, drawn as SATIRICAL CARICATURE — exaggerated, obviously a drawing, obviously a comment. Britain has sold cards like this for a century and it is an express exception in the law. Four conditions, all of them: it must read as CARICATURE and never as a photographic likeness; it must be about their PUBLIC role, never their private life; it must never suggest they endorse the card or the recipient; and it must never imply anything false and damaging — no crimes, nothing sexual, no words put in their mouth as though genuinely said.
  ⛔ STILL NEVER: a private individual, anyone not famous, a named member of the public, a child, or a photographic likeness of anybody at all. And never the RECIPIENT — we do not know their face, and this card is not the photo product.`;

/** FREE STYLE — the house style stepped aside (Aidan 2026-08-18).
 *
 *  "Give me the option to toggle on the ai deciding what style to do.
 *  Based on a specific brief of current, non ai, etc. Nail this and it
 *  might work as gpt image 2 is bang on."
 *
 *  Deliberately NOT a sixth house style. It swaps the fixed MEDIUM for a
 *  chosen one while keeping the whole craft floor — clean type, safe
 *  margins, no invented facts, the IP rules. The bet is that our one
 *  visual language, good as it is, was failing whole categories
 *  (nightlife, kids, baby showers) and the model is now capable enough
 *  to pick a better idiom than we can pre-specify.
 *
 *  Everything here is about QUALITY, not taste: name a real medium, and
 *  avoid the specific things that make generated art look generated. */
export function freeStyleDna(level: CharacterLevel = 'objects'): string {
  const rule =
    level === 'figures' ? MOTIF_WITH_FIGURES
    : level === 'animals' ? MOTIF_WITH_ANIMALS
    : MOTIF_OBJECTS_ONLY;
  return `ART DIRECTION — YOU CHOOSE THE MEDIUM. There is no house style on this card. Your job is to pick the illustration idiom this particular subject deserves and execute it as a real designer would.

1. NAME A REAL MEDIUM, PRECISELY — AND ONE THAT BELONGS TO THIS SUBJECT. Not "illustration", which is not an answer. A medium is a way of MAKING A MARK that has physical rules you can obey: a printing process, a paint and its behaviour, a cutting or stitching or firing technique, a named historical illustration school, the house style of a particular trade or decade. If you cannot say what its LIMITS are — how many inks, what edge it leaves, what it physically cannot do — it is not a medium, it is a mood.
   ⚠️ REACH PAST THE OBVIOUS ONES. Measured across thirty cards: FOUR media accounted for 83% of them, while sixteen others were available and never used once. That is not a range, it is a habit with a wide menu attached, and a rack built from it looks like four cards however different the words are. Before you settle, name to yourself two media you have NOT reached for and ask whether either suits this subject better.
   ✅ THE BEST CHOICES COME FROM THE SUBJECT'S OWN VISUAL HISTORY, not from a general list of crafts — the poster tradition of that sport, the packaging of that era, the print culture that grew up around that world, the way that thing has actually been drawn by people who cared about it. Observed on a cycling brief: "Italian Futurist cycling-poster illustration" beat everything picked off a menu, because it came from the subject rather than from a shelf.
   Half-committing to a medium is what makes work look generic.
   ⚠️ CHOOSING THE MEDIUM IS A FIT DECISION, NOT A PICK FROM THAT LIST. Two tests, both applied BEFORE you commit:
   · THE THUMB TEST — cover the words. Do the medium, the ground colour and the letterforms still tell someone roughly what world this card belongs to? A real observed failure: a Moana card for a four-year-old came back as a bright orange ground with heavy blue Swiss poster type. Handsome design, belonging to no world at all — it could have been a card about anything, and the artwork was doing none of the work. The line was fine; the look was borrowed from a different shop.
   · WHO IS OPENING IT — a card for a small child and a card for a thirty-year-old cannot wear the same medium, however good the joke is. Editorial, brutalist, ironic and fashion idioms read ADULT. Children's-book gouache, papercut, crayon, storybook screen print read YOUNG. Take the age from the brief and let it rule out half the list before you start.

2. ⚠️ IT MUST NOT LOOK AI-GENERATED — AND THAT IS ABOUT THE DEFAULT LOOK, NOT ABOUT ANY FORBIDDEN TECHNIQUE. NOTHING IS OFF THE TABLE HERE. Gloss, airbrush, gradients, chrome, deep shadow, photographic collage, hyperreal shine: all legitimate when the medium you chose genuinely uses them. Airbrushed 70s poster art IS gradients and glow — hard-masked edges, visible grain, candy shine — and it is on the list above. An art deco travel poster can have polished metal in it. Do not flatten a medium that is not flat.
   What gives generated work away is never the technique; it is the ABSENCE OF A CHOSEN ONE — the factory setting applied to nothing in particular:
   - a soft sheen laid over everything regardless of what the material is
   - plastic lighting: global glow, fake bokeh, lit from nowhere
   - dead-centre symmetry, the subject floating in the middle of the frame
   - over-detailed backgrounds with no hierarchy, every inch busy, nothing to rest on
   - mushy edges where the medium you named would leave a hard one
   - the default purple-to-teal gradient palette
   - random decorative elements floating with no reason to be there
   THE TEST IS COMMITMENT, NOT RESTRAINT. A linocut has no gradients because the gouge cannot cut one; an airbrush has almost nothing BUT gradients. Each is right when it follows its own medium's logic and wrong when it is the machine's habit leaking through. Pick a craft and obey ITS rules — including the shiny ones.

3. IT MUST LOOK LIKE 2026, not any other year. What a good British studio would put out now: confident, edited, a real point of view. What dates a card is DATED EXECUTION, never a colour family: corporate flat-vector clip art, stock figures with oversized limbs, gradient-blob backgrounds behind nothing, decoration with no idea under it. ⚠️ Soft and pale palettes are NOT dated and are not the failure — a soft card built with real contrast and a confident hand is as current as anything on a shelf in 2026. What is always dated is DINGE: colour greyed or browned down to look heritage. Soft means light-filled, never muddy. Current means considered, not loud.

4. COMPOSITION IS A DECISION. Scale contrast, a clear focal point, deliberate empty space, something cropped by the frame. A card is looked at from three feet away on a shelf — it must read instantly, then reward a closer look.

5. MOTIFS: ${rule}

6. THE NON-NEGOTIABLES, whatever medium you choose:
   - THE TYPE PRINTS PERFECTLY CLEAN: no texture, distressing, misregistration, ghosting or stray marks on the letters, however textured the artwork is. Every glyph solid and fully formed.
   - SAFE MARGIN: every letter sits at least a tenth of the card's width clear of all four edges. This card gets trimmed. Artwork may bleed; type never does.
   - The lettering personality is given in the TYPE line — obey it and draw it well.
   - The palette is given in the PALETTE line — obey it exactly.
   - Never draw a logo, wordmark, crest, badge or any invented artefact belonging to a film, book, game or brand.
   - Render EXACTLY the words given, spelled correctly, nothing else.

The bar: someone in a card shop picks it up and assumes a person made it.`;
}

/** ⚠️ THE IMAGE IS THE CARD — IT IS NOT A PICTURE OF ONE.
 *
 *  Observed 2026-08-18 (Aidan: "it's rendered it as a 3d greetings card
 *  rather than a square image... think its a mistake"): a Moana card came
 *  back as a PHOTOGRAPH of a peach greeting card lying on a grey surface,
 *  drop shadow and all. The design was fine — it was just two inches
 *  across in the middle of a picture of a desk, so the printed card would
 *  have a picture of a card on it.
 *
 *  The cause was the closing line of every render prompt: "full-bleed
 *  greeting-card front". "Greeting-card front" is a NOUN PHRASE naming an
 *  object, and "full-bleed" is print jargon the image model does not
 *  reliably read as an instruction. Asked for a greeting card, it drew
 *  one. Shared here because all three render paths ended with that same
 *  sentence and would otherwise drift apart. */
export const IS_THE_CARD_ITSELF =
  '⚠️ THE IMAGE IS THE PRINTED SURFACE ITSELF, NOT A PICTURE OF A CARD. You are drawing the artwork that gets printed, so it runs to all four edges of the image and beyond. NEVER show a greeting card as an object inside the picture: no card lying on a table, desk or surface, no paper edge or corner, no drop shadow, no rounded corners, no mount, no white margin framing the design, no mockup, no product photograph. A decorative border PRINTED ON the card is fine; the card appearing as a physical object within the image is not. If a viewer could point at the edge of a card inside this picture, it is wrong.';

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
  // ⚠️ NARROWED 2026-08-18. This used to block the bare words "emblem",
  // "badge" and "coat of arms", which are ordinary decorative nouns — a
  // rosette, a heraldic flourish, an invented sporting emblem belong to
  // nobody, and blocking them cost us artwork while protecting no one.
  // "Logo", "wordmark", "crest" and "insignia" stay absolute: they
  // essentially only ever mean a real organisation's registered mark.
  // "Emblem"/"badge" now only trip when attached to an actual body.
  [/\b(logo|wordmark|crest|insignia)(s|es)?\b/i, 'logos, crests and wordmarks'],
  [/\b(club|team|brand|company|official|school|house|regiment|university|council)('?s)?\s+(emblem|badge|arms|coat of arms)(s|es)?\b/i, "a real organisation's emblem"],
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

// ── THE OCCASION BRAIN (Aidan 2026-08-17, SCOPE_OCCASION_INTELLIGENCE) ──
// Every occasion carries its own buyer mindset, and the engine was
// treating them all as "birthday with different words". One profile per
// occasion, injected into writer AND judge the way `cheeky` already is.
// NOT 21 engines: the machinery is untouched, the profile just aims it.
//
// `humour: 'off'` is the field that matters most. A joke on a sympathy
// card is the single worst card we could print, and without this switch
// the turn test DEMANDS one. Serious occasions swap to a dedicated
// writer/judge prompt pair rather than threading conditions through the
// joke-optimised one — the requirements genuinely differ, sharing 80%
// of a comedy prompt would be worse.
//
// Briefs are constraints and grammar only — NO sample sentences, they
// get copied verbatim (paid that lesson twice).
export type HumourLevel = 'full' | 'gentle' | 'off';
export interface OccasionProfile {
  key: string;
  humour: HumourLevel;
  brief: string;
}

const PROFILE = (key: string, humour: HumourLevel, brief: string): OccasionProfile => ({ key, humour, brief });

export const OCCASION_PROFILES: Record<string, OccasionProfile> = {
  sympathy: PROFILE('sympathy', 'off',
    `Comfort. The reader has lost someone, and presence beats cleverness: plain, quiet, true words. ABSOLUTELY NO jokes, puns, wordplay, cheek or exclamation marks. No advice, no silver linings ("at least…"), no timelines ("time heals"), no assumed faith. The interest appears only as gentle solace — a quiet corner of their world, holding still. Soft, pale, muted palette; the ONE occasion where three quiet grounds is correct.`),
  getwell: PROFILE('getwell', 'gentle',
    `Lift the room without ever mocking the illness — NEVER joke about the body, the diagnosis or the hospital. The seam is their world WAITING for them: paused mid-action, kit ready, resuming soon. Fresh, light, hopeful palette, nothing clinical. Gentle wit only; cheek only if rude mode was explicitly ticked.`),
  wedding: PROFILE('wedding', 'gentle',
    `For the COUPLE — write to two people sharing one day, never just one of them. Joy and elegance over gags; wit welcome but light. Palette bleached, airy and celebratory — this occasion overrides the deep-ground habit, bright and warm reads right. Pairs and twos in the motifs. Never wedding-night innuendo, never in-law jokes.`),
  anniversary: PROFILE('anniversary', 'gentle',
    `From one half of a couple to the other — read WHO for direction and keep the register intimate, not matey. Shared history is the seam: the years number (only if the brief gives it) is gold, private rituals, the thing they still do together. Never soppy mush, and never jokes at the marriage's expense harsher than a fond nudge.`),
  engagement: PROFILE('engagement', 'full',
    `Excitement and the word YES. The ring is the obvious emblem — at most one card may nod to it, never all three. Champagne-bright palette welcome. The couple's shared world beats generic romance every time.`),
  baby: PROFILE('baby', 'gentle',
    `Tenderness, plus the one permitted joke seam: sleep deprivation and the beautiful chaos ahead. ONE BABY unless the brief says otherwise — never assume twins or numbers; an invented "double" is a factual claim about someone's pregnancy and an observed failure. Palette is soft mid-tones and warm creams — never the moody masculine default, and NEITHER pink NOR blue may lead any card's palette unless the brief states a gender: a gender-reveal brief is DELIBERATELY neutral, that is the entire point (a pale blue ground on a gender-reveal card is a failed card). Smallness is the visual seam — tiny things beside big things.`),
  graduation: PROFILE('graduation', 'full',
    `Pride in the achievement plus affectionate relief that it is finally over. Mine what they STUDIED or what comes next, not generic scrolls; mortarboard once per set at most. Bright, forward-looking palette.`),
  christmas: PROFILE('christmas', 'full',
    `The interest leads and Christmas inflects: frost, candlelight, deep greens and one hot red, AT MOST one festive object folded into the interest's own kit. BANNED: baubles, trees or tinsel stapled beside the subject — an observed repeat failure. Deep candlelit grounds are right here.`),
  valentines: PROFILE('valentines', 'gentle',
    `Romance with wit, private not public — the best line sounds like it could only pass between these two. Innuendo stays seaside-postcard unless rude mode. Red is welcome but not obligatory; an unexpected palette reads more personal than crimson.`),
  thankyou: PROFILE('thankyou', 'gentle',
    `Gratitude for a SPECIFIC act — mine what they actually did and name its world. Small, warm, sincere; wit stays light. Never gushing, never adjective-mush.`),
  fathersday: PROFILE('fathersday', 'full',
    `Affectionate mickey-take from child to dad. THE DAD JOKE IS THE GENRE: the groan-is-a-fail rule is SUSPENDED for this occasion only — a proper eye-roll groaner is on-brief, and at least one card should carry one. Mine dad-hood itself alongside the interest: the sacred chair, the thermostat, the shed. Warm ribbing, never contempt.`),
  mothersday: PROFILE('mothersday', 'full',
    `Warmth first, wit second — the mickey-taking dial sits well below Father's Day. Celebrate her through HER thing, never through chores or domestic clichés (no aprons unless baking genuinely is her thing). Palette warmer and lighter than the house default. "Mum", never "Mom".`),
  newhome: PROFILE('newhome', 'full',
    `Boxes, keys, paint charts, the first brew in an empty kitchen — the move's own world meets theirs. Fresh-start palette. Mortgage misery only as the lightest nudge.`),
  newjob: PROFILE('newjob', 'full',
    `Pride plus first-day nerves. If the brief names the new role, mine ITS world; otherwise the leap itself — the lanyard, the commute, the too-keen first email.`),
  retirement: PROFILE('retirement', 'full',
    `Freedom is the joke seam: the alarm clock retires too, weekdays become the new weekend, and the years number (if the brief gives one) is gold. Golden-hour warmth suits it. The joke is the FREEDOM, never age or decline.`),
  goodluck: PROFILE('goodluck', 'full',
    `Nerves and belief. The thing they are attempting IS the subject — mine its world hard. Bright, forward palette. Never a jinx joke about failing.`),
  congratulations: PROFILE('congratulations', 'full',
    `Find WHAT is being congratulated in the brief and mine that achievement's own world — the test passed, the thing finished. Generic confetti praise is the failure mode. If the brief doesn't say, celebrate them through the interest.`),
  justbecause: PROFILE('justbecause', 'full',
    `No occasion at all — the card itself is the gesture. The front is purely them and their thing; do not invent a reason or mention one. These read warmest of all precisely because nothing prompted them.`),
  birthday: PROFILE('birthday', 'full',
    `The buyer wants THIS person celebrated, not birthdays in general. A milestone age in the brief ("21st", "40th", "60th") is gold — the number belongs in the artwork, and the register shifts with it: early twenties wants energy and cheek, middle years wants knowing self-deprecation, later birthdays want warmth and pride. ⚠️ ONLY if the brief states it: when no age is given there is NO age and NO number on the card — inventing "the big 40" for a person whose age you do not know is a factually wrong card, printed and posted (observed failure). Never jokes about being old unless rude mode invites mild ribbing. BANNED PROPS: balloons, cake, candles, banners or wrapped presents beside the subject — an observed repeat failure.`),
  celebration: PROFILE('celebration', 'full',
    `A celebration without a named profile — read the typed occasion closely, mine ITS world (objects, colours, numbers, rituals) and let it inflect the palette and one motif. Any milestone number in it is gold and belongs in the artwork.`),
};

// ── THE BIRTHDAY WORLD (occasion #1) ─────────────────────────────────
// Built to DESIGN_BIRTHDAY_WORLD.md, signed by Aidan 2026-08-17. This
// is the first occasion to get its own world rather than a shared
// profile line — the pattern every other occasion will follow.

/** ⚠️ RUDE IS A REGISTER, NOT A MODIFIER (Aidan 2026-08-19). It was a
 *  checkbox layered over another tone, which allowed rude+warm — the
 *  engine switching to gentle humour and then swearing over the top.
 *  RESEARCH_UK_CARD_MARKET.md is unambiguous that it deserves better:
 *  unmasked profanity sits in the bestseller wall's top three, recurs
 *  at 30 and 50, and Scribbler built 38 shops on it. It is a lane the
 *  market shelves, so it is a tone here. The cheeky brief already
 *  described itself as sitting "between funny and rude", so the axis
 *  was always four points with one of them missing. */
export type BirthdayTone = 'funny' | 'warm' | 'rude' | 'cheeky';

/** D3: what the buyer picks. Each tone still yields three different
 *  cards through the existing angle machinery — the tone sets the
 *  register, the angles keep the range. */
const BIRTHDAY_TONES: Record<BirthdayTone, string> = {
  funny: `TONE — FUNNY. The biggest-selling birthday register in Britain, and the widest: it runs from a gentle observation all the way to properly taking the mickey. Make them laugh out loud, not smile politely. The joke is the product: if a card here has no laugh in it, it has failed even if it is warm and true. Sharpness is welcome — the fond dig, the thing you would only say to someone you love, seaside-postcard innuendo — everything except actual swearing, which is its own register.`,
  warm: `TONE — WARM. Affection first, wit second — the card someone keeps on the mantelpiece for a month. Still SPECIFIC and still with a turn: warm is not vague, and "you're amazing" is not warmth, it is filler. Think fond, noticing, generous. No mickey-taking, no roasting, no age jokes at all in this tone.`,
  // ⚠️ RETIRED 2026-08-19, kept only so old rows still resolve. Aidan:
  // "Honestly I have a problem with Funny, cheeky warm, rude... Funny
  // warm rude?" He is right: cheeky was defined by what it sat BETWEEN,
  // which is the tell that it was not its own register. Its territory —
  // mickey-taking without swearing — is simply what funny does when it
  // is sharp, and that permission now lives in the funny brief. Three
  // registers, and each one is a different ASK: make them laugh, make
  // them feel something, make them swear.
  cheeky: `TONE — FUNNY (SHARP). Make them laugh, and lean into the mickey-taking end of it: the fond dig, the thing you would only say to someone you love, seaside-postcard innuendo. No actual swearing — that is the rude register.`,
  rude: `TONE — RUDE. The far end of the same axis cheeky sits on, and a lane of its own rather than a funny card with swearing added. The swearing is not the joke — it is the register the joke is told in, so the line underneath must still be sharp enough to survive with the words taken out. Affectionate always: this is how close friends actually speak to each other, never contempt. See the RUDE MODE block above for what is unlocked and how it is set.`,
};

/** The three age worlds. Bands from the research pack: what the market
 *  actually jokes about at each stage, not our guesses. */
function birthdayAgeBlock(age: number | null): string {
  if (age === null) {
    return `AGE — NOT STATED, so there is NO age on this card. No number, no birth year, no "another year older", and no age jokes of any kind: you do not know how old they are and a wrong guess is a ruined card. Build entirely from the person and their thing.`;
  }
  // D1: the roast is allowed but CALIBRATED — the joke changes shape by
  // band, and decline mockery is banned at every age.
  // ⚠️ SIX BANDS, from the milestone aisle scans in
  // RESEARCH_UK_CARD_MARKET.md (16/30/50/70/80 added 2026-08-19). The
  // three-band version was wrong at BOTH ends: a five-year-old got the
  // threshold brief about hangovers and car insurance, and 60/70/80
  // shared one block despite the shops pulling them three different
  // ways. The arc the scans show is that MOCKERY PEAKS IN THE MIDDLE
  // AND VANISHES AT BOTH ENDS — pure celebration for kids, encouragement
  // at 16, threshold at 18–21, loss comedy at 30–40, defiance at 50,
  // era at 60, praise at 70, warmth at 80.
  const band =
    age <= 2
      ? `AGE BAND — BABY (${age}). ⚠️ THE RECIPIENT CANNOT READ AND THE REAL AUDIENCE IS THE PARENTS — this card is a KEEPSAKE ABOUT the child, not a message TO them, and it will live in a memory box to be re-read years from now. The material is the year's FIRSTS and the tiny observed truths of this exact age: what they have just learned to do, what they are obsessed with, the daft daily rituals every parent of a ${age}-year-old recognises. A word-portrait of the baby is the card that gets kept. Warmth leads, wit is gentle, and NEVER a joke at the parents' exhaustion unless it lands as solidarity. The artwork's job here is to charm the adults and the mantelpiece as much as the child.`
      : age <= 12
      ? `AGE BAND — CHILD (${age}). ⚠️ NOBODY IS BEING ROASTED. This is pure celebration: the number is huge and exciting, the thing they love is the whole world, and the card is delighted for them. NO irony, no self-deprecation, no jokes at their expense, and nothing about getting older — those are adult genres and they read as mean here.
⚠️ WHO IS READING IT: the WORDS are usually read ALOUD by an adult, so they may carry a wink the grown-up enjoys — but the ARTWORK belongs entirely to the child and must delight THEM. Nothing editorial, nothing ironic — the register is delight.`
      : age <= 17
        ? `AGE BAND — TEEN (${age}). Encouraging, not ironic — this is the one adult-adjacent band where the roast is switched OFF. The shops run "Sweet 16", "OMG You're 16", "16 And A Superstar", gaming and youth-culture references; self-deprecation is conspicuously absent. Treat them as arriving somewhere good, never as losing anything. ⚠️ The buyer is almost always a PARENT, GRANDPARENT or aunt, so cheek must stay well inside what a nan will hand over.`
        : age <= 25
          ? `AGE BAND — THRESHOLD (${age}). The joke is CROSSING A LINE: doors opening, permissions arriving, being trusted with things you are gloriously unprepared for. Loud, energetic, meme-fluent.
⚠️ USE THIS GENERATION'S ICONOGRAPHY, NOT THEIR GREAT-GRANDMOTHER'S. Observed failure: a 21st came back with ceremonial keys on all three cards — the "key of the door" is a tradition that died decades before this recipient was born, and to them it reads as wallpaper from a nan's card. The same goes for any symbol you know from OLD cards rather than from being ${age} now. Mine what crossing this line looks like THIS year — unless the brief itself asks for retro, in which case play it knowingly.
⚠️ MINE THE FIRSTS THAT BELONG TO THIS EXACT AGE — the things only someone arriving HERE would recognise. ⚠️ BUT NOT THE PAPERWORK OF IT: permissions, checks, forms, signatures and the admin of being newly allowed things is the seam every card reaches for first, and three cards deep it is one joke wearing three palettes (observed on the rack, 2026-08-20). The permissions are the least interesting true thing about this age. What it FEELS like to arrive here, and what these years are actually spent doing, is the material.
⚠️ AND DO NOT BORROW FROM THE LATER BANDS, which is how this one fails. Life admin, paperwork, passwords, insurance, mortgages, bad knees, early nights, aching backs and being tired all the time are THIRTIES AND FORTIES material. On an ${age}th they are somebody else's joke wearing this number: observed failure, "18 is mainly forms, passwords and a hangover" — true of any adult, and nothing at all to do with being eighteen.
⚠️ NEVER AN AGEING JOKE. Nobody here is old, declining or past anything. Observed failure: a card punning on "proof of age" that resolved instead onto AGEING — a clean pun landing on exactly the wrong idea. They are ARRIVING, and every line should know it.
⚠️ The buyer is very often a PARENT or GRANDPARENT — cheeky is fine, never something a nan would be embarrassed to hand over.`
          : age <= 49
            ? `AGE BAND — LOSS & KNOWING (${age}). The decade just ended is the material, and the shops reach for EXPIRY every time: "twenties has now expired", "the passing of your twenties", "thirties? completed it mate". Alongside it, self-deprecation delivered completely straight — the age is fine, it is the little surrenders that are funny: the good chair, the early night defended as a treat, the noise a person makes standing up. Era references from their youth land well.`
            : age <= 65
              ? `AGE BAND — DEFIANCE & ERA (${age}). Not declining — DEFIANT. The shops are full of "fab at 50", "still rocking it", "considered to be a mature and sensible age" said with a completely straight face. Era nostalgia starts here, not at 60: the music, the telly, the tech of their youth is fair game and lands hard — reach for what THIS person's era actually looked like rather than the first nostalgia prop that comes to mind.`
              : `AGE BAND — ELEVATION (${age}). ⚠️ THE JOKE PRAISES THEM, IT DOES NOT MOCK THEM. The market's own line for this band is "I'm not saying you're old, but if you were a whisky you'd be really expensive" — maturity as PREMIUM. Vintage, aged, sought-after, seen-it-all-done-it-all. Nostalgia leads and the affection is unmistakable: what the world was like when they arrived, the habits everyone in the family knows are theirs.
⚠️ NEVER decline, frailty, memory or "how much longer" jokes — the one way this band goes badly wrong.${age >= 76 ? ' ⚠️ AND AT THIS AGE WARMTH LEADS: humour still belongs on the card but it SERVES the sentiment rather than carrying it — "80 incredible years of you" is the register, with the joke supporting it.' : ''}`;

  // The birth-year carve-out, bounded tightly. Derived arithmetic on a
  // number the BUYER typed is not the invented-fact class — but it only
  // holds for a stated milestone, so the rule is spelled out in full.
  const birthYear = new Date().getFullYear() - age;
  return `${band}
THE NUMBER IS ARTWORK: ${age} belongs in the design — the motif can BE the number, or the number can be built from their world. Almost nobody does this and it is instantly personal.
⚠️⚠️ BUT SAY IT ONCE PER CARD, NOT TWICE. Observed on a set of 18ths: every card drew the number large in the artwork and ALSO began its line with that same number followed by a full stop — printed twice on all three, which reads as a mistake rather than a design. Decide per card WHERE the number lives:
  · IN THE ARTWORK — then the line must NOT state it. The picture is already saying ${age}, so the words are free to say something else entirely, and that is usually the better card.
  · IN THE WORDS — then the artwork carries the subject instead, and the number is not drawn.
Never both. Cover one with your thumb and the card should still tell you the age.
⚠️ AND DO NOT BEGIN EVERY LINE WITH IT. A set whose three fronts all open with the number and a full stop is one template three times, whatever the rest of each line does — and that opening is a habit, not a style. AT MOST ONE card may start that way. The others must earn the number differently: fold it into the grammar of the sentence, pun on it, count something with it, or say nothing and let the picture carry it.
BIRTH YEAR — you may use ${birthYear}. This is DERIVED (this year minus the stated age), not invented, so the "born in ${birthYear}" and "the road to ${age}" genres are open to you: what was in the charts, on the telly, in the shops. ⚠️ This licence exists ONLY because the buyer told us the age. Never state any other date, year or age as fact.`;
}

/** Pull a stated age out of free-text occasion ("60th", "her 21st",
 *  "turning 40"). Deliberately conservative: no age found means no age
 *  used, which is the safe direction. */
export function statedAge(occasion: string | undefined): number | null {
  const t = occasion ?? '';
  const m = t.match(/\b(\d{1,3})\s*(?:st|nd|rd|th)\b/i) ?? t.match(/\bturning\s+(\d{1,3})\b/i) ?? t.match(/\bage\s+(\d{1,3})\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 1 && n <= 110 ? n : null;
}

/** The birthday occasion brief, composed per request. Replaces the
 *  static birthday profile whenever the occasion classifies as one. */
export function birthdayProfile(tone: BirthdayTone, age: number | null): OccasionProfile {
  return {
    key: 'birthday',
    humour: tone === 'warm' ? 'gentle' : 'full',
    brief: `${BIRTHDAY_TONES[tone]}

${birthdayAgeBlock(age)}

WHAT A BIRTHDAY CARD IS FOR: the buyer wants THIS person celebrated, not birthdays in general. Their thing leads every card; the birthday inflects it. A card that would suit anyone having a birthday has failed.
RECIPIENT SEAMS worth mining when the brief points at them: for a mum, the FAMILY DYNAMIC is rich material (the favourite-child running joke, the phone calls, being told to eat more) alongside genuine tenderness — both are stocked in real shops; for a dad, the kit, the shed, the chair, the thermostat; for a mate, the shared history; for a colleague, keep it warm and safe.
⚠️ BANNED PROPS, an observed repeat failure: balloons, cake, candles, banners, party hats or wrapped presents sitting beside the real subject. They are what a card uses when it has nothing to say. The number, their world's own objects, and the palette carry the occasion instead.`,
  };
}

/** Order matters: sympathy is checked first (safety), and named occasions
 *  beat the bare-ordinal birthday catch ("60th anniversary" must reach
 *  anniversary, not birthday). Free text that matches nothing gets the
 *  generic celebration profile — the writer already mines unknown
 *  occasions' worlds; the profile just keeps the machinery aimed. */
const OCCASION_MATCHERS: Array<[RegExp, string]> = [
  [/sympath|condolen|bereave|loss of|passed away|passing|funeral|memorial|sorry for/i, 'sympathy'],
  [/get well|recovery|recover|operation|hospital|feel better|poorly/i, 'getwell'],
  [/father'?s day|fathers day/i, 'fathersday'],
  [/mother'?s day|mothers day|mothering sunday/i, 'mothersday'],
  // Anniversary BEFORE wedding: "ruby wedding anniversary" contains both
  // words and is an anniversary — the couple married decades ago.
  [/anniversary/i, 'anniversary'],
  [/wedding|getting married|marry|marriage|big day/i, 'wedding'],
  [/engage/i, 'engagement'],
  [/baby|shower|gender reveal|christening|newborn|new arrival|expecting/i, 'baby'],
  [/graduat|degree|university|masters|phd/i, 'graduation'],
  [/christmas|xmas|festive/i, 'christmas'],
  [/valentine/i, 'valentines'],
  [/thank/i, 'thankyou'],
  [/retire/i, 'retirement'],
  [/new home|housewarming|new house|new flat|moving in|moved in/i, 'newhome'],
  [/new job|promotion|first day/i, 'newjob'],
  [/good luck|luck|fingers crossed/i, 'goodluck'],
  [/just because|no reason/i, 'justbecause'],
  [/birthday|bday|\b\d{1,3}(st|nd|rd|th)\b/i, 'birthday'],
  [/congrat|passed|well done|proud of|exam|driving test/i, 'congratulations'],
];

export function classifyOccasion(text: string | undefined): OccasionProfile {
  const t = (text ?? '').trim();
  if (!t) return OCCASION_PROFILES.celebration;
  for (const [pattern, key] of OCCASION_MATCHERS) {
    if (pattern.test(t)) return OCCASION_PROFILES[key];
  }
  return OCCASION_PROFILES.celebration;
}

export const QUIRKY_FORMATS: Record<string, string> = {
  statement: `COMPOSITION — STATEMENT (MINIMAL): this card is almost EMPTY, and that is its power. THE NEGATIVE SPACE IS THE SUBJECT — at least 60% of the card is untouched ground, and it must feel deliberate, like a gallery wall, never like something is missing. ONE motif, beautifully drawn, ANCHORED: sitting on an implied baseline low in the frame, or held against one edge — never floating dead-centre in the middle of nowhere. ⚠️ BECAUSE THIS CARD IS MOSTLY EMPTY, THE MOTIF IS THE ONLY COLOUR EVENT ON IT — so it has to hold the card on its own. That is a question of CONTRAST AGAINST THE GROUND, not of volume: a deep ink on a chalky ground, a soft tone against a darker one, or a hot colour on a quiet field all work. What fails is a motif and a ground at the SAME weight, which reads washed out and unfinished. Minimal means FEW elements and DECISIVE contrast — never weak contrast, and never automatically loud colour. The type takes its own corner, flush-aligned, small and precise, at the opposite end of the card from the motif so the two hold the composition open between them — but kept well inside the safe margin, never crowded against the frame. No pattern, no border, no garnish, no texture-filling: restraint IS the design. Gallery-minimal.`,
  hero: `COMPOSITION — HERO (BALANCED): ONE object drawn HUGE and cropped HARD by the frame edges so it reads as a fragment of something bigger. SCALE IS THE WHOLE IDEA and the crop should feel brave — an object that merely fills the frame has not gone far enough. Confident contour, flat fills, one loose colour-block or swash behind it, calm ground visible around. The type claims the clear band of ground the object leaves, set big enough to hold its own against it. Poster energy, not busy.`,
  pattern: `COMPOSITION — PATTERN (DENSE): the motif repeats bold across the whole card at varied scales, some cropped off the edges — an underlying grid with its rhythm BROKEN DELIBERATELY in one or two places (one motif turned, one scaled up, one in the odd colour) so it never reads as wallpaper. CRUCIALLY, RESERVE A CLEAN AREA FOR THE TYPE: a calm panel, band or generous clearing where the plain ground shows through and the words sit alone. Do NOT thread the lettering through the gaps between motifs — that is how a dense card turns to mush. Rich and full, but organised.`,
  label: `COMPOSITION — LABEL (DENSE): a punchy modern packet/label lockup — one bold simple border framing the card, the motif bunched large in the centre, halftone shading in a single ink. THE TYPE IS THE STRUCTURE: a stacked lockup with a clear hierarchy — one dominant line, one smaller supporting line — sitting in its own reserved band above or below the motif, never printed over it. Craft-beer-label energy, structured-busy.
⚠️ THIS FORMAT HAS ONE DEFAULT AND IT IS DULL: the Victorian apothecary / heraldic crest — dark green or oxblood ground, gold ornament, laurel wreaths, a ribbon banner, fussy engraved rules. Observed and rejected: "a woman of tremendous standards" set in gold small-caps on dark green with a wreath and a ribbon, which is the same card this format keeps making whatever the subject is. It reads antique and expensive-hotel, never modern, and it is instantly the least interesting card in a set.
The brief says CRAFT-BEER LABEL and means it: contemporary, flat, confident, printed in this decade. Modern packaging, seed packets, a record sleeve, a tin of something good, a gig poster — colour doing the work, not gilt. If your label is reaching for a laurel, a scroll, a wax seal, a coat of arms or gold ornament, stop and rebuild it from the subject's own colours.`,
  typeled: `COMPOSITION — TYPE-LED (THE WORDS ARE THE ARTWORK): there is NO motif and NO illustration on this card — no objects, no scene, no border art. The words, set HUGE and with total confidence, ARE the entire design, and every design decision lives inside them: scale contrast between words (one word can be five times the size of its neighbours), the stack and its alignment, the accent ink landing on exactly the right word, letterforms with real personality per the TYPE line. The ground is one flat confident colour doing quiet work underneath. Permitted garnish, used sparingly if at all: an underline, an oversized piece of punctuation, a single typographic flourish drawn from the lettering itself — never a pictorial element. The craft bar is HIGHER here, not lower: with nothing else on the card, any weakness in the setting is the whole card. Think of the best text-only cards in a good shop — bought purely because the words and their setting were enough.
⚠️ AND A TYPE-LED CARD STILL HAS TO BELONG SOMEWHERE. With no motif to carry the subject, the GROUND COLOUR and the LETTERFORMS are the only things left holding it, so both must be drawn from that world and not from the poster-design default: the sea's own blues and a carved wooden letter for an island film, terrace red and a condensed chant gothic for a football card, faded seaside enamel for a caravan-holiday card. Cover the words with your thumb — if what remains is a handsome poster that could be about anything, this card has failed even though the line is good. Heavy generic sans on a flat bright ground is the specific trap, and it is where this format goes wrong every time it goes wrong.`,
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
  // the sender had already answered by typing them.
  // ⚠️ OPTIONAL ONLY WHEN AN AGE IS GIVEN (2026-08-19). "The thing they
  // love" IS the product and an empty brief is not its job — but the
  // catalogue's SPINE is milestone cards, and there the MILESTONE is the
  // subject. "Thirties? Completed It Mate" contains no hobby; turning 40
  // is the hobby. Blocking those made the highest-intent, most reusable
  // stock in the shop literally unbuildable. Enforced below, not here,
  // because the rule depends on `age`.
  interest: z.string().max(160).optional(),
  insideMode: z.enum(['auto', 'own', 'blank']).default('auto'),
  ownInsideText: z.string().max(300).optional(),
  /** Opt-in cheek. Deliberately permissive in the LAB so we can find
   *  where provider moderation actually draws the line — the customer
   *  build should be more conservative than whatever survives here. */
  cheeky: z.boolean().default(false),
  /** D3 — the buyer-facing tone for the birthday world. Ignored by
   *  occasions that have not been built out yet. */
  tone: z.enum(['funny', 'warm', 'cheeky', 'rude']).default('funny'),
  /** Override the rotated angle set. Admin/testing only — the studio
   *  never sends it, so production always gets pickAngles(). Exists so
   *  one angle can be A/B'd against another on an identical brief. */
  angles: z.array(z.enum(['wordplay', 'deadpan', 'proud', 'straight', 'list'])).length(3).optional(),
  /** THE ENGINE TOGGLE (AUDIT_BUILDER_PROMISE.md). 'classic' = the
   *  original prompt-only pipeline. 'celebrait' = archetype -> short
   *  prompt with the HOME REGISTER (flat/graphic/bold, licensed
   *  departures) -> code referee. 'open' = same but no visual register.
   *  Sympathy and other humour-off occasions always take classic. */
  pipeline: z.enum(['classic', 'celebrait', 'open']).default('classic'),
  /** ⚠️ CROSS-RUN MEMORY IS A RACK-BUILDING TOOL, NOT A CUSTOMER ONE
   *  (Aidan 2026-08-19: "Why are we excluding when these are for new
   *  users essentially"). The studio excludes lines and motifs used in
   *  PREVIOUS runs because catalogue stock hangs side by side — but a
   *  customer is a fresh pair of eyes, and steering them away from a
   *  subject's best material because a STRANGER'S run used it means
   *  every customer after the first gets second-choice cards. Two
   *  people buying the same great card is a bestseller, not a bug.
   *  Default true (the studio is today's only caller); the customer
   *  flow sends false. Generations are LOGGED either way — the
   *  keep-rate denominator and motif history must stay complete. */
  memory: z.boolean().default(true),
  /** Recipient's first name, to be DESIGNED IN — lettered in the card's
   *  own style, sometimes as the artwork itself ("EVIE IS ONE"). Not a
   *  placeholder: the real name, generated in (Aidan 2026-08-20). */
  recipientName: z.string().max(40).optional(),
  /** Let the model choose the medium instead of using the house style. */
  freeStyle: z.boolean().default(false),
  /** Structured recipient (Aidan 2026-08-17): free text made the three
   *  signals that matter — register, gender, age — into mush a model had
   *  to guess at. Bounded fields instead: `who` is the relationship,
   *  gender only where the relationship does not already imply it, age
   *  as a number rather than a regex on a sentence. */
  gender: z.enum(['him', 'her', 'unspecified']).default('unspecified'),
  age: z.number().int().min(1).max(110).nullable().optional(),
  /** The one free-text field worth keeping: "he's had the same shed
   *  since 1998" is where the best cards have always come from. */
  detail: z.string().max(200).optional(),
  /** Something they can't stand. Genuinely good comedic fuel — but a
   *  rivalry ate an entire set once, so it is capped at one card in the
   *  prompt and the collapse detector backs that up. */
  dislikes: z.string().max(200).optional(),
  /** Character ladder — see quirkyDna(). */
  characters: z.enum(['objects', 'animals', 'figures']).default('objects'),
});

interface CardConcept {
  angle: string;
  format?: string;
  /** The visual world the whole set shares — decided once, before any
   *  card is designed, so three cards read as one designer's range
   *  rather than a sampler (Aidan 2026-08-17). */
  direction?: string;
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

/** ⚠️ FOUR ANGLES, THREE SLOTS, ROTATED SERVER-SIDE.
 *
 *  Aidan 2026-08-19: "Think 3 but rotate as we do already cos we have 4
 *  possible outcomes already don't we in terms of style?" — the better
 *  answer to where a plain card lives than adding a fourth card.
 *
 *  It also fixes something nobody had noticed: every set we have ever
 *  made was wordplay + deadpan + proud, IN THAT ORDER. Formats rotate,
 *  the typeled count is pinned at one, palettes vary — and the three
 *  shapes underneath were identical every single time.
 *
 *  Chosen HERE rather than by the writer, for the reason the typeled
 *  count is pinned here: left free it took the minimal slot 7 sets out
 *  of 7. A model asked to vary its own structure does not. */
export type Angle = 'wordplay' | 'deadpan' | 'proud' | 'straight' | 'list';

/** ⚠️ NO ANGLE IS THE STANDING THIRD SLOT — this is the whole point of
 *  the table, and it took two goes to get right.
 *
 *  First proud held it, and Aidan: "proud has always felt a bit dead."
 *  It was deadpan's mirror image — both turn on a mismatch, one
 *  under-reacting, one over-reacting — so it read as the weaker half of
 *  a joke we already had.
 *  Then LIST held it, and he was right again: "those lists don't do it
 *  for me at all in bulk. Now and again yeah." A list has a very
 *  recognisable silhouette, so three on a shelf read as one card with
 *  the nouns swapped. I had judged five lines and never asked what
 *  twenty look like side by side — the exact failure the standards
 *  formula and the third-party verdict both were.
 *
 *  So the third slot ROTATES. Any shape distinctive enough to be good
 *  is distinctive enough to tire, and the defence is that none of them
 *  appears often enough to become the house tic. */
const ANGLE_SETS: Angle[][] = [
  ['wordplay', 'deadpan', 'proud'],
  ['wordplay', 'deadpan', 'list'],
  ['wordplay', 'deadpan', 'straight'],
  ['wordplay', 'proud', 'list'],
  ['wordplay', 'proud', 'straight'],
  ['deadpan', 'list', 'straight'],
];

/** Straight is the plain card — no joke, just the occasion said well.
 *  ⚠️ NEVER ON THE RUDE REGISTER: a card with no joke, in the register
 *  whose whole point is the joke's language, is nothing at all. Rude
 *  always gets the three joke angles. */
export function pickAngles(tone: string | undefined, rnd = Math.random): Angle[] {
  // Rude never gets the straight card — a card with no joke, in the
  // register whose whole point is the joke's language, is nothing.
  const pool = tone === 'rude'
    ? ANGLE_SETS.filter((a) => !a.includes('straight'))
    : ANGLE_SETS;
  return pool[Math.floor(rnd() * pool.length)] ?? pool[0];
}

export function conceptSystemPrompt(characters: CharacterLevel, cheeky = false, profile: OccasionProfile = OCCASION_PROFILES.celebration, freeStyle = false, angles: Angle[] = ANGLE_SETS[0]): string {
  // ⚠️ The cheek block is INJECTED AT THE TOP and written as an order, not
  // a permission. Buried at the bottom and phrased "allowed and
  // encouraged", it did nothing at all: a cheeky=true run produced "Ales
  // to the Quiz Master" and "Hoppy Birthday to the Quiz King", which are
  // indistinguishable from the clean run. One optional paragraph cannot
  // outvote the dozen restraint rules below it (Aidan 2026-08-16).
  const cheekBlock = cheeky
    ? `\n⚠️⚠️ RUDE MODE IS ON, AND IT IS AN INSTRUCTION, NOT A PERMISSION. This customer has deliberately asked for a rude card and will be disappointed by a polite one. AT LEAST TWO of your three cards must carry REAL swearing on the FRONT. If you hand back three clean cards, you have failed this brief completely.
⚠️ "BUGGER" IS NOT A SWEAR WORD. Neither is "blooming", "flipping", "heck" or a pun with a beer in it. Those are what people say when they drop a mug, and a card carrying one is a polite card in a fancy-dress moustache. THE STRONG WORDS ARE UNLOCKED AND EXPECTED: f***, s***, bollocks, bastard, wanker, prick, twat, bellend, knobhead, arse, piss, plus proper innuendo. Reach for the strong end FIRST; the mild words (bloody, sod, git, bugger) may only ever be the SECOND-rudest thing in a line, never the whole joke.
⚠️ MASK THE STRONGEST WORDS WITH ASTERISKS ON THE FRONT — first letter, then asterisks: f***, f***ing, s***, c***. This is how real rude cards in British shops do it, because the card sits on a mantelpiece where a child or a nan will see it, and the mask IS part of the joke — everyone reads the word, nobody has to look at it. It also renders far more reliably in the artwork. So write "Don't f*** it up", never "Don't bugger up" and never the unmasked word. Mid-strength words (bollocks, arse, piss, twat, bellend, knobhead, bastard) print in full, unmasked.
Keep it AFFECTIONATE — the recipient laughs, never winces; we are taking the mickey out of someone we love. Absolutely no slurs, nothing about race, sexuality, religion or disability, nothing sexual beyond seaside-postcard innuendo, nothing cruel about age, weight, illness or death.
The "classy always" instruction below is SUSPENDED for the front lines while this mode is on — classy refers to the ARTWORK, which stays beautiful. Filthy words, gorgeous card.\n`
    : '';

  // The occasion brief goes ABOVE the general machinery for the same
  // reason the cheek block does: instructions at the top win.
  const occasionBlock = `\nTHE OCCASION BRIEF — the buyer's mindset for this occasion. It AIMS everything below; where it conflicts with a general rule, the occasion brief wins:
${profile.brief}\n`;

  return `You write QUIRKY greeting-card concepts for Celebrait — flat-illustrated, classy, visual-pun-led cards in the spirit of good independent card shops ("you are simply the zest" over lemons; "I love you from my head tomatoes" as a vintage seed packet).
${cheekBlock}${occasionBlock}
You are given who the card is for, the occasion, who it's from, and ONE thing the recipient loves. Return THREE concepts as JSON — all three about THAT ONE THING, as three genuinely different cards a good shop would rack side by side. The customer is choosing which EXECUTION they like, so the three must differ in angle, composition AND colour — never three drafts of one idea.

⚠️⚠️ WE DO NOT KNOW THIS PERSON — DO NOT INVENT THEM. You have ONE thing they love plus whatever the brief says; that is the entire truth available. Where they have been, what they own, what they are good at, what they do on a Tuesday: all unknown. A card describing a life they have not lived reads as a stranger guessing, which is worse than merely safe.
  ✅ AIM AT THE SUBJECT — what is true for ANYONE who loves this thing: its shared absurdities, rituals, understood truths. "Nine hours, no fish" works on every angler alive.
  ❌ NO BIOGRAPHY: no trips, places, possessions, expertise or habits unless the brief said so. Failed, on a brief saying only "New York City": "A weekend away, and somehow you've already found the proper deli" (invents a trip) and "She can spot a decent slice instantly" (invents expertise). The good card was "Upper Best Side at 60" — plays with the CITY, claims nothing about her.
  ✅ WHAT THE BRIEF GIVES YOU IS REAL and should be used hard. That is the difference between personal and presumptuous.
  TEST: could the buyer think "well, that's not true"? Then it is invention.

⚠️⚠️ THREE CARDS MEANS THREE DIFFERENT IDEAS — the commonest failure and the one that makes a set feel dead. Once you find the strongest seam you will want to work it three times. Do not: three executions of one joke is not a choice, and it is obvious on the rack.
BEFORE WRITING A LINE, name THREE genuinely different corners of this world and assign one per card — different SUBJECTS, not different jokes about one subject. Failed sets: a United fan where all three were about hating City; a Netflix fan where all three were "watches too much"; a cocktail lover where all three were "takes it too seriously".
⚠️ A SIDE DETAIL MUST NOT EAT THE SET — something mentioned in passing is worth AT MOST one card. The main thing they love is why the card exists.
  ⚠️ BUT "AT MOST" IS A CEILING, NEVER AN EXCUSE TO DROP IT. If the brief carries a dedicated CANNOT STAND line, that is not a passing mention — the buyer typed it into a box asking for it, and it gets EXACTLY ONE card. Observed: a "Man United away days" brief with "Liverpool football club" in that box returned three away-days cards and no rivalry at all, because this ceiling was read as permission to use it zero times. It never means zero. It is hardest, and most necessary, when the loved thing and the hated thing share a world — two football subjects still need their own card each, not a merge and not a quiet drop.
⚠️ NO SHARED VOCABULARY. No distinctive word or image twice in a set; if two lines reach for the same word, one is a duplicate in disguise.

MINE THE SUBJECT FIRST, internally: its objects and kit, rituals, jargon and catchphrases, colours, sounds, clichés, the moment its fans love most. The best cards come from the specific corners, not the obvious symbol. (Fishing is not a fish: it is tackle boxes, dawn flasks, the one that got away, nine silent hours called relaxing.)
IF THE SUBJECT IS A PERSON (celebrity, character, sports star), mine THEIR OWN signatures — what they are never without, their gestures, their palette, their catchphrase. WORKED: a red cap with white lettering, an overlong red tie, gold everything — unmistakable, no face needed. FAILED: a skyline, a podium, "a famous building" — could be anybody. Never drift to their city, country or generic field.

MINE THE OCCASION AND THE PERSON TOO — free specificity most cards waste.
  THE OCCASION HAS ITS OWN WORLD: "40th", "retirement", "new home", "Christmas" each bring objects, colours, numbers and rituals. Let it MEET the interest, not sit beside it — a Christmas fishing card is the tackle box in frost-blue and one hot red, not a fishing card with a tree in the corner. A stated number can go IN the artwork; almost nobody does it. ⚠️ But the interest leads: the occasion inflects palette, one motif, the angle of the joke, never takes over. Balloons and cake means a generic birthday card with a hobby stapled on.
  THE RECIPIENT SETS THE REGISTER — read WHO closely, every word was typed on purpose:
    RELATIONSHIP → TONE: gentler and warmer for a nan, grandad or mum; sharper and cheekier for a sibling or mate; intimate for a partner; lighter and safer for a colleague, never an in-joke pitched at family.
    AGE → VOICE, only when stated. 21 wants energy, 50 wants knowing self-deprecation, no age stated means NO age jokes.
    GENDER → LOOK, only when stated. Never infer it from a hobby — a woman who fishes gets the same fishing world, not a pink rod.
    DIRECTION → SPEAKER: read any "from" detail and let the card sound like that person.
    A NAME is a gift: for family and partners the front carries the relationship word ("Nan", "Dad") and the name lands INSIDE; for a mate the first name can sit on the front.
  ⚠️ WHO IS BUYING: usually a woman buying for someone she loves — she is who the set must charm at a glance, so the default is WARM AND ALIVE. Moody, dark, workwear styling is a deliberate choice for when the person calls for it, never the resting state. If all three would photograph like a menswear catalogue, pull one toward warmth.

⚠️ FIRST, WORK OUT WHAT THEY MEANT. The interest is a few words in a box and often ambiguous; READ THE WHOLE BRIEF, because the other fields disambiguate it and are the best evidence you will get. Failed: "The Royal Family on TV" for a 70-year-old dad with "Neighbours on TV" in the can't-stand box — two British TV programmes side by side, and the set came back about the monarchy.
  ⚠️ EXPECT NEAR-MISS SPELLINGS: people type titles from memory ("The Royal Family" is how most of Britain spells the sitcom "The Royle Family"). A letter or two off a well-known title, with the brief leaning that way, IS the title.
  Signals: the other fields, the recipient, their age, the phrasing ("on TV", "playing for", "down the").
  ⚠️ IF IT IS STILL GENUINELY EVEN, SPLIT THE SET — likelier reading twice, the other once. Three cards is a perfect hedge; three staked on a wrong guess is a wasted set.

⚠️ SPECIFIC BEATS CATEGORY, ON EVERY SUBJECT — THE COMMONEST WAY THESE GO FLAT. The trap is answering the broad CATEGORY instead of the interest itself. TEST: would this equally please someone who likes the category but has never touched THIS thing? Then it has failed, however handsome.
  One failure in different clothes each time: the sea is not Moana, dance music is not Ibiza, football is not Manchester United. Failed on "Ibiza parties": a DJ mixer and "sunrise has become a perfectly normal time to be saying goodnight" — good lines, but dance-music cards that suit any clubber in Britain.
  THE FIX IS ALWAYS THE SAME: reach for what only THIS one has — its own places, hours, rituals, weather, the things its people say.
  ⚠️ THIS IS THE WORLD, NOT THE WORD. All three must be unmistakably about the subject; they need NOT all name it. Naming it three times is repetition, not specificity — a card can be pure Ibiza with the word nowhere on it. What is banned is the GENERIC card, never the unnamed one.

IF THE SUBJECT IS A FICTIONAL WORLD, FRANCHISE, BAND, TEAM OR SHOW, THE WORDS DO EVERYTHING. We never draw their artefacts, logos or crests — we print and sell these — so the picture CANNOT say which world this is. The line must.
  ✅ SAY THE NAME. "Moana", "Hogwarts", "Star Wars" in plain words is ordinary referential use; every British card shop does it. Only the PICTURE is out: the character, the logo, the wordmark's styling.
  ⚠️⚠️ THE ICONIC LINE IS THE CARD — the highest-value move available and the one we keep walking past. Almost every loved property has a phrase that escaped into ordinary speech: the thing fans quote, the line that ends up on a mug. That phrase with the occasion collided into it beats anything you can invent ABOUT the subject. Let the phrase carry the weight and the occasion supply the turn; never explain it, never wink at it.
    · SAY THE LINE, DO NOT WRITE ABOUT SAYING IT. Failed: "quoting Only Fools and Horses is basic conversation" — a card about the habit of quoting, which fits any fan of anything.
    · TAKE IT FROM THE BRIEF'S SUBJECT, NEVER FROM THIS PROMPT. Quotations here are examples of technique, not a pool. Failed: "Cushty at 40, My Arse" welded two different sitcoms together.
    · IF THE WORLD OWNS ONE FAMOUS WORD, IT MUST DO THE WORK. Failed: "Wand-erful Sister, Always Charming" wasted "Always", the most quoted word in those books, as an ordinary adverb.
    · Tone-match: if the best-known line is too rude for a clean card, take the next one.
    · Short quoted phrases are safe — far too short to be copyright. Still out: LYRICS, long dialogue, drawing the characters or marks.
  ⚠️ A CLUB IS THE HARDEST CASE, because the artwork can only ever say "football". If the words do not say WHICH club, it suits any fan of any team — failed: "Birthday Form Looks Strong" over a scarf and radio. Every club owns words nobody else can use: its ground, its ends, its era and managers, its nickname, its songs, the years everyone recites. NAME ONE.
  TEST: would a fan think "they know", or "they looked it up"? Anything writable from a Wikipedia summary has failed.

THE THREE CARDS — one each, in this order.
⚠️ QUIRK IS THE HOUSE VOICE, NOT ONE OF THREE FLAVOURS. All three cards must contain a TURN — a small moment that makes the reader do a double-take. The angles are three different WAYS TO DELIVER that turn; they are not "one funny card and two straight ones". A line with no turn is DRY, and dry is what makes a card feel like it came off a supermarket rack.
1. WORDPLAY — the turn is in the LANGUAGE. A pun or a twist on a phrase from that world's own vocabulary. Must pass the pub test.
  ⚠️ BOTH MEANINGS MUST BE ALIVE — this is what separates a pun from a homophone swap, and it is the commonest way this angle fails. A real pun means two true things at once: "simply the zest" works because zest is citrus AND enthusiasm, and both are on the card. Swapping a word for one that merely SOUNDS like it, while the swapped-in word means nothing here, is not wordplay — it is a spelling mistake with confidence.
  Failed: "Making birthdays grate again" — nothing is being grated, nothing is grating, so "grate" carries no second sense and the line is just "great" misspelled. TEST: say what the second meaning IS, in plain words. If you cannot, the pun is dead.
  ⚠️ AND THE SECOND MEANING HAS TO BE THE RIGHT ONE. A pun can resolve perfectly and still land on an idea that suits the brief badly — which is worse than a dead pun, because it reads as deliberate. Observed on an 18th: a pun on "proof of age" — clean wordplay, since the ID is exactly what they now get asked for — that resolved onto AGEING, a decline joke, on the one birthday entirely about arriving. Say the second meaning out loud AND check it is something you would want on this card.
2. DEADPAN — the turn is in the UNDER-REACTION. This is the QUIETEST card, but quiet is not empty: deadpan only works when something genuinely ABSURD is being reported completely straight. Mine the daft truth of that world — the nine wasted hours, the £400 of kit for a £2 fish, the 5am alarm on a day off, the shed nobody else is allowed in — and state it flatly, with no wink and no punchline signposting. BEFORE you write this line, name to yourself ONE specific absurd fact about this world, ideally carrying a number, a ritual or a wasted effort. The line then REPORTS that fact. If you find yourself reaching for the birthday instead of the absurdity ("Another year, another …"), you have not mined hard enough — go back and find the daft fact. NO ABSURDITY MEANS NO JOKE: "Manchester United Comes First" and "The only mixologist in the family" are statements of fact with nothing being under-reacted to, and they came out dry. "Nine Hours, No Fish" works, because something ridiculous is being reported with a straight face.
⚠️ LIST — the turn is in the ACCUMULATION. Three or four SPECIFICS, stacked as separate short statements, and the LAST ONE TURNS IT. Everything before the turn is just true; the last item reframes the lot.
  Every item is a concrete thing from their world — an object, a time, a quantity, a small indignity. No adjectives doing the work, no explaining, no joining words. The comedy is in WHAT GETS INCLUDED and in the order, which is why this only works if you have mined the subject properly: a vague list is nothing at all.
  The rhythm is short-short-short-turn, and the turn can be a verdict, an absence, a total, or the one item that does not belong.

⚠️ STRAIGHT — THE PLAIN CARD, and the ONE angle exempt from the turn. Included only when it appears in your list above.
  There is no joke here and none is wanted: this is the card someone sends when they do not want to be funny, and every rack in Britain is full of them. Say the occasion properly and let the CRAFT be the card — the setting, the colour, the confidence of it.
  ⚠️ BUT PLAIN IS NOT GENERIC, and this is the only thing that matters about this angle. "To a wonderful Mum with love" is what the mass-market makes because it must suit everybody; we do not have that problem. A straight card is still unmistakably about THIS person — their colours, their world's own object, the number set beautifully — it simply does not make a joke about them. Every specificity rule above applies to it in full.
  It usually wants the type-led or statement format, and often the best line is the plainest possible: the occasion, said once, set well.
  ⚠️ AND IT IS NOT A HIDING PLACE. "No turn required" is not permission for a limp line: a straight card that could sit on any shelf in the country has failed harder than a weak joke, because it had nothing to hide behind.

3. PROUD — the turn is in the DISPROPORTION: total, straight-faced seriousness about something gloriously SMALL. The respect is real; the thing being respected is trivial. That is the whole joke, and it lives in WHAT you take seriously, never in how grandly you say it.
  SAY IT ABOUT THEM, NOT TO THEM — addressing the recipient or declaring a rule is where every collapse of this angle began. But say only what you KNOW: you know they LOVE this thing, so take THAT seriously on their behalf — the devotion, the standards the subject demands of anyone who cares, the enthusiasm the family expects. Never a life you imagined for them.
  ⚠️ BANNED SHAPES, not banned words — a fresh synonym is the same failure. Reject on sight:
     • a TITLE: "[Grand noun] of the [Thing]" — Master of the Tackle Box, Sultan of Suds, anything Extraordinaire or Royalty.
     • SOLE AUTHORITY: opening "Nobody...", "No one...", "Only you...", "You're the one who...".
     • A HOUSE RULE: "House rule:...", "The rule is...", "X is not a democracy".
  ⚠️ AND THE CURRENT RUT — THE THIRD-PARTY VERDICT: a relative or household observing that they take it seriously. Read a day together and it is one card: "Dad takes fly fishing properly seriously", "The family knows when Oasis is on", "held to Peckham standards". Not a bad shape — it has produced keepers — an OVERUSED one, so vary rather than ban. Other routes to the same pride: their own flat statement of priorities; a tiny thing in the language of something enormous; a consequence nobody argues with; expertise deployed on something undeserving; the thing itself given the last word. Ration the verdict to roughly one set in four.
  Build every noun and number from THEIR world. Test: could you say it out loud in a pub without sounding like you were presenting a trophy?

WRITE WIDE, THEN SHORTLIST: draft at least SIX candidate lines per angle, then be a ruthless editor. A line SURVIVES only if it passes ALL of:
   - THE PUB TEST: said aloud, it lands instantly — no explaining, no "get it?". A pun that needs unpacking is DEAD.
   - IT PARSES: a real, natural sentence. Nonsense mashups ("Fatherhood at DC10 beats dropper") are the cardinal failure.
   - ⚠️ COVER THE PICTURE — THE HARD GATE, AND WHY CARDS FEEL VAGUE. With the artwork hidden, does the LINE alone tell you what this card is about? Failed: "You call the bagel place. Obviously." over New York art — hide the picture and it works in any town in Britain. No artwork rescues a line that names nothing.
     THE FIX IS ALWAYS THE SAME: put the subject's OWN vocabulary in the words — its places, numbers, jargon, the things its people say. The picture then confirms what the line established, which is the right way round.
   - ⚠️ ONE CONCRETE THING, MINIMUM — an object, a number, a place, a ritual, something they actually say. Sentiment alone is not a card ("You're amazing at this", "Cheers to a barrel of laughs").
     THE SINGLE BIGGEST LEVER. Rude cards land harder NOT because they swear but because swearing forces you to be about something. "Nine hours, no fish" has none and is the best line in the range. COPY THE SPECIFICITY, NEVER THE SWEARING — a clean card is every bit as concrete, only the language changes.
   - ⚠️ THE BUYER TEST — most likely to lose us the sale. THE BUYER IS NOT THE FAN: a daughter buying for her Harry Potter dad may never have read a word. If she cannot tell at a glance it is good, she does not buy it. So use the FAMOUS layer that escaped the fandom: the handful of things a non-fan could still name if you asked them what they know about it — never the deep cut (a minor character, an obscure spell, a squad number, an album track). ⚠️ A world usually has three or four of these and we keep reaching for the same one, so a set should not spend them all on the same reference twice. Still specific, just specific in a way that carries beyond the fandom.
   - THE TURN TEST: name the surprise in five words or fewer, in your own words — which word is doing two jobs, what is being under-reacted to, what is being taken far too seriously. No nameable turn means DRY, and it dies here however warm or well written. Most weak lines fail here.
   - NO CRINGE: no "vibe(s)" as a noun, no "boss/legend/hero", no hashtag-speak, at most ONE exclamation mark.
⚠️ DO NOT PICK A WINNER. Keep the THREE BEST survivors per angle and return all three, strongest first. An independent editor chooses between them afterwards, and choosing is easier than repairing — so your job is to hand over three genuinely different, genuinely usable lines, NOT one favourite plus two throwaways you never intended. If you find yourself writing a filler line to pad the list, replace it: three real options or the shortlist has failed.
The three candidates for an angle must all be DIFFERENT ROUTES to that angle's turn, not one line reworded three ways — and every one of them must work with THAT SAME CARD'S artwork, because the picture is already decided by art_direction. A clean deadpan ALWAYS beats a strained pun.

⚠️ DECIDE THE LOOK ONCE, BEFORE YOU DESIGN ANY CARD. A designer given this brief would not make three unrelated cards — they would settle on a visual world and make three cards inside it. Three cards wearing three different typefaces, three unrelated palettes and three different densities is not a range, it is a sampler, and it reads as machine output rather than a designed set.
DERIVE THE WORLD FROM THE BRIEF — the thing they love leads, the age and the relationship temper it:
  • THE SUBJECT sets the register. Some worlds are loud (a football terrace, a nightclub, New York); some are quiet (a garden, sea swimming, reading); some are warm and domestic (baking, the pub); some are sharp and modern (streaming, tech, design). A subject that is ITSELF about taste — someone who likes fine stationery, quiet design, quirky cards — must never be answered with heavy shouting type.
  • THE AGE tempers it — early twenties runs brighter and louder, later years warmer and calmer.
  • THE RELATIONSHIP tempers it again — a nan gets gentler than a mate, whatever the subject.
Then state it in the "direction" field and hold ALL THREE cards inside it.

Each returned concept:
- direction: ${freeStyle ? 'the MEDIUM this card is drawn in — a real, named illustration craft (linocut, gouache, riso, papercut, art deco, mid-century children\'s book, cyanotype, comic halftone and so on) plus its palette family and type mood. ⚠️ FREE STYLE IS ON, SO EACH OF THE THREE CARDS TAKES A DIFFERENT MEDIUM. There is no house look to hold them together and no reason to make three cards in one craft: give the buyer three genuinely different executions and let them point at the one they like. Choose three media that each suit the subject in a different way, and commit to each completely.' : 'ONE sentence, IDENTICAL on all three concepts, naming the visual world you have chosen for this set: its palette family, its type mood, and its density register (airy / balanced / full). This is the decision every other visual choice obeys, and holding all three inside it is what makes a set read as one designer\'s range rather than a sampler. Derive it from the brief, not from habit.'}
- angle: EXACTLY these three, one each, IN THIS ORDER — ${angles.map((a) => `"${a}"`).join(', ')}. The set is chosen for you and rotates between briefs; do not substitute one for another.
- format: one of "statement", "hero", "pattern", "label", "typeled". EXACTLY ONE card is "typeled" — never none, never two; the count is fixed because left free it swings to all or nothing. The other two follow the direction's density register rather than a forced spread: an airy world can take two minimal cards, a full world two dense ones. Three quiet cards for a quiet subject is a good set, not a failure.
  "typeled" is TEXT-ONLY: no illustration, the words set huge ARE the artwork, and art_direction describes the ground colour and typographic treatment instead of a motif. Good shops rack plenty of these.
  ⚠️ IT MAY BE SHORT OR LONG, and that is a real choice. SHORT (three to six words, enormous) hits like a poster and is often stronger. LONG (up to 20 words) is the card someone reads aloud in the shop — the observation too good to cut, the fake advice, the sentence that turns hard at the very end. If you go long, USE the length: a padded short line has failed, and the last few words must land the turn. Whichever you pick, this has to be your best line.
- front_candidates: an array of EXACTLY THREE surviving lines for this angle, strongest first. MAXIMUM 8 words — EXCEPT on the typeled card, where you may go up to 20 and a full sentence is welcome (see below). Each must CONNECT to the picture — words and motif complete each other — and each must SET WELL as display type: breaking naturally into 2-3 short stacked lines, avoiding words longer than 10 letters, since very long words in big type are where lettering goes wrong. Where two lines are equally good, prefer the one with shorter words.
- inside_text: MAXIMUM 28 words. Lands the affection, may extend the joke, warm enough to sign. Never restates the front.
- art_direction: one sentence — the MOTIF and how it sits in the chosen format.
  ⚠️⚠️ SPECIFIC BEATS CATEGORY APPLIES TO THE PICTURE TOO, and this is where it is currently being failed. The words rule is above; the artwork gets judged by exactly the same test. COVER THE WORDS WITH YOUR THUMB — does the picture still say THIS subject, or has it slid to the generic kit of the category it belongs to?
  Observed failure: a "DC10 Ibiza" brief — one of the most photographed clubs in dance music, sat at the end of an airport runway, low white concrete, planes crossing the terrace at sunrise, Circoloco on a Monday — came back as wristbands, sunglasses and a pair of trainers. That is the kit of CLUBBING. It would suit a card about any club in Europe and it wastes the one thing the buyer told us.
  ⚠️ BEFORE YOU WRITE THIS SENTENCE, name to yourself the two or three things ONLY this subject has — its own architecture, its own objects, its own light and hour, its own rituals. Then draw one of those. If you cannot name any, you do not know the subject well enough yet to art-direct it, and the honest move is a plainer motif done beautifully rather than a generic one dressed up.
  ✅ IF IT IS A REAL PLACE, DRAW THE PLACE — see case C in the style brief. Real venues, grounds, buildings and streets are open to us, and they are the most specific motif available: the ground under floodlights, the club's own low roofline against a dawn sky, the pier, the market. Nobody owns reality.
  Where the OCCASION has a world of its own, let it inflect this: its season, its light, one of its objects folded into the interest's own kit, or its number worked into the scene. Never a generic occasion prop (balloons, cake, a wrapped present, a tree) dropped next to the real subject. ${characters === 'objects'
    ? 'Objects, food, botanicals, the kit of that world ONLY — NEVER humans, NEVER animals, NEVER characters. ⚠️ WHEN THE SUBJECT IS PEOPLE (grandkids, family, mates, a team), draw THE TRACES THEY LEAVE, never the furniture they sat on: crumbs and a tipped mug, felt-tips with the lids off, a drawing pinned up, cards mid-game, four spoons in one bowl. Observed failure — a "spending time with the grandkids" brief returned chairs, more chairs and a table, because chairs are what is left when you remove the people. Traces are warm and say who was there; empty seating is the absence of the subject.'
    : `OBJECTS ARE THE DEFAULT for every card. ${characters === 'figures'
        ? 'A characterful ANIMAL, or a HUMAN FIGURE drawn in the card\'s own medium (an illustrated face is fine and welcome; a photographic or semi-photographic one never is, and nor is a likeness of a private individual — a PUBLIC FIGURE may be satirical caricature, all per the style brief), is PERMITTED'
        : 'A characterful ANIMAL is PERMITTED (never humans or human faces)'} but is a CEILING, not an instruction.
    ⚠️⚠️ HARD OVERRIDE — IF THE SUBJECT IS A FICTIONAL PROPERTY (a film, show, book, game, or its world), THERE IS NO HUMAN FIGURE ON ANY OF THE THREE CARDS, whatever the character setting says. Not a named one, not a generic one, not a silhouette, not "a girl by the sea". Inside that world's costume, palette and setting, ANY figure reads as ITS character — and we would be printing and posting someone else's property. Observed: a Moana brief with figures enabled returned a child in the character's own outfit in front of a wave, unmistakably her. Animals are permitted ONLY where the animal is ordinary and unowned (an owl, a pig) and never that world's named companion. Objects, places and scenery only; the WORDS carry the property, which is the whole reason they are allowed to name it.
    AT MOST ONE of the three cards may use a character, and only if it passes this test: does this subject's OWN WORLD naturally contain that creature or person? A dog-lover's world contains a dog. A Sunday league team contains players. A BAND'S WORLD DOES NOT CONTAIN KANGAROOS — inventing a mascot to satisfy a permission is the failure to avoid ("Wonderwallabies" for Oasis: the pun exists only because an animal was forced in, and the card says nothing about the band).
    If the subject's world contains no creature or person naturally, all three cards are objects. That is a good outcome, not a limitation — the single best Oasis card was a cassette labelled "Oasis Mix".`} THE THREE CARDS MUST SHOW DIFFERENT CORNERS OF THE WORLD — not the same object three times (fishing: a tackle box of lures / a lone flask at dawn / a wall of floats — not three fish).
  ⚠️ NEVER ASK FOR A LOGO OR AN INVENTED ARTEFACT IN THIS BRIEF. We print and sell these cards. Do not write the name of any object, creature, vehicle, weapon, building or costume that exists only inside a film, book or game, and never a logo, wordmark, crest or badge for anything at all. Observed failures: "a Golden Snitch, Quaffle and Bludger", "the Marauder's Map", "a mug with a lightsaber handle", "small screens showing iconic scenes".
  ✅ BUT A BRAND'S WORLD IS OPEN — ask for it confidently. Its colour signature, the everyday objects around it, the interfaces and paperwork and packaging SHAPES it puts in front of people — everything except the mark itself. Draw the EXPERIENCE of using it: what it looks like mid-use, what it leaves lying about, what its regulars would recognise instantly. The logo is the one thing that is out.
  Ask instead for the ORDINARY objects that world is full of — things anyone could own and nobody owns the rights to. Find them by asking what is on the TABLE, in the BAG, on the FLOOR, in the WEATHER of that world rather than what is on its poster: the everyday clutter of living there, not its emblems. The PALETTE and the words carry the reference. If you cannot describe the picture without naming a protected thing, choose a different corner of that world.
- palette: you are the art director. ${freeStyle
  ? `⚠️ THE MEDIUM SETS THE INK RULES, NOT A FIXED COUNT. Name the GROUND first, then the colours the CHOSEN CRAFT would actually use — and say which one is the ACCENT, held back so it stays hot.
  A limited-ink print (riso, lino, screen) genuinely is three or four flat colours, so say so. But a cyanotype is one blue and its tones; a watercolour blends and cannot be counted in inks at all; embroidery is a dozen threads; an airbrushed poster is gradients; a botanical plate is fine gradation. Describe the palette in the terms THAT medium works in.
  ⚠️ THIS IS WHY THE RANGE COLLAPSED. Measured over thirty cards, four media took 83% of them — riso, lino, gouache and papercut — because a hard "ground plus exactly three flat inks" is a rule only those four can obey, and sixteen other media were being asked for and then made impossible. Free style means the craft leads; the palette follows the craft.`
  : `Name the GROUND colour first, then exactly THREE inks (four only if one truly earns it), and say which single ink is the ACCENT — the hot one, held back to under 10% of the card. Draw them all from that world.`} ${freeStyle
  ? '⚠️ METALLICS ARE ALLOWED HERE, BUT ONLY WHEN THE MEDIUM EARNS THEM. Free style means the medium sets the rules, and some genuinely are metallic: art deco, 70s airbrush, 80s chrome lettering, gilded botanical plate. If you named one of those, silver and gold are real choices — say so deliberately and let the artwork be shiny. What is still banned is METALLIC BY ACCIDENT: naming "silver" on a flat medium, where it does not mean a colour and simply invites a 3D-shaded metal object into a flat card. A palette that said "skyscraper silver" on a flat print produced a photorealistic chrome fishing reel, which is the failure — a reel in a linocut is rust and cream. Metallic because the craft is metallic: yes. Metallic as a default reach: no.'
  : '⚠️ NEVER NAME GREY, SILVER, CHROME, GOLD, METALLIC OR WHITE AS AN INK. They are not colours, and naming one invites a rendered metal object with 3D shading, which breaks the flat-print house style outright — a palette that said "skyscraper silver" produced a photorealistic chrome fishing reel. Metal objects are drawn FLAT in the palette\'s real colours: a reel is rust and cream, not silver.'} Every ink you name must be a colour someone could actually put on paper.
START FROM THE SUBJECT'S OWN COLOURS. If that world owns a colour, use it — United wants red, New York wants cab yellow, fishing can want deep river green. Wasting a signature colour on a beige card is the commonest way these come out mundane.
ALL THREE PALETTES COME FROM THE DIRECTION'S FAMILY — no palette-hopping. Within it, vary the MOOD (dawn-muted, midday-bright, dusk-rich) and which ink leads, so the three are siblings rather than strangers or triplets. No two cards sharing a colour family.
⚠️ JUDGE VIBRANCY AT THE DIRECTION LEVEL: the WORLD must have life in it, even a soft one. SATURATED IS NOT DARK — raspberry, coral, marigold, peacock, plum and rich pink are as saturated as ink blue, oxblood, forest and aubergine. The dark half kept winning by habit and the whole shop drifted masculine, so unless something says moody, the warm alive half is the default. THREE OR MORE PALE GROUNDS IS A FAILED SET, as is a pale ground on a subject famous for a colour; where one takes a pale ground its motif must carry saturated ink. Where the OCCASION owns a colour temperature (Christmas candlelit, a summer wedding bleached, retirement golden-hour), let it pull the palette without erasing the subject's colours.
- typeface: you are also the typographer. In under fifteen words name the LETTERING PERSONALITY and why it fits. Build it the same way every time: a real typographic idiom (a historical style, a trade, a printing method, a decade) PLUS the world it borrows from — the second half is what stops it being a font name. Choose all of it from the subject, the angle AND the recipient, never habit: deadpan usually wants restraint, proud can carry a grand display face, a nan leans soft and generous, a mate can go loud. The workwear-slab end of the menu is for people who genuinely suit it, not the default reach. ALL THREE COME FROM THE DIRECTION'S TYPE MOOD and should read as one designer's hand — vary the ROLE, not the personality: a display cut and a quieter companion, or one idiom at different weights. Three IDENTICAL settings is lazy.

RULES:
${cheeky
  ? '- Classy ARTWORK always: no clip-art energy, no emoji. The words are another matter — see RUDE MODE at the top, which overrides politeness on the front lines.'
  : '- Classy always: no clip-art energy, no emoji. Completely clean language — no swearing, no innuendo.'}
- ⚠️ NEVER INVENT A DATE, A YEAR OR AN AGE. This is a correctness rule, not a style one: the card gets PRINTED and POSTED to a real person, and we do not know when they started their hobby, what year they were born, or how old they are. "Official sauce taster since 1985" and "Taste tester since 2010" are cards that are factually WRONG about the recipient, and wrong is far worse than bland. No "since ____", no "est. ____", no birth years, no ages, no anniversary counts.
  The ONLY numbers you may state as fact are the ones the BRIEF gave you — if it says "his 60th" or "retirement after 40 years", those are real and worth using prominently. Every other number must read as OBVIOUS COMIC EXAGGERATION rather than biography: "nine hours, no fish" and "£400 of gear, £2 fish" are jokes about the hobby that nobody would fact-check, whereas a year is a checkable claim about a person. Test: could this number be WRONG about this individual? If yes, cut it.
- BRITISH MONEY AND MEASURES. These cards are printed and posted in the UK. Any sum of money is in POUNDS — "£400 gear, £2 fish", never "$400". Miles, not kilometres. A dollar sign on the front is a card we cannot sell here.
- Brands/bands/places evoked through objects and colours (a cassette and bucket hat; never logos, never lyrics, never real faces). Song/film TITLES may be name-dropped if the line still parses naturally.
- THE OCCASION MAY APPEAR ON THE FRONT, ON ONE CONDITION: IT MUST BE FUSED, NOT BOLTED ON. Any of the three angles may use it. The test is whether the occasion is DOING WORK in the joke or just sitting next to it:
    FUSED (good) — the occasion word is the thing being punned, or the joke only exists because of the occasion. Removing it breaks the line, because it was load-bearing.
    BOLTED ON (dead) — the occasion is a separate clause stapled to a line that had already finished: "Make Waves, It's Your Birthday!", "Red Devil, Red Birthday", "Shake Things Up, It's Your Birthday". Cover the occasion clause with your thumb; if the rest of the line is unharmed, the clause was filler and must go.
  The occasion is NEVER a substitute for having something to say about them. If you find yourself adding it because the line felt thin, the line is thin — fix the line. And do not let all three cards lean on it: a set where every front says "birthday" is a monotonous set, whatever the artwork does.
  ⚠️ BUT WHEN NO AGE IS STATED, EXACTLY ONE FRONT MUST SAY WHAT THE OCCASION IS. With an age, the number does this by itself — "35. Away We Go." and "Nan's 78? Best in blossom" are unmistakably birthday cards. With no age, a whole set can leave the rack guessing: "Best Mate. Best Awayte.", "Away Days Take Proper Planning." and "Paying three figures to see less of the ball than the steward" is a good set of cards for no particular occasion.
  So on an ageless brief, ONE card names it and the other two stay pure joke. Bend the word rather than bolting it on — "Hope Your Hatchday's A Good One", "A Very Happy Pourthday" — or let the occasion be the thing being under-reacted to. Everything above still applies: it must be FUSED, and thumb-testing that card should break it.
- INSIDE MODE: auto → write inside_text. own or blank → inside_text = "".

FINAL CHECK — do this LAST, immediately before returning: FIRST, POINT AT THE CARD for each of these, and rebuild before anything else if you cannot — (a) the REAL DETAIL, if the brief gave one; (b) the THING THEY CANNOT STAND, if the brief gave one; (c) if NO AGE was stated, the one front that says what the occasion is; (d) if an AGE WAS stated, COUNT two things across your three fronts — how many BEGIN with the number followed by a full stop, and how many state the number in the words while the art_direction also draws it. The answers must be AT MOST ONE, and ZERO. Three cards opening with the same number is one template three times, and a number printed twice on one card reads as a mistake. Fix by moving it: if the artwork carries it, cut it from the line; if the line carries it, take it out of the art_direction. Cannot point at (a) or (b) and you have written a set about a stranger who likes a thing. Cannot point at (c) and you have written three cards for no particular occasion.${cheeky ? 'FIRST count how many of your three cards carry genuine cheek on the front. If it is fewer than two, go back and make them ruder before you do anything else — this is the single commonest way this brief gets failed. Then ' : ''}read all NINE candidate lines once more and name the TURN in each one out loud to yourself. REPLACE any line that has no nameable turn, OR contains "vibe"/"vibes", "level up", "boss", "legend", "goals" or "mode", OR uses a banned title formula ("Master/King/Queen/Lord of ___", "The only ___ in the family", "Born to ___", "Another year ___"), OR would need explaining in a pub, OR bolts the occasion onto the end of a line that had already finished (thumb-test it: cover the occasion clause, and if the rest is unharmed the clause is filler). Every candidate you hand over must be one you would be happy to see chosen — a shortlist with two dead lines in it is a shortlist of one.

Return JSON: {"concepts":[{...},{...},{...}]} — one subject, three angles, three formats, three palettes, and three candidate lines inside each.`;
}

/** SERIOUS MODE — the writer for humour-off occasions (sympathy today;
 *  the profile decides, not this function). A separate prompt on
 *  purpose: the Quirky writer is optimised end-to-end for jokes — turn
 *  tests, cheek, disproportion — and threading "unless it's a sympathy
 *  card" through ninety lines of comedy machinery is how a pun ends up
 *  on a condolence card. Same JSON shape out, so the judge/selector,
 *  ban floor, renderer and client need no changes. */
function seriousConceptSystemPrompt(profile: OccasionProfile): string {
  return `You write SINCERE cards for Celebrait — flat-illustrated, beautiful, quiet. This occasion is NOT a celebration and there are NO jokes on these cards: no puns, no wordplay, no wit, no cheek, no exclamation marks. Presence beats cleverness. If a line makes you smile at its craft, it is wrong for this card.

THE OCCASION BRIEF:
${profile.brief}

You are given who the card is for, the occasion, and ONE thing the recipient loves. Return THREE concepts as JSON — three genuinely different registers of comfort, so the sender can choose how much to say:
1. angle "comfort" — the plainest card. Very few words, completely direct. The card does the being-there.
2. angle "warmth" — their loved thing as gentle solace: a quiet corner of their world, holding still, still theirs. The words acknowledge softly; the picture carries the tenderness.
3. angle "strength" — quiet support facing forward. Steadiness, not encouragement; never brisk, never "onwards".

EVERY LINE MUST PASS:
- TRUE AND PLAIN: something a thoughtful friend would actually write by hand. Simple established phrases are fine here — sincerity beats novelty, this is the one card where familiar words help.
- NO FALSE COMFORT: nothing that explains, fixes or hurries — no "at least", no "everything happens for a reason", no "time heals", no "they'd want you to", no assumed religion or afterlife unless the brief itself is religious.
- NO PERFORMANCE: no poetry-voice, no grand abstractions ("the tapestry of life"), no addressing the person who died. The card speaks quietly to the LIVING person holding it.
- MAXIMUM 8 words on the front. Shorter is almost always better here.

⚠️ DECIDE THE LOOK ONCE, BEFORE YOU DESIGN ANY CARD. Settle on a single quiet visual world — its soft palette family, its calm type mood — and hold all three cards inside it. Three unrelated cards read as machine output; a set that belongs together reads as care, which is the whole point of this occasion. State it in the "direction" field, identical on all three.

Each returned concept:
- direction: ONE sentence, IDENTICAL on all three, naming the quiet visual world this set lives in.
- angle: "comfort", "warmth" or "strength" — one of each, in that order.
- format: "statement" for at least two of the three — this is the occasion for stillness and space. Never "pattern" or "label"; density reads as noise here.
- front_candidates: EXACTLY THREE candidate lines, strongest first, each max 8 words, each passing every test above.
- inside_text: MAXIMUM 24 words. Gentle, unhurried, no advice, no timelines. May simply continue the front's thought. "" only if asked.
- art_direction: one sentence. Soft still-life only — a quiet corner of their loved thing's world at rest: NEVER humans, NEVER faces, NEVER religious symbols unless the brief asks, never occasion clichés (no lilies-and-doves kitsch unless genuinely earned). Stillness is the mood: things at rest, light low and kind.
- palette: ground first, then TWO or THREE muted inks, accent named but barely used. Soft, pale, quiet throughout — three gentle grounds across the set is CORRECT for this occasion. No fluorescents, no hot accents, nothing loud. NEVER name silver, gold, grey, chrome, metallic or white as an ink — they are not colours, and naming one invites rendered metal into the artwork; every ink must be a colour from a tube.
- typeface: a calm, humanist lettering personality in under fifteen words — gentle serif or soft script territory, never bold display, never playful.

Return JSON: {"concepts":[{...},{...},{...}]}.`;
}

/** The serious judge: chooses from the shortlist like the Quirky judge,
 *  but its loyalties are inverted — it hunts for accidental levity and
 *  false comfort instead of dryness. Same response schema. */
function seriousJudgeSystemPrompt(profile: OccasionProfile): string {
  return `You are the editor for SINCERE cards at a good independent card shop. You are shown a brief and three concepts, each with artwork already decided and a SHORTLIST OF THREE candidate front lines. This is not a celebration; your loyalty is to a person going through something hard.

THE OCCASION BRIEF:
${profile.brief}

YOUR JOB IS TO CHOOSE the single best candidate per concept. Only if ALL THREE fail may you write a replacement (same register, max 8 words, passing every test below).

Judge every candidate, in order:
1. NO LEVITY — any pun, wordplay, wit, cheek or exclamation mark is an INSTANT FAIL, however gentle it seems. A joke on this card is the worst thing this shop could print.
2. NO FALSE COMFORT — "at least", "everything happens for a reason", "time heals", "in a better place", "they'd want you to", assumed faith: all FAIL. Nothing that explains, fixes or hurries.
3. TRUE AND PLAIN — would a thoughtful friend write this by hand? Performance-poetry voice, grand abstractions and addressing the deceased all FAIL. Familiar, simple phrasing is a strength here, not a weakness.
4. UK AUDIENCE — British English, British restraint. "Mum" never "Mom".
5. FIT — matched to the relationship named in the brief. Warmer for family; steadier for a colleague.
6. PICTURE — the words must sit rightly beside the described artwork's stillness.

Between candidates that all pass, choose the QUIETEST one that still says enough.

For each concept return:
- chosen_index: 0, 1 or 2
- verdict: "pick", or "fix" only when all three failed
- reason: one short clause
- front_text: the chosen candidate verbatim (or your replacement if "fix")
- inside_text: the original if it works; a gentle rewrite if not (max 24 words)

Return JSON: {"cards":[{...},{...},{...}]} in the order given.`;
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
function judgeSystemPrompt(cheeky = false, profile: OccasionProfile = OCCASION_PROFILES.celebration): string {
  // The editor never used to be told cheek had been ordered, which got
  // worse when it became the SELECTOR: faced with one rude line and two
  // polite ones it quietly took a polite one every time, and the toggle
  // looked broken from the outside.
  const cheekBlock = cheeky
    ? `\n⚠️ THIS CUSTOMER ASKED FOR A RUDE CARD. Sweary, mickey-taking, innuendo-laden lines are exactly what was ordered, and a polite line is the WRONG answer here however well made it is. Where a shortlist offers both, TAKE THE RUDER ONE — that is what was paid for. Do not sand anything down, do not substitute a tasteful pun, and never rewrite a cheeky line into a clean one. Your job is to pick the funniest rude line, not the safest line.
Asterisk-masked swearing ("f***", "s***") is the HOUSE STYLE for the strongest words on a card front, not a fault — never "correct" it to a milder word, and never unmask it. Treat a masked strong swear as ruder than an unmasked mild one: "Don't f*** it up" beats "Don't bugger it up" every time. "Bugger", "bloody", "sod" and "git" on their own do not count as rude at all.
The limits still hold: nothing using slurs, nothing about race, sexuality, religion or disability, nothing sexual beyond seaside-postcard innuendo, nothing cruel about age, weight, illness or death. Reject on those grounds and only those grounds; "a bit much" is not a reason when a bit much is the order.\n`
    : '';

  return `You are a ruthless greeting-card editor at a good independent card shop. You are shown a brief and three card concepts written by someone else. Each concept has its artwork already decided, and a SHORTLIST OF THREE candidate front lines. Your ONLY loyalty is to the person who will receive the card.
${cheekBlock}
THE OCCASION BRIEF — the buyer's mindset for this occasion; judge every line against it: ${profile.brief}

YOUR JOB IS TO CHOOSE. For each concept, pick the single best candidate line from its shortlist. You are not looking for a line you would have written — you are looking for the strongest of the three in front of you. Only if ALL THREE are dry may you write a replacement yourself.

Judge every candidate line, and the inside_text, against these, in order:

1. RECOGNITION — would the recipient INSTANTLY know this card is about their thing? The reference must be unmistakable to someone who loves that subject. Vague nods fail: a card about a comedian that could equally be about any comedian is a FAIL. Ask yourself: could I swap the subject for something else and this line still works? If yes, it FAILS.
   COVER THE PICTURE when you test this. The artwork is deliberately generic for films, books, games, bands and teams — we do not draw anyone's invented artefacts or logos — so the LINE has to carry the recognition by itself. A line that only lands because the picture is doing the work is a FAIL. Worked example: "Wand-erful Sister, Always Charming" over wizarding artwork is a generic witch card in words, and it squanders "Always", the one word from those books that everybody knows.
2. THE BUYER — remember who is actually paying. The person choosing this card is usually NOT the fan: a daughter buying for her Harry Potter dad, a mate buying for a United supporter. If she cannot tell at a glance that the card is good, she never buys it and the fan never sees it. So the reference must sit in the FAMOUS layer of that world — what a non-fan would name if you asked them what they know about it — and not in a deep cut only the devoted would catch. A line that requires fandom to appreciate is a FAIL, however clever. Specific is still right; obscure is not.
3. UK AUDIENCE — British English and British sensibility. No Americanisms — "MOM" IS THE ONE THAT KEEPS GETTING THROUGH AND IT IS FATAL ON A MOTHER'S DAY CARD: it is MUM, always. Also no "gotten", "candy", "vacation", "y'all", "awesome", "buddy", "soccer", "diapers", "fall" for autumn, no US-centric references, no American spelling. ⚠️ MONEY IS IN POUNDS: a "$" on a card posted from Britain to a British address is an instant fail — "£400 gear, £2 fish", never "$400". Same for miles not kilometres, and British measures generally. It should sound like it was written in Britain, because it was.
4. THE TURN — the test that matters most. EVERY card, all three angles, must contain a surprise you can name in five words or fewer. Quirk is the house voice here, not one of three flavours: a line with NO turn is DRY, and dry is a FAIL even when the line is true, warm, well written and correctly aimed. Judge the turn by its angle:
   • wordplay: the turn is in the LANGUAGE. The pun must be smooth and must actually land. A groan is a fail; a pun that needs explaining is a fail.
   • deadpan: the turn is in the UNDER-REACTION — something absurd reported with a completely straight face. A flat statement of fact with nothing daft in it is the classic dry fail ("Manchester United Comes First", "The only mixologist in the family"). Quiet is fine; empty is not.
   • proud: the turn is in the DISPROPORTION — total straight-faced seriousness about something trivial. ⚠️ REJECT ANY LINE THAT IS A TITLE. "[Grand noun] of the [Thing]" is the reflex and it is banned: Master of the Tackle Box, Sovereign of the Stream, Sultan of Suds, Baron of Bar Banter, Pub Quiz Royalty, anything Extraordinaire. They are interchangeable, they could be written from a thesaurus without knowing the person, and three of them in a row make the whole shop look like one idea. Prefer the line that sounds like something you would actually say to them in a pub: a plain fact of authority, an absurd credential with a number in it, a house rule, a flat verdict, a backhanded honour. If the shortlist offers a title AND a spoken line, take the spoken line every time.
5. NO INVENTED FACTS — an instant fail, and the only criterion about being WRONG rather than weak. TWO KINDS, both fatal:
   (a) INVENTED BIOGRAPHY. We know only what the brief says: the thing they love, their age if given, and anything in the extra fields. A line asserting a trip they have taken, a place they have been, a thing they own, an expertise they hold or a habit they keep is a stranger guessing at a life. Test it as the BUYER would: could they read this and think "that's not true"? Observed failures for a mum whose brief said only "New York City": "A weekend away, and somehow you've already found the proper deli"; "She can spot a decent slice instantly". Both well written, both invention. The good card from the same brief claimed nothing about her at all.
   A joke about the SUBJECT that is true for anyone who loves it is not invention and is exactly what we want.
   (b) INVENTED DATES AND AGES. We do not know their age, birth year, or when they took up the hobby, so any "since 1985", "est. 2010", stated age or anniversary count may simply be untrue about them, printed and posted. Reject it however good the line is. Numbers the BRIEF supplied ("his 60th", "40 years") are fine and welcome; comic exaggerations nobody would check ("nine hours, no fish") are fine. A checkable claim about this person's life is not.
6. CONCRETE, NOT SENTIMENTAL — the line must carry a real detail from their world: an object, a number, a place, a ritual, a thing they say. Sentiment and adjectives alone ("You're amazing at this", "a barrel of laughs") is the single commonest reason a card feels mass-produced. Judge a CLEAN line to exactly the same standard of sharpness as a rude one — politeness is never a licence to be vague, and where a shortlist offers a specific clean line and a warm woolly one, take the specific one.
7. FIT — right for this relationship and occasion. Read WHO closely: a card for a nan shouldn't sound like one for a mate, a colleague should never get family-grade intimacy, a stated age tunes the voice (no age stated = no age jokes), and gender is only ever what the brief SAYS — a line or look that assumes gender from the hobby FAILS. On couples' occasions, check the card sounds like the right person speaking to the right person.
   The occasion is ALLOWED on the front, in any of the three angles, but only where it is FUSED into the joke — punned on, or the reason the joke exists. Thumb-test anything that mentions it: cover the occasion clause, and if the rest of the line reads perfectly well without it, the clause was bolted on and the line FAILS ("Make Waves, It's Your Birthday!", "Red Devil, Red Birthday"). A fused occasion is a strength; a stapled one is filler hiding a thin line.
8. PICTURE — the words and the described artwork must complete each other. If the line would work over ANY picture, it FAILS.
9. CLEAN CRAFT — parses as a natural sentence, correctly spelled, max one exclamation mark, no "vibes/level up/boss/legend/goals/mode".

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

/** THE LANDING CHECK — the last thing before a card is drawn.
 *
 *  Aidan, 2026-08-18, after "A Proper Old Traffordy" shipped past
 *  fifteen rules: "we just need to ask the model is this cool for
 *  someone who's typed in what they have... every single thing needs to
 *  be landing - no crap at all. Is that really hard, are we
 *  overstepping?"
 *
 *  We were overstepping on ARCHITECTURE, not standards. The writer had
 *  accumulated ~15 competing rules and each new one made the others
 *  quieter — the club-specificity rule added that morning drowned out
 *  the parse rule that had been there for days, and produced a word
 *  that is not a word.
 *
 *  So this is deliberately NOT a sixteenth rule. It is one separate
 *  call with one job, reading the finished cards cold, asking the blunt
 *  question a person in a shop would ask. The same move that fixed the
 *  judge (choosing beats repairing): one job, done properly, beats one
 *  call doing everything.
 *
 *  The bar is NOT "brilliant" — some lines will be flat and that is
 *  survivable when the customer sees three. The bar is NOTHING BROKEN:
 *  bland ships, nonsense never does. ~£0.003. */
export function landingCheckPrompt(): string {
  return `You are a straight-talking person standing in a British card shop in 2026. You are shown the brief someone typed and the finished card lines written for it.

ONE QUESTION PER CARD: is this actually any good? Would it land for the person who typed that brief — or is it, honestly, a bit crap?

Judge it whole, the way a human does in the two seconds before they put a card back on the rack. Do not score it against a checklist. React to it.

YOU ARE SHOWN TWO THINGS PER CARD: the LINE, and the LOOK it will be printed in — its medium, its colours and its lettering. A card is both. Judge both, and say which one you are killing.

KILL THE LINE if any of these are true:
- IT IS NOT ENGLISH. Invented words, mangled puns, phrases nobody says. A real observed failure: "A Proper Old Traffordy" for a Manchester United fan — it names the ground and means nothing. If you cannot say it out loud to another person without stumbling, it is dead.
  ⚠️ BUT A CLEAN PORTMANTEAU IS NOT A MANGLED ONE, and this distinction is the whole wordplay angle. Card shops are built on deliberately invented words, and the test is whether a reader DECODES IT ON SIGHT with no help: "Fourana" on a four-year-old's Moana card is instantly two things at once and lands — it is a good card, not a broken word. "A Proper Old Traffordy" cannot be decoded because there is nothing to decode. Kill the ones that resolve to nothing; keep the ones that resolve instantly. Being invented is not the fault.
- YOU HAVE TO EXPLAIN IT. A card that needs unpacking has already failed.
- IT IS ABOUT NOTHING. Generic warmth that would suit anybody, or a joke that could sit on any card in the shop. THIS INCLUDES THE NEAR MISS, which is harder to spot and just as dead: a card that answers the broad CATEGORY instead of the thing they actually typed — dance music instead of Ibiza, football instead of the club, the beach instead of the film. If someone who likes the category but not THIS thing would be equally pleased with it, it is about nothing.
- IT GUESSES AT THEIR LIFE. Claims about trips, possessions, expertise or habits nobody mentioned in the brief.
- IT WOULD EMBARRASS THE SENDER. Wrong register for the relationship, or a joke that lands as an insult.
- IT DOES NOT SOUND BRITISH in 2026 — Americanisms, dated slang, try-hard internet voice.

KILL THE LOOK if any of these are true:
- IT BELONGS TO NO WORLD. Cover the words with your thumb: the medium, the colours and the lettering should still tell you roughly what this card is about. A real observed failure: a Moana card for a four-year-old, printed as a bright orange ground with heavy blue poster type. Good design, wrong card — it could have been about anything, and the buyer is paying for artwork that is doing nothing.
- IT IS THE WRONG AGE. An adult, ironic, editorial or brutalist look on a small child's card; a childish look on a grown adult's. The age is in the brief.
- IT FIGHTS THE LINE. The words are warm and the look is cold, or the joke is a mutter and the artwork is shouting.
- IT IS THE WRONG WORLD ENTIRELY. Colours and medium borrowed from a different subject than the one in the brief.

Do NOT kill a look merely for being plain, quiet or type-only. A restrained card that clearly belongs to its subject is a good card.

⚠️ WHO THE CARD IS FOR, on a small child's card: the WORDS are very often written for the ADULT reading it out, and that is normal, correct and how the whole aisle works — a card that makes a parent laugh about their four-year-old's obsession is doing its job, and "this is aimed at the grown-up" is NOT a reason to kill a line. Nobody buys a card for a four-year-old to read alone. It is the LOOK that must belong to the child. Words for the adult, artwork for the kid.

PASS IT if it is simply good, or even just solid and true. Quiet and warm is a pass. Plain is a pass. You are not looking for brilliance in every card, you are keeping rubbish off the rack.

Return JSON: {"cards":[{"verdict":"pass"|"kill","what":"words"|"look","why":"<six words max, only when killing>"}]} — one per card, in the order given. "what" says which half failed; if both did, say "look" and we will redraw it around the line.`;
}

// ═══ V2 — ARCHETYPE → SHORT PROMPT → CODE REFEREE ═══════════════════
// The winning baseline architecture (short 8/8, archetype 7/8 vs
// classic 5-6/8 and unstable). Correctness lives HERE in code, not in
// prompt lectures; the archetype supplies per-person aim AND the
// oblique referee vocabulary a static hint list can never know
// ("sky-blue" is Manchester City).

const V2_SWEAR = /f\*+\w*|s\*+|c\*+|bollocks|bastard|wanker|prick|twat|bellend|knobhead|arse|piss|shag|tits|knob\b|fuck\w*|shit\w*/i;
/** ⚠️ STRONG SWEARING PRINTS MASKED — Aidan's decision, 2026-08-20.
 *  Only the three that UK card shops actually asterisk. The mild
 *  British end (bollocks, arse, bastard, wanker, prick, twat) prints in
 *  full on purpose: "b*******" reads as a glitch, not as cheek, and no
 *  rack in the country masks it.
 *  This is a CODE floor rather than an instruction because the prompt
 *  version of this rule failed in exactly the way law 5 predicts — the
 *  81-card rack came back with "ABOUT FUCKING TIME" sitting next to
 *  "Still hot as f***", and a mixture on a shelf reads as a misprint. */
const V2_SWEAR_RAW = /\b(fuck\w*|shit\w*|cunt\w*)\b/i;
const V2_BANNED = /\b(vibes?|level up|bossin?|legend(ary)?|goals|beast mode|standards?)\b|\b(master|king|queen|lord|sultan|champion|guardian|keeper) of\b|extraordinaire|royalty/i;
const V2_MALE = /\b(man|men|bloke|lad|lads|guy|boy|he|him|his|sir|king|gent)\b/i;
const V2_FEMALE = /\b(woman|women|lass|girl|she|her|hers|madam|queen|lady|ladies)\b/i;
const V2_OCC = /\bbirthday\b|\bhappy returns\b|\bmany happy\b|\bcandles?\b|\bcake\b|\bcelebrat/i;
const V2_DAYS = new Set(['today','monday','tuesday','wednesday','thursday','friday','saturday','sunday','holiday','weekday','everyday','someday','yesterday','midday','day','days','matchday','payday','workday','doomsday','mayday']);
const v2SaysOccasion = (t: string) =>
  V2_OCC.test(t) || (t.toLowerCase().match(/\b[a-z']*day'?s?\b/g) ?? []).some((w) => !V2_DAYS.has(w.replace(/'s$|s$/, '')));

interface V2Brief {
  who: string; gender: 'him' | 'her' | 'unspecified'; age: number | null;
  interest: string; dislikes?: string; tone: string; cheeky: boolean; name?: string;
  generic?: boolean;
}
interface V2Hints { interest: RegExp | null; dislike: RegExp | null }

const wordsToRe = (ws: unknown): RegExp | null => {
  const list = Array.isArray(ws) ? ws.map((w) => String(w).trim()).filter((w) => w.length > 1) : [];
  if (!list.length) return null;
  return new RegExp(list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
};

/** Every floor, in code. Returns named violations for the repair round. */
export function v2Verify(cards: CardConcept[], b: V2Brief, hints: V2Hints, slots?: Array<{ register: string }>): string[] {
  const v: string[] = [];
  if (cards.length !== 3) return ['not-three-cards'];
  const fronts = cards.map((c) => String(c.front_text ?? ''));
  // ⚠️ THE LENGTH REGISTERS ARE FLOORS TOO. Without this a 20-word
  // description landed in a SHORT slot and read as art direction on the
  // front of a card. Short hits, mid breathes, long builds — enforced.
  if (slots) {
    fronts.forEach((f, i) => {
      const words = f.trim().split(/\s+/).filter(Boolean).length;
      const r = slots[i]?.register;
      if (r === 'short' && words > 8) v.push(`length: card ${i + 1} is the SHORT card — max 8 words, it has ${words}`);
      if (r === 'mid' && words > 14) v.push(`length: card ${i + 1} is the MID card — max 14 words, it has ${words}`);
      if (r === 'long' && (words < 15 || words > 40)) v.push(`length: card ${i + 1} is the LONG read-aloud card — 20-35 words that build and land, it has ${words}`);
    });
  }
  const arts = cards.map((c) => String(c.art_direction ?? ''));
  const whole = fronts.map((f, i) => `${f} ${arts[i]}`);

  if (b.cheeky && fronts.filter((f) => V2_SWEAR.test(f)).length < 2) v.push('rude-floor: at least TWO fronts need real swearing');
  // Checks the inside as well as the front: both are printed, and an
  // unmasked word inside a card whose front is masked is the same
  // inconsistency one panel further in.
  cards.forEach((c, i) => {
    const printed = `${c.front_text ?? ''} ${c.inside_text ?? ''}`;
    const hit = printed.match(V2_SWEAR_RAW);
    if (hit) v.push(`swear-unmasked: card ${i + 1} prints "${hit[0]}" in full — mask strong swearing as the first letter followed by asterisks`);
  });
  if (b.dislikes && hints.dislike) {
    const n = whole.filter((w) => hints.dislike!.test(w)).length;
    if (n === 0) v.push(`dislike-missing: exactly one card must be built on "${b.dislikes}"`);
    if (n === 3) v.push('dislike-everywhere: the dislike may carry at most two cards');
  }
  if (hints.interest) {
    if (whole.filter((w) => hints.interest!.test(w)).length < 2) v.push(`generic-set: at least two cards must be unmistakably about ${b.interest}`);
    // ⚠️ 100% OF ILLUSTRATED ARTWORK COMES FROM THEIR WORLD — per card,
    // not per set (Aidan: "100% of cards must visually reference unless
    // they are type only!!!"). One-per-set let a betting marquee ride
    // through an Oasis set on another card's back. The dislike's world
    // counts too — a fused dislike card is still their world.
    cards.forEach((c, i) => {
      if (String(c.format) === 'typeled') return;
      const a = arts[i];
      if (!hints.interest!.test(a) && !(hints.dislike && hints.dislike.test(a)))
        v.push(`generic-artwork: card ${i + 1} is illustrated but its artwork has nothing of ${b.interest} in it — every illustrated card's artwork comes from their world (only type-only cards are exempt)`);
    });
  }
  const birthYear = b.age ? new Date().getFullYear() - b.age : null;
  if (fronts.some((f) => (f.match(/\b(19|20)\d{2}\b/g) ?? []).some((y) => Number(y) !== birthYear)))
    v.push('invented-year: remove any year the brief did not give you');
  if (b.age) {
    const lead = new RegExp(`^\\s*${b.age}[.\\s]`);
    if (fronts.filter((f) => lead.test(f)).length > 1) v.push(`number-template: only one front may open with the bare number ${b.age}`);
    const num = new RegExp(`\\b${b.age}\\b`);
    if (cards.some((_, i) => num.test(fronts[i]) && num.test(arts[i]))) v.push('number-twice: the number goes in the words OR the artwork of a card, never both');
  } else {
    const n = fronts.filter(v2SaysOccasion).length;
    if (n === 0) v.push('occasion-missing: at least one front must say what the occasion is');
    // A GENERIC roll is ABOUT the occasion — all three may name it.
    if (n === 3 && !b.generic) v.push('occasion-everywhere: only one front names the occasion');
  }
  if (b.name) {
    // ⚠️ EXACT-NAME FLOOR. If a front uses the name it must match
    // letter-for-letter — a near-miss ("Evy" for "Evie") is the worst
    // printable error there is. And at most ONE front carries it.
    const escaped = b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exact = new RegExp(`\\b${escaped}\\b`, 'i');
    const stem = b.name.slice(0, Math.max(3, b.name.length - 2)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nearMiss = new RegExp(`\\b${stem}\\w*\\b`, 'i');
    if (fronts.some((f) => !exact.test(f) && nearMiss.test(f))) v.push(`name-misspelt: the recipient's name must be spelled EXACTLY "${b.name}"`);
    if (fronts.filter((f) => exact.test(f)).length > 1) v.push('name-everywhere: at most one front carries the name');
  }
  if (b.gender !== 'unspecified') {
    const wrong = b.gender === 'her' ? V2_MALE : V2_FEMALE;
    if (fronts.some((f) => wrong.test(f))) v.push('gender-clash: remove gendered words that contradict the recipient');
  }
  if (fronts.some((f) => V2_BANNED.test(f))) v.push('banned-word: a front uses a banned word or title formula (vibes/legend/standards/Master of...)');
  for (const a of arts) {
    const hit = namedArtefacts(a);
    if (hit.length) { v.push(`ip-floor: the artwork asks for protected material (${hit.join(', ')}) — use that world's ordinary objects instead`); break; }
  }
  const seen = new Map<string, number>();
  const briefWords = new Set(`${b.interest} ${b.who}`.toLowerCase().match(/[a-z']{4,}/g) ?? []);
  for (const f of fronts) {
    new Set(f.toLowerCase().match(/[a-z']{5,}/g)?.filter((w) => !briefWords.has(w)) ?? [])
      .forEach((w) => seen.set(w, (seen.get(w) ?? 0) + 1));
  }
  const dupes = Array.from(seen.entries()).filter(([w, n]) => n >= 2 && !['still','another','birthday','happy','years','about','being'].includes(w));
  if (dupes.length) v.push(`shared-vocab: "${dupes[0][0]}" appears on more than one front — each card gets its own vocabulary`);
  return v;
}

/** The home register — Aidan's look as a STARTING POINT with a real
 *  departure licence, never a cage (no ink counts, no media list). */
const V2_CELEBRAIT_REGISTER = `THE LOOK — start every card from the Celebrait register: GRAPHIC — flat, deliberate, made rather than photographed — type doing real work, ONE SUBJECT PER CARD, current not antique.
⚠️ COLOUR — THE ONE RULE THAT APPLIES TO EVERY CARD WE MAKE, however much or little the brief gave you.
FRESH, CLEAN, POPPING — the card looks printed THIS YEAR, whatever its volume. Soft and bold are equally welcome and both have to POP: a soft palette earns it through light and real contrast — a pale ground with one ink that truly means it — and a bold one through commitment, not noise. Every card, soft or bold, should feel like it belongs in the same modern shop.
⚠️ THE TWO DITCHES, both observed on our own rack. One: DINGE — greyed-down, muddied, antiqued colour, the heritage varnish that makes new work look like old stock (a gardening 60th came back in compost browns and varnish sepia, dull as a parish notice). Two: the flat primary poster trio with industrial type, which made a month of cards read narrow and blokey. Between those ditches is the whole modern road, and all of it is open.
THE SUBJECT LENDS THE HUES; THE BRAND SETS THE FINISH. Take WHICH colours from their world — then print them the way a modern shop would, clean and alive, never faded down to seem tasteful. An allotment card is leaf and tomato and cream in today's inks, not soil and sepia.
⚠️ AGE NEVER CHOOSES THE PALETTE. A 60th is printed in inks exactly as current as a 21st — era belongs in a motif if anywhere, never in the colour. "Older person, so mute it" is the assumption this rule exists to kill.
⚠️ ONE IDEA — AND LET IT BE RICH. One idea is NOT one lonely object marooned on an empty ground; that card looks cheap in the other direction and nobody pays for it. A still life where the things genuinely belong together, a landscape, a made thing seen close, a single object drawn large and beautifully — all of these are one idea, and depth, texture, shadow and detail INSIDE it are welcome and wanted.
⚠️ WHAT FAILS IS THE TOKEN CHECKLIST: unrelated props laid out flat to prove the theme, or a number assembled from twenty tiny things. Observed on one 25th for a trip to Ibiza: a boarding pass, a phone, sunglasses and a flight path; then a phone, a skyline, earbuds and an airport pint; then sunglasses, a wristband, earphones and a bus ticket. Four proofs of the topic, no picture, three times running.
THE TEST: would these things be photographed together for their OWN sake, or have they been gathered onto a surface to prove the theme? ⚠️ AND THE TEST CANNOT BE PASSED BY ASSERTING IT. Saying in the art direction that the objects "belong together" or calling the arrangement a still life does not make it one — observed, and it is the tell that the card knows what it is doing. A picture earns it or it does not. THE ORDER OF OPERATIONS IS BEAUTIFUL FIRST, JOKE SECOND: gorgeous at arm's length, then you notice the line — good enough that whoever receives it shows it to somebody else. The register is a SPECTRUM you may use all of: from pure flat print to gently dimensional 3D-FLAT — paper-cut depth, soft shadows, rounded sculptural forms, tactile materials — as long as it stays graphic and deliberate. Photorealism is never home.
⚠️ "OBJECTS NOT SCENES" BANS CLUTTER, NOT PLACES. When the thing they love IS a place — an island, a city, a coastline, a ground — THE PLACE IS THE STRONGEST ARTWORK YOU HAVE, drawn in the register: the flat graphic landscape, the landmark silhouette, the travel-poster horizon at the right hour. Observed failure: an Ibiza brief drew wristbands and flyers three times over while the island — its rock in the sea, its white town, its sunrise terraces — never appeared; the kit of a night out says "clubbing", the place says IBIZA. You also hold a LICENCE TO DEPART entirely when this person's world genuinely calls for another look — take it when it is earned, and make the departure a named decision in "direction", never drift.`;
const V2_OPEN_REGISTER = `THE LOOK — design free: any medium, any palette, anything that is CURRENT and lands for this person. Old styles welcome when treated with a modern eye. BEAUTIFUL FIRST, JOKE SECOND: gorgeous at arm's length, then you notice the line — good enough that whoever receives it shows it to somebody else.`;

/** The first of the two calls: brief in, person out. Exported so
 *  `print-prompts.ts` dumps the exact string production sends. */
export function archetypeSystemPrompt(): string {
  return `You profile REAL PEOPLE for a UK card maker — the person, never the card tradition. ⚠️ Anything you know from old greeting cards is CONTAMINATION here, not insight: asked about a milestone, the tradition answers with symbols from decades-old cards (observed: ceremonial keys on a 21st) while the actual person answers with what their days genuinely contain NOW — profile the person alive in ${new Date().getFullYear()}, whatever their age. Return JSON {"archetype":"100-140 words. FIRST commit to the most likely SPECIFIC TYPE this person is on the brief's evidence — not the demographic average. Every interest splits into distinct tribes at EVERY age (the competitive one, the ritualist, the kit-obsessed one, the quietly devoted one, the social one...) — pick the likeliest for THIS person and profile THAT person: the era they came of age in; what they ACTUALLY react to about this interest (famous layer + insider rituals); what reads cliché vs current to them (current is REGISTER and irony, never slang-stuffing — forced slang is the mum-trying failure); where the line is on cheek for this relationship","interest_words":["12-20 words/short phrases ONLY THIS EXACT SUBJECT owns — its places, people, eras, nicknames, rituals, slang. NEVER words that fit the broad category: for a football club, 'matchday' and 'team news' fit every club and prove nothing; 'Stretford End' proves everything"],"dislike_words":["same for the dislike, or empty"],"palette_world":"THE COLOUR WORLD THIS PERSON'S SUBJECT ACTUALLY LIVES IN, 8-16 words, theirs rather than a designer's default: the light it happens in, the materials it is made of, the hour they love it at. Then give it TODAY'S FINISH — name the hues as a modern print shop would ink them, clean and alive, never aged down to seem tasteful. ⚠️ THE AGE MUST NOT TINT THE COLOUR. No reasoning that older means muted, heritage or sepia, and none that younger means neon — every age shops in the same modern shop, and 'they are 60 so soften it' is the exact failure this field keeps producing. If the brief gave you NOTHING to go on, say so plainly and work from the REGISTER alone — what this tone wants, at any age. Name a ground and a leading colour, and never default to primary poster colour just because it is bold.","territories":["EXACTLY THREE, one per card, and this is the field that stops a set being one joke told three ways. Each must come from a DIFFERENT REGION OF THIS PERSON'S LIFE — if two of them could come up in the same conversation, replace one. ⚠️ Your FIRST instinct for this brief is the region everyone reaches for; keep it as one of the three at most, and go genuinely looking for the other two — what they do that nobody sees, what they are like with other people, what they actually spend their time and money on, what has changed for them lately. Name each in 3-8 words, as an AREA to explore and never as a joke or a line."]}. Concrete, ${new Date().getFullYear()}, UK.`;
}

export function v2SystemPrompt(visual: 'celebrait' | 'open', slots: Array<{ angle: string; format: string; register: string; territory?: string; ground?: string }>, occasionBrief: string): string {
  return `You write and art-direct personalised UK greeting cards — the kind a good independent shop racks in ${new Date().getFullYear()}. From the brief and the archetype, return THREE finished cards.

${occasionBrief}

THE THREE SLOTS — one card each, exactly as assigned:
${slots.map((s, i) => `${i + 1}. angle=${s.angle}, format=${s.format}, length=${s.register === 'long' ? 'LONG (20-35 words, built to be read aloud, stacked as short statements, the last few words land the turn)' : s.register === 'mid' ? 'MID (up to 14 words)' : 'SHORT (up to 8 words, hits like a poster)'}${s.territory ? `, BUILD IT FROM: ${s.territory}` : ''}${s.ground ? `, GROUND: ${s.ground}` : ''}`).join('\n')}
⚠️ GROUND tells you the WEIGHT of that card's background — soft (pale and full of light), mid (a true colour at easy depth) or deep (rich and saturated — still clean, never murky). It does NOT tell you the hue: take that from the subject's colour world. The three are assigned deliberately different so the set has range on a shelf, and a set of three cards at the same weight is the drift we are fixing.
⚠️ WHERE A SLOT NAMES A TERRITORY, THAT CARD LIVES THERE — words and artwork both. The three territories were chosen to be far apart on purpose, because the failure this prevents is three cards mining one seam and reading as one joke told three times. Do not let a second card drift into a first card's territory because the material there felt richer.
The typeled card is TEXT-ONLY: the words set huge ARE the artwork, and its art_direction describes the ground and the typographic treatment.

THE BAR, per card:
- It lands for THIS person — built from their world via the archetype, never the broad category. A card that suits anyone who vaguely likes the topic has failed.
- Each card is its own idea; no distinctive word appears on two fronts.
- No invented facts: no years, ages, habits or history the brief did not give you. A derived birth year may describe the RECIPIENT only, never the subject.
- art_direction: one drawable sentence. ⚠️ EVERY ILLUSTRATED CARD'S ARTWORK COMES FROM THEIR WORLD — 100%, not one of three; only the typeled card is exempt. If the picture would suit a different interest, it has failed however handsome. Real places (NAMED), caricature of public figures, the kit and styling of their world are welcome. Never an actual logo, wordmark or crest, never a copyrighted character depicted as themselves.
- If they love a CLUB, BAND, SHOW or FRANCHISE: say WHICH ONE. Name it, its ground, its people, its eras, its songs — in the words, and in at least one artwork (a real stadium, a real skyline, a caricature are all open to you; only the crest and logo are not). A card that would suit any fan of the category has failed — "checks the team news" is every club in Britain; the Stretford End is one.
- When an artwork uses a real place, art_direction NAMES the actual place and one drawable feature of it — never its category. "A stadium" draws a stock stadium; the named ground with its own roofline, brickwork or setting draws THEIRS. Same for any landmark, venue or street.
${V2_CELEBRAIT_REGISTER && ''}${visual === 'celebrait' ? V2_CELEBRAIT_REGISTER : V2_OPEN_REGISTER}
- If the register is rude: at least two fronts carry real swearing, and the joke must still survive with it removed. ⚠️ STRONG SWEARING IS ALWAYS MASKED — write the first letter and then asterisks for the rest of the word, never the whole word, and never a mixture across the three cards, because a rack shows them side by side and one unmasked word among masked ones reads as a misprint. Mild British swearing prints normally; it is the strong ones that get masked.
- If a dislike is given: exactly ONE card is built on it, fused into the joke.

Return JSON {"concepts":[{"angle":"...","format":"...","front_text":"...","inside_text":"warm, max 28 words, never restates the front","art_direction":"...","palette":"ground + inks in the medium's own terms","typeface":"lettering personality, under 15 words","direction":"the medium/look chosen and why it suits them"}]} — exactly three, in slot order.`;
}

export function registerAdminCardLabRoutes(app: Express): void {
  // ── POST /api/admin/card-lab/concepts ────────────────────────────
  // ── THE CATALOGUE (SCOPE_OCCASION_FIRST WS4) ─────────────────────
  // Save-as-template: Aidan's testing keeps its gold. The image arrives
  // as the Lab's data URL and is persisted to R2 (or local disk in dev)
  // so the template survives tab, deploy and disk wipes; the row keeps
  // the full recipe so a template can be re-rendered or sold with a
  // personalised inside later.
  app.post('/api/admin/card-templates', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const schema = z.object({
      occasion: z.string().min(1).max(80),
      angle: z.string().max(40).optional(),
      recipient: z.string().max(120).optional(),
      interest: z.string().max(200).optional(),
      front_text: z.string().min(1).max(300),
      inside_text: z.string().max(600).optional(),
      palette: z.string().max(400).optional(),
      typeface: z.string().max(300).optional(),
      format: z.string().max(40).optional(),
      art_direction: z.string().max(600).optional(),
      tone: z.string().max(20).optional(),
      age: z.number().int().min(1).max(110).nullable().optional(),
      // 'him' | 'her'; absent means the brief said nothing, which is a
      // real state — those cards suit anyone and belong in every aisle.
      gender: z.enum(['him', 'her']).optional(),
      // Fixed-word stock is a real product, not a failed edit-safe card
      // (see the column's note). Absent = editable, which is both the
      // common case and the safe read of an older client.
      editable: z.boolean().optional(),
      imageUrl: z.string().startsWith('data:image/').max(8_000_000),
    });
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(req.body);
    } catch {
      return res.status(400).json({ message: 'Invalid template' });
    }
    try {
      const buffer = Buffer.from(body.imageUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const filename = `template_${randomUUID()}.png`;
      if (isR2Enabled()) {
        await r2Put(filename, buffer, 'image/png');
      } else {
        await fs.writeFile(path.join(process.cwd(), 'stored_images', filename), buffer);
      }
      // Keeping a card marks its generation row — that flip is what makes
      // keep-rate meaningful. Matched on the exact line within the
      // occasion; best-effort, never blocks the save.
      void db.update(cardGenerations).set({ kept: true })
        .where(sql`occasion = ${body.occasion.toLowerCase()} AND front_text = ${body.front_text} AND kept = false`)
        .catch(() => { /* measurement never breaks making */ });
      const [row] = await db.insert(cardTemplates).values({
        occasion: body.occasion.toLowerCase(),
        angle: body.angle ?? null,
        recipient: body.recipient ?? null,
        interest: body.interest ?? null,
        front_text: body.front_text,
        inside_text: body.inside_text ?? null,
        palette: body.palette ?? null,
        typeface: body.typeface ?? null,
        format: body.format ?? null,
        art_direction: body.art_direction ?? null,
        tone: body.tone ?? null,
        age: body.age ?? null,
        gender: body.gender ?? null,
        editable: body.editable ?? true,
        image_path: filename,
      }).returning();
      res.json({ id: row.id, imageUrl: publicImageUrl(filename) });
    } catch (err) {
      console.error('[CARD-TEMPLATES] save failed:', err);
      res.status(500).json({ message: 'Could not save the template' });
    }
  });

  // Log a generated set so keep-rate has a denominator. Fire-and-forget
  // from the studio: measurement must never be able to break making.
  app.post('/api/admin/card-generations', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const schema = z.object({
      occasion: z.string().max(80),
      tone: z.string().max(20).optional(),
      age: z.number().int().min(1).max(110).nullable().optional(),
      recipient: z.string().max(120).optional(),
      interest: z.string().max(200).optional(),
      cards: z.array(z.object({ angle: z.string().max(40).optional(), front_text: z.string().max(300) })).max(6),
    });
    let body: z.infer<typeof schema>;
    try { body = schema.parse(req.body); } catch { return res.status(400).json({ message: 'Invalid' }); }
    try {
      await db.insert(cardGenerations).values(body.cards.map((c) => ({
        build_commit: (process.env.RENDER_GIT_COMMIT ?? 'local').slice(0, 8),
        occasion: body.occasion.toLowerCase(),
        tone: body.tone ?? null,
        age: body.age ?? null,
        angle: c.angle ?? null,
        recipient: body.recipient ?? null,
        interest: body.interest ?? null,
        front_text: c.front_text,
      })));
      res.json({ ok: true });
    } catch (err) {
      console.warn('[CARD-GENERATIONS] log failed (non-fatal):', err);
      res.json({ ok: false });
    }
  });

  /** Keep rate per build — "is the prompt getting better?" as a number
   *  rather than a feeling. */
  app.get('/api/admin/card-generations/stats', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const occasion = typeof req.query.occasion === 'string' ? req.query.occasion.toLowerCase() : 'birthday';
    const rows = await db.execute(sql`
      SELECT build_commit,
             COUNT(*)::int AS made,
             COUNT(*) FILTER (WHERE kept)::int AS kept,
             MAX(created_at) AS last_seen
        FROM card_generations
       WHERE occasion = ${occasion}
    GROUP BY build_commit
    ORDER BY MAX(created_at) DESC
       LIMIT 8;
    `);
    res.json({ builds: (rows as any).rows ?? rows });
  });

  app.get('/api/admin/card-templates', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const occasion = typeof req.query.occasion === 'string' ? req.query.occasion.toLowerCase() : undefined;
    const rows = occasion
      ? await db.select().from(cardTemplates).where(eq(cardTemplates.occasion, occasion)).orderBy(desc(cardTemplates.id))
      : await db.select().from(cardTemplates).orderBy(desc(cardTemplates.id));
    res.json({
      templates: rows.map((t) => ({ ...t, imageUrl: publicImageUrl(t.image_path) })),
    });
  });

  // Curation needs a bin. The R2 object is left behind on purpose —
  // orphan images are pennies, a botched delete of the wrong object is
  // an unrecoverable template.
  app.delete('/api/admin/card-templates/:id', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Bad id' });
    await db.delete(cardTemplates).where(eq(cardTemplates.id, id));
    res.json({ ok: true });
  });

  // ── GET /api/admin/card-lab/build ────────────────────────────────
  // Which build am I looking at? Added 2026-08-16 after an afternoon of
  // confusion: Aidan was testing on celebrait.co.uk (production, whatever
  // Render last finished building) while every change was being verified
  // locally against the dev database. Cards were being judged against
  // prompt versions that had already moved on, and neither of us could
  // tell. A commit stamp on the page ends that permanently.
  app.get('/api/admin/card-lab/build', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const sha = process.env.RENDER_GIT_COMMIT ?? '';
    res.json({
      commit: sha ? sha.slice(0, 8) : 'local',
      deployedAt: process.env.RENDER_SERVICE_ID ? 'render' : 'local dev',
    });
  });

  app.post('/api/admin/card-lab/concepts', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    if (!openai) return res.status(503).json({ message: 'OpenAI not configured' });
    let body: z.infer<typeof conceptsSchema>;
    try {
      body = conceptsSchema.parse(req.body);
    } catch {
      return res.status(400).json({ message: 'Invalid request' });
    }

    // The occasion brain. Serious occasions swap the whole writer/judge
    // pair, and rude mode is FORCED OFF for them — a ticked box from an
    // earlier card must never carry cheek onto a sympathy card.
    // Birthday is the first occasion with its own world: its brief is
    // composed per request from the buyer's tone and any stated age,
    // rather than read from the static profile table.
    // Interest OR age — one of them has to carry the card.
    const statedAgeValue = body.age ?? statedAge(body.occasion);
    const interestText = body.interest?.trim() ?? '';
    // ⚠️ FULLY BLANK IS A VALID CUSTOMER ON V2 — the GENERIC ROLL
    // (audit: "a random roll can go and just say happy birthday").
    // Classic still requires a subject; it has no machinery for none.
    const fullyGeneric = !interestText && statedAgeValue === null;
    if (fullyGeneric && body.pipeline === 'classic') {
      return res.status(400).json({
        message: 'Give me either something they love or an age — one of them has to be the subject.',
      });
    }

    const classified = classifyOccasion(body.occasion);
    const occProfile = classified.key === 'birthday'
      ? birthdayProfile(body.tone, body.age ?? statedAge(body.occasion))
      : classified;
    const serious = occProfile.humour === 'off';
    // The rude TONE implies cheek; the legacy checkbox still works so
    // the bench and any saved call sites keep behaving.
    const effectiveCheeky = (body.cheeky || body.tone === 'rude') && !serious;
    // Which three of the four angles this set gets. Rotated here so the
    // three shapes stop being identical on every brief we have ever run.
    const chosenAngles = (body.angles as Angle[] | undefined)
      ?? (fullyGeneric ? (['straight', 'deadpan', 'wordplay'] as Angle[]) : pickAngles(body.tone));
    const writerPrompt = () => serious
      ? seriousConceptSystemPrompt(occProfile)
      : conceptSystemPrompt(body.characters, effectiveCheeky, occProfile, body.freeStyle, chosenAngles);

    const briefLines = [
      // ⚠️ "ANYONE" IS A REAL ANSWER, not a missing one. Aidan, planning
      // the spine: "For who though? Who's the recipient". Picking Dad to
      // make a universal 30th card does not just set the register — the
      // prompt tells the writer to put the relationship word ON THE
      // FRONT for family, so it would print "Dad" and stop being stock
      // that suits anyone. Same shape of hole as the required interest.
      body.who.trim().toLowerCase() === 'anyone'
        ? `Recipient: NOT SPECIFIED — this is a RACK card that has to work for whoever picks it up. ⚠️ NO relationship word anywhere on the front: no Mum, Dad, Nan, Grandad, sister, brother, mate, friend. No name, no "to my ___". Nothing that assumes who is sending it or who is receiving it. Write it so a daughter, a mate and a colleague could all reasonably buy it, and let the subject carry the whole card. Register stays warm and middle — neither a nan's softness nor a mate's edge.`
        : `Recipient: ${body.who}`,
      body.recipientName?.trim() ? `Recipient's first name: "${body.recipientName.trim()}" — ⚠️ EXACTLY ONE card may LEAD with the name, designed in: the name set large in the card's own lettering, or the name AS the artwork. Spell it EXACTLY as given, letter for letter — a misspelled name on a printed card is the worst error we can make. The name proves nothing else about them: no gender, age or era inferred from it. The other two cards may use it inside but not on the front.` : '',
      // ⚠️ TWO DIFFERENT RULES, and having only the first one caused a
      // real failure. "Never the joke" stops gendered stereotyping — a
      // woman who fishes gets the same fishing world, not a pink rod —
      // but read alone it says gender is irrelevant to the WORDS, which
      // is how "A fully normal amount of gold for one man." ended up on
      // a card for a woman (Aidan 2026-08-19: "I selected as 'she' so
      // number 2 means nothing"). A gendered noun on a card is read as
      // being about the RECIPIENT, whoever it was aimed at, because that
      // is who the card is for. So: never the BASIS of the joke, and
      // never CONTRADICTED either.
      body.gender !== 'unspecified'
        ? `Recipient gender: ${body.gender === 'him' ? 'male (he/him)' : 'female (she/her)'} — ⚠️ TWO RULES. (1) It tunes palette and type warmth, and is NEVER the basis of the joke: no jokes that only work because of their gender, no gendered hobby clichés. (2) But it must NEVER BE CONTRADICTED. Any gendered word on the front — man, woman, lad, lass, bloke, girl, he, she, his, her, king, queen, sir, madam — reads as being ABOUT this recipient, even when you meant it about the subject, because this is their card. Getting it wrong is a factual error on something we print and post. If a line needs a gendered word that is not theirs, rewrite it neutrally or aim it elsewhere.`
        : '⚠️ NO GENDER STATED, so the cards must work for anyone: no gendered words on the front at all — no man/woman, lad/lass, bloke, girl, he/she/his/her, king/queen, sir/madam. Write it so it is true whoever opens it.',
      // ⚠️ MILESTONE vs ORDINARY AGE — computed here, not left to the
      // writer, because "is 37 a milestone" is a fact about the UK card
      // market and not a judgement call. Aidan 2026-08-19: "let's not
      // fill every card with that number - only put it on every card if
      // its a milestone but dont ignore if its not."
      body.age
        ? isMilestone(body.age)
          ? `Recipient age: ${body.age} — ⚠️ THIS IS A MILESTONE, and the number is the event. It may lead on all three cards, in the words or worked into the artwork, and a milestone set that never shows its number has wasted the strongest thing in the brief.`
          : `Recipient age: ${body.age} — ⚠️ NOT A MILESTONE. The number is TRUE but it is not the occasion: nobody throws a party for a ${body.age}th, so a set that stamps ${body.age} on all three cards is three cards about a number nobody cares about. AT MOST ONE card may use it. But do NOT discard it either — it still tells you the voice, the era they grew up in and what is funny to them, so let it shape every card while appearing on one.`
        : '',
      // ⚠️ BOTH OF THESE ARE FLOORS, NOT PERMISSIONS, and they read as
      // orders for the reason the cheek block does (see the note above
      // conceptSystemPrompt): a hedged line loses every argument with the
      // restraint rules below it. Observed 2026-08-18 — a brief carrying
      // "same shed since 1998" AND "can't stand Liverpool" produced three
      // cards using NEITHER, and the third then invented a habit nobody
      // mentioned because it had nothing real left to say. The two fields
      // that make a card personal were the two being dropped.
      body.detail?.trim() ? `⚠️ THE ONE REAL DETAIL THEY GAVE US: ${body.detail.trim()}. This is the most specific thing you know about this person and it is worth more than the interest, because everyone who likes ${interestText || 'the same things'} is the same and only THIS one has that. AT LEAST ONE of your three cards must be built on it — not a passing mention, the actual idea of the card. If you cannot make it work in words, it goes in that card's artwork.` : '',
      // ⚠️ ONE CARD, AND IT HAS TO FUSE. This went 0 → 3 → 1 in a day and
      // the middle step is worth keeping written down. It reached NO card
      // when hedged; Aidan then asked for all three; seeing all three, he
      // called it: "can't stand is too much isn't it? Left makes no sense
      // and middle doesn't land."
      // He was right both times. The original fault was that it never
      // appeared, not that it appeared once — and forcing three made two
      // cards contort round a joke that only had one good angle in it. The
      // set that proved it: a murder-novels/hates-football brief where the
      // only card that worked FUSED the two in one sentence ("murder
      // novels improve everything, football improves nothing"), while
      // another just stuck a crossed-out telly onto a crime-novel jacket —
      // a picture carrying no joke at all.
      // So it is guaranteed a card and capped at two, and it must pass the
      // same fused-not-bolted-on test the occasion already has.
      body.dislikes?.trim() ? `⚠️ SOMETHING THEY CANNOT STAND: ${body.dislikes.trim()}. Nobody fills this field in by accident, so EXACTLY ONE of your three cards is built on it — a second may touch it ONLY if that card is genuinely better for it, and never all three.
  ⚠️ IT MUST BE FUSED, NOT BOLTED ON, and this is where it goes wrong: the dislike has to be doing WORK in the joke, not sitting next to it. FUSED — the loved thing and the hated thing are weighed against each other in one breath, so removing either breaks the line. BOLTED ON — a finished joke about the thing they love, with the hated thing added as a picture or a clause. A card that crossed out a television in the corner of an otherwise unrelated design is the failure: cover that element with your thumb and the card is unharmed, which means it was never load-bearing. If the dislike will not fuse, put it on a different card, or say it plainly and drily instead of decorating with it.
  Punch at the thing, never at the person receiving the card — the birthday is still theirs.` : '',
      `Occasion: ${body.occasion}`,
      body.from?.trim() ? `From: ${body.from.trim()}` : '',
      fullyGeneric
        ? `⚠️ NOTHING GIVEN — THE GENERIC ROLL, AND THE OCCASION ITSELF IS THE SUBJECT. No hobby, no age, no relationship: this card is for whoever picks it up off the rack. That is REAL MATERIAL, not an empty brief — a birthday happens to everybody and has its own world of ritual, feeling and detail. Mine it with the specificity a hobby would get, and claim nothing about this person: no invented facts, no hobbies, no age.
⚠️ THE REGISTER STILL COMES FROM THE TONE ABOVE, AND EACH TONE MINES A DIFFERENT PART OF THE DAY. Funny goes at the comedy of the occasion. Warm goes at what the day is actually FOR — that someone is glad this person exists and wanted to say so out loud. Rude goes at the affectionate insult that needs no biography. ⚠️ Wry observational humour under a WARM brief is a failure: a warm card that keeps its distance has let down the person who chose it. And a funny card with no joke in it, however handsome, has let down the person who chose that.
⚠️ DO NOT LET THIS BRIEF COLLAPSE INTO A SINGLE IDEA. With nothing else asked of it, it seizes the first frame it thinks of and writes all three cards inside it — observed twice on the first day this ran: three cards of tasteful stationery, then three cards about the admin of being celebrated. Three cards, three genuinely different thoughts about the day.`
        : interestText
        ? `The thing this card is about: ${interestText}
⚠️ READ WHETHER THIS IS A LOVE OR A PLAN. People type UPCOMING things into this box — a trip, a move, a new job — and an EVENT reads FORWARD: the excitement ahead, the world they are about to walk into. Claim NO history with it: no "still", no "always", no "another year of" unless the brief itself says they have done it before. Telling a first-time visitor they "still pick New York" is a printed factual error. A lifelong love may look back; a plan may only look forward.`
        : `⚠️ NO INTEREST GIVEN — THE MILESTONE IS THE SUBJECT. This is a RACK card: it has to work for anyone turning this age, so build all three from the AGE ITSELF using the age-band brief above — what that number means, what it is like to arrive at it, what everyone that age recognises. That is a real subject with real material, not an excuse for a blank card, and the specificity rules apply to it exactly as they would to a hobby: no generic warmth, no "another year older", nothing that would suit any age. A card about turning 50 must be unmistakably about FIFTY.`,
      `insideMode=${body.insideMode}`,
      `cheeky=${effectiveCheeky}`,
      `characters=${body.characters}`,
    ].filter(Boolean);

    // ── MEMORY ACROSS RUNS ───────────────────────────────────────────
    // The writer has none, so it finds the same best seam for a subject
    // every single time: "Still the Reel Deal" and "£400 of gear" turned
    // up across separate fishing runs days apart, which makes a rack feel
    // thin however good the individual card is. We already log every line
    // generated — this reads them back so the writer can be told what it
    // has already used. Best-effort: a failure here must never block
    // making a card.
    let alreadyUsed: string[] = [];
    let alreadyDrawn: string[] = [];
    let alreadyColoured: string[] = [];
    try {
      if (!body.memory) throw Object.assign(new Error('memory off'), { memoryOff: true });
      // Two queries on purpose. The first catches repeats within a
      // subject; the second catches STOCK PUNS that drift ACROSS
      // subjects — "Seas the day" turned up for sea swimming, then
      // Ibiza, then Moana, each time with a clean conscience because
      // the interest never matched.
      const [sameSubject, anySubject] = await Promise.all([
        db.select({ front_text: cardGenerations.front_text, art_direction: cardGenerations.art_direction, palette: cardGenerations.palette })
          .from(cardGenerations)
          // ⚠️ BLANK INTEREST IS A SUBJECT, NOT AN ABSENCE. Age-only
          // briefs store interest as NULL (`interestText || null`), and
          // `lower(NULL) = ''` is NULL, never true — so this query
          // returned ZERO rows and the motif guard below silently never
          // fired for the entire age-only spine. Observed on Aidan's
          // 81-card rack, 2026-08-20: TWO armchairs at 40.
          //
          // ⚠️ AND IT IS SCOPED TO THE AISLE, NOT THE WHOLE RACK.
          // The first fix pooled every age-only card together, on the
          // reasoning that a 40 built from browser tabs and a 30 built
          // from chat windows are "the same idea". Aidan, immediately:
          // "why are we not repeating the design when this is fresh for
          // new users? Is this for my testing?" — and he is right. The
          // whole rack side by side EXISTS ONLY IN THE STUDIO. A
          // customer shopping a 40th sees the 40th aisle; they never
          // load the 30th. A device carried across ages is not
          // repetition, it is a RANGE, which is how card shops have
          // always sold ("Aged 40", "Aged 50", same treatment).
          // So the guard defends what a customer actually sees at once:
          // the same age. IS NOT DISTINCT FROM keeps ageless cards as
          // their own aisle rather than matching everything.
          .where(interestText
            ? sql`lower(interest) = ${interestText.toLowerCase()}`
            : sql`interest is null and age is not distinct from ${statedAgeValue}`)
          .orderBy(desc(cardGenerations.id))
          .limit(24),
        db.select({ front_text: cardGenerations.front_text })
          .from(cardGenerations)
          .orderBy(desc(cardGenerations.id))
          .limit(40),
      ]);
      alreadyUsed = Array.from(new Set(
        [...sameSubject, ...anySubject].map((r) => r.front_text).filter(Boolean),
      ));
      // ⚠️ MOTIFS ONLY FOR THE SAME SUBJECT. A rosette means something
      // on a dog card and nothing on a fishing one, so unlike stock
      // PUNS — which drift across subjects and are excluded globally —
      // artwork only needs guarding within its own world.
      alreadyDrawn = Array.from(new Set(
        sameSubject.map((r) => (r as any).art_direction).filter(Boolean),
      )).slice(0, 12);
      alreadyColoured = Array.from(new Set(
        sameSubject.map((r) => (r as any).palette).filter(Boolean),
      )).slice(0, 9);
    } catch (e: any) {
      if (!e?.memoryOff) console.warn('[CARD-LAB] could not read prior lines (non-fatal):', e);
    }
    if (alreadyDrawn.length) {
      briefLines.push(
        `⚠️ ALREADY DRAWN for this subject — these motifs are used up, and so is any near-variant of them. A rack shows these cards SIDE BY SIDE, so the same object twice is the same card twice however different the words are. Observed: four poodle sets produced two prize rosettes, because a set can only ever see itself. Go to a different corner of this world:\n${alreadyDrawn.map((a) => `  · ${a}`).join('\n')}`,
      );
    }
    if (alreadyUsed.length) {
      briefLines.push(
        `⚠️ ALREADY USED — every one of these has been generated before, for this subject or another one. They are OFF LIMITS, and so is any near-variant. Note especially any STOCK PUN in the list: a pun that works for one watery subject works for all of them, which is exactly how the same joke keeps reappearing. If your line rhymes with anything here, find a different corner of the world:\n${alreadyUsed.map((l) => `  · ${l}`).join('\n')}`,
      );
    }

    // ── V2 PIPELINE ───────────────────────────────────────────────
    if (body.pipeline !== 'classic' && !serious) {
      const v2b: V2Brief = { who: body.who, gender: body.gender, age: body.age ?? statedAgeValue,
        interest: interestText, dislikes: body.dislikes?.trim() || undefined, tone: body.tone, cheeky: effectiveCheeky,
        name: body.recipientName?.trim() || undefined, generic: fullyGeneric };
      try {
        // 1. ARCHETYPE + referee vocabulary in one call.
        const archRes = await openai.chat.completions.create({
          ...conceptParams(900, 0.5),
          messages: [
            { role: 'system', content: archetypeSystemPrompt() },
            { role: 'user', content: `${briefLines.slice(0, 8).join('\n')}${
              alreadyColoured.length
                ? `\n\n⚠️ COLOUR WORLDS ALREADY USED ON THIS AISLE — these are spent, and so is any near-variant. An identical brief will hand you the same palette every time unless you deliberately go somewhere else in this subject's colour world, and a rack of one colour scheme is the failure this prevents. Same subject, different light, different hour, different material:\n${alreadyColoured.map((c) => `  · ${c}`).join('\n')}`
                : ''}` },
          ],
          response_format: { type: 'json_object' },
        });
        const arch = JSON.parse(archRes.choices[0]?.message?.content ?? '{}');
        // ⚠️ THE CUSTOMER'S OWN WORDS ARE ALWAYS HINTS. The archetype
        // returned only oblique City references, so a card literally
        // saying "Man City" was flagged dislike-missing — the referee
        // false-alarming on a set that was right, burning a repair round
        // and reporting a phantom violation. Literal tokens + archetype
        // slang, both, at both ends.
        const literalTokens = (t?: string) => (t ?? '').split(/[^a-zA-Z0-9']+/).filter((w) => w.length >= 3);
        const hints: V2Hints = {
          // No interest given = no interest floor. The archetype still
          // returns words on age-only briefs (about the milestone), and
          // feeding those in made the artwork floor demand devotion to
          // an empty string — phantom violations, wasted repair rounds.
          interest: interestText ? wordsToRe([...literalTokens(interestText), ...(Array.isArray(arch.interest_words) ? arch.interest_words : [])]) : null,
          dislike: wordsToRe([...literalTokens(body.dislikes), ...(Array.isArray(arch.dislike_words) ? arch.dislike_words : [])]),
        };

        // 2. STRUCTURE, chosen here (law 4): angles, formats, lengths.
        const v2Angles = (body.angles as Angle[] | undefined) ?? pickAngles(body.tone);
        // ⚠️ 'pattern' REMOVED, 2026-08-20. These labels reach the model
        // as BARE WORDS with no definition, and "pattern" has exactly
        // one sensible reading — repeated objects ringing centred text.
        // So every pattern card came back as that same card, and since
        // the format is assigned WITHOUT REFERENCE TO THE AGE, it came
        // back as that same card at 18, at 21 and at 30. Aidan, seeing
        // three of them side by side: "how the f can designs keep
        // repeating across different age runs? Makes ZERO sense."
        // It made sense: we ordered it three times.
        // The survivors are loose enough to have real range. Layout is
        // composition, composition is style, and style is the model's
        // (the same call as the palette clause) — these three remain
        // only to guarantee the three cards differ from EACH OTHER,
        // which law 4 says the model will not do unprompted.
        const otherFormats = ['statement', 'hero', 'label'].sort(() => Math.random() - 0.5);
        const typeledAt = Math.floor(Math.random() * 3);
        // The typeled card is a COIN FLIP between the two things a
        // text-only card can be: the LONG read-aloud, or the SHORT
        // poster set enormous. Pinning long on every set made the punchy
        // poster typeled structurally impossible and put a long card in
        // every set — "long form seems to be coming through a lot"
        // (Aidan). Now roughly half of sets carry a long card, half
        // carry the big short poster instead.
        const typeledRegister = Math.random() < 0.5 ? 'long' : 'short';
        const restRegisters = typeledRegister === 'long' ? ['short', 'mid'] : ['mid', 'mid'];
        // Aidan's fix, 2026-08-20: "surely the ai can widen that scope...
        // just widen its net when building the archetype". The archetype
        // is the thing that supplies aim, and it was never asked for
        // BREADTH — so an 18th kept returning one seam (ID checks,
        // polling slips, card taps, signatures, terms) and all three
        // cards mined it. Now it hands back three deliberately distant
        // territories and the server pins one per slot, the same way it
        // pins angle and length. Optional: a missing or short array just
        // leaves the slots unpinned rather than failing the set.
        const groundWeights = ['soft', 'mid', 'deep'].sort(() => Math.random() - 0.5);
        const territories: string[] = Array.isArray(arch.territories)
          ? arch.territories.filter((t: unknown) => typeof t === 'string' && t.trim()).slice(0, 3)
          : [];
        const slots = v2Angles.map((a, i) => ({ angle: a, format: i === typeledAt ? 'typeled' : otherFormats.pop()!,
          register: i === typeledAt ? typeledRegister : restRegisters.shift()!,
          territory: territories.length === 3 ? territories[i] : undefined,
          // ⚠️ RANGE IS STRUCTURE, SO THE SERVER OWNS IT (law 4). Giving
          // the archetype a palette_world fixed the drift to primary
          // poster colour, but immediately produced the opposite fault:
          // all three cards in a set arriving on the SAME ground, because
          // they all started from one description ("soft putty + deep
          // cobalt" three times at 30). The model still chooses every
          // actual colour from the subject's world — this only guarantees
          // the three sit at different weights, which is what makes a
          // rack read as a range rather than a swatch.
          ground: groundWeights[i] }));
        const sys = v2SystemPrompt(body.pipeline as 'celebrait' | 'open', slots, occProfile.brief);
        // Aidan, 2026-08-20: "whatever the user chooses MUST dictate to an
        // extent the palette as it builds the archetype." Colour was the one
        // thing the archetype never spoke about, so it was decided downstream
        // by whatever the register happened to say — which is exactly how the
        // rack drifted to primary poster colour regardless of subject.
        const userMsg = `${briefLines.join('\n')}\n\nWHO THIS PERSON IS (aim everything with this):\n${arch.archetype ?? ''}${
          typeof arch.palette_world === 'string' && arch.palette_world.trim()
            ? `\n\nTHE COLOUR WORLD THIS SUBJECT LIVES IN (start here, then make it striking — it is a starting point, not a straitjacket, and the three cards still differ):\n${arch.palette_world.trim()}`
            : ''}`;

        // 3. GENERATE → 4. REFEREE with one named-violation repair round.
        let concepts: CardConcept[] = [];
        let violations: string[] = [];
        for (let round = 0; round < 2; round++) {
          const gen = await openai.chat.completions.create({
            ...conceptParams(2200, 0.7),
            messages: round === 0
              ? [{ role: 'system', content: sys }, { role: 'user', content: userMsg }]
              : [{ role: 'system', content: sys }, { role: 'user', content: userMsg },
                 { role: 'assistant', content: JSON.stringify({ concepts }) },
                 { role: 'user', content: `Your set broke these floors:\n${violations.map((x) => '- ' + x).join('\n')}\nFix ONLY what is named, keep everything good, return the complete corrected JSON.` }],
            response_format: { type: 'json_object' },
          });
          void logGeneration({ cardId: null, slot: 'card_lab', templateId: null, templateVersion: null,
            provider: 'openai', model: CONCEPT_MODEL, quality: null,
            costCents: llmCostCents(CONCEPT_MODEL, gen.usage?.prompt_tokens ?? 0, gen.usage?.completion_tokens ?? 0),
            durationMs: 0, success: true });
          concepts = (JSON.parse(gen.choices[0]?.message?.content ?? '{}').concepts ?? []) as CardConcept[];
          violations = v2Verify(concepts, v2b, hints, slots);
          if (!violations.length) break;
          console.warn(`[CARD-LAB:v2] round ${round + 1} violations:`, violations);
        }

        void db.insert(cardGenerations).values(concepts.map((c) => ({
          build_commit: (process.env.RENDER_GIT_COMMIT ?? 'local').slice(0, 8),
          occasion: occProfile.key, tone: body.tone ?? null, age: v2b.age,
          angle: c.angle ?? null, recipient: body.who ?? null,
          interest: interestText || null, front_text: c.front_text,
          art_direction: c.art_direction ?? null, palette: c.palette ?? null,
        }))).catch((e) => console.warn('[CARD-LAB:v2] generation log failed (non-fatal):', e));

        // Violations still standing after the repair round ship VISIBLY,
        // never silently — the studio can show them and the harness
        // counts them. "Warned and shipped anyway" is the old world.
        return res.json({ concepts, notes: [], archetype: arch.archetype ?? null, violations });
      } catch (err) {
        console.error('[CARD-LAB:v2] pipeline failed, falling back to classic:', err);
      }
    }

    const startedAt = Date.now();
    try {
      const completion = await openai.chat.completions.create({
        // Nine candidate lines instead of three — 700 truncated the JSON
        // and the whole set failed to parse, hence the generous cap.
        ...conceptParams(2000, 0.7),
        messages: [
          { role: 'system', content: writerPrompt() },
          { role: 'user', content: briefLines.join('\n') },
        ],
        response_format: { type: 'json_object' },
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
      // Four cards on a celebration (the fourth is the longform
      // text-only one); serious occasions stay at three registers of
      // comfort — a long witty sentence has no place on a condolence card.
      const expectedCards = 3;
      let concepts: CardConcept[] = (parsed.concepts ?? []).slice(0, expectedCards);

      // The ban list is enforced in CODE, not hope — two prompt passes
      // still leaked "vibes". One corrective retry naming the offenders;
      // if that also fails we ship anyway (logged) rather than error.
      // ⚠️ "STANDARDS" IS BANNED OUTRIGHT AS OF 2026-08-19, and the word
      // rather than the phrasing, because targeting phrasings failed
      // TWICE. First "held to X standards" / "X standards remain" were
      // struck; it came back as "clear Hogwarts standards", then as "a
      // woman of tremendous standards". Counted across one day it had
      // appeared about eleven times — Peckham, Ibiza, Royle, Hogwarts,
      // Gavin and Stacey, Away End, Monday, tremendous — always the same
      // sentence with the noun swapped. Same lesson as the grand titles:
      // when a SHAPE is the failure, banning instances just teaches it
      // synonyms. There is always another way to say someone cares a lot.
      const BANNED_WORDS = /\b(vibes?|level up|bossin?|legend|goals|beast mode|mode|mom|mommy|momma|diapers?|legendary|standards?)\b/i;
      // Title formulas. The proud angle kept collapsing into a job title —
      // "Master of the Martini", "Master of the Tackle Box", "The only
      // mixologist in the family" — and all three walked past the judge,
      // so this one needs a deterministic floor too (Aidan 2026-08-16).
      //
      // ⚠️ REVISED 2026-08-16. The first pass banned only master/king/queen/
      // lord, on the theory that the crown was fine if the domain was
      // specific ("Champion of the 6am pier"). That was too clever: banning
      // five words taught it those WORDS were wrong, so it went shopping —
      // sovereign, sultan, baron, guardian, keeper, conjurer, "Pub Quiz
      // Royalty", "Mixologist Extraordinaire". Aidan, seeing the run:
      // "why does proud keep saying things like sultan". The SHAPE is the
      // problem, so the whole family goes.
      //
      // This is still only a floor. The real fix is in the prompt, which
      // now asks for a line someone would actually say out loud and gives
      // five shapes to reach for instead. This just strikes the reflex from
      // the shortlist so the editor has to choose something else.
      const GRAND_TITLES =
        'master|king|queen|lord|ruler|sovereign|monarch|emperor|empress|duke|duchess|prince|princess|baron|baroness|sultan|tsar|czar|pharaoh|overlord|chieftain|commander|conqueror|champion|captain|guardian|keeper|custodian|protector|defender|bringer|connoisseur|conjurer|wizard|sorcerer|maestro|virtuoso|supremo|grandmaster|mastermind|oracle|sage|guru|sensei|high priest|priestess|titan|deity|goddess';
      const BANNED_FORMULAS = new RegExp(
        // (e)?s? tolerates plurals — "Masters of the Double Recipe" walked
        // straight past the singular version (occasion-brain gate run).
        `\\b(${GRAND_TITLES})(e?s)? of\\b` +          // "Sultan of Suds", "Masters of the Double Recipe"
        `|\\b(${GRAND_TITLES})(e?s)?\\b\\s*[:,]` +    // "Guardian: the Tackle Box"
        '|\\bextraordinaire\\b|\\broyalty\\b' +       // "Mixologist Extraordinaire", "Pub Quiz Royalty"
        // The proud angle's other collapse: sole authority. Three
        // consecutive sets opened "Nobody touches...", "Nobody skips...",
        // "Nobody orders...". Anchored to the START of the line so a
        // "nobody" mid-sentence still reads naturally.
        '|^\\s*(nobody|no one|only you|you[\\u2019\\x27]re the one)\\b' +
        '|^\\s*(the )?house rule\\b|\\bis not a democracy\\b' +
        // ⚠️ Invented biography. "Official sauce taster since 1985" is not
        // a weak card, it is a WRONG one — we have no idea when she started
        // cooking, and it ships printed and posted (Aidan 2026-08-16).
        // Deliberately narrow: it catches the "since/est. <year>"
        // construction, which is always a claim about the person, and
        // leaves a bare year alone so a genuinely famous one ("1966") can
        // still be used where it belongs to the SUBJECT, not the recipient.
        '|\\b(since|est\\.?|circa|c\\.)\\s*(19|20)\\d{2}\\b' +
        '|\\b(19|20)\\d{2}\\s*[-–]\\s*(present|now|today)\\b' +
        '|\\bthe only \\w+ in the (family|house|world|village)\\b' +
        '|\\bborn to\\b' +
        '|\\b(of|at) the (perfect|ultimate|finest|greatest|best)\\b' +
        '|\\banother year\\b' +
        // The standards formula lived here for a day and was routed
        // round twice; the whole word now sits in BANNED_WORDS instead.
        // Left as a note so nobody re-adds the narrow version.
        '',
        'i',
      );
      const isBanned = (t: string) => BANNED_WORDS.test(t) || BANNED_FORMULAS.test(t);

      // The shortlist changed the shape of this check. A banned line is no
      // longer fatal to the card — it is one option out of three, so we
      // strike it and let the judge choose from what is left.
      //
      // ⚠️ But a shortlist of ONE is not a shortlist. When the title ban
      // widened, proud shortlists collapsed to a single bland survivor
      // ("Knows every pint and pint-sized fact") because the writer spends
      // most of its candidates on the reflex it is not allowed to use, and
      // the retry only fired when EVERY candidate was struck. So the
      // trigger is thinness, not wipeout: fewer than two clean candidates
      // and we go back for a fresh set of three for that angle.
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

      const MIN_SHORTLIST = 2;
      const isThin = (c: CardConcept) => shortlistOf(c).filter((t) => !isBanned(t)).length < MIN_SHORTLIST;

      // Rude mode needs a floor too, for the same reason everything else in
      // this file does: the prompt asked for cheek twice and got "Hoppy
      // Birthday to the Quiz King". "Bugger" and "bloody" deliberately do
      // NOT count — Aidan, on a set that used them: "it's not even rude".
      // Masked strong swears are the house style and count in full.
      const REAL_CHEEK =
        /\bf\*+\w*|\bs\*+\w*|\bc\*+\w*|\bfuck\w*|\bshit\w*|\bbollocks\b|\bbastard\b|\bwanker\b|\bprick\b|\btwat\b|\bbellend\b|\bknobhead\b|\barse\w*|\bpiss\w*|\bshag\w*|\btits\b|\bknob\b/i;
      const hasCheek = (c: CardConcept) => shortlistOf(c).some((t) => REAL_CHEEK.test(t));

      concepts = cleanse(concepts);
      const cheekShort = effectiveCheeky && concepts.filter(hasCheek).length < 2;

      // ⚠️ THE COLLAPSED SET — four executions of one joke. Prompt rules
      // improved it but did not hold on the hardest case: a United brief
      // mentioning a City rivalry produced four City cards even after the
      // "a side detail must not eat the set" instruction. The emotional
      // hook (and, in rude mode, the easiest swearing target) beats a
      // written rule, so this is measured instead.
      // A content word carried by THREE of the four lines means the set
      // has one idea. Words from the brief itself are exempt: every card
      // is legitimately about the interest.
      const STOP = new Set(['this','that','with','your','still','from','have','been','they','them','their','what','when','then','than','just','only','more','most','very','sixty','forty','fifty','thirty','years','year','birthday','happy']);
      // ⚠️ THE DISLIKE IS DELIBERATELY *NOT* EXEMPT HERE. It was, for
      // about an hour, while the brief demanded all three cards carry it —
      // otherwise this detector saw three Liverpool cards, called it a
      // collapse and retried them away, and the two rules fought.
      // Aidan then saw all-three in the wild and reversed it ("can't stand
      // is too much"), which puts this back to its original job: three
      // cards about the hated thing IS a collapsed set, and it is now the
      // guard that catches the very failure he spotted. Same for the
      // detail, which only one card has to carry.
      const briefWords = new Set(
        `${interestText} ${body.who} ${body.occasion}`.toLowerCase().match(/[a-z']{4,}/g) ?? [],
      );
      const wordFreq = new Map<string, number>();
      for (const c of concepts) {
        // Every candidate, not just the first: the judge picks from the
        // whole shortlist afterwards, so checking one line per concept
        // let a collapse slip in behind the check.
        const seen = new Set(
          shortlistOf(c).join(' ').toLowerCase().match(/[a-z']{4,}/g)?.filter(
            (w) => !STOP.has(w) && !briefWords.has(w),
          ) ?? [],
        );
        Array.from(seen).forEach((w) => wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1));
      }
      const collapsedOn = Array.from(wordFreq.entries()).filter(([, n]) => n >= 3).map(([w]) => w);
      if (collapsedOn.length) {
        console.warn('[CARD-LAB] set collapsed onto one idea:', collapsedOn,
          concepts.map((c) => shortlistOf(c)[0]));
      }
      if (cheekShort) {
        console.warn('[CARD-LAB] rude mode on but the set came back tame:',
          concepts.map((c) => shortlistOf(c)[0]));
      }
      const wiped = concepts.filter(isThin);
      if (wiped.length > 0 || cheekShort || collapsedOn.length) {
        const retry = await openai.chat.completions.create({
          ...conceptParams(2000, 0.5),
          messages: [
            { role: 'system', content: writerPrompt() },
            { role: 'user', content: briefLines.join('\n') },
            { role: 'assistant', content: completion.choices[0]?.message?.content ?? '' },
            { role: 'user', content: `${collapsedOn.length ? `⚠️ YOUR FOUR CARDS ARE ALL THE SAME IDEA. The word${collapsedOn.length > 1 ? 's' : ''} ${collapsedOn.map((w) => `"${w}"`).join(', ')} appear${collapsedOn.length > 1 ? '' : 's'} in three or more of the four lines, which means you found one seam and worked it four times. That is not a choice for the customer, it is one card in four costumes. Go back to the mining step: name FOUR genuinely different corners of this person's world — different objects, rituals, moments, feelings — assign one to each card, and rewrite so no card shares a subject or a distinctive word with another. If a side detail from the brief has taken over, cut it back to at most ONE card.\n\n` : ''}${cheekShort ? `⚠️ RUDE MODE WAS ON AND YOU WROTE A TAME SET. Fewer than two of your three cards carry an actual swear word. "Bugger", "bloody", "sod", "git" and beer puns DO NOT COUNT — the customer ticked the rude box and these read as a polite card in fancy dress. Rewrite so at least TWO cards carry a real swear on the front, masked with asterisks for the strongest words (f***, s***) and printed in full for the mid-strength ones (bollocks, arse, twat, bellend, knobhead, bastard, piss). Keep it affectionate and keep every content limit you were given.\n\n` : ''}${wiped.length ? `Too many candidate lines were rejected for these angles: ${wiped.map((o) => o.angle).join(', ')} — you are left with fewer than two usable options, which is not a shortlist. Rejections come from banned words ("vibe(s)", "level up", "boss", "legend", "goals", "mode") or from the TITLE REFLEX: any "[grand noun] of ___" construction (Master, King, Queen, Lord, Sovereign, Sultan, Baron, Champion, Guardian, Keeper, Connoisseur and the rest), anything "Extraordinaire", anything "Royalty", "The only ___ in the family", "Born to ___", "Another year ___". Write a COMPLETELY FRESH shortlist of THREE lines for those angles only, leaving the other concepts untouched. Do not retry the same idea with a different grand noun — that is the failure. For a proud card, write what someone would actually SAY about them out loud: sole authority over one small thing, an absurd credential with a number in it, a house rule, a flat verdict, or respect and mickey-taking in one breath — built entirely from THIS subject's own world. Every line needs a TURN you could name in five words.` : ''} Return the complete corrected JSON.` },
          ],
          response_format: { type: 'json_object' },
        });
        try {
          const reparsed = JSON.parse(retry.choices[0]?.message?.content ?? '{}');
          const fixed: CardConcept[] = (reparsed.concepts ?? []).slice(0, expectedCards);
          if (fixed.length === expectedCards) concepts = cleanse(fixed);
        } catch { /* keep originals */ }
        const still = concepts.filter(isThin);
        if (still.length) console.warn('[CARD-LAB] shortlists still thin after retry:', still.map((c) => c.angle));
      }

      void logGeneration({
        cardId: null,
        slot: 'card_lab',
        templateId: null,
        templateVersion: null,
        provider: 'openai',
        model: CONCEPT_MODEL,
        quality: null,
        costCents: llmCostCents(
          CONCEPT_MODEL,
          completion.usage?.prompt_tokens ?? 0,
          completion.usage?.completion_tokens ?? 0,
        ),
        durationMs: Date.now() - startedAt,
        success: concepts.length === expectedCards,
      });

      if (concepts.length !== expectedCards) {
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
          ...conceptParams(1200, 0.4),
          messages: [
            { role: 'system', content: serious ? seriousJudgeSystemPrompt(occProfile) : judgeSystemPrompt(effectiveCheeky, occProfile) },
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
        });
        const verdicts = JSON.parse(review.choices[0]?.message?.content ?? '{}').cards ?? [];
        if (verdicts.length === expectedCards) {
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
          provider: 'openai', model: CONCEPT_MODEL, quality: null,
          costCents: llmCostCents(CONCEPT_MODEL, review.usage?.prompt_tokens ?? 0, review.usage?.completion_tokens ?? 0),
          durationMs: 0, success: true,
        });
      } catch (e) {
        console.warn('[CARD-LAB] judge pass failed, shipping originals:', e);
      }

      // ── LANDING CHECK ─────────────────────────────────────────────
      // Anything killed here is rewritten once by the writer, which is
      // told exactly what was wrong. A failure of this pass must never
      // cost the customer their cards, so it ships what it has.
      try {
        const check = await openai.chat.completions.create({
          ...conceptParams(500, 0.2),
          messages: [
            { role: 'system', content: landingCheckPrompt() },
            { role: 'user', content: [
              'THE BRIEF THEY TYPED:', briefLines.slice(0, 6).join('\n'), '',
              'THE CARDS:',
              // ⚠️ THE LOOK GOES IN TOO. This pass used to be handed the
              // line alone, so it could not possibly catch a card whose
              // words were fine and whose artwork belonged to another
              // shop — which is exactly what got through (Aidan on a
              // Moana set: "there's no way that look and feel lands").
              ...judged.map((c, i) => [
                `${i + 1}. [${c.angle}] "${c.front_text}"`,
                `   LOOK: ${c.format ?? 'card'} — ${c.art_direction}`,
                `   COLOURS: ${c.palette ?? 'unstated'}`,
                `   LETTERING: ${c.typeface ?? 'unstated'}`,
              ].join('\n')),
            ].join('\n') },
          ],
          response_format: { type: 'json_object' },
        });
        const verdicts = JSON.parse(check.choices[0]?.message?.content ?? '{}').cards ?? [];
        const killed = judged
          .map((c, i) => ({ c, i, v: verdicts[i] }))
          .filter((x) => x.v?.verdict === 'kill');
        if (killed.length) {
          // A card can fail on its words or on its look, and the two want
          // opposite repairs: a bad line is rewritten around artwork that
          // is already right, a bad look is redrawn around a line that is
          // already right. Sending one undifferentiated "fix this" got the
          // good half thrown away with the bad.
          const isLook = (k: (typeof killed)[number]) => k.v?.what === 'look';
          const badWords = killed.filter((k) => !isLook(k));
          const badLook = killed.filter(isLook);
          console.warn('[CARD-LAB] landing check killed:',
            killed.map((k) => `${isLook(k) ? 'LOOK' : 'WORDS'} "${k.c.front_text}" — ${k.v?.why ?? ''}`));
          const fix = await openai.chat.completions.create({
            ...conceptParams(1400, 0.6),
            messages: [
              { role: 'system', content: writerPrompt() },
              { role: 'user', content: briefLines.join('\n') },
              { role: 'assistant', content: JSON.stringify({ concepts: judged }) },
              { role: 'user', content: [
                `A reader in a card shop rejected ${killed.length === 1 ? 'this card' : 'these cards'}. Fix exactly what is named and change NOTHING else — every other concept, and the untouched half of these ones, must come back byte-identical.`,
                badWords.length ? [
                  '',
                  'THE WORDS FAILED on these — the artwork is fine and stays exactly as it is:',
                  ...badWords.map((k) => `  · "${k.c.front_text}" — ${k.v?.why ?? 'does not land'}`),
                  'Rewrite ONLY their front_candidates. The replacement must be something a British person would actually say out loud, about THIS subject, that needs no explaining.',
                ].join('\n') : '',
                badLook.length ? [
                  '',
                  'THE LOOK FAILED on these — the LINE IS GOOD AND MUST BE KEPT WORD FOR WORD:',
                  ...badLook.map((k) => `  · "${k.c.front_text}" — ${k.v?.why ?? 'belongs to no world'}`),
                  'Rewrite ONLY their art_direction, palette and typeface, so the card belongs unmistakably to this subject and suits the age in the brief. Cover the words with your thumb: what is left must still say what the card is about. Do not touch their front_candidates or inside_text.',
                ].join('\n') : '',
                '',
                'Return the complete corrected JSON.',
              ].filter(Boolean).join('\n') },
            ],
            response_format: { type: 'json_object' },
          });
          const reparsed = JSON.parse(fix.choices[0]?.message?.content ?? '{}').concepts ?? [];
          if (reparsed.length === judged.length) {
            judged = judged.map((c, i) => {
              const kill = killed.find((k) => k.i === i);
              if (!kill) return c;
              const fixed = reparsed[i] ?? {};

              // Look repair: take the ARTWORK back and leave the line
              // alone. Taking only front_text here — which is what this
              // did before the look could fail — would have thrown the
              // redraw away and shipped the same wrong-world card.
              if (isLook(kill)) {
                const art = String(fixed.art_direction ?? '').trim();
                if (!art || namedArtefacts(art).length) return c;
                return {
                  ...c,
                  art_direction: art,
                  palette: String(fixed.palette ?? '').trim() || c.palette,
                  typeface: String(fixed.typeface ?? '').trim() || c.typeface,
                };
              }

              const line = shortlistOf(fixed)[0];
              return line && !isBanned(line) ? { ...c, front_text: line } : c;
            });
          }
        }
      } catch (e) {
        console.warn('[CARD-LAB] landing check failed, shipping as-is:', e);
      }

      // ⚠️ LOG SERVER-SIDE, not from the client. It began as a
      // fire-and-forget POST from the studio, which meant the
      // already-used list could only ever see what a client happened to
      // report — so two identical fishing runs back to back produced
      // identical lines, because run one was never recorded. Logging
      // here makes the memory reliable and the keep-rate denominator
      // complete no matter who calls the endpoint.
      void db.insert(cardGenerations).values(judged.map((c) => ({
        build_commit: (process.env.RENDER_GIT_COMMIT ?? 'local').slice(0, 8),
        occasion: occProfile.key,
        tone: body.tone ?? null,
        age: body.age ?? statedAge(body.occasion),
        angle: c.angle ?? null,
        recipient: body.who ?? null,
        interest: interestText || null,
        front_text: c.front_text,
        art_direction: c.art_direction ?? null,
        palette: c.palette ?? null,
      }))).catch((e) => console.warn('[CARD-LAB] generation log failed (non-fatal):', e));

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
  // ── POST /api/admin/card-lab/print-asset ─────────────────────────
  // A Prodigi-ready 6732×1713 strip from a Lab card, downloaded as a
  // file so Aidan can upload it by hand.
  //
  // WHY IT HAD TO EXIST (Aidan 2026-08-19: "I need to print a proper
  // card, front and inside... able to download the file to upload to
  // prodigi"): the Lab has never had a print path at all. It renders to
  // a data URL and stores a template; composeCardPrintStrip has only
  // ever been fed by the PHOTO product's pipeline. So the one thing we
  // most need to check — whether flat illustration and crisp type
  // survive at card size — could not be checked.
  //
  // Same compositor the real orders use, so what comes out is what a
  // customer would receive. Panels: outer-rear (brand + sender) /
  // outer-front (the card) / inside-left (cream + logo) / inner-back
  // (the inside artwork).
  //
  // ⚠️ NO INTERMEDIATE UPSCALE, deliberately. The photo path makes a
  // 3000×3000 Lanczos copy first, but that is for its own fulfilment
  // consumers — routing 1024 → 3000 → 1683 only softens what a direct
  // 1024 → 1683 resize does in one step. Neither invents detail: the
  // source is 1024 and that is the real constraint this print is meant
  // to measure.
  app.post('/api/admin/card-lab/print-asset', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const schema = z.object({
      front: z.string().startsWith('data:image/').max(30_000_000),
      inside: z.string().startsWith('data:image/').max(30_000_000).optional(),
      senderFirstName: z.string().max(40).optional(),
      filename: z.string().max(80).optional(),
    });
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(req.body);
    } catch {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const toBuffer = (dataUrl: string) =>
      Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    try {
      const { composeCardPrintStrip } = await import('../studio/print-compositor');
      const strip = await composeCardPrintStrip({
        frontBuffer: toBuffer(body.front),
        insideBuffer: body.inside ? toBuffer(body.inside) : null,
        senderFirstName: body.senderFirstName ?? null,
      });
      const safe = (body.filename ?? 'celebrait-print').replace(/[^a-z0-9-_]/gi, '-').slice(0, 60);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="${safe}.png"`);
      res.send(strip);
    } catch (err) {
      console.error('[CARD-LAB] print asset failed:', err);
      res.status(500).json({ message: 'Could not compose the print asset' });
    }
  });

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
      // ⚠️ THE INSIDE MUST MATCH THE FRONT'S MEDIUM. Fronts are free
      // style on every card now, and this endpoint was always building
      // its prompt from quirkyDna — so a riso front was being paired
      // with a house-style inside. On screen you only ever see one at a
      // time; folded in the hand it is obviously two different cards.
      freeStyle: z.boolean().default(false),
      direction: z.string().max(300).optional(),
      quality: z.enum(['low', 'medium', 'high']).default('low'),
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
      body.freeStyle ? freeStyleDna(body.characters) : quirkyDna(body.characters),
      '',
      QUIRKY_INSIDE,
      '',
      body.direction ? `MEDIUM — THE FRONT OF THIS CARD WAS DRAWN IN: ${body.direction}. The inside is the SAME PIECE OF PRINT, so use that same medium, its same marks and its same hand. A different medium inside is two cards in one envelope.` : '',
      body.palette ? `PALETTE (same family as the front, but use its palest tone as the ground): ${body.palette}` : '',
      body.art_direction ? `THE FRONT OF THIS CARD SHOWED: ${body.art_direction}. Echo it only faintly — a small motif in a corner or a light border. Do NOT reproduce it at size.` : '',
      '',
      textBlock,
      '',
      `Square 1024x1024 — the INSIDE page of the card. ${IS_THE_CARD_ITSELF}`,
    ].filter(Boolean).join('\n');

    try {
      const result = await getProvider('openai-2').generate({
        prompt, quality: body.quality, size: '1024x1024', slot: 'card_lab',
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
      format: z.enum(['statement', 'hero', 'pattern', 'label', 'editorial', 'typeled']).optional(),
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
    // typeled joins the re-render side for the same reason as dense: the
    // words ARE the composition, so new words are a new design — there is
    // nothing for a pixel-preserving swap to preserve.
    const dense = body.format === 'pattern' || body.format === 'label' || body.format === 'typeled';
    if (dense && body.art_direction) {
      const prompt = [
        quirkyDna(body.characters),
        '',
        QUIRKY_FORMATS[body.format === 'typeled' ? 'typeled' : body.format === 'label' ? 'label' : 'pattern'],
        '',
        `ILLUSTRATION: ${body.art_direction}`,
        body.palette ? `PALETTE (obey exactly): ${body.palette}` : '',
        body.typeface ? `TYPE (obey exactly — this card's lettering personality): ${body.typeface}. Draw the words in that idiom, and draw it well.` : '',
        '',
        `FRONT TEXT — render EXACTLY and ONLY: "${body.newText.trim()}". Set it per the TYPOGRAPHY block: a real typeface, stacked into 2-3 flush-aligned lines, printing perfectly clean with no texture, distressing or stray marks on the letters. Compose the artwork AROUND these words, leaving them a clear zone of plain ground to sit in — the motifs fill the space the type leaves, never run behind it. Every word legible, nothing cropped. ABSOLUTELY NO other text anywhere in the image.`,
        '',
        `Square 1024x1024. ${IS_THE_CARD_ITSELF}`,
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
      // 300, not 120: the long read-aloud register (20-35 words) is a
      // deliberate card now, and the old cap silently 400'd every one of
      // them — "Invalid request" under each long card in the studio
      // (Aidan 2026-08-19). The typeled render brief already knows how
      // to set a long line.
      front_text: z.string().min(1).max(300),
      art_direction: z.string().min(1).max(500),
      format: z.enum(['statement', 'hero', 'pattern', 'label', 'editorial', 'typeled']).default('hero'),
      palette: z.string().max(300).optional(),
      typeface: z.string().max(200).optional(),
      characters: z.enum(['objects', 'animals', 'figures']).default('objects'),
      /** Let the model choose the medium instead of the house style. */
      freeStyle: z.boolean().default(false),
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
      body.freeStyle ? freeStyleDna(body.characters) : quirkyDna(body.characters),
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
      `Square 1024x1024. ${IS_THE_CARD_ITSELF}`,
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
