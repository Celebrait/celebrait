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
//   /demo?preset=dad-60-canal               (no photo → the photo screen is skipped)
//   /demo?…&speed=fast                       tighter beats for a 30s cut
//
// Admin-only (every load spends real generations) and noindex. The
// recorder (scratchpad rec/record-demo.mjs) reads window.__demo for
// beats + timestamps and stops on state 'end'.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Camera, Sparkles, Play, Send, Loader2 } from 'lucide-react';
import { BriefQuestions, RECIPIENTS, defaultFront, emptyBrief, occasionLabelFor, ageOf, isKidBrief, whoPhrase, frontWordOf, type Brief } from '@/components/brief-questions';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { expectedBy, formatDayMonth } from '@shared/pricing';
import celebraitLogo from '@/assets/celebrait.webp';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';

// ── versions ─────────────────────────────────────────────────────────

export interface DemoPreset {
  /** Chip labels exactly as the brief shows them. */
  who: string; occasion: string; age: string; vibe: 'Light humour' | 'Warm' | 'Cheeky' | 'One of each';
  thing: string; cant: string; front: 'role' | 'name' | 'none'; name: string;
  dear: string; from: string;
  /** The typed hook line, when the run opens with one. */
  hookLine: string;
  /** A photo of them for the cameo step (public path). Without one the
   *  auto run skips the photo screen. */
  photo?: string;
  /** Who writes the inside message: 'us' (prefilled, Dear/From typed) or
   *  'me' (all three typed). */
  insideBy?: 'us' | 'me';
  /** The message typed when insideBy is 'me'. */
  message?: string;
}

