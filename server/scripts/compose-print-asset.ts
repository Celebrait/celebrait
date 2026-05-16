// server/scripts/compose-print-asset.ts
//
// Compose a Prodigi-ready print asset from an existing Celebrait card.
//
// Output: ONE 6732×1713 PNG matching Prodigi's stitched-strip layout for
// `GLOBAL-GRE-MOH-6X6-DIR` / `GLOBAL-GRE-GLOS-6X6-DIR` (and the
// equivalent `-BLA` self-send variants):
//
//   ┌────────────┬────────────┬──CUT──┬──────────────┬──────────────┐
//   │            │            │       │              │              │
//   │   PANEL 0  │   PANEL 1  │       │   PANEL 2    │   PANEL 3    │
//   │  outer     │  outer     │       │  inside      │  inner       │
//   │  rear      │  front     │       │  front       │  back        │
//   │  (back)    │  (cover)   │       │  (left when  │  (right when │
//   │            │            │       │   opened)    │   opened)    │
//   │            │            │       │              │              │
//   └────────────┴────────────┴───────┴──────────────┴──────────────┘
//        1683          1683                  1683           1683
//
// Prodigi prints the strip, cuts at the CUT line into two halves, bonds
// them back-to-back, folds once down the middle → finished card.
//
// USAGE:
//   npx tsx server/scripts/compose-print-asset.ts <cardId> [options]
//
// Options:
//   --mode <direct|self-send>   Inside layout. Default: direct.
//   --front <path>              Override the front image source. Default:
//                               looks up card_<id>_front_print.png (preferred,
//                               3000×3000 upscale) then card_<id>_front.png.
//   --inside <path>             Override the inside image source.
//
// Examples:
//   npx tsx server/scripts/compose-print-asset.ts 109
//   npx tsx server/scripts/compose-print-asset.ts 112 \
//     --front stored_images/card_112_front_a21.png \
//     --inside stored_images/card_112_inside_a23.png
//
// The override flags are how you target a specific attempt (e.g. the
// "original" first attempt vs a regen). Without overrides, the script
// uses whatever's currently selected in the Studio's regen view.
//
// Output:
//   dist/print-samples/card_<id>_print.png
//
// Modes (V1 — minimal; production compositor in the Prodigi adapter
// will be richer):
//   • direct    — Panels 2+3 = full inside spread (left half blank,
//                  right half = the inside message). Mirrors current
//                  Celebrait output.
//   • self-send — Panels 2+3 = blank cream both sides (placeholder —
//                  proper Self-Send needs the new decorative-no-text
//                  inside variant from the Self-Send mode work which
//                  hasn't shipped yet). For sample testing today,
//                  treats inside as fully blank.
//
// Prerequisite: the card's images must exist on disk under
// stored_images/. The print-resolution `_print` variant is preferred
// when present (3000×3000 Lanczos upscale); falls back to the
// canonical display image.

import 'dotenv/config';
import path from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { cards, users } from '@shared/schema';

// Canvas + panel geometry (Prodigi's recommended size from the basket UI).
const CANVAS_W = 6732;
const CANVAS_H = 1713;
const PANEL_W = Math.floor(CANVAS_W / 4); // 1683
const PANEL_H = CANVAS_H;
const PANEL_OFFSETS = {
  outerRear: 0,
  outerFront: PANEL_W,
  insideFront: PANEL_W * 2,
  innerBack: PANEL_W * 3,
};

// Cream paper background — matches card-blank.svg's lightest tone so
// blank panels don't read as white-printer-paper against the printed
// scene panels.
const CREAM_RGB = { r: 251, g: 245, b: 234 };

const IMAGES_DIR = path.join(process.cwd(), 'stored_images');
const OUT_DIR = path.join(process.cwd(), 'dist', 'print-samples');

interface CardAssets {
  cardId: number;
  frontPath: string;
  insidePath: string | null;
  /** Sender's first name, if captured at signup (PR1 Phase C welcome
   *  step). Drives the back-of-card signed credit. */
  senderFirstName: string | null;
}

