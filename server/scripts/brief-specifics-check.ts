/**
 * Does the engine actually USE what the buyer typed?
 *
 *   npx tsx server/scripts/brief-specifics-check.ts [runs]
 *
 * WHY. Aidan, 2026-08-18, on a 40th/Manchester United brief carrying
 * "same shed since 1998" in the detail field and "Liverpool" in the
 * can't-stand field: "Tested the dislike. No Liverpool mention? Also
 * number 3 makes very little sense?"
 *
 * Both were true and they are the same fault. Neither field reached a
 * card, so the third card had nothing real left to say and invented a
 * habit nobody mentioned. The optional fields are the ONLY things that
 * separate this card from every other United card in the shop, and they
 * were the parts being dropped.
 *
 * The cause was phrasing: both arrived as hedged permissions ("good
 * comic fuel, but ONE card at most"), and this codebase has already
 * learned that a hedged line loses every argument with the restraint
 * rules around it — the cheek block did exactly this and needed
 * rewriting as an order.
 *
 * So this checks the FLOOR, not the taste: across N runs, does a real
 * detail reach a card, and does a stated dislike reach exactly one?
 * Text only, no renders — about 5p a run.
 */
import 'dotenv/config';
import express from 'express';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

const BRIEF = {
  who: 'Brother',
  occasion: 'Birthday',
  age: 40,
  interest: 'Manchester United',
  detail: 'same shed since 1998',
  dislikes: 'Liverpool',
  insideMode: 'auto',
  cheeky: true,
  freeStyle: true,
  characters: 'figures',
};

/** Deliberately generous. We are testing whether the SUBJECT reached the
 *  card, not whether it used our exact words — "the Kop", "Anfield" and
 *  "scousers" are all Liverpool landing properly, and demanding the
 *  literal string would fail the best cards. */
const DISLIKE_HINTS = ['liverpool', 'anfield', 'kop', 'scouse', 'merseyside', 'red of the wrong'];
const DETAIL_HINTS = ['shed', '1998', 'ninety-eight'];

const hit = (text: string, hints: string[]) =>
  hints.some((h) => text.toLowerCase().includes(h));

async function main(): Promise<void> {
  const runs = Number(process.argv[2] ?? 3);

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { otpUserId: process.env.LAB_ADMIN_USER_ID };
    next();
  });
  registerAdminCardLabRoutes(app);
  const server = app.listen(0);
  const port = (server.address() as any).port;

  let detailRuns = 0;
  let dislikeRuns = 0;
  // Aidan's call: filling the field in IS the request, so the bar is all
  // three, not "at least one got there".
  let dislikeAllThree = 0;

  for (let r = 0; r < runs; r++) {
    const res = await fetch(`http://localhost:${port}/api/admin/card-lab/concepts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(BRIEF),
    });
    const json: any = await res.json();
    const concepts: any[] = json.concepts ?? [];
    if (!concepts.length) {
      console.log(`run ${r + 1}: NO CONCEPTS — ${JSON.stringify(json).slice(0, 160)}`);
      continue;
    }

    // Front AND artwork count: the detail rule explicitly allows a card to
    // carry it in the picture when it will not fit in the words.
    const texts = concepts.map((c) => `${c.front_text} ${c.art_direction ?? ''}`);
    const dislikeCards = texts.filter((t) => hit(t, DISLIKE_HINTS)).length;
    const detailCards = texts.filter((t) => hit(t, DETAIL_HINTS)).length;

    if (detailCards > 0) detailRuns += 1;
    if (dislikeCards > 0) dislikeRuns += 1;
    if (dislikeCards === 3) dislikeAllThree += 1;

    console.log(`\nrun ${r + 1}:  detail on ${detailCards}/3   dislike on ${dislikeCards}/3`);
    concepts.forEach((c) => {
      const t = `${c.front_text} ${c.art_direction ?? ''}`;
      const tags = [hit(t, DETAIL_HINTS) ? 'DETAIL' : '', hit(t, DISLIKE_HINTS) ? 'DISLIKE' : '']
        .filter(Boolean).join('+');
      console.log(`   ${tags.padEnd(14)} "${c.front_text}"`);
    });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`detail reached a card:        ${detailRuns}/${runs} runs`);
  console.log(`dislike reached a card:       ${dislikeRuns}/${runs} runs`);
  console.log(`dislike on ALL THREE cards:    ${dislikeAllThree}/${runs} runs`);
  server.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
