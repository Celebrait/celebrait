// client/src/pages/demo-photo.tsx
//
// THE PHOTO DEMO — the photo-first route filming itself (Aidan
// 2026-09-16: "can we get the photo upload first route on the demo as
// well? You'd need to proper build this as it's different to 3 card
// route — different model quality, describe scene, all that").
//
// It is a genuinely different product from the three-card route, so it
// is a genuinely different run. No concepts, no carousel, no picking —
// one card, built from a real photograph:
//
//   hook → who is it for → their photo (picked, uploaded, checked)
//        → describe the scene, in their own words
//        → what the front says → the front draws (~30–120s)
//        → there they are → the inside → the inside draws
//        → the 3D card, tapped open → post it → on the way.
//
// The engine is the REAL studio one, driven exactly as the maker drives
// it: a fresh draft per run (POST /api/studio/drafts), the photo through
// /api/photos/upload, then PATCH the draft state and POST
// /generate {mode:'front'} and /generate-inside, polling
// GET /api/studio/drafts/:id for the status to land. So what is on
// film is what a customer gets, at the quality a customer gets — the
// whole point of filming this door rather than faking it.
//
// Admin-only, like the rest of /demo: every run spends real generations
// and real money. A fresh draft each time because /generate 409s on any
// draft that is not still in 'draft'.
//
// The screens, the director's hands, the punch-in, the dot cursor, the
// clock and the posted flight are all shared with the three-card route
// (imported from demo.tsx) so the two films cut together.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Camera, Sparkles, Send, Loader2, User, Users, AlertTriangle } from 'lucide-react';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { expectedBy, formatDayMonth } from '@shared/pricing';
import celebraitLogo from '@/assets/celebrait.webp';
import type { CardDraftState } from '@shared/models/card-draft';
import type { PhotoMode } from '@shared/schema';
import { likenessNoteForSet, type PhotoSetNote } from '@/lib/photo-likeness';
import {
  BEATS, CSS, H1, PRIMARY, POST_FLIGHT_MS, SCREEN,
  PhotoPicker, PostFlight,
  cardGlow, clearRings, find, findDemo, mark, preparePhoto, ring,
  setZoomRoot, sleep, tap, tellGlow, tellTap, typeHook, typeInto, warm, warmAll,
  type DemoConfig,
} from '@/pages/demo';

// ── versions ─────────────────────────────────────────────────────────

/** One filmed photo brief. The scene line is what gets typed on screen,
 *  so it reads the way a real person types: short, specific, no prompt
 *  language. */
export interface PhotoPreset {
  /** Their first name — the whole route is built around one person. */
  name: string;
  /** The occasion, exactly as it goes into the draft. */
  occasion: string;
  /** The photograph, from client/public. */
  photo: string;
  /** Which door the photo goes through, exactly as the live step asks
   *  it: 'one_person' = 1–5 shots of the same face, 'group' = one photo
   *  that already has everyone in it. This is NOT cosmetic — the
   *  generator resolves a different front_scene prompt variant per mode
   *  (background-generator.ts reads state.photos.mode), so a couple sent
   *  as one_person is filmed through the wrong prompt. */
  photoMode: PhotoMode;
  /** What gets typed into "describe the scene". */
  scene: string;
  /** The front headline. Blank = let the product derive it from name +
   *  occasion, which is what most people do. */
  front: string;
  /** The inside, typed on the inside screen. */
  dear: string; message: string; from: string;
  /** The opening line, typed over the backdrop. */
  hookLine: string;
}

export const DEMO_PHOTO_PRESETS: Record<string, PhotoPreset> = {
  'sarah-anniversary': {
    name: 'Sarah', occasion: 'Anniversary',
    photo: '/hero-source-photo.webp',
    // Two people in the shot — 'group', or the front draws through the
    // single-face prompt and one of them goes missing.
    photoMode: 'group',
    scene: 'The two of us on a rooftop in New York at sunset, city lights behind us',
    front: '',
    dear: 'Sarah,',
    message: 'Ten years. Still the best decision I ever made.',
    from: 'All my love, Aidan x',
    hookLine: 'One photo of *Sarah*. One sentence. Watch what we do with it.',
  },
  'linda-70': {
    name: 'Linda', occasion: 'Birthday',
    photo: '/proof-source-photo.webp',
    photoMode: 'one_person',
    scene: 'Standing in her garden with the roses in full bloom and a robin on the fence',
    front: '',
    dear: 'Dear Mum,',
    message: 'Happy 70th. Here’s to the roses, the robin, and you in the middle of it all.',
    from: 'All our love, Aidan & Sam x',
    hookLine: 'A photo of *Linda*. Turning 70. Lives in her garden.',
  },
  'london-trip': {
    name: 'Emma', occasion: 'Birthday',
    photo: '/proof-bigben-source.webp',
    photoMode: 'one_person',
    scene: 'Outside Big Ben on a bright morning, London bus going past behind her',
    front: '',
    dear: 'Emma,',
    message: 'Happy birthday. Here’s to the next adventure — passports at the ready.',
    from: 'Love, Aidan x',
    hookLine: 'Give us *one photo*. We’ll put them anywhere.',
  },
};

