// client/src/pages/demo.tsx
//
// THE DEMO — the three-card route as a product demo for social video,
// driving itself (Aidan 2026-09-15). Its own screens, one per beat, no
// scrolling, no chrome; the SAME engine underneath (concepts, fronts,
// the cameo, the inside all come from /api/make/*), so what's on film is
// what the product makes. A director walks it like a thumb: scroll to
// the thing, a violet ring where the tap lands, the tap, a held beat.
//
//   hook → brief → glowing generator → Option 1/2/3 (swipe, pulsing
//   Choose) → add a photo? → put them in → the inside → the 3D card,
//   tapped open → where's it going? → it's on the way.
//
// Versions are links, so a link IS a version:
//   /demo?preset=mum-70-garden&hook=typed   (the photo step needs a preset with a photo)
//   /demo?preset=dad-60-canal               (no photo → "No photo" tap)
//   /demo?…&speed=fast                       tighter beats for a 30s cut
//
// Admin-only (every load spends real generations) and noindex. The
// recorder (scratchpad rec/record-demo.mjs) reads window.__demo for
// beats + timestamps and stops on state 'end'.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Camera, Sparkles, Play } from 'lucide-react';
import { BriefQuestions, RECIPIENTS, emptyBrief, occasionLabelFor, ageOf, isKidBrief, whoPhrase, frontWordOf, type Brief } from '@/components/brief-questions';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { expectedBy, formatDayMonth } from '@shared/pricing';
import celebraitLogo from '@/assets/celebrait.webp';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';

// ── versions ─────────────────────────────────────────────────────────

export interface DemoPreset {
  /** Chip labels exactly as the brief shows them. */
  who: string; occasion: string; age: string; vibe: 'Light humour' | 'Warm' | 'Cheeky';
  thing: string; cant: string; front: 'role' | 'name' | 'none'; name: string;
  dear: string; from: string;
  /** The typed hook line, when the run opens with one. */
  hookLine: string;
  /** A photo of them for the cameo step (public path). Without one the
   *  demo taps "No photo". */
  photo?: string;
}

export const DEMO_PRESETS: Record<string, DemoPreset> = {
  'mum-70-garden': {
    who: 'Mum', occasion: 'Birthday', age: '70', vibe: 'Warm',
    thing: 'Her garden — the roses, the robin, the shed radio', cant: 'Slugs', front: 'role', name: 'Linda',
    dear: 'Dear Mum,', from: 'All our love, Aidan & Sam x',
    hookLine: 'Watch us make a card for Mum. 70. Lives in her garden.',
    photo: '/proof-source-photo.webp',
  },
  'dad-60-canal': {
    who: 'Dad', occasion: 'Birthday', age: '60', vibe: 'Light humour',
    thing: 'Fishing on the canal every Sunday, rain or shine', cant: 'Getting up before 6am', front: 'role', name: 'Dave',
    dear: 'Dear Dad,', from: 'Love, Aidan x',
    hookLine: 'Watch us make a card for Dad. 60. Canal fishing every Sunday.',
  },
  'mate-30-fiveaside': {
    who: 'Best mate', occasion: 'Birthday', age: '30', vibe: 'Cheeky',
    thing: 'Five-a-side on Thursdays, still thinks he can play', cant: 'Losing', front: 'name', name: 'Tom',
    dear: 'Tom,', from: 'The lads',
    hookLine: 'Watch us make a card for a mate who turns 30 and still thinks he can play.',
  },
};

type Speed = 'normal' | 'fast';
/** What one run needs: a preset's worth of brief, plus how to play it. */
export interface DemoConfig extends DemoPreset {
  speed: Speed; hook: boolean;
  /** Seconds before the run starts — time to hit record. */
  countdown: number;
  /** 'auto' = the director taps through it; 'manual' = Aidan does, on the
   *  same clean screens (2026-09-15: "allow me to manually run this end
   *  to end rather than pre-set and hit play"). */
  mode: 'auto' | 'manual';
}
const BEATS: Record<Speed, { hold: number; type: number; settle: number; walk: number; look: number }> = {
  // 'settle' is the pause AFTER a screen/element is in view and BEFORE the
  // ring lands — the beat where a viewer reads what's there (Aidan
  // 2026-09-15: "longer on screens before things are clicked, a beat or 2").
  normal: { hold: 2000, type: 80, settle: 1600, walk: 2800, look: 3400 },
  fast: { hold: 1000, type: 50, settle: 700, walk: 1600, look: 1800 },
};

// ── skin ─────────────────────────────────────────────────────────────

