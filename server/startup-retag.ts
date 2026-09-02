// server/startup-retag.ts — THE 2026-08-31 RACK RETAG, AS CODE
//
// Aidan: "I want you to retag." Claude has no prod-DB console, so the
// retag ships as a boot pass: id-keyed, guarded on the CURRENT value
// (so a later human edit is never overwritten), idempotent (a no-op
// from the second boot onward), loud in the logs.
//
// Scope — only what content makes CERTAIN (the engine's own law:
// gender/relationships are never assumed):
//  · works-do / secret-santa cards → recipient Colleague (definitional)
//  · interest hygiene, because the interest field PRINTS on the shop
//    (aisle labels, product titles, SEO URLs):
//     - "Elf-on-the-Shelf" (brand) → "the shelf elf"
//     - "Cocaine jokes…" labels → "the party season" (the CARDS are
//       fine per the vice-ceiling decision; the LABEL was one keep away
//       from minting a public /cards/christmas/cocaine-jokes aisle)
//     - film-interest spellings merged → "Christmas films" (also turns
//       two 2-card orphans into one live 5-card aisle)
//     - "Elf the movie" (film title in a commerce label) → same merge.
//
// Everything else stays recipient "Anyone" ON PURPOSE: stock is
// anyone-stock; relationship aisles fill from future briefs where
// who-it's-for is set.

import { sql } from 'drizzle-orm';
import { db } from './db';

type Retag = { id: number; set: { recipient?: string; interest?: string }; onlyIf: { recipient?: string; interest?: string } };

const RETAGS: Retag[] = [
  // Colleague shelf — works do / secret santa
  { id: 288, set: { recipient: 'Colleague' }, onlyIf: { recipient: 'Anyone' } },
  { id: 287, set: { recipient: 'Colleague' }, onlyIf: { recipient: 'Anyone' } },
  { id: 286, set: { recipient: 'Colleague' }, onlyIf: { recipient: 'Anyone' } },
  { id: 285, set: { recipient: 'Colleague' }, onlyIf: { recipient: 'Anyone' } },
  { id: 284, set: { recipient: 'Colleague' }, onlyIf: { recipient: 'Anyone' } },
  { id: 224, set: { recipient: 'Colleague', interest: 'the party season' }, onlyIf: { interest: 'Cocaine jokes' } },
  // Label hygiene
  { id: 322, set: { interest: 'the shelf elf' }, onlyIf: { interest: 'Elf-on-the-Shelf' } },
  { id: 321, set: { interest: 'the shelf elf' }, onlyIf: { interest: 'Elf-on-the-Shelf' } },
  { id: 320, set: { interest: 'the shelf elf' }, onlyIf: { interest: 'Elf-on-the-Shelf' } },
  { id: 319, set: { interest: 'the shelf elf' }, onlyIf: { interest: 'Elf-on-the-Shelf' } },
  { id: 226, set: { interest: 'the party season' }, onlyIf: { interest: 'Cocaine jokes (let it snow writing is a must)' } },
  { id: 225, set: { interest: 'the party season' }, onlyIf: { interest: 'Cocaine jokes (let it snow writing is a must)' } },
  { id: 223, set: { interest: 'the party season' }, onlyIf: { interest: 'Cocaine jokes' } },
  { id: 253, set: { interest: 'Christmas films' }, onlyIf: { interest: 'Watching Christmas movies with the family' } },
  { id: 252, set: { interest: 'Christmas films' }, onlyIf: { interest: 'Watching Christmas movies with the family' } },
  { id: 251, set: { interest: 'Christmas films' }, onlyIf: { interest: 'Watching Christmasy filmes' } },
  { id: 250, set: { interest: 'Christmas films' }, onlyIf: { interest: 'Watching Christmasy filmes' } },
  { id: 229, set: { interest: 'Christmas films' }, onlyIf: { interest: 'Elf the movie' } },
];

/** PASS 2 — THE FULL SHELVING (2026-08-31, "need you to shelve every
 *  one as per attached — look at each visually and concept wise").
 *  Every published christmas card was reviewed by eye (contact sheets)
 *  and by concept. Tone resolved from 'mix' to its real register;
 *  merchandising aisle tags assigned where the card clearly sells to
 *  a relationship (tags are ADDITIVE per the schema — they union with
 *  derived aisles, never replace); gender lean only where the card's
 *  own text genders it; PS5 brand label → 'gaming'. Tag guards: tags
 *  apply only while aisle_tags is still empty; tone/interest guards on
 *  current value — Aidan's later edits always win. */
