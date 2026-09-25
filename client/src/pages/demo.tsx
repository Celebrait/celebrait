// client/src/pages/demo.tsx
//
// THE DEMO — the three-card route as a product demo for social video
// (Aidan 2026-09-15). Its own screens, one per beat, no scrolling, no
// chrome; the SAME engine underneath (concepts, fronts, the cameo, the
// inside all come from /api/make/*), so what's on film is what the
// product makes.
//
// AIDAN DRIVES IT. It used to be able to play itself — a director that
// walked the screens like a thumb — and that went, along with the
// camera punch-in, on 2026-09-24 ("remove play itself feature entirely,
// remove zoom push entirely"). What is left is clean screens, a violet
// ring where his tap lands, and a clock.
//
//   hook → brief → glowing generator → Option 1/2/3 (swipe, pulsing
//   Choose) → add a photo? → put them in → the inside → the 3D card,
//   tapped open → where's it going? → it's on the way.
//
// Versions are links, so a link IS a version:
//   /demo?preset=mum-70-garden&hook=typed   (the photo step needs a preset with a photo)
//   /demo?preset=dad-60-canal               (no photo → the photo screen is skipped)
//
// Admin-only (every load spends real generations) and noindex. The
// recorder (scratchpad rec/record-demo.mjs) reads window.__demo for
// beats + timestamps and stops on state 'end'.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Camera, Sparkles, Play, Send, Loader2 } from 'lucide-react';
import { BriefQuestions, RECIPIENTS, defaultFront, emptyBrief, occasionLabelFor, ageOf, isKidBrief, whoPhrase, frontWordOf, type Brief } from '@/components/brief-questions';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { expectedBy, formatDayMonth } from '@shared/pricing';
import celebraitLogo from '@/assets/celebrait.webp';
import cakeIcon from '@/assets/icons/cake.png';
import ringIcon from '@/assets/icons/ring.png';
import presentIcon from '@/assets/icons/present.png';
import heartIcon from '@/assets/icons/heart.png';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { PhotoRun, DEMO_PHOTO_PRESETS, loadReplayCard, type ReplayCard } from '@/pages/demo-photo';

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
  /** Which door this run films. 'cards' = the three-card route (this
   *  file). 'photo' = the photo-first route, which is a different
   *  product with a different engine — see demo-photo.tsx. */
  route?: 'cards' | 'photo';
  /** Photo-route only: which saved photo brief the run plays. */
  photoPreset?: string;
  /** Photo-route only: replay a card that has ALREADY been made, instead
   *  of making one. Every real run leaves a finished card behind — the
   *  recipient, the scene, the words and both images — so the card IS
   *  the saved run, and no generation, upload or draft is needed to
   *  play it back. Costs nothing and works on every card ever made. */
  replayCardId?: number;
  hook: boolean;
  /** Seconds before the run starts — time to hit record. */
  countdown: number;
  /** Ask "anything they can't stand?" as its own screen. */
  askDislike?: boolean;
  /** Which of who / occasion / age appear as questions on screen; the
   *  rest are set in the builder and said in the hook (Aidan 2026-09-16). */
  askOnScreen?: { who?: boolean; occasion?: boolean; age?: boolean };
  /** How big the whole thing is drawn in the recorded frame, 1 = as it
   *  fits today. Under 1 pulls back so a platform's caption and like
   *  rail don't sit over anything; over 1 punches in to fill a 9:16
   *  crop (Aidan 2026-09-23: "alter the scale … so it fits nicer on
   *  social platforms"). The ground fills the frame at any scale. */
  scale?: number;
  /** The running clock, top right (on unless false). */
  timer?: boolean;
  /** Leave the photo screen out entirely (Aidan 2026-09-16: no "No photo" button on screen). */
  skipPhoto?: boolean;
  /** Play a saved run instead of generating. */
  replay?: ReplayRun;
  clip?: ClipKey;
  /** Lead with the finished card, then go back and build it (Aidan
   *  2026-09-25). Replay only — there is nothing to lead with otherwise.
   *  Photo route for now; the three-card route's own opener would be the
   *  `guess` clip, which already exists. */
  opener?: boolean;
  /** Replay waits: as long as the original run took, or short. */
  waits?: 'real' | 'short' | 'none';
}

// ── the ground ───────────────────────────────────────────────────────
//
// The shared CelebrationBackdrop puts FOUR objects in the four corners,
// which is right for a landing page you scroll past. On a demo the
// camera sits wide between every page, and four corner icons on a lot
// of cream reads as an unfinished screen rather than a designed one
// (Aidan 2026-09-24: "I need zoomed out views to have a full design
// bg").
//
// The first attempt at "more" was a SCATTER — a dozen objects from 6 to
// 18vmin thrown at the corners with the middle cut out of a mask — and
// it read as broken for three reasons worth keeping written down:
//
//   1. The mask ramp ran ACROSS each object. A 130px present sitting on
//      the 46%→72% edge of the gradient was solid down one side and
//      dissolved down the other. Half an object is a rendering fault,
//      not a design.
//   2. The size range was too wide to be depth. The 6vmin motifs at 0.11
//      didn't read as "far away", they read as dirt on the lens.
//   3. Scattered objects sliced in half by the frame edge look dropped.
//
// So this is a WALLPAPER, not a scatter, and every one of those three
// stops being a problem: one motif size on a staggered grid, one opacity
// band, and a vignette so gradual that no single motif spans enough of
// it to fade unevenly. A pattern is *allowed* to run off the edge — that
// is how the eye reads "it continues", so the clipping now helps.
//
// Still paper tones only, no colour wash — a tinted field behind the
// phone read as a weird sheen once and got binned (2026-09-23).

const MOTIFS = [cakeIcon, ringIcon, presentIcon, heartIcon];

/** Deterministic jitter, so the ground is identical on every load and
 *  in every take — a shoot re-runs the same screen a dozen times and the
 *  background may not shuffle between them. */
function jitter(seed: number): number {
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  return n - Math.floor(n);
}

type Motif = { x: number; y: number; size: number; rot: number; o: number; icon: string; dur: number; delay: number };

