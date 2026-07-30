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
import QRCode from "qrcode";
import opentype from "opentype.js";
import path from "path";
import fs from "fs";

const CANVAS_W = 6732;
const CANVAS_H = 1713;
const PANEL_W = Math.floor(CANVAS_W / 4); // 1683
const PANEL_H = CANVAS_H;

// ── Card-back QR (Kevin 2026-07-30) ────────────────────────────────
// The physical card is our only surface that reaches someone who has
// never heard of us, held at the exact moment it's working. The QR is
// how that becomes a signup we can actually see.
//
// It resolves to the HOMEPAGE, not /login. Whoever scans this is a cold
// recipient holding someone else's card — a bare sign-in form gives
// them no reason to care. The homepage explains the thing first.
//
// The payload is the SHORT "/c" path, which server/index.ts 302s to the
// homepage carrying the UTMs. Encoding the full UTM string here made the
// printed modules ~0.6mm — decodable in a test, marginal in a dim room
// with a smudged lens. Short payload = fewer modules = roughly double
// the module size at the same physical footprint. Attribution is
// unaffected: attribution.ts reads UTMs off location.search after the
// redirect, feeding users.attribution and /admin/analytics, so we can
// finally answer "do printed cards bring people back?"
//
// KEEP THIS AND THE /c ROUTE IN STEP — a card already in someone's
// drawer cannot be re-pointed.
const QR_TARGET = (() => {
  const origin = (process.env.PUBLIC_APP_ORIGIN ?? "https://www.celebrait.co.uk").replace(/\/+$/, "");
  return `${origin}/c`;
})();

// Kept deliberately modest — this is a card back, not a flyer — but not
// so modest it won't scan: ~26mm printed is the practical floor for a
// phone at arm's length.
// ── Back-panel stack: ONE scale, anchored to the QR ────────────────
// The QR is the only element here with a hard physical constraint —
// below ~26mm printed, phones stop reading it reliably — so it anchors
// the scale and everything else is a ratio of it. Change QR_W and the
// whole block re-proportions together instead of three magic
// percentages drifting out of relationship with each other.
const QR_W = Math.round(PANEL_W * 0.2);
// Caption is sized by TARGET WIDTH, not font size. Copy on a card back
// gets rewritten; fitting to a width means a longer line shrinks to fit
// rather than running off the edge and quietly getting trimmed. The
// WIDEST line is what gets fitted, so both lines share one size.
const CAPTION_W = Math.round(QR_W * 1.85);
const CAPTION_LINE_H = 1.28; // multiple of font size
const BACK_LOGO_W = Math.round(QR_W * 1.25);
const STACK_GAP = Math.round(QR_W * 0.22);
const STACK_BOTTOM = Math.round(PANEL_H * 0.075);

// Gradient reads left-to-right dark → brand violet, the same sweep the
// celebrait wordmark makes (sampled off the asset: it lands ~#6065dd).
// Tokens, not eyeballed hexes: keeper-ink and --go from the theme.
const INK_HEX = "#211D19";
const VIOLET_HEX = "#5c57d4";

// Two lines, and only the brand word is special (Kevin 2026-07-30):
// "Unbinnable" carries both the brand serif AND the gradient, so it
// lifts out of a line that's otherwise plain sans in flat ink. Starting
// the ramp at ink means it emerges from its neighbours rather than
// sitting there as a detached coloured word.
type CaptionRun = { text: string; font: "figtree" | "fraunces"; gradient?: boolean };
const CAPTION_LINES: CaptionRun[][] = [
  [{ text: "Create your", font: "figtree" }],
  [
    { text: "Unbinnable", font: "fraunces", gradient: true },
    { text: " Greetings Card Now", font: "figtree" },
  ],
];

// ── Brand logo overlay (Kevin 2026-07-05: logo on the inside-left
// panel — matching the 3D render — and on the rear). Sizing mirrors
// the render's cover-back texture: ~24% of the face width.
//
// Positioning is decided PER PANEL, not here, because the two panels
// want different things (Kevin 2026-07-30):
//   inside-left → bottom-centred, because it has to keep matching the
//                 3D viewer's cover-back or the on-screen preview stops
//                 agreeing with the printed card.
//   back        → dead centre of the square, with the QR at the foot.
const LOGO_W = Math.round(PANEL_W * 0.24);
const LOGO_BOTTOM_MARGIN = Math.round(PANEL_H * 0.06);

let logoOverlayPromise:
  | Promise<{ input: Buffer; width: number; height: number } | null>
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
        return { input, width: LOGO_W, height: meta.height ?? 0 };
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

/** QR pointing at QR_TARGET, rendered once per process. Same defensive
 *  contract as the logo: a QR we can't generate must NEVER fail an
 *  order — we warn and print the panel without it. */