type Shelve = { id: number; set: { tone?: string; tags?: string[]; gender?: string; interest?: string }; onlyIf: { tone?: string; interest?: string } };
const SHELVING: Shelve[] = [
  { id: 217, set: { tags: ['for-nan', 'for-mum'] }, onlyIf: {  } },
  { id: 218, set: { tags: ['for-partner', 'for-sister'] }, onlyIf: {  } },
  { id: 219, set: { tags: ['for-best-mate', 'for-brother'] }, onlyIf: {  } },
  { id: 220, set: { tags: ['for-sister', 'for-best-mate'] }, onlyIf: {  } },
  { id: 223, set: { tags: ['for-best-mate'] }, onlyIf: {  } },
  { id: 225, set: { tags: ['for-best-mate'] }, onlyIf: {  } },
  { id: 226, set: { tags: ['for-best-mate'] }, onlyIf: {  } },
  { id: 227, set: { tags: ['for-sister', 'for-best-mate'], gender: 'her' }, onlyIf: {  } },
  { id: 228, set: { tags: ['for-brother', 'for-dad'] }, onlyIf: {  } },
  { id: 230, set: { tone: 'funny', tags: ['for-mum', 'for-partner'] }, onlyIf: { tone: 'mix' } },
  { id: 231, set: { tone: 'funny' }, onlyIf: { tone: 'mix' } },
  { id: 232, set: { tone: 'funny', tags: ['for-brother', 'for-son'] }, onlyIf: { tone: 'mix' } },
  { id: 233, set: { tone: 'warm', tags: ['for-partner'] }, onlyIf: { tone: 'mix' } },
  { id: 234, set: { tone: 'funny', tags: ['for-mum', 'for-dad'] }, onlyIf: { tone: 'mix' } },
  { id: 235, set: { tone: 'rude', tags: ['for-brother', 'for-best-mate'] }, onlyIf: { tone: 'mix' } },
  { id: 236, set: { tags: ['for-nan', 'for-mum'] }, onlyIf: {  } },
  { id: 242, set: { tags: ['for-mum', 'for-partner'] }, onlyIf: {  } },
  { id: 243, set: { tone: 'funny', tags: ['for-mum', 'for-dad'] }, onlyIf: { tone: 'mix' } },
  { id: 244, set: { tone: 'rude', tags: ['for-dad', 'for-grandad'] }, onlyIf: { tone: 'mix' } },
  { id: 245, set: { tone: 'funny', tags: ['for-sister', 'for-best-mate'] }, onlyIf: { tone: 'mix' } },
  { id: 246, set: { tone: 'rude', tags: ['for-best-mate', 'for-sister'] }, onlyIf: { tone: 'mix' } },
  { id: 247, set: { tone: 'funny', tags: ['for-partner', 'for-best-mate'] }, onlyIf: { tone: 'mix' } },
  { id: 249, set: { tone: 'funny', tags: ['for-dad', 'for-brother'] }, onlyIf: { tone: 'mix' } },
  { id: 250, set: { tone: 'rude', tags: ['for-partner'] }, onlyIf: { tone: 'mix' } },
  { id: 251, set: { tone: 'funny', tags: ['for-brother'] }, onlyIf: { tone: 'mix' } },
  { id: 254, set: { tags: ['for-mum', 'for-nan'] }, onlyIf: {  } },
  { id: 255, set: { tags: ['for-mum', 'for-nan'] }, onlyIf: {  } },
  { id: 256, set: { tone: 'funny', tags: ['for-grandad'] }, onlyIf: { tone: 'warm' } },
  { id: 257, set: { tone: 'rude', tags: ['for-sister', 'for-best-mate'] }, onlyIf: { tone: 'mix' } },
  { id: 258, set: { tone: 'warm', tags: ['for-mum', 'for-nan'] }, onlyIf: { tone: 'mix' } },
  { id: 259, set: { tone: 'warm', tags: ['for-nan', 'for-mum'] }, onlyIf: { tone: 'mix' } },
  { id: 260, set: { tone: 'warm', tags: ['for-sister', 'for-best-mate'], gender: 'her' }, onlyIf: { tone: 'mix' } },
  { id: 261, set: { tone: 'funny', tags: ['for-best-mate', 'for-brother'] }, onlyIf: { tone: 'mix' } },
  { id: 262, set: { tone: 'rude', tags: ['for-best-mate', 'for-sister'] }, onlyIf: { tone: 'mix' } },
  { id: 263, set: { tone: 'warm', tags: ['for-mum', 'for-sister'] }, onlyIf: { tone: 'mix' } },
  { id: 264, set: { tone: 'warm', tags: ['for-dad', 'for-grandad'] }, onlyIf: { tone: 'mix' } },
  { id: 265, set: { tone: 'funny', tags: ['for-dad', 'for-grandad'] }, onlyIf: { tone: 'mix' } },
  { id: 266, set: { tone: 'rude', tags: ['for-brother', 'for-best-mate'] }, onlyIf: { tone: 'mix' } },
  { id: 267, set: { tone: 'funny', tags: ['for-mum', 'for-sister'] }, onlyIf: { tone: 'mix' } },
  { id: 268, set: { tone: 'funny', tags: ['for-dad', 'for-grandad'] }, onlyIf: { tone: 'mix' } },
  { id: 271, set: { tone: 'funny', tags: ['for-mum', 'for-partner'] }, onlyIf: { tone: 'mix' } },
  { id: 272, set: { tone: 'funny', tags: ['for-dad', 'for-mum'] }, onlyIf: { tone: 'mix' } },
  { id: 273, set: { tone: 'rude', tags: ['for-brother', 'for-best-mate'] }, onlyIf: { tone: 'mix' } },
  { id: 274, set: { tone: 'funny', tags: ['for-dad', 'for-brother'] }, onlyIf: { tone: 'mix' } },
  { id: 275, set: { tone: 'warm', tags: ['for-nan', 'for-grandad'] }, onlyIf: { tone: 'mix' } },
  { id: 276, set: { tone: 'funny', tags: ['for-mum', 'for-dad'] }, onlyIf: { tone: 'mix' } },
  { id: 277, set: { tone: 'funny', tags: ['for-mum', 'for-dad'] }, onlyIf: { tone: 'mix' } },
  { id: 278, set: { tone: 'funny', tags: ['for-brother'] }, onlyIf: { tone: 'mix' } },
  { id: 279, set: { tone: 'funny', tags: ['for-dad', 'for-grandad'] }, onlyIf: { tone: 'mix' } },
  { id: 280, set: { tone: 'warm', tags: ['for-nan', 'for-grandad'] }, onlyIf: { tone: 'mix' } },
  { id: 282, set: { tags: ['for-mum'] }, onlyIf: {  } },
  { id: 283, set: { tags: ['for-son', 'for-daughter'] }, onlyIf: {  } },
  { id: 287, set: { tone: 'funny' }, onlyIf: { tone: 'mix' } },
  { id: 288, set: { tone: 'funny' }, onlyIf: { tone: 'mix' } },
  { id: 289, set: { tone: 'warm', tags: ['for-partner', 'for-sister'] }, onlyIf: { tone: 'mix' } },
  { id: 290, set: { tone: 'rude', tags: ['for-best-mate'] }, onlyIf: { tone: 'mix' } },
  { id: 291, set: { tags: ['for-sister', 'for-best-mate'] }, onlyIf: {  } },
  { id: 292, set: { tone: 'rude', tags: ['for-brother', 'for-dad'] }, onlyIf: { tone: 'mix' } },
  { id: 293, set: { tags: ['for-dad', 'for-grandad'] }, onlyIf: {  } },
  { id: 294, set: { tone: 'funny', tags: ['for-dad', 'for-brother'] }, onlyIf: { tone: 'mix' } },
  { id: 295, set: { tone: 'warm', tags: ['for-dad', 'for-brother'] }, onlyIf: { tone: 'mix' } },
  { id: 296, set: { tone: 'funny', tags: ['for-dad', 'for-brother'] }, onlyIf: { tone: 'mix' } },
  { id: 297, set: { tone: 'warm', tags: ['for-grandad', 'for-dad'] }, onlyIf: { tone: 'mix' } },
  { id: 298, set: { tone: 'funny', tags: ['for-dad', 'for-grandad'] }, onlyIf: { tone: 'mix' } },
  { id: 299, set: { tone: 'funny', tags: ['for-sister', 'for-best-mate'] }, onlyIf: { tone: 'mix' } },
  { id: 300, set: { tone: 'rude', tags: ['for-best-mate', 'for-brother'] }, onlyIf: { tone: 'mix' } },
  { id: 306, set: { tone: 'warm', tags: ['for-sister', 'for-mum'] }, onlyIf: { tone: 'mix' } },
  { id: 307, set: { tone: 'warm', tags: ['for-best-mate', 'for-sister'] }, onlyIf: { tone: 'mix' } },
  { id: 308, set: { tone: 'rude', tags: ['for-partner', 'for-best-mate'] }, onlyIf: { tone: 'mix' } },
  { id: 309, set: { tone: 'warm', tags: ['for-nan', 'for-grandad'] }, onlyIf: { tone: 'mix' } },
  { id: 312, set: { tone: 'funny' }, onlyIf: { tone: 'mix' } },
  { id: 313, set: { tone: 'funny' }, onlyIf: { tone: 'mix' } },
  { id: 314, set: { tone: 'warm' }, onlyIf: { tone: 'mix' } },
  { id: 315, set: { tone: 'warm' }, onlyIf: { tone: 'mix' } },
  { id: 316, set: { tone: 'warm' }, onlyIf: { tone: 'mix' } },
  { id: 317, set: { tone: 'funny' }, onlyIf: { tone: 'mix' } },
  { id: 318, set: { tone: 'warm' }, onlyIf: { tone: 'mix' } },
  { id: 319, set: { tone: 'funny' }, onlyIf: { tone: 'mix' } },
  { id: 320, set: { tone: 'warm' }, onlyIf: { tone: 'mix' } },
  { id: 321, set: { tone: 'funny' }, onlyIf: { tone: 'mix' } },
  { id: 322, set: { tone: 'funny' }, onlyIf: { tone: 'mix' } },
  { id: 323, set: { tone: 'funny', interest: 'gaming' }, onlyIf: { tone: 'mix', interest: 'PS5' } },
  { id: 324, set: { tone: 'funny', interest: 'gaming' }, onlyIf: { tone: 'mix', interest: 'PS5' } },
  { id: 325, set: { tone: 'funny', interest: 'gaming' }, onlyIf: { tone: 'mix', interest: 'PS5' } },
];