// ── the engine, as the maker drives it ───────────────────────────────

async function api(method: string, path: string, body?: unknown, timeoutMs = 60_000): Promise<any> {
  const r = await fetch(path, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.message ?? j?.error ?? `${path} failed (${r.status})`), { status: r.status });
  return j;
}

/** The statuses a front generation can end on. 'front-ready' is the
 *  front-first happy path; 'completed' is the legacy single-job path,
 *  which the server still takes when FRONT_FIRST_GEN is off and no mode
 *  is passed — we always pass mode:'front', but a deployment could be
 *  running either, so both are accepted. */
const FRONT_DONE = new Set(['front-ready', 'inside-ready', 'completed']);
const INSIDE_DONE = new Set(['inside-ready', 'completed']);
const FAILED = new Set(['failed', 'inside-failed']);

interface DraftView { status: string; frontImageUrl: string | null; insideImageUrl: string | null; failure?: { message?: string } | null }

/** Poll the draft until `done` contains its status. Generation is
 *  fire-and-forget on the server, exactly as the real maker sees it. */
async function pollDraft(id: number, done: Set<string>, timeoutMs: number, onTick?: (s: string) => void): Promise<DraftView> {
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < timeoutMs) {
    const d = (await api('GET', `/api/studio/drafts/${id}`).catch(() => null)) as DraftView | null;
    if (d) {
      if (d.status !== last) { last = d.status; onTick?.(d.status); }
      if (done.has(d.status)) return d;
      if (FAILED.has(d.status)) throw new Error(d.failure?.message ?? 'The card didn’t come out');
    }
    await sleep(2500);
  }
  throw new Error('The card took too long');
}

/** The live studio never calls /api/photos/assess when signed in — the
 *  analysis lands on the photo row after the upload returns and the step
 *  polls the library for it. Same here, with the product's own 30s
 *  fail-open gate (ANALYSIS_GATE_MS): if the check hasn't settled by
 *  then the customer is let through, so the film is let through too. */
const ANALYSIS_GATE_MS = 30_000;
async function waitForVerdict(photoId: number, mode: PhotoMode): Promise<PhotoSetNote | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < ANALYSIS_GATE_MS) {
    const list = (await api('GET', '/api/user/photos').catch(() => null)) as Array<{ id: number; analyzedAt?: string | null; likeness?: unknown }> | null;
    const row = list?.find((p) => p.id === photoId);
    if (row?.analyzedAt) return likenessNoteForSet([row as never], mode);
    await sleep(1500);
  }
  return null;
}

type Phase =
  | 'countdown' | 'who' | 'mode' | 'photo' | 'checking' | 'scene' | 'front'
  | 'front-generating' | 'front-result' | 'inside' | 'inside-generating'
  | 'card' | 'sent';

// ── the run ──────────────────────────────────────────────────────────

