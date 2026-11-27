/**
 * AGELESS CARDS — does at least one front say what occasion this is?
 *
 *   npx tsx server/scripts/ageless-occasion-check.ts [runs]
 *
 * WHY. Aidan, 2026-08-19: "right now we do not have any cards that just
 * say 'Happy Birthday' or at least bedding this into the wording....
 * seems like we need it?"
 *
 * Checked before answering, and the insides were already fine — 6 of 6
 * said happy birthday, which is exactly how a real shop works: on a
 * funny card the FRONT is the joke and the INSIDE does the occasion. A
 * rack where every front shouts Happy Birthday looks like a supermarket,
 * and we deliberately killed those fronts because they produced filler
 * ("Make Waves, It's Your Birthday!").
 *
 * The real hole was narrower. WITH an age, the number does the job —
 * "35. Away We Go.", "Nan's 78? Best in blossom" and you know instantly
 * what it is. WITHOUT one, a front can carry no occasion signal at all:
 * "Weekend: Reserved For United." could be any card in the shop.
 *
 * So the rule is: on an AGELESS brief, ONE of the three fronts must
 * carry an unmistakable occasion signal — still fused, never bolted on.
 * The other two stay pure joke. This measures that floor, and the
 * CEILING too: all three saying it is the monotonous set we already
 * guard against.
 */
import 'dotenv/config';
import express from 'express';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

/** No age on ANY of these — that is the whole point. */
const BRIEFS = [
  { who: 'Best mate', interest: 'Man United away days' },
  { who: 'Dad', interest: 'fly fishing' },
  { who: 'Sister', interest: 'making cocktails' },
];

/** ⚠️ Deliberately broad, and still probably an UNDERCOUNT — the same
 *  trap that made brief-specifics-check mark "40 years of hating reds"
 *  as a miss. A front can signal the occasion sideways ("many happy
 *  returns", "another trip round"), so treat a low score as a prompt
 *  to READ the lines, not as proof on its own. */
const OCCASION = /\bbirthday\b|\bhappy returns\b|\bmany happy\b|\bcandles?\b|\bcake\b|\bblow(ing)? out\b|\bcelebrat/i;

/** ⚠️ AND THE PORTMANTEAU HALF, which the regex above missed on its very
 *  first run — it scored 0/3 on a set containing "Hope Your Hatchday's A
 *  Good One" and "A Very Happy Pourthday". Both are birthday puns doing
 *  exactly the job we are asking for, and both are invisible to a
 *  literal search. Second time in two days a keyword checker has marked
 *  the cleverest line as the failure; the wordplay angle exists to bend
 *  the word, so any test for that word has to expect it bent.
 *  A word ending in -day that is not an ordinary calendar word is, on a
 *  birthday brief, a birthday pun. */
const REAL_DAY_WORDS = new Set([
  'today', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'sunday', 'holiday', 'weekday', 'everyday', 'someday', 'yesterday', 'midday',
  'day', 'days', 'matchday', 'payday', 'workday', 'doomsday', 'mayday',
]);
const portmanteau = (t: string) =>
  (t.toLowerCase().match(/\b[a-z']*day'?s?\b/g) ?? [])
    .some((w) => !REAL_DAY_WORDS.has(w.replace(/'s$|s$/, '')));

const signalsOccasion = (t: string) => OCCASION.test(t) || portmanteau(t);

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

  let sets = 0, withSignal = 0, allThree = 0;

  for (let r = 0; r < runs; r++) {
    for (const brief of BRIEFS) {
      const res = await fetch(`http://localhost:${port}/api/admin/card-lab/concepts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occasion: 'Birthday', insideMode: 'auto', cheeky: false,
          freeStyle: false, characters: 'objects', ...brief,
        }),
      });
      const json: any = await res.json();
      const concepts: any[] = json.concepts ?? [];
      if (!concepts.length) {
        console.log(`\n### ${brief.interest} — NO CONCEPTS`);
        continue;
      }
      sets += 1;
      const hits = concepts.filter((c) => signalsOccasion(String(c.front_text))).length;
      if (hits >= 1) withSignal += 1;
      if (hits === 3) allThree += 1;

      console.log(`\n### ${brief.interest} (ageless) — ${hits}/3 fronts signal the occasion`);
      concepts.forEach((c) => {
        const hit = signalsOccasion(String(c.front_text));
        console.log(`  ${hit ? 'OCC ' : '    '}"${c.front_text}"`);
      });
    }
  }

  console.log(`\n${'='.repeat(58)}`);
  console.log(`sets with at least one occasion front: ${withSignal}/${sets}  (want all)`);
  console.log(`sets where ALL THREE say it:           ${allThree}/${sets}  (want none)`);
  server.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
