/**
 * Regression check for statedAge() — the birthday world's front door.
 *
 * Getting this wrong is expensive in both directions: a MISSED age
 * means a milestone card with no number (the whole point lost), and a
 * FALSE age means a card that states someone's age incorrectly —
 * printed and posted. It also gates the birth-year carve-out, which is
 * the one deliberate hole in the never-invent-a-date rule.
 */
import 'dotenv/config';
import { statedAge } from '../routes/admin-card-lab';

const CASES: Array<[string, number | null]> = [
  ['60th Birthday', 60], ['her 21st', 21], ['his 18th birthday', 18],
  ['turning 40', 40], ['30th', 30], ['1st birthday', 1],
  ['Birthday', null], ['birthday party', null], ['just because', null],
  // '40 years' of SERVICE is not an age — null is correct, and this
  // string reaches the retirement profile anyway. Asserted the wrong
  // way round first time, which is why it is written down.
  ['retirement after 40 years', null],
  // Anniversary classification wins long before statedAge is called on
  // this, so the 21 here is harmless.
  ['21st wedding anniversary', 21],
];
let bad = 0;
for (const [input, want] of CASES) {
  const got = statedAge(input);
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(input)} -> ${got} (want ${want})`);
}
console.log(bad === 0 ? `ALL ${CASES.length} PASS` : `${bad} FAILED`);
process.exit(0);
