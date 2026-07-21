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
import path from "path";
import fs from "fs";

const CANVAS_W = 6732;
const CANVAS_H = 1713;
const PANEL_W = Math.floor(CANVAS_W / 4); // 1683
const PANEL_H = CANVAS_H;

// ── Brand logo overlay (Kevin 2026-07-05: logo on the inside-left
// panel — matching the 3D render — and on the rear). Sizing mirrors
// the render's cover-back texture: ~24% of the face width, sitting
// ~6% off the bottom edge, centred.
const LOGO_W = Math.round(PANEL_W * 0.24);
const LOGO_BOTTOM_MARGIN = Math.round(PANEL_H * 0.06);

let logoOverlayPromise:
  | Promise<{ input: Buffer; top: number; left: number } | null>
  | null = null;

/** Load + size the celebrait logo once per process. Resolution is
 *  defensive because dev (tsx, this file at server/studio/) and prod
 *  (esbuild bundle at dist/index.js) sit at different depths. A
 *  missing logo must NEVER fail an order — we warn and print the
 *  panels unbranded instead. */
function loadLogoOverlay() {
  if (!logoOverlayPromise) {
    logoOverlayPromise = (async () => {
      try {
        const candidates = [
          // dev: server/studio/ → repo root
          path.resolve(import.meta.dirname, "..", "..", "client", "src", "assets", "celebrait.png"),
          // prod: dist/ → repo root
          path.resolve(import.meta.dirname, "..", "client", "src", "assets", "celebrait.png"),
        ];
        const file = candidates.find((p) => fs.existsSync(p));
        if (!file) {
          console.warn("[print-compositor] celebrait.png not found — printing unbranded panels");
          return null;
        }
        const input = await sharp(file).resize(LOGO_W).png().toBuffer();
        const meta = await sharp(input).metadata();
        return {
          input,
          top: PANEL_H - (meta.height ?? 0) - LOGO_BOTTOM_MARGIN,
          left: Math.round((PANEL_W - LOGO_W) / 2),
        };
      } catch (err) {
        console.warn("[print-compositor] logo overlay failed — printing unbranded panels", err);
        return null;
      }
    })();
  }
  return logoOverlayPromise;
}
const OFFSETS = {
  outerRear: 0,
  outerFront: PANEL_W,
  insideFront: PANEL_W * 2,
  innerBack: PANEL_W * 3,
};

// Cream background — matches the card blank's lightest tone so blank panels
// don't read as white printer paper against the printed scene panels.
const CREAM_RGB = { r: 251, g: 245, b: 234 };

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

/** Inside-left panel — clean cream, no branding. (The small celebrait logo
 *  was removed 2026-07-21 per Kevin so the printed card's inside reads like
 *  a normal card, not a branded one.) */
async function insideLeftPanel(): Promise<Buffer> {
  return blankPanel();
}

/** Back-of-card panel — a discreet celebrait logo only. The signed
 *  "DESIGNED WITH CRAFT BY {name} USING CELEBRAIT" credit (and the no-name
 *  "Made with Celebrait" wordmark) were removed 2026-07-21 (Kevin) so the
 *  printed card back isn't self-promotional. `senderFirstName` is kept in
 *  the signature for the caller but no longer rendered. */
async function backPanel(_senderFirstName: string | null): Promise<Buffer> {
  const logo = await loadLogoOverlay();
  const base = sharp({
    create: { width: PANEL_W, height: PANEL_H, channels: 3, background: CREAM_RGB },
  });
  if (!logo) return base.png().toBuffer();
  return base.composite([logo]).png().toBuffer();
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
 *  is blank cream with the brand logo small at the bottom (matching the
 *  3D render); the inside artwork sits on the right. */
export async function composeCardPrintStrip(opts: ComposeStripOpts): Promise<Buffer> {
  const rearBuf = await backPanel(opts.senderFirstName ?? null);
  const frontBuf = await panelFromBuffer(opts.frontBuffer);
  const insideFrontBuf = await insideLeftPanel(); // left half — cream + logo
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
