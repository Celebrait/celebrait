// client/src/pages/research-maker.tssx — THE F&F RESEARCH WALK-THROUGH
//
// The guided maker in market-research clothes (Aidan, 2026-08-24):
// friends and family walk the REAL flow via a keyed link — no login —
// then answer six questions while the feeling is live. The survey +
// the behavioural record (brief, cards, pick, regen) save as one row.
//
// The key rides the URL (?k=...) and every API call; server-side caps
// bound a leaked link. Two sets per browser, softly — this is a
// research tool, not a free-card tap.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import celebraitLogo from '@/assets/celebrait.webp';

// ── The research key + soft cap ──────────────────────────────────────
const key = () => new URLSearchParams(window.location.search).get('k') ?? '';
const SETS_KEY = 'celebrait_research_sets';
const setsUsed = () => parseInt(localStorage.getItem(SETS_KEY) ?? '0', 10) || 0;

async function researchPost(path: string, body: unknown): Promise<any> {
  const r = await fetch(`/api/research/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-research-key': key() },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'That didn’t work — give it another go');
  return r.json();
}

// ── Question config (mirrors the guided maker) ───────────────────────
type QuestionKey = 'who' | 'age' | 'vibe' | 'interest' | 'name';
type Vibe = 'funny' | 'warm' | 'rude' | 'mix';
const QUESTIONS: QuestionKey[] = ['who', 'age', 'vibe', 'interest', 'name'];

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

const VIBE_META: Record<Vibe, { label: string; sub: string }> = {
  funny: { label: 'Funny', sub: 'make them laugh out loud' },
  warm: { label: 'Warm', sub: 'the one they keep on the mantelpiece' },
  rude: { label: 'Rude', sub: 'proper swearing, asterisked' },
  mix: { label: 'One of each', sub: 'three cards, three vibes — you choose after' },
};
const DISLIKE_ON: Vibe[] = ['funny', 'rude', 'mix'];
const PLACEHOLDERS = ['fishing', 'Ibiza', 'their allotment', 'Man United', 'Toy Story'];

// ── The survey ───────────────────────────────────────────────────────
interface SurveyQ {
  id: string;
  title: string;
  kind: 'choice' | 'text';
  options?: string[];
  sub?: string;
  optional?: boolean;
}
const SURVEY: SurveyQ[] = [
  { id: 'would_send', title: 'Honestly — would you have sent that card to a real person?', kind: 'choice', options: ['Yes, exactly as it is', 'Yes, with a tweak or two', 'No'] },
  { id: 'expected_price', title: 'What would you expect to pay for it, printed and posted to their door?', kind: 'text', sub: 'Whatever number feels right — there’s no wrong answer.' },
  { id: 'price_feel', title: 'It’s £8.99 + postage. How does that feel?', kind: 'choice', options: ['Bargain', 'Fair', 'A bit steep', 'Wouldn’t pay that'] },
  { id: 'first_use', title: 'Who would you make one for first — and for what occasion?', kind: 'text', sub: 'e.g. “my sister, her 30th” — this genuinely shapes what we build next.' },
  { id: 'friction', title: 'Did anything nearly stop you, or annoy you along the way?', kind: 'text', optional: true },
  { id: 'vs_market', title: 'Compared to Moonpig or Thortful, this is…', kind: 'choice', options: ['Much better', 'A bit better', 'About the same', 'Worse'] },
];

interface Concept {
  angle: string; format?: string; front_text: string; inside_text?: string;
  art_direction: string; palette?: string; typeface?: string; direction?: string; tone?: string;
}
interface CardCell { concept: Concept; imageUrl?: string; error?: string; retrying?: boolean }

type Phase = 'welcome' | 'questions' | 'generating' | 'pick' | 'signoff' | 'inside' | 'done' | 'survey' | 'thanks' | 'capped';

export default function ResearchMakerPage() {
  const [phase, setPhase] = useState<Phase>('welcome');
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
  const [regenUsed, setRegenUsed] = useState(false);

  // Sign-off
  const [dear, setDear] = useState('');
  const [message, setMessage] = useState('');
  const [from, setFrom] = useState('');
  const [insideUrl, setInsideUrl] = useState<string | null>(null);
  const [insideBusy, setInsideBusy] = useState(false);

  // Survey
  const [sIndex, setSIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [testerName, setTesterName] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const ageNum = useMemo(() => {
    const n = parseInt(age, 10);
    return Number.isInteger(n) && n >= 1 && n <= 110 ? n : null;
  }, [age]);

  const tones = useMemo(
    () => (ageNum !== null && ageNum < 18 ? (['funny', 'warm'] as Vibe[]) : (['funny', 'warm', 'rude', 'mix'] as Vibe[])),
    [ageNum],
  );

  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  useEffect(() => {
    const t = setInterval(() => setPlaceholder((p) => PLACEHOLDERS[(PLACEHOLDERS.indexOf(p) + 1) % PLACEHOLDERS.length]), 2600);
    return () => clearInterval(t);
  }, []);

  const question = QUESTIONS[qIndex];
  const canNext =
    question === 'who' ? who !== null :
    question === 'vibe' ? vibe !== null : true;

  const next = () => {
    if (qIndex < QUESTIONS.length - 1) setQIndex(qIndex + 1);
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

  const generate = async (isRegen = false) => {
    if (setsUsed() >= 2) { setPhase('capped'); return; }
    localStorage.setItem(SETS_KEY, String(setsUsed() + 1));
    if (isRegen) setRegenUsed(true);
    setPhase('generating');
    setCells([]); setPicked(null); setInsideUrl(null);
    try {
      const j = await researchPost('concepts', {
        occasion: ageNum !== null ? `${ageNum}th Birthday` : 'Birthday',
        who: who === 'Someone else' ? 'Anyone' : who,
        gender: gender ?? undefined,
        tone: vibe, pipeline: 'celebrait', characters: 'objects', insideMode: 'auto',
        freeStyle: true, age: ageNum,
        interest: interest.trim() || undefined,
        dislikes: dislike.trim() || undefined,
        recipientName: name.trim() || undefined,
        memory: false,
      });
      const concepts: Concept[] = j.concepts ?? [];
      if (!concepts.length) throw new Error('Nothing came back — try again');
      setCells(concepts.map((c) => ({ concept: c })));
      setPhase('pick');
      await Promise.all(concepts.map((c, i) => renderCell(i, c)));
    } catch (e: any) {
      setPhase('questions');
      setQIndex(QUESTIONS.length - 1);
      alert(e?.message ?? 'That didn’t work — give it another go');
    }
  };

  const renderCell = async (i: number, c: Concept) => {
    try {
      const rj = await researchPost('render', {
        front_text: c.front_text, art_direction: c.art_direction, palette: c.palette,
        typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true,
      });
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, imageUrl: rj.imageUrl, error: undefined } : x)));
    } catch {
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, error: 'That one didn’t come out.' } : x)));
    }
  };

  const tryAgain = async (i: number) => {
    const cell = cells[i];
    if (!cell || cell.retrying) return;
    setCells((prev) => prev.map((x, j) => (j === i ? { ...x, retrying: true, error: undefined } : x)));
    try {
      const fix = await researchPost('ip-safe-art', {
        front_text: cell.concept.front_text, art_direction: cell.concept.art_direction,
        interest: interest.trim() || undefined,
      });
      const concept = { ...cell.concept, art_direction: fix.art_direction };
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
      const body = message.trim()
        ? { mode: 'own', message: [dear.trim() && `Dear ${dear.trim()},`, message.trim(), from.trim() && `From ${from.trim()}`].filter(Boolean).join('\n\n') }
        : { mode: 'blank' };
      const ir = await researchPost('render-inside', {
        ...body, palette: c.palette, typeface: c.typeface, art_direction: c.art_direction,
        characters: 'objects', freeStyle: true, direction: c.direction,
      });
      setInsideUrl(ir.imageUrl);
      setPhase('done');
    } catch (e: any) {
      alert(e?.message ?? 'The inside didn’t render — try again');
    } finally {
      setInsideBusy(false);
    }
  };

  // ── Survey submit ──────────────────────────────────────────────────
  const submit = async (finalAnswers: Record<string, string>, nameForRow: string) => {
    if (submitted) { setPhase('thanks'); return; }
    setSubmitBusy(true);
    try {
      await researchPost('response', {
        tester_name: nameForRow.trim() || undefined,
        brief: {
          who, gender, age: ageNum, vibe,
          interest: interest.trim() || null, dislike: dislike.trim() || null, name: name.trim() || null,
        },
        cards: cells.map((c) => ({ front_text: c.concept.front_text, tone: c.concept.tone, angle: c.concept.angle })),
        picked_index: picked,
        regen_used: regenUsed,
        pickedImageUrl: picked !== null ? cells[picked]?.imageUrl : undefined,
        insideImageUrl: insideUrl ?? undefined,
        answers: finalAnswers,
      });
      setSubmitted(true);
      setPhase('thanks');
    } catch (e: any) {
      alert(e?.message ?? 'Could not save your answers — try once more?');
    } finally {
      setSubmitBusy(false);
    }
  };

  // ── Shared UI bits ─────────────────────────────────────────────────
  const chip = (active: boolean) =>
    `rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
      active ? 'border-brand bg-brand-muted/50 text-brand-dark' : 'border-stone-200 bg-white text-stone-700 hover:border-brand/50'}`;

  const Dots = ({ count, at }: { count: number; at: number }) => (
    <div className="flex justify-center gap-1.5 pt-6">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all ${i === at ? 'w-6 bg-brand' : 'w-1.5 bg-stone-200'}`} />
      ))}
    </div>
  );

  // ── Screens ────────────────────────────────────────────────────────
  if (phase === 'welcome') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-[#FBF9F5] px-6 py-10 text-center">
        <img src={celebraitLogo} alt="Celebrait" className="mx-auto h-10 w-auto" />
        <h1 className="mt-8 text-2xl font-semibold text-stone-800">Thank you for helping test our birthday card maker.</h1>
        <p className="mt-4 text-sm leading-relaxed text-stone-600">
          Celebrait designs one-of-a-kind greeting cards — you tell us a little about
          someone, and we write and illustrate three completely original cards for them,
          front and inside, ready to print and post.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          Today you're one of the first people outside the building to try it. Answer five
          quick questions about someone with a birthday coming up, pick your favourite of
          the three, and then tell us honestly what you thought — about two minutes
          of making, one minute of questions.
        </p>
        <Button className="mt-8 h-12 w-full text-base" onClick={() => setPhase(setsUsed() >= 2 ? 'capped' : 'questions')}>
          Let’s make one
        </Button>
        <p className="mt-6 text-xs text-stone-400">
          Friends &amp; family preview — we’ll keep the cards you make and your answers,
          to make Celebrait better. That’s the deal, and thank you for taking the time.
        </p>
      </div>
    );
  }

  if (phase === 'capped') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-[#FBF9F5] px-6 py-10 text-center">
        <h1 className="text-2xl font-semibold text-stone-800">You’ve made your two — thank you!</h1>
        <p className="mt-3 text-sm text-stone-500">
          That’s the preview allowance done. If you’ve got more thoughts, message Aidan directly — he wants them.
        </p>
      </div>
    );
  }

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
          <button type="button" onClick={() => void generate(true)} className="text-sm text-stone-400 underline-offset-2 hover:underline">
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
          <Input value={dear} onChange={(e) => setDear(e.target.value)} placeholder="Dear… (optional)" className="h-11" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message (optional — blank inside is a real choice)"
            className="min-h-[96px] w-full rounded-md border border-stone-200 bg-white p-3 text-sm" />
          <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From… (optional)" className="h-11" />
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
        <Button className="mt-8 h-12 w-full max-w-sm text-base" onClick={() => { setSIndex(0); setPhase('survey'); }}>
          Six quick questions — 60 seconds
        </Button>
        <p className="mt-3 text-xs text-stone-400">Your answers are the reason this preview exists.</p>
      </div>
    );
  }

  if (phase === 'survey') {
    const q = SURVEY[sIndex];
    const value = answers[q.id] ?? '';
    const isLast = sIndex === SURVEY.length - 1;
    const advance = (v: string) => {
      const nextAnswers = { ...answers, [q.id]: v };
      setAnswers(nextAnswers);
      if (!isLast) setSIndex(sIndex + 1);
      else void submit(nextAnswers, testerName);
    };
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#FBF9F5] px-5 py-8">
        <div className="flex items-center justify-between">
          {sIndex > 0
            ? <button type="button" onClick={() => setSIndex(sIndex - 1)} className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600"><ArrowLeft className="h-4 w-4" /> Back</button>
            : <span />}
          <span className="text-sm font-semibold text-stone-700">celebrait<span className="text-brand">.</span></span>
        </div>
        <div className="flex flex-1 flex-col justify-center py-8">
          <h1 className="text-xl font-semibold text-stone-800">{q.title}</h1>
          {q.sub && <p className="mt-2 text-sm text-stone-500">{q.sub}</p>}
          {q.kind === 'choice' ? (
            <div className="mt-6 space-y-2.5">
              {q.options!.map((o) => (
                <button key={o} type="button" onClick={() => advance(o)}
                  className={`w-full rounded-xl border p-4 text-left font-medium transition-colors ${
                    value === o ? 'border-brand bg-brand-muted/40 text-stone-800' : 'border-stone-200 bg-white text-stone-700 hover:border-brand/50'}`}>
                  {o}
                </button>
              ))}
            </div>
          ) : (
            <>
              <textarea value={value} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                placeholder="Type away…" autoFocus
                className="mt-6 min-h-[96px] w-full rounded-md border border-stone-200 bg-white p-3 text-sm" />
              {isLast && (
                <Input value={testerName} onChange={(e) => setTesterName(e.target.value)} placeholder="Your first name (optional)" className="mt-3 h-11" />
              )}
              <Button className="mt-4 h-12 w-full text-base" disabled={submitBusy || (!q.optional && !value.trim())}
                onClick={() => advance(value)}>
                {submitBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLast ? 'Send my answers' : 'Next'}
              </Button>
              {q.optional && !value.trim() && (
                <button type="button" onClick={() => advance('')} className="mt-3 w-full text-center text-sm text-stone-400 hover:text-stone-600">
                  Nothing springs to mind — skip
                </button>
              )}
            </>
          )}
        </div>
        <Dots count={SURVEY.length} at={sIndex} />
      </div>
    );
  }

  if (phase === 'thanks') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-[#FBF9F5] px-6 py-10 text-center">
        <h1 className="text-2xl font-semibold text-stone-800">That’s genuinely useful — thank you.</h1>
        <p className="mt-3 text-sm text-stone-500">Every answer shapes what gets built next.</p>
        {setsUsed() < 2 && (
          <Button variant="outline" className="mt-8 h-11"
            onClick={() => {
              setPhase('questions'); setQIndex(0); setCells([]); setPicked(null); setInsideUrl(null);
              setAnswers({}); setSIndex(0); setSubmitted(false); setRegenUsed(false);
            }}>
            Make one more
          </Button>
        )}
      </div>
    );
  }

  // ── The five maker questions ───────────────────────────────────────
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
              <span className="ml-2 inline-block translate-y-[-2px] rounded-full bg-stone-100 px-2.5 py-1 align-middle text-xs font-medium text-stone-500">optional</span>
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
            <h1 className="text-2xl font-semibold text-stone-800">Tell us one thing they’re into.</h1>
            <p className="mt-2 text-sm text-stone-500">
              One’s enough — the thing you’d mention first. The more specific, the better the card:
              ‘Man United’ beats ‘football’. A trip or a plan counts too.
            </p>
            <Input value={interest} onChange={(e) => setInterest(e.target.value)} placeholder={placeholder} className="mt-6 h-12" />
            {vibe && DISLIKE_ON.includes(vibe) && (
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
            <h1 className="text-2xl font-semibold text-stone-800">Want their name on the front?</h1>
            <p className="mt-2 text-sm text-stone-500">We’ll design it in properly — one of the cards will make it the artwork.</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their first name (optional)" className="mt-6 h-12" />
            {name.trim() && <p className="mt-2 text-xs font-medium text-amber-700">It’ll be printed exactly as you type it — worth a double-check.</p>}
          </>
        )}
      </div>

      <div className="pb-4">
        <Button className="h-12 w-full text-base" disabled={!canNext} onClick={next}>
          {qIndex === QUESTIONS.length - 1 ? 'Make their card' : 'Next'}
        </Button>
        {(question === 'age' || question === 'interest' || question === 'name') && (
          <button type="button" onClick={next} className="mt-3 w-full text-center text-sm text-stone-400 hover:text-stone-600">
            Skip this one
          </button>
        )}
        <Dots count={QUESTIONS.length} at={qIndex} />
      </div>
    </div>
  );
}
