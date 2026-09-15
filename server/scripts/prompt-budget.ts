/**
 * PROMPT BUDGET — how big are the strings we actually send?
 *
 *   npx tsx server/scripts/prompt-budget.ts
 *
 * WHY. Aidan, 2026-08-18, after a long day of prompt edits: "are we
 * making loads of changes and losing track and not making progress or
 * are we good?" Fair, and unanswerable by feel.
 *
 * This file has a hard-won lesson that LENGTH DROWNS GUARDS — the
 * front-scene prompt had to be condensed 21.5k->5.5k because the rules
 * were being buried by their own explanations, and a single clause
 * added today turned a stable 5/5 landing check into 4/5 twice. So
 * prompt size is a real quality risk, not housekeeping.
 *
 * ⚠️ MEASURE THE STRING YOU SEND, NOT THE SOURCE FILE. The source is
 * mostly comments and code; a previous estimate taken from the file was
 * about 7x wrong. These call the real builders.
 */
import 'dotenv/config';
import {
  conceptSystemPrompt, quirkyDna, freeStyleDna, landingCheckPrompt,
  QUIRKY_FORMATS, IS_THE_CARD_ITSELF, OCCASION_PROFILES,
} from '../routes/admin-card-lab';

const tok = (s: string) => Math.round(s.length / 4);
const row = (name: string, s: string, note = '') =>
  console.log(`  ${name.padEnd(34)} ${String(s.length).padStart(7)} chars  ~${String(tok(s)).padStart(5)} tok  ${note}`);

const writerHouse = conceptSystemPrompt('objects', false, OCCASION_PROFILES.celebration, false);
const writerFree = conceptSystemPrompt('figures', true, OCCASION_PROFILES.celebration, true);
const render = [quirkyDna('objects'), QUIRKY_FORMATS.hero, IS_THE_CARD_ITSELF].join('\n');
const renderFree = [freeStyleDna('figures'), QUIRKY_FORMATS.hero, IS_THE_CARD_ITSELF].join('\n');

console.log('\nPER-REQUEST PROMPTS (what actually goes over the wire)\n');
row('writer — house style', writerHouse);
row('writer — free style + rude', writerFree, '<- the big one');
row('render — house style', render);
row('render — free style', renderFree);
row('landing check (the bouncer)', landingCheckPrompt());

// The writer runs once, the judge once, the check once, and the render
// three times — so the render prompt is paid for three times a set.
const setTokens = tok(writerFree) + tok(landingCheckPrompt()) + 3 * tok(renderFree);
console.log(`\n  one full set of three ≈ ${setTokens} input tokens of PROMPT (before the brief and the replies)`);
console.log('\n⚠️ WATCH: the writer prompt is the one that has bitten. Past roughly');
console.log('   9-10k tokens, guards start losing arguments with each other —');
console.log('   the front-scene prompt failed at 21.5k and worked at 5.5k.');
console.log('   If this climbs, CONDENSE rather than continue adding.\n');
