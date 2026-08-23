// client/src/pages/admin-guided-maker.tsx
//
// THE GUIDED MAKER — the customer front-end for the v2 engine, built to
// UX_GUIDED_MAKER.md and previewed behind admin auth until the customer
// endpoints (free + 5/day cap + email gate) exist. One question per
// screen, five taps to the generate button, every optional skippable in
// one tap. Voice: "we", never "the AI".
//
// Deliberately NOT inside AdminLayout: this page is a rehearsal of the
// customer experience and should look like one, chrome-free.
//
// CONFIG-DRIVEN (the occasions decision): the shell reads its questions
// from an occasion config; birthday is the only entry at launch. A new
// world is a config row + engine work, never a flow rebuild.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/queryClient';

// ── The occasion config ──────────────────────────────────────────────
type QuestionKey = 'who' | 'age' | 'vibe' | 'interest' | 'name';
type Vibe = 'funny' | 'warm' | 'rude' | 'mix';

interface OccasionConfig {
  key: string;
  label: string;
  questions: QuestionKey[];
  ageAsk: 'turning' | 'years-together' | 'none';
  tones: Vibe[];
  dislikeOn: Vibe[];
}

const BIRTHDAY: OccasionConfig = {
  key: 'birthday',
  label: 'Birthday',
  questions: ['who', 'age', 'vibe', 'interest', 'name'],
  ageAsk: 'turning',
  tones: ['funny', 'warm', 'rude', 'mix'],
  dislikeOn: ['funny', 'rude', 'mix'],
};

/** "Someone else" replaces the studio's "Anyone" — a customer always
 *  has someone in mind; Anyone is a rack-building concept. Family chips
 *  carry implied gender; the quiet him/her row appears only for the
 *  ambiguous ones. */
const RECIPIENTS: Array<{ label: string; implies?: 'him' | 'her' }> = [
  { label: 'Mum', implies: 'her' }, { label: 'Dad', implies: 'him' },
  { label: 'Nan', implies: 'her' }, { label: 'Grandad', implies: 'him' },
  { label: 'Sister', implies: 'her' }, { label: 'Brother', implies: 'him' },
  { label: 'Daughter', implies: 'her' }, { label: 'Son', implies: 'him' },
  { label: 'Granddaughter', implies: 'her' }, { label: 'Grandson', implies: 'him' },
  { label: 'Niece', implies: 'her' }, { label: 'Nephew', implies: 'him' },
  { label: 'Partner' }, { label: 'Best mate' }, { label: 'Friend' },
  { label: 'Colleague' }, { label: 'Someone else' },
];
const AMBIGUOUS = new Set(['Partner', 'Best mate', 'Friend', 'Colleague', 'Someone else']);

/** Customer-facing labels only — the engine still receives
 *  funny/warm/rude/mix underneath (Aidan, 2026-08-24: "rude sounds
 *  too much like xxx"; Cheeky is the UK card-rack word for it). */
const VIBE_META: Record<Vibe, { label: string; sub: string }> = {
  funny: { label: 'Light humour', sub: 'a good laugh, kindly meant' },
  warm: { label: 'Warm', sub: 'heartfelt — the kind they keep' },
  rude: { label: 'Cheeky', sub: 'proper swearing, tastefully starred out' },
  mix: { label: 'One of each', sub: 'three cards, three vibes — you choose after' },
};

const PLACEHOLDERS = ['fishing', 'Ibiza', 'their allotment', 'Man United', 'Toy Story'];

interface Concept {
  angle: string; format?: string; front_text: string; inside_text?: string;
  art_direction: string; palette?: string; typeface?: string; direction?: string; tone?: string;
}
interface CardCell { concept: Concept; imageUrl?: string; error?: string; retrying?: boolean }

type Phase = 'questions' | 'generating' | 'pick' | 'signoff' | 'inside' | 'done';