const CSS = `
  @keyframes demo-ring { 0% { transform: translate(-50%,-50%) scale(.55); opacity: .95 } 70% { opacity: .55 } 100% { transform: translate(-50%,-50%) scale(1.7); opacity: 0 } }
  @keyframes demo-dot { 0% { opacity: .9 } 100% { opacity: 0 } }
  .demo-ring { position: fixed; z-index: 2147483000; pointer-events: none; width: 46px; height: 46px; border-radius: 50%;
    border: 3px solid #7a76e8; background: rgba(122,118,232,.22); animation: demo-ring 420ms cubic-bezier(.2,.7,.3,1) forwards; }
  .demo-dot { position: fixed; z-index: 2147483000; pointer-events: none; width: 14px; height: 14px; border-radius: 50%; background: #7a76e8;
    transform: translate(-50%,-50%); animation: demo-dot 420ms ease-out forwards; }

  /* The manual-run cursor (Aidan 2026-09-16: "make my mouse the purple
     hover… the glow"): the system pointer hides, a violet dot follows. */
  .demo-cursor-on, .demo-cursor-on * { cursor: none !important; }
  .demo-cursor { position: fixed; left: 0; top: 0; z-index: 2147483001; pointer-events: none; width: 22px; height: 22px; margin: -11px 0 0 -11px;
    border-radius: 50%; background: rgba(122,118,232,.55); border: 2px solid #7a76e8;
    box-shadow: 0 0 0 6px rgba(122,118,232,.14), 0 0 26px 6px rgba(122,118,232,.45);
    transition: transform 120ms ease, opacity 160ms ease, width 160ms ease, height 160ms ease; opacity: 0; will-change: transform; }
  .demo-cursor.down { width: 16px; height: 16px; margin: -8px 0 0 -8px; background: rgba(122,118,232,.8); }
  .demo-cursor.over { width: 30px; height: 30px; margin: -15px 0 0 -15px; background: rgba(122,118,232,.28); }
  .demo-hook { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: flex-start; padding: 8vw;
    background: transparent; transition: opacity 600ms ease; }
  /* Left-aligned, Fraunces Bold, the recipient in violet → ink (Aidan 2026-09-15). */
  .demo-hook p { font-family: 'Fraunces', Georgia, serif; font-weight: 700; font-size: clamp(30px, 9.5vw, 56px); line-height: 1.08; letter-spacing: -0.01em; color: #211D19; margin: 0; text-align: left; max-width: 100%; }
  .demo-hook .who { background: linear-gradient(90deg, #7a76e8 0%, #211D19 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .demo-hook .caret { display: inline-block; width: .08em; height: .95em; background: #7a76e8; margin-left: .08em; vertical-align: -.1em; animation: demo-caret 900ms steps(2) infinite; }
  @keyframes demo-caret { 50% { opacity: 0 } }
  .demo-hook.out { opacity: 0; pointer-events: none; }

  /* The generator: a blank card, breathing violet. No words but one. */
  @keyframes demo-shimmer { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }
  @keyframes demo-glow { 0%, 100% { box-shadow: 0 0 0 1px rgba(122,118,232,.18), 0 14px 30px rgba(122,118,232,.16) } 50% { box-shadow: 0 0 0 1px rgba(122,118,232,.42), 0 18px 40px rgba(122,118,232,.26) } }
  /* The glow is a round halo behind the tile, not a huge box-shadow — the
     shadow rendered with faint square edges on video. */
  @keyframes demo-halo { 0%, 100% { opacity: .55; transform: scale(.94) } 50% { opacity: 1; transform: scale(1.04) } }
  .demo-glow-card { width: min(56vw, 240px); aspect-ratio: 1 / 1; border-radius: 16px; position: relative;
    background: linear-gradient(120deg, #ffffff 0%, #edecfb 35%, #ffffff 55%, #f2f1fb 100%); background-size: 260% 260%;
    animation: demo-shimmer 2.6s ease-in-out infinite, demo-glow 2.6s ease-in-out infinite; }
  .demo-glow-card::after { content: ''; position: absolute; inset: 14px; border-radius: 10px; border: 1px dashed rgba(122,118,232,.35); }
  .demo-glow-card::before { content: ''; position: absolute; inset: -38%; z-index: -1; border-radius: 50%; pointer-events: none;
    background: radial-gradient(closest-side, rgba(122,118,232,.34), rgba(122,118,232,.12) 55%, rgba(122,118,232,0)); animation: demo-halo 2.6s ease-in-out infinite; }
  @keyframes demo-fade-up { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
  .demo-in { animation: demo-fade-up 420ms ease-out both; }

  /* The one thing to do on a screen pulses. */
  @keyframes demo-pulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(122,118,232,.45) } 50% { transform: scale(1.03); box-shadow: 0 0 0 14px rgba(122,118,232,0) } }
  .demo-pulse { animation: demo-pulse 1.7s ease-in-out infinite; }

  @keyframes demo-field-glow { 0%, 100% { box-shadow: 0 0 0 1px rgba(122,118,232,.35), 0 10px 36px rgba(122,118,232,.22) } 50% { box-shadow: 0 0 0 1px rgba(122,118,232,.55), 0 14px 48px rgba(122,118,232,.38) } }
  .demo-glow-field { border-color: rgba(122,118,232,.5) !important; animation: demo-field-glow 2.4s ease-in-out infinite; }

  .demo-rail { scrollbar-width: none; } .demo-rail::-webkit-scrollbar { display: none; }

  @keyframes demo-tick { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1) } }
  .demo-tick { animation: demo-tick 700ms cubic-bezier(.2,.8,.3,1.2) both; }
`;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The ring belongs to the screen it was tapped on (Aidan 2026-09-15: it
 *  was "pulsing on a place that is not relevant on the next screen"). So:
 *  a short flash, and anything still showing is cleared the moment the
 *  screen moves on. */
const RING_MS = 420;
function clearRings() { for (const el of Array.from(document.querySelectorAll('.demo-ring, .demo-dot'))) el.remove(); }
function ring(x: number, y: number) {
  for (const cls of ['demo-ring', 'demo-dot']) {
    const el = document.createElement('div');
    el.className = cls; el.style.left = `${x}px`; el.style.top = `${y}px`;
    document.body.appendChild(el); setTimeout(() => el.remove(), RING_MS + 40);
  }
}

/** Find one element by selector and visible text/label/placeholder, polling. */
async function find(sel: string, text: RegExp | null, timeoutMs = 20_000, enabled = true): Promise<HTMLElement> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const all = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((el) => {
      if (el.getClientRects().length === 0) return false;
      if (enabled && (el as HTMLButtonElement).disabled) return false;
      const label = el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? el.textContent ?? '';
      return text ? text.test(label.trim()) : true;
    });
    if (all[0]) return all[0];
    await sleep(100);
  }
  throw new Error(`demo: never found ${sel} ${text ?? ''}`);
}
const findDemo = (key: string, timeoutMs = 20_000) => find(`[data-demo="${key}"]`, null, timeoutMs);

async function bringIn(el: HTMLElement, settle: number) {
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await sleep(settle);
}
async function tap(el: HTMLElement, settle: number, hold: number) {
  await bringIn(el, settle);
  const r = el.getBoundingClientRect();
  ring(r.left + Math.min(r.width * 0.5, 140), r.top + r.height / 2);
  // A press you can see: the element dips while the ring flashes, and only
  // acts once the flash is over — so nothing carries into the next screen.
  const prev = el.style.transform; const prevT = el.style.transition;
  el.style.transition = 'transform 140ms ease'; el.style.transform = 'scale(0.96)';
  await sleep(200);
  el.style.transform = prev; setTimeout(() => { el.style.transition = prevT; }, 200);
  await sleep(RING_MS - 200 + 60);
  clearRings();
  el.click();
  await sleep(hold);
}
/** Type into a React-controlled input, one character at a time. */
async function type(el: HTMLInputElement | HTMLTextAreaElement, text: string, settle: number, delay: number) {
  await bringIn(el, settle);
  const r = el.getBoundingClientRect(); ring(r.left + 40, r.top + r.height / 2);
  el.focus(); await sleep(350);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  for (let i = 0; i < text.length; i++) {
    setter.call(el, text.slice(0, i + 1));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(typingDelay(text, i, [], delay));
  }
  await sleep(600);
}

const escapeHtml = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
/** A hook line is plain text plus the ranges that take the gradient:
 *  anything wrapped in *asterisks* (Aidan 2026-09-15: "purple black
 *  gradient a word by putting a tag on it"), and the recipient's word and
 *  name automatically. The asterisks never show. */
interface HookLine { text: string; ranges: Array<[number, number]> }
function parseHook(raw: string, words: string[]): HookLine {
  let text = ''; const ranges: Array<[number, number]> = []; let open = -1;
  for (const ch of raw) {
    if (ch === '*') { if (open < 0) open = text.length; else { if (text.length > open) ranges.push([open, text.length]); open = -1; } continue; }
    text += ch;
  }
  if (open >= 0 && text.length > open) ranges.push([open, text.length]);
  for (const w of words.filter(Boolean)) {
    const re = new RegExp(`(^|[^\\w])(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^\\w])`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) { const a = m.index + m[1].length; const len = m[2].length; if (!ranges.some(([x, y]) => a < y && a + len > x)) ranges.push([a, a + len]); }
  }
  return { text, ranges };
}
/** The line typed up to `n` characters, gradient ranges wrapped — a range
 *  still being typed colours as it lands. */
