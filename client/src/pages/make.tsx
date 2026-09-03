// client/src/pages/make.tsx — /make, DOOR ONE'S BUILDER
//
// The research flow, rebuilt in the studio's own clothes: same shell,
// same panel, same inputs, same buttons, same stepper rail (see the
// studio recipe). Brief → wait → three cards → pick → cameo (after the
// pick, the proven timing) → inside → done. No account to generate;
// sign in to keep, buy lands with Phase C. Engine calls go through
// /api/make/* behind the guest gate.
//
// Studio rules held: dashboard stepper, never one-question-per-screen;
// name-weave from step 2; violet = selection/links/primary, green =
// commit moments only (Write their three cards, Design the inside);
// titles always ink; lucide at 1.75.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2, ArrowLeft, Check, Camera, Sparkles, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CropDialog } from '@/components/studio/crop-dialog';
import { BriefQuestions, readBriefFromSearch, isBriefComplete, occasionLabelFor, ageOf, isKidBrief, VIBE_LABEL, type Brief, type Vibe } from '@/components/brief-questions';
import { rackTokenKey } from '@/pages/buy';
import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP } from '@shared/pricing';
import type { CropBounds } from '@shared/models/photos';
import celebraitLogo from '@/assets/celebrait.webp';

/** The studio's header shape for a public surface: logo, occasions, sign in. */
function PublicHeader() {
  return (
    <header className="relative z-40 h-16 bg-white/70 backdrop-blur-md border-b border-keeper-hair flex items-center px-4 sm:px-6 gap-3">
      <Link href="/door" className="flex items-center" aria-label="Celebrait home"><img src={celebraitLogo} alt="Celebrait" className="h-6 w-auto" /></Link>
      <nav className="ml-auto flex items-center gap-5">
        <Link href="/cards/christmas" className="hidden sm:inline text-sm text-keeper-body hover:text-keeper-ink">Christmas</Link>
        <Link href="/cards/birthday" className="hidden sm:inline text-sm text-keeper-body hover:text-keeper-ink">Birthdays</Link>
        <Link href="/studio" className="text-sm font-medium text-keeper-ink hover:text-brand-dark">Sign in</Link>
      </nav>
    </header>
  );
}

