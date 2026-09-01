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
}
