// server/studio/print-compositor.ts
//
// Runtime version of scripts/compose-print-asset.ts. Composes a Celebrait
// card's front + inside images into the SINGLE image Prodigi's greeting-card
// SKUs expect for their one "default" print area — a 6732×1713 four-panel
// strip:
//
//   ┌───────────┬───────────┬──CUT──┬───────────┬───────────┐
//   │ outer-rear│ outer-front│       │inside-front│ inner-back│
//   │  (back)   │  (cover)  │       │ (blank L) │ (message) │
//   └───────────┴───────────┴───────┴───────────┴───────────┘
//        1683        1683                1683        1683
//
// Prodigi prints the strip, cuts at the middle, bonds back-to-back and
// folds once → the finished 5.5" square card.
//
// Buffer-in, buffer-out (no disk / no CLI) so it can run inside the Prodigi
// provider at order time, sourcing images from R2.

import sharp from "sharp";

const CANVAS_W = 6732;
const CANVAS_H = 1713;
const PANEL_W = Math.floor(CANVAS_W / 4); // 1683
const PANEL_H = CANVAS_H;
const OFFSETS = {
  outerRear: 0,
  outerFront: PANEL_W,
  insideFront: PANEL_W * 2,
  innerBack: PANEL_W * 3,
};

// Cream background — matches the card blank's lightest tone so blank panels
// don't read as white printer paper against the printed scene panels.
const CREAM_RGB = { r: 251, g: 245, b: 234 };

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Scale a source image to fill a panel (cover semantics — crops edges if
 *  aspect ratios differ). */
async function panelFromBuffer(src: Buffer): Promise<Buffer> {
  return sharp(src)
    .resize(PANEL_W, PANEL_H, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

async function blankPanel(): Promise<Buffer> {
  return sharp({
    create: { width: PANEL_W, height: PANEL_H, channels: 3, background: CREAM_RGB },
  })
    .png()
    .toBuffer();
}

/** Back-of-card panel — signed credit when the sender has a firstName,
 *  else a "Made with Celebrait" wordmark. Typography via composited SVG. */
async function backPanel(senderFirstName: string | null): Promise<Buffer> {
  const base = sharp({
    create: { width: PANEL_W, height: PANEL_H, channels: 3, background: CREAM_RGB },
  });

  if (senderFirstName) {
    const SMALLCAPS_SIZE = 32;
    const NAME_SIZE = 88;
    const SMALL_LINE_GAP = 28;
    const NAME_LINE_GAP = 36;
    const BLOCK_HEIGHT =
      SMALLCAPS_SIZE + SMALL_LINE_GAP + NAME_SIZE + NAME_LINE_GAP + SMALLCAPS_SIZE;
    const BLOCK_TOP = Math.round((PANEL_H - BLOCK_HEIGHT) / 2);
    const textSvg = `
      <svg width="${PANEL_W}" height="${BLOCK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .smallcaps { font-family: Helvetica, Arial, sans-serif; font-size: ${SMALLCAPS_SIZE}px; font-weight: 500; letter-spacing: 4px; fill: #5c4938; text-anchor: middle; }
          .name { font-family: Georgia, "Times New Roman", serif; font-size: ${NAME_SIZE}px; font-style: italic; font-weight: 400; fill: #2d1f12; text-anchor: middle; }
        </style>
        <text x="${PANEL_W / 2}" y="${SMALLCAPS_SIZE}" class="smallcaps">DESIGNED WITH CRAFT BY</text>
        <text x="${PANEL_W / 2}" y="${SMALLCAPS_SIZE + SMALL_LINE_GAP + NAME_SIZE}" class="name">${escapeXml(senderFirstName)}</text>
        <text x="${PANEL_W / 2}" y="${SMALLCAPS_SIZE + SMALL_LINE_GAP + NAME_SIZE + NAME_LINE_GAP + SMALLCAPS_SIZE}" class="smallcaps">USING CELEBRAIT</text>
      </svg>`;
    return base
      .composite([{ input: Buffer.from(textSvg), top: BLOCK_TOP, left: 0 }])
      .png()
      .toBuffer();
  }

  const WORDMARK_SIZE = 64;
  const wordmarkSvg = `
    <svg width="${PANEL_W}" height="${PANEL_H}" xmlns="http://www.w3.org/2000/svg">
      <style>.wordmark { font-family: Georgia, "Times New Roman", serif; font-size: ${WORDMARK_SIZE}px; font-weight: 700; fill: #5c4938; text-anchor: middle; letter-spacing: 2px; }</style>
      <text x="${PANEL_W / 2}" y="${PANEL_H / 2}" class="wordmark">Made with Celebrait</text>
    </svg>`;
  return base
    .composite([{ input: Buffer.from(wordmarkSvg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export interface ComposeStripOpts {
  frontBuffer: Buffer;
  /** The card's inside artwork — a decorative border matching the front,
   *  generated for EVERY card. If the sender wrote a message it's baked
   *  into this image as typography; if they left it blank the centre is
   *  clear for handwriting. Either way the compositor just places it. Null
   *  only for legacy/edge cards with no inside at all → blank cream. */
  insideBuffer: Buffer | null;
  senderFirstName?: string | null;
}

/** Compose the full 6732×1713 Prodigi print strip.
 *
 *  Layout is the same regardless of delivery mode (DIR vs BLA): the SKU
 *  differs (packaging), and whether a written message is present is baked
 *  into `insideBuffer` at generation time — not decided here. Inside-left
 *  stays blank cream (the reverse of the front cover); the inside artwork
 *  sits on the right. */
export async function composeCardPrintStrip(opts: ComposeStripOpts): Promise<Buffer> {
  const rearBuf = await backPanel(opts.senderFirstName ?? null);
  const frontBuf = await panelFromBuffer(opts.frontBuffer);
  const insideFrontBuf = await blankPanel(); // left half — blank cream
  const innerBackBuf = opts.insideBuffer
    ? await panelFromBuffer(opts.insideBuffer)
    : await blankPanel();

  return sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: CREAM_RGB },
  })
    .composite([
      { input: rearBuf, top: 0, left: OFFSETS.outerRear },
      { input: frontBuf, top: 0, left: OFFSETS.outerFront },
      { input: insideFrontBuf, top: 0, left: OFFSETS.insideFront },
      { input: innerBackBuf, top: 0, left: OFFSETS.innerBack },
    ])
    .png()
    .toBuffer();
}
