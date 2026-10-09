/**
 * THE SUBJECT SWEEP — does a prompt change hold ACROSS THE BOARD, or
 * only on the subjects it was tuned against?
 *
 *   npx tsx server/scripts/subject-sweep.ts [--wide]
 *
 * WHY. Aidan, 2026-08-18, after the iconic-line rule was verified on
 * three famous sitcoms: "Does this work across the board?" Fair
 * question, and three well-known shows is precisely the sample most
 * likely to flatter that particular change.
 *
 * The bench (card-lab-bench.ts) renders five fixed briefs as pictures
 * and is the right tool for "did the ART regress". This is the cheap
 * text-only cousin covering a much wider spread of SUBJECT TYPES, for
 * "did the WORDS regress on subjects I wasn't thinking about".
 *
 * The spread is the whole point, and each row is here for a reason:
 *   · has a famous catchphrase          — should reach for it
 *   · famous but no single catchphrase  — must not invent one
 *   · a plain hobby, no culture at all  — must stay clean and specific
 *   · deliberately obscure              — nothing famous to grab
 *   · a place rather than a property    — the Ibiza case
 * A change that helps the first row and damages the middle two is a
 * regression wearing a success costume.
 *
 * Automatic check: a distinctive word carried by ALL THREE cards is
 * flagged as a collapse. The rest is for your eyes — taste does not
 * assert.
 */
import 'dotenv/config';
import express from 'express';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

interface Row {
  kind: string;
  brief: Record<string, unknown>;
}

const CORE: Row[] = [
  // ── Should GRAB an iconic line ─────────────────────────────────
  { kind: 'catchphrase', brief: { who: 'Best mate', age: 40, interest: 'Only Fools and Horses' } },
  { kind: 'catchphrase', brief: { who: 'Sister', age: 30, interest: 'Harry Potter' } },

  // ── Famous, but NO single catchphrase. The danger case: the rule
  //    must not manufacture one, or bolt on a half-remembered quote.
  { kind: 'no-catchphrase', brief: { who: 'Brother', age: 35, interest: 'Oasis' } },
  { kind: 'no-catchphrase', brief: { who: 'Dad', age: 60, interest: 'Manchester United' } },

  // ── Plain hobbies. No culture to mine at all. These must come back
  //    specific and clean — any franchise machinery leaking in here is
  //    the regression to catch.
  { kind: 'plain-hobby', brief: { who: 'Dad', age: 60, interest: 'fly fishing' } },
  { kind: 'plain-hobby', brief: { who: 'Nan', age: 78, interest: 'her garden' } },
  { kind: 'plain-hobby', brief: { who: 'Best mate', age: 30, interest: 'making cocktails' } },

  // ── Obscure. Nothing famous exists to reach for.
  { kind: 'obscure', brief: { who: 'Grandad', age: 82, interest: 'crown green bowls' } },

  // ── A PLACE, not a property — the Ibiza failure.
  { kind: 'place', brief: { who: 'Sister', age: 25, interest: 'Ibiza parties' } },
];

const WIDE: Row[] = [
  { kind: 'catchphrase', brief: { who: 'Mum', age: 55, interest: 'Gavin and Stacey' } },
  { kind: 'no-catchphrase', brief: { who: 'Partner', age: 45, interest: 'sea swimming' } },
  { kind: 'obscure', brief: { who: 'Colleague', age: 50, interest: 'restoring old radios' } },
];

const STOP = new Set(['this','that','with','your','still','from','have','been','they','them','their','what','when','then','than','just','only','more','most','very','years','year','birthday','happy','about','after','into','over','some','like','make','made','goes','going','well','been']);

async function main(): Promise<void> {
  const rows = process.argv.includes('--wide') ? [...CORE, ...WIDE] : CORE;

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { otpUserId: process.env.LAB_ADMIN_USER_ID };
    next();
  });
  registerAdminCardLabRoutes(app);
  const server = app.listen(0);
  const port = (server.address() as any).port;

  let collapses = 0;
  let empty = 0;

  for (const row of rows) {
    const res = await fetch(`http://localhost:${port}/api/admin/card-lab/concepts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        occasion: 'Birthday', insideMode: 'auto', cheeky: false,
        freeStyle: false, characters: 'figures', ...row.brief,
      }),
    });
    const json: any = await res.json();
    const concepts: any[] = json.concepts ?? [];
    console.log(`\n### [${row.kind}] ${row.brief.interest} — ${row.brief.who}, ${row.brief.age}`);
    if (!concepts.length) {
      empty += 1;
      console.log(`  NO CONCEPTS — ${JSON.stringify(json).slice(0, 140)}`);
      continue;
    }
    concepts.forEach((c: any) => console.log(`  [${c.angle}] "${c.front_text}"`));

    // A distinctive word on all three = the set has one idea. The brief's
    // own words are exempt; every card is legitimately about the subject.
    const briefWords = new Set(
      `${row.brief.interest} ${row.brief.who}`.toLowerCase().match(/[a-z']{4,}/g) ?? [],
    );
    const freq = new Map<string, number>();
    for (const c of concepts) {
      const seen = new Set(
        String(c.front_text).toLowerCase().match(/[a-z']{4,}/g)
          ?.filter((w) => !STOP.has(w) && !briefWords.has(w)) ?? [],
      );
      seen.forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));
    }
    const on3 = Array.from(freq.entries()).filter(([, n]) => n >= 3).map(([w]) => w);
    if (on3.length) {
      collapses += 1;
      console.log(`  ⚠️ COLLAPSE — all three carry: ${on3.join(', ')}`);
    }
  }

  console.log(`\n${'='.repeat(62)}`);
  console.log(`${rows.length} briefs · ${collapses} collapsed · ${empty} returned nothing`);
  console.log('Everything else is an eyeball job — read the lines above.');
  server.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