async function runShelvingPass(): Promise<void> {
  let applied = 0;
  for (const r of SHELVING) {
    try {
      const sets = [
        r.set.tone !== undefined ? sql`tone = ${r.set.tone}` : null,
        r.set.gender !== undefined ? sql`gender = ${r.set.gender}` : null,
        r.set.interest !== undefined ? sql`interest = ${r.set.interest}` : null,
        r.set.tags !== undefined && r.set.tags.length ? sql`aisle_tags = ${r.set.tags}` : null,
      ].filter((x): x is NonNullable<typeof x> => x !== null);
      if (!sets.length) continue;
      const guards = [sql`id = ${r.id}`];
      if (r.onlyIf.tone !== undefined) guards.push(sql`tone = ${r.onlyIf.tone}`);
      if (r.onlyIf.interest !== undefined) guards.push(sql`interest = ${r.onlyIf.interest}`);
      // tags only land on an untagged card; tone/gender/interest are
      // value-guarded, so split when both kinds ride one row
      if (r.set.tags !== undefined && r.set.tags.length) {
        // Tags are our own slug constants — inline as a proper text[]
        // literal (drizzle binds a JS array as a record otherwise).
        const arrayLit = `ARRAY[${r.set.tags.map((t) => `'${t.replace(/'/g, "''")}'`).join(',')}]::text[]`;
        const tagResult = await db.execute(
          sql`update card_templates set aisle_tags = ${sql.raw(arrayLit)} where id = ${r.id} and aisle_tags = '{}'::text[]`,
        );
        applied += (tagResult as unknown as { rowCount?: number }).rowCount ?? 0;
      }
      const nonTagSets = [
        r.set.tone !== undefined ? sql`tone = ${r.set.tone}` : null,
        r.set.gender !== undefined ? sql`gender = ${r.set.gender}` : null,
        r.set.interest !== undefined ? sql`interest = ${r.set.interest}` : null,
      ].filter((x): x is NonNullable<typeof x> => x !== null);
      if (nonTagSets.length) {
        const result = await db.execute(
          sql`update card_templates set ${sql.join(nonTagSets, sql`, `)} where ${sql.join(guards, sql` and `)}`,
        );
        applied += (result as unknown as { rowCount?: number }).rowCount ?? 0;
      }
    } catch (err) {
      console.warn(`[RETAG:P2] template ${r.id} failed (non-fatal):`, (err as Error)?.message ?? err);
    }
  }
  console.log(applied ? `[RETAG:P2] shelving pass applied ${applied} change(s)` : '[RETAG:P2] shelving pass: nothing to do');
}