/** Resolve disk paths to the printable images for a card. Prefers
 *  the print-resolution `_print` variant (3000×3000 Lanczos upscale)
 *  when available, falls back to the canonical display image. Also
 *  looks up the sender's firstName for the back-of-card signed credit.
 *
 *  Override paths (frontOverride / insideOverride) bypass the default
 *  resolution — used to target a specific attempt (e.g. the original
 *  first attempt vs a regen). The script verifies the override file
 *  exists; doesn't trust the user's path blindly. */
async function resolveCardAssets(
  cardId: number,
  frontOverride?: string,
  insideOverride?: string,
): Promise<CardAssets> {
  const candidates = (side: 'front' | 'inside') => [
    path.join(IMAGES_DIR, `card_${cardId}_${side}_print.png`),
    path.join(IMAGES_DIR, `card_${cardId}_${side}.png`),
  ];

  const pickFirst = async (paths: string[]): Promise<string | null> => {
    for (const p of paths) {
      try {
        await fs.access(p);
        return p;
      } catch {
        /* not found, try next */
      }
    }
    return null;
  };

  // Front override (verified to exist) takes priority over default lookup.
  let frontPath: string | null = null;
  if (frontOverride) {
    const abs = path.isAbsolute(frontOverride)
      ? frontOverride
      : path.join(process.cwd(), frontOverride);
    try {
      await fs.access(abs);
      frontPath = abs;
    } catch {
      throw new Error(`--front override file not found: ${frontOverride}`);
    }
  } else {
    frontPath = await pickFirst(candidates('front'));
  }
  if (!frontPath) {
    throw new Error(
      `No front image found for card ${cardId}. Looked for: ${candidates('front').join(', ')}`,
    );
  }

  // Inside override — same shape; nullable (cards without inside fall
  // through to a blank cream panel).
  let insidePath: string | null;
  if (insideOverride) {
    const abs = path.isAbsolute(insideOverride)
      ? insideOverride
      : path.join(process.cwd(), insideOverride);
    try {
      await fs.access(abs);
      insidePath = abs;
    } catch {
      throw new Error(`--inside override file not found: ${insideOverride}`);
    }
  } else {
    insidePath = await pickFirst(candidates('inside'));
  }

  // Sender lookup — drives the back-of-card signed credit.
  // Looks up the user's firstName (captured at signup, PR1 Phase C).
  // If missing, the back panel falls back to a plain "Made with
  // Celebrait" wordmark — same as Card3DViewer's default backCredit.
  //
  // The portrait-on-the-back idea was scrapped 2026-04-30 — Kevin's
  // call after seeing the rendered output: name alone is enough,
  // portrait felt over-engineered. Schema column users.portraitPhotoId
  // is left in place (cheap, defensive) but unused.
  const cardRows = await db
    .select({ userId: cards.userId })
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  let senderFirstName: string | null = null;
  const userId = cardRows[0]?.userId;
  if (userId) {
    const userRows = await db
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    senderFirstName = userRows[0]?.firstName?.trim() || null;
  }

  return { cardId, frontPath, insidePath, senderFirstName };
}

/** Build a panel-sized buffer from a source image, scaled to fit
 *  PANEL_W × PANEL_H with `cover` semantics (fills the panel; crops
 *  edges if aspect ratios differ). Returns the raw buffer suitable
 *  for sharp.composite(). */
async function panelFromImage(srcPath: string): Promise<Buffer> {
  return sharp(srcPath)
    .resize(PANEL_W, PANEL_H, {
      fit: 'cover',
      position: 'centre',
    })
    .png()
    .toBuffer();
}

/** Build a cream-coloured panel buffer at the standard panel size.
 *  Used for the inside-left blank-for-handwriting panel. */
async function blankPanel(): Promise<Buffer> {
  return sharp({
    create: {
      width: PANEL_W,
      height: PANEL_H,
      channels: 3,
      background: CREAM_RGB,
    },
  })
    .png()
    .toBuffer();
}

/** Build the back-of-card panel — the rear surface visible when the
 *  finished card is closed. Two render modes:
 *
 *    1. Signed credit (when sender has firstName captured). Centred
 *       three-line block:
 *           "DESIGNED WITH CRAFT BY"
 *               "{First Name}"
 *           "USING CELEBRAIT"
 *
 *    2. Wordmark fallback (when no firstName). Just centred
 *       "Made with Celebrait" — same as Card3DViewer's default
 *       backCredit.
 *
 *  Portrait was scrapped 2026-04-30 — felt over-engineered, name alone
 *  carries the personal touch. Typography rendered via SVG composited
 *  onto the cream base. Generic sans-serif (Helvetica) for small-caps,
 *  Georgia italic for the name — works without bundling a custom font.
 *  The Prodigi adapter Phase 2 production build can swap to Inter once
 *  we ship a font asset. */