export const DEMO_PRESETS: Record<string, DemoPreset> = {
  'mum-70-garden': {
    who: 'Mum', occasion: 'Birthday', age: '70', vibe: 'Warm',
    thing: 'Her garden — the roses, the robin, the shed radio', cant: 'Slugs', front: 'role', name: 'Linda',
    dear: 'Dear Mum,', from: 'All our love, Aidan & Sam x',
    hookLine: 'Watch us make a card for Mum. 70. Lives in her garden.',
    message: 'Happy 70th, Mum. Here’s to the roses, the robin, and you in the middle of it all.',
    photo: '/proof-source-photo.webp',
  },
  'dad-60-canal': {
    who: 'Dad', occasion: 'Birthday', age: '60', vibe: 'Light humour',
    thing: 'Fishing on the canal every Sunday, rain or shine', cant: 'Getting up before 6am', front: 'role', name: 'Dave',
    dear: 'Dear Dad,', from: 'Love, Aidan x',
    hookLine: 'Watch us make a card for Dad. 60. Canal fishing every Sunday.',
    message: 'Happy 60th, Dad. Tight lines and quiet Sundays — you’ve earned every one.',
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
/** A saved run (/api/admin/demo-runs/:id), played back with no new
 *  generations (Aidan 2026-09-17: "long form… chop it up into little
 *  bits for socials"). */
export interface ReplayRun {
  id: number; label: string | null; created_at?: string; hook_line?: string | null;
  brief: Partial<Brief> | null; concepts: Concept[]; frontUrls: string[]; pickedIndex: number;
  photoUrl: string | null; cameoUrl: string | null; insideUrl: string | null;
  words: { dear: string; message: string; from: string } | null;
  beats: Array<{ name: string; t: number }> | null;
}
/** Which part of a replay plays: the whole run, or one short moment. */
export type ClipKey = 'full' | 'options' | 'photo' | 'open' | 'posted' | 'guess';
export const CLIPS: Array<{ key: ClipKey; label: string; hook: (who: string) => string }> = [
  { key: 'full', label: 'Whole run', hook: (w) => `Watch us make a card for ${w}.` },
  { key: 'options', label: 'Three options', hook: (w) => `Three cards for ${w}. Pick one.` },
  { key: 'photo', label: 'Add the photo', hook: (w) => `Now put ${w} in it.` },
  { key: 'open', label: 'Open it', hook: () => 'Open it.' },
  { key: 'posted', label: 'Post it', hook: () => 'Then we post it.' },
  { key: 'guess', label: 'Guess the brief', hook: () => 'Guess what we were told.' },
];

export interface DemoConfig extends DemoPreset {
  speed: Speed; hook: boolean;
  /** Seconds before the run starts — time to hit record. */
  countdown: number;
  /** 'auto' = the director taps through it; 'manual' = Aidan does, on the
   *  same clean screens (2026-09-15: "allow me to manually run this end
   *  to end rather than pre-set and hit play"). */
  mode: 'auto' | 'manual';
  /** Ask "anything they can't stand?" as its own screen. */
  askDislike?: boolean;
  /** Which of who / occasion / age appear as questions on screen; the
   *  rest are set in the builder and said in the hook (Aidan 2026-09-16). */
  askOnScreen?: { who?: boolean; occasion?: boolean; age?: boolean };
  /** Punch in on each tap while the run plays itself (on unless false). */
  zoom?: boolean;
  /** The running clock, top right (on unless false). */
  timer?: boolean;
  /** Leave the photo screen out entirely (Aidan 2026-09-16: no "No photo" button on screen). */
  skipPhoto?: boolean;
  /** 'phone' = the run plays inside a phone mockup on the page (Aidan
   *  2026-09-16: "render this in a phone mock up"); 'full' = edge to edge. */
  frame?: 'phone' | 'full';
  /** The mockup breathes: a slow handheld sway, a light drifting over the
   *  glass, soft clouds moving behind (on unless false). */
  alive?: boolean;
  /** Play a saved run instead of generating. */
  replay?: ReplayRun;
  clip?: ClipKey;
  /** Replay waits: as long as the original run took, or short. */
  waits?: 'real' | 'short';
}
const BEATS: Record<Speed, { hold: number; type: number; settle: number; walk: number; look: number }> = {
  // 'settle' is the pause AFTER a screen/element is in view and BEFORE the
  // ring lands. Cut back 2026-09-17 ("too much delay between landing on a
  // new screen and inputting or clicking") — the punch-in now carries that
  // beat, so the dead time went with it.
  normal: { hold: 1100, type: 62, settle: 520, walk: 1450, look: 1900 },
  fast: { hold: 650, type: 40, settle: 280, walk: 900, look: 1050 },
};

// ── skin ─────────────────────────────────────────────────────────────

/** The whole /demo page — builder, countdown, run, the phone's bezel —
 *  shows a tiny faint dot instead of the pointer, in both modes (Aidan
 *  2026-09-17: "dot throughout, the cursor is intrusive for my screen
 *  recording"). Taps still burst in manual runs. */
const CURSOR_CSS = `
  .demo-cursor-on, .demo-cursor-on * { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Ccircle cx='4' cy='4' r='2.5' fill='rgba(60,56,70,0.32)' stroke='rgba(255,255,255,0.5)' stroke-width='0.75'/%3E%3C/svg%3E") 4 4, auto !important; }
`;

const CSS = `
  @keyframes demo-ring { 0% { transform: translate(-50%,-50%) scale(.55); opacity: .95 } 70% { opacity: .55 } 100% { transform: translate(-50%,-50%) scale(1.7); opacity: 0 } }
  @keyframes demo-dot { 0% { opacity: .9 } 100% { opacity: 0 } }
  .demo-ring { position: fixed; z-index: 2147483000; pointer-events: none; width: 46px; height: 46px; border-radius: 50%;
    border: 3px solid #7a76e8; background: rgba(122,118,232,.22); animation: demo-ring 420ms cubic-bezier(.2,.7,.3,1) forwards; }
  .demo-dot { position: fixed; z-index: 2147483000; pointer-events: none; width: 14px; height: 14px; border-radius: 50%; background: #7a76e8;
    transform: translate(-50%,-50%); animation: demo-dot 420ms ease-out forwards; }

  /* Manual runs: no pointer on screen at all (Aidan 2026-09-16). */
  /* The first letter lands at one fixed point and the text only grows
     downward from there — no re-centring as lines wrap (Aidan 2026-09-16). */
  .demo-hook { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-start; justify-content: flex-start; padding: 36vh 8vw 8vw;
    background: transparent; transition: opacity 600ms ease; }
  /* Left-aligned, Fraunces Bold, the recipient in violet → ink (Aidan 2026-09-15). */
  .demo-hook p { font-family: 'Fraunces', Georgia, serif; font-weight: 700; font-size: clamp(30px, 9.5vw, 56px); line-height: 1.08; letter-spacing: -0.01em; color: #211D19; margin: 0; text-align: left; max-width: 100%; }
  .demo-hook .who { background: linear-gradient(90deg, #7a76e8 0%, #211D19 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .demo-hook .caret { display: inline-block; width: .08em; height: .95em; background: #7a76e8; margin-left: .08em; vertical-align: -.1em; animation: demo-caret 900ms steps(2) infinite; }
  @keyframes demo-caret { 50% { opacity: 0 } }
  .demo-hook.out { opacity: 0; pointer-events: none; }

  /* The generator: a blank card, breathing violet. No words but one. */
  @keyframes demo-fade-up { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
  .demo-in { animation: demo-fade-up 420ms ease-out both; }

  /* The one thing to do on a screen pulses. */
  @keyframes demo-pulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(122,118,232,.45) } 50% { transform: scale(1.03); box-shadow: 0 0 0 14px rgba(122,118,232,0) } }
  .demo-pulse { animation: demo-pulse 1.7s ease-in-out infinite; }

  @keyframes demo-field-glow { 0%, 100% { box-shadow: 0 0 0 1px rgba(122,118,232,.35), 0 10px 36px rgba(122,118,232,.22) } 50% { box-shadow: 0 0 0 1px rgba(122,118,232,.55), 0 14px 48px rgba(122,118,232,.38) } }
  .demo-glow-field { border-color: rgba(122,118,232,.5) !important; animation: demo-field-glow 2.4s ease-in-out infinite; }

  .demo-zoomer { transition: transform 340ms cubic-bezier(.22,1,.36,1); will-change: transform; }

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

/** THE PUNCH-IN (Aidan 2026-09-17: "zoom into the things that are
 *  clicked like pan in and out so the cut is snappy"). The whole screen
 *  scales towards whatever is about to be tapped or typed into, then
 *  back out — a camera move, not a layout change, so nothing reflows.
 *  Self-playing runs only. */
let zoomRoot: HTMLElement | null = null;
let zoomOn = false;
const ZOOM_MS = 340;
async function zoomTo(el: HTMLElement, scale = 1.3) {
  const root = zoomRoot; if (!root || !zoomOn) return;
  const r = el.getBoundingClientRect(); const rr = root.getBoundingClientRect();
  root.style.transformOrigin = `${r.left + r.width / 2 - rr.left}px ${r.top + r.height / 2 - rr.top}px`;
  root.style.transform = `scale(${scale})`;
  await sleep(ZOOM_MS);
}
async function zoomOut(wait = true) {
  const root = zoomRoot; if (!root || !zoomOn) return;
  root.style.transform = 'none';
  if (wait) await sleep(ZOOM_MS);
}

async function bringIn(el: HTMLElement, settle: number) {
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await sleep(settle);
}
async function tap(el: HTMLElement, settle: number, hold: number) {
  await bringIn(el, settle);
  await zoomTo(el);
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
  tellTap(); // the phone dips AFTER the click lands, never under the finger
  await sleep(Math.max(140, hold * 0.35));
  await zoomOut(false);
  await sleep(Math.max(ZOOM_MS, hold * 0.65));
}
/** Type into a React-controlled input, one character at a time. */
async function type(el: HTMLInputElement | HTMLTextAreaElement, text: string, settle: number, delay: number) {
  await bringIn(el, settle);
  await zoomTo(el, 1.22);
  const r = el.getBoundingClientRect(); ring(r.left + 40, r.top + r.height / 2);
  el.focus(); await sleep(350);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  for (let i = 0; i < text.length; i++) {
    setter.call(el, text.slice(0, i + 1));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(typingDelay(text, i, [], delay));
  }
  await sleep(320);
  await zoomOut(false);
  await sleep(380);
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
  target.style.transition = 'opacity 200ms ease';
  const parts = sentencesOf(raw);
  await sleep(350); // a moment before the first letter
  for (let k = 0; k < parts.length; k++) {
    const line = parseHook(parts[k], words);
    target.style.opacity = '1';
    if (k === 0) {
      for (let i = 0; i < line.text.length; i++) {
        target.innerHTML = hookHtml(line, i + 1);
        // the full stop at the end of a screen holds below, not here
        await sleep(i === line.text.length - 1 ? 60 : typingDelay(line.text, i, line.ranges));
      }
    } else {
      // Only the first sentence types; the rest fade in whole, no caret —
      // letter-by-letter flickers once the edit is sped up (Aidan 2026-09-17).
      target.style.opacity = '0';
      target.innerHTML = hookHtml(line, line.text.length).replace('<span class="caret"></span>', '');
      await sleep(40); target.style.opacity = '1'; await sleep(260);
    }
    // Read it: a beat on the typed line, less on the ones that fade in whole.
    await sleep(k === parts.length - 1 ? 900 : k === 0 ? 750 : 550);
    if (k < parts.length - 1) {
      // Fade out; the next sentence fades in on the same spot.
      target.style.opacity = '0';
      await sleep(230);
    }
  }
  hookEl.classList.add('out'); await sleep(450);
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
  if (!r.ok) throw Object.assign(new Error(j?.message ?? `${path} failed (${r.status})`), { code: j?.code as string | undefined, status: r.status });
  return j;
}
/** Draw one card the way /make does: a safety refusal is deterministic
 *  (usually a film or show's own characters), so the art direction is
 *  rewritten once — the property's world without its cast — and the card
 *  drawn again (2026-09-17: a Toy Story brief ended the demo). Returns
 *  the concept actually drawn, so later steps use the same picture. */
async function drawSafely<T extends { front_text: string; art_direction: string }>(
  c: T, interest: string | undefined, draw: (c: T) => Promise<any>, onRewrite?: () => void,
): Promise<{ r: any; concept: T }> {
  try {
    return { r: await draw(c), concept: c };
  } catch (e: any) {
    if (e?.code !== 'safety') throw e;
    onRewrite?.();
    const fix = await post('ip-safe-art', { front_text: c.front_text, art_direction: c.art_direction, interest }, 45_000);
    const concept = { ...c, art_direction: fix.art_direction as string };
    try {
      return { r: await draw(concept), concept };
    } catch (e2: any) {
      if (e2?.code === 'safety') throw new Error('We couldn’t draw that one, even with a safer picture. Try a different thing they love.');
      throw e2;
    }
  }
}
/** Decode an image BEFORE the screen that shows it mounts, so a card
 *  never lands as an empty tile that fills in (Aidan 2026-09-18: "no
 *  space behind before showing"). Mirrors ThumbImg's ladder — the grid
 *  thumb first, then the self-healing thumb route, then the original —
 *  with the same crossOrigin, so the tile and the 3D viewer both hit
 *  the cache. Never blocks for more than a few seconds. */
const PNG_URL = /^(https?:\/\/[^?#]+\/|\/images\/)([A-Za-z0-9_-]+)\.png$/;
function loadImage(u: string): Promise<boolean> {
  return new Promise((res) => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).then(() => res(true), () => res(true)); };
    im.onerror = () => res(false);
    im.src = u;
  });
}
async function warm(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const job = (async () => {
    const m = PNG_URL.exec(url);
    if (m) { if (!(await loadImage(`${m[1]}${m[2]}_t.webp`))) await loadImage(`/api/thumb/${m[2]}.png`); }
    await loadImage(url);
  })();
  await Promise.race([job, sleep(6000)]);
}
const warmAll = (urls: Array<string | null | undefined>) => Promise.all(urls.map(warm)).then(() => undefined);

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

const OCCASION_KEYS: Record<string, string> = { birthday: 'birthday', christmas: 'christmas', anniversary: 'anniversary', wedding: 'wedding' };
/** The questions answered in the builder, not on screen. */
function hiddenQuestions(cfg: DemoConfig): Array<'who' | 'occasion' | 'age'> {
  const a = cfg.askOnScreen ?? {};
  return (['who', 'occasion', 'age'] as const).filter((k) => !a[k]);
}
/** Only what the builder answered is filled in; anything asked on screen
 *  starts blank so nothing shows as already chosen. */
function briefFromConfig(cfg: DemoConfig): Brief {
  const a = cfg.askOnScreen ?? {};
  const who = a.who ? '' : cfg.who.trim();
  const occ = a.occasion ? '' : cfg.occasion.trim();
  return {
    ...emptyBrief(),
    who,
    gender: RECIPIENTS.find((r) => r.label === who)?.implies ?? null,
    occasion: OCCASION_KEYS[occ.toLowerCase()] ?? occ,
    age: a.age ? '' : cfg.age.replace(/\D/g, '').slice(0, 3),
    front: defaultFront(who, ''),
  };
}

// The posted moment: the card dips, then flies up and off to the right,
// with two faint copies trailing it.
const POST_FLIGHT_MS = 1700;
function PostFlight({ src }: { src: string }) {
  const W = typeof window === 'undefined' ? 400 : window.innerWidth;
  const H = typeof window === 'undefined' ? 800 : window.innerHeight;
  const size = Math.min(W * 0.62, 300);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {[0.14, 0.07, 0].map((lag, k) => (
        <motion.img
          key={k}
          src={src}
          crossOrigin="anonymous"
          alt=""
          style={{ width: size, height: size, position: 'absolute' }}
          className="rounded-[6px] object-cover shadow-[0_24px_50px_-20px_rgba(20,18,30,.45)]"
          initial={{ x: 0, y: 0, rotate: -3, scale: 0.9, opacity: 0 }}
          animate={{
            x: [0, 0, -10, W * 0.75],
            y: [0, 0, 16, -H * 0.8],
            rotate: [-3, -3, -7, 24],
            scale: [0.9, 1, 0.95, 0.3],
            opacity: k === 2 ? [0, 1, 1, 0.9] : [0, 0, k === 0 ? 0.18 : 0.32, 0],
          }}
          transition={{ duration: (POST_FLIGHT_MS - 300) / 1000, delay: lag, times: [0, 0.22, 0.45, 1], ease: ['easeOut', 'easeInOut', [0.5, 0, 0.9, 0.4]] }}
        />
      ))}
    </div>
  );
}

type Phase = 'countdown' | 'brief' | 'generating' | 'results' | 'photo' | 'photo-generating' | 'photo-result' | 'inside' | 'inside-generating' | 'card' | 'sent' | 'intro' | 'guess';

// ── the page ─────────────────────────────────────────────────────────

/** Every screen enters rising and fading in, and leaves fading out — a
 *  cut between two flat screens reads as a glitch on video. */
// Exit is quick so the next screen (already decoded) lands without a gap.
const SCREEN = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10, transition: { duration: 0.22 } }, transition: { duration: 0.42, ease: [0.2, 0.7, 0.3, 1] } } as const;

const H1 = 'font-display text-[26px] leading-[1.15] font-bold tracking-[-0.015em] text-keeper-ink';
const PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-full bg-keeper-ink px-6 py-3.5 text-[15px] font-semibold text-keeper-paper';
const QUIET = 'text-[14px] text-keeper-meta underline decoration-keeper-hair underline-offset-4';

// ── the photo picker (Aidan 2026-09-16: "some kind of photo picker
// animation") — a phone-style Recents sheet. Their photo sits among real
// source photos from the site; only theirs is pickable. Tap → numbered
// tick → the sheet drops and the photo flies into the tile. ──
const ROLL: Array<{ src: string; pos?: string }> = [
  { src: '/hero-source-photo.webp' }, { src: '/proof-bigben-source.webp' }, { src: '/handover-blank.webp' },
  { src: '/hero-real-source.webp', pos: '50% 30%' }, { src: '' /* theirs */ }, { src: '/reaction-poster.webp', pos: '50% 12%' },
  { src: '/proof-timessquare-source.webp' }, { src: '/hero-source-photo.webp', pos: '85% 50%' }, { src: '/reaction-poster.webp', pos: '50% 60%' },
];
function PhotoPicker({ photo, onPick, onCancel }: { photo: string; onPick: () => void; onCancel: () => void }) {
  const [chosen, setChosen] = useState(false);
  const theirs = useRef<HTMLButtonElement>(null);
  const choose = () => {
    if (chosen) return; setChosen(true);
    window.setTimeout(onPick, 560);
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

const OCCASION_CHIP: Record<string, string> = { birthday: 'Birthday', christmas: 'Christmas', anniversary: 'Anniversary', wedding: 'Wedding' };
const VIBE_CHIP: Record<string, DemoPreset['vibe']> = { funny: 'Light humour', warm: 'Warm', rude: 'Cheeky', mix: 'One of each' };
/** A builder config filled from a saved run: the answers, the words and
 *  the photo come from the run, so the replay types what was typed. */
export function configFromRun(r: ReplayRun, base: DemoConfig, clip: ClipKey = base.clip ?? 'full'): DemoConfig {
  const b = r.brief ?? {};
  const occ = String(b.occasion ?? '');
  const inside = (r.concepts[r.pickedIndex]?.inside_text ?? '').trim();
  const msg = (r.words?.message ?? '').trim();
  const who = String(b.who ?? '');
  const whoWords = whoPhrase({ who, name: '' });
  return {
    ...base,
    replay: r, clip,
    who, occasion: OCCASION_CHIP[occ] ?? occ, age: String(b.age ?? ''),
    vibe: VIBE_CHIP[String(b.vibe ?? '')] ?? 'Warm',
    thing: String(b.thing ?? ''), cant: String(b.cant ?? ''),
    front: (b.front as DemoPreset['front']) ?? 'none', name: String(b.name ?? ''),
    dear: r.words?.dear ?? '', from: r.words?.from ?? '', message: msg,
    insideBy: msg && msg !== inside ? 'me' : 'us',
    photo: r.photoUrl ?? undefined, skipPhoto: !r.cameoUrl || !r.photoUrl,
    askDislike: !!String(b.cant ?? '').trim(),
    hookLine: clip === 'full' && r.hook_line ? r.hook_line : (CLIPS.find((c) => c.key === clip) ?? CLIPS[0]).hook(whoWords === 'them' ? 'them' : whoWords),
  };
}
const VIBE_WORDS: Record<string, string> = { funny: 'Light humour', warm: 'Warm', rude: 'Cheeky', mix: 'One of each' };
/** The brief as a few short chips, for "Guess the brief". */
function guessChipsOf(b: Partial<Brief> | null): string[] {
  if (!b) return [];
  const out: string[] = [];
  if (b.who) out.push(String(b.who));
  const occ = occasionLabelFor({ ...emptyBrief(), ...b } as Brief);
  if (occ) out.push(occ);
  if (b.age && !/\d/.test(occ)) out.push(`${b.age}`);
  if (b.vibe && VIBE_WORDS[b.vibe]) out.push(VIBE_WORDS[b.vibe]);
  if (b.thing) out.push(`“${String(b.thing).trim()}”`);
  if (b.cant && String(b.cant).trim()) out.push(`Can’t stand: ${String(b.cant).trim()}`);
  return out;
}
const GUESS_STEP_MS = 850;

function DemoRun({ cfg, embedded = false }: { cfg: DemoConfig; embedded?: boolean }) {
  const preset = cfg; const hook = cfg.hook; const beats = BEATS[cfg.speed];
  const replay = cfg.replay;
  const clip: ClipKey = replay ? (cfg.clip ?? 'full') : 'full';
  const pi = replay?.pickedIndex ?? 0;
  const firstPhase: Phase = clip === 'full' ? 'brief' : 'intro';
  const showClock = cfg.timer !== false && clip === 'full';
  const [phase, setPhase] = useState<Phase>(cfg.countdown > 0 ? 'countdown' : firstPhase);
  const phaseRef = useRef<Phase>(phase); phaseRef.current = phase;
  const [count, setCount] = useState(cfg.countdown);
  // While the hook types, the question panel waits out of sight (the hook
  // overlay is see-through so the backdrop icons show).
  const [hookOn, setHookOn] = useState(cfg.hook);
  // Who, the occasion and the age are set in the builder and said in the
  // typed hook, so the filmed brief opens on the vibe (Aidan 2026-09-16).
  const [brief, setBrief] = useState<Brief>(() => briefFromConfig(cfg));
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
  // The card screen stays invisible until the viewer's first frame.
  const [cardPainted, setCardPainted] = useState(false);
  // The camera: the self-playing run punches in on each tap.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    zoomRoot = rootRef.current;
    zoomOn = cfg.mode === 'auto' && cfg.zoom !== false;
    return () => { zoomRoot = null; zoomOn = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // The clock: from the first question on screen to the moment it's posted
  // (Aidan 2026-09-16: "shows how long this takes end to end").
  const [clockFrom, setClockFrom] = useState<number | null>(null);
  const [clockTo, setClockTo] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const railRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  // The picker: the prepared photo it offers and whether it's up.
  const [pickerPhoto, setPickerPhoto] = useState<string | null>(null);
  const pickerPhotoRef = useRef<string | null>(null); pickerPhotoRef.current = pickerPhoto;
  const [pickerOpen, setPickerOpen] = useState(false);
  const photoUrlRef = useRef<string | null>(null); photoUrlRef.current = photoUrl;
  const openPicker = async () => {
    if (photoUrlRef.current || pickerOpen) return;
    if (!cfg.photo) { fileRef.current?.click(); return; }
    const prepared = pickerPhotoRef.current ?? await preparePhoto(await fetch(cfg.photo).then((r) => r.blob()));
    setPickerPhoto(prepared); setPickerOpen(true);
  };
  // Picked → straight into "Adding the photo" (Aidan 2026-09-16: skip the
  // filled-tile screen). The wait begins as the sheet drops.
  // Choosing a card is a tap on the card itself (no button).
  const photoStep = !cfg.skipPhoto && (cfg.mode === 'manual' || !!cfg.photo);
  // Straight to the inside with our message already in, editable; Dear
  // and From start blank (Aidan 2026-09-17: no "who writes it?" step).
  const toInside = (i: number) => {
    setMessage(conceptsRef.current[i]?.inside_text ?? '');
    setDear(''); setFrom(''); setPhase('inside');
  };
  const chooseCard = (i: number) => { if (replay && i !== pi) return; setPicked(i); if (photoStep) setPhase('photo'); else toInside(i); };
  const usePhoto = (src: string) => {
    setPhotoUrl(src);
    window.setTimeout(() => { renderCameo(src).catch(fail); }, 120);
  };
  const landPhoto = () => {
    const src = pickerPhotoRef.current;
    setPickerOpen(false);
    if (src) usePhoto(src);
  };
  // Latest engine state for the director's async steps.
  const conceptsRef = useRef<Concept[]>([]); conceptsRef.current = concepts;
  const pickedRef = useRef(0); pickedRef.current = picked;
  const wordsRef = useRef({ dear: '', message: '', from: '' }); wordsRef.current = { dear, message, from };

  const who = whoPhrase({ who: brief.who || preset.who, name: '' });
  const chosenFront = useCameo && cameoUrl ? cameoUrl : fronts[picked];
  // The glow: the mockup tints itself with the card on screen.
  useEffect(() => {
    if (!embedded) return;
    const url = phase === 'results' ? fronts[slide] : phase === 'photo-result' ? cameoUrl : phase === 'card' || phase === 'guess' ? chosenFront : null;
    if (!url) { tellGlow(null); return; }
    let off = false;
    cardGlow(url).then((c) => { if (!off) tellGlow(c); });
    return () => { off = true; };
  }, [embedded, phase, slide, fronts, cameoUrl, chosenFront]);
  // An engine failure ends the run visibly — and tells the recorder.
  const fail = (e: any) => { const m = e?.message ?? 'That didn’t work'; setError(m); mark(`FAILED: ${m}`, 'failed'); };
  const until = async (p: Phase, timeoutMs: number) => { const t0 = Date.now(); while (phaseRef.current !== p) { if (Date.now() - t0 > timeoutMs) throw new Error(`demo: still waiting for ${p}`); await sleep(150); } };

  // ── replay ──
  // Waits last as long as they did in the original run, unless short.
  const replayWait = (start: string, end: string, short: number) => {
    if (cfg.waits === 'short' || !replay?.beats) return short;
    const a = replay.beats.find((e) => e.name === start)?.t;
    const z = replay.beats.find((e) => e.name === end)?.t;
    return a != null && z != null && z > a ? Math.min(z - a, 240_000) : short;
  };
  const loadReplay = () => {
    if (!replay) return;
    setConcepts(replay.concepts); setFronts(replay.frontUrls); setPicked(pi);
    setUseCameo(!!replay.cameoUrl); setCameoUrl(replay.cameoUrl);
    setInsideUrl(replay.insideUrl); setCardOpen(false);
  };
  /** Jump to a clip's first screen with the run's assets in place. */
  const enterClip = async () => {
    if (clip === 'options') { await generate(brief); return; }
    if (replay) await warmAll([replay.frontUrls[pi], replay.cameoUrl, replay.insideUrl, replay.photoUrl]);
    loadReplay();
    if (clip === 'photo') { setUseCameo(false); setCameoUrl(null); setPhase('photo'); }
    else if (clip === 'guess') setPhase('guess');
    else setPhase('card');
    mark(`clip: ${clip}`);
  };
  const guessChips = guessChipsOf(replay?.brief ?? null);

  // ── engine steps (what the product does) ──
  const generate = async (b: Brief) => {
    setPhase('generating'); mark('generating', 'generating');
    if (replay) {
      await Promise.all([sleep(replayWait('generating', 'results', 3500)), warmAll(replay.frontUrls)]);
      setConcepts(replay.concepts); setFronts(replay.frontUrls); setPhase('results'); mark('results', 'results');
      return;
    }
    const ageNum = ageOf(b); const isKid = isKidBrief(b);
    const j = await post('concepts', {
      occasion: occasionLabelFor(b), who: b.who.trim() || 'Anyone', gender: b.gender ?? undefined, tone: isKid && b.vibe === 'rude' ? 'funny' : b.vibe,
      pipeline: 'celebrait', characters: 'objects', insideMode: 'auto', freeStyle: true, freeComposition: true, age: ageNum,
      interest: b.thing.trim() || undefined, dislikes: b.cant.trim() || undefined, recipientName: b.name.trim() || undefined, frontWord: frontWordOf(b), memory: true,
    });
    const cs: Concept[] = j.concepts ?? [];
    if (!cs.length) throw new Error('Nothing came back');
    setConcepts(cs);
    const interest = b.thing.trim() || undefined;
    const drawn = await Promise.all(cs.map((c, i) => drawSafely(c, interest,
      (x) => post('render', { front_text: x.front_text, art_direction: x.art_direction, palette: x.palette, typeface: x.typeface, format: x.format ?? 'hero', characters: 'objects', freeStyle: true }),
      () => mark(`card ${i + 1}: safer picture`))));
    // Any rewritten picture replaces the original, so the photo and the
    // inside follow the card that was actually drawn.
    setConcepts(drawn.map((d) => d.concept));
    const urls = drawn.map((d) => d.r.imageUrl as string);
    await warmAll(urls);
    setFronts(urls); setPhase('results'); mark('results', 'results');
  };
  const renderCameo = async (photo: string) => {
    let c = conceptsRef.current[pickedRef.current];
    setPhase('photo-generating'); mark('photo: generating', 'photo');
    if (replay) {
      await Promise.all([sleep(replayWait('photo: generating', 'photo: done', 3000)), warm(replay.cameoUrl)]);
      setCameoUrl(replay.cameoUrl); setPhase('photo-result'); mark('photo: done', 'photo-result');
      return;
    }
    const drawWith = (x: Concept) => post('render', { front_text: x.front_text, art_direction: x.art_direction, palette: x.palette, typeface: x.typeface, format: x.format ?? 'hero', characters: 'objects', freeStyle: true, cameoPhoto: photo, cameoMode: 'redraw' });
    const first = await drawSafely(c, brief.thing.trim() || undefined, drawWith, () => mark('photo: safer picture'));
    let r = first.r;
    if (first.concept !== c) {
      c = first.concept;
      const at = pickedRef.current;
      setConcepts((prev) => prev.map((x, i) => (i === at ? c : x)));
    }
    const draw = () => drawWith(c);
    // The same vision check the product runs, then one quiet retry if
    // she isn't in it — a demo can't show "we think this came out wrong".
    try {
      const qa = await post('cameo-check', { cardImage: r.imageUrl, cameoPhoto: photo }, 30_000);
      if (qa?.result?.verdict === 'bad') { mark('photo: redraw'); r = await draw(); }
    } catch { /* fail open: show what we have */ }
    await warm(r.imageUrl);
    setCameoUrl(r.imageUrl); setPhase('photo-result'); mark('photo: done', 'photo-result');
  };
  const renderInside = async () => {
    const c = conceptsRef.current[pickedRef.current]; const w = wordsRef.current;
    setPhase('inside-generating'); mark('inside: generating', 'inside');
    if (replay) {
      await Promise.all([sleep(replayWait('inside: generating', 'inside: done', 2600)), warmAll([replay.insideUrl, chosenFront])]);
      setInsideUrl(replay.insideUrl); setPhase('card'); mark('inside: done', 'card');
      return;
    }
    const joined = [w.dear.trim(), w.message.trim(), w.from.trim()].filter(Boolean).join('\n\n');
    const r = await post('render-inside', { ...(joined ? { mode: 'own', message: joined } : { mode: 'blank' }), palette: c.palette, typeface: c.typeface, art_direction: c.art_direction, characters: 'objects', freeStyle: true, direction: c.direction });
    await warmAll([r.imageUrl, chosenFront]);
    setInsideUrl(r.imageUrl); setPhase('card'); mark('inside: done', 'card');
  };

  // ── the director (what the thumb does) ──
  // Director steps shared by the whole run and the clips.
  const swipeAndPick = async () => {
    const b = beats;
    await until('results', 300_000); await sleep(b.look);
    // Swipe through the options and land on the one that gets picked.
    // The carousel mounts once the screen transition finishes — wait for it.
    { const t0 = Date.now(); while (!railRef.current && Date.now() - t0 < 10_000) await sleep(80); }
    const rail = railRef.current; if (!rail) throw new Error('demo: the options never appeared');
    const w = rail.clientWidth;
    const seq = pi === 0 ? [1, 2, 0] : pi === 1 ? [1, 2, 1] : [1, 2];
    for (const i of seq) { rail.scrollTo({ left: i * w, behavior: 'smooth' }); await sleep(b.walk); }
    await tap(await findDemo(`card-${pi}`), b.settle, b.hold); mark(`picked card ${pi + 1}`);
  };
  const addPhoto = async () => {
    const b = beats; const p = preset;
    await sleep(b.look * 0.5);
    setPickerPhoto(await preparePhoto(await fetch(p.photo!).then((r) => r.blob())));
    await tap(await findDemo('add-photo'), b.settle, 300);
    const mine = await findDemo('picker-photo', 8000); await sleep(900); // the grid settles
    await tap(mine, b.settle * 0.8, 200);
    await until('photo-generating', 10_000); mark('photo: added');
    await until('photo-result', 240_000); await sleep(b.look);
  };
  // The card opens and stays put — no turn afterwards (Aidan 2026-09-17).
  const openCard = async () => {
    const b = beats;
    await until('card', 240_000); await sleep(b.look * 0.7);
    const card = await findDemo('card');
    const r = card.getBoundingClientRect(); ring(r.left + r.width / 2, r.top + r.height / 2); await sleep(120);
    setCardOpen(true); mark('card: open'); await sleep(b.look * 1.5);
    mark('card: done');
  };
  const postIt = async () => {
    const b = beats;
    await tap(await findDemo('post'), b.settle, 300);
    // The card flies off, then the tick and the words land.
    await until('sent', 10_000); await sleep(POST_FLIGHT_MS + b.look * 1.2);
  };
  const playClip = async () => {
    const b = beats;
    if (clip === 'options') { await swipeAndPick(); await sleep(b.look * 0.8); }
    else if (clip === 'photo') { await addPhoto(); await sleep(b.look * 1.2); }
    else if (clip === 'open') { await openCard(); await sleep(b.look * 1.2); }
    else if (clip === 'posted') { await openCard(); await postIt(); }
    else if (clip === 'guess') { await until('guess', 10_000); await sleep(900 + guessChips.length * GUESS_STEP_MS + b.look * 1.6); }
  };

  const direct = async () => {
    const b = beats; const p = preset;
    if (clip !== 'full') {
      mark(`clip: ${clip}`, 'intro');
      if (hook) { await typeHook(p.hookLine, [p.who, p.name]); setHookOn(false); mark('hook: done'); }
      await sleep(400);
      await enterClip();
      await playClip();
      mark('end', 'end');
      return;
    }
    mark('brief: open', 'brief');
    if (hook) { await typeHook(p.hookLine, [p.who, p.name]); setHookOn(false); mark('hook: done'); }
    await sleep(320);
    const B = (re: RegExp) => find('button', re);
    const ask = cfg.askOnScreen ?? {};
    const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (ask.who) {
      await tap(await B(new RegExp(`^${esc(p.who)}$`)), b.settle, b.hold); mark(`who: ${p.who}`);
      // Partner / mate / friend don't move on by themselves (a him/her row shows) — tap Next.
      await sleep(900);
      if (await find('button', new RegExp(`^${esc(p.who)}$`), 300).catch(() => null)) await tap(await B(/^Next/), b.settle * 0.5, b.hold * 0.6);
    }
    if (ask.occasion) {
      const tile = await find('button', new RegExp(`^${esc(p.occasion)}`, 'i'), 2500).catch(() => null);
      if (tile) await tap(tile, b.settle, b.hold);
      else {
        const box = await find('input', /Type the occasion/) as HTMLInputElement;
        await type(box, p.occasion, b.settle, b.type);
        await sleep(400);
        box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      }
      mark(`occasion: ${p.occasion}`);
    }
    if (ask.age) {
      if (p.age.trim()) {
        await type(await find('input', /Their age/) as HTMLInputElement, p.age, b.settle, b.type * 1.8);
        await tap(await B(/^Next/), b.settle, b.hold * 0.75);
      } else await tap(await B(/^Skip this one/), b.settle, b.hold * 0.6);
      mark(`age: ${p.age || 'skipped'}`);
    }
    await tap(await B(new RegExp(p.vibe)), b.settle, b.hold); mark(`vibe: ${p.vibe}`);
    await type(await find('textarea', null) as HTMLTextAreaElement, p.thing, b.settle, b.type);
    await tap(await B(/^Next/), b.settle, b.hold * 0.6); mark('interest: next');
    if (cfg.askDislike) {
      const cantBox = await find('input', /can.t stand/i) as HTMLInputElement;
      if (p.cant.trim()) await type(cantBox, p.cant, b.settle, b.type);
      await tap(await B(/^(Next|Skip)/), b.settle, b.hold * 0.75); mark(`can't stand: ${p.cant || 'skipped'}`);
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

    await swipeAndPick();

    // The photo.
    if (photoStep && p.photo) {
      await addPhoto();
      await tap(await findDemo('to-inside'), b.settle, b.hold * 0.6); mark('photo: kept');
    } else {
      mark('photo: skipped');
    }

    // The inside.
    // Our message is already in; a run with its own words types over it.
    const by = p.insideBy ?? 'us';
    await until('inside', 10_000); mark(`inside: ${by}`);
    await type(await findDemo('dear') as HTMLInputElement, p.dear, b.settle, b.type);
    if (by === 'me') await type(await findDemo('message') as HTMLTextAreaElement, p.message ?? `Happy birthday, ${p.who}.`, b.settle, b.type);
    await type(await findDemo('from') as HTMLInputElement, p.from, b.settle, b.type);
    await tap(await findDemo('design-inside'), b.settle, 300);
    await until('card', 240_000); await sleep(b.look);

    await openCard();
    await postIt();
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
    const tick = window.setInterval(() => { n -= 1; setCount(n); if (n <= 0) { window.clearInterval(tick); setPhase(firstPhase); } }, 1000);
    if (cfg.mode === 'manual') {
      // Aidan drives. His taps get the ring; the hook types itself then steps aside.
      const onDown = (e: PointerEvent) => ring(e.clientX, e.clientY);
      const onClick = () => { tellTap(); window.setTimeout(clearRings, 140); };
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('click', onClick, true);
      const t = window.setTimeout(() => {
        // A clip jumps to its own first screen once the hook has typed.
        const go = () => { if (clip !== 'full') enterClip().catch(fail); };
        if (!cfg.hook) { go(); return; }
        void typeHook(cfg.hookLine, [cfg.who, cfg.name]).then(() => { setHookOn(false); go(); });
      }, cfg.countdown * 1000 + (cfg.countdown > 0 ? 1600 : 900));
      return () => { window.clearTimeout(t); window.clearInterval(tick); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('click', onClick, true); };
    }
    const t = window.setTimeout(() => { direct().catch((e) => { setError(e?.message ?? String(e)); mark(`FAILED: ${e?.message ?? e}`, 'failed'); console.error('[DEMO]', e); }); }, cfg.countdown * 1000 + (cfg.countdown > 0 ? 1600 : 900)); // let the countdown fade out first
    return () => { window.clearTimeout(t); window.clearInterval(tick); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { clearRings(); }, [phase]);
  // The run saves itself at "It's on the way" — the assets behind a
  // produced social video (see /admin/demo-runs). Fire and forget.
  const savedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'sent' || savedRef.current || fronts.length === 0 || replay) return;
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

  // A mouse can move the carousel too: the wheel or a sideways drag steps
  // one card; a drag never counts as choosing.
  const railStep = (dir: number) => { const el = railRef.current; if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' }); };
  const wheelAt = useRef(0);
  const onRailWheel = (e: React.WheelEvent) => {
    const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : 0; if (Math.abs(d) < 4) return;
    const now = Date.now(); if (now - wheelAt.current < 500) return; wheelAt.current = now; railStep(Math.sign(d));
  };
  const dragFrom = useRef<number | null>(null);
  const dragged = useRef(false);
  const onRailDown = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') { dragFrom.current = e.clientX; dragged.current = false; } };
  const onRailUp = (e: React.PointerEvent) => {
    if (dragFrom.current == null) return; const dx = e.clientX - dragFrom.current; dragFrom.current = null;
    if (Math.abs(dx) > 30) { dragged.current = true; railStep(dx < 0 ? 1 : -1); }
  };
  useEffect(() => { if (clockFrom == null && phase === 'brief' && !hookOn) setClockFrom(Date.now()); }, [phase, hookOn, clockFrom]);
  useEffect(() => { if (phase === 'sent' && clockTo == null) setClockTo(Date.now()); }, [phase, clockTo]);
  useEffect(() => {
    if (clockFrom == null || clockTo != null) return;
    const t = window.setInterval(() => setClockNow(Date.now()), 200);
    return () => window.clearInterval(t);
  }, [clockFrom, clockTo]);
  const clockMs = clockFrom == null ? 0 : (clockTo ?? clockNow) - clockFrom;
  const clockText = `${Math.floor(clockMs / 60000)}:${String(Math.floor(clockMs / 1000) % 60).padStart(2, '0')}`;
  const clockWords = (() => { const t = Math.floor(clockMs / 1000); const m = Math.floor(t / 60); return m ? `${m}m ${t % 60}s` : `${t}s`; })();
  const onRailScroll = () => { const el = railRef.current; if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth)); };

  return (
    // Inside the phone mockup the screen starts under the status bar and
    // stops above the home bar.
    <div ref={rootRef} className={`keeper-serif demo-zoomer fixed inset-x-0 overflow-hidden ${embedded ? 'bottom-[22px] top-[50px]' : 'inset-y-0'}`}>
      {/* The make page's own backdrop: cream wash + the floating celebration icons. */}
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      {hook && <div className="demo-hook" aria-hidden="true"><p><span className="caret" /></p></div>}
      <div className="absolute left-5 top-5 z-10"><img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" /></div>
      {showClock && clockFrom != null && (
        // Centred under the logo: clear of the like/share rail (right) and the
        // caption (bottom) on Reels and TikTok.
        <div className="pointer-events-none absolute left-1/2 top-[11vh] z-10 flex -translate-x-1/2 flex-col items-center rounded-2xl border border-keeper-hair bg-white/85 px-4 py-1.5 shadow-[0_4px_16px_-8px_rgba(33,29,25,.18)]" aria-label="Time taken to get here">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-keeper-meta">Time taken to get here</span>
          <span className="flex items-center gap-1.5 text-[22px] font-bold leading-tight tabular-nums text-keeper-ink">
            <span className={`h-2 w-2 rounded-full ${clockTo == null ? 'animate-pulse bg-cta' : 'bg-keeper-meta'}`} />{clockText}
          </span>
        </div>
      )}
      {error && <p className="absolute inset-x-5 bottom-5 z-20 rounded-xl bg-accent-red-light px-4 py-3 text-sm text-accent-red-dark">{error}</p>}

      <AnimatePresence>
        {pickerOpen && pickerPhoto && <PhotoPicker photo={pickerPhoto} onPick={landPhoto} onCancel={() => setPickerOpen(false)} />}
      </AnimatePresence>

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
        <motion.section key="brief" {...SCREEN} className="absolute inset-0 flex flex-col justify-start overflow-y-auto px-5 pb-10 pt-[24vh]" /* top edge pinned: only the bottom moves between questions */>
          <motion.div className="rounded-2xl border border-keeper-hair bg-white/85 p-5" initial={false} animate={{ opacity: hookOn ? 0 : 1, y: hookOn ? 12 : 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
            <BriefQuestions skin="landing" minimal hide={hiddenQuestions(cfg)} askDislike={!!cfg.askDislike} brief={brief} onChange={setBrief} hideDots onDone={(b) => { setBrief(b); generate(b).catch(fail); }} />
          </motion.div>
        </motion.section>
      )}

      {/* 2 · generating — a spinner and the words, nothing else (Aidan 2026-09-17) */}
      {(phase === 'generating' || phase === 'photo-generating' || phase === 'inside-generating') && (
        <motion.section key="generating" {...SCREEN} className="absolute inset-0 flex flex-col items-center justify-center gap-7 px-5">
          {/* Readable on a phone video: sentence case, bigger, darker. */}
          {/* Spinner centred over the line, so a line that wraps still
              reads as one centred block (Aidan 2026-09-17). */}
          <Loader2 className="h-7 w-7 animate-spin text-brand" strokeWidth={2.5} aria-hidden="true" />
          <p className="-mt-3 max-w-[320px] text-center text-[18px] font-medium leading-snug text-keeper-ink">
            {phase === 'generating' ? `Generating your 3 options for ${who}` : phase === 'photo-generating' ? `Adding the photo of ${who}` : 'Assembling the card'}
          </p>
        </motion.section>
      )}

      {/* 3 · option 1 / 2 / 3 */}
      {phase === 'results' && (
        <motion.section key="results" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-0 py-16 text-center">
          <div ref={railRef} onScroll={onRailScroll} onWheel={onRailWheel} onPointerDown={onRailDown} onPointerUp={onRailUp} onDragStart={(e) => e.preventDefault()} className="demo-rail -my-4 flex shrink-0 snap-x snap-mandatory overflow-x-auto py-12">
            {fronts.map((u, i) => (
              <div key={i} className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-4 px-8">
                {/* Option 1 / 2 / 3 travels with its card (Aidan 2026-09-17). */}
                <span className="rounded-full border border-brand/30 bg-brand-muted px-3.5 py-1 text-[14px] font-semibold text-brand-dark">Option {i + 1}</span>
                <button type="button" data-demo={`card-${i}`} onClick={() => { if (dragged.current) { dragged.current = false; return; } chooseCard(i); }} aria-label={`Choose: ${concepts[i]?.front_text ?? 'this card'}`}
                  className="w-[min(76vw,44vh,340px)] shrink-0 transition-transform active:scale-[0.98]"><AjarTile imageUrl={u} alt={concepts[i]?.front_text ?? ''} eager openDeg={22} /></button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[13px] text-keeper-meta">Swipe to see the others, tap one to choose</p>
        </motion.section>
      )}

      {/* 4 · add a photo? */}
      {phase === 'photo' && (
        <motion.section key="photo" {...SCREEN} className={`absolute inset-0 flex flex-col justify-center px-5 pb-12 text-center ${showClock ? 'pt-[20vh]' : 'pt-16'}`}>
          <h1 className={H1}>Add a photo of {who}?</h1>
          <p className="mt-2 text-[15px] text-keeper-body">We redesign this card with them in it.</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void preparePhoto(f).then(usePhoto); e.target.value = ''; }} />
          <button type="button" data-demo="add-photo" onClick={() => { void openPicker(); }}
            className="mt-6 flex aspect-[4/5] w-[min(70vw,40vh,260px)] shrink-0 items-center justify-center self-center overflow-hidden rounded-2xl border-2 border-dashed border-keeper-hair bg-white/70">
            <span className="flex flex-col items-center gap-2 text-keeper-meta"><Camera className="h-7 w-7" strokeWidth={1.5} /><span className="text-[14px] font-medium">Add a photo</span></span>
          </button>
        </motion.section>
      )}

      {/* 5 · there they are */}
      {phase === 'photo-result' && cameoUrl && (
        <motion.section key="photo-result" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-5 py-16 text-center">
          {/* Tap the card to go on to the inside — no button (Aidan 2026-09-16). */}
          <button type="button" data-demo="to-inside" aria-label="Use this card" onClick={() => { setUseCameo(true); toInside(pickedRef.current); }}
            className="mt-8 mb-3 w-[min(76vw,44vh,340px)] shrink-0 self-center transition-transform active:scale-[0.98]"><AjarTile imageUrl={cameoUrl} alt="" eager openDeg={22} /></button>
        </motion.section>
      )}

      {/* 6 · the inside */}
      {phase === 'inside' && (
        <motion.section key="inside" {...SCREEN} className="absolute inset-0 flex flex-col justify-center overflow-y-auto px-5 py-16 text-center">
          <h1 className={H1}>Now the inside.</h1>
          <div className="mt-5 flex flex-col gap-3">
            <input data-demo="dear" style={{ textAlign: 'left' }} value={dear} onChange={(e) => setDear(e.target.value)} aria-label="Dear" placeholder={`Dear ${who},`} className="h-12 rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none" />
            <textarea data-demo="message" style={{ textAlign: 'left' }} value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Your message" rows={5} className="demo-glow-field rounded-2xl border border-keeper-hair bg-white/95 px-4 py-3 text-[16px] leading-relaxed text-keeper-ink focus:outline-none" />
            <input data-demo="from" style={{ textAlign: 'left' }} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" placeholder="Love, …" className="h-12 rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none" />
          </div>
          <div className="mt-6 flex flex-col items-center">
            <button type="button" data-demo="design-inside" className={`${PRIMARY} demo-pulse w-full`} onClick={() => renderInside().catch(fail)}><Sparkles className="h-4 w-4 text-cta" /> Design the inside</button>
          </div>
        </motion.section>
      )}

      {/* 7 · the card, in real 3D: tap to open, drag to rotate, the green
          hints under it, and one button (Aidan 2026-09-16). Demo only — the
          product's viewer stays open/close with no orbit. */}
      {phase === 'card' && chosenFront && (
        // The card, then the button straight under it — no hints (Aidan
        // 2026-09-17), and the same dark pulsing button as every other step.
        <motion.section key="card" initial={{ opacity: 0, y: 16 }} animate={cardPainted ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }} exit={SCREEN.exit} transition={SCREEN.transition}
          className={`absolute inset-0 flex flex-col justify-center ${showClock ? 'pt-[14vh]' : ''}`}>
          <div data-demo="card" className="relative h-[min(56vh,104vw)] w-full shrink-0">
            <Card3DViewer frontImageUrl={chosenFront} insideImageUrl={insideUrl} open={cardOpen} onOpenChange={setCardOpen}
              onFirstFrame={() => setCardPainted(true)}
              enableRotate enableZoom={false}
              closedAngle={-0.38} restYaw={-0.12} framingMargin={1.35} minDistance={1.3} maxDistance={8} className="h-full w-full" />
          </div>
          <div className={`mt-4 shrink-0 px-5 ${clip === 'open' ? 'invisible' : ''}`}>
            <button type="button" data-demo="post" className={`${PRIMARY} demo-pulse w-full`} onClick={() => { setPhase('sent'); mark('posted', 'sent'); }}>
              <Send className="h-4 w-4 text-cta" /> Post it to them
            </button>
          </div>
        </motion.section>
      )}

      {/* Guess the brief: the finished card, then what we were told. */}
      {phase === 'guess' && chosenFront && (
        <motion.section key="guess" {...SCREEN} className="absolute inset-0 flex flex-col items-center justify-center gap-7 px-6">
          <div className="w-[min(64vw,36vh,280px)] shrink-0"><AjarTile imageUrl={chosenFront} alt="" eager openDeg={22} /></div>
          <div className="flex max-w-[340px] flex-wrap justify-center gap-2">
            {guessChips.map((t, i) => (
              <motion.span key={i} initial={{ opacity: 0, y: 8, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.9 + (i * GUESS_STEP_MS) / 1000, duration: 0.35, ease: 'easeOut' }}
                className="rounded-full border border-brand/40 bg-brand-muted px-3.5 py-1.5 text-[15px] font-medium text-brand-dark">{t}</motion.span>
            ))}
          </div>
        </motion.section>
      )}

      {/* 8 · posted: the card flies off, then "on the way" lands. */}
      {phase === 'sent' && (
        <motion.section key="sent" {...SCREEN} className="absolute inset-0 overflow-hidden">
          {chosenFront && <PostFlight src={chosenFront} />}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
            <span className="demo-tick flex h-20 w-20 items-center justify-center rounded-full bg-cta text-cta-foreground" style={{ animationDelay: `${POST_FLIGHT_MS - 250}ms` }}><Check className="h-10 w-10" strokeWidth={3} /></span>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: POST_FLIGHT_MS / 1000, duration: 0.5, ease: 'easeOut' }} className="flex flex-col items-center gap-3">
              <h1 className={H1}>Posted to {who}.<br />It’s on the way.</h1>
              <p className="text-[15px] text-keeper-body">Printed today, sent tracked.<br />Expect it by <span className="font-semibold text-keeper-ink">{formatDayMonth(expectedBy())}</span>.</p>
              {showClock && clockFrom != null && <p className="text-[13px] font-medium text-keeper-meta">Made and posted in {clockWords}</p>}
            </motion.div>
          </div>
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

/** A saved-run row from the API, in the shape a replay uses. */
function toReplay(x: any): ReplayRun {
  return {
    id: x.id, label: x.label ?? null, created_at: x.created_at, hook_line: x.hook_line ?? null,
    brief: x.brief ?? null, concepts: Array.isArray(x.concepts) ? x.concepts : [], frontUrls: Array.isArray(x.frontUrls) ? x.frontUrls : [],
    pickedIndex: typeof x.picked_index === 'number' ? x.picked_index : 0,
    photoUrl: x.photoUrl ?? null, cameoUrl: x.cameoUrl ?? null, insideUrl: x.insideUrl ?? null,
    words: x.words ?? null, beats: Array.isArray(x.beats) ? x.beats : null,
  };
}
const playable = (r: ReplayRun) => r.frontUrls.length === 3 && r.concepts.length === 3 && !!r.insideUrl;
/** How long the original run took, start to posted. */
function takenFor(r: ReplayRun): string {
  const b = r.beats ?? [];
  const z = b.find((e) => e.name === 'posted' || e.name === 'sent' || e.name === 'end')?.t;
  if (z == null) return '';
  const s = Math.round((z - (b[0]?.t ?? 0)) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function AskRow({ label: text, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className={label.replace('mb-1.5 ', '')}>{text}</span>
      <span className="flex gap-1.5">
        <button type="button" className={`${chip(!on)} !px-3 !py-1 !text-[12px]`} onClick={() => onChange(false)}>Set here</button>
        <button type="button" className={`${chip(on)} !px-3 !py-1 !text-[12px]`} onClick={() => onChange(true)}>Ask on screen</button>
      </span>
    </div>
  );
}

function DemoSetup({ onRun }: { onRun: (cfg: DemoConfig) => void }) {
  const [cfg, setCfg] = useState<DemoConfig>({ ...DEMO_PRESETS['mum-70-garden'], speed: 'normal', hook: true, countdown: 3, mode: 'manual', frame: 'phone' });
  const manual = cfg.mode === 'manual';
  const set = (patch: Partial<DemoConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const canRole = NAME_LIKE.includes(cfg.who);
  const ask = cfg.askOnScreen ?? {};
  const setAsk = (k: 'who' | 'occasion' | 'age', v: boolean) => set({ askOnScreen: { ...ask, [k]: v } });
  // A value is still needed when set here, or when the run plays itself.
  const showValue = (k: 'who' | 'occasion' | 'age') => (!ask[k] || !manual) && source !== 'replay';
  const readPhoto = (f: File) => { const r = new FileReader(); r.onload = () => set({ photo: String(r.result) }); r.readAsDataURL(f); };
  // Replay: play a saved run again, whole or as a short clip, with no new
  // generations (Aidan 2026-09-17).
  const [source, setSource] = useState<'new' | 'replay'>('new');
  const [runs, setRuns] = useState<ReplayRun[] | null>(null);
  const [runsErr, setRunsErr] = useState('');
  useEffect(() => {
    if (source !== 'replay' || runs) return;
    fetch('/api/admin/demo-runs', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => setRuns((j.runs ?? []).map(toReplay).filter(playable)))
      .catch(() => setRunsErr('Could not load saved runs.'));
  }, [source, runs]);
  const isReplay = source === 'replay';
  const clip: ClipKey = cfg.clip ?? 'full';
  // The brief options only matter when the whole run plays.
  const full = !isReplay || clip === 'full';
  const pickRun = (r: ReplayRun) => setCfg((c) => configFromRun(r, c, c.clip ?? 'full'));
  const pickClip = (k: ClipKey) => setCfg((c) => (c.replay ? configFromRun(c.replay, c, k) : { ...c, clip: k }));
  const ready = isReplay ? !!cfg.replay : manual ? (!!(ask.who || cfg.who) && !!(ask.occasion || cfg.occasion.trim())) : !!(cfg.who && cfg.occasion.trim() && cfg.thing.trim() && (cfg.front !== 'name' || cfg.name.trim()));
  return (
    <div className="keeper-serif relative min-h-screen">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <div className="mx-auto max-w-xl px-5 pb-24 pt-8">
        <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" />
        <h1 className={`${H1} mt-6`}>Make a demo.</h1>
        <p className="mt-1 text-[14px] text-keeper-body">{manual ? 'Press Run, start your screen recording during the countdown, then tap through it yourself.' : 'Set the brief, press Run, start your screen recording during the countdown. The page does the rest.'}</p>

        {/* Run sits at the top and stays there while you scroll, so the
            recording can be ready before you press it (Aidan 2026-09-17). */}
        <div className="sticky top-0 z-20 -mx-5 mt-4 border-b border-keeper-hair/70 bg-[#FFFDF9]/90 px-5 py-3 backdrop-blur">
          <button type="button" disabled={!ready} onClick={() => onRun(cfg)} className={`${PRIMARY} w-full disabled:opacity-40`}><Play className="h-4 w-4 text-cta" /> {isReplay ? 'Play the replay' : 'Run the demo'}</button>
          <p className="mt-1.5 text-center text-[12px] text-keeper-meta">{isReplay ? 'Replays reuse the saved cards. No new generations.' : 'Each run spends one set of generations.'}</p>
        </div>

        <div className="mt-6"><span className={label}>Who drives</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(manual)} onClick={() => set({ mode: 'manual' })}>I tap through it</button>
            <button type="button" className={chip(!manual)} onClick={() => set({ mode: 'auto' })}>It plays itself</button>
          </div>
        </div>

        <div className="mt-5"><span className={label}>Start from</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(!isReplay)} onClick={() => { setSource('new'); set({ replay: undefined, clip: undefined }); }}>A new run</button>
            <button type="button" className={chip(isReplay)} onClick={() => setSource('replay')}>Replay a saved run</button>
          </div>
        </div>

        {isReplay && (
          <div className="mt-5 space-y-5">
            {runsErr && <p className="text-[13px] text-accent-red-dark">{runsErr}</p>}
            {!runs && !runsErr && <p className="text-[13px] text-keeper-meta">Loading saved runs…</p>}
            {runs && runs.length === 0 && <p className="text-[13px] text-keeper-meta">No saved runs yet. Every run that reaches “It’s on the way” is saved.</p>}
            {runs && runs.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5">
                {runs.map((r) => {
                  const on = cfg.replay?.id === r.id; const t = takenFor(r);
                  return (
                    <button key={r.id} type="button" onClick={() => pickRun(r)}
                      className={`overflow-hidden rounded-xl border-2 bg-white text-left transition-colors ${on ? 'border-brand' : 'border-transparent hover:border-brand/40'}`}>
                      <img src={r.cameoUrl ?? r.frontUrls[r.pickedIndex]} alt="" crossOrigin="anonymous" className="aspect-square w-full object-cover" loading="lazy" />
                      <span className="block px-2 pb-2 pt-1.5 text-[11.5px] leading-tight text-keeper-ink">
                        {r.label ?? `Run ${r.id}`}
                        <span className="block text-keeper-meta">{r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}{t ? ` · ${t}` : ''}{r.cameoUrl ? ' · photo' : ''}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {cfg.replay && (
              <>
                <div><span className={label}>Clip</span>
                  <div className="flex flex-wrap gap-2">
                    {CLIPS.map((c) => {
                      const off = c.key === 'photo' && !(cfg.replay?.cameoUrl && cfg.replay?.photoUrl);
                      return <button key={c.key} type="button" disabled={off} className={`${chip(clip === c.key)} disabled:opacity-35`} onClick={() => pickClip(c.key)}>{c.label}</button>;
                    })}
                  </div>
                </div>
                <div><span className={label}>Waits</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={chip(cfg.waits !== 'short')} onClick={() => set({ waits: 'real' })}>As long as they really took</button>
                    <button type="button" className={chip(cfg.waits === 'short')} onClick={() => set({ waits: 'short' })}>Short</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {!manual && !isReplay && <div className="mt-5 flex flex-wrap gap-2">
          {Object.entries(DEMO_PRESETS).map(([k, p]) => (
            <button key={k} type="button" className={chip(false)} onClick={() => set({ ...p })}>{p.who}, {p.age}</button>
          ))}
        </div>}

        <div className="mt-7 space-y-6">
          {full && <div className="rounded-2xl border border-keeper-hair bg-white/70 p-4 space-y-4">
          <p className="text-[13px] text-keeper-body">{isReplay ? 'Answers come from the saved run. Ask any of these on screen, or leave them for the opening line.' : 'Set here, these stay off screen, so say them in the opening line. Or ask any of them on screen.'}</p>
          <div><AskRow label="Who" on={!!ask.who} onChange={(v) => setAsk('who', v)} />
            {showValue('who') && <div className="flex flex-wrap gap-2">{RECIPIENTS.map((r) => <button key={r.label} type="button" className={chip(cfg.who === r.label)} onClick={() => set({ who: r.label, front: NAME_LIKE.includes(r.label) ? 'role' : cfg.name.trim() ? 'name' : 'none' })}>{r.label}</button>)}</div>}
          </div>
          <div><AskRow label="Occasion" on={!!ask.occasion} onChange={(v) => setAsk('occasion', v)} />
            {showValue('occasion') && <><div className="flex flex-wrap gap-2">{['Birthday', 'Christmas', 'Anniversary', 'Wedding'].map((o) => <button key={o} type="button" className={chip(cfg.occasion === o)} onClick={() => set({ occasion: o })}>{o}</button>)}</div>
            <input value={['Birthday', 'Christmas', 'Anniversary', 'Wedding'].includes(cfg.occasion) ? '' : cfg.occasion} onChange={(e) => set({ occasion: e.target.value.slice(0, 40) })} className={`${field} mt-2`} placeholder="Or type it… e.g. Retirement" /></>}
          </div>
          <div><AskRow label="Age" on={!!ask.age} onChange={(v) => setAsk('age', v)} />{showValue('age') && <input value={cfg.age} onChange={(e) => set({ age: e.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" className={`${field} max-w-[140px]`} placeholder="60" />}</div>
          </div>}
          {full && <div><span className={label}>Can’t stand</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(!!cfg.askDislike)} onClick={() => set({ askDislike: true })}>Ask it on screen</button>
              <button type="button" className={chip(!cfg.askDislike)} onClick={() => set({ askDislike: false })}>Leave it out</button>
            </div>
          </div>}
          {full && <div><span className={label}>Timer</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(cfg.timer !== false)} onClick={() => set({ timer: true })}>Show it</button>
              <button type="button" className={chip(cfg.timer === false)} onClick={() => set({ timer: false })}>Hide it</button>
            </div>
          </div>}
          {!manual && !isReplay && <>
          <div><span className={label}>Vibe</span>
            <div className="flex flex-wrap gap-2">{(['Light humour', 'Warm', 'Cheeky'] as const).map((v) => <button key={v} type="button" className={chip(cfg.vibe === v)} onClick={() => set({ vibe: v })}>{v}</button>)}</div>
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
          {!manual && !isReplay && <div><span className={label}>The inside</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip((cfg.insideBy ?? 'us') === 'us')} onClick={() => set({ insideBy: 'us' })}>Keep our message</button>
              <button type="button" className={chip(cfg.insideBy === 'me')} onClick={() => set({ insideBy: 'me' })}>Type my own over it</button>
            </div>
            {cfg.insideBy === 'me' && <textarea value={cfg.message ?? ''} onChange={(e) => set({ message: e.target.value.slice(0, 300) })} rows={2} placeholder="The message to type" className="mt-2 w-full rounded-2xl border border-keeper-hair bg-white/90 px-4 py-3 text-[15px] text-keeper-ink focus:outline-none focus:border-brand" />}
          </div>}
          {!manual && !isReplay && <div className="grid grid-cols-2 gap-3">
            <div><span className={label}>Dear</span><input value={cfg.dear} onChange={(e) => set({ dear: e.target.value })} className={field} /></div>
            <div><span className={label}>From</span><input value={cfg.from} onChange={(e) => set({ from: e.target.value })} className={field} /></div>
          </div>}
          {!isReplay && <div><span className={label}>Photo step</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(!cfg.skipPhoto)} onClick={() => set({ skipPhoto: false })}>Include it</button>
              <button type="button" className={chip(!!cfg.skipPhoto)} onClick={() => set({ skipPhoto: true })}>Skip it</button>
            </div>
          </div>}
          {!isReplay && !cfg.skipPhoto && <div><span className={label}>{manual ? 'Photo of them (optional — or pick one live from the tile)' : 'Photo of them'}</span>
            <div className="flex items-center gap-3">
              <label className={`${chip(false)} cursor-pointer`}>Choose photo<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readPhoto(f); e.target.value = ''; }} /></label>
              {cfg.photo && <img src={cfg.photo} alt="" className="h-12 w-12 rounded-lg object-cover" />}
              {cfg.photo && <button type="button" className={QUIET} onClick={() => set({ photo: undefined })}>Remove</button>}
            </div>
          </div>}
          <div><span className={label}>Opening line</span>
            <div className="flex flex-wrap gap-2"><button type="button" className={chip(cfg.hook)} onClick={() => set({ hook: true })}>Typed hook</button><button type="button" className={chip(!cfg.hook)} onClick={() => set({ hook: false })}>Straight in</button></div>
            {cfg.hook && <textarea value={cfg.hookLine} onChange={(e) => set({ hookLine: e.target.value.slice(0, 140) })} rows={2} className="mt-2 w-full rounded-2xl border border-keeper-hair bg-white/90 px-4 py-3 text-[15px] text-keeper-ink focus:outline-none focus:border-brand" />}
            {cfg.hook && <p className="mt-1.5 text-[12px] text-keeper-meta">Wrap a word in *asterisks* for the purple-to-black gradient. The recipient’s word gets it anyway.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!manual && <div><span className={label}>Pace</span><div className="flex gap-2"><button type="button" className={chip(cfg.speed === 'normal')} onClick={() => set({ speed: 'normal' })}>Normal</button><button type="button" className={chip(cfg.speed === 'fast')} onClick={() => set({ speed: 'fast' })}>Fast</button></div></div>}
            {!manual && <div><span className={label}>Camera</span><div className="flex gap-2"><button type="button" className={chip(cfg.zoom !== false)} onClick={() => set({ zoom: true })}>Punch in on taps</button><button type="button" className={chip(cfg.zoom === false)} onClick={() => set({ zoom: false })}>Hold still</button></div></div>}
            {cfg.frame !== 'full' && <div><span className={label}>Feel</span><div className="flex gap-2"><button type="button" className={chip(cfg.alive !== false)} onClick={() => set({ alive: true })}>Handheld</button><button type="button" className={chip(cfg.alive === false)} onClick={() => set({ alive: false })}>Still</button></div></div>}
            <div><span className={label}>Frame</span><div className="flex gap-2"><button type="button" className={chip(cfg.frame !== 'full')} onClick={() => set({ frame: 'phone' })}>Phone mockup</button><button type="button" className={chip(cfg.frame === 'full')} onClick={() => set({ frame: 'full' })}>Full screen</button></div></div>
            <div><span className={label}>Countdown</span><div className="flex gap-2">{[0, 3, 5, 10].map((n) => <button key={n} type="button" className={chip(cfg.countdown === n)} onClick={() => set({ countdown: n })}>{n}s</button>)}</div></div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── the phone mockup ─────────────────────────────────────────────────
// The run plays in an iframe the size of an iPhone 15, so every vw/vh and
// fixed layer inside it measures the phone, not the browser window. The
// builder's settings go across by postMessage (a photo can be too big for
// storage).
const PHONE_W = 393, PHONE_H = 852, BEZEL = 14;
const EMBED_READY = 'celebrait-demo-embed-ready';
const EMBED_CFG = 'celebrait-demo-embed-cfg';
const EMBED_TAP = 'celebrait-demo-embed-tap';
const EMBED_GLOW = 'celebrait-demo-embed-glow';
/** Inside the mockup's iframe: the colour of the card on screen, or none. */
function tellGlow(color: string | null) { if (typeof window !== 'undefined' && window.parent !== window) window.parent.postMessage({ type: EMBED_GLOW, color }, window.location.origin); }
const glowCache = new Map<string, string>();
/** A card's average colour, lifted a little so it reads as light, not mud. */
async function cardGlow(url: string): Promise<string> {
  const hit = glowCache.get(url); if (hit) return hit;
  const ok = await loadImage(url); if (!ok) return 'rgb(122,118,232)';
  const im = new Image(); im.crossOrigin = 'anonymous'; im.src = url; await im.decode().catch(() => undefined);
  const c = document.createElement('canvas'); c.width = 12; c.height = 12;
  const ctx = c.getContext('2d')!; ctx.drawImage(im, 0, 0, 12, 12);
  let r = 0, g = 0, b = 0, n = 0;
  try { const d = ctx.getImageData(0, 0, 12, 12).data; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } } catch { return 'rgb(122,118,232)'; }
  r /= n; g /= n; b /= n;
  const mean = (r + g + b) / 3; const sat = 1.5; const lift = 40;
  const f = (v: number) => Math.min(255, Math.round(mean + (v - mean) * sat + lift));
  const out = `rgb(${f(r)},${f(g)},${f(b)})`; glowCache.set(url, out); return out;
}
/** Inside the mockup's iframe: tell the page a tap landed. */
function tellTap() { if (typeof window !== 'undefined' && window.parent !== window) window.parent.postMessage({ type: EMBED_TAP }, window.location.origin); }

/** Paper flecks behind the phone — seeded, so every recording drifts the same. */
const FLECKS = Array.from({ length: 18 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  const colors = ['#7a76e8', '#5fd94a', '#FAF8F4', '#e5e4f9', '#c9c6f4'];
  return { left: 4 + r(1) * 92, w: 5 + r(2) * 7, h: 3 + r(3) * 5, color: colors[i % colors.length], dur: 26 + r(4) * 22, delay: r(5) * 40, dx: (r(6) - 0.5) * 220, rot: 360 + r(7) * 720, o: 0.35 + r(8) * 0.4 };
});

function PhoneFrame({ cfg }: { cfg: DemoConfig }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const nudgeRef = useRef<HTMLDivElement>(null);
  const [glow, setGlow] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 40) / (PHONE_H + BEZEL * 2), (window.innerWidth - 32) / (PHONE_W + BEZEL * 2)));
    fit(); window.addEventListener('resize', fit);
    let nudgeT = 0;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === EMBED_TAP && cfg.alive !== false) {
        // A tap dips the phone, like pressing a real screen.
        const el = nudgeRef.current; if (!el) return;
        el.classList.remove('demo-nudge'); void el.offsetWidth; el.classList.add('demo-nudge');
        window.clearTimeout(nudgeT); nudgeT = window.setTimeout(() => el.classList.remove('demo-nudge'), 340);
        return;
      }
      if (e.data?.type === EMBED_GLOW) { setGlow(cfg.alive !== false ? (e.data.color ?? null) : null); return; }
      if (e.data?.type !== EMBED_READY) return;
      frameRef.current?.contentWindow?.postMessage({ type: EMBED_CFG, cfg }, window.location.origin);
    };
    window.addEventListener('message', onMsg);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('message', onMsg); };
  }, [cfg]);
  const alive = cfg.alive !== false;
  return (
    // Not a still (Aidan 2026-09-18: "feels really static and 1D"): the
    // phone sways in 3D as if held, a soft light drifts across the glass,
    // and cloud-like blobs move slowly behind it. All CSS, all gentle —
    // an 11s sway, a 14s light, 40-60s clouds — so nothing reads as a loop.
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: alive ? undefined : 'linear-gradient(180deg, #F6F3EE 0%, #EFEBE4 100%)', perspective: 1400 }}>
      {alive && (
        <>
          <style>{`
            @keyframes demo-sway { 0% { transform: rotateX(2.6deg) rotateY(-4deg) translate3d(0,0,0) } 25% { transform: rotateX(-2deg) rotateY(3deg) translate3d(7px,-8px,0) } 50% { transform: rotateX(2.4deg) rotateY(4.4deg) translate3d(-5px,6px,0) } 75% { transform: rotateX(-2.8deg) rotateY(-2.4deg) translate3d(5px,9px,0) } 100% { transform: rotateX(2.6deg) rotateY(-4deg) translate3d(0,0,0) } }
            @keyframes demo-shadow { 0% { transform: translate(-30px, 0) scaleX(1) } 25% { transform: translate(24px, 8px) scaleX(1.06) } 50% { transform: translate(34px, -4px) scaleX(0.96) } 75% { transform: translate(-18px, 10px) scaleX(1.05) } 100% { transform: translate(-30px, 0) scaleX(1) } }
            @keyframes demo-breathe { 0% { transform: scale(1) translateY(0) } 50% { transform: scale(1.035) translateY(-6px) } 100% { transform: scale(1) translateY(0) } }
            @keyframes demo-nudge { 0% { transform: none } 35% { transform: translateY(5px) rotateX(-2.6deg) scale(0.99) } 100% { transform: none } }
            @keyframes demo-fleck { 0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0 } 8% { opacity: var(--o) } 92% { opacity: var(--o) } 100% { transform: translate3d(var(--dx), -115vh, 0) rotate(var(--rot)); opacity: 0 } }
            .demo-breathe { animation: demo-breathe 22s ease-in-out infinite; transform-style: preserve-3d; }
            .demo-nudge { animation: demo-nudge 320ms ease-out; transform-style: preserve-3d; }
            .demo-fleck { position: absolute; bottom: -4vh; border-radius: 2px; animation: demo-fleck var(--d) linear infinite; animation-delay: var(--delay); will-change: transform; }
            @keyframes demo-glass { 0% { transform: translate(-70%, -30%) rotate(18deg) } 100% { transform: translate(70%, 30%) rotate(18deg) } }
            @keyframes demo-cloud-a { 0% { transform: translate(-6%, -4%) scale(1) } 50% { transform: translate(8%, 6%) scale(1.12) } 100% { transform: translate(-6%, -4%) scale(1) } }
            @keyframes demo-cloud-b { 0% { transform: translate(6%, 5%) scale(1.08) } 50% { transform: translate(-9%, -6%) scale(0.96) } 100% { transform: translate(6%, 5%) scale(1.08) } }
            @keyframes demo-cloud-c { 0% { transform: translate(0, 8%) scale(1) } 50% { transform: translate(5%, -8%) scale(1.15) } 100% { transform: translate(0, 8%) scale(1) } }
            .demo-sway { animation: demo-sway 11s ease-in-out infinite; transform-style: preserve-3d; will-change: transform; }
            .demo-shadow { animation: demo-shadow 11s ease-in-out infinite; }
            .demo-glass { animation: demo-glass 14s ease-in-out infinite alternate; }
            .demo-cloud-a { animation: demo-cloud-a 46s ease-in-out infinite; }
            .demo-cloud-b { animation: demo-cloud-b 58s ease-in-out infinite; }
            .demo-cloud-c { animation: demo-cloud-c 39s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) { .demo-sway, .demo-shadow, .demo-glass, .demo-cloud-a, .demo-cloud-b, .demo-cloud-c { animation: none; } }
          `}</style>
          {/* the site's floating celebration icons, behind everything */}
          <CelebrationBackdrop background="linear-gradient(180deg, #F6F3EE 0%, #EFEBE4 100%)" permanentFade />
          {/* the clouds, and paper confetti rising slowly through them */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {FLECKS.map((f, i) => (
              <span key={i} className="demo-fleck" style={{ left: `${f.left}%`, width: f.w, height: f.h, background: f.color, ['--d' as string]: `${f.dur}s`, ['--delay' as string]: `-${f.delay}s`, ['--dx' as string]: `${f.dx}px`, ['--rot' as string]: `${f.rot}deg`, ['--o' as string]: f.o }} />
            ))}
            <div className="demo-cloud-a absolute -left-[10%] -top-[12%] h-[62vh] w-[62vh] rounded-full bg-[#7a76e8] opacity-[0.11] blur-[70px]" />
            <div className="demo-cloud-b absolute -bottom-[16%] -right-[8%] h-[70vh] w-[70vh] rounded-full bg-[#5fd94a] opacity-[0.09] blur-[80px]" />
            <div className="demo-cloud-c absolute left-[30%] top-[28%] h-[48vh] w-[48vh] rounded-full bg-[#e5e4f9] opacity-[0.55] blur-[60px]" />
          </div>
        </>
      )}
      <div style={{ width: PHONE_W + BEZEL * 2, height: PHONE_H + BEZEL * 2, transform: `scale(${scale})` }} className={`relative shrink-0 ${alive ? 'demo-breathe' : ''}`}>
        {/* the card's light spilling out behind the phone */}
        {alive && <div aria-hidden className="pointer-events-none absolute -inset-[22%] rounded-full blur-[60px]" style={{ background: glow ? `radial-gradient(ellipse at 50% 45%, ${glow} 0%, transparent 62%)` : 'transparent', opacity: glow ? 0.55 : 0, transition: 'opacity 1.4s ease, background 1.4s ease' }} />}
        {/* the shadow moves with the sway */}
        {alive && <div aria-hidden className="demo-shadow pointer-events-none absolute inset-x-[6%] bottom-[-3%] h-[10%] rounded-[50%] bg-[#211D19] opacity-[0.28] blur-[26px]" />}
        <div ref={nudgeRef} className="relative h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
        <div style={{ padding: BEZEL, boxShadow: `0 50px 90px -40px rgba(33,29,25,.55), inset 0 0 0 2px rgba(255,255,255,.08)${glow ? `, 0 0 70px -10px ${glow}` : ''}`, transition: 'box-shadow 1.4s ease',
            // The reflection: the phone mirrored on the surface below, fading fast.
            ...(alive ? { WebkitBoxReflect: 'below 10px linear-gradient(transparent 74%, rgba(0,0,0,.22))' } : {}) }}
          className={`relative h-full w-full rounded-[66px] bg-[#1d1a17] ${alive ? 'demo-sway' : ''}`}>
        <div className="relative h-full w-full overflow-hidden rounded-[52px] bg-keeper-paper">
          <iframe ref={frameRef} src="/demo?embed=1" title="Celebrait demo" className="absolute inset-0 h-full w-full border-0" />
          {/* status bar */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[50px] items-center justify-between px-[34px] pt-[4px] text-[16px] font-semibold text-keeper-ink" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <span>9:41</span>
            <span className="flex items-center gap-[6px]">
              <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" /><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" /><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" /></svg>
              <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0L8 11.5Zm-4.2-4.3L2.3 5.7a8 8 0 0 1 11.4 0l-1.5 1.5a5.9 5.9 0 0 0-8.4 0ZM.9 4.3-.6 2.8a12 12 0 0 1 17.2 0l-1.5 1.5a9.9 9.9 0 0 0-14.2 0Z" fill="currentColor" /></svg>
              <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true"><rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="19" height="8" rx="2" fill="currentColor" /><rect x="24" y="4" width="1.6" height="4" rx=".8" fill="currentColor" opacity=".45" /></svg>
            </span>
          </div>
          {/* dynamic island + home bar */}
          <div className="pointer-events-none absolute left-1/2 top-[11px] h-[35px] w-[124px] -translate-x-1/2 rounded-full bg-[#0c0b0a]" />
          <div className="pointer-events-none absolute bottom-[8px] left-1/2 h-[5px] w-[136px] -translate-x-1/2 rounded-full bg-keeper-ink/85" />
          {/* the light on the glass */}
          {alive && <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[52px]"><div className="demo-glass absolute -inset-[40%]" style={{ background: 'linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.10) 50%, transparent 58%)' }} /></div>}
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function EmbeddedRun() {
  const [cfg, setCfg] = useState<DemoConfig | null>(null);
  useEffect(() => {
    // Keep asking until the page answers (it may still be mounting); the
    // first answer wins and the asking stops.
    const ask = () => window.parent?.postMessage({ type: EMBED_READY }, window.location.origin);
    const t = window.setInterval(ask, 300);
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== EMBED_CFG) return;
      window.clearInterval(t);
      setCfg((prev) => prev ?? (e.data.cfg as DemoConfig));
    };
    window.addEventListener('message', onMsg);
    ask();
    return () => { window.removeEventListener('message', onMsg); window.clearInterval(t); };
  }, []);
  return cfg ? <DemoRun cfg={cfg} embedded /> : <div className="fixed inset-0 bg-keeper-paper" />;
}

export default function DemoPage() {
  const q = useMemo(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''), []);
  // A preset in the link runs straight away (the recorder's path); otherwise the builder.
  const fromLink = useMemo<DemoConfig | null>(() => {
    const p = DEMO_PRESETS[q.get('preset') ?? ''];
    return p ? { ...p, speed: q.get('speed') === 'fast' ? 'fast' : 'normal', hook: q.get('hook') === 'typed', countdown: 0, mode: 'auto' } : null;
  }, [q]);
  const [cfg, setCfg] = useState<DemoConfig | null>(fromLink);
  // A saved run in the link replays straight away (for recording and checks).
  const replayId = q.get('replay');
  const [linkErr, setLinkErr] = useState('');
  useEffect(() => {
    if (!replayId || cfg) return;
    fetch(`/api/admin/demo-runs/${encodeURIComponent(replayId)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        const run = toReplay(j.run);
        const clipKey = (CLIPS.find((c) => c.key === q.get('clip'))?.key ?? 'full') as ClipKey;
        const base: DemoConfig = { ...DEMO_PRESETS['mum-70-garden'], speed: q.get('speed') === 'fast' ? 'fast' : 'normal', hook: q.get('hook') === 'typed', countdown: 0, mode: 'auto', waits: q.get('waits') === 'short' ? 'short' : 'real' };
        setCfg(configFromRun(run, base, clipKey));
      })
      .catch(() => setLinkErr('Could not load that saved run.'));
  }, [replayId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m);
    const st = document.createElement('style'); st.textContent = CURSOR_CSS; document.head.appendChild(st);
    document.documentElement.classList.add('demo-cursor-on');
    return () => { m.remove(); st.remove(); document.documentElement.classList.remove('demo-cursor-on'); };
  }, []);
  if (q.get('embed') === '1') return <EmbeddedRun />;
  if (replayId && !cfg) return <div className="p-8 text-sm text-keeper-body">{linkErr || 'Loading the saved run…'}</div>;
  if (!cfg) return <DemoSetup onRun={setCfg} />;
  return cfg.frame === 'phone' && !fromLink && !replayId ? <PhoneFrame cfg={cfg} /> : <DemoRun cfg={cfg} />;
}
