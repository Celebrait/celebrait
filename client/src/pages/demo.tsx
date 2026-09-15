// client/src/pages/demo.tsx
//
// THE DEMO — the three-card route, driving itself, for social video
// (Aidan 2026-09-15: "should be a separate part of my site… so we can
// make iterations together… different versions to test like one that
// starts with a typing hook").
//
// It renders the REAL /make page — same components, same engine — and a
// director walks it the way a thumb would: scroll to the chip, a violet
// ring where the tap lands, the tap, a held beat. Chrome that is noise
// on a phone screen (offer ticker, header buttons, step chips, Close,
// lead-time strip) is hidden by CSS here, in this file only; the product
// is untouched. Versions are query params so a link IS a version:
//
//   /demo?preset=dad-60-canal            the brief, the wait, the pick, the inside
//   /demo?preset=mum-70-garden&hook=typed opens on a typed hook line first
//   /demo?preset=…&speed=fast            tighter beats for a 30s cut
//
// Admin-only (it spends real generations on every load) and noindex.
// The recorder (scratchpad rec/record-demo.mjs) reads window.__demo for
// named beats + timestamps and stops on state 'end'.

import { useEffect, useMemo, useRef } from 'react';
import MakePage from '@/pages/make';

// ── versions ─────────────────────────────────────────────────────────

export interface DemoPreset {
  /** Chip labels exactly as the brief shows them. */
  who: string; occasion: string; age: string; vibe: 'Light humour' | 'Warm' | 'Cheeky';
  thing: string; cant: string; name: string;
  dear: string; from: string;
  /** The typed hook line, when hook=typed. */
  hook: string;
}

export const DEMO_PRESETS: Record<string, DemoPreset> = {
  'dad-60-canal': {
    who: 'Dad', occasion: 'Birthday', age: '60', vibe: 'Light humour',
    thing: 'Fishing on the canal every Sunday, rain or shine', cant: 'Getting up before 6am', name: 'Dave',
    dear: 'Dear Dad,', from: 'Love, Aidan x',
    hook: 'Watch us make a card for Dad. 60. Canal fishing every Sunday.',
  },
  'mum-70-garden': {
    who: 'Mum', occasion: 'Birthday', age: '70', vibe: 'Warm',
    thing: 'Her garden — the roses, the robin, the shed radio', cant: 'Slugs', name: 'Linda',
    dear: 'Dear Mum,', from: 'All our love, Aidan & Sam x',
    hook: 'Watch us make a card for Mum. 70. Lives in her garden.',
  },
  'mate-30-fiveaside': {
    who: 'Best mate', occasion: 'Birthday', age: '30', vibe: 'Cheeky',
    thing: 'Five-a-side on Thursdays, still thinks he can play', cant: 'Losing', name: 'Tom',
    dear: 'Tom,', from: 'The lads',
    hook: 'Watch us make a card for a mate who turns 30 and still thinks he can play.',
  },
};

type Speed = 'normal' | 'fast';
const BEATS: Record<Speed, { hold: number; type: number; settle: number; walk: number; look: number }> = {
  normal: { hold: 1500, type: 75, settle: 450, walk: 2600, look: 2500 },
  fast: { hold: 800, type: 45, settle: 250, walk: 1500, look: 1400 },
};

// ── demo skin: hide the noise, draw the taps ─────────────────────────