/** PASS 3 — THE CUT (2026-09-02, "Just cut the bad ones"). Eleven
 *  cards UNPUBLISHED (not deleted — rows stay as builder history, one
 *  click back in the dialog): two masking-illegal, Aidan's own
 *  unparseable card, the adult-ops kids card, a nativity card with
 *  Santa in it (Santa is not in the nativity), pre-referee decoder
 *  rambles, label-phrases with no claim, an orphaned NY poster, and
 *  the weakest of the bollocks family. #264 spared to keep the
 *  real-ale aisle alive; the vice cards spared per the ceiling call.
 *  Plus two repairs: #237/#302 lose their mislabelled age-10 so they
 *  shelve as the adult cards they are. */
const CUTS: number[] = [222, 228, 229, 240, 249, 256, 269, 290, 301, 303, 313];
const AGE_REPAIRS: Array<{ id: number; tags: string[] }> = [
  { id: 237, tags: ['for-dad', 'for-mum'] },
  { id: 302, tags: ['for-best-mate', 'for-sister'] },
];

async function runCutPass(): Promise<void> {
  let applied = 0;
  for (const id of CUTS) {
    try {
      const r = await db.execute(sql`update card_templates set published = false where id = ${id} and published = true`);
      const n = (r as unknown as { rowCount?: number }).rowCount ?? 0;
      if (n > 0) { applied += n; console.log(`[RETAG:P3] unpublished template ${id}`); }
    } catch (err) { console.warn(`[RETAG:P3] cut ${id} failed (non-fatal):`, (err as Error)?.message ?? err); }
  }
  for (const r2 of AGE_REPAIRS) {
    try {
      const r = await db.execute(sql`update card_templates set age = null where id = ${r2.id} and age = 10`);
      const n = (r as unknown as { rowCount?: number }).rowCount ?? 0;
      if (n > 0) { applied += n; console.log(`[RETAG:P3] cleared mislabelled age on ${r2.id}`); }
      const arrayLit = `ARRAY[${r2.tags.map((t) => `'${t}'`).join(',')}]::text[]`;
      const rt = await db.execute(sql`update card_templates set aisle_tags = ${sql.raw(arrayLit)} where id = ${r2.id} and aisle_tags = '{}'::text[]`);
      applied += (rt as unknown as { rowCount?: number }).rowCount ?? 0;
    } catch (err) { console.warn(`[RETAG:P3] repair ${r2.id} failed (non-fatal):`, (err as Error)?.message ?? err); }
  }
  console.log(applied ? `[RETAG:P3] cut pass applied ${applied} change(s)` : '[RETAG:P3] cut pass: nothing to do');
}