async function backPanel(opts: {
  senderFirstName: string | null;
}): Promise<Buffer> {
  const hasName = !!opts.senderFirstName;

  // Cream base.
  const base = sharp({
    create: {
      width: PANEL_W,
      height: PANEL_H,
      channels: 3,
      background: CREAM_RGB,
    },
  });

  if (hasName) {
    // Three-line vertically-centred signed credit.
    const SMALLCAPS_SIZE = 32;
    const NAME_SIZE = 88;
    const SMALL_LINE_GAP = 28;
    const NAME_LINE_GAP = 36;
    // Total block height (sum of all line heights + gaps).
    const BLOCK_HEIGHT =
      SMALLCAPS_SIZE +
      SMALL_LINE_GAP +
      NAME_SIZE +
      NAME_LINE_GAP +
      SMALLCAPS_SIZE;
    // y-offset to centre the block vertically on the panel.
    const BLOCK_TOP = Math.round((PANEL_H - BLOCK_HEIGHT) / 2);

    const textSvg = `
      <svg width="${PANEL_W}" height="${BLOCK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .smallcaps {
            font-family: Helvetica, Arial, sans-serif;
            font-size: ${SMALLCAPS_SIZE}px;
            font-weight: 500;
            letter-spacing: 4px;
            fill: #5c4938;
            text-anchor: middle;
          }
          .name {
            font-family: Georgia, "Times New Roman", serif;
            font-size: ${NAME_SIZE}px;
            font-style: italic;
            font-weight: 400;
            fill: #2d1f12;
            text-anchor: middle;
          }
        </style>
        <text x="${PANEL_W / 2}" y="${SMALLCAPS_SIZE}" class="smallcaps">DESIGNED WITH CRAFT BY</text>
        <text x="${PANEL_W / 2}" y="${SMALLCAPS_SIZE + SMALL_LINE_GAP + NAME_SIZE}" class="name">${escapeXml(opts.senderFirstName!)}</text>
        <text x="${PANEL_W / 2}" y="${SMALLCAPS_SIZE + SMALL_LINE_GAP + NAME_SIZE + NAME_LINE_GAP + SMALLCAPS_SIZE}" class="smallcaps">USING CELEBRAIT</text>
      </svg>
    `;

    return base
      .composite([
        {
          input: Buffer.from(textSvg),
          top: BLOCK_TOP,
          left: 0,
        },
      ])
      .png()
      .toBuffer();
  }

  // Fallback: wordmark, centred vertically.
  const WORDMARK_SIZE = 64;
  const wordmarkSvg = `
    <svg width="${PANEL_W}" height="${PANEL_H}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .wordmark {
          font-family: Georgia, "Times New Roman", serif;
          font-size: ${WORDMARK_SIZE}px;
          font-weight: 700;
          fill: #5c4938;
          text-anchor: middle;
          letter-spacing: 2px;
        }
      </style>
      <text x="${PANEL_W / 2}" y="${PANEL_H / 2}" class="wordmark">Made with Celebrait</text>
    </svg>
  `;
  return base
    .composite([{ input: Buffer.from(wordmarkSvg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

/** Minimal XML escape for the user's firstName when interpolated into
 *  the SVG. Names rarely contain XML metacharacters but we don't trust
 *  them. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Compose the full 6732×1713 strip for a given card + mode. */
async function composeStrip(
  assets: CardAssets,
  mode: 'direct' | 'self-send',
): Promise<Buffer> {
  // Build each panel.
  // Outer rear (back of finished card): name-only signed credit if
  // captured at signup; wordmark fallback otherwise.
  const rearBuf = await backPanel({
    senderFirstName: assets.senderFirstName,
  });
  const frontBuf = await panelFromImage(assets.frontPath);

  let insideFrontBuf: Buffer;
  let innerBackBuf: Buffer;

  if (mode === 'direct') {
    // Direct delivery: blank-left + message-right (Kevin's V1
    // default — blank-left preserves room the recipient can use).
    // If the card has no inside image, both inside panels go cream.
    insideFrontBuf = await blankPanel();
    innerBackBuf = assets.insidePath
      ? await panelFromImage(assets.insidePath)
      : await blankPanel();
  } else {
    // Self-send: both inside panels blank cream (proper decorative
    // Self-Send variant ships with the Self-Send sprint; this is the
    // placeholder for sample-order testing today).
    insideFrontBuf = await blankPanel();
    innerBackBuf = await blankPanel();
  }

  // Compose onto a single 6732×1713 cream canvas.
  return sharp({
    create: {
      width: CANVAS_W,
      height: CANVAS_H,
      channels: 3,
      background: CREAM_RGB,
    },
  })
    .composite([
      { input: rearBuf, top: 0, left: PANEL_OFFSETS.outerRear },
      { input: frontBuf, top: 0, left: PANEL_OFFSETS.outerFront },
      { input: insideFrontBuf, top: 0, left: PANEL_OFFSETS.insideFront },
      { input: innerBackBuf, top: 0, left: PANEL_OFFSETS.innerBack },
    ])
    .png()
    .toBuffer();
}

async function main() {
  const cardIdArg = process.argv[2];
  if (!cardIdArg || !/^\d+$/.test(cardIdArg)) {
    console.error('Usage: npx tsx server/scripts/compose-print-asset.ts <cardId> [--mode direct|self-send] [--front <path>] [--inside <path>]');
    process.exit(1);
  }
  const cardId = parseInt(cardIdArg, 10);

  // Parse mode flag.
  const modeIdx = process.argv.indexOf('--mode');
  const modeArg = modeIdx >= 0 ? process.argv[modeIdx + 1] : 'direct';
  if (modeArg !== 'direct' && modeArg !== 'self-send') {
    console.error(`Invalid --mode "${modeArg}". Use 'direct' or 'self-send'.`);
    process.exit(1);
  }
  const mode = modeArg as 'direct' | 'self-send';

  // Parse --front / --inside overrides. Absolute or relative-to-cwd
  // paths both accepted. Bypass the default-file resolution so we can
  // target a specific attempt (e.g. the original first attempt vs a
  // regen).
  const frontIdx = process.argv.indexOf('--front');
  const frontOverride = frontIdx >= 0 ? process.argv[frontIdx + 1] : undefined;
  const insideIdx = process.argv.indexOf('--inside');
  const insideOverride = insideIdx >= 0 ? process.argv[insideIdx + 1] : undefined;

  // Verify the card exists in DB (sanity — also gives a useful error
  // when the user typos an id).
  const cardRows = await db
    .select({ id: cards.id, status: cards.status })
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  if (cardRows.length === 0) {
    console.error(`Card ${cardId} not found in database.`);
    process.exit(1);
  }
  if (cardRows[0].status !== 'completed') {
    console.warn(
      `⚠ Card ${cardId} status is "${cardRows[0].status}" (not completed). Composing anyway, but the front/inside images may be missing.`,
    );
  }

  console.log(`[COMPOSE] Resolving assets for card ${cardId}…`);
  const assets = await resolveCardAssets(cardId, frontOverride, insideOverride);
  console.log(`  front:  ${path.relative(process.cwd(), assets.frontPath)}`);
  console.log(`  inside: ${assets.insidePath ? path.relative(process.cwd(), assets.insidePath) : '(none — will use blank cream)'}`);
  console.log(`  sender: ${assets.senderFirstName ?? '(no firstName — back falls back to wordmark)'}`);

  console.log(`[COMPOSE] Building 6732×1713 strip in '${mode}' mode…`);
  const strip = await composeStrip(assets, mode);

  await fs.mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `card_${cardId}_${mode}_print.png`);
  await fs.writeFile(outPath, strip);

  console.log('');
  console.log(`✓ Wrote ${path.relative(process.cwd(), outPath)}`);
  console.log(`  ${(strip.length / 1024).toFixed(0)} KB`);
  console.log('');
  console.log('Upload this PNG to Prodigi as the print asset for the SKU.');
  console.log('Layout: outer-rear | outer-front | inside-front | inner-back.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Compose failed:', err?.message ?? err);
  process.exit(1);
});
