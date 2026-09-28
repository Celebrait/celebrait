/**
 * MEDIUM SPREAD — is free style actually using its whole range?
 *
 *   npx tsx server/scripts/medium-spread-check.ts [briefs]
 *
 * WHY. Aidan, 2026-08-19: "how many design rotations do we have?"
 * On paper, 21 named media x 5 formats = 105 combinations before
 * palette and lettering multiply it. By eye, almost everything we make
 * is riso, papercut, gouache or linocut — which would make the real
 * figure 5 x 4, and a rack of a hundred cards would look like four
 * cards.
 *
 * ⚠️ THE SUSPECTED CAUSE IS A POSITIVE-EXAMPLE LIST. freeStyleDna names
 * its 21 media inline, and this codebase has now proved twice in a day
 * that concrete examples get read as a MENU rather than an
 * illustration: the four typeface descriptions came back verbatim, and
 * the buyer test's named references had every Harry Potter set built on
 * the same two. A list of media is the largest such set left.
 *
 * Medium is the single biggest driver of whether a rack reads as a
 * range, so this is worth knowing BEFORE a hundred cards get built, not
 * after.
 *
 * Deliberately varied subjects — a rack is not one topic, and a medium
 * that only ever suits fishing is not range.
 */
import 'dotenv/config';
import express from 'express';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

const BRIEFS = [
  { who: 'Dad', age: 60, interest: 'fly fishing' },
  { who: 'Nan', age: 78, interest: 'her garden' },
  { who: 'Best mate', age: 30, interest: 'making cocktails' },
  { who: 'Sister', age: 25, interest: 'Ibiza parties' },
  { who: 'Brother', age: 35, interest: 'Oasis' },
  { who: 'Mum', age: 55, interest: 'reading crime novels' },
  { who: 'Grandad', age: 82, interest: 'crown green bowls' },
  { who: 'Friend', age: 40, interest: 'road cycling' },
  { who: 'Colleague', age: 50, interest: 'baking' },
  { who: 'Partner', age: 45, interest: 'sea swimming' },
];

/** The 21 named in freeStyleDna, plus the obvious near-synonyms the
 *  model reaches for, so a card is not counted as "other" just because
 *  it said "screenprint" rather than "screen print". */
const MEDIA: Array<[string, RegExp]> = [
  ['risograph', /riso/i],
  ['linocut', /linocut|lino print|woodcut|woodblock/i],
  ['gouache', /gouache/i],
  ['papercut', /papercut|paper-cut|cut-paper|cut paper|paper collage/i],
  ['screen print', /screen ?print|silkscreen|serigraph/i],
  ["children's book", /children'?s book|storybook/i],
  ['travel poster', /travel poster|railway poster/i],
  ['botanical plate', /botanical (plate|illustration)/i],
  ['art deco', /art deco|deco /i],
  ['zine photocopy', /zine|photocopy|xerox/i],
  ['comic halftone', /halftone|comic/i],
  ['fashion marker', /fashion[- ]marker|marker illustration|fashion illustration/i],
  ['cyanotype', /cyanotype/i],
  ['signwriting', /sign[- ]?wri|sign[- ]?paint/i],
  ['ceramic tile', /ceramic|tile|azulejo/i],
  ['embroidery', /embroider|cross[- ]stitch|needlepoint/i],
  ['70s airbrush', /airbrush/i],
  ['chalk pastel', /chalk|pastel/i],
  ['lithograph', /lithograph/i],
  ['engraving', /engrav|etching/i],
  ['collage (photo)', /photo ?collage|photomontage/i],
];

async function main(): Promise<void> {
  const n = Number(process.argv[2] ?? BRIEFS.length);
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { otpUserId: process.env.LAB_ADMIN_USER_ID };
    next();
  });
  registerAdminCardLabRoutes(app);
  const server = app.listen(0);
  const port = (server.address() as any).port;

  const counts = new Map<string, number>();
  const unmatched: string[] = [];
  let cards = 0;

  for (const brief of BRIEFS.slice(0, n)) {
    const res = await fetch(`http://localhost:${port}/api/admin/card-lab/concepts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...brief, occasion: 'Birthday', tone: 'funny', insideMode: 'auto',
        cheeky: false, freeStyle: true, characters: 'objects',
      }),
    });
    const json: any = await res.json();
    const concepts: any[] = json.concepts ?? [];
    if (!concepts.length) { console.log(`  ${brief.interest}: NO CONCEPTS`); continue; }
    console.log(`\n### ${brief.interest}`);
    concepts.forEach((c: any) => {
      const d = String(c.direction ?? '');
      cards += 1;
      const hit = MEDIA.find(([, re]) => re.test(d));
      if (hit) counts.set(hit[0], (counts.get(hit[0]) ?? 0) + 1);
      else unmatched.push(d.slice(0, 60));
      console.log(`  ${(hit?.[0] ?? 'other').padEnd(16)} ${d.slice(0, 74)}`);
    });
  }

  console.log(`\n${'='.repeat(62)}`);
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([k, v]) => console.log(`  ${String(Math.round((v / cards) * 100)).padStart(3)}%  ${k} (${v})`));
  if (unmatched.length) console.log(`  ${Math.round((unmatched.length / cards) * 100)}%  unrecognised (${unmatched.length})`);
  console.log(`\n${sorted.length} distinct media across ${cards} cards; top 4 = ${
    Math.round((sorted.slice(0, 4).reduce((a, [, v]) => a + v, 0) / cards) * 100)}% of the rack`);
  server.close();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