const DEMO_CSS = `
  [data-testid="ticker-banner"], [data-testid="lead-time-notice"], ol[aria-label="Steps"], .demo-hidden { display: none !important; }
  header > *:not([aria-label="Celebrait home"]) { display: none !important; }
  header { background: transparent !important; border-color: transparent !important; box-shadow: none !important; backdrop-filter: none !important; }
  /* The wordmark scrolls away with the page instead of floating over the cards. */
  div:has(> header) { position: absolute !important; }
  @keyframes demo-ring { 0% { transform: translate(-50%,-50%) scale(.55); opacity: .95 } 70% { opacity: .55 } 100% { transform: translate(-50%,-50%) scale(1.7); opacity: 0 } }
  @keyframes demo-dot { 0% { opacity: .9 } 100% { opacity: 0 } }
  .demo-ring { position: fixed; z-index: 2147483000; pointer-events: none; width: 46px; height: 46px; border-radius: 50%;
    border: 3px solid #7a76e8; background: rgba(122,118,232,.22); animation: demo-ring 720ms cubic-bezier(.2,.7,.3,1) forwards; }
  .demo-dot { position: fixed; z-index: 2147483000; pointer-events: none; width: 14px; height: 14px; border-radius: 50%; background: #7a76e8;
    transform: translate(-50%,-50%); animation: demo-dot 720ms ease-out forwards; }
  .demo-hook { position: fixed; inset: 0; z-index: 2147482000; display: flex; align-items: center; justify-content: center; padding: 8vw;
    background: linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%); transition: opacity 600ms ease; }
  .demo-hook p { font-family: 'Fraunces', Georgia, serif; font-size: clamp(30px, 9.5vw, 56px); line-height: 1.08; letter-spacing: -0.01em; color: #211D19; margin: 0; }
  .demo-hook .caret { display: inline-block; width: .08em; height: .95em; background: #7a76e8; margin-left: .08em; vertical-align: -.1em; animation: demo-caret 900ms steps(2) infinite; }
  @keyframes demo-caret { 50% { opacity: 0 } }
  .demo-hook.out { opacity: 0; pointer-events: none; }
`;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function ring(x: number, y: number) {
  for (const cls of ['demo-ring', 'demo-dot']) {
    const el = document.createElement('div');
    el.className = cls; el.style.left = `${x}px`; el.style.top = `${y}px`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 800);
  }
}

