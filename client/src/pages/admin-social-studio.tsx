// client/src/pages/admin-social-studio.tsx
//
// SOCIAL STUDIO — compose branded post images from a real card
// (Aidan 2026-08-04: "an assets creator that would give me the attached
// as PNGs so I can create social posts").
//
// Everything renders on a <canvas> at true export size, then downloads
// as a PNG. Client-side on purpose:
//   • the display fonts are already loaded in the page, so canvas text
//     matches the site exactly (no server fontconfig landmine — see
//     print-compositor's opentype workaround for why that matters).
//   • card art is CORS-enabled (ACAO *), so the canvas stays untainted
//     and toBlob() works.
//
// Layouts mirror the compositions Aidan made by hand: card alone, card
// with the "brief" panel that shows what was typed, and the inside
// spread. Backgrounds reuse the landing's paper gradient + the
// celebration icon set.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, RefreshCw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CardGridItem } from '@shared/schema';
import { Card3DViewer } from '@/components/card-3d-viewer';
import cakeIcon from '@/assets/icons/cake.png';
import celebrateIcon from '@/assets/icons/celebrate.png';
import heartIcon from '@/assets/icons/heart.png';
import presentIcon from '@/assets/icons/present.png';
import ribbonIcon from '@/assets/icons/ribbon.png';
import ringIcon from '@/assets/icons/ring.png';
import wordmark from '@/assets/celebrait.webp';

const ICONS = {
  cake: cakeIcon,
  celebrate: celebrateIcon,
  heart: heartIcon,
  present: presentIcon,
  ribbon: ribbonIcon,
  ring: ringIcon,
} as const;

const SIZES = {
  portrait: { w: 1080, h: 1440, label: 'Post 4:5 · 1080×1440' },
  square: { w: 1080, h: 1080, label: 'Post 1:1 · 1080×1080' },
  story: { w: 1080, h: 1920, label: 'Story 9:16 · 1080×1920' },
} as const;
type SizeKey = keyof typeof SIZES;

type LayoutKey = 'card' | 'card_brief' | 'card_brief_stack' | 'inside' | 'brief';
const LAYOUTS: { key: LayoutKey; label: string; hint: string }[] = [
  { key: 'card_brief', label: 'Card + brief', hint: 'Overlapping, card right.' },
  { key: 'card_brief_stack', label: 'Card + brief (stacked)', hint: 'Panel below, no overlap.' },
  { key: 'card', label: 'Card only', hint: 'The front, big.' },
  { key: 'inside', label: 'Inside spread', hint: 'The open card.' },
  { key: 'brief', label: 'Brief only', hint: 'Just the inputs panel.' },
];

type BgKey = 'corners' | 'scatter' | 'minimal' | 'plain';

interface IconSpec {
  name: keyof typeof ICONS;
  x: number; // 0–1 of width
  y: number; // 0–1 of height
  size: number; // 0–1 of width
  opacity: number;
  tilt: number;
}

const BACKDROPS: Record<BgKey, IconSpec[]> = {
  corners: [
    { name: 'ribbon', x: 0.13, y: 0.14, size: 0.26, opacity: 0.5, tilt: -8 },
    { name: 'ring', x: 0.87, y: 0.12, size: 0.25, opacity: 0.5, tilt: 7 },
    { name: 'cake', x: 0.12, y: 0.85, size: 0.34, opacity: 0.6, tilt: -9 },
    { name: 'present', x: 0.88, y: 0.87, size: 0.33, opacity: 0.58, tilt: 8 },
  ],
  scatter: [
    { name: 'heart', x: 0.1, y: 0.08, size: 0.16, opacity: 0.3, tilt: -12 },
    { name: 'ribbon', x: 0.4, y: 0.04, size: 0.13, opacity: 0.22, tilt: 9 },
    { name: 'ring', x: 0.75, y: 0.07, size: 0.18, opacity: 0.3, tilt: 6 },
    { name: 'celebrate', x: 0.95, y: 0.23, size: 0.15, opacity: 0.24, tilt: -6 },
    { name: 'present', x: 0.06, y: 0.3, size: 0.15, opacity: 0.24, tilt: 11 },
    { name: 'cake', x: 0.13, y: 0.82, size: 0.28, opacity: 0.4, tilt: -8 },
    { name: 'celebrate', x: 0.52, y: 0.95, size: 0.17, opacity: 0.26, tilt: 5 },
    { name: 'present', x: 0.89, y: 0.85, size: 0.27, opacity: 0.38, tilt: 7 },
    { name: 'heart', x: 0.95, y: 0.65, size: 0.13, opacity: 0.2, tilt: 14 },
    { name: 'ring', x: 0.05, y: 0.61, size: 0.12, opacity: 0.2, tilt: -10 },
  ],
  minimal: [
    { name: 'cake', x: 0.11, y: 0.9, size: 0.3, opacity: 0.42, tilt: -7 },
    { name: 'present', x: 0.89, y: 0.93, size: 0.28, opacity: 0.4, tilt: 8 },
  ],
  plain: [],
};

