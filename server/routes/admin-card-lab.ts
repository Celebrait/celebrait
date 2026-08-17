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

const OCCASION_PROFILES: Record<string, OccasionProfile> = {
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

export type BirthdayTone = 'funny' | 'warm' | 'cheeky';

/** D3: what the buyer picks. Each tone still yields three different
 *  cards through the existing angle machinery — the tone sets the
 *  register, the angles keep the range. */
const BIRTHDAY_TONES: Record<BirthdayTone, string> = {
  funny: `TONE — FUNNY. The biggest-selling birthday register in Britain. Make them laugh out loud, not smile politely. The joke is the product: if a card here has no laugh in it, it has failed even if it is warm and true.`,
  warm: `TONE — WARM. Affection first, wit second — the card someone keeps on the mantelpiece for a month. Still SPECIFIC and still with a turn: warm is not vague, and "you're amazing" is not warmth, it is filler. Think fond, noticing, generous. No mickey-taking, no roasting, no age jokes at all in this tone.`,
  cheeky: `TONE — CHEEKY. Mischief without swearing. Taking the mickey, the fond dig, the thing you would only say to someone you love. Sits between funny and rude: sharper than funny, cleaner than rude. Innuendo stays seaside-postcard.`,
};

/** The three age worlds. Bands from the research pack: what the market
 *  actually jokes about at each stage, not our guesses. */
function birthdayAgeBlock(age: number | null): string {
  if (age === null) {
    return `AGE — NOT STATED, so there is NO age on this card. No number, no birth year, no "another year older", and no age jokes of any kind: you do not know how old they are and a wrong guess is a ruined card. Build entirely from the person and their thing.`;
  }
  // D1: the roast is allowed but CALIBRATED — the joke changes shape by
  // band, and decline mockery is banned at every age.
  const band =
    age <= 25
      ? `AGE BAND — THRESHOLD (${age}). The joke is adulthood itself: newly legal, newly responsible, gloriously unprepared. Childhood expiring, the first proper hangover, having to phone about your own car insurance. Loud, energetic, meme-fluent. Palette runs bright and saturated; type bold and playful. ⚠️ The buyer at this age is very often a PARENT, GRANDPARENT or aunt — the card can be cheeky but must never be something a nan would be embarrassed to hand over.`
      : age <= 50
        ? `AGE BAND — KNOWING (${age}). Self-deprecation delivered with a completely straight face: the age is fine, it is the little surrenders that are funny — the good chair, the early night defended as a treat, the noise a person makes standing up. Era references from their youth land well here. Palette confident and adult; this is where a text-only card shines.`
        : `AGE BAND — ERA & AFFECTION (${age}). Nostalgia leads and the affection is unmistakable: what the world was like when they arrived, the habits everyone in the family knows are theirs, the rituals they defend. ⚠️ NEVER decline, frailty, memory or "how much longer" jokes — that is the one way this band goes badly wrong. Warm, golden, vintage-leaning; classic serifs suit it.`;

  // The birth-year carve-out, bounded tightly. Derived arithmetic on a
  // number the BUYER typed is not the invented-fact class — but it only
  // holds for a stated milestone, so the rule is spelled out in full.
  const birthYear = new Date().getFullYear() - age;
  return `${band}
THE NUMBER IS ARTWORK: ${age} belongs in the design — the motif can BE the number, or the number can be built from their world. Almost nobody does this and it is instantly personal.
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
  statement: `COMPOSITION — STATEMENT (MINIMAL): this card is almost EMPTY, and that is its power. THE NEGATIVE SPACE IS THE SUBJECT — at least 60% of the card is untouched ground, and it must feel deliberate, like a gallery wall, never like something is missing. ONE motif, beautifully drawn, ANCHORED: sitting on an implied baseline low in the frame, or held against one edge — never floating dead-centre in the middle of nowhere. ⚠️ BECAUSE THIS CARD IS MOSTLY EMPTY, THE MOTIF IS THE ONLY COLOUR EVENT ON IT — so it must be SATURATED and confident, carrying the palette's strongest ink at full strength. A muted or greyish object on a pale ground makes this card look washed out and unfinished, which is the one way the minimal card fails. Minimal means FEW elements, never WEAK colour. The type takes its own corner, flush-aligned, small and precise, at the opposite end of the card from the motif so the two hold the composition open between them — but kept well inside the safe margin, never crowded against the frame. No pattern, no border, no garnish, no texture-filling: restraint IS the design. Gallery-minimal.`,
  hero: `COMPOSITION — HERO (BALANCED): ONE object drawn HUGE and cropped HARD by the frame edges so it reads as a fragment of something bigger. SCALE IS THE WHOLE IDEA and the crop should feel brave — an object that merely fills the frame has not gone far enough. Confident contour, flat fills, one loose colour-block or swash behind it, calm ground visible around. The type claims the clear band of ground the object leaves, set big enough to hold its own against it. Poster energy, not busy.`,
  pattern: `COMPOSITION — PATTERN (DENSE): the motif repeats bold across the whole card at varied scales, some cropped off the edges — an underlying grid with its rhythm BROKEN DELIBERATELY in one or two places (one motif turned, one scaled up, one in the odd colour) so it never reads as wallpaper. CRUCIALLY, RESERVE A CLEAN AREA FOR THE TYPE: a calm panel, band or generous clearing where the plain ground shows through and the words sit alone. Do NOT thread the lettering through the gaps between motifs — that is how a dense card turns to mush. Rich and full, but organised.`,
  label: `COMPOSITION — LABEL (DENSE): a punchy modern packet/label lockup — one bold simple border framing the card, the motif bunched large in the centre, halftone shading in a single ink. THE TYPE IS THE STRUCTURE: a stacked lockup with a clear hierarchy — one dominant line, one smaller supporting line — sitting in its own reserved band above or below the motif, never printed over it. Craft-beer-label energy, structured-busy.`,
  typeled: `COMPOSITION — TYPE-LED (THE WORDS ARE THE ARTWORK): there is NO motif and NO illustration on this card — no objects, no scene, no border art. The words, set HUGE and with total confidence, ARE the entire design, and every design decision lives inside them: scale contrast between words (one word can be five times the size of its neighbours), the stack and its alignment, the accent ink landing on exactly the right word, letterforms with real personality per the TYPE line. The ground is one flat confident colour doing quiet work underneath. Permitted garnish, used sparingly if at all: an underline, an oversized piece of punctuation, a single typographic flourish drawn from the lettering itself — never a pictorial element. The craft bar is HIGHER here, not lower: with nothing else on the card, any weakness in the setting is the whole card. Think of the best text-only cards in a good shop — bought purely because the words and their setting were enough.`,
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
  /** D3 — the buyer-facing tone for the birthday world. Ignored by
   *  occasions that have not been built out yet. */
  tone: z.enum(['funny', 'warm', 'cheeky']).default('funny'),
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

function conceptSystemPrompt(characters: CharacterLevel, cheeky = false, profile: OccasionProfile = OCCASION_PROFILES.celebration): string {
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

⚠️⚠️ THREE CARDS MEANS THREE DIFFERENT IDEAS — THE SINGLE COMMONEST FAILURE, AND THE ONE THAT MAKES A SET FEEL DEAD.
Once you find the strongest seam in a subject you will want to work it three times. Do not. The customer is being offered a CHOICE, and three executions of one joke is not a choice — it is the same card in three costumes, and it is instantly obvious on the rack.
BEFORE YOU WRITE A SINGLE LINE: name THREE genuinely different corners of this person's world and assign one to each card. Write them down to yourself first. They must be different SUBJECTS, not different jokes about one subject — a different object, a different ritual, a different moment, a different feeling. Then each card is written from its own corner and stays in it.
MEASURED FAILURES, all real sets:
  • a Manchester United fan whose brief mentioned disliking City: every card was about hating City. Nothing about United, nothing about the man, nothing about turning sixty.
  • a Netflix fan: every card was "watches too much", and two independently used the word "daylight".
  • a cocktail lover: every card was "takes it far too seriously".
⚠️ A SIDE DETAIL MUST NOT EAT THE SET. When the brief adds something extra (a rivalry, a habit, a pet hate), it is worth AT MOST ONE of the three cards. The main thing they love is why the card exists.
⚠️ NO SHARED VOCABULARY. No distinctive word or image may appear in more than one card in the set. If two lines both reach for the same word, one of them is a duplicate wearing a disguise — rewrite it from its own corner.

MINE THE SUBJECT FIRST — do this internally before writing:
List the world of that interest: its objects and kit, its rituals, its jargon and catchphrases, its colours, its sounds, its clichés, the moment its fans love most. The best cards come from the SPECIFIC corners of that world, not its most obvious symbol. (Fishing is not only a fish: it is tackle boxes, dawn flasks, the one that got away, sitting in silence for nine hours and calling it relaxing.)

IF THE SUBJECT IS A PERSON (a celebrity, a character, a public figure, a sports star), mine THEIR OWN unmistakable signatures — the objects they are never without, their gestures, their palette, their catchphrase, the thing only they do. Then build all three cards from THOSE.
  DANGER: do NOT drift to the person's CITY, COUNTRY or GENERIC FIELD. That is the standard failure. A card about a New York figure that shows the Empire State is a card about New York — it would work identically for anyone who likes the place, so it says nothing about them.
  WORKED: a red cap with white lettering, an overlong red tie, gold everything — unmistakable, no face required.
  FAILED: a skyline, a generic podium, "a famous building" — could be anybody.
  You must be able to say WHY each motif belongs to this person and nobody else. If you cannot, mine again.

MINE THE OCCASION AND THE PERSON TOO — most cards waste both, and they are free specificity sitting in the brief.
  THE OCCASION HAS ITS OWN WORLD, and both fields are free text now, so read them properly: "40th", "retirement", "passed her driving test", "new home", "Christmas" each bring objects, colours, numbers and rituals of their own. Let that world MEET the interest rather than sit beside it. A Christmas fishing card is the tackle box in frost-blue and one hot red, not a fishing card with a tree stuck in the corner. A retirement golf card is the last round, the clubhouse, the alarm clock going in the bin. A 40th anything can put the NUMBER in the artwork — a number is instant specificity and almost nobody uses it.
  ⚠️ But the interest still leads. The occasion INFLECTS the card — its palette, one motif, the angle of the joke — it never takes the card over. If you find yourself drawing balloons and cake, you have made a generic birthday card with a hobby stapled to it, which is the thing we exist to avoid.
  THE RECIPIENT SETS THE REGISTER — read WHO closely, it is free text and every word of it was typed on purpose:
    RELATIONSHIP → TONE: warmth, softness and a gentler palette for the tender relationships (a nan, a grandad, a mum); sharper, louder, cheekier for a sibling or a mate; intimate for a partner; lighter and safer for a colleague, who should never get an in-joke pitched at family. The words can differ while the love does not.
    AGE → VOICE, but only when the brief states or implies one. A stated 21 wants energy; a stated 50 wants knowing self-deprecation; no age stated means NO age jokes and no guessing.
    GENDER → LOOK, ONLY WHEN STATED. Never infer gender from a hobby — a woman who fishes gets the same fishing world as anyone, not a pink rod. But when the brief says "sister", "nan", "husband", let it tune the palette and type warmth. Nothing stated → neutral, always.
    DIRECTION → SPEAKER: on couples' occasions, who is writing to whom changes the voice. Read any "from" detail and let the card sound like that person speaking.
    A NAME is a gift. For family and partners the front carries the relationship word ("Nan", "Dad") and the name lands INSIDE, where it reads as intimacy. For a mate or colleague the first name IS the natural address and may sit on the front.
  ⚠️ WHO IS BUYING: usually a woman, buying for someone she loves — that is the person your set has to charm at a glance. The house default is therefore WARM AND ALIVE. Moody, dark, workwear-heavy styling is a deliberate CHOICE for when the recipient and subject genuinely call for it (a mate's dark humour, a heavy-metal dad) — it is never the resting state. If your three cards would all photograph like a menswear catalogue, the set has drifted; pull at least one toward warmth and light.

IF THE SUBJECT IS A FICTIONAL WORLD, FRANCHISE, BAND OR TEAM, THE WORDS DO THE HEAVY LIFTING. The artwork is deliberately restricted for these subjects — we never draw their invented artefacts, logos or crests, because we print and sell these cards — so the picture alone CANNOT say which world this is. That job falls to the line, and the line must be up to it.
  Mine that world's OWN VOCABULARY, which is where a property is unmistakable without reproducing anything: its invented words, its famous single lines, the phrases that got out into ordinary speech. Words are the safe half of a franchise; artwork is the risky half — and happily the famous layer of any world is mostly WORDS, while the deep cuts are mostly objects, so aiming at what everyone knows keeps us legal and keeps the buyer with us at the same time.
  IF THE WORLD HAS ONE FAMOUS WORD, THAT WORD MUST DO THE WORK, NEVER SIT AS FILLER. Observed failure: "Wand-erful Sister, Always Charming" for a Harry Potter fan. It contains "Always" — the single most quoted word in those books — and wastes it as an ordinary adverb, while "wand-erful" and "charming" describe generic witchcraft that would suit any witch card ever printed. The card that should have been written was built on "Always".

THE THREE CARDS — one each, in this order.
⚠️ QUIRK IS THE HOUSE VOICE, NOT ONE OF THREE FLAVOURS. All three cards must contain a TURN — a small moment that makes the reader do a double-take. The angles are three different WAYS TO DELIVER that turn; they are not "one funny card and two straight ones". A line with no turn is DRY, and dry is what makes a card feel like it came off a supermarket rack.
1. WORDPLAY — the turn is in the LANGUAGE. A pun or a twist on a phrase from that world's own vocabulary. Must pass the pub test.
2. DEADPAN — the turn is in the UNDER-REACTION. This is the QUIETEST card, but quiet is not empty: deadpan only works when something genuinely ABSURD is being reported completely straight. Mine the daft truth of that world — the nine wasted hours, the £400 of kit for a £2 fish, the 5am alarm on a day off, the shed nobody else is allowed in — and state it flatly, with no wink and no punchline signposting. BEFORE you write this line, name to yourself ONE specific absurd fact about this world, ideally carrying a number, a ritual or a wasted effort. The line then REPORTS that fact. If you find yourself reaching for the birthday instead of the absurdity ("Another year, another …"), you have not mined hard enough — go back and find the daft fact. NO ABSURDITY MEANS NO JOKE: "Manchester United Comes First" and "The only mixologist in the family" are statements of fact with nothing being under-reacted to, and they came out dry. "Nine Hours, No Fish" works, because something ridiculous is being reported with a straight face.
3. PROUD — the turn is in the DISPROPORTION: total, straight-faced seriousness about something gloriously SMALL. The respect is real; the thing being respected is trivial. That is the whole joke, and it lives in WHAT you take seriously, never in how grandly you say it.
   ⚠️ SAY IT ABOUT THEM, NOT TO THEM. This one instruction fixes the angle, because every collapse it has suffered came from the same grammar: addressing the recipient or declaring a rule. Write the line as the thing you would say ABOUT this person to somebody ELSE — the boast you make on their behalf when they are not in the room, the detail you always end up mentioning. That single shift kills the formulas by construction.
   ⚠️ BANNED OPENINGS, each one a measured collapse — reject on sight:
     • a TITLE: "[Grand noun] of the [Thing]" — Master of the Tackle Box, Sovereign of the Stream, Sultan of Suds, anything Extraordinaire, anything Royalty.
     • SOLE AUTHORITY: any line beginning "Nobody...", "No one...", "Only you...", "You're the one who...". Observed in three consecutive sets: "Nobody touches Dad's matchday snacks", "Nobody skips the intro on your sofa", "Nobody orders until you've read the menu".
     • A HOUSE RULE: "House rule:...", "The rule is...", "X is not a democracy". Appeared in three separate sets.
   These are not banned words to be swapped for synonyms — the SHAPE is banned. A new grand noun or a fresh way to say "nobody" is the same failure.
   The turn is still DISPROPORTION: complete seriousness about something far too small to deserve it. Build every noun, number and detail from THEIR world; the shape is yours to find.
   Test it: could you say this line out loud to them, in a pub, without sounding like you were presenting a trophy? If not, rewrite it.

WRITE WIDE, THEN SHORTLIST: draft at least SIX candidate lines per angle, then be a ruthless editor. A line SURVIVES only if it passes ALL of:
   - THE PUB TEST: said aloud to a friend, it lands instantly — no explanation, no "get it?". If a pun needs unpacking, it is DEAD.
   - IT PARSES: a real, natural sentence. Nonsense mashups ("Fatherhood at DC10 beats dropper") are the cardinal failure.
   - IT IS ABOUT THEM AND THIS THING: their interest is doing the work. The occasion is welcome on the front, but only FUSED into the joke, never stapled on the end — "Level up for your birthday!" is generic filler because the interest is doing nothing. If the line would be identical for anyone with any hobby, it is dead.
   - ⚠️ COVER THE PICTURE — THE HARD GATE, AND THE REASON CARDS FEEL VAGUE. Read the line completely alone, with the artwork hidden, and ask: does it name its own subject? Not "does it suit the picture" — does the LINE, by itself, tell you what this card is about? If someone could read it aloud with no image and not know the subject, it is DEAD, however elegant it is, and no amount of beautiful artwork rescues it.
     MEASURED FAILURES: "You call the bagel place. Obviously." over New York artwork — hide the picture and it is a card about ordering bagels, which would work in any town in Britain. "Wand-erful Sister, Always Charming" over wizarding artwork — hide the picture and it is a generic witch card.
     THE FIX IS ALWAYS THE SAME: put the subject's OWN vocabulary into the words — its places, its numbers, its jargon, the things its people actually say. The picture then confirms what the line already established, which is the right way round.
   - ⚠️ THE BUYER TEST — the one most likely to lose us the sale. THE PERSON BUYING THIS CARD IS NOT THE FAN. A daughter buying for her Harry Potter dad may never have read a word of it; a mate buying for a United fan may not care about football. If she cannot tell at a glance that the card is good, she does not buy it, and the recipient never sees it. So the reference must come from the FAMOUS layer of that world — the handful of things that escaped the fandom and reached everybody: platform nine and three-quarters, "always", "may the fourth", "I am your father". NOT the deep cut: a minor character, an obscure spell, a squad number, an album track. Ask yourself: would someone who has never touched this subject, but has heard of it, still get this instantly? If only a proper fan would get it, the line FAILS — however clever it is.
     This does NOT mean be vague. The famous layer is still specific; it is just specific in a way that carries beyond the fandom. Aim at the thing a non-fan would name if you asked them what they know about it.
   - THE TURN TEST: say to yourself, in five words or fewer, what the SURPRISE in this line is — "puns on reel/real", "under-reacts to nine wasted hours", "crowns him king of the pier". If you cannot name the turn, the line is DRY and it dies here, however true, warm or well written it is. This is the test most weak lines fail.
   - ⚠️ THE SPECIFIC-DETAIL TEST: the line must contain at least one CONCRETE thing out of their world — an object, a number, a place, a ritual, a moment, a thing they actually say. Sentiment and adjectives alone are not a card: "You're amazing at this", "Hoppy Birthday to the Quiz King" and "Cheers to a barrel of laughs" are all vague, and vague is exactly what makes a card feel like it came off a rack of ten thousand.
     THIS IS THE SINGLE BIGGEST LEVER ON WHETHER A CARD LANDS. The rude cards this shop makes land harder than the clean ones, and it is NOT because they swear — it is because swearing forces you to be about something. "£400 of gear, £2 fish" would work exactly as well with the swearing removed; "Nine hours, no fish" has none and is the best line in the range. COPY THE SPECIFICITY, NEVER THE SWEARING. A clean card should be every bit as concrete as a rude one; the only thing that changes between them is the language, never the sharpness.
   - NO CRINGE ZONE: no "vibe(s)" as a noun, no "boss/legend/hero" clichés, no hashtag-speak, at most ONE exclamation mark per card.
⚠️ DO NOT PICK A WINNER. Keep the THREE BEST survivors per angle and return all three, strongest first. An independent editor chooses between them afterwards, and choosing is easier than repairing — so your job is to hand over three genuinely different, genuinely usable lines, NOT one favourite plus two throwaways you never intended. If you find yourself writing a filler line to pad the list, replace it: three real options or the shortlist has failed.
The three candidates for an angle must all be DIFFERENT ROUTES to that angle's turn, not one line reworded three ways — and every one of them must work with THAT SAME CARD'S artwork, because the picture is already decided by art_direction. A clean deadpan ALWAYS beats a strained pun.

⚠️ DECIDE THE LOOK ONCE, BEFORE YOU DESIGN ANY CARD. A designer given this brief would not make three unrelated cards — they would settle on a visual world and make three cards inside it. Three cards wearing three different typefaces, three unrelated palettes and three different densities is not a range, it is a sampler, and it reads as machine output rather than a designed set.
DERIVE THE WORLD FROM THE BRIEF — the thing they love leads, the age and the relationship temper it:
  • THE SUBJECT sets the register. Some worlds are loud (a football terrace, a nightclub, New York); some are quiet (a garden, sea swimming, reading); some are warm and domestic (baking, the pub); some are sharp and modern (streaming, tech, design). A subject that is ITSELF about taste — someone who likes fine stationery, quiet design, quirky cards — must never be answered with heavy shouting type.
  • THE AGE tempers it — early twenties runs brighter and louder, later years warmer and calmer.
  • THE RELATIONSHIP tempers it again — a nan gets gentler than a mate, whatever the subject.
Then state it in the "direction" field and hold ALL THREE cards inside it.

Each returned concept:
- direction: ONE sentence, IDENTICAL on all three concepts, naming the visual world you have chosen for this set: its palette family, its type mood, and its density register (airy / balanced / full). This is the decision every other visual choice obeys. Derive it from the brief, not from habit.
- angle: "wordplay", "deadpan" or "proud" — one of each, in that order.
- format: one of "statement", "hero", "pattern", "label", "typeled". EXACTLY ONE card is "typeled" (text-only) — that count is fixed, because left free it swings to all or nothing. The OTHER TWO follow the direction's density register rather than a forced spread: an airy world can be two minimal cards, a full world two dense ones. Vary them a little for interest, but never at the cost of the world — three quiet cards for a quiet subject is a good set, not a failure.
  "typeled" is the TEXT-ONLY card: no illustration at all, the words set huge ARE the artwork. Good shops rack plenty of these — bought purely because the words and their setting were enough — so EXACTLY ONE card per set is typeled — never none, never two. ⚠️ HISTORY, so this is not re-litigated: when the writer chose freely it took the minimal slot 7 sets out of 7 and "statement" vanished; nudged the other way, statement took it 7 out of 7. Fixing the COUNT at one ends the swing while leaving you free to choose which angle earns it.
  ⚠️ THE TYPELED LINE MAY BE SHORT OR LONG, and this is a real creative choice rather than a default. SHORT (three to six words, set enormous) hits like a poster and is often the stronger card. LONG (up to 20 words, a full sentence) is the card someone reads aloud in the shop — the observation too good to cut, the fake advice, the mock warning, the sentence that turns hard at the very end. If you go long, USE the length: a long line that is a short line padded out has failed, and the last few words must land the turn. When you pick it, that line has to be your best one, and art_direction describes the ground colour and the typographic treatment instead of a motif. Never more than one typeled card per set.
- front_candidates: an array of EXACTLY THREE surviving lines for this angle, strongest first. MAXIMUM 8 words — EXCEPT on the typeled card, where you may go up to 20 and a full sentence is welcome (see below). Each must CONNECT to the picture — words and motif complete each other — and each must SET WELL as display type: breaking naturally into 2-3 short stacked lines, avoiding words longer than 10 letters, since very long words in big type are where lettering goes wrong. Where two lines are equally good, prefer the one with shorter words.
- inside_text: MAXIMUM 28 words. Lands the affection, may extend the joke, warm enough to sign. Never restates the front.
- art_direction: one sentence — the MOTIF and how it sits in the chosen format. Where the OCCASION has a world of its own, let it inflect this: its season, its light, one of its objects folded into the interest's own kit, or its number worked into the scene. Never a generic occasion prop (balloons, cake, a wrapped present, a tree) dropped next to the real subject. ${characters === 'objects'
    ? 'Objects, food, botanicals, the kit of that world ONLY — NEVER humans, NEVER animals, NEVER characters.'
    : `OBJECTS ARE THE DEFAULT for every card. ${characters === 'figures'
        ? 'A characterful ANIMAL, or a HUMAN FIGURE as a graphic silhouette (from behind, cropped, small in frame, faceless — never a portrait, never detailed features, never a recognisable real individual), is PERMITTED'
        : 'A characterful ANIMAL is PERMITTED (never humans or human faces)'} but is a CEILING, not an instruction.
    AT MOST ONE of the three cards may use a character, and only if it passes this test: does this subject's OWN WORLD naturally contain that creature or person? A dog-lover's world contains a dog. A Sunday league team contains players. A BAND'S WORLD DOES NOT CONTAIN KANGAROOS — inventing a mascot to satisfy a permission is the failure to avoid ("Wonderwallabies" for Oasis: the pun exists only because an animal was forced in, and the card says nothing about the band).
    If the subject's world contains no creature or person naturally, all three cards are objects. That is a good outcome, not a limitation — the single best Oasis card was a cassette labelled "Oasis Mix".`} THE THREE CARDS MUST SHOW DIFFERENT CORNERS OF THE WORLD — not the same object three times (fishing: a tackle box of lures / a lone flask at dawn / a wall of floats — not three fish).
  ⚠️ NEVER ASK FOR A LOGO OR AN INVENTED ARTEFACT IN THIS BRIEF. We print and sell these cards. Do not write the name of any object, creature, vehicle, weapon, building or costume that exists only inside a film, book or game, and never a logo, wordmark, crest or badge for anything at all. Observed failures: "a Golden Snitch, Quaffle and Bludger", "the Marauder's Map", "a mug with a lightsaber handle", "small screens showing iconic scenes".
  ✅ BUT A BRAND'S WORLD IS OPEN — ask for it confidently. Its colour signature, the everyday objects around it, a paused screen, a loading bar, a scoreboard, a shop receipt, the packaging SHAPE without its label. "A remote and cold popcorn on a deep red ground" is a brief we want; "the Netflix logo" is not. Draw the experience, never the mark.
  Ask instead for the ORDINARY objects that world is full of, which anyone could own and nobody owns the rights to: a striped scarf in two colours, an owl, a stack of battered spellbooks, a candle stub, a brass key, a train ticket, a starfield, a desert horizon, a worn paperback, a takeaway coffee. The PALETTE and the words carry the reference. If you cannot describe the picture without naming a protected thing, choose a different corner of that world.
- palette: you are the art director. Name the GROUND colour first, then exactly THREE inks (four only if one truly earns it), and say which single ink is the ACCENT — the hot one, held back to under 10% of the card. Draw them all from that world. ⚠️ NEVER NAME GREY, SILVER, CHROME, GOLD, METALLIC OR WHITE AS AN INK. They are not colours, and naming one invites a rendered metal object with 3D shading, which breaks the flat-print style outright — a palette that said "skyscraper silver" produced a photorealistic chrome fishing reel. Metal objects are drawn FLAT in the palette's real colours: a reel is rust and cream, not silver. Every ink you name must be a colour someone could squeeze out of a tube.
START FROM THE SUBJECT'S OWN COLOURS. If that world owns a colour, use it — a United card wants red, a New York card wants cab yellow, a fishing card can want deep river green. Wasting a subject's signature colour on a beige card is the commonest way these come out mundane.
ALL THREE PALETTES COME FROM THE DIRECTION'S FAMILY — no palette-hopping across the set. Within that family, vary the MOOD (dawn-muted, midday-bright, dusk-rich) and which ink leads, so the three are siblings rather than strangers or triplets. The old rule forced one saturated and one pale ground in every set regardless of subject; that produced scattergun sets and is replaced by this. A quiet subject may legitimately take three soft grounds. ⚠️ JUDGE VIBRANCY AT THE DIRECTION LEVEL, not card by card: the WORLD must have life in it, even when it is a soft one. And SATURATED DOES NOT MEAN DARK — raspberry, coral, marigold, peacock, plum and rich pink are every bit as saturated as ink blue, oxblood, forest and aubergine. The dark half kept being chosen by habit and the whole shop drifted masculine; when nothing about the recipient says moody, the warm, alive half is the default. THREE OR MORE PALE GROUNDS IS A FAILED SET, and so is a pale ground on a subject famous for a colour. Where a card does take a pale ground, its motif must carry saturated ink so the card still has something to look at. All three come from ONE subject, so distinguish them by MOOD: e.g. dawn-muted, midday-bright, dusk-rich. No two cards sharing a colour family. Where the OCCASION carries its own colour temperature — Christmas cold and candlelit, a summer wedding bleached and bright, a retirement golden-hour — let it pull the palette without erasing the subject's own colours.
- typeface: you are also the typographer. In under fifteen words, name the LETTERING PERSONALITY this particular card should wear and why it fits — e.g. "condensed poster gothic, terrace-chant energy", "sign-painter's brush script, seaside pub", "high-contrast Didone, cocktail-hour glamour", "chunky slab, workwear and tackle boxes", "groovy 70s revival with swollen curves". Choose from the subject, the angle AND the recipient, not from habit: a deadpan card usually wants restraint, a proud card can carry a grand display face, a wordplay card can be playful — and the recipient tunes the warmth: a nan's card leans soft and generous, a mate's can go loud, and the workwear-slab-and-poster-gothic end of the menu is for when the person genuinely suits it, not the default reach. ALL THREE COME FROM THE DIRECTION'S TYPE MOOD. They should read as one designer's hand, so vary the ROLE rather than the personality — a display cut and a quieter companion within the same family, or the same idiom at different weights. The old rule demanded three unrelated typefaces per set and produced sampler sheets. What is still banned is three IDENTICAL settings: same face, same size, same treatment on all three is lazy.

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
- INSIDE MODE: auto → write inside_text. own or blank → inside_text = "".

FINAL CHECK — do this LAST, immediately before returning: ${cheeky ? 'FIRST count how many of your three cards carry genuine cheek on the front. If it is fewer than two, go back and make them ruder before you do anything else — this is the single commonest way this brief gets failed. Then ' : ''}read all NINE candidate lines once more and name the TURN in each one out loud to yourself. REPLACE any line that has no nameable turn, OR contains "vibe"/"vibes", "level up", "boss", "legend", "goals" or "mode", OR uses a banned title formula ("Master/King/Queen/Lord of ___", "The only ___ in the family", "Born to ___", "Another year ___"), OR would need explaining in a pub, OR bolts the occasion onto the end of a line that had already finished (thumb-test it: cover the occasion clause, and if the rest is unharmed the clause is filler). Every candidate you hand over must be one you would be happy to see chosen — a shortlist with two dead lines in it is a shortlist of one.

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
5. NO INVENTED FACTS — an instant fail, and the only criterion here about being WRONG rather than being weak. We do not know the recipient's age, birth year, or when they took up their hobby, so any "since 1985", "est. 2010", stated age or anniversary count is a card that may simply be untrue about them, printed and posted. Reject it however good the line is. Numbers the BRIEF supplied ("his 60th", "40 years") are fine and welcome; comic exaggerations nobody would check ("nine hours, no fish") are fine. A checkable claim about this person's life is not.
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
    const classified = classifyOccasion(body.occasion);
    const occProfile = classified.key === 'birthday'
      ? birthdayProfile(body.tone, body.age ?? statedAge(body.occasion))
      : classified;
    const serious = occProfile.humour === 'off';
    const effectiveCheeky = body.cheeky && !serious;
    const writerPrompt = () => serious
      ? seriousConceptSystemPrompt(occProfile)
      : conceptSystemPrompt(body.characters, effectiveCheeky, occProfile);

    const briefLines = [
      `Recipient: ${body.who}`,
      body.gender !== 'unspecified' ? `Recipient gender: ${body.gender === 'him' ? 'male' : 'female'} — let it tune palette and type warmth only, never the joke` : '',
      body.age ? `Recipient age: ${body.age}` : '',
      body.detail?.trim() ? `Something about them: ${body.detail.trim()} — this is gold, use it` : '',
      body.dislikes?.trim() ? `Something they cannot stand: ${body.dislikes.trim()} — good comic fuel, but ONE card at most, and never the set's whole idea` : '',
      `Occasion: ${body.occasion}`,
      body.from?.trim() ? `From: ${body.from.trim()}` : '',
      `The thing they love: ${body.interest.trim()}`,
      `insideMode=${body.insideMode}`,
      `cheeky=${effectiveCheeky}`,
      `characters=${body.characters}`,
    ].filter(Boolean);

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
      const BANNED_WORDS = /\b(vibes?|level up|bossin?|legend|goals|beast mode|mode|mom|mommy|momma|diapers?|legendary)\b/i;
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
        '|\\banother year\\b',
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
      const briefWords = new Set(
        `${body.interest} ${body.who} ${body.occasion}`.toLowerCase().match(/[a-z']{4,}/g) ?? [],
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
      format: z.enum(['statement', 'hero', 'pattern', 'label', 'editorial', 'typeled']).default('hero'),
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
