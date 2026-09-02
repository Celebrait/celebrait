// client/src/pages/make.tsx — /make, DOOR 2 AS A CUSTOMER SURFACE
//
// LP2 Phase B (UX_LP2.md §3). The booking bar lands here with the brief
// in the URL. Flow: brief (only what's missing) → wait (the narration
// + progressive reveal: words first, fronts fade in as they land) →
// results (the promise bar, made-for-them, tone chips that re-deal,
// the ready-now rail, the photo strip) → pick → cameo (after the pick,
// the proven timing) → inside → done (Keep = sign in, Buy = Phase C).
//
// A fork of the research maker, minus the survey. Same engine
// endpoints behind the guest gate (/api/make/*): generate free, sign in
// to keep or buy (THREE_DOORS §8c). No client-side set cap — the server
// bounds exposure per IP and globally.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2, ArrowLeft, Sparkles, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { CropDialog } from '@/components/studio/crop-dialog';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import { ThumbImg } from '@/components/thumb-img';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP, SHIPPING_TIERS } from '@shared/pricing';
import type { CropBounds } from '@shared/models/photos';

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
const slugify = (t: string) => t.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

type Vibe = 'funny' | 'warm' | 'rude' | 'mix';
const VIBE_LABEL: Record<Vibe, string> = { mix: 'One of each', funny: 'All funny', warm: 'All warm', rude: 'Cheekier' };

interface Brief { occasion: string; who: string; thing: string; by: string; age: string; name: string; cant: string }
function readBrief(): Brief {
  const q = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  return {
    occasion: (q.get('occasion') ?? 'birthday').toLowerCase(), who: q.get('who') ?? '', thing: q.get('thing') ?? '',
    by: q.get('by') ?? '', age: q.get('age') ?? '', name: q.get('name') ?? '', cant: q.get('cant') ?? '',
  };
}

interface Concept { angle: string; format?: string; front_text: string; inside_text?: string; art_direction: string; palette?: string; typeface?: string; direction?: string; tone?: string }
interface CardCell { concept: Concept; imageUrl?: string; error?: string; retrying?: boolean }
interface RackCard { id: number; front_text: string; imageUrl: string }

type Phase = 'brief' | 'generating' | 'results' | 'cameo' | 'signoff' | 'done' | 'failed' | 'capped';

/** The promise line (UX_LP2.md §3c.1): computed from real lead times —
 *  72h production + the tier's posting window. Certainty, not scarcity. */
function promiseFor(by: string): { text: string; tone: 'ok' | 'tight' } {
  const standard = SHIPPING_TIERS.find((t) => t.id === 'standard');
  const arrive = new Date(); arrive.setDate(arrive.getDate() + 3 + 2);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  if (!by) return { text: `Printed within 72 hours, posted ${standard?.carrier ?? 'first class'} — at the door by ${fmt(arrive)}.`, tone: 'ok' };
  const need = new Date(`${by}T12:00:00`);
  const spare = Math.round((need.getTime() - arrive.getTime()) / 86400000);
  if (spare >= 1) return { text: `Printed within 72 hours, posted ${standard?.carrier ?? 'first class'} — at the door by ${fmt(arrive)}. ${spare === 1 ? 'A day to spare.' : `${spare} days to spare.`}`, tone: 'ok' };
  return { text: `Cutting it fine for ${fmt(need)} — printed within 72 hours and posted ${standard?.carrier ?? 'first class'}, arriving around ${fmt(arrive)}. A digital copy to share lands instantly either way.`, tone: 'tight' };
}

const shell = 'keeper-serif relative min-h-screen overflow-x-clip';
const Backdrop = () => <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />;