/** Load an image with CORS so the canvas stays exportable. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src.slice(0, 60)}`));
    img.src = src;
  });
}

/** Rounded-rect path helper (Safari lacks roundRect on older versions). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw an image into a vertical trapezoid — the left and right edges
 *  get their own heights, so a card can lean toward or away from the
 *  viewer. Column-slice interpolation: enough perspective to read as a
 *  real object at these angles, without a 3D context. */
function drawTrapezoid(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  hLeft: number,
  hRight: number,
) {
  const steps = Math.max(2, Math.ceil(Math.abs(w)));
  const sw = (img as HTMLImageElement).width / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const h = hLeft + (hRight - hLeft) * t;
    // Vertically centre each column so the lean pivots about the middle.
    const cy = y + (Math.max(hLeft, hRight) - h) / 2;
    ctx.drawImage(
      img,
      i * sw,
      0,
      Math.ceil(sw) + 1,
      (img as HTMLImageElement).height,
      x + (w / steps) * i,
      cy,
      w / steps + 1,
      h,
    );
  }
}

/** A flat colour panel in the same trapezoid geometry. */
function trapezoidPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  hLeft: number,
  hRight: number,
) {
  const maxH = Math.max(hLeft, hRight);
  const yL = y + (maxH - hLeft) / 2;
  const yR = y + (maxH - hRight) / 2;
  ctx.beginPath();
  ctx.moveTo(x, yL);
  ctx.lineTo(x + w, yR);
  ctx.lineTo(x + w, yR + hRight);
  ctx.lineTo(x, yL + hLeft);
  ctx.closePath();
}

/** A headline token and whether it should carry the brand gradient.
 *  Authors mark words with *asterisks*: "Cards people *keep*." */
interface Tok {
  text: string;
  grad: boolean;
}

function parseTokens(src: string): Tok[] {
  return src
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const grad = /^\*.*\*$/.test(raw) || /^\*/.test(raw) || /\*$/.test(raw);
      return { text: raw.replace(/\*/g, ''), grad };
    });
}