function hookHtml(line: HookLine, n: number) {
  const t = line.text.slice(0, n); let out = ''; let i = 0;
  const starts = [...line.ranges].sort((a, b) => a[0] - b[0]);
  for (const [a, b] of starts) {
    if (a >= t.length) break;
    out += escapeHtml(t.slice(i, a)); out += `<span class="who">${escapeHtml(t.slice(a, Math.min(b, t.length)))}</span>`; i = Math.min(b, t.length);
  }
  out += escapeHtml(t.slice(i));
  return out + '<span class="caret"></span>';
}
/** How long to wait AFTER the character at `i` has landed. Sentences
 *  breathe at full stops, commas take a beat, the recipient's name gets a
 *  pause before it lands and a hold after, words start a touch slower
 *  than they finish, and a deterministic jitter keeps it from reading as
 *  a metronome (Aidan 2026-09-15: "pauses on the right place"). */
function typingDelay(line: string, i: number, ranges: Array<[number, number]>, base = 42): number {
  const ch = line[i]; const next = line[i + 1] ?? '';
  const jitter = 0.75 + ((Math.sin((i + 1) * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.5; // 0.75–1.25, seeded
  let d = base * jitter;
  if (ch === '.' || ch === '!' || ch === '?') d += 520;            // end of a thought
  else if (ch === ',' || ch === ';' || ch === '—' || ch === '…') d += 230;  // a breath
  else if (ch === ' ') d += 40;                                    // between words
  if (next === ' ' || next === '') d += 10;                        // letting a word finish
  // a beat before a gradient word, a hold once it's complete
  for (const [x, y] of ranges) { if (i + 1 === x && ch === ' ') d += 280; if (i + 1 === y) d += 260; }
  return d;
}
/** One sentence per screen (Aidan 2026-09-16: "each sentence after a
 *  full stop should be typed on a different screen"). "Mum. 70. Lives in
 *  her garden." → three beats; *stars* and the recipient's gradient work
 *  inside each. */
function sentencesOf(raw: string): string[] {
  const out = raw.match(/[^.!?]+(?:[.!?]+["”’)]*)?\s*/g) ?? [raw];
  return out.map((x) => x.trim()).filter(Boolean);
}
async function typeHook(raw: string, words: string[]) {
  const hookEl = await find('.demo-hook', null, 5000).catch(() => null); if (!hookEl) return;
  const target = hookEl.querySelector('p')! as HTMLElement;
  target.style.transition = 'opacity 260ms ease, transform 260ms ease';
  const parts = sentencesOf(raw);
  await sleep(500); // a moment before the first letter
  for (let k = 0; k < parts.length; k++) {
    const line = parseHook(parts[k], words);
    target.style.opacity = '1'; target.style.transform = 'none';
    for (let i = 0; i < line.text.length; i++) {
      target.innerHTML = hookHtml(line, i + 1);
      // the full stop at the end of a screen holds below, not here
      await sleep(i === line.text.length - 1 ? 60 : typingDelay(line.text, i, line.ranges));
    }
    await sleep(k === parts.length - 1 ? 1500 : 1100); // read it
    if (k < parts.length - 1) {
      target.style.opacity = '0'; target.style.transform = 'translateY(-10px)';
      await sleep(300); target.innerHTML = '<span class="caret"></span>'; target.style.transform = 'translateY(10px)';
      await sleep(40); target.style.opacity = '1'; target.style.transform = 'none'; await sleep(360);
    }
  }
  hookEl.classList.add('out'); await sleep(650);
}

declare global { interface Window { __demo?: { state: string; events: Array<{ name: string; t: number }> } } }
function mark(name: string, state?: string) {
  const d = (window.__demo ??= { state: 'idle', events: [] });
  d.events.push({ name, t: Date.now() });
  if (state) { d.state = state; document.documentElement.dataset.demoState = state; }
}

// ── engine ───────────────────────────────────────────────────────────

interface Concept { front_text: string; inside_text?: string; art_direction: string; palette?: string; typeface?: string; direction?: string; format?: string }

async function post(path: string, body: unknown, timeoutMs = 120_000): Promise<any> {
  const r = await fetch(`/api/make/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message ?? `${path} failed (${r.status})`);
  return j;
}
const toDataUrl = async (url: string) => {
  const blob = await fetch(url).then((r) => r.blob());
  return new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error('read')); fr.readAsDataURL(blob); });
};
/** A phone photo the way the product sends one (make.tsx readCameoFile):
 *  decoded and oriented, no edge over 1600px, JPEG — so a full-size HEIC
 *  never reaches the model raw (2026-09-15: a photo of Mum came back as
 *  the same card without her). */
async function preparePhoto(file: Blob): Promise<string> {
  const asDataUrl = () => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read failed')); r.readAsDataURL(file); });
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
    cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close();
    return cv.toDataURL('image/jpeg', 0.9);
  } catch { return await asDataUrl(); }
}

type Phase = 'countdown' | 'brief' | 'generating' | 'results' | 'photo' | 'photo-generating' | 'photo-result' | 'inside' | 'inside-generating' | 'card' | 'send' | 'sent';

// ── the page ─────────────────────────────────────────────────────────

/** Every screen enters rising and fading in, and leaves fading out — a
 *  cut between two flat screens reads as a glitch on video. */
const SCREEN = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.5, ease: [0.2, 0.7, 0.3, 1] } } as const;

const H1 = 'font-display text-[26px] leading-[1.15] font-bold tracking-[-0.015em] text-keeper-ink';
const PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-full bg-keeper-ink px-6 py-3.5 text-[15px] font-semibold text-keeper-paper';
const QUIET = 'text-[14px] text-keeper-meta underline decoration-keeper-hair underline-offset-4';
const TILE = 'flex w-full flex-col items-start gap-1 rounded-2xl border border-keeper-hair bg-white/85 px-5 py-4 text-left';

// ── the photo picker (Aidan 2026-09-16: "some kind of photo picker
// animation") — a phone-style Recents sheet. Their photo sits among real
// source photos from the site; only theirs is pickable. Tap → numbered
// tick → the sheet drops and the photo flies into the tile. ──
const ROLL: Array<{ src: string; pos?: string }> = [
  { src: '/hero-source-photo.webp' }, { src: '/proof-bigben-source.webp' }, { src: '/handover-blank.webp' },
  { src: '/hero-real-source.webp', pos: '50% 30%' }, { src: '' /* theirs */ }, { src: '/reaction-poster.webp', pos: '50% 12%' },
  { src: '/proof-timessquare-source.webp' }, { src: '/hero-source-photo.webp', pos: '85% 50%' }, { src: '/reaction-poster.webp', pos: '50% 60%' },
];
function PhotoPicker({ photo, onPick, onCancel }: { photo: string; onPick: (from: DOMRect) => void; onCancel: () => void }) {
  const [chosen, setChosen] = useState(false);
  const theirs = useRef<HTMLButtonElement>(null);
  const choose = () => {
    if (chosen) return; setChosen(true);
    window.setTimeout(() => { const r = theirs.current?.getBoundingClientRect(); if (r) onPick(r); }, 520);
  };
  return (
    <motion.div key="picker" className="fixed inset-0 z-40" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
      <motion.div className="absolute inset-0 bg-[#211D19]" initial={{ opacity: 0 }} animate={{ opacity: 0.32 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} onClick={onCancel} />
      <motion.div
        className="absolute inset-x-0 bottom-0 rounded-t-[22px] bg-white pb-8 shadow-[0_-20px_60px_rgba(33,29,25,0.25)]"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}>
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-stone-300" />
        <div className="flex items-center justify-between px-5 pb-3 pt-3">
          <button type="button" onClick={onCancel} className="text-[15px] text-brand">Cancel</button>
          <p className="text-[16px] font-semibold text-keeper-ink">Recents</p>
          <span className="w-[52px]" />
        </div>
        <div className="grid grid-cols-3 gap-[2px]">
          {ROLL.map((t, i) => {
            const mine = !t.src;
            return (
              <motion.button key={i} ref={mine ? theirs : undefined} type="button" data-demo={mine ? 'picker-photo' : undefined}
                onClick={mine ? choose : undefined}
                className="relative aspect-square overflow-hidden bg-stone-100"
                initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.12 + i * 0.035, duration: 0.3, ease: 'easeOut' }}>
                {/* Other people's photos are blurred (and scaled so the blur has
                    no soft edge); only theirs is sharp. */}
                <img src={mine ? photo : t.src} alt="" className={`h-full w-full object-cover ${mine ? '' : 'scale-110 blur-[7px]'}`} style={{ objectPosition: t.pos ?? '50% 50%' }} />
                {mine && chosen && (
                  <>
                    <motion.span className="absolute inset-0 border-[3px] border-brand bg-brand/15" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} />
                    <motion.span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand text-[12px] font-bold text-white"
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>1</motion.span>
                  </>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

function DemoRun({ cfg }: { cfg: DemoConfig }) {
  const preset = cfg; const hook = cfg.hook; const beats = BEATS[cfg.speed];
  const [phase, setPhase] = useState<Phase>(cfg.countdown > 0 ? 'countdown' : 'brief');
  const phaseRef = useRef<Phase>(phase); phaseRef.current = phase;
  const [count, setCount] = useState(cfg.countdown);
  // While the hook types, the question panel waits out of sight (the hook
  // overlay is see-through so the backdrop icons show).
  const [hookOn, setHookOn] = useState(cfg.hook);
  const [brief, setBrief] = useState<Brief>(emptyBrief());
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [fronts, setFronts] = useState<string[]>([]);
  const [picked, setPicked] = useState(0);
  const [slide, setSlide] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cameoUrl, setCameoUrl] = useState<string | null>(null);
  const [useCameo, setUseCameo] = useState(false);
  const [dear, setDear] = useState(''); const [message, setMessage] = useState(''); const [from, setFrom] = useState('');
  const [insideUrl, setInsideUrl] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [error, setError] = useState('');
  const railRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  // The picker: the prepared photo it offers, whether it's up, and the
  // photo in flight from the grid to the tile.
  const [pickerPhoto, setPickerPhoto] = useState<string | null>(null);
  const pickerPhotoRef = useRef<string | null>(null); pickerPhotoRef.current = pickerPhoto;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [flight, setFlight] = useState<{ src: string; from: DOMRect; to: DOMRect } | null>(null);
  const photoUrlRef = useRef<string | null>(null); photoUrlRef.current = photoUrl;
  const openPicker = async () => {
    if (photoUrlRef.current || pickerOpen) return;
    if (!cfg.photo) { fileRef.current?.click(); return; }
    const prepared = pickerPhotoRef.current ?? await preparePhoto(await fetch(cfg.photo).then((r) => r.blob()));
    setPickerPhoto(prepared); setPickerOpen(true);
  };
  const landPhoto = (from: DOMRect) => {
    const src = pickerPhotoRef.current; const tile = document.querySelector('[data-demo="add-photo"]');
    setPickerOpen(false);
    if (!src || !tile) return;
    setFlight({ src, from, to: tile.getBoundingClientRect() });
    window.setTimeout(() => { setPhotoUrl(src); setFlight(null); }, 760);
  };
  // Latest engine state for the director's async steps.
  const conceptsRef = useRef<Concept[]>([]); conceptsRef.current = concepts;
  const pickedRef = useRef(0); pickedRef.current = picked;
  const wordsRef = useRef({ dear: '', message: '', from: '' }); wordsRef.current = { dear, message, from };

  const who = whoPhrase({ who: brief.who || preset.who, name: '' });
  const chosenFront = useCameo && cameoUrl ? cameoUrl : fronts[picked];
  // An engine failure ends the run visibly — and tells the recorder.
  const fail = (e: any) => { const m = e?.message ?? 'That didn’t work'; setError(m); mark(`FAILED: ${m}`, 'failed'); };
  const until = async (p: Phase, timeoutMs: number) => { const t0 = Date.now(); while (phaseRef.current !== p) { if (Date.now() - t0 > timeoutMs) throw new Error(`demo: still waiting for ${p}`); await sleep(150); } };

  // ── engine steps (what the product does) ──
  const generate = async (b: Brief) => {
    setPhase('generating'); mark('generating', 'generating');
    const ageNum = ageOf(b); const isKid = isKidBrief(b);
    const j = await post('concepts', {
      occasion: occasionLabelFor(b), who: b.who.trim() || 'Anyone', gender: b.gender ?? undefined, tone: isKid && b.vibe === 'rude' ? 'funny' : b.vibe,
      pipeline: 'celebrait', characters: 'objects', insideMode: 'auto', freeStyle: true, freeComposition: true, age: ageNum,
      interest: b.thing.trim() || undefined, dislikes: b.cant.trim() || undefined, recipientName: b.name.trim() || undefined, frontWord: frontWordOf(b), memory: true,
    });
    const cs: Concept[] = j.concepts ?? [];
    if (!cs.length) throw new Error('Nothing came back');
    setConcepts(cs); setMessage(cs[0].inside_text ?? '');
    const urls = await Promise.all(cs.map((c) => post('render', { front_text: c.front_text, art_direction: c.art_direction, palette: c.palette, typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true }).then((r) => r.imageUrl as string)));
    setFronts(urls); setPhase('results'); mark('results', 'results');
  };
  const renderCameo = async (photo: string) => {
    const c = conceptsRef.current[pickedRef.current];
    setPhase('photo-generating'); mark('photo: generating', 'photo');
    const draw = () => post('render', { front_text: c.front_text, art_direction: c.art_direction, palette: c.palette, typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true, cameoPhoto: photo, cameoMode: 'redraw' });
    let r = await draw();
    // The same vision check the product runs, then one quiet retry if
    // she isn't in it — a demo can't show "we think this came out wrong".
    try {
      const qa = await post('cameo-check', { cardImage: r.imageUrl, cameoPhoto: photo }, 30_000);
      if (qa?.result?.verdict === 'bad') { mark('photo: redraw'); r = await draw(); }
    } catch { /* fail open: show what we have */ }
    setCameoUrl(r.imageUrl); setPhase('photo-result'); mark('photo: done', 'photo-result');
  };
  const renderInside = async () => {
    const c = conceptsRef.current[pickedRef.current]; const w = wordsRef.current;
    setPhase('inside-generating'); mark('inside: generating', 'inside');
    const joined = [w.dear.trim(), w.message.trim(), w.from.trim()].filter(Boolean).join('\n\n');
    const r = await post('render-inside', { ...(joined ? { mode: 'own', message: joined } : { mode: 'blank' }), palette: c.palette, typeface: c.typeface, art_direction: c.art_direction, characters: 'objects', freeStyle: true, direction: c.direction });
    setInsideUrl(r.imageUrl); setPhase('card'); mark('inside: done', 'card');
  };

  // ── the director (what the thumb does) ──
  const direct = async () => {
    const b = beats; const p = preset;
    mark('brief: open', 'brief');
    if (hook) { await typeHook(p.hookLine, [p.who, p.name]); setHookOn(false); mark('hook: done'); }
    await sleep(600);
    const B = (re: RegExp) => find('button', re);
    await tap(await B(new RegExp(`^${p.who}$`)), b.settle, b.hold); mark(`who: ${p.who}`);
    // Partner / mate / friend don't auto-advance (the brief offers a him/her row) — tap Next.
    if (!(await find('button', new RegExp(`^${p.occasion}`), 1200).catch(() => null))) await tap(await B(/^Next/), b.settle * 0.5, b.hold * 0.6);
    await tap(await B(new RegExp(`^${p.occasion}`)), b.settle, b.hold); mark(`occasion: ${p.occasion}`);
    await type(await find('input', /Their age/) as HTMLInputElement, p.age, b.settle, b.type * 1.8);
    await tap(await B(/^Next/), b.settle, b.hold * 0.75); mark(`age: ${p.age}`);
    await tap(await B(new RegExp(p.vibe)), b.settle, b.hold); mark(`vibe: ${p.vibe}`);
    await type(await find('textarea', null) as HTMLTextAreaElement, p.thing, b.settle, b.type);
    await tap(await B(/^Next/), b.settle, b.hold * 0.6); mark('interest: next');
    const addIt = await find('button', /^Add it/, 2500, false).catch(() => null);
    if (addIt) {
      await type(await find('input', /rival team/i) as HTMLInputElement, p.cant, b.settle, b.type);
      await tap(await B(/^Add it/), b.settle, b.hold * 0.75); mark("can't stand: added");
    }
    if (p.front === 'name') {
      await tap(await B(/^Their name$/), b.settle, b.hold * 0.6);
      await type(await find('input', /Their first name/) as HTMLInputElement, p.name, b.settle, b.type * 1.5);
    } else if (p.front === 'none') {
      await tap(await B(/^Nothing$/), b.settle, b.hold * 0.6);
    } else {
      await tap(await B(new RegExp(`^${p.who}$`)), b.settle, b.hold * 0.6);
    }
    mark(`front: ${p.front}`);
    await tap(await B(/Design my three cards/), b.settle, 300);

    await until('results', 300_000); await sleep(b.look);
    // Swipe through the options, come back to the first.
    // The carousel mounts once the screen transition finishes — wait for it.
    { const t0 = Date.now(); while (!railRef.current && Date.now() - t0 < 10_000) await sleep(80); }
    const rail = railRef.current; if (!rail) throw new Error('demo: the options never appeared');
    const w = rail.clientWidth;
    for (const i of [1, 2, 0]) { rail.scrollTo({ left: i * w, behavior: 'smooth' }); await sleep(b.walk); }
    await tap(await findDemo('choose'), b.settle, b.hold); mark('picked card 1');

    // The photo.
    if (p.photo) {
      await sleep(b.look * 0.5);
      setPickerPhoto(await preparePhoto(await fetch(p.photo).then((r) => r.blob())));
      await tap(await findDemo('add-photo'), b.settle, 300);
      const mine = await findDemo('picker-photo', 8000); await sleep(900); // the grid settles
      await tap(mine, b.settle * 0.8, 200);
      { const t0 = Date.now(); while (!photoUrlRef.current && Date.now() - t0 < 5000) await sleep(80); }
      mark('photo: added'); await sleep(b.hold);
      await tap(await findDemo('put-in'), b.settle, 300);
      await until('photo-result', 240_000); await sleep(b.look);
      await tap(await findDemo('keep-cameo'), b.settle, b.hold * 0.6); mark('photo: kept');
    } else {
      await sleep(b.look * 0.5);
      await tap(await findDemo('no-photo'), b.settle, b.hold * 0.6); mark('photo: skipped');
    }

    // The inside.
    await type(await findDemo('dear') as HTMLInputElement, p.dear, b.settle, b.type);
    await type(await findDemo('from') as HTMLInputElement, p.from, b.settle, b.type);
    await tap(await findDemo('design-inside'), b.settle, 300);
    await until('card', 240_000); await sleep(b.look);

    // The card, tapped open.
    const card = await findDemo('card');
    const r = card.getBoundingClientRect(); ring(r.left + r.width / 2, r.top + r.height / 2); await sleep(120);
    setCardOpen(true); mark('card: open'); await sleep(b.look * 1.8);
    await tap(await findDemo('send'), b.settle, b.hold * 0.6);

    // Where it's going.
    await until('send', 10_000); await sleep(b.look * 0.6);
    await tap(await findDemo('send-them'), b.settle, 300); mark('send: them');
    await until('sent', 10_000); await sleep(b.look * 1.4);
    mark('end', 'end');
  };

  useEffect(() => {
    const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);
  useEffect(() => {
    if (started.current) return; started.current = true;
    window.__demo = { state: 'idle', events: [] };
    let n = cfg.countdown;
    const tick = window.setInterval(() => { n -= 1; setCount(n); if (n <= 0) { window.clearInterval(tick); setPhase('brief'); } }, 1000);
    if (cfg.mode === 'manual') {
      // Aidan drives. His taps get the ring; the hook types itself then steps aside.
      // A glowing violet cursor for mouse/trackpad (touch has none to replace).
      const cur = document.createElement('div'); cur.className = 'demo-cursor'; document.body.appendChild(cur);
      document.documentElement.classList.add('demo-cursor-on');
      const onMove = (e: PointerEvent) => {
        if (e.pointerType === 'touch') { cur.style.opacity = '0'; return; }
        cur.style.opacity = '1'; cur.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        const hit = (e.target as HTMLElement | null)?.closest?.('button, a, input, textarea, [role="button"], label');
        cur.classList.toggle('over', !!hit);
      };
      const onLeave = () => { cur.style.opacity = '0'; };
      const onDown = (e: PointerEvent) => { ring(e.clientX, e.clientY); cur.classList.add('down'); };
      const onUp = () => cur.classList.remove('down');
      const onClick = () => { window.setTimeout(clearRings, 140); };
      window.addEventListener('pointermove', onMove, true);
      document.addEventListener('mouseleave', onLeave);
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('click', onClick, true);
      const t = window.setTimeout(() => {
        if (!cfg.hook) return;
        void typeHook(cfg.hookLine, [cfg.who, cfg.name]).then(() => setHookOn(false));
      }, cfg.countdown * 1000 + (cfg.countdown > 0 ? 1600 : 900));
      return () => { window.clearTimeout(t); window.clearInterval(tick); window.removeEventListener('pointermove', onMove, true); document.removeEventListener('mouseleave', onLeave); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointerup', onUp, true); window.removeEventListener('click', onClick, true); cur.remove(); document.documentElement.classList.remove('demo-cursor-on'); };
    }
    const t = window.setTimeout(() => { direct().catch((e) => { setError(e?.message ?? String(e)); mark(`FAILED: ${e?.message ?? e}`, 'failed'); console.error('[DEMO]', e); }); }, cfg.countdown * 1000 + (cfg.countdown > 0 ? 1600 : 900)); // let the countdown fade out first
    return () => { window.clearTimeout(t); window.clearInterval(tick); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { clearRings(); }, [phase]);
  // The run saves itself at "It's on the way" — the assets behind a
  // produced social video (see /admin/demo-runs). Fire and forget.
  const savedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'sent' || savedRef.current || fronts.length === 0) return;
    savedRef.current = true;
    const beats = (window.__demo?.events ?? []); const t0 = beats[0]?.t ?? Date.now();
    void fetch('/api/admin/demo-runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: cfg.mode, label: `${who}, ${brief.age || cfg.age} · ${occasionLabelFor(brief)}`,
        brief, hookLine: cfg.hook ? cfg.hookLine : undefined, concepts, fronts, pickedIndex: picked,
        photo: photoUrl ?? undefined, cameo: cameoUrl ?? undefined, inside: insideUrl ?? undefined,
        words: { dear, message, from }, beats: beats.map((e) => ({ name: e.name, t: e.t - t0 })),
      }),
    }).then((r) => { if (!r.ok) console.warn('[DEMO] save failed', r.status); }).catch((e) => console.warn('[DEMO] save failed', e));
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRailScroll = () => { const el = railRef.current; if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth)); };

  return (
    <div className="keeper-serif fixed inset-0 overflow-hidden">
      {/* The make page's own backdrop: cream wash + the floating celebration icons. */}
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      {hook && <div className="demo-hook" aria-hidden="true"><p><span className="caret" /></p></div>}
      <div className="absolute left-5 top-5 z-10"><img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" /></div>
      {error && <p className="absolute inset-x-5 bottom-5 z-20 rounded-xl bg-accent-red-light px-4 py-3 text-sm text-accent-red-dark">{error}</p>}

      <AnimatePresence>
        {pickerOpen && pickerPhoto && <PhotoPicker photo={pickerPhoto} onPick={landPhoto} onCancel={() => setPickerOpen(false)} />}
      </AnimatePresence>
      {flight && (
        <motion.img src={flight.src} alt="" className="pointer-events-none fixed z-50 object-cover shadow-[0_30px_60px_-20px_rgba(33,29,25,0.45)]"
          initial={{ left: flight.from.left, top: flight.from.top, width: flight.from.width, height: flight.from.height, borderRadius: 2 }}
          animate={{ left: flight.to.left, top: flight.to.top, width: flight.to.width, height: flight.to.height, borderRadius: 16 }}
          transition={{ duration: 0.72, ease: [0.3, 0.8, 0.25, 1] }} />
      )}

      <AnimatePresence mode="wait">
      {/* 0 · time to hit record */}
      {phase === 'countdown' && (
        <motion.section key="countdown" {...SCREEN} className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="font-display text-[88px] font-bold leading-none text-keeper-ink">{count}</p>
          <p className="text-[14px] text-keeper-meta">Start your screen recording</p>
        </motion.section>
      )}

      {/* 1 · the brief */}
      {phase === 'brief' && (
        <motion.section key="brief" {...SCREEN} className="absolute inset-0 flex flex-col justify-start px-5 pt-[24vh]" /* top edge pinned: only the bottom moves between questions */>
          <motion.div className="rounded-2xl border border-keeper-hair bg-white/85 p-5" initial={false} animate={{ opacity: hookOn ? 0 : 1, y: hookOn ? 12 : 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
            <BriefQuestions skin="landing" minimal brief={brief} onChange={setBrief} hideDots onDone={(b) => { setBrief(b); generate(b).catch(fail); }} />
          </motion.div>
        </motion.section>
      )}

      {/* 2 · generating — a blank card breathing violet */}
      {(phase === 'generating' || phase === 'photo-generating' || phase === 'inside-generating') && (
        <motion.section key="generating" {...SCREEN} className="absolute inset-0 flex flex-col items-center justify-center gap-7 px-5">
          <div className="demo-glow-card" />
          {/* Readable on a phone video: sentence case, bigger, darker. */}
          <p className="max-w-[300px] text-center text-[18px] font-medium leading-snug text-keeper-ink">
            {phase === 'generating' ? `Generating 3 front of card choices for ${who}` : phase === 'photo-generating' ? `Adding the photo of ${who}` : 'Assembling the card'}
          </p>
        </motion.section>
      )}

      {/* 3 · option 1 / 2 / 3 */}
      {phase === 'results' && (
        <motion.section key="results" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-0 py-16 text-center">
          <div className="px-5"><h1 className={H1}>Three cards for {who}.</h1><p className="mt-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-keeper-meta">Option {slide + 1} of 3</p></div>
          <div ref={railRef} onScroll={onRailScroll} className="demo-rail -my-4 flex shrink-0 snap-x snap-mandatory overflow-x-auto py-12">
            {fronts.map((u, i) => (
              <div key={i} className="flex w-full shrink-0 snap-center items-center justify-center px-8">
                <div className="w-[min(76vw,44vh,340px)] shrink-0"><AjarTile imageUrl={u} alt={concepts[i]?.front_text ?? ''} eager openDeg={22} /></div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[13px] text-keeper-meta">Swipe to see the others</p>
          <div className="mt-7 flex flex-col items-center gap-3 px-5">
            <button type="button" data-demo="choose" className={`${PRIMARY} demo-pulse w-full`} onClick={() => { setPicked(slide); setPhase('photo'); }}>Choose this one</button>
          </div>
        </motion.section>
      )}

      {/* 4 · add a photo? */}
      {phase === 'photo' && (
        <motion.section key="photo" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-5 py-16 text-center">
          <h1 className={H1}>Add a photo of {who}?</h1>
          <p className="mt-2 text-[15px] text-keeper-body">We redesign this card with them in it.</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void preparePhoto(f).then(setPhotoUrl); e.target.value = ''; }} />
          <button type="button" data-demo="add-photo" onClick={() => { void openPicker(); }}
            className={`mt-6 flex aspect-[4/5] w-[min(70vw,40vh,260px)] shrink-0 items-center justify-center self-center overflow-hidden rounded-2xl border-2 ${photoUrl ? 'border-brand' : 'border-dashed border-keeper-hair bg-white/70'}`}>
            {photoUrl
              ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              : !flight && <span className="flex flex-col items-center gap-2 text-keeper-meta"><Camera className="h-7 w-7" strokeWidth={1.5} /><span className="text-[14px] font-medium">Add a photo</span></span>}
          </button>
          <div className="mt-8 flex flex-col items-center gap-4">
            {photoUrl || flight
              ? <button type="button" data-demo="put-in" className={`${PRIMARY} demo-pulse w-full`} onClick={() => { if (photoUrl) renderCameo(photoUrl).catch(fail); }}><Sparkles className="h-4 w-4 text-cta" /> Put {who} in it</button>
              : <button type="button" data-demo="no-photo" className={QUIET} onClick={() => setPhase('inside')}>No photo — carry on</button>}
          </div>
        </motion.section>
      )}

      {/* 5 · there they are */}
      {phase === 'photo-result' && cameoUrl && (
        <motion.section key="photo-result" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-5 py-16 text-center">
          <h1 className={H1}>There’s {who}.</h1>
          <div className="mt-8 mb-3 w-[min(76vw,44vh,340px)] shrink-0 self-center"><AjarTile imageUrl={cameoUrl} alt="" eager openDeg={22} /></div>
          <div className="mt-8 flex flex-col items-center gap-4">
            <button type="button" data-demo="keep-cameo" className={`${PRIMARY} demo-pulse w-full`} onClick={() => { setUseCameo(true); setPhase('inside'); }}>Keep this one</button>
            <button type="button" data-demo="keep-original" className={QUIET} onClick={() => { setUseCameo(false); setPhase('inside'); }}>Keep the original</button>
          </div>
        </motion.section>
      )}

      {/* 6 · the inside */}
      {phase === 'inside' && (
        <motion.section key="inside" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-5 py-16 text-center">
          <h1 className={H1}>Now the inside.</h1>
          <div className="mt-5 flex flex-col gap-3">
            <input data-demo="dear" style={{ textAlign: 'left' }} value={dear} onChange={(e) => setDear(e.target.value)} placeholder={`Dear ${who},`} className="h-12 rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none" />
            <textarea data-demo="message" style={{ textAlign: 'left' }} value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="demo-glow-field rounded-2xl border border-keeper-hair bg-white/95 px-4 py-3 text-[16px] leading-relaxed text-keeper-ink focus:outline-none" />
            <input data-demo="from" style={{ textAlign: 'left' }} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Love, …" className="h-12 rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none" />
          </div>
          <div className="mt-6 flex flex-col items-center">
            <button type="button" data-demo="design-inside" className={`${PRIMARY} demo-pulse w-full`} onClick={() => renderInside().catch(fail)}><Sparkles className="h-4 w-4 text-cta" /> Design the inside</button>
          </div>
        </motion.section>
      )}

      {/* 7 · the card, tap to open */}
      {phase === 'card' && chosenFront && (
        <motion.section key="card" {...SCREEN} className="absolute inset-0 flex flex-col px-5 pb-6 pt-16 text-center">
          <h1 className={H1}>There it is.</h1>
          {/* The card takes the room and may draw past its box; the button
              is pushed to the bottom and can go (Aidan 2026-09-15: "it's
              not that important to see here"). */}
          <div data-demo="card" className="mx-auto mt-2 h-[min(60vh,92vw)] w-full shrink-0 overflow-visible">
            {/* Big and centred; the open cover may swing past the edge (Aidan
                2026-09-15: "bigger… it can open off screen"). */}
            <Card3DViewer frontImageUrl={chosenFront} insideImageUrl={insideUrl} open={cardOpen} onOpenChange={setCardOpen} enableRotate={false} enableZoom={false} closedAngle={-0.38} restYaw={-0.12} framingMargin={1.4} minDistance={1.4} className="h-full w-full" />
          </div>
          <p className="mt-1 text-center text-[13px] text-keeper-meta">{cardOpen ? ' ' : 'Tap to open'}</p>
          <div className="mt-auto flex flex-col items-center pt-3">
            <button type="button" data-demo="send" className={`${PRIMARY} ${cardOpen ? 'demo-pulse' : ''} w-full`} onClick={() => setPhase('send')}>Send it</button>
          </div>
        </motion.section>
      )}

      {/* 8 · where's it going? */}
      {phase === 'send' && (
        <motion.section key="send" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-5 py-16 text-center">
          <h1 className={H1}>Where’s it going?</h1>
          <div className="mt-6 flex flex-col gap-3">
            <button type="button" data-demo="send-them" className={`${TILE} demo-pulse text-left`} onClick={() => { setPhase('sent'); mark('sent', 'sent'); }}>
              <span className="text-[16px] font-semibold text-keeper-ink">Straight to {who}</span>
              <span className="text-[13px] text-keeper-meta">Addressed to them, posted tracked</span>
            </button>
            <button type="button" data-demo="send-me" className={`${TILE} text-left`} onClick={() => { setPhase('sent'); mark('sent', 'sent'); }}>
              <span className="text-[16px] font-semibold text-keeper-ink">To me first</span>
              <span className="text-[13px] text-keeper-meta">To hand over in person</span>
            </button>
          </div>
        </motion.section>
      )}

      {/* 9 · on its way */}
      {phase === 'sent' && (
        <motion.section key="sent" {...SCREEN} className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <span className="demo-tick flex h-20 w-20 items-center justify-center rounded-full bg-cta text-cta-foreground"><Check className="h-10 w-10" strokeWidth={3} /></span>
          <h1 className={H1}>It’s on the way.</h1>
          <p className="text-[15px] text-keeper-body">Printed today, posted tracked.<br />Expect it by <span className="font-semibold text-keeper-ink">{formatDayMonth(expectedBy())}</span>.</p>
        </motion.section>
      )}
      </AnimatePresence>
    </div>
  );
}


// ── the builder: make a demo ──────────────────────────────────────────

const NAME_LIKE = ['Mum', 'Dad', 'Nan', 'Grandad'];
const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-[14px] font-medium transition-colors ${on ? 'border-brand bg-brand-muted text-brand-dark' : 'border-keeper-hair bg-white/80 text-keeper-ink hover:border-brand/60'}`;
const field = 'h-11 w-full rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none focus:border-brand';
const label = 'mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.14em] text-keeper-meta';

function DemoSetup({ onRun }: { onRun: (cfg: DemoConfig) => void }) {
  const [cfg, setCfg] = useState<DemoConfig>({ ...DEMO_PRESETS['mum-70-garden'], speed: 'normal', hook: true, countdown: 3, mode: 'manual' });
  const manual = cfg.mode === 'manual';
  const set = (patch: Partial<DemoConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const canRole = NAME_LIKE.includes(cfg.who);
  const readPhoto = (f: File) => { const r = new FileReader(); r.onload = () => set({ photo: String(r.result) }); r.readAsDataURL(f); };
  const ready = manual || (cfg.who && cfg.occasion && cfg.thing.trim() && (cfg.front !== 'name' || cfg.name.trim()));
  return (
    <div className="keeper-serif relative min-h-screen">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <div className="mx-auto max-w-xl px-5 pb-24 pt-8">
        <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" />
        <h1 className={`${H1} mt-6`}>Make a demo.</h1>
        <p className="mt-1 text-[14px] text-keeper-body">{manual ? 'Press Run, start your screen recording during the countdown, then tap through it yourself.' : 'Set the brief, press Run, start your screen recording during the countdown. The page does the rest.'}</p>

        <div className="mt-6"><span className={label}>Who drives</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(manual)} onClick={() => set({ mode: 'manual' })}>I tap through it</button>
            <button type="button" className={chip(!manual)} onClick={() => set({ mode: 'auto' })}>It plays itself</button>
          </div>
        </div>

        {!manual && <div className="mt-5 flex flex-wrap gap-2">
          {Object.entries(DEMO_PRESETS).map(([k, p]) => (
            <button key={k} type="button" className={chip(false)} onClick={() => set({ ...p })}>{p.who}, {p.age}</button>
          ))}
        </div>}

        <div className="mt-7 space-y-6">
          {!manual && <>
          <div><span className={label}>Who</span>
            <div className="flex flex-wrap gap-2">{RECIPIENTS.map((r) => <button key={r.label} type="button" className={chip(cfg.who === r.label)} onClick={() => set({ who: r.label, front: NAME_LIKE.includes(r.label) ? 'role' : cfg.name.trim() ? 'name' : 'none' })}>{r.label}</button>)}</div>
          </div>
          <div><span className={label}>Occasion</span>
            <div className="flex flex-wrap gap-2">{['Birthday', 'Christmas', 'Anniversary', 'Wedding'].map((o) => <button key={o} type="button" className={chip(cfg.occasion === o)} onClick={() => set({ occasion: o })}>{o}</button>)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className={label}>Age</span><input value={cfg.age} onChange={(e) => set({ age: e.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" className={field} placeholder="60" /></div>
            <div><span className={label}>Vibe</span>
              <div className="flex flex-wrap gap-2">{(['Light humour', 'Warm', 'Cheeky'] as const).map((v) => <button key={v} type="button" className={chip(cfg.vibe === v)} onClick={() => set({ vibe: v })}>{v}</button>)}</div>
            </div>
          </div>
          <div><span className={label}>Their thing</span><textarea value={cfg.thing} onChange={(e) => set({ thing: e.target.value.slice(0, 120) })} rows={2} className="w-full rounded-2xl border border-keeper-hair bg-white/90 px-4 py-3 text-[15px] text-keeper-ink focus:outline-none focus:border-brand" /></div>
          <div><span className={label}>Can’t stand (humour only)</span><input value={cfg.cant} onChange={(e) => set({ cant: e.target.value.slice(0, 60) })} className={field} placeholder="Getting up before 6am" /></div>
          <div><span className={label}>On the front</span>
            <div className="flex flex-wrap gap-2">
              {canRole && <button type="button" className={chip(cfg.front === 'role')} onClick={() => set({ front: 'role' })}>{cfg.who}</button>}
              <button type="button" className={chip(cfg.front === 'name')} onClick={() => set({ front: 'name' })}>Their name</button>
              <button type="button" className={chip(cfg.front === 'none')} onClick={() => set({ front: 'none' })}>Nothing</button>
            </div>
            {cfg.front === 'name' && <input value={cfg.name} onChange={(e) => set({ name: e.target.value.slice(0, 40) })} className={`${field} mt-2`} placeholder="Their first name" />}
          </div>
          </>}
          {!manual && <div className="grid grid-cols-2 gap-3">
            <div><span className={label}>Dear</span><input value={cfg.dear} onChange={(e) => set({ dear: e.target.value })} className={field} /></div>
            <div><span className={label}>From</span><input value={cfg.from} onChange={(e) => set({ from: e.target.value })} className={field} /></div>
          </div>}
          <div><span className={label}>{manual ? 'Photo of them (optional — or pick one live from the tile)' : 'Photo of them'}</span>
            <div className="flex items-center gap-3">
              <label className={`${chip(false)} cursor-pointer`}>Choose photo<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readPhoto(f); e.target.value = ''; }} /></label>
              {cfg.photo && <img src={cfg.photo} alt="" className="h-12 w-12 rounded-lg object-cover" />}
              {cfg.photo && <button type="button" className={QUIET} onClick={() => set({ photo: undefined })}>No photo step</button>}
            </div>
          </div>
          <div><span className={label}>Opening line</span>
            <div className="flex flex-wrap gap-2"><button type="button" className={chip(cfg.hook)} onClick={() => set({ hook: true })}>Typed hook</button><button type="button" className={chip(!cfg.hook)} onClick={() => set({ hook: false })}>Straight in</button></div>
            {cfg.hook && <textarea value={cfg.hookLine} onChange={(e) => set({ hookLine: e.target.value.slice(0, 140) })} rows={2} className="mt-2 w-full rounded-2xl border border-keeper-hair bg-white/90 px-4 py-3 text-[15px] text-keeper-ink focus:outline-none focus:border-brand" />}
            {cfg.hook && <p className="mt-1.5 text-[12px] text-keeper-meta">Wrap a word in *asterisks* for the purple-to-black gradient. The recipient’s word gets it anyway.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!manual && <div><span className={label}>Pace</span><div className="flex gap-2"><button type="button" className={chip(cfg.speed === 'normal')} onClick={() => set({ speed: 'normal' })}>Normal</button><button type="button" className={chip(cfg.speed === 'fast')} onClick={() => set({ speed: 'fast' })}>Fast</button></div></div>}
            <div><span className={label}>Countdown</span><div className="flex gap-2">{[0, 3, 5, 10].map((n) => <button key={n} type="button" className={chip(cfg.countdown === n)} onClick={() => set({ countdown: n })}>{n}s</button>)}</div></div>
          </div>
        </div>

        <button type="button" disabled={!ready} onClick={() => onRun(cfg)} className={`${PRIMARY} mt-9 w-full disabled:opacity-40`}><Play className="h-4 w-4 text-cta" /> Run the demo</button>
        <p className="mt-3 text-center text-[12px] text-keeper-meta">Each run spends one set of generations.</p>
      </div>
    </div>
  );
}

export default function DemoPage() {
  const q = useMemo(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''), []);
  // A preset in the link runs straight away (the recorder's path); otherwise the builder.
  const fromLink = useMemo<DemoConfig | null>(() => {
    const p = DEMO_PRESETS[q.get('preset') ?? ''];
    return p ? { ...p, speed: q.get('speed') === 'fast' ? 'fast' : 'normal', hook: q.get('hook') === 'typed', countdown: 0, mode: 'auto' } : null;
  }, [q]);
  const [cfg, setCfg] = useState<DemoConfig | null>(fromLink);
  useEffect(() => { const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m); return () => { m.remove(); }; }, []);
  return cfg ? <DemoRun cfg={cfg} /> : <DemoSetup onRun={setCfg} />;
}
