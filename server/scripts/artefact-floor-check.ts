/**
 * Regression check for the protected-artefact floor in admin-card-lab.
 *
 * This guard is the last thing between a customer typing "Harry Potter"
 * and us printing and posting merchandise, so it gets a test rather than
 * a read-through. The first version used \bsnitch\b and quietly let
 * "golden snitches" past — an eyeball review missed it, this caught it.
 *
 *   npx tsx server/scripts/artefact-floor-check.ts
 *
 * The clean cases matter as much as the flagged ones: over-blocking
 * generic props (a scarf, an owl, a telescope) would gut the product.
 */
import 'dotenv/config';
import { namedArtefacts } from '../routes/admin-card-lab';
const CASES: Array<[string, boolean]> = [
  ['A pattern of wands, brooms and golden snitches on a night sky', true],
  ['A single Golden Snitch, centred', true],
  ['Quaffles and Bludgers scattered across the card', true],
  ['The Marauder\'s Map, opened and centred', true],
  ['A mug with a lightsaber handle', true],
  ['Two lightsabres crossed', true],
  ['A club crest above a football', true],
  ['A striped scarf, an owl and a stack of spellbooks', false],
  ['A brick wall with a luggage cart halfway through', false],
  ['A telescope pointing at a starry night sky', false],
  ['A wizard\'s hat on an ornate chair', false],
  ['Cutlery arranged in a star formation around a cake', false],
];
let bad = 0;
for (const [brief, shouldFlag] of CASES) {
  const hits = namedArtefacts(brief);
  const flagged = hits.length > 0;
  const ok = flagged === shouldFlag;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${flagged ? hits.join(', ') : '(clean)'}  <- ${brief}`);
}
console.log(bad === 0 ? 'ALL PASS' : `${bad} FAILED`);
process.exit(0);