let qrOverlayPromise: Promise<Buffer | null> | null = null;
function loadQrOverlay() {
  if (!qrOverlayPromise) {
    qrOverlayPromise = (async () => {
      try {
        // errorCorrectionLevel M survives the print + a bit of thumb; margin
        // 1 keeps the quiet zone tight since we place it on clean cream.
        // Rendered at 2x then downscaled so the module edges stay crisp at
        // 300dpi rather than aliasing against the panel.
        return await QRCode.toBuffer(QR_TARGET, {
          type: "png",
          errorCorrectionLevel: "M",
          margin: 1,
          width: QR_W * 2,
          color: { dark: "#211D19ff", light: "#FBF5EAff" },
        });
      } catch (err) {
        console.warn("[print-compositor] QR generation failed — printing back without it", err);
        return null;
      }
    })();
  }
  return qrOverlayPromise;
}

/** Brand fonts, loaded once. Files live in server/assets/fonts/ rather
 *  than being resolved out of node_modules — the compositor runs from a
 *  bundled dist/index.js in prod, and a resolution difference there
 *  would silently print cards with no call to action at all. Same
 *  defensive candidate-paths pattern as the logo.
 *
 *  Provenance: copied from @fontsource/figtree and @fontsource/fraunces
 *  (kept in package.json so the version is recorded). Re-copy from there
 *  if the brand weights ever change. */
let fontsPromise: Promise<{ figtree: opentype.Font; fraunces: opentype.Font } | null> | null = null;
function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      try {
        const read = (file: string) => {
          const candidates = [
            path.resolve(import.meta.dirname, "..", "assets", "fonts", file), // dev: server/studio/
            path.resolve(import.meta.dirname, "..", "server", "assets", "fonts", file), // prod: dist/
            path.resolve(process.cwd(), "server", "assets", "fonts", file),
          ];
          const found = candidates.find((p) => fs.existsSync(p));
          if (!found) throw new Error(`font not found: ${file}`);
          const b = fs.readFileSync(found);
          return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
        };
        return {
          figtree: read("figtree-latin-500-normal.woff"),
          fraunces: read("fraunces-latin-600-normal.woff"),
        };
      } catch (err) {
        console.warn("[print-compositor] brand fonts unavailable — printing back without the caption", err);
        return null;
      }
    })();
  }
  return fontsPromise;
}

/** Render the caption as VECTOR PATHS from the bundled brand fonts.
 *
 *  Deliberately NOT <text> in SVG: that hands glyph resolution to the
 *  container's fontconfig, which we don't control and which differs
 *  between macOS and Render's image. A missing font there prints an
 *  EMPTY strip onto a card someone paid for. Converting to outlines
 *  ourselves means what we measure here is exactly what prints.
 *
 *  Mixed runs (sans body + serif brand word) are laid out by advancing
 *  the pen across each line. ONE size is solved for the widest line and
 *  shared by all of them, so the block stays typographically consistent
 *  and copy length can never overflow the panel.
 *
 *  Fill is per-run: flat ink by default, with a gradient applied only to
 *  runs that ask for it, each spanning exactly its own glyphs. */
