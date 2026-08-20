// LEAK SCAN — which phrases in our own prompts are ending up on cards?
//
// WHY (Aidan, 2026-08-20): "How much of this leakage is actually
// prevalent here? We've seemingly got a lot of contamination
// happening." Law 1 says any concrete phrase rendered in an instruction
// gets copied out. Today alone that explained a cassette, a record
// sleeve, "fuss", "duty", ID checks and polling slips. This measures it
// rather than arguing about it.
//
// It builds the REAL prompts for a spread of briefs, pulls out every
// literal example in them (anything quoted, plus a curated list of the
// bare concrete nouns that sit in lists), and counts how often each
// appears in card_generations.
//
// Usage: npx tsx server/scripts/leak-scan.ts
import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { archetypeSystemPrompt, v2SystemPrompt, birthdayProfile } from '../routes/admin-card-lab';

const AGES = [1, 5, 16, 18, 21, 30, 40, 50, 60, 70, 80, null];
const TONES = ['funny', 'warm', 'rude'];

// Every prompt the engine can send, concatenated.
let corpus = archetypeSystemPrompt();
for (const age of AGES) for (const tone of TONES) {
  const slots = [0, 1, 2].map((i) => ({ angle: 'wordplay', format: i === 0 ? 'typeled' : 'hero', register: 'mid' }));
  corpus += '\n' + v2SystemPrompt('celebrait', slots, birthdayProfile(tone as any, age).brief);
}

// Literal examples = the leak surface. Anything the prompt renders in
// quotes is a phrase the model can lift verbatim.
const quoted = new Set<string>();
for (const m of corpus.matchAll(/["“”']([a-z][a-z0-9''\- ]{4,40})["“”']/gi)) {
  const t = m[1].trim().toLowerCase();
  if (t.split(/\s+/).length <= 6) quoted.add(t);
}
// Bare concrete nouns that sit in prompt lists rather than quotes —
// these do not get caught by the quote rule but leak identically.
const BARE = ['cassette', 'record sleeve', 'group chat', 'boarding pass', 'wristband',
  'rosette', 'ceremonial key', 'mortarboard', 'balloon', 'champagne', 'filofax'];
const terms = [...quoted, ...BARE];

const rows: Array<{ term: string; n: number }> = [];
const total: any = await db.execute(sql`select count(*) c from card_generations`);
const N = Number((total.rows ?? total)[0].c);
for (const term of terms) {
  const like = `%${term}%`;
  const r: any = await db.execute(
    sql`select count(*) c from card_generations where front_text ilike ${like} or art_direction ilike ${like}`);
  const n = Number((r.rows ?? r)[0].c);
  if (n > 0) rows.push({ term, n });
}
rows.sort((a, b) => b.n - a.n);
console.log(`\nPrompt corpus: ${corpus.length.toLocaleString()} chars · ${terms.length} literal examples in it`);
console.log(`Generations searched: ${N}\n`);
console.log('  hits   %     phrase rendered in our prompt');
for (const { term, n } of rows) {
  console.log(`  ${String(n).padStart(4)}  ${((n / N) * 100).toFixed(1).padStart(4)}%   "${term}"`);
}
if (!rows.length) console.log('  (no rendered example appears in any generation)');
process.exit(0);
