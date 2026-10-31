// scripts/check-card-image-cors.mjs
//
// Build-time guard against the CORS cache-poisoning bug (see
// client/src/components/card-image.tsx for the full explanation). Fails if
// any bare <img> renders an R2 CARD image without crossOrigin — which would
// poison that url's cache entry and blank the 3D card / show a broken "?".
//
// PASS if a card image is rendered via <CardImage> (always crossOrigin) OR
// a bare <img …crossOrigin…>. FAIL only for a bare <img> with a card-image
// src and no crossOrigin. Runs in `npm run check`.
//
// Heuristic on purpose: it flags <img> whose src references a known
// card-image identifier. Over-matching (e.g. a same-origin bundled image)
// is harmless — crossOrigin on a same-origin image is a no-op — so when in
// doubt the fix is always "add crossOrigin (or use <CardImage>)".

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'client', 'src');

// src expressions that mean "this is an R2 card image".
const CARD_SRC = /\b(frontImageUrl|insideImageUrl|frontUrl|insideUrl|heroUrl|imageUrl)\b|card_\w/;

/** Recursively collect .tsx files. */
function tsxFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...tsxFiles(p));
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const violations = [];

for (const file of tsxFiles(ROOT)) {
  const text = readFileSync(file, 'utf8');
  // Match each <img …> tag (non-greedy to the first '>'; img attrs don't
  // contain a literal '>', so this is safe for JSX in practice).
  const re = /<img\b[\s\S]*?>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const tag = m[0];
    if (!CARD_SRC.test(tag)) continue; // not a card image → ignore
    if (/crossorigin/i.test(tag)) continue; // already CORS-safe
    const line = text.slice(0, m.index).split('\n').length;
    const rel = file.slice(file.indexOf('client/src'));
    const srcExpr = (tag.match(/src=\{?["']?([^}"'\s>]+)/) || [, '?'])[1];
    violations.push({ rel, line, srcExpr });
  }
}

if (violations.length > 0) {
  console.error(
    `\n✗ card-image CORS check FAILED — ${violations.length} bare <img> of a card image without crossOrigin.\n` +
      `  These will poison the R2 cache and blank the 3D card / show a broken "?".\n` +
      `  Fix: render it with <CardImage> (client/src/components/card-image.tsx), or add crossOrigin="anonymous".\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  <img src={${v.srcExpr}} …>`);
  }
  console.error('');
  process.exit(1);
}

console.log('✓ card-image CORS check passed — every card <img> is crossOrigin-safe.');