export default function AdminGuidedMakerPage() {
  const config = BIRTHDAY;

  const [phase, setPhase] = useState<Phase>('questions');
  const [qIndex, setQIndex] = useState(0);

  // Answers
  const [who, setWho] = useState<string | null>(null);
  const [gender, setGender] = useState<'him' | 'her' | null>(null);
  const [age, setAge] = useState('');
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [interest, setInterest] = useState('');
  const [dislike, setDislike] = useState('');
  const [showDislike, setShowDislike] = useState(false);
  const [name, setName] = useState('');

  // The set
  const [cells, setCells] = useState<CardCell[]>([]);
  const [picked, setPicked] = useState<number | null>(null);

  // Sign-off
  const [dear, setDear] = useState('');
  const [message, setMessage] = useState('');
  const [from, setFrom] = useState('');
  const [insideUrl, setInsideUrl] = useState<string | null>(null);
  const [insideBusy, setInsideBusy] = useState(false);

  const ageNum = useMemo(() => {
    const n = parseInt(age, 10);
    return Number.isInteger(n) && n >= 1 && n <= 110 ? n : null;
  }, [age]);

  /** Under-18: rude (and one-of-each, which contains it) quietly vanish.
   *  The copy never mentions why. */
  const tones = useMemo(
    () => (ageNum !== null && ageNum < 18 ? config.tones.filter((t) => t !== 'rude' && t !== 'mix') : config.tones),
    [ageNum, config.tones],
  );

  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  useEffect(() => {
    const t = setInterval(() => setPlaceholder((p) => PLACEHOLDERS[(PLACEHOLDERS.indexOf(p) + 1) % PLACEHOLDERS.length]), 2600);
    return () => clearInterval(t);
  }, []);

  const question = config.questions[qIndex];
  const canNext =
    question === 'who' ? who !== null :
    question === 'vibe' ? vibe !== null : true; // age / interest / name are skippable

  const next = () => {
    if (qIndex < config.questions.length - 1) setQIndex(qIndex + 1);
    else void generate();
  };
  const back = () => { if (qIndex > 0) setQIndex(qIndex - 1); };

  // ── Generation ─────────────────────────────────────────────────────
  const [narration, setNarration] = useState('');
  const narrationLines = useMemo(() => [
    interest.trim() ? `Reading up on ${interest.trim()}…` : 'Thinking about what makes a birthday land…',
    who && who !== 'Someone else' ? `Working out what your ${who.toLowerCase()} would actually pick up…` : 'Working out what they would actually pick up…',
    'Choosing colours from their world…',
    'Writing three very different cards…',
    'Drawing the fronts…',
  ], [interest, who]);
  const narrationRef = useRef(0);
  useEffect(() => {
    if (phase !== 'generating') return;
    narrationRef.current = 0;
    setNarration(narrationLines[0]);
    const t = setInterval(() => {
      narrationRef.current = Math.min(narrationRef.current + 1, narrationLines.length - 1);
      setNarration(narrationLines[narrationRef.current]);
    }, 7000);
    return () => clearInterval(t);
  }, [phase, narrationLines]);

  const generate = async () => {
    setPhase('generating');
    setCells([]); setPicked(null); setInsideUrl(null);
    try {
      const r = await apiRequest('POST', '/api/admin/card-lab/concepts', {
        occasion: ageNum !== null ? `${ageNum}th Birthday` : 'Birthday',
        who: who === 'Someone else' ? 'Anyone' : who,
        gender: gender ?? undefined,
        tone: vibe, pipeline: 'celebrait', characters: 'objects', insideMode: 'auto',
        freeStyle: true, age: ageNum,
        interest: interest.trim() || undefined,
        dislikes: dislike.trim() || undefined,
        recipientName: name.trim() || undefined,
        // LOCKED: customers are fresh eyes — the rack's cross-run memory
        // is a curation tool, not a customer one.
        memory: false,
      });
      const { concepts = [] } = (await r.json()) as { concepts: Concept[] };
      if (!concepts.length) throw new Error('Nothing came back — try again');
      setCells(concepts.map((c) => ({ concept: c })));
      setPhase('pick');
      await Promise.all(concepts.map((c, i) => renderCell(i, c)));
    } catch (e: any) {
      setPhase('questions');
      setQIndex(config.questions.length - 1);
      alert(e?.message ?? 'That didn’t work — give it another go');
    }
  };

  const renderCell = async (i: number, c: Concept) => {
    try {
      const rr = await apiRequest('POST', '/api/admin/card-lab/render', {
        front_text: c.front_text, art_direction: c.art_direction, palette: c.palette,
        typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true,
      });
      const rj = await rr.json();
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, imageUrl: rj.imageUrl, error: undefined } : x)));
    } catch (e: any) {
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, error: 'That one didn’t come out.' } : x)));
    }
  };

  /** The IP-safe retry, in customer clothes. */
  const tryAgain = async (i: number) => {
    const cell = cells[i];
    if (!cell || cell.retrying) return;
    setCells((prev) => prev.map((x, j) => (j === i ? { ...x, retrying: true, error: undefined } : x)));
    try {
      const fix = await apiRequest('POST', '/api/admin/card-lab/ip-safe-art', {
        front_text: cell.concept.front_text, art_direction: cell.concept.art_direction,
        interest: interest.trim() || undefined,
      });
      const { art_direction } = await fix.json();
      const concept = { ...cell.concept, art_direction };
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, concept } : x)));
      await renderCell(i, concept);
    } catch {
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, error: 'Still no luck — pick another, or start again.' } : x)));
    } finally {
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, retrying: false } : x)));
    }
  };

  const renderInside = async () => {
    if (picked === null) return;
    const c = cells[picked].concept;
    setInsideBusy(true);
    try {
      // Exactly as typed — no auto "Dear"/"From" wrapping (observed:
      // "Dear Dear Mum" / "From From Aidan" printed on a real inside).
      const joined = [dear.trim(), message.trim(), from.trim()].filter(Boolean).join('\n\n');
      const body = joined ? { mode: 'own', message: joined } : { mode: 'blank' };
      const ir = await apiRequest('POST', '/api/admin/card-lab/render-inside', {
        ...body, palette: c.palette, typeface: c.typeface, art_direction: c.art_direction,
        characters: 'objects', freeStyle: true, direction: c.direction,
      });
      setInsideUrl((await ir.json()).imageUrl);
      setPhase('done');
    } catch (e: any) {
      alert(e?.message ?? 'The inside didn’t render — try again');
    } finally {
      setInsideBusy(false);
    }
  };

  // ── Screens ────────────────────────────────────────────────────────
  const Dots = () => (
    <div className="flex justify-center gap-1.5 pt-6">
      {config.questions.map((q, i) => (
        <span key={q} className={`h-1.5 rounded-full transition-all ${i === qIndex ? 'w-6 bg-brand' : 'w-1.5 bg-stone-200'}`} />
      ))}
    </div>
  );

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
      active ? 'border-brand bg-brand-muted/50 text-brand-dark' : 'border-stone-200 bg-white text-stone-700 hover:border-brand/50'}`;

  if (phase === 'generating') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#FBF9F5] px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-lg font-medium text-stone-700">{narration}</p>
        <p className="text-sm text-stone-400">Three cards, about a minute. Worth it.</p>
      </div>
    );
  }

  if (phase === 'pick') {
    const allSettled = cells.every((c) => c.imageUrl || c.error);
    return (
      <div className="mx-auto min-h-screen max-w-4xl bg-[#FBF9F5] px-4 py-10">
        <h1 className="text-center text-2xl font-semibold text-stone-800">Three cards. Pick the one.</h1>
        {!allSettled && <p className="mt-2 text-center text-sm text-stone-400">Still drawing…</p>}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {cells.map((c, i) => (
            <button key={i} type="button" disabled={!c.imageUrl}
              onClick={() => { setPicked(i); setPhase('signoff'); }}
              className={`overflow-hidden rounded-2xl border-2 bg-white text-left transition-all ${
                picked === i ? 'border-brand' : 'border-transparent hover:border-brand/40'}`}>
              <div className="relative aspect-square bg-stone-100">
                {c.imageUrl
                  ? <img src={c.imageUrl} alt={c.concept.front_text} crossOrigin="anonymous" className="h-full w-full object-cover" />
                  : c.error
                    ? <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-stone-500">
                        <span>{c.error}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); void tryAgain(i); }}
                          className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-600 hover:border-brand">
                          {c.retrying ? 'Having another go…' : 'Have another go'}
                        </button>
                      </div>
                    : <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-stone-300" /></div>}
                {c.concept.tone && (
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium capitalize text-stone-600">
                    {c.concept.tone}
                  </span>
                )}
              </div>
              <p className="p-3 text-[13px] font-medium leading-snug text-stone-700">“{c.concept.front_text}”</p>
            </button>
          ))}
        </div>
        <p className="mt-6 text-center">
          <button type="button" onClick={() => void generate()} className="text-sm text-stone-400 underline-offset-2 hover:underline">
            None of them? Start again with these details
          </button>
        </p>
      </div>
    );
  }

  if (phase === 'signoff' && picked !== null) {
    const c = cells[picked];
    return (
      <div className="mx-auto min-h-screen max-w-md bg-[#FBF9F5] px-4 py-10">
        <button type="button" onClick={() => setPhase('pick')} className="mb-6 flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600">
          <ArrowLeft className="h-4 w-4" /> Back to the three
        </button>
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {c.imageUrl && <img src={c.imageUrl} alt="" crossOrigin="anonymous" className="aspect-square w-full object-cover" />}
        </div>
        <h1 className="mt-8 text-xl font-semibold text-stone-800">Sign it off</h1>
        <p className="mt-1 text-sm text-stone-500">We’ll set your words inside, in the card’s own style — or leave the message blank and write it by hand when it arrives.</p>
        <div className="mt-5 space-y-3">
          <Input value={dear} onChange={(e) => setDear(e.target.value)} placeholder="How you open — Dear Mum, / To the best Nan… (optional)" className="h-11" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message (optional — blank inside is a real choice)"
            className="min-h-[96px] w-full rounded-md border border-stone-200 bg-white p-3 text-sm" />
          <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="How you sign — Love, Aidan / From all of us… (optional)" className="h-11" />
        </div>
        <Button className="mt-6 h-12 w-full text-base" onClick={() => void renderInside()} disabled={insideBusy}>
          {insideBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {insideBusy ? 'Setting the inside…' : 'Finish the card'}
        </Button>
      </div>
    );
  }

  if (phase === 'done' && picked !== null) {
    const c = cells[picked];
    return (
      <div className="mx-auto min-h-screen max-w-3xl bg-[#FBF9F5] px-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-stone-800">There it is.</h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {c.imageUrl && <img src={c.imageUrl} alt="front" crossOrigin="anonymous" className="aspect-square w-full object-cover" />}
            <p className="p-2 text-xs text-stone-400">The front</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {insideUrl && <img src={insideUrl} alt="inside" crossOrigin="anonymous" className="aspect-square w-full object-cover" />}
            <p className="p-2 text-xs text-stone-400">The inside</p>
          </div>
        </div>
        {/* Plumbing boundary: the 3D reveal, the Giving Moment and
            checkout are the next build step — this page hands over to
            them rather than rebuilding them. */}
        <p className="mx-auto mt-8 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Preview build: from here the real flow continues to the 3D reveal, delivery choices and checkout.
        </p>
        <button type="button" className="mt-6 text-sm text-stone-400 underline-offset-2 hover:underline"
          onClick={() => { setPhase('questions'); setQIndex(0); setCells([]); setPicked(null); setInsideUrl(null); }}>
          Start a new card
        </button>
      </div>
    );
  }

  // ── The five questions ─────────────────────────────────────────────
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#FBF9F5] px-5 py-8">
      <div className="flex items-center justify-between">
        {qIndex > 0
          ? <button type="button" onClick={back} className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600"><ArrowLeft className="h-4 w-4" /> Back</button>
          : <span />}
        <span className="text-sm font-semibold text-stone-700">celebrait<span className="text-brand">.</span></span>
      </div>

      <div className="flex flex-1 flex-col justify-center py-8">
        {question === 'who' && (
          <>
            <h1 className="text-2xl font-semibold text-stone-800">Right — who’s the card for?</h1>
            <div className="mt-6 flex flex-wrap gap-2">
              {RECIPIENTS.map((r) => (
                <button key={r.label} type="button" className={chip(who === r.label)}
                  onClick={() => { setWho(r.label); setGender(r.implies ?? null); }}>
                  {r.label}
                </button>
              ))}
            </div>
            {who && AMBIGUOUS.has(who) && (
              <div className="mt-5 flex items-center gap-2 text-sm text-stone-500">
                for a…
                {(['him', 'her'] as const).map((g) => (
                  <button key={g} type="button" className={chip(gender === g)} onClick={() => setGender(gender === g ? null : g)}>{g}</button>
                ))}
                <button type="button" className={chip(gender === null)} onClick={() => setGender(null)}>not saying</button>
              </div>
            )}
          </>
        )}

        {question === 'age' && (
          <>
            <h1 className="text-2xl font-semibold text-stone-800">
              How old are they turning?
              <span className="ml-2 inline-block translate-y-[-2px] rounded-full bg-brand-muted/50 px-2.5 py-1 align-middle text-xs font-semibold text-brand-dark">optional</span>
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Totally fine to skip — no age will appear anywhere. But if it’s a big one — 18, 21,
              30, 40… — we recommend it: the number becomes the star of the card.
            </p>
            <Input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric" placeholder="Their age" className="mt-6 h-14 text-center text-2xl" />
          </>
        )}

        {question === 'vibe' && (
          <>
            <h1 className="text-2xl font-semibold text-stone-800">What’s the vibe?</h1>
            <div className="mt-6 space-y-2.5">
              {tones.map((t) => (
                <button key={t} type="button" onClick={() => setVibe(t)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    vibe === t ? 'border-brand bg-brand-muted/40' : 'border-stone-200 bg-white hover:border-brand/50'}`}>
                  <span className="font-medium text-stone-800">{VIBE_META[t].label}</span>
                  <span className="block text-xs text-stone-500">{VIBE_META[t].sub}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {question === 'interest' && (
          <>
            <h1 className="text-2xl font-semibold text-stone-800">
              What’s their thing?
              <span className="ml-2 inline-block translate-y-[-2px] rounded-full bg-brand-muted/50 px-2.5 py-1 align-middle text-xs font-semibold text-brand-dark">optional</span>
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              The thing you’d mention first if you were describing them — a passion, a place,
              a plan, a party theme, a claim to fame, a running joke. The more specific, the
              better the card.
            </p>
            <Input value={interest} onChange={(e) => setInterest(e.target.value)} placeholder={placeholder} className="mt-6 h-12" />
            {vibe && config.dislikeOn.includes(vibe) && (
              showDislike
                ? <div className="mt-4">
                    <Input value={dislike} onChange={(e) => setDislike(e.target.value)} placeholder="Something they can’t stand" className="h-11" />
                    <p className="mt-1.5 text-xs text-stone-400">We’ll build one of the three cards around it.</p>
                  </div>
                : <button type="button" onClick={() => setShowDislike(true)} className="mt-4 text-sm text-brand underline-offset-2 hover:underline">
                    + something they can’t stand?
                  </button>
            )}
            <p className="mt-3 text-xs text-stone-400">Or skip it — we’ll make it a beautiful birthday card, no homework.</p>
          </>
        )}

        {question === 'name' && (
          <>
            <h1 className="text-2xl font-semibold text-stone-800">
              Want their name on the front?
              <span className="ml-2 inline-block translate-y-[-2px] rounded-full bg-brand-muted/50 px-2.5 py-1 align-middle text-xs font-semibold text-brand-dark">optional</span>
            </h1>
            <p className="mt-2 text-sm text-stone-500">We’ll design it in properly — one of the cards will make it the artwork.</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their first name (optional)" className="mt-6 h-12" />
            {name.trim() && <p className="mt-2 text-xs font-medium text-amber-700">It’ll be printed exactly as you type it — worth a double-check.</p>}
          </>
        )}
      </div>

      <div className="pb-4">
        <Button className="h-12 w-full text-base" disabled={!canNext} onClick={next}>
          {qIndex === config.questions.length - 1 ? 'Make their card' : 'Next'}
        </Button>
        {(question === 'age' || question === 'interest' || question === 'name') && (
          <button type="button" onClick={next} className="mt-3 w-full text-center text-sm text-stone-400 hover:text-stone-600">
            Skip this one
          </button>
        )}
        <Dots />
      </div>
    </div>
  );
}
