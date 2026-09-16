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
import { Check, Camera, Sparkles, Play, Send } from 'lucide-react';
import { BriefQuestions, RECIPIENTS, defaultFront, emptyBrief, occasionLabelFor, ageOf, isKidBrief, whoPhrase, frontWordOf, type Brief } from '@/components/brief-questions';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { GestureHints } from '@/components/gesture-hints';
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
  /** The running clock, top right (on unless false). */
  timer?: boolean;
  /** Leave the photo screen out entirely (Aidan 2026-09-16: no "No photo" button on screen). */
  skipPhoto?: boolean;
  /** 'phone' = the run plays inside a phone mockup on the page (Aidan
   *  2026-09-16: "render this in a phone mock up"); 'full' = edge to edge. */
  frame?: 'phone' | 'full';
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

  /* Manual runs: no pointer on screen at all (Aidan 2026-09-16). */
  /* Manual runs: a tiny faint dot instead of the pointer, so Aidan can see
     where he is but it barely reads on a recording. Taps still burst. */
  .demo-cursor-on, .demo-cursor-on * { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Ccircle cx='4' cy='4' r='2.5' fill='rgba(60,56,70,0.32)' stroke='rgba(255,255,255,0.5)' stroke-width='0.75'/%3E%3C/svg%3E") 4 4, auto !important; }
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
  target.style.transition = 'opacity 260ms ease';
  const parts = sentencesOf(raw);
  await sleep(500); // a moment before the first letter
  for (let k = 0; k < parts.length; k++) {
    const line = parseHook(parts[k], words);
    target.style.opacity = '1';
    for (let i = 0; i < line.text.length; i++) {
      target.innerHTML = hookHtml(line, i + 1);
      // the full stop at the end of a screen holds below, not here
      await sleep(i === line.text.length - 1 ? 60 : typingDelay(line.text, i, line.ranges));
    }
    await sleep(k === parts.length - 1 ? 1500 : 1100); // read it
    if (k < parts.length - 1) {
      // Fade out and back in on the same spot — no slide.
      target.style.opacity = '0';
      await sleep(300); target.innerHTML = '<span class="caret"></span>';
      await sleep(40); target.style.opacity = '1'; await sleep(360);
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

const OCCASION_KEYS: Record<string, string> = { birthday: 'birthday', christmas: 'christmas', anniversary: 'anniversary', wedding: 'wedding' };
/** Where the on-screen brief opens: after who, occasion and age. */
const FIRST_ON_SCREEN = 3;
function briefFromConfig(cfg: DemoConfig): Brief {
  const who = cfg.who.trim();
  const occ = cfg.occasion.trim();
  return {
    ...emptyBrief(),
    who,
    gender: RECIPIENTS.find((r) => r.label === who)?.implies ?? null,
    occasion: OCCASION_KEYS[occ.toLowerCase()] ?? occ,
    age: cfg.age.replace(/\D/g, '').slice(0, 3),
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

type Phase = 'countdown' | 'brief' | 'generating' | 'results' | 'photo' | 'photo-generating' | 'photo-result' | 'inside-choice' | 'inside' | 'inside-generating' | 'card' | 'sent';

// ── the page ─────────────────────────────────────────────────────────

/** Every screen enters rising and fading in, and leaves fading out — a
 *  cut between two flat screens reads as a glitch on video. */
const SCREEN = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.5, ease: [0.2, 0.7, 0.3, 1] } } as const;

const H1 = 'font-display text-[26px] leading-[1.15] font-bold tracking-[-0.015em] text-keeper-ink';
const PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-full bg-keeper-ink px-6 py-3.5 text-[15px] font-semibold text-keeper-paper';
const QUIET = 'text-[14px] text-keeper-meta underline decoration-keeper-hair underline-offset-4';
/** The studio's green go button. */
const GREEN = 'inline-flex items-center justify-center gap-2 rounded-full bg-cta px-6 py-3.5 text-[15px] font-semibold text-cta-foreground shadow-sm transition-colors hover:bg-cta-hover';
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

function DemoRun({ cfg, embedded = false }: { cfg: DemoConfig; embedded?: boolean }) {
  const preset = cfg; const hook = cfg.hook; const beats = BEATS[cfg.speed];
  const [phase, setPhase] = useState<Phase>(cfg.countdown > 0 ? 'countdown' : 'brief');
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
  // The auto run turns the open card for a few seconds.
  const [spin, setSpin] = useState(false);
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
  const chooseCard = (i: number) => { setPicked(i); setPhase(photoStep ? 'photo' : 'inside-choice'); };
  // "Write it for me" prefills the message (Dear/From stay blank);
  // "I'll write it" leaves all three empty.
  const chooseInside = (by: 'us' | 'me') => {
    setMessage(by === 'us' ? (conceptsRef.current[pickedRef.current]?.inside_text ?? '') : '');
    setDear(''); setFrom(''); setPhase('inside');
  };
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
    setConcepts(cs);
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

    await until('results', 300_000); await sleep(b.look);
    // Swipe through the options, come back to the first.
    // The carousel mounts once the screen transition finishes — wait for it.
    { const t0 = Date.now(); while (!railRef.current && Date.now() - t0 < 10_000) await sleep(80); }
    const rail = railRef.current; if (!rail) throw new Error('demo: the options never appeared');
    const w = rail.clientWidth;
    for (const i of [1, 2, 0]) { rail.scrollTo({ left: i * w, behavior: 'smooth' }); await sleep(b.walk); }
    await tap(await findDemo('card-0'), b.settle, b.hold); mark('picked card 1');

    // The photo.
    if (photoStep && p.photo) {
      await sleep(b.look * 0.5);
      setPickerPhoto(await preparePhoto(await fetch(p.photo).then((r) => r.blob())));
      await tap(await findDemo('add-photo'), b.settle, 300);
      const mine = await findDemo('picker-photo', 8000); await sleep(900); // the grid settles
      await tap(mine, b.settle * 0.8, 200);
      await until('photo-generating', 10_000); mark('photo: added');
      await until('photo-result', 240_000); await sleep(b.look);
      await tap(await findDemo('to-inside'), b.settle, b.hold * 0.6); mark('photo: kept');
    } else {
      mark('photo: skipped');
    }

    // The inside.
    const by = p.insideBy ?? 'us';
    await tap(await findDemo(by === 'us' ? 'inside-us' : 'inside-me'), b.settle, b.hold * 0.6); mark(`inside: ${by}`);
    await type(await findDemo('dear') as HTMLInputElement, p.dear, b.settle, b.type);
    if (by === 'me') await type(await findDemo('message') as HTMLTextAreaElement, p.message ?? `Happy birthday, ${p.who}.`, b.settle, b.type);
    await type(await findDemo('from') as HTMLInputElement, p.from, b.settle, b.type);
    await tap(await findDemo('design-inside'), b.settle, 300);
    await until('card', 240_000); await sleep(b.look);

    // The card, tapped open.
    const card = await findDemo('card');
    const r = card.getBoundingClientRect(); ring(r.left + r.width / 2, r.top + r.height / 2); await sleep(120);
    setCardOpen(true); mark('card: open'); await sleep(b.look * 1.2);
    setSpin(true); await sleep(b.look * 1.4); setSpin(false); await sleep(b.look * 0.8);
    mark('card: done');
    await tap(await findDemo('post'), b.settle, 300);
    // The card flies off, then the tick and the words land.
    await until('sent', 10_000); await sleep(POST_FLIGHT_MS + b.look * 1.2);
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
      // No pointer at all on the recording (Aidan 2026-09-16) — the system
      // cursor is a tiny faint dot; clicks still land and still show the tap ring.
      document.documentElement.classList.add('demo-cursor-on');
      const onDown = (e: PointerEvent) => ring(e.clientX, e.clientY);
      const onClick = () => { window.setTimeout(clearRings, 140); };
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('click', onClick, true);
      const t = window.setTimeout(() => {
        if (!cfg.hook) return;
        void typeHook(cfg.hookLine, [cfg.who, cfg.name]).then(() => setHookOn(false));
      }, cfg.countdown * 1000 + (cfg.countdown > 0 ? 1600 : 900));
      return () => { window.clearTimeout(t); window.clearInterval(tick); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('click', onClick, true); document.documentElement.classList.remove('demo-cursor-on'); };
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
    <div className={`keeper-serif fixed inset-x-0 overflow-hidden ${embedded ? 'bottom-[22px] top-[50px]' : 'inset-y-0'}`}>
      {/* The make page's own backdrop: cream wash + the floating celebration icons. */}
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      {hook && <div className="demo-hook" aria-hidden="true"><p><span className="caret" /></p></div>}
      <div className="absolute left-5 top-5 z-10"><img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" /></div>
      {cfg.timer !== false && clockFrom != null && (
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
            <BriefQuestions skin="landing" minimal initialStep={FIRST_ON_SCREEN} askDislike={!!cfg.askDislike} brief={brief} onChange={setBrief} hideDots onDone={(b) => { setBrief(b); generate(b).catch(fail); }} />
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
          <div ref={railRef} onScroll={onRailScroll} onWheel={onRailWheel} onPointerDown={onRailDown} onPointerUp={onRailUp} onDragStart={(e) => e.preventDefault()} className="demo-rail -my-4 flex shrink-0 snap-x snap-mandatory overflow-x-auto py-12">
            {fronts.map((u, i) => (
              <div key={i} className="flex w-full shrink-0 snap-center items-center justify-center px-8">
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
        <motion.section key="photo" {...SCREEN} className={`absolute inset-0 flex flex-col justify-center px-5 pb-12 text-center ${cfg.timer !== false ? 'pt-[20vh]' : 'pt-16'}`}>
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
          <button type="button" data-demo="to-inside" aria-label="Use this card" onClick={() => { setUseCameo(true); setPhase('inside-choice'); }}
            className="mt-8 mb-3 w-[min(76vw,44vh,340px)] shrink-0 self-center transition-transform active:scale-[0.98]"><AjarTile imageUrl={cameoUrl} alt="" eager openDeg={22} /></button>
        </motion.section>
      )}

      {/* 6 · the inside */}
      {phase === 'inside-choice' && (
        <motion.section key="inside-choice" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-5 py-16 text-center">
          <h1 className={H1}>Now the inside.</h1>
          <div className="mt-6 flex flex-col gap-3">
            <button type="button" data-demo="inside-us" className={`${TILE} text-left`} onClick={() => chooseInside('us')}>
              <span className="flex items-center gap-2 text-[16px] font-semibold text-keeper-ink"><Sparkles className="h-4 w-4 text-brand" /> Write it for me</span>
              <span className="text-[13px] text-keeper-meta">We write the message. You add who it’s to and from.</span>
            </button>
            <button type="button" data-demo="inside-me" className={`${TILE} text-left`} onClick={() => chooseInside('me')}>
              <span className="text-[16px] font-semibold text-keeper-ink">I’ll write it</span>
              <span className="text-[13px] text-keeper-meta">Your own words, set in the card’s style.</span>
            </button>
          </div>
        </motion.section>
      )}

      {phase === 'inside' && (
        <motion.section key="inside" {...SCREEN} className="absolute inset-0 flex flex-col justify-center overflow-y-auto px-5 py-16 text-center">
          <h1 className={H1}>Now the inside.</h1>
          <div className="mt-5 flex flex-col gap-3">
            <input data-demo="dear" style={{ textAlign: 'left' }} value={dear} onChange={(e) => setDear(e.target.value)} aria-label="Dear" className="h-12 rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none" />
            <textarea data-demo="message" style={{ textAlign: 'left' }} value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Your message" rows={5} className="demo-glow-field rounded-2xl border border-keeper-hair bg-white/95 px-4 py-3 text-[16px] leading-relaxed text-keeper-ink focus:outline-none" />
            <input data-demo="from" style={{ textAlign: 'left' }} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" className="h-12 rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none" />
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
        <motion.section key="card" {...SCREEN} className="absolute inset-0 flex flex-col">
          <div data-demo="card" className={`relative min-h-0 w-full flex-1 ${cfg.timer !== false ? 'pt-[20vh]' : 'pt-10'}`}>
            <Card3DViewer frontImageUrl={chosenFront} insideImageUrl={insideUrl} open={cardOpen} onOpenChange={setCardOpen}
              enableRotate enableZoom={false} autoRotate={spin} autoRotateSpeed={2.2}
              closedAngle={-0.38} restYaw={-0.12} framingMargin={1.35} minDistance={1.3} maxDistance={8} className="h-full w-full" />
          </div>
          <div className="flex h-[76px] shrink-0 items-start justify-center">
            <GestureHints open={cardOpen} mountDelayMs={500} hideZoomHint openLabel="Tap to close" />
          </div>
          <div className="shrink-0 px-5 pb-8">
            <button type="button" data-demo="post" className={`${GREEN} ${cardOpen ? 'demo-pulse' : ''} w-full`} onClick={() => { setPhase('sent'); mark('posted', 'sent'); }}>
              <Send className="h-4 w-4" /> Post it to them
            </button>
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
              {cfg.timer !== false && clockFrom != null && <p className="text-[13px] font-medium text-keeper-meta">Made and posted in {clockWords}</p>}
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

function DemoSetup({ onRun }: { onRun: (cfg: DemoConfig) => void }) {
  const [cfg, setCfg] = useState<DemoConfig>({ ...DEMO_PRESETS['mum-70-garden'], speed: 'normal', hook: true, countdown: 3, mode: 'manual', frame: 'phone' });
  const manual = cfg.mode === 'manual';
  const set = (patch: Partial<DemoConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const canRole = NAME_LIKE.includes(cfg.who);
  const readPhoto = (f: File) => { const r = new FileReader(); r.onload = () => set({ photo: String(r.result) }); r.readAsDataURL(f); };
  const ready = !!(cfg.who && cfg.occasion.trim()) && (manual || (cfg.thing.trim() && (cfg.front !== 'name' || cfg.name.trim())));
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
          <div className="rounded-2xl border border-keeper-hair bg-white/70 p-4 space-y-4">
          <p className="text-[13px] text-keeper-body">Not shown on screen: say these in the opening line.</p>
          <div><span className={label}>Who</span>
            <div className="flex flex-wrap gap-2">{RECIPIENTS.map((r) => <button key={r.label} type="button" className={chip(cfg.who === r.label)} onClick={() => set({ who: r.label, front: NAME_LIKE.includes(r.label) ? 'role' : cfg.name.trim() ? 'name' : 'none' })}>{r.label}</button>)}</div>
          </div>
          <div><span className={label}>Occasion</span>
            <div className="flex flex-wrap gap-2">{['Birthday', 'Christmas', 'Anniversary', 'Wedding'].map((o) => <button key={o} type="button" className={chip(cfg.occasion === o)} onClick={() => set({ occasion: o })}>{o}</button>)}</div>
            <input value={['Birthday', 'Christmas', 'Anniversary', 'Wedding'].includes(cfg.occasion) ? '' : cfg.occasion} onChange={(e) => set({ occasion: e.target.value.slice(0, 40) })} className={`${field} mt-2`} placeholder="Or type it… e.g. Retirement" />
          </div>
          <div><span className={label}>Age</span><input value={cfg.age} onChange={(e) => set({ age: e.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" className={`${field} max-w-[140px]`} placeholder="60" /></div>
          </div>
          <div><span className={label}>Can’t stand</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(!!cfg.askDislike)} onClick={() => set({ askDislike: true })}>Ask it on screen</button>
              <button type="button" className={chip(!cfg.askDislike)} onClick={() => set({ askDislike: false })}>Leave it out</button>
            </div>
          </div>
          <div><span className={label}>Timer</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(cfg.timer !== false)} onClick={() => set({ timer: true })}>Show it</button>
              <button type="button" className={chip(cfg.timer === false)} onClick={() => set({ timer: false })}>Hide it</button>
            </div>
          </div>
          {!manual && <>
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
          {!manual && <div><span className={label}>The inside</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip((cfg.insideBy ?? 'us') === 'us')} onClick={() => set({ insideBy: 'us' })}>Write it for me</button>
              <button type="button" className={chip(cfg.insideBy === 'me')} onClick={() => set({ insideBy: 'me' })}>I’ll write it</button>
            </div>
            {cfg.insideBy === 'me' && <textarea value={cfg.message ?? ''} onChange={(e) => set({ message: e.target.value.slice(0, 300) })} rows={2} placeholder="The message to type" className="mt-2 w-full rounded-2xl border border-keeper-hair bg-white/90 px-4 py-3 text-[15px] text-keeper-ink focus:outline-none focus:border-brand" />}
          </div>}
          {!manual && <div className="grid grid-cols-2 gap-3">
            <div><span className={label}>Dear</span><input value={cfg.dear} onChange={(e) => set({ dear: e.target.value })} className={field} /></div>
            <div><span className={label}>From</span><input value={cfg.from} onChange={(e) => set({ from: e.target.value })} className={field} /></div>
          </div>}
          <div><span className={label}>Photo step</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(!cfg.skipPhoto)} onClick={() => set({ skipPhoto: false })}>Include it</button>
              <button type="button" className={chip(!!cfg.skipPhoto)} onClick={() => set({ skipPhoto: true })}>Skip it</button>
            </div>
          </div>
          {!cfg.skipPhoto && <div><span className={label}>{manual ? 'Photo of them (optional — or pick one live from the tile)' : 'Photo of them'}</span>
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
            <div><span className={label}>Frame</span><div className="flex gap-2"><button type="button" className={chip(cfg.frame !== 'full')} onClick={() => set({ frame: 'phone' })}>Phone mockup</button><button type="button" className={chip(cfg.frame === 'full')} onClick={() => set({ frame: 'full' })}>Full screen</button></div></div>
            <div><span className={label}>Countdown</span><div className="flex gap-2">{[0, 3, 5, 10].map((n) => <button key={n} type="button" className={chip(cfg.countdown === n)} onClick={() => set({ countdown: n })}>{n}s</button>)}</div></div>
          </div>
        </div>

        <button type="button" disabled={!ready} onClick={() => onRun(cfg)} className={`${PRIMARY} mt-9 w-full disabled:opacity-40`}><Play className="h-4 w-4 text-cta" /> Run the demo</button>
        <p className="mt-3 text-center text-[12px] text-keeper-meta">Each run spends one set of generations.</p>
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

function PhoneFrame({ cfg }: { cfg: DemoConfig }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 40) / (PHONE_H + BEZEL * 2), (window.innerWidth - 32) / (PHONE_W + BEZEL * 2)));
    fit(); window.addEventListener('resize', fit);
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== EMBED_READY) return;
      frameRef.current?.contentWindow?.postMessage({ type: EMBED_CFG, cfg }, window.location.origin);
    };
    window.addEventListener('message', onMsg);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('message', onMsg); };
  }, [cfg]);
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(180deg, #F6F3EE 0%, #EFEBE4 100%)' }}>
      <div style={{ width: PHONE_W + BEZEL * 2, height: PHONE_H + BEZEL * 2, transform: `scale(${scale})`, padding: BEZEL }}
        className="relative shrink-0 rounded-[66px] bg-[#1d1a17] shadow-[0_50px_90px_-40px_rgba(33,29,25,.55),inset_0_0_0_2px_rgba(255,255,255,.08)]">
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
  useEffect(() => { const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m); return () => { m.remove(); }; }, []);
  if (q.get('embed') === '1') return <EmbeddedRun />;
  if (!cfg) return <DemoSetup onRun={setCfg} />;
  return cfg.frame === 'phone' && !fromLink ? <PhoneFrame cfg={cfg} /> : <DemoRun cfg={cfg} />;
}
