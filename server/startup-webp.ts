// server/startup-webp.ts — TEMPLATE DISPLAY-WEBP BACKFILL (2026-09-06)
//
// The 3D viewer loads `<name>.webp` next to every card PNG (the display
// sibling image-storage writes for generated cards). Rack TEMPLATES were
// saved without one, so every template card — on the card pages and the
// gate's wall — fell back to the flat PNG. This pass fills the gap for
// existing templates; new ones get the sibling at save time.
//
// Idempotent and cheap: for each template image that has no .webp yet,
// read the PNG, encode, write. Runs after boot, never blocks it, and a
// failure on one image is logged and skipped.

import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { db } from './db';
import { cardTemplates } from '@shared/schema';
import { isR2Enabled, r2Get, r2Put } from './r2-storage';

const LOCAL = path.join(process.cwd(), 'stored_images');

async function hasLocal(name: string): Promise<boolean> {
  try { await fs.access(path.join(LOCAL, name)); return true; } catch { return false; }
}

/** Returns true when a webp was written, false when it already existed
 *  or the PNG is missing. Throws on encode/write failure. */
async function ensureWebp(pngName: string): Promise<boolean> {
  if (!/\.png$/i.test(pngName)) return false;
  const webpName = pngName.replace(/\.png$/i, '.webp');
  if (isR2Enabled()) {
    if (await r2Get(webpName)) return false;
    const png = await r2Get(pngName);
    if (!png) return false;
    const webp = await sharp(png).webp({ quality: 80 }).toBuffer();
    await r2Put(webpName, webp, 'image/webp');
    return true;
  }
  if (await hasLocal(webpName)) return false;
  if (!(await hasLocal(pngName))) return false;
  const webp = await sharp(await fs.readFile(path.join(LOCAL, pngName))).webp({ quality: 80 }).toBuffer();
  await fs.writeFile(path.join(LOCAL, webpName), webp);
  return true;
}

export async function runStartupWebpBackfill(): Promise<void> {
  try {
    const rows = await db.select({ id: cardTemplates.id, front: cardTemplates.image_path, inside: cardTemplates.inside_image_path }).from(cardTemplates);
    let written = 0;
    let failed = 0;
    for (const r of rows) {
      for (const name of [r.front, r.inside]) {
        if (!name) continue;
        try { if (await ensureWebp(name.replace(/^\/images\//, ''))) written++; }
        catch (err) { failed++; console.warn(`[WEBP] template ${r.id} ${name}:`, (err as Error)?.message ?? err); }
      }
    }
    console.log(written || failed
      ? `[WEBP] template display siblings: wrote ${written}${failed ? `, ${failed} failed` : ''}`
      : '[WEBP] template display siblings: nothing to do');
  } catch (err) {
    console.warn('[WEBP] backfill skipped:', (err as Error)?.message ?? err);
  }
}