const FIELD: Motif[] = (() => {
  const out: Motif[] = [];
  const COL = 22; // % of the frame between columns
  const ROW = 13; // % of the frame between rows
  let seed = 0;
  let r = 0;
  for (let y = -4; y < 107; y += ROW, r++) {
    const stagger = r % 2 ? COL / 2 : 0;
    let c = 0;
    for (let x = -7 + stagger; x < 108; x += COL, c++) {
      const a = jitter(++seed);
      const b = jitter(seed + 91);
      const d = jitter(seed + 17);
      const e = jitter(seed + 53);
      out.push({
        x: x + (a - 0.5) * 5,
        y: y + (b - 0.5) * 4,
        size: 6.4 + d * 2.0,
        rot: (e - 0.5) * 30,
        o: 0.54 + a * 0.26,
        // c*3 + r*5 walks all four motifs along a row and shifts the
        // start each row, so no two neighbours ever match.
        icon: MOTIFS[(c * 3 + r * 5) % MOTIFS.length],
        dur: 11 + b * 7,
        delay: d * 9,
      });
    }
  }
  // HALF of them, and a third of the weight (Aidan picked this over both
  // the full print and a bare paper ground, 2026-09-24). Dropping every
  // other motif of the flattened grid thins the columns without touching
  // the rows, so the stagger survives; the survivors go up slightly in
  // size to keep the field from reading as dust.
  return out.filter((_, i) => i % 2 === 0).map((m) => ({ ...m, size: m.size * 1.15, o: m.o * 0.34 }));
})();

/** Holds the field back behind the words without ever cutting a hole in
 *  it. Every stop is opaque to some degree — the middle is quiet, not
 *  empty — and the ramp runs over ~30% of the frame, which is six times
 *  a motif's width, so nothing fades visibly across its own body. */
const FIELD_MASK =
  'radial-gradient(ellipse 74% 54% at 50% 46%, rgba(0,0,0,0.17) 0%, rgba(0,0,0,0.28) 40%, rgba(0,0,0,0.62) 74%, rgba(0,0,0,0.95) 100%)';

const PAPER = 'linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 55%, #F4F1EA 100%)';