/** Lay tokens into lines that fit `maxWidth` at the current font. */
function layoutTokens(
  ctx: CanvasRenderingContext2D,
  toks: Tok[],
  maxWidth: number,
): Tok[][] {
  const lines: Tok[][] = [];
  let line: Tok[] = [];
  const width = (ts: Tok[]) =>
    ctx.measureText(ts.map((t) => t.text).join(' ')).width;
  for (const t of toks) {
    const next = [...line, t];
    if (line.length && width(next) > maxWidth) {
      lines.push(line);
      line = [t];
    } else {
      line = next;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

/** Draw one laid-out line, running the ink→violet gradient across each
 *  RUN of marked words (so a marked phrase gets one ramp, not one per
 *  word — the card-back "Unbinnable" treatment). */
function drawHeadlineLine(
  ctx: CanvasRenderingContext2D,
  line: Tok[],
  startX: number,
  y: number,
) {
  const space = ctx.measureText(' ').width;
  // Measure every token once so runs can be spanned.
  const widths = line.map((t) => ctx.measureText(t.text).width);
  let x = startX;
  let i = 0;
  while (i < line.length) {
    if (!line[i].grad) {
      ctx.fillStyle = '#211D19';
      ctx.fillText(line[i].text, x, y);
      x += widths[i] + space;
      i++;
      continue;
    }
    // Span the run.
    let j = i;
    let runW = 0;
    while (j < line.length && line[j].grad) {
      runW += widths[j] + (j > i ? space : 0);
      j++;
    }
    const grad = ctx.createLinearGradient(x, 0, x + runW, 0);
    grad.addColorStop(0, '#211D19');
    grad.addColorStop(1, '#7C77E0');
    ctx.fillStyle = grad;
    for (let k = i; k < j; k++) {
      ctx.fillText(line[k].text, x, y);
      x += widths[k] + space;
    }
    i = j;
  }
}

/** Wrap text to a width, returning the lines. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  const push = () => {
    if (line) lines.push(line);
    line = '';
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    // A single token can be wider than the box (a pasted URL, or
    // "TESTTESTTEST…") — split it by character so text can never run
    // outside the panel it belongs to.
    if (ctx.measureText(word).width > maxWidth) {
      push();
      let chunk = '';
      for (const ch of word) {
        if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
      continue;
    }
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      push();
      line = word;
    } else {
      line = test;
    }
  }
  push();
  return lines;
}

export default function AdminSocialStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The REAL 3D viewer renders offstage; the composer copies its frame
  // onto the export canvas. Hand-rolled perspective looked like a flat
  // card with a box behind it (Aidan) — this is the actual product pose.
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<SizeKey>('portrait');
  const [layout, setLayout] = useState<LayoutKey>('card_brief');
  const [bg, setBg] = useState<BgKey>('corners');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Pick a real card to compose from.
  const { data: cards } = useQuery<CardGridItem[]>({ queryKey: ['/api/user/cards'] });
  const usable = useMemo(
    () => (cards ?? []).filter((c) => !!c.frontImageUrl),
    [cards],
  );
  const [cardId, setCardId] = useState<number | null>(null);
  const card = usable.find((c) => c.id === cardId) ?? usable[0] ?? null;

  // Brief panel fields — prefilled from the card, editable for a nicer post.
  const [scene, setScene] = useState('');
  const [frontText, setFrontText] = useState('');
  const [inside, setInside] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [frontUrl, setFrontUrl] = useState('');
  const [insideUrl, setInsideUrl] = useState('');
  const [showLogo, setShowLogo] = useState(true);
  // Second mode: text-only posts (quotes, ad-hoc lines). Shares the
  // backdrops, sizes, wordmark and export with the card composer.
  const [mode, setMode] = useState<'card' | 'text' | 'carousel'>('card');
  // Carousel = slide 1 the message, slide 2 the card made for them.
  const [slide, setSlide] = useState<1 | 2>(1);
  // A call to action carried on every slide — the whole point of the
  // "make someone a card, post it, tell them how to get one" play.
  const [cta, setCta] = useState('DM to order yours · celebrait.co.uk');
  // ── Make a card right here, using the LIVE production prompt, so a
  // marketing card is the same thing a customer would receive (Aidan:
  // "this probably needs a card generator building in").
  const [genPhoto, setGenPhoto] = useState('');
  const [genScene, setGenScene] = useState('');
  const [genText, setGenText] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [genNote, setGenNote] = useState<string | null>(null);

  const generateCard = async () => {
    if (!genPhoto || !genScene.trim()) {
      setGenNote('A photo and a scene, then we can make it.');
      return;
    }
    setGenBusy(true);
    setGenNote('Making the card — this takes about a minute…');
    try {
      // What's live in production right now? The response carries the
      // template text with it, so this is the only lookup needed.
      const prod = await (await fetch('/api/admin/prompts/production')).json();
      const rows: any[] = prod?.configs ?? [];
      const front = rows.filter((r) => r.slot === 'front_scene');
      const row =
        front.find((r) => r.variant === 'one_person') ?? front[0];
      if (!row?.templateText) {
        throw new Error('No live front-scene prompt is set in the Prompt Lab.');
      }
      // Generate down the same path the Prompt Lab uses.
      const res = await apiRequest('POST', '/api/admin/prompts/test-run', {
        slot: 'front_scene',
        templateText: row.templateText,
        provider: row.provider ?? undefined,
        quality: row.quality ?? 'high',
        photoBase64: genPhoto.split(',')[1] ?? genPhoto,
        inputs: {
          scenePrompt: genScene.trim(),
          userArtStyle: '',
          userClothing: '',
          cardText: genText.trim(),
          includeText: !!genText.trim(),
          textLayout: 'integrated',
          photoMode: 'one_person',
          photos: [],
        },
      });
      const out = await res.json();
      if (!out?.imageUrl) throw new Error(out?.message ?? 'No image came back.');
      setFrontUrl(out.imageUrl);
      // Mirror it into the brief panel so the post tells the whole story.
      setScene(genScene.trim());
      if (genText.trim()) setFrontText(genText.trim());
      setPhotoUrl(genPhoto);
      const cost = typeof out.costCents === 'number' ? ` · ${(out.costCents / 100).toFixed(2)} GBP` : '';
      setGenNote(`Card made${cost}. It's in the composition now.`);
    } catch (e: any) {
      setGenNote(e?.message ?? 'That generation failed.');
    } finally {
      setGenBusy(false);
    }
  };
  const [eyebrow, setEyebrow] = useState('');
  const [headline, setHeadline] = useState('Cards people actually *keep*.');
  const [subcopy, setSubcopy] = useState('');
  const [align, setAlign] = useState<'left' | 'center'>('center');

  useEffect(() => {
    if (!card) return;
    setFrontUrl(card.frontImageUrl ?? '');
    setInsideUrl((card as any).insideImageUrl ?? '');
    const st: any = (card as any).state ?? {};
    setScene((s) => s || st?.scene?.description || '');
    setFrontText((s) => s || st?.front?.text || '');
    setInside((s) => s || st?.inside?.message || '');
  }, [card?.id]);

  /** CTA line + wordmark, bottom-centre, on every slide. */
  const drawFooter = async (
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
  ) => {
    let footY = H - H * 0.035;
    if (showLogo) {
      try {
        const mark = await loadImage(wordmark);
        const mw = W * 0.2;
        const mh = (mark.height / mark.width) * mw;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(mark, (W - mw) / 2, footY - mh, mw, mh);
        ctx.globalAlpha = 1;
        footY -= mh + H * 0.014;
      } catch {
        /* decorative */
      }
    }
    if (cta.trim()) {
      ctx.save();
      ctx.textAlign = 'center';
      (ctx as any).letterSpacing = `${W * 0.003}px`;
      ctx.fillStyle = '#5c57d4';
      ctx.font = `700 ${W * 0.021}px Figtree, system-ui, sans-serif`;
      ctx.fillText(cta.trim(), W / 2, footY);
      ctx.restore();
      (ctx as any).letterSpacing = '0px';
    }
  };

  const draw = async (force?: 'text' | 'card') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Which face are we drawing? Carousel slide 1 is the message,
    // slide 2 is the card.
    const kind: 'text' | 'card' =
      force ??
      (mode === 'text'
        ? 'text'
        : mode === 'card'
          ? 'card'
          : slide === 1
            ? 'text'
            : 'card');
    setBusy(true);
    setErr(null);
    try {
      await (document as any).fonts?.ready;
      const { w: W, h: H } = SIZES[size];
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // ── Ground: the landing's paper gradient + centre lift.
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#FFFDF9');
      g.addColorStop(1, '#FAF8F4');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const lift = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, W * 0.8);
      lift.addColorStop(0, 'rgba(255,255,255,0.55)');
      lift.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lift;
      ctx.fillRect(0, 0, W, H);

      // ── Backdrop icons.
      for (const spec of BACKDROPS[bg]) {
        const img = await loadImage(ICONS[spec.name]);
        const s = spec.size * W;
        const ratio = img.height / img.width;
        ctx.save();
        ctx.globalAlpha = spec.opacity;
        ctx.translate(spec.x * W, spec.y * H);
        ctx.rotate((spec.tilt * Math.PI) / 180);
        ctx.drawImage(img, -s / 2, (-s * ratio) / 2, s, s * ratio);
        ctx.restore();
      }

      const pad = W * 0.075;

      // ── TEXT MODE: an editorial block, nothing else. Headline auto-
      // fits so long lines never spill past the artwork's margins, and
      // *marked* words carry the ink→violet ramp.
      if (kind === 'text') {
        const boxW = W - pad * 2 * 1.15;
        const cx = align === 'center' ? W / 2 : pad * 1.15;
        ctx.textAlign = align === 'center' ? 'center' : 'left';

        // Measure-then-place so the whole block sits optically centred.
        const eyeSize = W * 0.019;
        const subSize = W * 0.032;
        let headSize = W * 0.095;
        let lines: Tok[][] = [];
        const toks = parseTokens(headline);
        for (;;) {
          ctx.font = `600 ${headSize}px Fraunces, Georgia, serif`;
          lines = layoutTokens(ctx, toks, boxW);
          const tall = lines.length * headSize * 1.14;
          if (tall <= H * 0.5 || headSize <= W * 0.04) break;
          headSize *= 0.94;
        }
        const headBlock = lines.length * headSize * 1.14;
        const subLines = subcopy.trim()
          ? (ctx.font = `400 ${subSize}px Figtree, system-ui, sans-serif`,
            wrap(ctx, subcopy.trim(), boxW * 0.86))
          : [];
        const total =
          (eyebrow.trim() ? eyeSize * 2.6 : 0) +
          headBlock +
          (subLines.length ? subLines.length * subSize * 1.45 + W * 0.03 : 0);
        let y = (H - total) / 2 + headSize * 0.82;

        if (eyebrow.trim()) {
          ctx.save();
          (ctx as any).letterSpacing = `${W * 0.005}px`;
          ctx.fillStyle = '#5c57d4';
          ctx.font = `700 ${eyeSize}px Figtree, system-ui, sans-serif`;
          ctx.fillText(eyebrow.trim().toUpperCase(), cx, y - headSize * 0.5);
          ctx.restore();
          (ctx as any).letterSpacing = '0px';
          y += eyeSize * 1.9;
        }

        ctx.font = `600 ${headSize}px Fraunces, Georgia, serif`;
        for (const line of lines) {
          const lineW = ctx.measureText(line.map((t) => t.text).join(' ')).width;
          const startX = align === 'center' ? W / 2 - lineW / 2 : cx;
          // drawHeadlineLine advances from the left, so draw left-aligned
          // and offset the start for centred lines.
          ctx.textAlign = 'left';
          drawHeadlineLine(ctx, line, startX, y);
          ctx.textAlign = align === 'center' ? 'center' : 'left';
          y += headSize * 1.14;
        }

        if (subLines.length) {
          y += W * 0.02;
          ctx.fillStyle = '#3A342E';
          ctx.font = `400 ${subSize}px Figtree, system-ui, sans-serif`;
          for (const ln of subLines) {
            ctx.fillText(ln, cx, y);
            y += subSize * 1.45;
          }
        }

        drawFooter(ctx, W, H);
        ctx.textAlign = 'left';
        setBusy(false);
        return;
      }

      // ── Caption: which face of the card this is. Small caps at the
      // head of the canvas — clear of the corner icons and of every
      // layout's artwork (Aidan: "nice and small somewhere neat").
      const faceLabel =
        layout === 'inside'
          ? 'Inside card'
          : layout === 'brief'
            ? ''
            : 'Front of card';
      if (faceLabel) {
        ctx.save();
        ctx.textAlign = 'center';
        (ctx as any).letterSpacing = `${W * 0.004}px`;
        ctx.fillStyle = '#7A7267';
        ctx.font = `700 ${W * 0.0165}px Figtree, system-ui, sans-serif`;
        ctx.fillText(faceLabel.toUpperCase(), W / 2, H * 0.055);
        ctx.restore();
        (ctx as any).letterSpacing = '0px';
      }

      const overlap = layout === 'card_brief';
      const stacked = layout === 'card_brief_stack';
      const showBrief = overlap || stacked || layout === 'brief';
      const artUrl = layout === 'inside' ? insideUrl || frontUrl : frontUrl;

      // ── The card art. Two brief compositions: OVERLAP (Aidan's
      // preferred — card sits right and high, the brief panel layers
      // over its lower-left, matching the posts he mocked by hand) and
      // STACKED (panel below, nothing covered) for busy artwork.
      let artBottom = pad;
      let artRect = { x: pad, y: pad, side: 0 };
      if (layout !== 'brief') {
        // Grab the frame the real viewer just painted. It carries the
        // proper hinge, lighting and contact shadow — and for the inside
        // layout it's genuinely open, not a faked spread.
        const stage = stageRef.current?.querySelector('canvas');
        if (!stage || stage.width === 0) {
          throw new Error('3D view not ready — give it a moment and hit refresh.');
        }
        const side = overlap
          ? Math.min(W * 0.92, H * 0.56)
          : stacked
            ? Math.min(W - pad, H * 0.46)
            : Math.min(W * 1.14, H * 0.82);
        const x = overlap ? W - side - pad * 0.1 : (W - side) / 2;
        const y = overlap ? H * 0.06 : stacked ? H * 0.04 : (H - side) / 2 - H * 0.03;
        ctx.drawImage(stage, x, y, side, side);
        artRect = { x, y, side };
        // The viewer leaves generous margin around the card, so pull the
        // brief up under the artwork rather than the frame's edge.
        artBottom = y + side * 0.82;
      }

      // ── The brief panel — mirrors the studio's own input cards.
      if (showBrief) {
        // Overlap: a narrower column hugging the left edge, starting
        // low enough down the card that the subject stays clear.
        const panelW = overlap ? W * 0.53 : W - pad * 2;
        const px = overlap ? pad * 0.55 : pad;
        let py = overlap
          // Drop the group so the first box just laps the card's lower
          // edge — the overlap is what gives the composition depth.
          ? artRect.y + artRect.side * 0.74
          : layout === 'brief'
            ? H * 0.16
            : artBottom + W * 0.055;

        // Photo chip — labelled as the SOURCE snap. The studio's own
        // wording is an instruction ("Upload a photo"); in a finished
        // post it should describe what you're looking at.
        if (photoUrl) {
          try {
            const p = await loadImage(photoUrl);
            const chip = W * 0.115;
            ctx.save();
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = '#CFCAC2';
            ctx.lineWidth = 2;
            roundRect(ctx, px, py, chip, chip, 14);
            ctx.stroke();
            ctx.restore();
            ctx.save();
            roundRect(ctx, px + 6, py + 6, chip - 12, chip - 12, 10);
            ctx.clip();
            const r = Math.max((chip - 12) / p.width, (chip - 12) / p.height);
            ctx.drawImage(
              p,
              px + 6 - (p.width * r - (chip - 12)) / 2,
              py + 6 - (p.height * r - (chip - 12)) / 2,
              p.width * r,
              p.height * r,
            );
            ctx.restore();
            ctx.fillStyle = '#211D19';
            ctx.font = `700 ${W * 0.026}px Figtree, system-ui, sans-serif`;
            ctx.fillText('Uploaded photo', px + chip + 18, py + chip * 0.42);
            ctx.fillStyle = '#7A7267';
            ctx.font = `400 ${W * 0.021}px Figtree, system-ui, sans-serif`;
            ctx.fillText('featuring the person you love', px + chip + 18, py + chip * 0.72);
            py += chip + W * 0.03;
          } catch {
            /* a missing photo just skips the chip */
          }
        }

        const field = (label: string, value: string) => {
          if (!value.trim()) return;
          ctx.font = `400 ${W * 0.024}px Figtree, system-ui, sans-serif`;
          const lines = wrap(ctx, value.trim(), panelW - W * 0.07);
          const boxH = W * 0.045 + lines.length * W * 0.033;
          ctx.save();
          ctx.shadowColor = 'rgba(33,29,25,0.10)';
          ctx.shadowBlur = W * 0.02;
          ctx.shadowOffsetY = W * 0.006;
          roundRect(ctx, px, py, panelW, boxH, W * 0.016);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = '#EFEAE2';
          ctx.lineWidth = 1.5;
          roundRect(ctx, px, py, panelW, boxH, W * 0.016);
          ctx.stroke();

          ctx.fillStyle = '#5c57d4';
          ctx.font = `700 ${W * 0.0165}px Figtree, system-ui, sans-serif`;
          ctx.fillText(label.toUpperCase(), px + W * 0.028, py + W * 0.032);

          ctx.fillStyle = '#211D19';
          ctx.font = `400 ${W * 0.024}px Figtree, system-ui, sans-serif`;
          lines.forEach((ln, i) => {
            ctx.fillText(ln, px + W * 0.028, py + W * 0.062 + i * W * 0.033);
          });
          py += boxH + W * 0.02;
        };

        field('The scene', scene);
        field('Front text', frontText);
        field('Inside message', inside);
      }

      drawFooter(ctx, W, H);
      setBusy(false);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not compose that.');
      setBusy(false);
    }
  };

  // Compose after the 3D stage has had a couple of frames to paint —
  // the capture reads whatever is in its buffer at that instant.
  useEffect(() => {
    const t = window.setTimeout(() => void draw(), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    size, layout, bg, frontUrl, insideUrl, photoUrl, scene, frontText,
    inside, showLogo, mode, eyebrow, headline, subcopy, align, slide, cta,
  ]);

  const saveCanvas = (name: string) =>
    new Promise<void>((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve();
      canvas.toBlob((blob) => {
        if (!blob) return resolve();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
        resolve();
      }, 'image/png');
    });

  const stamp = `${SIZES[size].w}x${SIZES[size].h}`;

  const download = async () => {
    if (mode === 'carousel') {
      // Both slides, in posting order: the message, then the card.
      setBusy(true);
      await draw('text');
      await saveCanvas(`celebrait-slide-1-message-${stamp}.png`);
      await draw('card');
      await saveCanvas(`celebrait-slide-2-card-${stamp}.png`);
      // Leave the preview on whichever slide was showing.
      await draw();
      return;
    }
    await saveCanvas(`celebrait-${mode === 'text' ? 'text' : layout}-${stamp}.png`);
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-stone-900">Social studio</h1>
      <p className="mt-1 text-sm text-stone-500">
        Compose post images from a real card. Everything renders at export
        size — what you see is the pixel you get.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[380px,1fr]">
        {/* ── Controls ── */}
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            {(['card', 'text', 'carousel'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  mode === m
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400'
                }`}
                data-testid={`social-mode-${m}`}
              >
                {m === 'card' ? 'Card' : m === 'text' ? 'Text' : 'Carousel'}
              </button>
            ))}
          </div>

          {mode === 'carousel' && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                Two slides
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-stone-600">
                Slide 1 is the message, slide 2 is the card you made them.
                Fill in both sections below — “Download PNG” saves the pair.
              </p>
              <div className="mt-2 flex gap-2">
                {([1, 2] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSlide(n)}
                    className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      slide === n
                        ? 'border-indigo-500 bg-white text-indigo-800'
                        : 'border-indigo-200 bg-white/60 text-stone-600'
                    }`}
                    data-testid={`carousel-slide-${n}`}
                  >
                    Preview slide {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(mode === 'text' || mode === 'carousel') && (
            <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
              <Input
                value={eyebrow}
                onChange={(e) => setEyebrow(e.target.value)}
                placeholder="Sub-headline (small caps, optional)"
                className="text-sm"
                data-testid="text-eyebrow"
              />
              <textarea
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                rows={3}
                placeholder="Headline — wrap words in *asterisks* for the gradient"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                data-testid="text-headline"
              />
              <textarea
                value={subcopy}
                onChange={(e) => setSubcopy(e.target.value)}
                rows={2}
                placeholder="Sub-copy (optional)"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                data-testid="text-subcopy"
              />
              <div className="flex items-center gap-2">
                {(['center', 'left'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAlign(a)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      align === a
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                        : 'border-stone-300 bg-white text-stone-600'
                    }`}
                  >
                    {a === 'center' ? 'Centred' : 'Left'}
                  </button>
                ))}
              </div>
              <p className="text-[10.5px] leading-snug text-stone-500">
                Headline auto-sizes to fit. <b>*Marked*</b> words run the
                ink→violet gradient — mark a whole phrase and it ramps once
                across the lot.
              </p>
            </div>
          )}

          {(mode === 'card' || mode === 'carousel') && (
          <>
          <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
              Make a card
            </p>
            <p className="text-[11px] leading-snug text-stone-600">
              Uses the live production prompt — what you make here is what a
              customer would get.
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const fr = new FileReader();
                fr.onload = () => setGenPhoto(String(fr.result));
                fr.readAsDataURL(f);
              }}
              className="w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700"
              data-testid="gen-photo"
            />
            <Input
              value={genScene}
              onChange={(e) => setGenScene(e.target.value)}
              placeholder="Scene — e.g. Going viral in Times Square"
              className="text-sm"
              data-testid="gen-scene"
            />
            <Input
              value={genText}
              onChange={(e) => setGenText(e.target.value)}
              placeholder="Text on the front (optional)"
              className="text-sm"
              data-testid="gen-text"
            />
            <Button
              onClick={generateCard}
              disabled={genBusy}
              className="w-full"
              variant="outline"
              data-testid="gen-run"
            >
              {genBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              {genBusy ? 'Making…' : 'Generate card front'}
            </Button>
            {genNote && (
              <p className="text-[11px] leading-snug text-stone-600">{genNote}</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Card
            </Label>
            <select
              value={card?.id ?? ''}
              onChange={(e) => setCardId(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              data-testid="social-card-picker"
            >
              {usable.length === 0 && <option>No finished cards yet</option>}
              {usable.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} · {(c as any).recipientName ?? 'card'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Layout
            </Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {LAYOUTS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setLayout(l.key)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs ${
                    layout === l.key
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                      : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400'
                  }`}
                >
                  <span className="block font-semibold">{l.label}</span>
                  <span className="block text-[10.5px] text-stone-500">{l.hint}</span>
                </button>
              ))}
            </div>
          </div>

          </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Size
              </Label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as SizeKey)}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              >
                {Object.entries(SIZES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Backdrop
              </Label>
              <select
                value={bg}
                onChange={(e) => setBg(e.target.value as BgKey)}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              >
                <option value="corners">Corners</option>
                <option value="scatter">Scatter</option>
                <option value="minimal">Minimal</option>
                <option value="plain">Plain paper</option>
              </select>
            </div>
          </div>

          {(mode === 'card' || mode === 'carousel') && (
          <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Brief panel
            </p>
            <Input
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              placeholder="The scene — e.g. Going viral in Times Square"
              className="text-sm"
            />
            <Input
              value={frontText}
              onChange={(e) => setFrontText(e.target.value)}
              placeholder="Front text — e.g. Sweet 16 x"
              className="text-sm"
            />
            <Input
              value={inside}
              onChange={(e) => setInside(e.target.value)}
              placeholder="Inside message"
              className="text-sm"
            />
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fr = new FileReader();
                  fr.onload = () => setPhotoUrl(String(fr.result));
                  fr.readAsDataURL(f);
                }}
                className="w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700"
                data-testid="social-photo-file"
              />
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl('')}
                  className="shrink-0 text-[11px] font-semibold text-stone-500 hover:text-stone-800"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-[10.5px] text-stone-500">
              The original snap — shown in the “Uploaded photo” box above
              the fields.
            </p>
          </div>

          )}

          {(mode === 'card' || mode === 'carousel') && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Card art (override)
            </Label>
            <Input
              value={frontUrl}
              onChange={(e) => setFrontUrl(e.target.value)}
              placeholder="Front image URL"
              className="text-sm"
            />
            <Input
              value={insideUrl}
              onChange={(e) => setInsideUrl(e.target.value)}
              placeholder="Inside image URL"
              className="text-sm"
            />
          </div>

          )}

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Call to action
            </Label>
            <Input
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="DM to order yours · celebrait.co.uk"
              className="mt-1 text-sm"
              data-testid="social-cta"
            />
            <p className="mt-1 text-[10.5px] text-stone-500">
              Sits above the wordmark on every slide. Clear it to leave it off.
            </p>
          </div>

          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-stone-600">
            <input
              type="checkbox"
              checked={showLogo}
              onChange={(e) => setShowLogo(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
              data-testid="social-logo-toggle"
            />
            Wordmark, bottom centre
          </label>

          <div className="flex items-center gap-2">
            <Button onClick={download} disabled={busy} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              {mode === 'carousel' ? 'Download both slides' : 'Download PNG'}
            </Button>
            <Button variant="outline" onClick={() => void draw()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>

        {/* ── The real 3D viewer, offstage. Rendered (not display:none —
            WebGL needs to paint) but invisible; the composer copies its
            canvas. Sized generously so the captured frame is crisp at
            export scale. ── */}
        <div
          ref={stageRef}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 -z-10 h-[760px] w-[760px] opacity-[0.01]"
        >
          {frontUrl && (
            <Card3DViewer
              key={`${frontUrl}-${insideUrl}-${layout}`}
              frontImageUrl={frontUrl}
              insideImageUrl={insideUrl || frontUrl}
              open={layout === 'inside'}
              preserveBuffer
              enableRotate={false}
              enableZoom={false}
              framingMargin={layout === 'inside' ? 1.5 : 1.7}
              minDistance={1.4}
              closedAngle={layout === 'inside' ? 0 : -0.38}
              restYaw={layout === 'inside' ? -0.05 : -0.12}
              className="h-full w-full"
            />
          )}
        </div>

        {/* ── Live preview ── */}
        <div className="rounded-2xl border border-stone-200 bg-stone-100 p-4">
          <canvas
            ref={canvasRef}
            className="mx-auto block h-auto w-full max-w-[420px] rounded-lg shadow-lg"
            data-testid="social-canvas"
          />
          <p className="mt-3 text-center text-[11px] text-stone-500">
            Preview is scaled — the download is full {SIZES[size].w}×{SIZES[size].h}.
          </p>
        </div>
      </div>
    </div>
  );
}