export function PhotoRun({ cfg, embedded = false }: { cfg: DemoConfig; embedded?: boolean }) {
  const preset = useMemo<PhotoPreset>(
    () => DEMO_PHOTO_PRESETS[cfg.photoPreset ?? ''] ?? DEMO_PHOTO_PRESETS['sarah-anniversary'],
    [cfg.photoPreset],
  );
  const beats = BEATS[cfg.speed];
  const hook = cfg.hook;
  const showClock = cfg.timer !== false;
  // The builder can rewrite the opening line; the preset's is the default.
  const hookLine = cfg.hookLine?.trim() || preset.hookLine;

  const [phase, setPhase] = useState<Phase>(cfg.countdown > 0 ? 'countdown' : 'who');
  const phaseRef = useRef<Phase>(phase); phaseRef.current = phase;
  const [count, setCount] = useState(cfg.countdown);
  const [hookOn, setHookOn] = useState(cfg.hook);

  // What the person on screen fills in.
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState('');
  const [scene, setScene] = useState('');
  const [frontText, setFrontText] = useState('');
  const [dear, setDear] = useState(''); const [message, setMessage] = useState(''); const [from, setFrom] = useState('');

  // What the engine gives back.
  const [draftId, setDraftId] = useState<number | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  // Mirrors the live step's first question. Default one_person, same as
  // the product (nothing is written to the draft until it's chosen).
  const [photoMode, setPhotoMode] = useState<PhotoMode>('one_person');
  const photoModeRef = useRef<PhotoMode>('one_person'); photoModeRef.current = photoMode;
  /** The real traffic-light verdict off the uploaded photo row — the
   *  same note the customer reads, not a stand-in. Null = still looking. */
  const [note, setNote] = useState<PhotoSetNote | null>(null);
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [insideUrl, setInsideUrl] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardPainted, setCardPainted] = useState(false);
  const [error, setError] = useState('');

  // The picker sheet, shared with the three-card route.
  const [pickerPhoto, setPickerPhoto] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const draftRef = useRef<number | null>(null); draftRef.current = draftId;
  const sceneRef = useRef(''); sceneRef.current = scene;
  const wordsRef = useRef({ dear: '', message: '', from: '' }); wordsRef.current = { dear, message, from };
  const frontRef = useRef(''); frontRef.current = frontText;

  useEffect(() => {
    setZoomRoot(rootRef.current, cfg.mode === 'auto' && cfg.zoom !== false);
    return () => setZoomRoot(null, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The clock — the same one the three-card route films, so the two cuts
  // can be compared honestly. It starts at the first question and stops
  // the moment it's posted.
  const [clockFrom, setClockFrom] = useState<number | null>(null);
  const [clockTo, setClockTo] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => { if (clockFrom == null && phase === 'who' && !hookOn) setClockFrom(Date.now()); }, [phase, hookOn, clockFrom]);
  useEffect(() => { if (phase === 'sent' && clockTo == null) setClockTo(Date.now()); }, [phase, clockTo]);
  useEffect(() => {
    if (clockFrom == null || clockTo != null) return;
    const t = window.setInterval(() => setClockNow(Date.now()), 200);
    return () => window.clearInterval(t);
  }, [clockFrom, clockTo]);
  const clockMs = clockFrom == null ? 0 : (clockTo ?? clockNow) - clockFrom;
  const clockText = `${Math.floor(clockMs / 60000)}:${String(Math.floor(clockMs / 1000) % 60).padStart(2, '0')}`;
  const clockWords = (() => { const t = Math.floor(clockMs / 1000); const m = Math.floor(t / 60); return m ? `${m}m ${t % 60}s` : `${t}s`; })();

  const who = name.trim() || preset.name;
  const fail = (e: any) => { const m = e?.message ?? 'That didn’t work'; setError(m); mark(`FAILED: ${m}`, 'failed'); console.error('[DEMO/photo]', e); };
  const until = async (p: Phase, timeoutMs: number) => {
    const t0 = Date.now();
    while (phaseRef.current !== p) { if (Date.now() - t0 > timeoutMs) throw new Error(`demo: still waiting for ${p}`); await sleep(150); }
  };

  // The mockup tints itself with whatever card is on screen.
  useEffect(() => {
    if (!embedded) return;
    const url = phase === 'front-result' ? frontUrl : phase === 'card' ? frontUrl : null;
    if (!url) { tellGlow(null); return; }
    let off = false;
    cardGlow(url).then((c) => { if (!off) tellGlow(c); });
    return () => { off = true; };
  }, [embedded, phase, frontUrl]);

  // ── engine steps ──
  /** A draft is created up front so the photo has somewhere to live and
   *  the run fails loudly here rather than three screens later. */
  const ensureDraft = async (): Promise<number> => {
    if (draftRef.current) return draftRef.current;
    const j = await api('POST', '/api/studio/drafts', { recipientName: preset.name, occasion: preset.occasion });
    setDraftId(j.id); draftRef.current = j.id;
    mark(`draft ${j.id}`);
    return j.id;
  };

  /** The photo, uploaded the way the maker uploads it: prepared on the
   *  device first (oriented, no edge over 1600px, JPEG), so a big phone
   *  photo never reaches the model raw. */
  const uploadPhoto = async (dataUrl: string): Promise<number> => {
    const j = await api('POST', '/api/photos/upload', { imageBase64: dataUrl, filename: `demo-${preset.name}.jpg`, label: preset.name }, 90_000);
    const id = Number(j?.id);
    if (!Number.isFinite(id)) throw new Error('The photo didn’t save');
    return id;
  };

  const usePhoto = async (dataUrl: string) => {
    setPhotoData(dataUrl);
    setPhase('checking'); mark('photo: checking', 'checking');
    const id = await ensureDraft();
    const photoId = await uploadPhoto(dataUrl);
    await api('PATCH', `/api/studio/drafts/${id}`, {
      state: {
        version: 1, step: 2,
        recipient: { name: preset.name, occasion: preset.occasion },
        photos: { mode: photoModeRef.current, photoIds: [photoId] },
      } satisfies CardDraftState,
    });
    mark(`photo: saved (${photoModeRef.current})`);
    // No scene suggestions on the demo (Aidan 2026-09-23). The point of
    // the film is that a person types one plain sentence and gets a
    // card; offering them three of ours first muddies that, and the
    // chips cost a screen's worth of reading time on a 30s cut.
    // The real verdict, the way the signed-in studio gets it: the
    // analysis lands on the photo row after the upload returns, so poll
    // the library until analyzedAt is stamped, then read the same note
    // the customer reads. Fails open like the product's 30s gate — a
    // demo must never stall on a check that's only advisory.
    const verdict = await waitForVerdict(photoId, photoModeRef.current);
    setNote(verdict);
    mark(`photo: ${verdict ? verdict.tone : 'unchecked'}`);
    await sleep(verdict ? beats.look * 1.1 : 900);
    setPhase('scene'); mark('scene', 'scene');
  };

  const landPhoto = () => { const src = pickerPhoto; setPickerOpen(false); if (src) void usePhoto(src).catch(fail); };
  const openPicker = async () => {
    if (photoData || pickerOpen) return;
    const prepared = pickerPhoto ?? await preparePhoto(await fetch(preset.photo).then((r) => r.blob()));
    setPickerPhoto(prepared); setPickerOpen(true);
  };

  /** The front. This is the long one — a real photo-likeness render at
   *  production quality, so 30–120s is normal and the screen says so. */
  const generateFront = async () => {
    const id = await ensureDraft();
    setPhase('front-generating'); mark('front: generating', 'front-generating');
    // PATCH replaces the WHOLE state (the route is a deliberate overwrite,
    // not patch semantics), so read what's there and merge — writing a
    // fresh object here would drop the photo ids and the front would fail
    // its readiness gate.
    const current = await api('GET', `/api/studio/drafts/${id}`);
    const merged: CardDraftState = {
      ...(current.state ?? { version: 1, step: 0 }),
      version: 1, step: 4,
      recipient: { name: preset.name, occasion: preset.occasion },
      scene: { description: sceneRef.current.trim(), source: 'manual' },
      front: frontRef.current.trim() ? { mode: 'write', text: frontRef.current.trim() } : { mode: 'write' },
    };
    await api('PATCH', `/api/studio/drafts/${id}`, { state: merged });
    await api('POST', `/api/studio/drafts/${id}/generate`, { mode: 'front' });
    const d = await pollDraft(id, FRONT_DONE, 300_000, (s) => mark(`front: ${s}`));
    if (!d.frontImageUrl) throw new Error('The front came back empty');
    await warm(d.frontImageUrl);
    setFrontUrl(d.frontImageUrl);
    setPhase('front-result'); mark('front: done', 'front-result');
  };

  /** The inside, from the words on the inside screen. */
  const generateInside = async () => {
    const id = draftRef.current;
    if (!id) throw new Error('No draft');
    setPhase('inside-generating'); mark('inside: generating', 'inside-generating');
    const w = wordsRef.current;
    const current = await api('GET', `/api/studio/drafts/${id}`);
    const merged: CardDraftState = {
      ...(current.state ?? { version: 1, step: 0 }),
      version: 1, step: 5,
      inside: { mode: 'write', path: 'self', write: { salutation: w.dear.trim(), message: w.message.trim(), signoff: w.from.trim() } },
    };
    await api('PATCH', `/api/studio/drafts/${id}`, { state: merged });
    await api('POST', `/api/studio/drafts/${id}/generate-inside`, {});
    const d = await pollDraft(id, INSIDE_DONE, 300_000, (s) => mark(`inside: ${s}`));
    await warmAll([d.insideImageUrl, d.frontImageUrl ?? frontUrl]);
    if (d.frontImageUrl) setFrontUrl(d.frontImageUrl);
    setInsideUrl(d.insideImageUrl);
    setPhase('card'); mark('inside: done', 'card');
  };

  // ── the director ──
  const direct = async () => {
    const b = beats; const p = preset;
    mark('who: open', 'who');
    if (hook) { await typeHook(hookLine, [p.name]); setHookOn(false); mark('hook: done'); }
    await sleep(320);

    // Who it's for.
    await typeInto(await findDemo('name') as HTMLInputElement, p.name, b.settle, b.type);
    await typeInto(await findDemo('occasion') as HTMLInputElement, p.occasion, b.settle, b.type);
    await tap(await findDemo('who-next'), b.settle, b.hold * 0.7); mark(`who: ${p.name}, ${p.occasion}`);

    // Who's on the card. Only tap the tile when it isn't the default
    // already — a tap that changes nothing looks like a mis-click.
    await until('mode', 10_000); await sleep(b.look * 0.6);
    if (p.photoMode !== 'one_person') await tap(await findDemo(`mode-${p.photoMode}`), b.settle, b.hold * 0.8);
    await tap(await findDemo('mode-next'), b.settle, b.hold * 0.6); mark(`mode: ${p.photoMode}`);

    // Their photo.
    await until('photo', 10_000); await sleep(b.look * 0.5);
    setPickerPhoto(await preparePhoto(await fetch(p.photo).then((r) => r.blob())));
    await tap(await findDemo('add-photo'), b.settle, 300);
    const mine = await findDemo('picker-photo', 8000); await sleep(900);
    await tap(mine, b.settle * 0.8, 200);
    mark('photo: added');

    // The scene.
    await until('scene', 180_000); await sleep(b.look * 0.8);
    await typeInto(await findDemo('scene') as HTMLTextAreaElement, p.scene, b.settle, b.type);
    await tap(await findDemo('scene-next'), b.settle, b.hold * 0.7); mark('scene: set');

    // What the front says.
    await until('front', 10_000); await sleep(b.look * 0.6);
    if (p.front.trim()) await typeInto(await findDemo('front-text') as HTMLInputElement, p.front, b.settle, b.type);
    await tap(await findDemo('draw-front'), b.settle, 300); mark('front: asked');

    // The long wait, then the reveal.
    await until('front-result', 300_000); await sleep(b.look * 1.4);
    await tap(await findDemo('to-inside'), b.settle, b.hold * 0.7); mark('front: kept');

    // The inside.
    await until('inside', 10_000);
    await typeInto(await findDemo('dear') as HTMLInputElement, p.dear, b.settle, b.type);
    await typeInto(await findDemo('message') as HTMLTextAreaElement, p.message, b.settle, b.type);
    await typeInto(await findDemo('from') as HTMLInputElement, p.from, b.settle, b.type);
    await tap(await findDemo('design-inside'), b.settle, 300); mark('inside: asked');

    // The card.
    await until('card', 300_000); await sleep(b.look * 0.7);
    const card = await findDemo('card');
    const r = card.getBoundingClientRect(); ring(r.left + r.width / 2, r.top + r.height / 2); await sleep(120);
    setCardOpen(true); mark('card: open'); await sleep(b.look * 1.6);
    await tap(await findDemo('post'), b.settle, 300);
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
    const tick = window.setInterval(() => { n -= 1; setCount(n); if (n <= 0) { window.clearInterval(tick); setPhase('who'); } }, 1000);
    if (cfg.mode === 'manual') {
      const onDown = (e: PointerEvent) => ring(e.clientX, e.clientY);
      const onClick = () => { tellTap(); window.setTimeout(clearRings, 140); };
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('click', onClick, true);
      const t = window.setTimeout(() => {
        if (!cfg.hook) return;
        void typeHook(hookLine, [preset.name]).then(() => setHookOn(false));
      }, cfg.countdown * 1000 + (cfg.countdown > 0 ? 1600 : 900));
      return () => { window.clearTimeout(t); window.clearInterval(tick); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('click', onClick, true); };
    }
    const t = window.setTimeout(() => { direct().catch(fail); }, cfg.countdown * 1000 + (cfg.countdown > 0 ? 1600 : 900));
    return () => { window.clearTimeout(t); window.clearInterval(tick); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { clearRings(); }, [phase]);

  const waitLine =
    phase === 'front-generating' ? `Drawing ${who} into the scene`
    : phase === 'inside-generating' ? 'Writing the inside'
    // The live step's own words while the likeness check settles.
    : 'Analysing your photo…';
  const waitSub = phase === 'checking'
    ? 'A few seconds — we’re checking it’ll give a strong likeness.'
    : null;

  return (
    <div ref={rootRef} className={`keeper-serif demo-zoomer fixed inset-x-0 overflow-hidden ${embedded ? 'bottom-[22px] top-[50px]' : 'inset-y-0'}`}>
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      {hook && <div className="demo-hook" aria-hidden="true"><p><span className="caret" /></p></div>}
      <div className="absolute left-5 top-5 z-10"><img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" /></div>
      {showClock && clockFrom != null && (
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

      {/* NO mode="wait" here, deliberately. With it, a screen that was
          mid-exit could stall and never finish, so AnimatePresence never
          mounted the next one and the run sat on a blank screen until the
          director timed out (2026-09-22: every run that opened with a
          typed hook died on "never found add-photo"). Every screen is
          absolute inset-0, so letting them overlap just cross-fades —
          which cuts better on video than a hard wait anyway. */}
      <AnimatePresence>
        {/* 0 · time to hit record */}
        {phase === 'countdown' && (
          <motion.section key="countdown" {...SCREEN} className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="font-display text-[88px] font-bold leading-none text-keeper-ink">{count}</p>
            <p className="text-[14px] text-keeper-meta">Start your screen recording</p>
          </motion.section>
        )}

        {/* 1 · who is it for */}
        {phase === 'who' && (
          <motion.section key="who" {...SCREEN} className={`absolute inset-0 flex flex-col justify-center px-5 ${showClock ? 'pt-[18vh]' : ''}`}>
            {/* Plain CSS, not a nested motion child: an animating child
                inside a screen that AnimatePresence is waiting to unmount
                can stall the exit, and the run then sits on a blank
                screen forever (caught 2026-09-22 — the photo screen
                never mounted when the run opened with a typed hook). */}
            <div className="rounded-2xl border border-keeper-hair bg-white/85 p-5 transition-all duration-[450ms] ease-out"
              style={{ opacity: hookOn ? 0 : 1, transform: hookOn ? 'translateY(12px)' : 'none' }}>
              <h1 className={H1}>Who’s it for?</h1>
              <div className="mt-4 flex flex-col gap-3">
                <input data-demo="name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Their first name"
                  className="h-12 rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink focus:outline-none" />
                <input data-demo="occasion" value={occasion} onChange={(e) => setOccasion(e.target.value)} aria-label="The occasion"
                  className="h-12 rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink focus:outline-none" />
              </div>
              <button type="button" data-demo="who-next" className={`${PRIMARY} demo-pulse mt-5 w-full`}
                onClick={() => { setPhase('mode'); mark('mode', 'mode'); }}>Next</button>
            </div>
          </motion.section>
        )}

        {/* 2 · who's on the card — the live step's first question, in the
            demo's one-thing-per-screen shape. Same two options, same
            explainers, same default. It decides which front_scene prompt
            variant the generator resolves, so it is a real fork, not a
            label (Aidan 2026-09-23: "mainly look at single person or
            group photo uploads"). */}
        {phase === 'mode' && (
          <motion.section key="mode" {...SCREEN} className={`absolute inset-0 flex flex-col justify-center px-5 ${showClock ? 'pt-[18vh]' : ''}`}>
            <h1 className={H1}>Who&rsquo;s on the card?</h1>
            <p className="mt-2 text-[15px] text-keeper-body">
              We&rsquo;ll use this to put {who} in the card &mdash; a clear photo of their face works best.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {([
                { key: 'one_person' as const, icon: User, label: `Just ${who}`, sub: 'Multi-angle likeness' },
                { key: 'group' as const, icon: Users, label: `${who} + others`, sub: 'One photo, several faces' },
              ]).map(({ key, icon: Icon, label: lab, sub }) => {
                const on = photoMode === key;
                return (
                  <button key={key} type="button" data-demo={`mode-${key}`} aria-pressed={on}
                    onClick={() => setPhotoMode(key)}
                    className={`relative flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left transition-colors ${on ? 'border-brand bg-brand-muted' : 'border-keeper-hair bg-white/85'}`}>
                    {on && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-cta text-cta-foreground"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                    <Icon className={`h-6 w-6 ${on ? 'text-brand-dark' : 'text-keeper-meta'}`} strokeWidth={1.6} />
                    <span className="text-[15px] font-semibold leading-tight text-keeper-ink">{lab}</span>
                    <span className="text-[12.5px] leading-snug text-keeper-meta">{sub}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" data-demo="mode-next" className={`${PRIMARY} demo-pulse mt-5 w-full`}
              onClick={() => { setPhase('photo'); mark(`photo (${photoMode})`, 'photo'); }}>Next</button>
          </motion.section>
        )}

        {/* 3 · their photo */}
        {phase === 'photo' && (
          <motion.section key="photo" {...SCREEN} className={`absolute inset-0 flex flex-col justify-center px-5 pb-12 text-center ${showClock ? 'pt-[20vh]' : 'pt-16'}`}>
            <h1 className={H1}>{photoMode === 'group' ? 'One photo with everyone in it.' : `A photo of ${who}.`}</h1>
            <p className="mt-2 text-[15px] text-keeper-body">
              {photoMode === 'group' ? 'Faces clearly visible. We take it from there.' : 'Any everyday photo. We take it from there.'}
            </p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void preparePhoto(f).then((d) => usePhoto(d)).catch(fail); e.target.value = ''; }} />
            <button type="button" data-demo="add-photo" onClick={() => { void openPicker(); }}
              className="mt-6 flex aspect-[4/5] w-[min(70vw,40vh,260px)] shrink-0 items-center justify-center self-center overflow-hidden rounded-2xl border-2 border-dashed border-keeper-hair bg-white/70">
              <span className="flex flex-col items-center gap-2 text-keeper-meta"><Camera className="h-7 w-7" strokeWidth={1.5} /><span className="text-[14px] font-medium">Add a photo</span></span>
            </button>
          </motion.section>
        )}

        {/* 3 · the waits — one screen, three jobs */}
        {(phase === 'checking' || phase === 'front-generating' || phase === 'inside-generating') && (
          <motion.section key="wait" {...SCREEN} className="absolute inset-0 flex flex-col items-center justify-center gap-7 px-5">
            {/* Their photo stays on screen through the long front render, so
                the wait is watching THEIR face become a card, not a spinner
                on a blank page. */}
            {phase === 'front-generating' && photoData && (
              <motion.img src={photoData} alt="" aria-hidden="true"
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
                className="h-[26vh] w-auto rounded-2xl border-[5px] border-white object-cover shadow-[0_18px_40px_-16px_rgba(33,29,25,.45)]" />
            )}
            {/* On the checking beat, the traffic light replaces the
                spinner the moment it lands — it is the real note off the
                photo row, the same words the customer gets. */}
            {phase === 'checking' && note ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}
                /* The live step's own colours (emerald / amber / red,
                   stock Tailwind — NOT the retired accent-amber brand
                   token), so the film shows the traffic light a customer
                   actually sees. */
                className={`flex max-w-[330px] flex-col items-center gap-2 rounded-2xl border px-5 py-4 text-center ${
                  note.tone === 'good' ? 'border-emerald-300 bg-emerald-50'
                  : note.tone === 'warn' ? 'border-amber-400 bg-amber-50'
                  : 'border-red-400 bg-red-50'}`}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${note.tone === 'good' ? 'bg-emerald-600 text-white' : note.tone === 'warn' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}`}>
                  {note.tone === 'good' ? <Check className="h-5 w-5" strokeWidth={3} /> : <AlertTriangle className="h-5 w-5" strokeWidth={2.5} />}
                </span>
                <span className="text-[16px] font-semibold leading-snug text-keeper-ink">{note.headline}</span>
                <span className="text-[13.5px] leading-snug text-keeper-body">{note.detail}</span>
              </motion.div>
            ) : (
              <>
                <Loader2 className="h-7 w-7 animate-spin text-brand" strokeWidth={2.5} aria-hidden="true" />
                <p className="-mt-3 max-w-[320px] text-center text-[18px] font-medium leading-snug text-keeper-ink">{waitLine}</p>
                {waitSub && <p className="-mt-4 max-w-[300px] text-center text-[13.5px] leading-snug text-keeper-body">{waitSub}</p>}
              </>
            )}
          </motion.section>
        )}

        {/* 4 · describe the scene */}
        {phase === 'scene' && (
          <motion.section key="scene" {...SCREEN} className={`absolute inset-0 flex flex-col justify-center px-5 ${showClock ? 'pt-[18vh]' : ''}`}>
            <h1 className={H1}>Where should {who} be?</h1>
            <p className="mt-2 text-[15px] text-keeper-body">Describe anywhere. We’ll put them in it.</p>
            <textarea data-demo="scene" value={scene} onChange={(e) => setScene(e.target.value)} aria-label="Describe the scene" rows={4}
              className="demo-glow-field mt-4 rounded-2xl border border-keeper-hair bg-white/95 px-4 py-3 text-[16px] leading-relaxed text-keeper-ink focus:outline-none" />
            <button type="button" data-demo="scene-next" className={`${PRIMARY} demo-pulse mt-5 w-full`}
              onClick={() => { setPhase('front'); mark('front', 'front'); }}>Next</button>
          </motion.section>
        )}

        {/* 5 · what the front says */}
        {phase === 'front' && (
          <motion.section key="front" {...SCREEN} className={`absolute inset-0 flex flex-col justify-center px-5 ${showClock ? 'pt-[18vh]' : ''}`}>
            <h1 className={H1}>What should the front say?</h1>
            <p className="mt-2 text-[15px] text-keeper-body">Leave it to us, or write your own.</p>
            <input data-demo="front-text" value={frontText} onChange={(e) => setFrontText(e.target.value)} aria-label="Front of the card"
              placeholder={`Happy ${preset.occasion}, ${who}`}
              className="mt-4 h-12 rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none" />
            <button type="button" data-demo="draw-front" className={`${PRIMARY} demo-pulse mt-5 w-full`}
              onClick={() => { generateFront().catch(fail); }}><Sparkles className="h-4 w-4 text-cta" /> Draw the front</button>
          </motion.section>
        )}

        {/* 6 · there they are */}
        {phase === 'front-result' && frontUrl && (
          <motion.section key="front-result" {...SCREEN} className="absolute inset-0 flex flex-col justify-center px-5 py-16 text-center">
            <button type="button" data-demo="to-inside" aria-label="Use this card"
              onClick={() => { setDear(''); setMessage(''); setFrom(''); setPhase('inside'); mark('inside', 'inside'); }}
              className="mt-8 mb-3 w-[min(76vw,44vh,340px)] shrink-0 self-center transition-transform active:scale-[0.98]">
              <AjarTile imageUrl={frontUrl} alt="" eager openDeg={22} />
            </button>
          </motion.section>
        )}

        {/* 7 · the inside */}
        {phase === 'inside' && (
          <motion.section key="inside" {...SCREEN} className="absolute inset-0 flex flex-col justify-center overflow-y-auto px-5 py-16 text-center">
            <h1 className={H1}>Now the inside.</h1>
            <div className="mt-5 flex flex-col gap-3">
              <input data-demo="dear" style={{ textAlign: 'left' }} value={dear} onChange={(e) => setDear(e.target.value)} aria-label="Dear" placeholder={`Dear ${who},`}
                className="h-12 rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none" />
              <textarea data-demo="message" style={{ textAlign: 'left' }} value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Your message" rows={5}
                className="demo-glow-field rounded-2xl border border-keeper-hair bg-white/95 px-4 py-3 text-[16px] leading-relaxed text-keeper-ink focus:outline-none" />
              <input data-demo="from" style={{ textAlign: 'left' }} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" placeholder="Love, …"
                className="h-12 rounded-full border border-keeper-hair bg-white/90 px-4 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none" />
            </div>
            <div className="mt-6 flex flex-col items-center">
              <button type="button" data-demo="design-inside" className={`${PRIMARY} demo-pulse w-full`}
                onClick={() => { generateInside().catch(fail); }}><Sparkles className="h-4 w-4 text-cta" /> Design the inside</button>
            </div>
          </motion.section>
        )}

        {/* 8 · the card, in real 3D */}
        {phase === 'card' && frontUrl && (
          <motion.section key="card" initial={{ opacity: 0, y: 16 }} animate={cardPainted ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }} exit={SCREEN.exit} transition={SCREEN.transition}
            className={`absolute inset-0 flex flex-col justify-center ${showClock ? 'pt-[14vh]' : ''}`}>
            <div data-demo="card" className="relative h-[min(56vh,104vw)] w-full shrink-0">
              <Card3DViewer frontImageUrl={frontUrl} insideImageUrl={insideUrl} open={cardOpen} onOpenChange={setCardOpen}
                onFirstFrame={() => setCardPainted(true)} enableRotate enableZoom={false}
                closedAngle={-0.38} restYaw={-0.12} framingMargin={1.35} minDistance={1.3} maxDistance={8} className="h-full w-full" />
            </div>
            <div className="mt-4 shrink-0 px-5">
              <button type="button" data-demo="post" className={`${PRIMARY} demo-pulse w-full`}
                onClick={() => { setPhase('sent'); mark('posted', 'sent'); }}><Send className="h-4 w-4 text-cta" /> Post it to them</button>
            </div>
          </motion.section>
        )}

        {/* 9 · posted */}
        {phase === 'sent' && (
          <motion.section key="sent" {...SCREEN} className="absolute inset-0 overflow-hidden">
            {frontUrl && <PostFlight src={frontUrl} />}
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