export function DemoBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: PAPER }}>
      <div className="absolute inset-0" style={{ maskImage: FIELD_MASK, WebkitMaskImage: FIELD_MASK }}>
        {FIELD.map((f, i) => (
          <img
            key={i}
            src={f.icon}
            alt=""
            draggable={false}
            className="demo-float absolute select-none"
            style={{
              left: `${f.x}%`, top: `${f.y}%`,
              height: `clamp(22px, ${f.size}vmin, 72px)`, width: 'auto',
              opacity: f.o,
              ['--rot' as string]: `${f.rot}deg`,
              ['--dur' as string]: `${f.dur}s`,
              ['--delay' as string]: `-${f.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── skin ─────────────────────────────────────────────────────────────

/** The whole /demo page — builder, countdown, run, the phone's bezel —
 *  shows a tiny faint dot instead of the pointer, in both modes (Aidan
 *  2026-09-17: "dot throughout, the cursor is intrusive for my screen
 *  recording"). Taps still burst in manual runs. */
const CURSOR_CSS = `
  .demo-cursor-on, .demo-cursor-on * { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Ccircle cx='4' cy='4' r='2.5' fill='rgba(60,56,70,0.32)' stroke='rgba(255,255,255,0.5)' stroke-width='0.75'/%3E%3C/svg%3E") 4 4, auto !important; }
`;

export const CSS = `
  @keyframes demo-ring { 0% { transform: translate(-50%,-50%) scale(.55); opacity: .95 } 70% { opacity: .55 } 100% { transform: translate(-50%,-50%) scale(1.7); opacity: 0 } }
  @keyframes demo-dot { 0% { opacity: .9 } 100% { opacity: 0 } }
  .demo-ring { position: fixed; z-index: 2147483000; pointer-events: none; width: 46px; height: 46px; border-radius: 50%;
    border: 3px solid #7a76e8; background: rgba(122,118,232,.22); animation: demo-ring 420ms cubic-bezier(.2,.7,.3,1) forwards; }
  .demo-dot { position: fixed; z-index: 2147483000; pointer-events: none; width: 14px; height: 14px; border-radius: 50%; background: #7a76e8;
    transform: translate(-50%,-50%); animation: demo-dot 420ms ease-out forwards; }

  /* Manual runs: no pointer on screen at all (Aidan 2026-09-16). */
  /* The first letter lands at one fixed point and the text only grows
     downward from there — no re-centring as lines wrap (Aidan 2026-09-16). */
  /* NEVER EATS A TAP. It is decoration over a full-screen layer, and it
     only picked up pointer-events:none once it had finished typing and
     gained .out — which was harmless while a director drove the run and
     waited the hook out, and became a dead screen the moment Aidan drove
     it himself (2026-09-25). A tap during the hook now lands on what is
     underneath, so a take can cut the opener short. */
  .demo-hook { pointer-events: none; position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-start; justify-content: flex-start; padding: 36vh 8vw 8vw;
    background: transparent; transition: opacity 600ms ease; }
  /* Left-aligned, Fraunces Bold, the recipient in violet → ink (Aidan 2026-09-15). */
  .demo-hook p { font-family: 'Fraunces', Georgia, serif; font-weight: 700; font-size: clamp(30px, 9.5vw, 56px); line-height: 1.08; letter-spacing: -0.01em; color: #211D19; margin: 0; text-align: left; max-width: 100%; }
  .demo-hook .who { background: linear-gradient(90deg, #7a76e8 0%, #211D19 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  /* The same treatment as the overlay hook, for a line that sits ON a
     screen — the opener types its sentence under the card rather than
     across the whole frame. */
  .demo-line { font-family: 'Fraunces', Georgia, serif; font-weight: 700; font-size: clamp(19px, 5.2vw, 24px); line-height: 1.22; letter-spacing: -0.01em; color: #211D19; margin: 0; text-align: center; }
  .demo-line .who { background: linear-gradient(90deg, #7a76e8 0%, #211D19 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .demo-line .caret { display: inline-block; width: .07em; height: .92em; background: #7a76e8; margin-left: .06em; vertical-align: -.1em; animation: demo-caret 900ms steps(2) infinite; }
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

  @keyframes demo-float { 0% { transform: translate(-50%,-50%) rotate(var(--rot)) translateY(0) } 50% { transform: translate(-50%,-50%) rotate(var(--rot)) translateY(-9px) } 100% { transform: translate(-50%,-50%) rotate(var(--rot)) translateY(0) } }
  .demo-float { transform: translate(-50%,-50%) rotate(var(--rot)); animation: demo-float var(--dur) ease-in-out infinite; animation-delay: var(--delay); }
  @media (prefers-reduced-motion: reduce) { .demo-float { animation: none } }

  .demo-rail { scrollbar-width: none; } .demo-rail::-webkit-scrollbar { display: none; }

  @keyframes demo-tick { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1) } }
  .demo-tick { animation: demo-tick 700ms cubic-bezier(.2,.8,.3,1.2) both; }
`;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The ring belongs to the screen it was tapped on (Aidan 2026-09-15: it
 *  was "pulsing on a place that is not relevant on the next screen"). So:
 *  a short flash, and anything still showing is cleared the moment the
 *  screen moves on. */
const RING_MS = 420;
export function clearRings() { for (const el of Array.from(document.querySelectorAll('.demo-ring, .demo-dot'))) el.remove(); }
export function ring(x: number, y: number) {
  for (const cls of ['demo-ring', 'demo-dot']) {
    const el = document.createElement('div');
    el.className = cls; el.style.left = `${x}px`; el.style.top = `${y}px`;
    document.body.appendChild(el); setTimeout(() => el.remove(), RING_MS + 40);
  }
}

/** Find one element by selector and visible text/label/placeholder, polling. */
export async function find(sel: string, text: RegExp | null, timeoutMs = 20_000, enabled = true): Promise<HTMLElement> {
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
export async function typeHook(raw: string, words: string[]) {
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
export function mark(name: string, state?: string) {
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
/** A render that never answers used to take the whole run with it. The
 *  three cards are drawn in PARALLEL, so one stuck request killed the
 *  take — and killed it late, about two minutes in, which on a shoot is
 *  the worst possible moment (2026-09-24: a run died with two of three
 *  back and the third silent, no error, the provider simply never
 *  replied).
 *
 *  Renders now get a SHORT deadline and one fresh attempt, so a hung
 *  request costs fifteen seconds instead of the take. Only a STALL is
 *  retried — a real error still surfaces immediately, and a safety
 *  refusal still goes to drawSafely, which wraps this. */
const RENDER_MS = 45_000;
const isStall = (e: any) => e?.name === 'TimeoutError' || e?.name === 'AbortError';
async function drawOnce<T>(draw: () => Promise<T>, onRetry?: () => void): Promise<T> {
  try {
    return await draw();
  } catch (e) {
    if (!isStall(e)) throw e;
    onRetry?.();
    return await draw();
  }
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
export async function warm(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const job = (async () => {
    const m = PNG_URL.exec(url);
    if (m) { if (!(await loadImage(`${m[1]}${m[2]}_t.webp`))) await loadImage(`/api/thumb/${m[2]}.png`); }
    await loadImage(url);
  })();
  await Promise.race([job, sleep(6000)]);
}
export const warmAll = (urls: Array<string | null | undefined>) => Promise.all(urls.map(warm)).then(() => undefined);

const toDataUrl = async (url: string) => {
  const blob = await fetch(url).then((r) => r.blob());
  return new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error('read')); fr.readAsDataURL(blob); });
};
/** A phone photo the way the product sends one (make.tsx readCameoFile):
 *  decoded and oriented, no edge over 1600px, JPEG — so a full-size HEIC
 *  never reaches the model raw (2026-09-15: a photo of Mum came back as
 *  the same card without her). */
export async function preparePhoto(file: Blob): Promise<string> {
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
export const POST_FLIGHT_MS = 1700;
export function PostFlight({ src }: { src: string }) {
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

type Phase = 'countdown' | 'opener' | 'brief' | 'generating' | 'results' | 'photo' | 'photo-generating' | 'photo-result' | 'inside' | 'inside-generating' | 'card' | 'sent' | 'intro' | 'guess';

// ── the page ─────────────────────────────────────────────────────────

/** Every screen enters rising and fading in, and leaves fading out — a
 *  cut between two flat screens reads as a glitch on video. */
// Exit is quick so the next screen (already decoded) lands without a gap.
export const SCREEN = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10, transition: { duration: 0.22 } }, transition: { duration: 0.42, ease: [0.2, 0.7, 0.3, 1] } } as const;

export const H1 = 'font-display text-[26px] leading-[1.15] font-bold tracking-[-0.015em] text-keeper-ink';
export const PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-full bg-keeper-ink px-6 py-3.5 text-[15px] font-semibold text-keeper-paper';
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
export function PhotoPicker({ photo, onPick, onCancel }: { photo: string; onPick: () => void; onCancel: () => void }) {
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

export function DemoRun({ cfg, ground = true }: { cfg: DemoConfig; ground?: boolean }) {
  const preset = cfg; const hook = cfg.hook;
  const replay = cfg.replay;
  const clip: ClipKey = replay ? (cfg.clip ?? 'full') : 'full';
  const pi = replay?.pickedIndex ?? 0;
  /** Lead with the card this run actually produced, then go back and
   *  build it (Aidan 2026-09-25). Replay only — nothing to lead with on
   *  a fresh run — and whole runs only: a clip already IS an alternate
   *  opening, and stacking one in front of it would mean two. */
  // THE CAMEO IS THE FINAL CARD. frontUrls[pi] is the card as it was
  // BEFORE the person was put into it, so leading with that shows the
  // wrong one — the empty scene — and then the reveal produces a card
  // the opener never promised (Aidan 2026-09-25: "it wasn't the final
  // card with mum in photo, it was the one without her"). The reveal
  // picks chosenFront the same way, and so does the replay picker's own
  // thumbnail one line below.
  const openerFront = replay ? (replay.cameoUrl ?? replay.frontUrls?.[pi] ?? replay.frontUrls?.[0] ?? null) : null;
  const openerOn = cfg.opener === true && clip === 'full' && !!openerFront;
  const firstPhase: Phase = openerOn ? 'opener' : clip === 'full' ? 'brief' : 'intro';
  const showClock = cfg.timer !== false && clip === 'full';
  const [phase, setPhase] = useState<Phase>(cfg.countdown > 0 ? 'countdown' : firstPhase);
  const phaseRef = useRef<Phase>(phase); phaseRef.current = phase;
  const [count, setCount] = useState(cfg.countdown);
  // While the hook types, the question panel waits out of sight (the hook
  // overlay is see-through so the backdrop icons show).
  const [hookOn, setHookOn] = useState(cfg.hook && !openerOn);
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
  const rootRef = useRef<HTMLDivElement>(null);
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
  const photoStep = !cfg.skipPhoto;
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
  // Latest engine state for the async render steps.
  const conceptsRef = useRef<Concept[]>([]); conceptsRef.current = concepts;
  const pickedRef = useRef(0); pickedRef.current = picked;
  const wordsRef = useRef({ dear: '', message: '', from: '' }); wordsRef.current = { dear, message, from };

  const who = whoPhrase({ who: brief.who || preset.who, name: '' });
  const chosenFront = useCameo && cameoUrl ? cameoUrl : fronts[picked];
  // An engine failure ends the run visibly — and tells the recorder.
  const fail = (e: any) => { const m = e?.message ?? 'That didn’t work'; setError(m); mark(`FAILED: ${m}`, 'failed'); };

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
      (x) => drawOnce(
        () => post('render', { front_text: x.front_text, art_direction: x.art_direction, palette: x.palette, typeface: x.typeface, format: x.format ?? 'hero', characters: 'objects', freeStyle: true }, RENDER_MS),
        () => mark(`card ${i + 1}: stalled, redrawing`),
      ),
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
    const drawWith = (x: Concept) => drawOnce(
      () => post('render', { front_text: x.front_text, art_direction: x.art_direction, palette: x.palette, typeface: x.typeface, format: x.format ?? 'hero', characters: 'objects', freeStyle: true, cameoPhoto: photo, cameoMode: 'redraw' }, RENDER_MS),
      () => mark('photo: stalled, redrawing'),
    );
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
    const r = await drawOnce(
      () => post('render-inside', { ...(joined ? { mode: 'own', message: joined } : { mode: 'blank' }), palette: c.palette, typeface: c.typeface, art_direction: c.art_direction, characters: 'objects', freeStyle: true, direction: c.direction }, RENDER_MS),
      () => mark('inside: stalled, redrawing'),
    );
    await warmAll([r.imageUrl, chosenFront]);
    setInsideUrl(r.imageUrl); setPhase('card'); mark('inside: done', 'card');
  };

  useEffect(() => {
    const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);
  useEffect(() => {
    if (started.current) return; started.current = true;
    window.__demo = { state: 'idle', events: [] };
    // NO COUNTDOWN MEANS NO TIMER — see the note on the photo route. A
    // zero countdown still armed a one-second interval that reset the
    // phase, which throws a human back a screen if they tap inside that
    // second (2026-09-25).
    let n = cfg.countdown;
    const open = () => { setPhase(firstPhase); mark(`${firstPhase}: open`, firstPhase); };
    const tick = n > 0
      ? window.setInterval(() => { n -= 1; setCount(n); if (n <= 0) { window.clearInterval(tick); open(); } }, 1000)
      : 0;
    if (n <= 0) open();
    // Aidan drives, always. His taps get the ring; the hook types
    // itself and then steps aside, and a clip jumps to its own first
    // screen once it has.
    const onDown = (e: PointerEvent) => ring(e.clientX, e.clientY);
    const onUp = () => window.setTimeout(clearRings, 140);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('click', onUp, true);
    const t = window.setTimeout(() => {
      const go = () => { if (clip !== 'full') enterClip().catch(fail); };
      if (!cfg.hook || openerOn) { go(); return; }   // the opener types its own line
      void typeHook(cfg.hookLine, [cfg.who, cfg.name]).then(() => { setHookOn(false); go(); });
    }, cfg.countdown * 1000 + (cfg.countdown > 0 ? 1600 : 900));
    return () => { window.clearTimeout(t); window.clearInterval(tick); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('click', onUp, true); };
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
        route: 'cards',
        label: `${who}, ${brief.age || cfg.age} · ${occasionLabelFor(brief)}`,
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
    <>
      {/* OUTSIDE the zoomer on purpose. The punch-in transforms
          everything inside it, and a `fixed` layer inside a transformed
          ancestor is positioned against THAT ancestor — so the floating
          field scaled and slid away with the camera, and the frame lost
          its pattern exactly when it was tightest. Out here it is a
          still ground the content moves against, which is how a real
          punch-in reads anyway (Aidan 2026-09-24: "when we have the
          camera zoomed out lets retain the pattern on screen").
          The logo went with it — not relevant on a demo. */}
      {ground && <DemoBackdrop />}
    <div ref={rootRef} className="keeper-serif fixed inset-0 overflow-hidden">
      {hook && !openerOn && <div className="demo-hook" aria-hidden="true"><p><span className="caret" /></p></div>}
      {showClock && clockFrom != null && (
        // Centred under the logo: clear of the like/share rail (right) and the
        // caption (bottom) on Reels and TikTok.
        <div className="pointer-events-none absolute left-1/2 top-[11vh] z-10 flex -translate-x-1/2 flex-col items-center rounded-2xl border border-keeper-hair bg-white px-4 py-1.5 shadow-[0_4px_16px_-8px_rgba(33,29,25,.18)]" aria-label="Time taken to get here">
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

      {/* 0b · the hook: here is the card, now watch it get made. Flat and
              ajar rather than the 3D turn — the turn belongs to the
              reveal, and spending it here leaves the reveal with nothing
              the viewer has not seen. Matches the photo route's opener. */}
      {phase === 'opener' && openerFront && (
        <motion.section key="opener" {...SCREEN} className="absolute inset-0">
          <DemoOpener frontUrl={openerFront} insideUrl={replay?.insideUrl} line={hook ? cfg.hookLine : null}
            label="Watch it get made" onStart={() => { setPhase('brief'); mark('brief: open', 'brief'); }} />
        </motion.section>
      )}

      {/* 1 · the brief */}
      {phase === 'brief' && (
        <motion.section key="brief" {...SCREEN} className="absolute inset-0 flex flex-col justify-start overflow-y-auto px-5 pb-10 pt-[24vh]" /* top edge pinned: only the bottom moves between questions */>
          <motion.div className="rounded-2xl border border-keeper-hair bg-white p-5" initial={false} animate={{ opacity: hookOn ? 0 : 1, y: hookOn ? 12 : 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
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
            className="mt-6 flex aspect-[4/5] w-[min(70vw,40vh,260px)] shrink-0 items-center justify-center self-center overflow-hidden rounded-2xl border-2 border-dashed border-keeper-hair bg-white">
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
            <input data-demo="dear" style={{ textAlign: 'left' }} value={dear} onChange={(e) => setDear(e.target.value)} aria-label="Dear" placeholder={`Dear ${who},`} className="h-12 rounded-full border border-keeper-hair bg-white px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none" />
            <textarea data-demo="message" style={{ textAlign: 'left' }} value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Your message" rows={5} className="demo-glow-field rounded-2xl border border-keeper-hair bg-white px-4 py-3 text-[16px] leading-relaxed text-keeper-ink focus:outline-none" />
            <input data-demo="from" style={{ textAlign: 'left' }} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" placeholder="Love, …" className="h-12 rounded-full border border-keeper-hair bg-white px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none" />
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
            {/* backLogo: white board with the mark centred on the back.
                Without it the viewer falls back to backCredit, which sets
                the words "Made with Celebrait" in small type instead —
                the photo route has had the logo since 2026-09-23 and this
                one was missed (Aidan 2026-09-25: "the rear of my 3d card
                on the demo needs to be white and have my branding"). */}
            <Card3DViewer frontImageUrl={chosenFront} insideImageUrl={insideUrl} open={cardOpen} onOpenChange={setCardOpen}
              onFirstFrame={() => setCardPainted(true)}
              enableRotate enableZoom={false}
              backLogo backCaption="celebrait.co.uk"
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
    </>
  );
}


// ── the builder: make a demo ──────────────────────────────────────────

const NAME_LIKE = ['Mum', 'Dad', 'Nan', 'Grandad'];
const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-[14px] font-medium transition-colors ${on ? 'border-brand bg-brand-muted text-brand-dark' : 'border-keeper-hair bg-white/80 text-keeper-ink hover:border-brand/60'}`;
const field = 'h-11 w-full rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none focus:border-brand';
const label = 'mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.14em] text-keeper-meta';

/** A saved-run row from the API, in the shape a replay uses. */
export function toReplay(x: any): ReplayRun {
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
  const [cfg, setCfg] = useState<DemoConfig>({ ...DEMO_PRESETS['mum-70-garden'], hook: true, countdown: 3 });
  const set = (patch: Partial<DemoConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const canRole = NAME_LIKE.includes(cfg.who);
  const ask = cfg.askOnScreen ?? {};
  const setAsk = (k: 'who' | 'occasion' | 'age', v: boolean) => set({ askOnScreen: { ...ask, [k]: v } });
  // A value is still needed when it is set here.
  const showValue = (k: 'who' | 'occasion' | 'age') => !ask[k] && source !== 'replay';
  const readPhoto = (f: File) => { const r = new FileReader(); r.onload = () => set({ photo: String(r.result) }); r.readAsDataURL(f); };
  // Replay: play a saved run again, whole or as a short clip, with no new
  // generations (Aidan 2026-09-17).
  const [source, setSource] = useState<'new' | 'replay'>('new');
  const [runs, setRuns] = useState<ReplayRun[] | null>(null);
  const [runsErr, setRunsErr] = useState('');
  // Photo route: replay a run THIS VIEW made (Aidan 2026-09-25). It used
  // to list every finished card in the account, which meant dozens of
  // cards made elsewhere, most of them shaped nothing like a take.
  const [cards, setCards] = useState<Array<{ id: number; frontImageUrl: string | null; recipientName: string | null; occasion: string | null; createdAt?: string }> | null>(null);
  const [cardsErr, setCardsErr] = useState('');
  useEffect(() => {
    if (cards !== null) return;
    fetch('/api/admin/demo-runs?route=photo&approved=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => setCards((j.runs ?? []).map((r: any) => ({
        id: r.id,
        frontImageUrl: r.frontUrls?.[0] ?? null,
        recipientName: (r.brief?.name ?? '') || null,
        occasion: (r.brief?.occasion ?? '') || null,
        createdAt: r.created_at,
      })).filter((c: { frontImageUrl: string | null }) => !!c.frontImageUrl).slice(0, 12)))
      .catch(() => setCardsErr('Could not load your saved runs.'));
  }, [cards]);
  useEffect(() => {
    if (source !== 'replay' || runs) return;
    fetch('/api/admin/demo-runs?route=cards&approved=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => setRuns((j.runs ?? []).map(toReplay).filter(playable)))
      .catch(() => setRunsErr('Could not load saved runs.'));
  }, [source, runs]);
  const isReplay = source === 'replay';
  // Which door this run films. The photo route is a different product
  // with a different engine, so it ignores almost every option below —
  // there is no vibe, no three cards and nothing to pick.
  const isPhoto = cfg.route === 'photo';
  const clip: ClipKey = cfg.clip ?? 'full';
  // The brief options only matter when the whole run plays.
  const full = !isReplay || clip === 'full';
  const pickRun = (r: ReplayRun) => setCfg((c) => configFromRun(r, c, c.clip ?? 'full'));
  const pickClip = (k: ClipKey) => setCfg((c) => (c.replay ? configFromRun(c.replay, c, k) : { ...c, clip: k }));
  const ready = isPhoto ? true : isReplay ? !!cfg.replay : (!!(ask.who || cfg.who) && !!(ask.occasion || cfg.occasion.trim()));
  return (
    <div className="keeper-serif relative min-h-screen">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <div className="mx-auto max-w-xl px-5 pb-24 pt-8">
        <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" />
        <h1 className={`${H1} mt-6`}>Make a demo.</h1>
        <p className="mt-1 text-[14px] text-keeper-body">Press Run, start your screen recording during the countdown, then tap through it yourself.</p>

        {/* Run sits at the top and stays there while you scroll, so the
            recording can be ready before you press it (Aidan 2026-09-17). */}
        <div className="sticky top-0 z-20 -mx-5 mt-4 border-b border-keeper-hair/70 bg-[#FFFDF9]/90 px-5 py-3 backdrop-blur">
          <button type="button" disabled={!ready} onClick={() => onRun(cfg)} className={`${PRIMARY} w-full disabled:opacity-40`}><Play className="h-4 w-4 text-cta" /> {isReplay ? 'Play the replay' : 'Run the demo'}</button>
          <p className="mt-1.5 text-center text-[12px] text-keeper-meta">{isReplay ? 'Replays reuse the saved cards. No new generations.' : 'Each run spends one set of generations.'}</p>
        </div>

        <div className="mt-5"><span className={label}>Which door</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(!isPhoto)} onClick={() => set({ route: 'cards' })}>Three cards</button>
            <button type="button" className={chip(isPhoto)} onClick={() => {
              const key = cfg.photoPreset ?? Object.keys(DEMO_PHOTO_PRESETS)[0];
              set({ route: 'photo', photoPreset: key, hookLine: DEMO_PHOTO_PRESETS[key].hookLine, replay: undefined, clip: undefined });
              setSource('new');
            }}>Photo first</button>
          </div>
          <p className="mt-1.5 text-[12px] text-keeper-meta">{isPhoto ? 'A real photo, a described scene, one card. The front takes 30\u2013120s to draw \u2014 that wait is the product, so it stays on film.' : 'A few words about them, three cards to pick from.'}</p>
        </div>

        {isPhoto && (
          <div className="mt-5"><span className={label}>Start from</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(!cfg.replayCardId)} onClick={() => set({ replayCardId: undefined })}>Make a new one</button>
              <button type="button" className={chip(!!cfg.replayCardId)}
                onClick={() => set({ replayCardId: cfg.replayCardId ?? cards?.[0]?.id })}>Replay a saved run</button>
            </div>
            <p className="mt-1.5 text-[12px] text-keeper-meta">
              {cfg.replayCardId
                ? 'Plays a run this page has already made. Nothing is generated and nothing is charged, so the wait is yours to set.'
                : 'Makes a real card. Costs a generation and takes a couple of minutes.'}
            </p>

            {cfg.replayCardId && (
              <div className="mt-4 space-y-4">
                {cardsErr && <p className="text-[13px] text-accent-red-dark">{cardsErr}</p>}
                {!cards && !cardsErr && <p className="text-[13px] text-keeper-meta">Loading your saved runs\u2026</p>}
                {cards && cards.length === 0 && <p className="text-[13px] text-keeper-meta">No approved runs yet. Finish one on this route, then tick it as re-usable on <a href="/admin/demo-runs" className="text-brand underline">/admin/demo-runs</a>.</p>}
                {cards && cards.length > 0 && (
                  <div className="grid grid-cols-3 gap-2.5">
                    {cards.map((c) => {
                      const on = cfg.replayCardId === c.id;
                      return (
                        <button key={c.id} type="button" onClick={() => set({ replayCardId: c.id })}
                          className={`overflow-hidden rounded-xl border-2 bg-white text-left transition-colors ${on ? 'border-brand' : 'border-transparent hover:border-brand/40'}`}>
                          <img src={c.frontImageUrl ?? ''} alt="" crossOrigin="anonymous" className="aspect-square w-full object-cover" loading="lazy" />
                          <span className="block px-2 pb-2 pt-1.5 text-[11.5px] leading-tight text-keeper-ink">
                            {c.recipientName ?? `Run ${c.id}`}
                            <span className="block text-keeper-meta">{c.occasion ?? ''}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div><span className={label}>The wait</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={chip((cfg.waits ?? 'real') === 'real')} onClick={() => set({ waits: 'real' })}>As long as it really took</button>
                    <button type="button" className={chip(cfg.waits === 'short')} onClick={() => set({ waits: 'short' })}>A beat</button>
                    <button type="button" className={chip(cfg.waits === 'none')} onClick={() => set({ waits: 'none' })}>Straight to the card</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {isPhoto && !cfg.replayCardId && (
          <div className="mt-5"><span className={label}>Whose photo</span>
            <div className="grid grid-cols-3 gap-2.5">
              {Object.entries(DEMO_PHOTO_PRESETS).map(([k, p]) => (
                <button key={k} type="button" onClick={() => set({ photoPreset: k, hookLine: p.hookLine })}
                  className={`overflow-hidden rounded-xl border-2 bg-white text-left transition-colors ${cfg.photoPreset === k ? 'border-brand' : 'border-transparent hover:border-brand/40'}`}>
                  <img src={p.photo} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                  <span className="block px-2 pb-2 pt-1.5 text-[11.5px] leading-tight text-keeper-ink">{p.name}<span className="block text-keeper-meta">{p.occasion}</span></span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-keeper-meta">{DEMO_PHOTO_PRESETS[cfg.photoPreset ?? '']?.scene ?? ''}</p>
          </div>
        )}

        {!isPhoto && <div className="mt-5"><span className={label}>Start from</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(!isReplay)} onClick={() => { setSource('new'); set({ replay: undefined, clip: undefined }); }}>A new run</button>
            <button type="button" className={chip(isReplay)} onClick={() => setSource('replay')}>Replay a saved run</button>
          </div>
        </div>}

        {isReplay && !isPhoto && (
          <div className="mt-5 space-y-5">
            {runsErr && <p className="text-[13px] text-accent-red-dark">{runsErr}</p>}
            {!runs && !runsErr && <p className="text-[13px] text-keeper-meta">Loading saved runs…</p>}
            {runs && runs.length === 0 && <p className="text-[13px] text-keeper-meta">No approved runs yet. Every run that reaches “It’s on the way” is saved; tick one as re-usable on /admin/demo-runs and it shows here.</p>}
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

        <div className="mt-7 space-y-6">
          {full && !isPhoto && <div className="rounded-2xl border border-keeper-hair bg-white/70 p-4 space-y-4">
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
          {full && !isPhoto && <div><span className={label}>Can’t stand</span>
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
          {!isReplay && !isPhoto && <div><span className={label}>Photo step</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(!cfg.skipPhoto)} onClick={() => set({ skipPhoto: false })}>Include it</button>
              <button type="button" className={chip(!!cfg.skipPhoto)} onClick={() => set({ skipPhoto: true })}>Skip it</button>
            </div>
          </div>}
          {!isReplay && !isPhoto && !cfg.skipPhoto && <div><span className={label}>Photo of them (optional — or pick one live from the tile)</span>
            <div className="flex items-center gap-3">
              <label className={`${chip(false)} cursor-pointer`}>Choose photo<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readPhoto(f); e.target.value = ''; }} /></label>
              {cfg.photo && <img src={cfg.photo} alt="" className="h-12 w-12 rounded-lg object-cover" />}
              {cfg.photo && <button type="button" className={QUIET} onClick={() => set({ photo: undefined })}>Remove</button>}
            </div>
          </div>}
          {((isPhoto && !!cfg.replayCardId) || (!isPhoto && isReplay && (cfg.clip ?? 'full') === 'full')) && <div><span className={label}>Opening</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(cfg.opener === true)} onClick={() => set({ opener: true })}>Card first</button>
              <button type="button" className={chip(cfg.opener !== true)} onClick={() => set({ opener: false })}>Straight into the build</button>
            </div>
            <p className="mt-1.5 text-[12px] text-keeper-meta">Hold the finished card, type the hook over it, then tap to go back and build it. The clock still starts at the first question.</p>
          </div>}
          <div><span className={label}>Opening line</span>
            <div className="flex flex-wrap gap-2"><button type="button" className={chip(cfg.hook)} onClick={() => set({ hook: true })}>Typed hook</button><button type="button" className={chip(!cfg.hook)} onClick={() => set({ hook: false })}>Straight in</button></div>
            {cfg.hook && <textarea value={cfg.hookLine} onChange={(e) => set({ hookLine: e.target.value.slice(0, 140) })} rows={2} className="mt-2 w-full rounded-2xl border border-keeper-hair bg-white/90 px-4 py-3 text-[15px] text-keeper-ink focus:outline-none focus:border-brand" />}
            {cfg.hook && <p className="mt-1.5 text-[12px] text-keeper-meta">Wrap a word in *asterisks* for the purple-to-black gradient. The recipient’s word gets it anyway.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className={label}>Size in frame</span>
              <div className="flex flex-wrap gap-2">
                {[0.7, 0.8, 0.9, 1, 1.15, 1.3].map((z) => (
                  <button key={z} type="button" className={chip((cfg.scale ?? 1) === z)} onClick={() => set({ scale: z })}>{Math.round(z * 100)}%</button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-keeper-meta">Under 100% pulls back, so a caption or the like rail doesn&rsquo;t cover anything. Over 100% fills a 9:16 crop. The background fills the frame either way.</p>
            </div>
            <div><span className={label}>Countdown</span><div className="flex gap-2">{[0, 3, 5, 10].map((n) => <button key={n} type="button" className={chip(cfg.countdown === n)} onClick={() => set({ countdown: n })}>{n}s</button>)}</div></div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── the phone mockup ─────────────────────────────────────────────────
// The run plays in an iframe the size of an iPhone 15, so every vw/vh and
/** THE OPENER — the finished card, before a single question is asked.
 *
 *  Sequence, because Aidan asked for one (2026-09-25: "card needs to
 *  come in nicely like a loading spinner … with the button appearing
 *  post text"): a spinner holds the space while the 3D textures load,
 *  the card eases in the moment it has actually painted its first frame,
 *  the line types itself underneath, and only then does the button
 *  arrive. Nothing pops.
 *
 *  The line types as ONE sentence, not the overlay hook's sentence-by-
 *  sentence beats — on this screen it is a caption under a card, not a
 *  title card of its own.
 *
 *  Sizes are % and vh, never vw: the run is staged inside a 9:16 column,
 *  and vw is viewport-relative, so on a desktop it would blow straight
 *  through the column's edges. */
/** The opener's line is a CAPTION under a card, so it types briskly.
 *  typingDelay() is tuned for the full-bleed hook, where a title card
 *  holds the whole screen and can afford half a second on a full stop —
 *  borrowing it here spent 4.4s on one short sentence. */
function captionDelay(text: string, i: number): number {
  const ch = text[i];
  const jitter = 0.8 + ((Math.sin((i + 1) * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.4;
  let d = 26 * jitter;
  if (ch === '.' || ch === '!' || ch === '?') d += 170;
  else if (ch === ',' || ch === ';' || ch === '—') d += 80;
  else if (ch === ' ') d += 20;
  return d;
}

/** The line types in its OWN component, below the card in the tree.
 *  Held in the parent, every keystroke re-rendered DemoOpener and with
 *  it the Card3DViewer — a three.js canvas — so one 36-character
 *  sentence cost 36 WebGL re-renders and took 3.5s to type instead of
 *  ~1.2s. State belongs as deep as the thing that changes. */
function OpenerLine({ line, onDone }: { line: HookLine; onDone: () => void }) {
  const [typed, setTyped] = useState(0);
  const started = useRef(false);
  const doneRef = useRef(onDone); doneRef.current = onDone;

  /** When each character is due, as ms from the first one. */
  const schedule = useMemo(() => {
    const out: number[] = []; let t = 0;
    for (let i = 0; i < line.text.length; i += 1) { t += captionDelay(line.text, i); out.push(t); }
    return out;
  }, [line]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // DRIVEN BY THE CLOCK, not by one setTimeout per character. A
    // three.js canvas and a field of animated motifs keep the main
    // thread busy enough that a 30ms timer lands nearer 90ms, so
    // chaining one timer per character typed a 36-character line in
    // 3.3s however small the delay asked for. Reading the elapsed time
    // each frame and catching up makes the duration what it says it is.
    let raf = 0; const t0 = performance.now() + 260; // a breath, then it writes
    const frame = () => {
      const elapsed = performance.now() - t0;
      if (elapsed >= 0) {
        let n = 0;
        while (n < schedule.length && schedule[n] <= elapsed) n += 1;
        setTyped(n);
        if (n >= schedule.length) { window.setTimeout(() => doneRef.current(), 300); return; }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [schedule]);

  return (
    <p className="demo-line min-h-[2.6em] max-w-[22ch] shrink-0" aria-label={line.text}
      dangerouslySetInnerHTML={{ __html: typed > 0 ? hookHtml(line, typed) : '' }} />
  );
}

export function DemoOpener({ frontUrl, insideUrl, line, label, onStart }: {
  frontUrl: string; insideUrl?: string | null; line?: string | null; label: string; onStart: () => void;
}) {
  const [painted, setPainted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [showLine, setShowLine] = useState(true);
  const [ready, setReady] = useState(false);
  const parsed = useMemo(() => (line ? parseHook(line, []) : null), [line]);

  // THE LINE GOES FIRST, alone and centred, then the card, then the
  // button just behind it (Aidan 2026-09-25). The order was the other
  // way round and the words were a caption on a picture; this way they
  // are a promise, and the card is what answers them.
  useEffect(() => { if (!parsed) setShowCard(true); }, [parsed]);
  useEffect(() => {
    if (!painted) return;
    // The line has said its piece by the time the card is up, and two
    // things competing under one card is a weaker frame than the card
    // alone (Aidan 2026-09-25: "no need to show the text once card is
    // revealed"). It goes as the card settles; the button takes its
    // place.
    const out = window.setTimeout(() => setShowLine(false), 260);
    const t = window.setTimeout(() => setReady(true), 420); // "just after" the card
    return () => { window.clearTimeout(out); window.clearTimeout(t); };
  }, [painted]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-5">
      <AnimatePresence initial={false}>
        {showCard && (
          <motion.div key="card" layout
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ opacity: { duration: 0.55, ease: [0.22, 1, 0.36, 1] }, scale: { duration: 0.55, ease: [0.22, 1, 0.36, 1] }, layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
            className="relative aspect-square w-[min(84%,42vh,400px)] shrink-0">
            {!painted && (
              <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <Loader2 className="h-7 w-7 animate-spin text-brand" strokeWidth={1.6} />
              </div>
            )}
            <motion.div className="absolute inset-x-[-60%] inset-y-[-16%]"
              initial={false} animate={{ opacity: painted ? 1 : 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
              {/* restYaw 0: any resting turn swings the card's painted
                  centroid off the middle of the frame, which reads as
                  "not central" however well the box is centred. */}
              <Card3DViewer frontImageUrl={frontUrl} insideImageUrl={insideUrl ?? undefined}
                open={open} onOpenChange={setOpen} onFirstFrame={() => setPainted(true)}
                enableRotate enableZoom={false}
                backLogo backCaption="celebrait.co.uk"
                closedAngle={-0.26} restYaw={0} framingMargin={1.4} minDistance={1.05} maxDistance={8} className="h-full w-full" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {parsed && showLine && (
          <motion.div key="line" layout
            initial={false} exit={{ opacity: 0, y: -6 }}
            transition={{ opacity: { duration: 0.34, ease: 'easeOut' }, y: { duration: 0.34, ease: 'easeOut' }, layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
            className="shrink-0">
            <OpenerLine line={parsed} onDone={() => setShowCard(true)} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div layout initial={false} animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 8 }}
        transition={{ opacity: { duration: 0.4, ease: 'easeOut' }, y: { duration: 0.4, ease: 'easeOut' }, layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
        className="shrink-0">
        <button type="button" data-demo="opener" className={`${PRIMARY} demo-pulse`}
          disabled={!ready} onClick={onStart}>{label}</button>
      </motion.div>
    </div>
  );
}

/** The photo route, resolving a replayed card first when there is one.
 *  The run must not start until the card is in hand — its brief is what
 *  the director types. */
function PhotoRoute({ cfg, ground = true }: { cfg: DemoConfig; ground?: boolean }) {
  const id = cfg.replayCardId;
  const [card, setCard] = useState<ReplayCard | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!id) return;
    let off = false;
    loadReplayCard(id).then((c) => { if (!off) setCard(c); }).catch((e) => { if (!off) setErr(e?.message ?? 'Could not load that card.'); });
    return () => { off = true; };
  }, [id]);
  if (id && !card) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-keeper-paper px-8 text-center text-[14px] text-keeper-body">
        {err || `Loading card ${id}\u2026`}
      </div>
    );
  }
  return <PhotoRun cfg={cfg} replay={card ?? undefined} ground={ground} />;
}

export default function DemoPage() {
  const q = useMemo(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''), []);
  // A preset in the link runs straight away (the recorder's path); otherwise the builder.
  // `?route=photo&photo=<key>` films the photo door instead of the
  // three-card one — a different product, so a different run.
  const fromLink = useMemo<DemoConfig | null>(() => {
    // ?run= is the saved demo run to play. ?card= is the old spelling of
    // the same thing and still works — it pointed at a studio card until
    // the photo route started saving its own runs (2026-09-25).
    const card = Number(q.get('run') ?? q.get('card'));
    const replayCardId = Number.isFinite(card) && card > 0 ? card : undefined;
    const w = q.get('waits');
    const waits = w === 'none' || w === 'short' || w === 'real' ? w : undefined;
    const z = Number(q.get('scale'));
    const common = { hook: q.get('hook') === 'typed', countdown: 0, opener: q.get('opener') === 'card', scale: Number.isFinite(z) && z > 0 ? Math.min(2, Math.max(0.4, z)) : 1 };
    const photoKey = q.get('photo');
    if (q.get('route') === 'photo' || photoKey || replayCardId) {
      const key = photoKey && DEMO_PHOTO_PRESETS[photoKey] ? photoKey : Object.keys(DEMO_PHOTO_PRESETS)[0];
      const p = DEMO_PHOTO_PRESETS[key];
      // A DemoConfig carries the three-card fields whether or not this
      // route uses them, so it starts from a card preset — but the bits
      // the photo run actually reads (the opening line, who it's for)
      // must come from the PHOTO preset, or the hook introduces somebody
      // who never appears (caught 2026-09-22: Sarah's run opened with
      // "Watch us make a card for Mum … lives in her garden").
      return { ...DEMO_PRESETS['mum-70-garden'], ...common, route: 'photo', photoPreset: key, hookLine: p.hookLine, who: p.name, name: p.name, occasion: p.occasion, replayCardId, waits };
    }
    const p = DEMO_PRESETS[q.get('preset') ?? ''];
    return p ? { ...p, ...common } : null;
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
        const base: DemoConfig = { ...DEMO_PRESETS['mum-70-garden'], hook: q.get('hook') === 'typed', countdown: 0, opener: q.get('opener') === 'card', waits: q.get('waits') === 'short' ? 'short' : 'real' };
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
  if (replayId && !cfg) return <div className="p-8 text-sm text-keeper-body">{linkErr || 'Loading the saved run…'}</div>;
  if (!cfg) return <DemoSetup onRun={setCfg} />;
  const s = cfg.scale ?? 1;
  const run = cfg.route === 'photo' ? <PhotoRoute cfg={cfg} ground={false} /> : <DemoRun cfg={cfg} ground={false} />;
  // THE STAGE — a 9:16 column, always, on every screen.
  //
  // This is filmed for vertical social, so a desktop browser showing a
  // 1440-wide run is the wrong shape to record (Aidan 2026-09-25: "even
  // desktop view should be mobile … we should have the screen size
  // rendered on a desktop"). Not a phone mockup — that went, and it is
  // not coming back — just the right aspect ratio: 56.25vh is 9:16 of
  // the viewport height, capped at the real width so a phone is
  // unaffected. The surround is a tint of the hairline token so the
  // edges of the recording are visible to frame against, while the
  // column itself stays clean paper.
  //
  // Both the transform here and the -translate-x-1/2 make this element
  // the containing block for every `fixed inset-0` layer inside it —
  // the run's root AND the ground. That is deliberate: the ground has
  // to fill the recorded column edge to edge at any scale, which is why
  // it is drawn here rather than inside the run (Aidan 2026-09-24:
  // "there's a border of white … this whole thing needs to be filled").
  return (
    <div className="fixed inset-0 overflow-hidden bg-keeper-hair/45">
      <div className="absolute inset-y-0 left-1/2 w-[min(100vw,56.25vh)] -translate-x-1/2 overflow-hidden">
        <DemoBackdrop />
        <div className="absolute inset-0" style={{ transform: `scale(${s})`, transformOrigin: 'center center' }}>{run}</div>
      </div>
    </div>
  );
}
