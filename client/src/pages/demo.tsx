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
export interface DemoConfig extends DemoPreset { speed: Speed; hook: boolean; /** Seconds before the run starts — time to hit record. */ countdown: number }
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
    border: 3px solid #7a76e8; background: rgba(122,118,232,.22); animation: demo-ring 720ms cubic-bezier(.2,.7,.3,1) forwards; }
  .demo-dot { position: fixed; z-index: 2147483000; pointer-events: none; width: 14px; height: 14px; border-radius: 50%; background: #7a76e8;
    transform: translate(-50%,-50%); animation: demo-dot 720ms ease-out forwards; }

  .demo-hook { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 8vw;
    background: linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%); transition: opacity 600ms ease; }
  .demo-hook p { font-family: 'Fraunces', Georgia, serif; font-size: clamp(30px, 9.5vw, 56px); line-height: 1.08; letter-spacing: -0.01em; color: #211D19; margin: 0; }
  .demo-hook .caret { display: inline-block; width: .08em; height: .95em; background: #7a76e8; margin-left: .08em; vertical-align: -.1em; animation: demo-caret 900ms steps(2) infinite; }
  @keyframes demo-caret { 50% { opacity: 0 } }
  .demo-hook.out { opacity: 0; pointer-events: none; }

  /* The generator: a blank card, breathing violet. No words but one. */
  @keyframes demo-shimmer { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }
  @keyframes demo-glow { 0%, 100% { box-shadow: 0 0 0 1px rgba(122,118,232,.16), 0 26px 70px rgba(122,118,232,.22) } 50% { box-shadow: 0 0 0 1px rgba(122,118,232,.4), 0 34px 96px rgba(122,118,232,.5) } }
  .demo-glow-card { width: min(74vw, 330px); aspect-ratio: 1 / 1; border-radius: 16px; position: relative;
    background: linear-gradient(120deg, #ffffff 0%, #edecfb 35%, #ffffff 55%, #f2f1fb 100%); background-size: 260% 260%;
    animation: demo-shimmer 2.6s ease-in-out infinite, demo-glow 2.6s ease-in-out infinite; }
  .demo-glow-card::after { content: ''; position: absolute; inset: 14px; border-radius: 10px; border: 1px dashed rgba(122,118,232,.35); }
  @keyframes demo-fade-up { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
  .demo-in { animation: demo-fade-up 420ms ease-out both; }

  /* The one thing to do on a screen pulses. */
  @keyframes demo-pulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(122,118,232,.45) } 50% { transform: scale(1.03); box-shadow: 0 0 0 14px rgba(122,118,232,0) } }
  .demo-pulse { animation: demo-pulse 1.7s ease-in-out infinite; }

  .demo-rail { scrollbar-width: none; } .demo-rail::-webkit-scrollbar { display: none; }

  @keyframes demo-tick { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1) } }
  .demo-tick { animation: demo-tick 700ms cubic-bezier(.2,.8,.3,1.2) both; }
