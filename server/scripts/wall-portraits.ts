// WALL PORTRAITS — made-up portrait photos of NOBODY REAL, so the landing
// page walls can show example cards "with them in it" (Aidan 2026-11-19:
// the carousel should mix cards with people in and cards with names on).
// Each photo is then fed to the card's own redraw (cameoMode 'redraw'),
// the same route a customer's photo takes. Never use a real person's
// photo for an example card, and never call these cards a customer's.
//
//   npx tsx server/scripts/wall-portraits.ts <outDir> [<id>]
//
// About 5c a portrait at medium quality. Dev machine only.
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { getProvider } from '../providers/registry';

const LOOK = 'An ordinary, unposed phone photo taken by a family member. Head and shoulders, facing the camera, natural daylight, slightly imperfect framing, real skin texture, no retouching, no studio lighting, not a model. British, everyday clothes. A fictional person: do not resemble any real or famous person.';
const PEOPLE: Array<[string, string]> = [
  ['linda', 'A warm, smiling woman aged about 58 with shoulder-length grey-blonde hair, in a cardigan, standing in her back garden beside pots of flowers.'],
  ['rob', 'A cheerful man aged about 41 with short dark hair and light stubble, in a zip-up top, in a kitchen with a coffee machine behind him.'],
  ['nan', 'A kind-faced woman aged about 82 with short white curly hair and glasses, in a soft lilac jumper, sitting in an armchair by a window.'],
  ['jess', 'A laughing woman aged about 29 with long brown hair in a ponytail, in a denim jacket, outdoors on a park path.'],
  ['grandad', 'A gently smiling man aged about 78 with thin white hair and a flat cap, in a checked shirt and gilet, on an allotment with a shed behind him.'],
  ['sarah', 'A relaxed, smiling woman aged about 45 with wavy auburn hair, in a fleece, on a pebble beach by a lake on a bright cold morning.'],
  ['tom', 'A grinning man aged about 34 with short fair hair, in a football training top, on a sofa in a living room.'],
  ['hannah', 'A bright, smiling woman aged about 30 with a dark bob, in a jumper, in a cafe holding an iced coffee.'],
];

async function main() {
  const out = process.argv[2];
  const only = process.argv[3];
  const p = getProvider('openai-2.5-flare');
  let cents = 0;
  await Promise.all(PEOPLE.filter(([id]) => !only || id === only).map(async ([id, who]) => {
    try {
      const r = await p.generate({ prompt: `${who} ${LOOK}`, quality: 'medium', size: '1024x1024', timeoutMs: 180_000 });
      cents += r.costCents;
      await writeFile(`${out}/${id}.png`, Buffer.from(r.imageUrl.slice(r.imageUrl.indexOf(',') + 1), 'base64'));
      console.log('ok', id, `${r.costCents.toFixed(1)}c`, `${Math.round(r.durationMs / 1000)}s`);
    } catch (e) { console.log('FAILED', id, String(e).slice(0, 200)); }
  }));
  console.log(`portraits spend: ${cents.toFixed(1)}c`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