export async function runStartupRetag(): Promise<void> {
  let applied = 0;
  for (const r of RETAGS) {
    try {
      const sets = [
        r.set.recipient !== undefined ? sql`recipient = ${r.set.recipient}` : null,
        r.set.interest !== undefined ? sql`interest = ${r.set.interest}` : null,
      ].filter((x): x is NonNullable<typeof x> => x !== null);
      const guards = [
        sql`id = ${r.id}`,
        r.onlyIf.recipient !== undefined ? sql`recipient = ${r.onlyIf.recipient}` : null,
        r.onlyIf.interest !== undefined ? sql`interest = ${r.onlyIf.interest}` : null,
      ].filter((x): x is NonNullable<typeof x> => x !== null);
      const result = await db.execute(
        sql`update card_templates set ${sql.join(sets, sql`, `)} where ${sql.join(guards, sql` and `)}`,
      );
      const n = (result as unknown as { rowCount?: number }).rowCount ?? 0;
      if (n > 0) { applied += n; console.log(`[RETAG] template ${r.id}:`, JSON.stringify(r.set)); }
    } catch (err) {
      console.warn(`[RETAG] template ${r.id} failed (non-fatal):`, (err as Error)?.message ?? err);
    }
  }
  console.log(applied ? `[RETAG] 2026-08-31 pass applied ${applied} change(s)` : '[RETAG] 2026-08-31 pass: nothing to do (already applied)');
  await runShelvingPass();
  await runCutPass();
}