`;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function ring(x: number, y: number) {
  for (const cls of ['demo-ring', 'demo-dot']) {
    const el = document.createElement('div');
    el.className = cls; el.style.left = `${x}px`; el.style.top = `${y}px`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 800);
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
  // A press you can see: the element dips for a beat before it acts.
  const prev = el.style.transform; const prevT = el.style.transition;
  el.style.transition = 'transform 140ms ease'; el.style.transform = 'scale(0.96)';
  await sleep(180);
  el.style.transform = prev; setTimeout(() => { el.style.transition = prevT; }, 200);
  await sleep(120);
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

type Phase = 'countdown' | 'brief' | 'generating' | 'results' | 'photo' | 'photo-generating' | 'photo-result' | 'inside' | 'inside-generating' | 'card' | 'send' | 'sent';

// ── the page ─────────────────────────────────────────────────────────

/** Every screen enters rising and fading in, and leaves fading out — a
 *  cut between two flat screens reads as a glitch on video. */
const SCREEN = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.5, ease: [0.2, 0.7, 0.3, 1] } } as const;

const H1 = 'font-display text-[26px] leading-[1.15] font-bold tracking-[-0.015em] text-keeper-ink';
const PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-full bg-keeper-ink px-6 py-3.5 text-[15px] font-semibold text-keeper-paper';
const QUIET = 'text-[14px] text-keeper-meta underline decoration-keeper-hair underline-offset-4';
const TILE = 'flex w-full flex-col items-start gap-1 rounded-2xl border border-keeper-hair bg-white/85 px-5 py-4 text-left';

function DemoRun({ cfg }: { cfg: DemoConfig }) {
  const preset = cfg; const hook = cfg.hook; const beats = BEATS[cfg.speed];
  const [phase, setPhase] = useState<Phase>(cfg.countdown > 0 ? 'countdown' : 'brief');
  const phaseRef = useRef<Phase>(phase); phaseRef.current = phase;
  const [count, setCount] = useState(cfg.countdown);
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
  const started = useRef(false);
  // Latest engine state for the director's async steps.
  const conceptsRef = useRef<Concept[]>([]); conceptsRef.current = concepts;
  const pickedRef = useRef(0); pickedRef.current = picked;
  const wordsRef = useRef({ dear: '', message: '', from: '' }); wordsRef.current = { dear, message, from };

  const who = whoPhrase({ who: brief.who || preset.who, name: '' });
  const chosenFront = useCameo && cameoUrl ? cameoUrl : fronts[picked];
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
    const r = await post('render', { front_text: c.front_text, art_direction: c.art_direction, palette: c.palette, typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true, cameoPhoto: photo, cameoMode: 'redraw' });
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
    if (hook) {
      const hookEl = await find('.demo-hook', null, 5000);
      const target = hookEl.querySelector('p')!; const caret = '<span class="caret"></span>';
      for (let i = 1; i <= p.hookLine.length; i++) { target.innerHTML = p.hookLine.slice(0, i) + caret; await sleep(38 + (p.hookLine[i - 1] === '.' ? 260 : 0)); }
      await sleep(1400); hookEl.classList.add('out'); await sleep(650); mark('hook: done');
    }
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
    const rail = railRef.current!; const w = rail.clientWidth;
    for (const i of [1, 2, 0]) { rail.scrollTo({ left: i * w, behavior: 'smooth' }); await sleep(b.walk); }
    await tap(await findDemo('choose'), b.settle, b.hold); mark('picked card 1');

    // The photo.
    if (p.photo) {
      await sleep(b.look * 0.5);
      await tap(await findDemo('add-photo'), b.settle, 300);
      setPhotoUrl(await toDataUrl(p.photo)); mark('photo: added'); await sleep(b.hold);
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
    const t = window.setTimeout(() => { direct().catch((e) => { setError(e?.message ?? String(e)); mark(`FAILED: ${e?.message ?? e}`, 'failed'); console.error('[DEMO]', e); }); }, cfg.countdown * 1000 + (cfg.countdown > 0 ? 1600 : 900)); // let the countdown fade out first
    return () => { window.clearTimeout(t); window.clearInterval(tick); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRailScroll = () => { const el = railRef.current; if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth)); };

  return (
    <div className="keeper-serif fixed inset-0 overflow-hidden" style={{ background: 'linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)' }}>
      {hook && <div className="demo-hook" aria-hidden="true"><p><span className="caret" /></p></div>}
      <div className="absolute left-5 top-5 z-10"><img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" /></div>
      {error && <p className="absolute inset-x-5 bottom-5 z-20 rounded-xl bg-accent-red-light px-4 py-3 text-sm text-accent-red-dark">{error}</p>}

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
        <motion.section key="brief" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-5 py-16">
          <div className="rounded-2xl border border-keeper-hair bg-white/85 p-5">
            <BriefQuestions skin="landing" brief={brief} onChange={setBrief} hideDots onDone={(b) => { setBrief(b); generate(b).catch((e) => setError(e?.message ?? 'That didn’t work')); }} />
          </div>
        </motion.section>
      )}

      {/* 2 · generating — a blank card breathing violet */}
      {(phase === 'generating' || phase === 'photo-generating' || phase === 'inside-generating') && (
        <motion.section key="generating" {...SCREEN} className="absolute inset-0 flex flex-col items-center justify-center gap-7 px-5">
          <div className="demo-glow-card" />
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-keeper-meta">Generating</p>
        </motion.section>
      )}

      {/* 3 · option 1 / 2 / 3 */}
      {phase === 'results' && (
        <motion.section key="results" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-0 py-16 text-center">
          <div className="px-5"><h1 className={H1}>Three cards for {who}.</h1><p className="mt-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-keeper-meta">Option {slide + 1} of 3</p></div>
          <div ref={railRef} onScroll={onRailScroll} className="demo-rail mt-5 flex snap-x snap-mandatory overflow-x-auto">
            {fronts.map((u, i) => (
              <div key={i} className="flex w-full shrink-0 snap-center items-center justify-center px-8">
                <div className="w-full max-w-[340px]"><AjarTile imageUrl={u} alt={concepts[i]?.front_text ?? ''} eager /></div>
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
          <button type="button" data-demo="add-photo" onClick={() => { /* the director drops the photo in */ }}
            className={`mt-6 flex aspect-[4/5] w-full max-w-[260px] items-center justify-center self-center overflow-hidden rounded-2xl border-2 ${photoUrl ? 'border-brand' : 'border-dashed border-keeper-hair bg-white/70'}`}>
            {photoUrl
              ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              : <span className="flex flex-col items-center gap-2 text-keeper-meta"><Camera className="h-7 w-7" strokeWidth={1.5} /><span className="text-[14px] font-medium">Add a photo</span></span>}
          </button>
          <div className="mt-8 flex flex-col items-center gap-4">
            {photoUrl
              ? <button type="button" data-demo="put-in" className={`${PRIMARY} demo-pulse w-full`} onClick={() => { if (photoUrl) renderCameo(photoUrl).catch((e) => setError(e?.message ?? 'That didn’t work')); }}><Sparkles className="h-4 w-4 text-cta" /> Put {who} in it</button>
              : <button type="button" data-demo="no-photo" className={QUIET} onClick={() => setPhase('inside')}>No photo — carry on</button>}
          </div>
        </motion.section>
      )}

      {/* 5 · there they are */}
      {phase === 'photo-result' && cameoUrl && (
        <motion.section key="photo-result" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-5 py-16 text-center">
          <h1 className={H1}>There’s {who}.</h1>
          <div className="mt-5 w-full max-w-[340px] self-center"><AjarTile imageUrl={cameoUrl} alt="" eager /></div>
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
            <textarea data-demo="message" style={{ textAlign: 'left' }} value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="rounded-2xl border border-keeper-hair bg-white/90 px-4 py-3 text-[15px] leading-relaxed text-keeper-ink focus:outline-none" />
            <input data-demo="from" style={{ textAlign: 'left' }} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Love, …" className="h-12 rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none" />
          </div>
          <div className="mt-6 flex flex-col items-center">
            <button type="button" data-demo="design-inside" className={`${PRIMARY} demo-pulse w-full`} onClick={() => renderInside().catch((e) => setError(e?.message ?? 'That didn’t work'))}><Sparkles className="h-4 w-4 text-cta" /> Design the inside</button>
          </div>
        </motion.section>
      )}

      {/* 7 · the card, tap to open */}
      {phase === 'card' && chosenFront && (
        <motion.section key="card" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-5 py-16 text-center">
          <h1 className={H1}>There it is.</h1>
          <div data-demo="card" className="mt-1 h-[60vh] w-full">
            {/* Big and centred; the open cover may swing past the edge (Aidan
                2026-09-15: "bigger… it can open off screen"). */}
            <Card3DViewer frontImageUrl={chosenFront} insideImageUrl={insideUrl} open={cardOpen} onOpenChange={setCardOpen} enableRotate={false} enableZoom={false} closedAngle={-0.38} restYaw={-0.12} framingMargin={1.25} minDistance={1.4} className="h-full w-full" />
          </div>
          <p className="mt-1 text-center text-[13px] text-keeper-meta">{cardOpen ? ' ' : 'Tap to open'}</p>
          <div className="mt-3 flex flex-col items-center">
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
  const [cfg, setCfg] = useState<DemoConfig>({ ...DEMO_PRESETS['mum-70-garden'], speed: 'normal', hook: true, countdown: 3 });
  const set = (patch: Partial<DemoConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const canRole = NAME_LIKE.includes(cfg.who);
  const readPhoto = (f: File) => { const r = new FileReader(); r.onload = () => set({ photo: String(r.result) }); r.readAsDataURL(f); };
  const ready = cfg.who && cfg.occasion && cfg.thing.trim() && (cfg.front !== 'name' || cfg.name.trim());
  return (
    <div className="keeper-serif min-h-screen" style={{ background: 'linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)' }}>
      <div className="mx-auto max-w-xl px-5 pb-24 pt-8">
        <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" />
        <h1 className={`${H1} mt-6`}>Make a demo.</h1>
        <p className="mt-1 text-[14px] text-keeper-body">Set the brief, press Run, start your screen recording during the countdown. The page does the rest.</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {Object.entries(DEMO_PRESETS).map(([k, p]) => (
            <button key={k} type="button" className={chip(false)} onClick={() => set({ ...p })}>{p.who}, {p.age}</button>
          ))}
        </div>

        <div className="mt-7 space-y-6">
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
          <div className="grid grid-cols-2 gap-3">
            <div><span className={label}>Dear</span><input value={cfg.dear} onChange={(e) => set({ dear: e.target.value })} className={field} /></div>
            <div><span className={label}>From</span><input value={cfg.from} onChange={(e) => set({ from: e.target.value })} className={field} /></div>
          </div>
          <div><span className={label}>Photo of them</span>
            <div className="flex items-center gap-3">
              <label className={`${chip(false)} cursor-pointer`}>Choose photo<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readPhoto(f); e.target.value = ''; }} /></label>
              {cfg.photo && <img src={cfg.photo} alt="" className="h-12 w-12 rounded-lg object-cover" />}
              {cfg.photo && <button type="button" className={QUIET} onClick={() => set({ photo: undefined })}>No photo step</button>}
            </div>
          </div>
          <div><span className={label}>Opening line</span>
            <div className="flex flex-wrap gap-2"><button type="button" className={chip(cfg.hook)} onClick={() => set({ hook: true })}>Typed hook</button><button type="button" className={chip(!cfg.hook)} onClick={() => set({ hook: false })}>Straight in</button></div>
            {cfg.hook && <textarea value={cfg.hookLine} onChange={(e) => set({ hookLine: e.target.value.slice(0, 120) })} rows={2} className="mt-2 w-full rounded-2xl border border-keeper-hair bg-white/90 px-4 py-3 text-[15px] text-keeper-ink focus:outline-none focus:border-brand" />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className={label}>Pace</span><div className="flex gap-2"><button type="button" className={chip(cfg.speed === 'normal')} onClick={() => set({ speed: 'normal' })}>Normal</button><button type="button" className={chip(cfg.speed === 'fast')} onClick={() => set({ speed: 'fast' })}>Fast</button></div></div>
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
    return p ? { ...p, speed: q.get('speed') === 'fast' ? 'fast' : 'normal', hook: q.get('hook') === 'typed', countdown: 0 } : null;
  }, [q]);
  const [cfg, setCfg] = useState<DemoConfig | null>(fromLink);
  useEffect(() => { const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m); return () => { m.remove(); }; }, []);
  return cfg ? <DemoRun cfg={cfg} /> : <DemoSetup onRun={setCfg} />;
}