// ── plumbing ─────────────────────────────────────────────────────────
async function makePost(path: string, body: unknown): Promise<any> {
  const r = await fetch(`/api/make/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) {
    const j = await r.json().catch(() => null);
    const err = new Error(j?.message ?? 'That didn’t work — give it another go') as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return r.json();
}
const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

// The questions live in components/brief-questions.tsx (shared with the
// doorway hero, where they run one at a time under the headline). The
// brief arrives here in the URL; `go=1` means it's finished — straight
// into the wait.

interface Concept { angle: string; format?: string; front_text: string; inside_text?: string; art_direction: string; palette?: string; typeface?: string; direction?: string; tone?: string }
interface CardCell { concept: Concept; imageUrl?: string; error?: string; retrying?: boolean }
type Phase = 'brief' | 'generating' | 'results' | 'cameo' | 'signoff' | 'done' | 'failed' | 'capped';

// ── the studio's classes, verbatim ───────────────────────────────────
const panel = 'bg-white border border-keeper-hair rounded-2xl p-6 sm:p-10 min-h-[380px]';
const h1 = 'text-xl sm:text-2xl font-display font-bold tracking-[-0.015em] text-keeper-ink';
const label = 'text-sm font-medium text-keeper-ink';
const optional = <span className="ml-1 text-xs text-keeper-meta font-normal">optional</span>;
const helper = 'mt-1.5 text-[11px] text-keeper-meta';
const input = 'text-base border-brand-light focus-visible:border-brand focus-visible:ring-brand/20';
const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${on ? 'bg-brand text-brand-foreground' : 'bg-stone-100 text-keeper-body hover:bg-stone-200'}`;
const tile = (on: boolean) => `relative flex items-center gap-3 text-left p-3 rounded-xl border-2 transition-all ${on ? 'border-brand bg-brand-muted shadow-sm' : 'border-keeper-hair hover:border-brand hover:bg-brand-muted/40 bg-white'}`;
const tileIcon = (on: boolean) => `flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${on ? 'bg-brand text-brand-foreground' : 'bg-keeper-gold-wash text-keeper-gold'}`;
const commit = 'inline-flex items-center justify-center gap-2 bg-cta hover:bg-cta-hover text-cta-foreground rounded-full px-5 py-2.5 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none';
const primary = 'inline-flex items-center justify-center gap-2 bg-go hover:bg-go-hover text-white rounded-full px-5 py-2.5 text-sm font-semibold transition-colors shadow-sm';
const textLink = 'text-sm text-brand hover:text-brand-dark underline underline-offset-4';
const cardTile = 'block bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-all text-left';

const STEPS = ["Who it's for", 'Three cards', 'The inside', 'Done'];
function Rail({ at }: { at: number }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 w-full mb-6 sm:mb-8" role="tablist" aria-label="Steps">
      {STEPS.map((s, i) => {
        const cur = i === at, done = i < at;
        return (
          <div key={s} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
            <span className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs font-semibold shrink-0 transition-colors shadow-sm ${cur ? 'bg-brand text-brand-foreground ring-2 ring-brand-light' : done ? 'bg-cta text-cta-foreground' : 'bg-stone-100 text-keeper-meta shadow-none'}`}>
              {done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className={`hidden md:inline text-xs sm:text-sm truncate transition-colors ${cur ? 'text-keeper-ink font-semibold' : done ? 'text-cta-hover' : 'text-keeper-meta'}`}>{s}</span>
            {i < STEPS.length - 1 && <span className={`flex-1 h-px rounded-full transition-colors ${done ? 'bg-cta' : 'bg-keeper-hair'}`} />}
          </div>
        );
      })}
    </div>
  );
}

function MakeShell({ step, children }: { step: number; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-keeper-paper">
      <PublicHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto">
          <Rail at={step} />
          {children}
        </div>
      </main>
    </div>
  );
}

export default function MakePage() {
  useSeo('/make');
  useEffect(() => { const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m); return () => { m.remove(); }; }, []);
  const [, navigate] = useLocation();
  const [brief, setBrief] = useState<Brief>(() => readBriefFromSearch(typeof window !== 'undefined' ? window.location.search : ''));
  // The doorway finishes the questions and hands over with go=1: no
  // re-asking, straight into the wait.
  const autoGo = useRef(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('go') === '1' && isBriefComplete(brief));
  const [phase, setPhase] = useState<Phase>(autoGo.current ? 'generating' : 'brief');
  const [failMsg, setFailMsg] = useState('');
  useEffect(() => { if (autoGo.current) { autoGo.current = false; void generate(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ageNum = ageOf(brief);
  const isKid = isKidBrief(brief);
  const occasionLabel = occasionLabelFor(brief);
  const whoName = brief.name.trim() || brief.who.trim();

  // ── Phase C: keep and buy ──────────────────────────────────────────
  // Nothing is written until the card is finished and wanted. Saving
  // mints a `cards` row (source 'maker') and a token that proves a
  // guest owns it — the rack's pattern, so /buy needs nothing new.
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const [saved, setSaved] = useState<{ cardId: number; cardToken: string } | null>(null);
  const [saving, setSaving] = useState<'' | 'buy' | 'keep'>('');
  const [saveError, setSaveError] = useState('');
  const savedRef = useRef<{ cardId: number; cardToken: string } | null>(null);
  const saveCard = async (front: string, inside: string | null, c: Concept, mode: 'ours' | 'own', msg: string) => {
    if (savedRef.current) return savedRef.current;
    const j = await makePost('cards', {
      frontImageUrl: front, insideImageUrl: inside, cameo: cameoKept && !!cameoUrl, insideMode: mode,
      brief: { who: brief.who.trim(), gender: brief.gender, age: ageNum, interest: brief.thing.trim() || undefined, dislike: brief.cant.trim() || undefined, recipientName: brief.name.trim() || undefined, tone: brief.vibe, occasion: occasionLabel },
      concept: { front_text: c.front_text, inside_text: c.inside_text, art_direction: c.art_direction, palette: c.palette, typeface: c.typeface, direction: c.direction },
      message: msg || undefined,
    });
    const s = { cardId: j.cardId as number, cardToken: j.cardToken as string };
    try { sessionStorage.setItem(rackTokenKey(s.cardId), s.cardToken); } catch { /* private mode: buy still works this session */ }
    savedRef.current = s; setSaved(s);
    return s;
  };
  // "Keep it": sign in, come back here with ?claim=<id>, adopt the card
  // by its token, then on to the studio. (The token can't ride the
  // session — OTP verify regenerates it — so it lives in the browser.)
  useEffect(() => {
    const claim = new URLSearchParams(window.location.search).get('claim');
    if (!claim || authLoading) return;
    if (!isAuthenticated) { openAuth(`/make?claim=${claim}`); return; }
    const token = (() => { try { return sessionStorage.getItem(rackTokenKey(claim)) ?? ''; } catch { return ''; } })();
    fetch(`/api/make/cards/${claim}/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardToken: token }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(() => navigate(`/studio/card/${claim}`))
      .catch(() => navigate('/studio'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);
  const forWho = whoName ? `${whoName}'s` : 'the';

  const [cells, setCells] = useState<CardCell[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [cameoSrc, setCameoSrc] = useState<string | null>(null);
  const [cameoUrl, setCameoUrl] = useState<string | null>(null);
  const [cameoBusy, setCameoBusy] = useState(false);
  const [cameoKept, setCameoKept] = useState(false);
  const [cameoError, setCameoError] = useState('');
  const [insideMode, setInsideMode] = useState<'ours' | 'own'>('ours');
  const [dear, setDear] = useState(''); const [message, setMessage] = useState(''); const [from, setFrom] = useState('');
  const [insideUrl, setInsideUrl] = useState<string | null>(null);
  const [insideBusy, setInsideBusy] = useState(false);

  // ── the wait: narration + asymptotic progress (the studio's pattern) ──
  const lines = useMemo(() => [
    brief.thing ? `Reading up on ${brief.thing}` : 'Reading the brief',
    brief.who ? `Working out what ${brief.who} would actually pick up` : 'Working out what they would actually pick up',
    'Choosing colours from their world', 'Writing three very different cards', 'Drawing the fronts',
  ], [brief.thing, brief.who]);
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const t0 = useRef(0);
  useEffect(() => {
    if (phase !== 'generating') return;
    setStage(0); setProgress(0); t0.current = Date.now();
    const s = setInterval(() => setStage((n) => Math.min(n + 1, lines.length - 1)), 9000);
    const p = setInterval(() => { const t = (Date.now() - t0.current) / 1000; setProgress(0.92 * (1 - Math.exp(-t / 35))); }, 500);
    return () => { clearInterval(s); clearInterval(p); };
  }, [phase, lines.length]);

  // ── generation ──
  const generate = async (tone: Vibe = brief.vibe) => {
    setPhase('generating'); setCells([]); setPicked(null); setInsideUrl(null);
    setCameoUrl(null); setCameoKept(false); setCameoError(''); setFailMsg('');
    try {
      const j = await makePost('concepts', {
        occasion: occasionLabel, who: brief.who.trim() || 'Anyone', gender: brief.gender ?? undefined, tone: isKid && tone === 'rude' ? 'funny' : tone,
        pipeline: 'celebrait', characters: 'objects', insideMode: 'auto', freeStyle: true, age: ageNum,
        interest: brief.thing.trim() || undefined, dislikes: brief.cant.trim() || undefined, recipientName: brief.name.trim() || undefined, memory: true,
      });
      const concepts: Concept[] = j.concepts ?? [];
      if (!concepts.length) throw new Error('Nothing came back — try again');
      setCells(concepts.map((c) => ({ concept: c })));
      setPhase('results');
      await Promise.all(concepts.map((c, i) => renderCell(i, c)));
    } catch (e: any) {
      if (e?.status === 429 || e?.status === 503) { setFailMsg(e.message); setPhase('capped'); }
      else { setFailMsg(e?.message ?? 'That didn’t work'); setPhase('failed'); }
    }
  };
  const renderCell = async (i: number, c: Concept) => {
    try {
      const rj = await makePost('render', { front_text: c.front_text, art_direction: c.art_direction, palette: c.palette, typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true });
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, imageUrl: rj.imageUrl, error: undefined } : x)));
    } catch { setCells((prev) => prev.map((x, j) => (j === i ? { ...x, error: 'That one didn’t come out.' } : x))); }
  };
  const tryAgain = async (i: number) => {
    const cell = cells[i]; if (!cell || cell.retrying) return;
    setCells((prev) => prev.map((x, j) => (j === i ? { ...x, retrying: true, error: undefined } : x)));
    try {
      const fix = await makePost('ip-safe-art', { front_text: cell.concept.front_text, art_direction: cell.concept.art_direction, interest: brief.thing || undefined });
      const concept = { ...cell.concept, art_direction: fix.art_direction };
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, concept } : x)));
      await renderCell(i, concept);
    } catch { setCells((prev) => prev.map((x, j) => (j === i ? { ...x, error: 'Still no luck — pick another, or re-deal.' } : x))); }
    finally { setCells((prev) => prev.map((x, j) => (j === i ? { ...x, retrying: false } : x))); }
  };

  // ── the cameo ──
  const readCameoFile = async (file: File): Promise<string> => {
    const asDataUrl = () => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read failed')); r.readAsDataURL(file); });
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      if (scale === 1 && file.size <= 1_500_000) { bmp.close(); return await asDataUrl(); }
      const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
      cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close();
      return cv.toDataURL('image/jpeg', 0.9);
    } catch { return await asDataUrl(); }
  };
  const cropToDataUrl = (src: string, b: CropBounds) => new Promise<string>((res, rej) => {
    const img = new Image();
    img.onload = () => { const cv = document.createElement('canvas'); cv.width = b.width; cv.height = b.height; cv.getContext('2d')!.drawImage(img, b.x, b.y, b.width, b.height, 0, 0, b.width, b.height); res(cv.toDataURL('image/jpeg', 0.9)); };
    img.onerror = () => rej(new Error('decode failed')); img.src = src;
  });
  const renderCameo = async (photo: string) => {
    if (picked === null) return;
    const c = cells[picked].concept; setCameoBusy(true); setCameoError('');
    try {
      const rj = await makePost('render', { front_text: c.front_text, art_direction: c.art_direction, palette: c.palette, typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true, cameoPhoto: photo });
      setCameoUrl(rj.imageUrl);
    } catch (e: any) { setCameoError(e?.message ?? 'That didn’t work — try another photo, or carry on without.'); }
    finally { setCameoBusy(false); }
  };

  const renderInside = async () => {
    if (picked === null) return;
    const c = cells[picked].concept; setInsideBusy(true); setFailMsg('');
    try {
      const core = insideMode === 'ours' ? (c.inside_text ?? '') : message.trim();
      const joined = [dear.trim(), core, from.trim()].filter(Boolean).join('\n\n');
      const body = joined ? { mode: 'own', message: joined } : { mode: 'blank' };
      const ir = await makePost('render-inside', { ...body, palette: c.palette, typeface: c.typeface, art_direction: c.art_direction, characters: 'objects', freeStyle: true, direction: c.direction });
      setInsideUrl(ir.imageUrl); setPhase('done');
    } catch (e: any) { setFailMsg(e?.message ?? 'The inside didn’t render — try again'); }
    finally { setInsideBusy(false); }
  };

  const chosenFront = picked !== null ? (cameoKept && cameoUrl ? cameoUrl : cells[picked]?.imageUrl) : undefined;
  const step = phase === 'brief' ? 0 : phase === 'generating' || phase === 'results' ? 1 : phase === 'cameo' || phase === 'signoff' ? 2 : 3;

  // ── step 1: the questions — one at a time (shared with the doorway) ──
  if (phase === 'brief') {
    return (
      <MakeShell step={step}>
        <div className={panel}>
          <BriefQuestions skin="studio" brief={brief} onChange={setBrief} onDone={() => void generate()} initialStep={brief.who.trim() ? 1 : 0} />
        </div>
      </MakeShell>
    );
  }

  if (phase === 'failed' || phase === 'capped') {
    return (
      <MakeShell step={step}>
        <div className={panel}>
          <div className="text-center py-10 px-4">
            <div className="w-14 h-14 rounded-full bg-brand-muted text-brand-dark flex items-center justify-center mx-auto mb-4"><Sparkles className="w-6 h-6" strokeWidth={1.75} /></div>
            <h1 className="text-base font-semibold text-keeper-ink mb-1">{phase === 'capped' ? 'We’ve made a lot of cards today.' : 'That one didn’t come out.'}</h1>
            <p className="text-sm text-keeper-body mb-6 max-w-sm mx-auto">{failMsg}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {phase === 'failed' && <button type="button" onClick={() => void generate()} className={primary}>Try again</button>}
              {phase === 'capped' && <Link href="/studio" className={primary}>Sign in to keep going</Link>}
              <button type="button" onClick={() => setPhase('brief')} className="inline-flex items-center gap-2 rounded-full border border-keeper-hair bg-white/70 text-keeper-ink hover:bg-keeper-gold-wash px-5 py-2.5 text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Change the details</button>
              <Link href={`/cards/${brief.occasion}`} className={`${textLink} self-center`}>Or take one off the shelf</Link>
            </div>
          </div>
        </div>
      </MakeShell>
    );
  }

  // ── step 2a: the wait ─────────────────────────────────────────────
  if (phase === 'generating') {
    return (
      <MakeShell step={step}>
        <div className={`${panel} flex flex-col items-center justify-center text-center`} aria-live="polite">
          <p className="max-w-[420px] text-[13px] leading-relaxed text-keeper-meta">This usually takes <span className="font-medium text-keeper-ink">about a minute</span> — three cards, written and drawn for {whoName || 'them'}. The words land first; the pictures follow.</p>
          <div className="relative w-32 sm:w-36 aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-brand-muted via-brand-muted/70 to-brand-muted/90 shadow-[0_8px_30px_-8px_rgba(124,58,237,0.35)] ring-1 ring-brand/15 mt-8">
            <div className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
          <div className="w-full max-w-[320px] flex flex-col items-center gap-2.5 mt-8">
            <div className="h-1 w-full rounded-full bg-stone-200/80 overflow-hidden"><div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" /><span className="text-[11px] font-medium tracking-wide text-keeper-meta whitespace-nowrap">{lines[stage]}</span></div>
          </div>
        </div>
      </MakeShell>
    );
  }

  // ── step 2b: three cards, pick the one ────────────────────────────
  if (phase === 'results') {
    const allSettled = cells.every((c) => c.imageUrl || c.error);
    return (
      <MakeShell step={step}>
        <div className={panel}>
          <h1 className={`${h1} mb-1`}>Three cards for {whoName || 'them'}. Pick the one.</h1>
          <p className="text-sm text-keeper-body">{allSettled ? 'Tap your favourite — next we design its inside, with your words in it.' : 'The words are ready; the fronts are landing…'}</p>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {(Object.keys(VIBE_LABEL) as Vibe[]).map((v) => {
              const off = v === 'rude' && isKid;
              return <button key={v} type="button" disabled={off || !allSettled} title={off ? 'Cheeky is off for under-18s' : 'Same details, three new cards'} onClick={() => { setBrief({ ...brief, vibe: v }); void generate(v); }} className={`${chip(brief.vibe === v)} disabled:opacity-40`}>{VIBE_LABEL[v]}</button>;
            })}
            <span className="text-[11px] text-keeper-meta ml-1">switching re-deals the three</span>
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {cells.map((c, i) => (
              <button key={i} type="button" disabled={!c.imageUrl}
                onClick={() => { setPicked(i); setInsideMode(c.concept.inside_text ? 'ours' : 'own'); setCameoUrl(null); setCameoKept(false); setCameoError(''); setPhase('cameo'); }}
                className={`${cardTile} group ${c.imageUrl ? 'border-keeper-hair hover:border-brand' : 'border-keeper-hair'}`}>
                <div className="aspect-square bg-stone-100 relative overflow-hidden">
                  {c.imageUrl
                    ? <img src={c.imageUrl} alt={c.concept.front_text} crossOrigin="anonymous" className="w-full h-full object-cover opacity-0 transition-opacity duration-700 group-hover:scale-[1.03] transition-transform" onLoad={(e) => e.currentTarget.classList.remove('opacity-0')} />
                    : c.error
                      ? <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-keeper-meta"><span>{c.error}</span><span role="button" onClick={(e) => { e.stopPropagation(); void tryAgain(i); }} className="inline-flex items-center gap-1.5 rounded-full border border-keeper-hair bg-white px-3 py-1.5 text-xs font-medium text-keeper-body shadow-sm hover:border-brand/60 hover:text-brand-dark">{c.retrying ? 'Having another go…' : 'Have another go'}</span></div>
                      : <div className="flex h-full flex-col items-center justify-center gap-3 bg-keeper-paper/80 p-6 text-center animate-pulse"><p className="text-sm font-medium italic leading-snug text-keeper-body">“{c.concept.front_text}”</p><span className="flex items-center gap-1.5 text-[11px] font-medium text-keeper-meta"><Loader2 className="h-3 w-3 animate-spin text-brand/70" /> drawing this one</span></div>}
                  {c.concept.tone && <span className="absolute left-2 top-2 rounded-full bg-white/90 border border-keeper-hair px-2 py-0.5 text-[11px] font-medium capitalize text-keeper-body">{c.concept.tone}</span>}
                </div>
                <div className="p-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-keeper-ink truncate">“{c.concept.front_text}”</p>
                  {c.imageUrl && <span className="text-[12.5px] font-semibold text-brand whitespace-nowrap">Choose →</span>}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-keeper-meta">
            <span>None of them quite right?</span>
            <button type="button" onClick={() => setPhase('brief')} className={textLink}>Change the details</button>
            <button type="button" disabled={!allSettled} onClick={() => void generate()} className={`${textLink} disabled:opacity-40`}>Same details, three new cards</button>
          </div>
        </div>
      </MakeShell>
    );
  }

  // ── step 3a: the cameo (after the pick) ───────────────────────────
  if (phase === 'cameo' && picked !== null) {
    const c = cells[picked];
    if (cameoUrl) {
      return (
        <MakeShell step={step}>
          <div className={panel}>
            <h1 className={`${h1} mb-1`}>There they are. Which one are you sending?</h1>
            <p className="text-sm text-keeper-body">Both are yours — pick the one that's more them.</p>
            <div className="mt-6 grid gap-4 sm:gap-6 sm:grid-cols-2">
              {([[false, 'The original', c.imageUrl!], [true, 'With them in it', cameoUrl]] as const).map(([keep, name, url]) => (
                <button key={name} type="button" onClick={() => { setCameoKept(keep); setPhase('signoff'); }} className={`${cardTile} border-keeper-hair hover:border-brand`}>
                  <div className="aspect-square bg-stone-100 overflow-hidden"><img src={url} alt={name} crossOrigin="anonymous" className="w-full h-full object-cover" /></div>
                  <p className="p-3 text-sm font-medium text-keeper-ink">{name}</p>
                </button>
              ))}
            </div>
          </div>
        </MakeShell>
      );
    }
    return (
      <MakeShell step={step}>
        <div className={panel}>
          <button type="button" onClick={() => setPhase('results')} className="inline-flex items-center gap-1 text-sm text-keeper-body hover:text-keeper-ink mb-5"><ArrowLeft className="w-4 h-4" /> Back to the three</button>
          <div className="grid gap-6 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-start">
            <div className="rounded-xl overflow-hidden bg-stone-100 border border-keeper-hair">{c.imageUrl && <img src={c.imageUrl} alt="" crossOrigin="anonymous" className="w-full aspect-square object-cover" />}</div>
            {cameoBusy ? (
              <div className="text-center sm:text-left py-6" aria-live="polite">
                <Loader2 className="w-7 h-7 text-brand animate-spin mx-auto sm:mx-0" />
                <p className="mt-3 text-base font-semibold text-keeper-ink">Putting them into {forWho} card…</p>
                <p className="mt-1 text-sm text-keeper-meta">Everyone from your photo, drawn in the card's own style. About half a minute.</p>
              </div>
            ) : (
              <div>
                <h1 className={`${h1} mb-1`}>Want them actually in the picture?</h1>
                <p className="text-sm text-keeper-body">Add a photo — a group one works too — and we'll put them into this exact card, drawn in its own style, right in the middle of things. You'll see both versions and choose.</p>
                {cameoError && <p className="mt-3 text-sm text-accent-red-dark">{cameoError}</p>}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <label className={`${primary} cursor-pointer`}><Camera className="w-4 h-4" strokeWidth={1.75} /> Add a photo
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readCameoFile(f).then(setCameoSrc); e.target.value = ''; }} /></label>
                  <Button variant="outline" className="h-10 px-5" onClick={() => setPhase('signoff')}>Skip — keep it as it is</Button>
                </div>
                <p className={helper}>We never keep your photo — only the finished card.</p>
              </div>
            )}
          </div>
          <CropDialog src={cameoSrc} autoFace={false} onCancel={() => setCameoSrc(null)}
            onConfirm={(bounds) => { const src = cameoSrc; setCameoSrc(null); if (!src) return; void cropToDataUrl(src, bounds).then(renderCameo).catch(() => setCameoError('That photo wouldn’t crop — try another one.')); }} />
        </div>
      </MakeShell>
    );
  }

  // ── step 3b: the inside ───────────────────────────────────────────
  if (phase === 'signoff' && picked !== null) {
    const c = cells[picked];
    return (
      <MakeShell step={step}>
        <div className={panel}>
          <button type="button" onClick={() => setPhase('results')} className="inline-flex items-center gap-1 text-sm text-keeper-body hover:text-keeper-ink mb-5"><ArrowLeft className="w-4 h-4" /> Back to the three</button>
          <div className="grid gap-6 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-start">
            <div className="rounded-xl overflow-hidden bg-stone-100 border border-keeper-hair">{chosenFront && <img src={chosenFront} alt="" crossOrigin="anonymous" className="w-full aspect-square object-cover" />}</div>
            {insideBusy ? (
              <div className="text-center sm:text-left py-6" aria-live="polite">
                <Loader2 className="w-7 h-7 text-brand animate-spin mx-auto sm:mx-0" />
                <p className="mt-3 text-base font-semibold text-keeper-ink">Designing the inside to match…</p>
                <p className="mt-1 text-sm text-keeper-meta">Your words, set in the card's own style. About half a minute.</p>
              </div>
            ) : (
              <div>
                <h1 className={`${h1} mb-1`}>Now the inside of {forWho} card</h1>
                <p className="text-sm text-keeper-body mb-5">Every card gets a designed inside to match its front.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {c.concept.inside_text && <button type="button" onClick={() => setInsideMode('ours')} className={tile(insideMode === 'ours')}><span className="text-sm font-medium text-keeper-ink">Use the message we wrote</span>{insideMode === 'ours' && <span className="ml-auto w-5 h-5 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0 shadow-sm"><Check className="w-3 h-3" strokeWidth={3} /></span>}</button>}
                  <button type="button" onClick={() => setInsideMode('own')} className={tile(insideMode === 'own')}><span className="text-sm font-medium text-keeper-ink">Write my own</span>{insideMode === 'own' && <span className="ml-auto w-5 h-5 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0 shadow-sm"><Check className="w-3 h-3" strokeWidth={3} /></span>}</button>
                </div>
                {insideMode === 'ours' && c.concept.inside_text && <div className="mt-3 rounded-xl border border-keeper-hair bg-stone-50 px-4 py-3 text-sm leading-snug text-keeper-body">“{c.concept.inside_text}”</div>}
                <div className="mt-4 space-y-3">
                  <Input value={dear} onChange={(e) => setDear(e.target.value)} placeholder="How you open — e.g. Dear Mum," className={input} />
                  {insideMode === 'own' && <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message…" autoFocus className="min-h-[120px] w-full rounded-xl border border-brand-light bg-white px-4 py-3 text-base resize-y placeholder:text-keeper-meta/70 focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20" />}
                  <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="How you sign — e.g. Love, Aidan x" className={input} />
                </div>
                {failMsg && <p className="mt-3 text-sm text-accent-red-dark">{failMsg}</p>}
                <div className="mt-6"><button type="button" onClick={() => void renderInside()} disabled={insideMode === 'own' && !message.trim()} className={commit}><Sparkles className="w-4 h-4" strokeWidth={1.75} /> Design the inside</button></div>
              </div>
            )}
          </div>
        </div>
      </MakeShell>
    );
  }

  // ── step 4: done ──────────────────────────────────────────────────
  if (phase === 'done' && picked !== null) {
    return (
      <MakeShell step={step}>
        <div className={panel}>
          <h1 className={`${h1} mb-1`}>There it is — {forWho} card.</h1>
          <p className="text-sm text-keeper-body">Printed to order on 280gsm, kraft envelope, posted first class.</p>
          <div className="mt-6 grid gap-4 sm:gap-6 sm:grid-cols-2">
            <div className="bg-white rounded-2xl border border-keeper-hair overflow-hidden"><div className="aspect-square bg-stone-100">{chosenFront && <img src={chosenFront} alt="front" crossOrigin="anonymous" className="w-full h-full object-cover" />}</div><p className="p-3 text-sm font-medium text-keeper-ink">The front</p></div>
            <div className="bg-white rounded-2xl border border-keeper-hair overflow-hidden"><div className="aspect-square bg-stone-100">{insideUrl && <img src={insideUrl} alt="inside" crossOrigin="anonymous" className="w-full h-full object-cover" />}</div><p className="p-3 text-sm font-medium text-keeper-ink">The inside</p></div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" disabled={!!saving || !chosenFront} className={commit}
              onClick={() => {
                if (!chosenFront) return;
                setSaving('buy'); setSaveError('');
                saveCard(chosenFront, insideUrl, cells[picked].concept, insideMode, insideMode === 'own' ? [dear.trim(), message.trim(), from.trim()].filter(Boolean).join('\n\n') : [dear.trim(), cells[picked].concept.inside_text ?? '', from.trim()].filter(Boolean).join('\n\n'))
                  .then((s) => navigate(`/buy/${s.cardId}`))
                  .catch((e: any) => { setSaveError(e?.message ?? 'That didn’t save — try again'); setSaving(''); });
              }}>
              {saving === 'buy' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Buy it — {gbp(cardPriceGBP('maker'))}
            </button>
            <button type="button" disabled={!!saving || !chosenFront}
              className="inline-flex items-center gap-2 rounded-full border border-keeper-hair bg-white/70 text-keeper-ink hover:bg-keeper-gold-wash px-5 py-2.5 text-sm font-medium disabled:opacity-50"
              onClick={() => {
                if (!chosenFront) return;
                setSaving('keep'); setSaveError('');
                saveCard(chosenFront, insideUrl, cells[picked].concept, insideMode, insideMode === 'own' ? [dear.trim(), message.trim(), from.trim()].filter(Boolean).join('\n\n') : [dear.trim(), cells[picked].concept.inside_text ?? '', from.trim()].filter(Boolean).join('\n\n'))
                  .then((s) => {
                    // Signed in: the row is already theirs. Guest: sign in,
                    // then come back to claim it by token.
                    if (isAuthenticated) navigate(`/studio/card/${s.cardId}`);
                    else { setSaving(''); openAuth(`/make?claim=${s.cardId}`); }
                  })
                  .catch((e: any) => { setSaveError(e?.message ?? 'That didn’t save — try again'); setSaving(''); });
              }}>
              {saving === 'keep' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" strokeWidth={1.75} />} {isAuthenticated ? 'Keep it in my studio' : 'Keep it — sign in'}
            </button>
            <button type="button" onClick={() => navigate('/door2')} className={textLink}>Make another</button>
          </div>
          {saveError && <p className="mt-3 text-sm text-accent-red-dark">{saveError}</p>}
          <p className={helper}>Made for them · {gbp(cardPriceGBP('maker'))} + postage, printed to order in the UK. {saved ? 'Saved — it’s yours for this session.' : 'Keeping it puts it in your studio; buying takes you straight to checkout.'}</p>
        </div>
      </MakeShell>
    );
  }

  return null;
}