/** Find one element by role-ish selector and visible text, polling. */
async function find(sel: string, text: RegExp | null, timeoutMs = 20_000, enabled = true): Promise<HTMLElement> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const all = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((el) => {
      // offsetParent is null for position:fixed (the hook overlay) — use the box list.
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

async function bringIn(el: HTMLElement, settle: number) {
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await sleep(settle);
}

async function tap(el: HTMLElement, settle: number, hold: number) {
  await bringIn(el, settle);
  const r = el.getBoundingClientRect();
  ring(r.left + Math.min(r.width * 0.5, 120), r.top + r.height / 2);
  await sleep(90);
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
  for (let i = 1; i <= text.length; i++) {
    setter.call(el, text.slice(0, i));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(delay + (text[i - 1] === ' ' ? 40 : 0));
  }
  await sleep(600);
}

// ── the director ─────────────────────────────────────────────────────

declare global { interface Window { __demo?: { state: string; events: Array<{ name: string; t: number }> } } }

function mark(name: string, state?: string) {
  const d = (window.__demo ??= { state: 'idle', events: [] });
  d.events.push({ name, t: Date.now() });
  if (state) { d.state = state; document.documentElement.dataset.demoState = state; }
}

async function direct(p: DemoPreset, b: typeof BEATS.normal, hook: boolean) {
  const B = (sel: string, re: RegExp) => find(sel, re);
  mark('brief: open', 'brief');
  if (hook) {
    const hookEl = await find('.demo-hook', null, 5000);
    const target = hookEl.querySelector('p')!;
    const caret = '<span class="caret"></span>';
    for (let i = 1; i <= p.hook.length; i++) { target.innerHTML = p.hook.slice(0, i) + caret; await sleep(38 + (p.hook[i - 1] === '.' ? 260 : 0)); }
    await sleep(1400); hookEl.classList.add('out'); await sleep(650);
    mark('hook: done');
  }
  await sleep(600);
  await tap(await B('button', new RegExp(`^${p.who}$`)), b.settle, b.hold); mark(`who: ${p.who}`);
  await tap(await B('button', new RegExp(`^${p.occasion}`)), b.settle, b.hold); mark(`occasion: ${p.occasion}`);
  await type(await find('input', /Their age/) as HTMLInputElement, p.age, b.settle, b.type * 1.8);
  await tap(await B('button', /^Next/), b.settle, b.hold * 0.75); mark(`age: ${p.age}`);
  await tap(await B('button', new RegExp(p.vibe)), b.settle, b.hold); mark(`vibe: ${p.vibe}`);
  await type(await find('input', null) as HTMLInputElement, p.thing, b.settle, b.type);
  await tap(await B('button', /^Next/), b.settle, b.hold * 0.6); mark('interest: next');
  // "Add it" sits disabled until the box has text — look for it disabled.
  const addIt = await find('button', /^Add it/, 2500, false).catch(() => null);
  if (addIt) {
    await type(await find('input', /rival team/i) as HTMLInputElement, p.cant, b.settle, b.type);
    await tap(await B('button', /^Add it/), b.settle, b.hold * 0.75); mark("can't stand: added");
  }
  await type(await find('input', /Their first name/) as HTMLInputElement, p.name, b.settle, b.type * 1.5);
  await tap(await B('button', /Design my three cards/), b.settle, 400); mark('generating', 'generating');

  const cardSel = 'button[aria-label^="Choose this card:"]';
  await find(cardSel, null, 300_000);
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000 && document.querySelectorAll(`${cardSel}:not([disabled])`).length < 3) await sleep(200);
  mark('results', 'results'); await sleep(b.look);
  const cards = Array.from(document.querySelectorAll<HTMLElement>(`${cardSel}:not([disabled])`));
  for (const c of cards) { await bringIn(c, 0); await sleep(b.walk); }
  window.scrollTo({ top: 0, behavior: 'smooth' }); await sleep(1200);
  await tap(cards[0], b.settle, b.hold * 1.4); mark('picked card 1');

  const skip = await find('button', /Skip — keep it as it is/, 4000).catch(() => null);
  if (skip) { await sleep(900); await tap(skip, b.settle, b.hold * 0.8); mark('photo: skipped'); }

  const dear = await find('input', /How you open/, 4000).catch(() => null) as HTMLInputElement | null;
  if (dear) await type(dear, p.dear, b.settle, b.type);
  const from = await find('input', /How you sign/, 2000).catch(() => null) as HTMLInputElement | null;
  if (from) await type(from, p.from, b.settle, b.type);
  await tap(await B('button', /Design the inside/), b.settle, 400); mark('inside: generating', 'inside');

  const buy = await find('button', /^Buy it/, 240_000);
  mark('done', 'done'); await sleep(b.look);
  const inside = document.querySelector<HTMLElement>('img[alt="inside"]');
  if (inside) { await bringIn(inside, 0); await sleep(b.walk); }
  await bringIn(buy, 0); await sleep(b.look);
  mark('end', 'end');
}

// ── the page ─────────────────────────────────────────────────────────

export default function DemoPage() {
  const q = useMemo(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''), []);
  const preset = DEMO_PRESETS[q.get('preset') ?? ''] ?? DEMO_PRESETS['dad-60-canal'];
  const hook = q.get('hook') === 'typed';
  const speed: Speed = q.get('speed') === 'fast' ? 'fast' : 'normal';
  const started = useRef(false);

  useEffect(() => {
    const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m);
    const s = document.createElement('style'); s.id = 'demo-style'; s.textContent = DEMO_CSS; document.head.appendChild(s);
    // The Close link has no hook of its own.
    const sweep = window.setInterval(() => {
      for (const a of Array.from(document.querySelectorAll('a'))) if (a.textContent?.trim() === 'Close') a.classList.add('demo-hidden');
    }, 250);
    return () => { m.remove(); s.remove(); window.clearInterval(sweep); };
  }, []);

  useEffect(() => {
    if (started.current) return; started.current = true;
    window.__demo = { state: 'idle', events: [] };
    // Let the make page paint before the first tap.
    const t = window.setTimeout(() => {
      direct(preset, BEATS[speed], hook).catch((e) => { mark(`FAILED: ${e?.message ?? e}`, 'failed'); console.error('[DEMO]', e); });
    }, 900);
    return () => window.clearTimeout(t);
  }, [preset, speed, hook]);

  return (
    <>
      {hook && <div className="demo-hook" aria-hidden="true"><p><span className="caret" /></p></div>}
      <MakePage />
    </>
  );
}
