// server/scripts/test-prodigi-order.ts
//
// Verifies the two seams of the Prodigi print path that can be exercised
// WITHOUT R2 (local dev has no public bucket):
//
//   1. Compositor — build the 6732×1713 four-panel strip from a real card's
//      on-disk front + inside images; assert the dimensions Prodigi expects.
//   2. Prodigi API contract — POST a SANDBOX order for the real SKU with a
//      single "default" asset (a public sample image) and read status back.
//
// The one seam this can't cover locally — "the composed strip lives on a
// public R2 URL Prodigi can fetch" — is trivially true once R2 is enabled
// (public bucket) and is exercised by a real prod paid order.
//
//   PRODIGI_API_KEY=... npx tsx server/scripts/test-prodigi-order.ts [cardId]

import 'dotenv/config';
import path from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { composeCardPrintStrip } from '../studio/print-compositor';

const IMAGES_DIR = path.join(process.cwd(), 'stored_images');
const OUT_DIR = path.join(process.cwd(), 'dist', 'print-samples');
const SKU = process.env.PRODIGI_CARD_SKU ?? 'GLOBAL-GRE-GLOS-6X6-DIR';
const BASE_URL = (
  process.env.PRODIGI_BASE_URL ?? 'https://api.sandbox.prodigi.com/v4.0'
).replace(/\/+$/, '');

async function readIfExists(p: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

async function testCompositor(cardId: number) {
  console.log(`\n── 1. Compositor (card ${cardId}) ──`);
  const front =
    (await readIfExists(path.join(IMAGES_DIR, `card_${cardId}_front_print.png`))) ??
    (await readIfExists(path.join(IMAGES_DIR, `card_${cardId}_front.png`)));
  if (!front) throw new Error(`No front image on disk for card ${cardId}`);
  const inside =
    (await readIfExists(path.join(IMAGES_DIR, `card_${cardId}_inside_print.png`))) ??
    (await readIfExists(path.join(IMAGES_DIR, `card_${cardId}_inside.png`)));

  const strip = await composeCardPrintStrip({
    frontBuffer: front,
    insideBuffer: inside,
    senderFirstName: 'Kevin',
  });
  const meta = await sharp(strip).metadata();
  await fs.mkdir(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `card_${cardId}_runtime_strip.png`);
  await fs.writeFile(out, strip);

  console.log(`  inside image: ${inside ? 'present' : 'none (blank cream)'}`);
  console.log(`  strip: ${meta.width}×${meta.height}, ${(strip.length / 1024).toFixed(0)} KB → ${path.relative(process.cwd(), out)}`);
  if (meta.width !== 6732 || meta.height !== 1713) {
    throw new Error(`Strip dimensions ${meta.width}×${meta.height} ≠ expected 6732×1713`);
  }
  console.log('  ✓ dimensions match Prodigi "default" print area');
}

async function testProdigiApi() {
  console.log('\n── 2. Prodigi API contract (sandbox order) ──');
  const apiKey = process.env.PRODIGI_API_KEY;
  if (!apiKey) throw new Error('PRODIGI_API_KEY not set');

  // Public sample image for the single "default" asset (local strip isn't
  // publicly fetchable). Wide to match the print area aspect.
  const sampleAsset = 'https://picsum.photos/6732/1712';

  const body = {
    merchantReference: 'test-contract-order',
    shippingMethod: 'Standard',
    recipient: {
      name: 'Test Recipient',
      address: {
        line1: '1 Test Street',
        postalOrZipCode: 'EC1A 1BB',
        countryCode: 'GB',
        townOrCity: 'London',
      },
    },
    items: [
      {
        merchantReference: 'card-test',
        sku: SKU,
        copies: 1,
        sizing: 'fillPrintArea',
        assets: [{ printArea: 'default', url: sampleAsset }],
      },
    ],
  };

  const res = await fetch(`${BASE_URL}/Orders`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json: any = await res.json();
  console.log(`  POST /Orders → HTTP ${res.status}, outcome=${json?.outcome}`);
  const orderId = json?.order?.id;
  if (!orderId) {
    console.log('  response:', JSON.stringify(json).slice(0, 600));
    throw new Error('No order id returned — SKU/asset contract rejected');
  }
  console.log(`  ✓ order created: ${orderId}, stage=${json?.order?.status?.stage}`);

  const statusRes = await fetch(`${BASE_URL}/Orders/${encodeURIComponent(orderId)}`, {
    headers: { 'X-API-Key': apiKey },
  });
  const statusJson: any = await statusRes.json();
  console.log(`  GET /Orders/${orderId} → outcome=${statusJson?.outcome}, stage=${statusJson?.order?.status?.stage}`);
}

async function main() {
  const cardId = process.argv[2] ? parseInt(process.argv[2], 10) : 229;
  await testCompositor(cardId);
  await testProdigiApi();
  console.log('\n✓ Both seams verified.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✗ Test failed:', err?.message ?? err);
  process.exit(1);
});
