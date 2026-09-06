/**
 * Regression check for the occasion classifier (the occasion brain's
 * front door). Deterministic and free to run:
 *
 *   npx tsx server/scripts/occasion-classifier-check.ts
 *
 * The ordering traps are the point of this file — "60th anniversary"
 * must not fall through the bare-ordinal birthday catch, and "ruby
 * wedding anniversary" contains the word wedding but is an anniversary
 * (that one was asserted WRONG in the first draft of this very test,
 * which is exactly why the cases are written down).
 * Misrouting is not cosmetic: sympathy is the profile that switches
 * humour OFF, so a missed sympathy match would put a joke on a
 * condolence card.
 */
import 'dotenv/config';
import { classifyOccasion } from '../routes/admin-card-lab';
const CASES: Array<[string, string]> = [
  ['Birthday', 'birthday'], ['his 60th', 'birthday'], ['21st', 'birthday'],
  ['60th anniversary', 'anniversary'], ['ruby wedding anniversary', 'anniversary'],
  ['gender reveal', 'baby'], ['baby shower', 'baby'],
  ["Father's Day", 'fathersday'], ['Mothering Sunday', 'mothersday'],
  ['sympathy', 'sympathy'], ['sorry for your loss', 'sympathy'], ['she passed away', 'sympathy'],
  ['get well soon', 'getwell'],
  ['passed her driving test', 'congratulations'],
  ['retirement after 40 years', 'retirement'],
  ['Christmas', 'christmas'], ['just because', 'justbecause'],
  ['leaving drinks', 'celebration'],
];
let bad = 0;
for (const [input, want] of CASES) {
  const got = classifyOccasion(input).key;
  if (got !== want) { bad++; console.log(`FAIL "${input}" -> ${got} (want ${want})`); }
}
console.log(bad === 0 ? `ALL ${CASES.length} PASS` : `${bad} FAILED`);
process.exit(0);
