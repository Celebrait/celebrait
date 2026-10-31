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

  // ── THE 2026-08-18 NARROWING ─────────────────────────────────────
  // Aidan: "I do think we might be overblocking... we can draw Old
  // Trafford". He was right, and the floor was part of it — it blocked
  // the bare words "emblem", "badge" and "coat of arms", which are
  // ordinary decorative nouns owned by nobody. These cases pin the new
  // line: a REAL ORGANISATION's mark stays blocked, generic heraldry
  // and real places do not.
  ['A club emblem stitched onto a shirt', true],
  ['The team badge above a stadium', true],
  ['A school crest on a blazer pocket', true],
  ['An invented sporting emblem of crossed oars and a laurel', false],
  ['A rosette and a hand-drawn heraldic badge in flat inks', false],
  ['A coat of arms invented for the occasion, in three flat inks', false],
  // Real places are open — nobody owns reality, and a floodlit ground
  // says WHICH club without going near the crest.
  ['Old Trafford under floodlights, flat three-ink print', false],
  ['The Kop at dusk, seen from the pitch', false],
  ['Blackpool Tower against a bright evening sky', false],
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