async function renderCaption(): Promise<Buffer | null> {
  try {
    const fonts = await loadFonts();
    if (!fonts) return null;

    // Measure every line at a nominal size, then solve for the size that
    // lands the WIDEST line on CAPTION_W. Sizing off the widest is what
    // keeps both lines in one optical block.
    const NOMINAL = 100;
    const nominalWidths = CAPTION_LINES.map((line) =>
      line.reduce((sum, r) => sum + fonts[r.font].getAdvanceWidth(r.text, NOMINAL), 0),
    );
    const widest = Math.max(...nominalWidths);
    if (!(widest > 0)) return null;
    const size = NOMINAL * (CAPTION_W / widest);

    // Vertical extent from the tallest ascender / deepest descender in
    // play, so a serif's overshoot can't get clipped.
    const allRuns = CAPTION_LINES.flat();
    const ascent = Math.max(
      ...allRuns.map((r) => (fonts[r.font].ascender / fonts[r.font].unitsPerEm) * size),
    );
    const descent = Math.max(
      ...allRuns.map((r) => (Math.abs(fonts[r.font].descender) / fonts[r.font].unitsPerEm) * size),
    );
    const lineH = size * CAPTION_LINE_H;
    const height = Math.ceil(lineH * (CAPTION_LINES.length - 1) + ascent + descent);

    const paths: string[] = [];
    const gradients: string[] = [];
    let gradId = 0;

    CAPTION_LINES.forEach((line, lineIndex) => {
      const lineW = line.reduce((sum, r) => sum + fonts[r.font].getAdvanceWidth(r.text, size), 0);
      let penX = (PANEL_W - lineW) / 2; // each line centred independently
      const baseline = ascent + lineIndex * lineH;

      for (const run of line) {
        const runW = fonts[run.font].getAdvanceWidth(run.text, size);
        const d = fonts[run.font].getPath(run.text, penX, baseline, size).toPathData(2);
        if (d) {
          let fill = INK_HEX;
          if (run.gradient) {
            const id = `g${gradId++}`;
            // userSpaceOnUse across THIS run only, so the ramp starts and
            // finishes on the word itself rather than being stretched
            // across the whole line.
            gradients.push(
              `<linearGradient id="${id}" x1="${penX}" y1="0" x2="${penX + runW}" y2="0" gradientUnits="userSpaceOnUse">` +
                `<stop offset="0" stop-color="${INK_HEX}"/>` +
                `<stop offset="1" stop-color="${VIOLET_HEX}"/>` +
                `</linearGradient>`,
            );
            fill = `url(#${id})`;
          }
          paths.push(`<path d="${d}" fill="${fill}"/>`);
        }
        penX += runW;
      }
    });

    if (paths.length === 0) return null;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_W}" height="${height}">
  <defs>${gradients.join("")}</defs>
  ${paths.join("")}
</svg>`;
    return await sharp(Buffer.from(svg)).png().toBuffer();
  } catch (err) {
    console.warn("[print-compositor] caption render failed — omitting", err);
    return null;
  }
}

/** Inside-left panel — cream with the small celebrait wordmark at the
 *  bottom, matching the inside-left of the 3D render.
 *
 *  History worth keeping: the logo was REMOVED here 2026-07-21 so the
 *  inside read like a normal card, then restored 2026-07-30 (Kevin).
 *  Restoring it also closes a real preview/print mismatch — the 3D
 *  viewer has been drawing this wordmark on the cover-back the whole
 *  time (see usePaperTexture's logoUrl), so the card the customer
 *  approved on screen didn't match the one that arrived. */
async function insideLeftPanel(): Promise<Buffer> {
  const logo = await loadLogoOverlay();
  const base = sharp({
    create: { width: PANEL_W, height: PANEL_H, channels: 3, background: CREAM_RGB },
  });
  if (!logo) return base.png().toBuffer();
  // Bottom-centred — matches the 3D viewer's cover-back. Don't move this
  // without moving the render too, or preview and print disagree.
  return base
    .composite([
      {
        input: logo.input,
        top: PANEL_H - logo.height - LOGO_BOTTOM_MARGIN,
        left: Math.round((PANEL_W - logo.width) / 2),
      },
    ])
    .png()
    .toBuffer();
}

/** Back-of-card panel — a discreet celebrait logo only. The signed
 *  "DESIGNED WITH CRAFT BY {name} USING CELEBRAIT" credit (and the no-name
 *  "Made with Celebrait" wordmark) were removed 2026-07-21 (Kevin) so the
 *  printed card back isn't self-promotional. `senderFirstName` is kept in
 *  the signature for the caller but no longer rendered. */
async function backPanel(_senderFirstName: string | null): Promise<Buffer> {
  const [logo, qr] = await Promise.all([loadLogoOverlay(), loadQrOverlay()]);
  const base = sharp({
    create: { width: PANEL_W, height: PANEL_H, channels: 3, background: CREAM_RGB },
  });

  // Layout (Kevin 2026-07-30): the QR + caption travel together as ONE
  // centred group in the square; the wordmark stays pinned at the foot
  // as a footer mark.
  //
  //        [ QR ]
  //      Create your          ← group centred on PANEL_H/2
  //   Unbinnable Greetings…
  //
  //        celebrait          ← sits on STACK_BOTTOM
  //
  // The group is measured before anything is placed, because centring a
  // stack means knowing its total height first.
  const layers: sharp.OverlayOptions[] = [];

  if (logo) {
    const logoScaled = await sharp(logo.input).resize(BACK_LOGO_W).png().toBuffer();
    const { height: logoH = 0 } = await sharp(logoScaled).metadata();
    layers.push({
      input: logoScaled,
      top: PANEL_H - STACK_BOTTOM - logoH,
      left: Math.round((PANEL_W - BACK_LOGO_W) / 2),
    });
  }

  const caption = await renderCaption();
  const captionH = caption ? (await sharp(caption).metadata()).height ?? 0 : 0;
  const qrScaled = qr ? await sharp(qr).resize(QR_W).png().toBuffer() : null;
  const qrH = qrScaled ? (await sharp(qrScaled).metadata()).height ?? QR_W : 0;

  const groupH = qrH + (qrScaled && caption ? STACK_GAP : 0) + captionH;
  let cursor = Math.round((PANEL_H - groupH) / 2);

  if (qrScaled) {
    layers.push({ input: qrScaled, top: cursor, left: Math.round((PANEL_W - QR_W) / 2) });
    cursor += qrH + (caption ? STACK_GAP : 0);
  }
  if (caption) {
    layers.push({ input: caption, top: cursor, left: 0 });
  }

  if (layers.length === 0) return base.png().toBuffer();
  return base.composite(layers).png().toBuffer();
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