export default function MakePage() {
  useSeo('/make');
  useEffect(() => {
    // Not a page to index — every visit is a fresh generation.
    const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex';
    document.head.appendChild(m); return () => { m.remove(); };
  }, []);
  const [, navigate] = useLocation();
  const [brief, setBrief] = useState<Brief>(readBrief);
  const [vibe, setVibe] = useState<Vibe>('mix');
  // The engine deals its archetype from the interest, the age, the name and
  // the dislike — "who" alone would starve it. So the door (the LP pill) can
  // be two facts, but nothing generates until the brief has the one thing
  // they love. Everything already known arrives prefilled and isn't re-asked.
  const [phase, setPhase] = useState<Phase>(brief.who && brief.thing ? 'generating' : 'brief');
  const [more, setMore] = useState(false);
  const [failMsg, setFailMsg] = useState('');

  const ageNum = useMemo(() => { const n = parseInt(brief.age, 10); return Number.isInteger(n) && n >= 1 && n <= 110 ? n : null; }, [brief.age]);
  const isKid = ageNum !== null && ageNum < 18;
  const occasionLabel = brief.occasion === 'christmas' ? 'Christmas' : ageNum ? `${ageNum}th Birthday` : 'Birthday';

  // The set
  const [cells, setCells] = useState<CardCell[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [rack, setRack] = useState<RackCard[]>([]);

  // The cameo (after the pick)
  const [cameoSrc, setCameoSrc] = useState<string | null>(null);
  const [cameoUrl, setCameoUrl] = useState<string | null>(null);
  const [cameoBusy, setCameoBusy] = useState(false);
  const [cameoKept, setCameoKept] = useState(false);
  const [cameoError, setCameoError] = useState('');

  // The inside
  const [insideMode, setInsideMode] = useState<'ours' | 'own' | 'blank'>('ours');
  const [dear, setDear] = useState(''); const [message, setMessage] = useState(''); const [from, setFrom] = useState('');
  const [insideUrl, setInsideUrl] = useState<string | null>(null);
  const [insideBusy, setInsideBusy] = useState(false);

  // ── the ready-now rail: the occasion's aisle for their thing, or the hub ──
  useEffect(() => {
    const slug = brief.thing ? slugify(brief.thing) : '';
    const tryAisle = slug.length >= 3 ? fetch(`/api/catalogue/${brief.occasion}?aisle=${encodeURIComponent(slug)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null);
    tryAisle.then((j) => {
      if (j?.cards?.length) { setRack(j.cards.slice(0, 4)); return; }
      return fetch(`/api/catalogue/${brief.occasion}`).then((r) => (r.ok ? r.json() : null)).then((h) => setRack((h?.cards ?? []).slice(0, 4))).catch(() => setRack([]));
    });
  }, [brief.occasion, brief.thing]);

  // ── the wait narration ──
  const [narration, setNarration] = useState('');
  const lines = useMemo(() => [
    brief.thing ? `Reading up on ${brief.thing}…` : `Thinking about what makes a ${brief.occasion === 'christmas' ? 'Christmas card' : 'birthday'} land…`,
    brief.who && brief.who !== 'Someone else' ? `Working out what your ${brief.who.toLowerCase()} would actually pick up…` : 'Working out what they would actually pick up…',
    'Choosing colours from their world…', 'Writing three very different cards…', 'Drawing the fronts…',
  ], [brief.thing, brief.who, brief.occasion]);
  const nRef = useRef(0);
  useEffect(() => {
    if (phase !== 'generating') return;
    nRef.current = 0; setNarration(lines[0]);
    const t = setInterval(() => { nRef.current = Math.min(nRef.current + 1, lines.length - 1); setNarration(lines[nRef.current]); }, 7000);
    return () => clearInterval(t);
  }, [phase, lines]);

  // ── generation ──
  const generate = async (tone: Vibe = vibe) => {
    setPhase('generating'); setCells([]); setPicked(null); setInsideUrl(null);
    setCameoUrl(null); setCameoKept(false); setCameoError(''); setFailMsg('');
    try {
      const j = await makePost('concepts', {
        occasion: occasionLabel, who: brief.who === 'Someone else' ? 'Anyone' : brief.who,
        tone: isKid && tone === 'rude' ? 'funny' : tone, pipeline: 'celebrait', characters: 'objects', insideMode: 'auto',
        freeStyle: true, age: ageNum, interest: brief.thing || undefined, dislikes: brief.cant || undefined,
        recipientName: brief.name || undefined, memory: true,
      });
      const concepts: Concept[] = j.concepts ?? [];
      if (!concepts.length) throw new Error('Nothing came back — try again');
      // Progressive reveal: the WORDS land now; each front fades in as it draws.
      setCells(concepts.map((c) => ({ concept: c })));
      setPhase('results');
      await Promise.all(concepts.map((c, i) => renderCell(i, c)));
    } catch (e: any) {
      if (e?.status === 429 || e?.status === 503) { setFailMsg(e.message); setPhase('capped'); }
      else { setFailMsg(e?.message ?? 'That didn’t work'); setPhase('failed'); }
    }
  };
  useEffect(() => { if (phase === 'generating' && cells.length === 0 && brief.who) void generate(); /* eslint-disable-line */ }, []); // straight-to-generate on arrival

  const renderCell = async (i: number, c: Concept, cameoPhoto?: string) => {
    try {
      const rj = await makePost('render', { front_text: c.front_text, art_direction: c.art_direction, palette: c.palette, typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true, ...(cameoPhoto ? { cameoPhoto } : {}) });
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, imageUrl: rj.imageUrl, error: undefined } : x)));
    } catch {
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, error: 'That one didn’t come out.' } : x)));
    }
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

  // ── the cameo (after the pick) ──
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
    const c = cells[picked].concept; setInsideBusy(true);
    try {
      const core = insideMode === 'ours' ? (c.inside_text ?? '') : insideMode === 'own' ? message.trim() : '';
      const joined = insideMode === 'blank' ? '' : [dear.trim(), core, from.trim()].filter(Boolean).join('\n\n');
      const body = joined ? { mode: 'own', message: joined } : { mode: 'blank' };
      const ir = await makePost('render-inside', { ...body, palette: c.palette, typeface: c.typeface, art_direction: c.art_direction, characters: 'objects', freeStyle: true, direction: c.direction });
      setInsideUrl(ir.imageUrl); setPhase('done');
    } catch (e: any) { setFailMsg(e?.message ?? 'The inside didn’t render — try again'); }
    finally { setInsideBusy(false); }
  };

  const chosenFront = picked !== null ? (cameoKept && cameoUrl ? cameoUrl : cells[picked]?.imageUrl) : undefined;
  const promise = promiseFor(brief.by);

  // ── shared bits ──
  const ReadyNow = () => rack.length ? (
    <section className="mt-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-dark">Ready now · {gbp(cardPriceGBP('rack'))}</p>
      <h2 className="mt-1 font-display text-2xl font-bold text-keeper-ink">Off the shelf{brief.thing ? `, for ${brief.thing}` : ''}</h2>
      <p className="text-sm text-keeper-meta">Real cards, printed today if you order by 3pm.</p>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {rack.map((c) => (
          <Link key={c.id} href={`/card/${c.id}`} className="group block">
            <AjarTile imageUrl={c.imageUrl} alt={c.front_text} />
            <p className="mt-2 line-clamp-2 text-[12.5px] text-keeper-body">“{c.front_text}”</p>
          </Link>
        ))}
      </div>
      <Link href={`/cards/${brief.occasion}`} className="mt-3 inline-block text-sm font-semibold text-brand-dark hover:underline">Browse the whole shelf →</Link>
    </section>
  ) : null;

  // ── screens ──────────────────────────────────────────────────────────
  if (phase === 'brief') {
    return (
      <div className={shell}><Backdrop /><KeeperHeader />
        <main className="mx-auto max-w-md px-4 pb-24 pt-36 sm:px-6">
          {brief.who ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-dark">{occasionLabel} · for your {brief.who.toLowerCase()}</p>
              <h1 className="mt-1.5 font-display text-3xl font-bold text-keeper-ink">One thing they love.</h1>
              <p className="mt-2 text-sm text-keeper-meta">This is what the three cards get built around — the more them, the better. A hobby, a team, a habit, a running joke.</p>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold text-keeper-ink">Who's the card for?</h1>
              <p className="mt-2 text-sm text-keeper-meta">Who it's for, and one thing they love. That's all the engine needs.</p>
            </>
          )}
          <div className="mt-6 space-y-3">
            {!brief.who && (
              <>
                <select value={brief.occasion} onChange={(e) => setBrief({ ...brief, occasion: e.target.value })} className="h-11 w-full rounded-md border border-keeper-hair bg-white px-3 text-sm">
                  <option value="birthday">Birthday</option><option value="christmas">Christmas</option>
                </select>
                <Input value={brief.who} onChange={(e) => setBrief({ ...brief, who: e.target.value })} placeholder="Who it's for — Mum, Dad, best mate…" className="h-11" />
              </>
            )}
            <Input value={brief.thing} onChange={(e) => setBrief({ ...brief, thing: e.target.value.slice(0, 80) })} placeholder="fishing · the allotment · Boxing Day football" className="h-11" autoFocus={!!brief.who} />
            <div className="flex flex-wrap gap-1.5">
              {(brief.occasion === 'christmas'
                ? ['the works do', 'Elf on the Shelf', 'the cheeseboard', 'Boxing Day football', 'a proper roast', 'the dog']
                : ['gardening', 'a proper cup of tea', 'Strictly', 'golf', 'the dog', 'a good gin']
              ).map((chip) => (
                <button key={chip} type="button" onClick={() => setBrief({ ...brief, thing: chip })}
                  className={`rounded-full border px-3 py-1 text-[12.5px] ${brief.thing === chip ? 'border-brand-dark bg-brand-muted text-brand-dark' : 'border-keeper-hair bg-white text-keeper-body hover:border-brand-dark'}`}>
                  {chip}
                </button>
              ))}
            </div>
            {brief.occasion === 'birthday' && <Input value={brief.age} onChange={(e) => setBrief({ ...brief, age: e.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="Turning… (optional, but it changes the cards)" className="h-11" inputMode="numeric" />}
            <button type="button" onClick={() => setMore((v) => !v)} className="text-[13px] font-semibold text-brand-dark hover:underline">
              {more ? '– fewer details' : "+ their name, or something they can't stand"}
            </button>
            {more && (
              <>
                <Input value={brief.name} onChange={(e) => setBrief({ ...brief, name: e.target.value.slice(0, 40) })} placeholder="Their name — goes on one card's artwork" className="h-11" />
                <Input value={brief.cant} onChange={(e) => setBrief({ ...brief, cant: e.target.value.slice(0, 60) })} placeholder="Can't stand — one card gets built around it" className="h-11" />
              </>
            )}
          </div>
          <Button className="mt-6 h-12 w-full text-base" disabled={!brief.who.trim() || !brief.thing.trim()} onClick={() => void generate()}>
            <Sparkles className="mr-2 h-4 w-4" /> Write their three cards
          </Button>
          <p className="mt-3 text-center text-xs text-keeper-meta">About a minute. Got a photo of them handy? After you pick, we can put them right in the card.</p>
        </main>
      </div>
    );
  }

  if (phase === 'failed' || phase === 'capped') {
    return (
      <div className={shell}><Backdrop /><KeeperHeader />
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-36 sm:px-6">
          <h1 className="font-display text-3xl font-bold text-keeper-ink">{phase === 'capped' ? 'We’ve made a lot of cards today.' : 'That one didn’t come out.'}</h1>
          <p className="mt-3 text-keeper-body">{failMsg}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {phase === 'failed' && <Button className="h-11" onClick={() => void generate()}>Try again</Button>}
            {phase === 'capped' && <Link href="/studio" className="inline-flex h-11 items-center rounded-full bg-keeper-ink px-6 text-sm font-semibold text-keeper-paper">Sign in to keep going</Link>}
            <Link href="/lp2" className="inline-flex h-11 items-center rounded-full border border-keeper-hair bg-white px-6 text-sm font-semibold text-keeper-ink"><ArrowLeft className="mr-2 h-4 w-4" /> Change the details</Link>
          </div>
          {rack.length > 0 && <p className="mt-10 text-sm text-keeper-meta">Meanwhile, these are ready now.</p>}
          <ReadyNow />
        </main>
      </div>
    );
  }

  if (phase === 'generating') {
    return (
      <div className={shell}><Backdrop /><KeeperHeader />
        <main className="mx-auto max-w-4xl px-4 pb-24 pt-36 text-center sm:px-6" aria-live="polite">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-dark" />
          <h1 className="mt-6 font-display text-3xl font-bold text-keeper-ink">Writing three cards for your {brief.who.toLowerCase() || 'person'}…</h1>
          <p className="mt-3 text-lg text-keeper-body">{narration}</p>
          <p className="mt-2 text-sm text-keeper-meta">About a minute. Worth it — the cards appear as they’re made.</p>
          {rack.length > 0 && <div className="mt-12 text-left"><p className="text-sm text-keeper-meta">Browse the shelf while you wait:</p><ReadyNow /></div>}
        </main>
      </div>
    );
  }

  if (phase === 'results') {
    const allSettled = cells.every((c) => c.imageUrl || c.error);
    return (
      <div className={shell}><Backdrop /><KeeperHeader />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6">
          <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-[14.5px] font-semibold ${promise.tone === 'ok' ? 'bg-cta-light text-cta-dark' : 'bg-accent-red-light text-accent-red-dark'}`}>
            <span aria-hidden="true">{promise.tone === 'ok' ? '✓' : '!'}</span><span>{promise.text}</span>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-keeper-meta">The mix</span>
            {(Object.keys(VIBE_LABEL) as Vibe[]).map((v) => {
              const off = v === 'rude' && isKid;
              return (
                <button key={v} type="button" disabled={off || !allSettled} title={off ? 'Cheeky is off for under-18s' : 'Re-deal: same details, three new cards'}
                  onClick={() => { setVibe(v); void generate(v); }}
                  className={`rounded-full border px-4 py-1.5 text-[13.5px] font-semibold transition-colors disabled:opacity-40 ${vibe === v ? 'border-brand-dark bg-brand-muted text-brand-dark' : 'border-keeper-hair bg-white text-keeper-body hover:border-brand-dark'}`}>
                  {VIBE_LABEL[v]}
                </button>
              );
            })}
            <span className="text-[12.5px] text-keeper-meta">switching re-deals the three</span>
          </div>

          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-dark">Made for them · {gbp(cardPriceGBP('maker'))}</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-keeper-ink">Three cards. Pick the one.</h1>
          <p className="mt-1 text-sm text-keeper-meta">{allSettled ? 'Tap your favourite — next we design its inside, with your words in it.' : 'Still drawing — the words are ready, the fronts are landing…'}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {cells.map((c, i) => (
              <button key={i} type="button" disabled={!c.imageUrl}
                onClick={() => { setPicked(i); setInsideMode(c.concept.inside_text ? 'ours' : 'own'); setCameoUrl(null); setCameoKept(false); setCameoError(''); setPhase('cameo'); }}
                className="overflow-hidden rounded-2xl border-2 border-transparent bg-white text-left transition-all hover:border-brand-dark/40 disabled:cursor-default">
                <div className="relative aspect-square bg-keeper-paper">
                  {c.imageUrl
                    ? <img src={c.imageUrl} alt={c.concept.front_text} crossOrigin="anonymous" className="h-full w-full object-cover opacity-0 transition-opacity duration-700" onLoad={(e) => e.currentTarget.classList.remove('opacity-0')} />
                    : c.error
                      ? <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-keeper-meta"><span>{c.error}</span>
                          <span role="button" onClick={(e) => { e.stopPropagation(); void tryAgain(i); }} className="rounded-md border border-keeper-hair bg-white px-2.5 py-1.5 text-[11px] font-medium text-keeper-body hover:border-brand-dark">{c.retrying ? 'Having another go…' : 'Have another go'}</span></div>
                      : <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"><p className="text-sm font-medium italic leading-snug text-keeper-body">“{c.concept.front_text}”</p><p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-brand-dark"><Loader2 className="h-3 w-3 animate-spin" /> drawing this one</p></div>}
                  {c.concept.tone && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium capitalize text-keeper-body">{c.concept.tone}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <p className="line-clamp-2 text-[13px] font-medium leading-snug text-keeper-ink">“{c.concept.front_text}”</p>
                  {c.imageUrl && <span className="whitespace-nowrap text-[12.5px] font-semibold text-brand-dark">Choose →</span>}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-keeper-hair bg-white/70 px-5 py-4">
            <p className="max-w-[56ch] text-[14px] text-keeper-body"><b className="text-keeper-ink">Got a photo of them handy?</b> After you pick, we can put them right in the card — drawn into its artwork.
              <span className="block text-[12.5px] text-keeper-meta">Or, with a scene in mind: <Link href="/studio" className="font-semibold text-brand-dark hover:underline">the photo studio →</Link> ({gbp(cardPriceGBP('photo'))}, you direct it)</span></p>
          </div>

          <ReadyNow />
          <p className="mt-10 text-center"><Link href="/lp2" className="text-sm text-keeper-meta hover:text-keeper-ink">← Change the details</Link></p>
        </main>
      </div>
    );
  }

  if (phase === 'cameo' && picked !== null) {
    const c = cells[picked];
    if (cameoUrl) {
      return (
        <div className={shell}><Backdrop /><KeeperHeader />
          <main className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6">
            <h1 className="text-center font-display text-3xl font-bold text-keeper-ink">There they are. Which one are you sending?</h1>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {([[false, 'The original', c.imageUrl!], [true, 'With them in it', cameoUrl]] as const).map(([keep, label, url]) => (
                <button key={label} type="button" onClick={() => { setCameoKept(keep); setPhase('signoff'); }} className="overflow-hidden rounded-2xl border-2 border-transparent bg-white text-left transition-all hover:border-brand-dark/60">
                  <img src={url} alt={label} crossOrigin="anonymous" className="aspect-square w-full object-cover" />
                  <p className="p-3 text-center text-sm font-medium text-keeper-ink">{label}</p>
                </button>
              ))}
            </div>
          </main>
        </div>
      );
    }
    return (
      <div className={shell}><Backdrop /><KeeperHeader />
        <main className="mx-auto max-w-md px-4 pb-24 pt-32 sm:px-6">
          <button type="button" onClick={() => setPhase('results')} className="mb-6 flex items-center gap-1 text-sm text-keeper-meta hover:text-keeper-ink"><ArrowLeft className="h-4 w-4" /> Back to the three</button>
          <div className="overflow-hidden rounded-2xl border border-keeper-hair bg-white">{c.imageUrl && <img src={c.imageUrl} alt="" crossOrigin="anonymous" className="aspect-square w-full object-cover" />}</div>
          {cameoBusy ? (
            <div className="mt-8 text-center" aria-live="polite"><Loader2 className="mx-auto h-7 w-7 animate-spin text-brand-dark" /><p className="mt-3 font-display text-xl font-bold text-keeper-ink">Putting them into your card…</p><p className="text-sm text-keeper-meta">Everyone from your photo, drawn in the card’s own style. About half a minute.</p></div>
          ) : (
            <>
              <h1 className="mt-8 font-display text-2xl font-bold text-keeper-ink">Want them actually in the picture?</h1>
              <p className="mt-2 text-sm leading-relaxed text-keeper-body">Add a photo — a group one works too — and we’ll put them into this exact card, drawn in its own art style, right in the middle of things. You’ll see both versions and choose.</p>
              {cameoError && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{cameoError}</p>}
              <label className="mt-6 block"><input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readCameoFile(f).then(setCameoSrc); e.target.value = ''; }} />
                <span className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-go text-base font-semibold text-go-foreground hover:bg-go-hover">Add a photo</span></label>
              <Button variant="outline" className="mt-3 h-12 w-full text-base" onClick={() => setPhase('signoff')}>Skip — keep it as it is</Button>
              <p className="mt-4 text-center text-xs text-keeper-meta">We never keep your photo — only the finished card.</p>
              <CropDialog src={cameoSrc} autoFace={false} onCancel={() => setCameoSrc(null)}
                onConfirm={(bounds) => { const src = cameoSrc; setCameoSrc(null); if (!src) return; void cropToDataUrl(src, bounds).then(renderCameo).catch(() => setCameoError('That photo wouldn’t crop — try another one.')); }} />
            </>
          )}
        </main>
      </div>
    );
  }

  if (phase === 'signoff' && picked !== null) {
    const c = cells[picked];
    return (
      <div className={shell}><Backdrop /><KeeperHeader />
        <main className="mx-auto max-w-md px-4 pb-24 pt-32 sm:px-6">
          <button type="button" onClick={() => setPhase('results')} className="mb-6 flex items-center gap-1 text-sm text-keeper-meta hover:text-keeper-ink"><ArrowLeft className="h-4 w-4" /> Back to the three</button>
          <div className="overflow-hidden rounded-2xl border border-keeper-hair bg-white">{chosenFront && <img src={chosenFront} alt="" crossOrigin="anonymous" className="aspect-square w-full object-cover" />}</div>
          {insideBusy ? (
            <div className="mt-8 text-center" aria-live="polite"><Loader2 className="mx-auto h-7 w-7 animate-spin text-brand-dark" /><p className="mt-3 font-display text-xl font-bold text-keeper-ink">Designing the inside to match…</p><p className="text-sm text-keeper-meta">Your words, set in the card’s own style — about half a minute.</p></div>
          ) : (
            <>
              <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-dark">Front chosen — one more step</p>
              <h1 className="mt-1.5 font-display text-2xl font-bold text-keeper-ink">Now the inside</h1>
              <p className="mt-1 text-sm text-keeper-meta">Every card gets a designed inside to match its front.</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {c.concept.inside_text && <button type="button" onClick={() => setInsideMode('ours')} className={`rounded-xl border p-3 text-sm font-semibold ${insideMode === 'ours' ? 'border-brand-dark bg-brand-dark text-white' : 'border-keeper-hair bg-white text-keeper-body'}`}>Use our message</button>}
                <button type="button" onClick={() => setInsideMode('own')} className={`rounded-xl border p-3 text-sm font-semibold ${insideMode === 'own' ? 'border-brand-dark bg-brand-dark text-white' : 'border-keeper-hair bg-white text-keeper-body'} ${!c.concept.inside_text ? 'col-span-2' : ''}`}>Write my own</button>
              </div>
              {insideMode === 'ours' && c.concept.inside_text && <div className="mt-3 rounded-xl border border-brand-dark/40 bg-brand-muted p-3.5"><span className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Written for this card</span><p className="mt-1 text-sm leading-snug text-keeper-body">“{c.concept.inside_text}”</p></div>}
              <div className="mt-3 space-y-2.5">
                <Input value={dear} onChange={(e) => setDear(e.target.value)} placeholder="How you open — Dear Mum,… (optional)" className="h-11" />
                {insideMode === 'own' && <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message…" autoFocus className="min-h-[88px] w-full rounded-md border border-keeper-hair bg-white p-3 text-sm" />}
                <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="How you sign — Love, Aidan… (optional)" className="h-11" />
              </div>
              {failMsg && <p className="mt-3 text-sm text-red-700">{failMsg}</p>}
              <Button className="mt-6 h-12 w-full text-base" onClick={() => void renderInside()} disabled={insideMode === 'own' && !message.trim()}><Sparkles className="mr-2 h-4 w-4" /> Design the inside</Button>
            </>
          )}
        </main>
      </div>
    );
  }

  if (phase === 'done' && picked !== null) {
    return (
      <div className={shell}><Backdrop /><KeeperHeader />
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-32 text-center sm:px-6">
          <h1 className="font-display text-3xl font-bold text-keeper-ink">There it is.</h1>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-keeper-hair bg-white">{chosenFront && <img src={chosenFront} alt="front" crossOrigin="anonymous" className="aspect-square w-full object-cover" />}<p className="p-2 text-xs text-keeper-meta">The front</p></div>
            <div className="overflow-hidden rounded-2xl border border-keeper-hair bg-white">{insideUrl && <img src={insideUrl} alt="inside" crossOrigin="anonymous" className="aspect-square w-full object-cover" />}<p className="p-2 text-xs text-keeper-meta">The inside</p></div>
          </div>
          <div className={`mt-6 rounded-xl px-4 py-3 text-left text-[14px] font-semibold ${promise.tone === 'ok' ? 'bg-cta-light text-cta-dark' : 'bg-accent-red-light text-accent-red-dark'}`}>{promise.text}</div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href="/studio" className="inline-flex h-12 items-center justify-center rounded-full border border-keeper-hair bg-white text-base font-semibold text-keeper-ink hover:border-brand-dark"><Lock className="mr-2 h-4 w-4" /> Keep it — sign in</Link>
            <button type="button" disabled className="inline-flex h-12 items-center justify-center rounded-full bg-go text-base font-semibold text-go-foreground opacity-60" title="Guest checkout for made-for-them cards lands with Phase C">
              Buy it — {gbp(cardPriceGBP('maker'))} <span className="ml-2 rounded border border-dashed border-white/60 px-1.5 text-[10px] uppercase tracking-wider">phase C</span>
            </button>
          </div>
          <p className="mt-4 text-xs text-keeper-meta">Made for them · {gbp(cardPriceGBP('maker'))} + postage · printed to order in the UK</p>
          <ThumbImg src={insideUrl ?? ''} alt="" className="hidden" />
        </main>
      </div>
    );
  }

  return null;
}
