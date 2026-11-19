/**
 * Does the front ever contradict the stated gender?
 *
 *   npx tsx server/scripts/gender-words-check.ts [runs]
 *
 * WHY. Aidan, 2026-08-19, on a card for a best mate he had marked
 * "she": "number 2 means nothing" — the line was "A fully normal amount
 * of gold for one man." Aimed at the SUBJECT, but it does not matter
 * what it was aimed at: a gendered word on a card reads as being about
 * the person opening it, because that is whose card it is.
 *
 * This is a CORRECTNESS test, not a taste one. The card gets printed and
 * posted to a real person, so calling a woman a man is the same class of
 * failure as inventing her age — wrong beats bland, and wrong is worse.
 *
 * The cause was a single instruction doing two jobs badly: "let it tune
 * palette and type warmth only, never the joke". That was written to
 * stop gendered stereotyping (a woman who fishes does not get a pink
 * rod) and it is right about that — but read alone it says gender is
 * irrelevant to the words, which licenses exactly this.
 *
 * Three cases, because the third is the one people forget: when NO
 * gender is stated the card must work for anyone, so no gendered word
 * should appear at all.
 */
import 'dotenv/config';
import express from 'express';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

const MALE = /\b(man|men|bloke|lad|lads|guy|guys|boy|boys|he|him|his|himself|mr|sir|king|dad|father|brother|son|husband|uncle|grandad|granddad|gent|gentleman)\b/i;
const FEMALE = /\b(woman|women|lass|lasses|girl|girls|she|her|hers|herself|mrs|ms|madam|queen|mum|mother|sister|daughter|wife|auntie|aunt|nan|nana|grandma|lady|ladies)\b/i;

/** ⚠️ The RECIPIENT WORD is exempt — a card for a Nan may say "Nan",
 *  that is the relationship the buyer chose, not a contradiction. Only
 *  words that clash with the stated gender count. */
const cases = [
  { gender: 'her', who: 'Best mate', wrong: MALE, label: 'she — must not say man/lad/he' },
  { gender: 'him', who: 'Best mate', wrong: FEMALE, label: 'he — must not say woman/lass/she' },
  { gender: 'unspecified', who: 'Best mate', wrong: new RegExp(`${MALE.source}|${FEMALE.source}`, 'i'), label: 'unstated — no gendered words at all' },
] as const;

const INTERESTS = ['Donald Trump', 'red wine', 'running'];

async function main(): Promise<void> {
  const runs = Number(process.argv[2] ?? 1);

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { otpUserId: process.env.LAB_ADMIN_USER_ID };
    next();
  });
  registerAdminCardLabRoutes(app);
  const server = app.listen(0);
  const port = (server.address() as any).port;

  let checked = 0, clashes = 0;

  for (let r = 0; r < runs; r++) {
    for (const c of cases) {
      const interest = INTERESTS[(r + cases.indexOf(c as any)) % INTERESTS.length];
      const res = await fetch(`http://localhost:${port}/api/admin/card-lab/concepts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          who: c.who, gender: c.gender, occasion: 'Birthday', age: 40, interest,
          insideMode: 'auto', cheeky: false, freeStyle: false, characters: 'objects',
        }),
      });
      const json: any = await res.json();
      const concepts: any[] = json.concepts ?? [];
      if (!concepts.length) { console.log(`\n### ${c.label} / ${interest} — NO CONCEPTS`); continue; }

      console.log(`\n### ${c.label}  (${interest})`);
      concepts.forEach((cc: any) => {
        const t = String(cc.front_text);
        const bad = c.wrong.test(t);
        checked += 1; if (bad) clashes += 1;
        console.log(`  ${bad ? 'CLASH' : '  ok ' } "${t}"`);
      });
    }
  }

  console.log(`\n${'='.repeat(56)}`);
  console.log(`${clashes}/${checked} fronts contradict the stated gender (want 0)`);
  server.close();
  process.exit(clashes ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
