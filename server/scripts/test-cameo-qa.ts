// server/scripts/test-cameo-qa.ts
//
// Does the cameo QA pass actually DISCRIMINATE? (Aidan 2026-09-12:
// "can we get an image check on each one to ensure the image is not
// messed up?")
//
// A checker that says "good" to everything is worse than no checker, so
// this runs the real assessor over a matched pair:
//
//   GOOD  — hero-source-photo.webp (a real photo of a couple) against
//           hero-card-front.webp (that same couple properly REDRAWN
//           into an illustrated rooftop scene). Must come back "drawn".
//   BAD   — the same photo against the same card with a raw rectangle
//           of the photograph composited on top: the "just looks
//           plonked on there poorly" failure, manufactured. Must come
//           back "pasted".
//
// The trap this guards against: these cards are deliberately stylised,
// so a naive "does it match the photo?" check scores the BEST output
// worst. If GOOD ever starts failing, the prompt has drifted into
// penalising style — read the note in server/photos/analyze.ts.
//
//   npx tsx server/scripts/test-cameo-qa.ts

import 'dotenv/config';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { assessCameoRender } from '../photos/analyze';

const PUB = path.resolve(process.cwd(), 'client/public');

async function main() {
  const photo = await fs.readFile(path.join(PUB, 'hero-source-photo.webp'));
  const card = await fs.readFile(path.join(PUB, 'hero-card-front.webp'));

  // Manufacture the "plonked on" failure: a raw photographic crop,
  // hard-edged, dropped straight onto the finished card.
  const meta = await sharp(card).metadata();
  const w = meta.width ?? 1024;
  const patch = await sharp(photo).resize(Math.round(w * 0.42)).png().toBuffer();
  const pasted = await sharp(card)
    .composite([{ input: patch, top: Math.round((meta.height ?? 1024) * 0.30), left: Math.round(w * 0.08) }])
    .png()
    .toBuffer();
  await fs.writeFile('/tmp/cameo-qa-pasted.png', pasted);

  const cases: Array<{ name: string; bytes: Buffer; mime: string; expect: string }> = [
    { name: 'GOOD  (properly redrawn)', bytes: card, mime: 'image/webp', expect: 'drawn' },
    { name: 'BAD   (photo pasted on)', bytes: pasted, mime: 'image/png', expect: 'pasted' },
  ];

  let pass = 0;
  for (const c of cases) {
    const { result, raw, durationMs, noApiKey } = await assessCameoRender({
      cardBytes: c.bytes, cardMimeType: c.mime,
      photoBytes: photo, photoMimeType: 'image/webp',
    });
    if (noApiKey) { console.log('NO GEMINI_API_KEY — cannot test'); break; }
    const got = result?.integration ?? '(no verdict)';
    const ok = got === c.expect;
    if (ok) pass += 1;
    console.log(`${ok ? '✅' : '❌'} ${c.name}`);
    console.log(`   integration=${got} (expected ${c.expect}) · anatomy=${result?.anatomy ?? '?'} · verdict=${result?.verdict ?? '?'} · ${durationMs}ms`);
    if (result?.issue) console.log(`   issue: "${result.issue}"`);
    if (!result) console.log(`   raw: ${raw.slice(0, 200)}`);
  }
  console.log(`\n${pass}/${cases.length} discriminated correctly.`);
  console.log('The manufactured failure is at /tmp/cameo-qa-pasted.png if you want to eyeball it.');
  // Bench scripts settle before exit (project_seam_ledger_and_style_floors).
  await new Promise((r) => setTimeout(r, 2000));
}

main().catch((e) => { console.error(e); process.exit(1); });
