// server/scripts/test-lay-buyer-floor.ts
//
// Does the LAY BUYER floor (2026-09-13) actually fire, and only when it
// should? Runs the real sense referee twice over the exact line that
// prompted it — "Sam, you make the shore-check worth it." from the
// research walk-through — with the floor ON and OFF, plus a plain-words
// rewrite and an artwork-carries-it variant that must both PASS.
//
//   npx tsx server/scripts/test-lay-buyer-floor.ts

import 'dotenv/config';
import { v2SenseCheck } from '../routes/admin-card-lab';
import { openai } from '../utils/shared';

async function main() {
  if (!openai) { console.log('NO OPENAI CLIENT — cannot test'); return; }
  const cards: any[] = [
    { front_text: 'Sam, you make the shore-check worth it.', art_direction: 'Bold typography on a cold-blue ground, a single towel in the corner.' },
    { front_text: 'Sam, you make checking the tide before we get in worth it.', art_direction: 'Bold typography on a cold-blue ground, a single towel in the corner.' },
    { front_text: 'Sam, you make the shore-check worth it.', art_direction: 'Two figures in dryrobes on a pebble beach, one crouched at the waterline reading the sea before the swim, the words above.' },
  ];
  const expect = ['FLAG (jargon, art does not show it)', 'PASS (plain words)', 'PASS (artwork carries it)'];
  for (const layBuyer of [true, false]) {
    console.log(`\n── floor ${layBuyer ? 'ON' : 'OFF'} ──`);
    const v = await v2SenseCheck(openai, cards, 30, 'wild swimming', layBuyer);
    cards.forEach((c, i) => {
      const mine = v.filter((x) => x.startsWith(`sense: card ${i + 1} `));
      // Only the named floor — REAL CLAIM violations also say "plainly" and must not be miscounted.
      const lay = mine.filter((x) => /^sense: card \d — LAY BUYER/i.test(x));
      console.log(`${i + 1}. "${c.front_text}"  → ${layBuyer ? 'expect ' + expect[i] : 'expect no lay-buyer flag'}`);
      console.log(`   lay-buyer flags: ${lay.length ? lay.map((x) => x.replace(/^sense: card \d — /, '')).join(' | ') : 'none'}${mine.length > lay.length ? `   (other: ${mine.length - lay.length})` : ''}`);
    });
  }
  await new Promise((r) => setTimeout(r, 2000));
  // Importing the routes module opens db/r2 handles that never close — exit explicitly.
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
