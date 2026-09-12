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
import { CropDialog } from '@/components/studio/crop-dialog';
import type { CropBounds } from '@shared/models/photos';
// THE SAME PIECES THE REAL FLOW USES (Aidan 2026-09-12: "make the
// research tool the same as the front end flow"). Testers must walk
// what customers walk, or the research measures the wrong product —
// and sharing the components is the only way it stays true.
import {
  BriefQuestions, emptyBrief, occasionLabelFor, ageOf, isKidBrief,
  whoPhrase, whoPossessive, type Brief, type QuestionKey,
} from '@/components/brief-questions';
import { MakeNarration } from '@/components/make-narration';
import { StepChips, type StepChip } from '@/components/step-chips';

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

// ── Question config lives in components/brief-questions.tsx now ─────
// (Aidan 2026-09-12: "make the research tool the same as the front end
// flow"). The recipients list, the vibe labels, the dislike rule, the
// typewriter examples and every headline were duplicated here and had
// quietly drifted a fortnight behind the real maker. Deleted rather
// than re-synced — one copy or it drifts again.

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
  { id: 'price_feel', title: 'It’s £5.99 + postage. How does that feel?', kind: 'choice', options: ['Bargain', 'Fair', 'A bit steep', 'Wouldn’t pay that'] },
  { id: 'first_use', title: 'Who would you make one for first — and for what occasion?', kind: 'text', sub: 'e.g. “my sister, her 30th” — this genuinely shapes what we build next.' },
  { id: 'friction', title: 'Did anything nearly stop you, or annoy you along the way?', kind: 'text', optional: true },
  { id: 'vs_market', title: 'Compared to Moonpig or Thortful, this is…', kind: 'choice', options: ['Much better', 'A bit better', 'About the same', 'Worse'] },
];
/** Asked only when the tester actually saw both versions. */
const CAMEO_Q: SurveyQ = {
  id: 'cameo_feel',
  title: 'You saw your card with them in it — honestly, how was it?',
  kind: 'choice',
  options: ['Loved it — instantly better', 'Liked it, but preferred the original', 'Didn’t quite look like them', 'Bit weird — not for me'],
};

interface Concept {
  angle: string; format?: string; front_text: string; inside_text?: string;
  art_direction: string; palette?: string; typeface?: string; direction?: string; tone?: string;
}
interface CardCell { concept: Concept; imageUrl?: string; error?: string; retrying?: boolean }

/** Chip labels for the brief's questions — same as /make. */
const QUESTION_LABEL: Record<QuestionKey, string> = {
  who: 'Who', occasion: 'Occasion', age: 'Age', vibe: 'Vibe', interest: 'Interest', dislike: 'Avoid', name: 'Name',
};

type Phase = 'welcome' | 'questions' | 'generating' | 'pick' | 'cameo' | 'signoff' | 'inside' | 'done' | 'survey' | 'thanks' | 'capped';

export default function ResearchMakerPage() {
  const [phase, setPhase] = useState<Phase>('welcome');
  /** Checked on arrival so a mangled link fails at the front door. */
  const [linkOk, setLinkOk] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(`/api/research/ping`, { headers: { 'x-research-key': key() } })
      .then((r) => setLinkOk(r.ok))
      .catch(() => setLinkOk(true)); // network blip: let them through, the real calls re-check
  }, []);
  // The brief is the SHARED shape, answered by the SHARED component —
  // so every copy change on /make lands here for free.
  const [brief, setBrief] = useState<Brief>(emptyBrief);
  const [briefStep, setBriefStep] = useState(0);
  const [briefFurthest, setBriefFurthest] = useState(0);
  const [briefQuestions, setBriefQuestions] = useState<QuestionKey[]>(['who', 'occasion', 'age', 'vibe', 'interest', 'name']);
  const [briefJump, setBriefJump] = useState<number | null>(null);
  const restartBrief = () => { setBriefStep(0); setBriefFurthest(0); setBriefJump(0); setPhase('questions'); };

  // The set
  const [cells, setCells] = useState<CardCell[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [regenUsed, setRegenUsed] = useState(false);

  // ── THE CAMEO (Aidan, 2026-08-28) — after picking, offer to paint
  // the people from a photo into the chosen card. The rule the lab
  // settled: people stay exactly as they are, the world bends around
  // them. Re-posing/directing belongs to the pro photo route.
  const [cameoSrc, setCameoSrc] = useState<string | null>(null);      // photo awaiting crop
  const [cameoPhoto, setCameoPhoto] = useState<string | null>(null);  // cropped data URL sent to render
  const [cameoUrl, setCameoUrl] = useState<string | null>(null);      // the painted-in version
  const [cameoBusy, setCameoBusy] = useState(false);
  const [cameoKept, setCameoKept] = useState<boolean | null>(null);   // their choice between the two
  /** In-set cameo (photo given UP FRONT, Aidan 2026-08-29): which card
   *  index carries the likeness, or null. The pick screen is then the
   *  head-to-head — does the cameo card WIN against clean cards? */
  const [cameoInSet, setCameoInSet] = useState<number | null>(null);
  const [cameoError, setCameoError] = useState('');
  const resetCameo = () => { setCameoSrc(null); setCameoPhoto(null); setCameoUrl(null); setCameoBusy(false); setCameoKept(null); setCameoError(''); };
  /** The cameo question joins the survey only for testers who saw both
   *  versions — everyone else gets the original six. */
  const survey = useMemo<SurveyQ[]>(
    () => (cameoUrl || cameoInSet !== null ? [SURVEY[0], CAMEO_Q, ...SURVEY.slice(1)] : SURVEY),
    [cameoUrl, cameoInSet],
  );

  /** Read a photo file → downscaled data URL (long edge ≤1600px), so a
   *  12MB phone photo never travels. Mirrors the studio's helper. */
  const readCameoFile = async (file: File): Promise<string> => {
    const asDataUrl = () => new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read failed'));
      r.readAsDataURL(file);
    });
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.size <= 1_500_000) { bitmap.close(); return await asDataUrl(); }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return canvas.toDataURL('image/jpeg', 0.9);
    } catch { return await asDataUrl(); }
  };

  /** Apply the crop box client-side — no server round-trip needed just
   *  to trim a reference photo. */
  const cropToDataUrl = (src: string, b: CropBounds) => new Promise<string>((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = b.width; canvas.height = b.height;
      canvas.getContext('2d')!.drawImage(img, b.x, b.y, b.width, b.height, 0, 0, b.width, b.height);
      res(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => rej(new Error('decode failed'));
    img.src = src;
  });

  const renderCameo = async (photo: string) => {
    if (picked === null) return;
    const c = cells[picked].concept;
    setCameoBusy(true); setCameoError('');
    try {
      const rj = await researchPost('render', {
        front_text: c.front_text, art_direction: c.art_direction, palette: c.palette,
        typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true,
        cameoPhoto: photo,
        // Redraw from the recipe (the edit was tried and reverted 2026-09-03).
        cameoMode: 'redraw',
      });
      setCameoUrl(rj.imageUrl);
    } catch (e: any) {
      setCameoError(e?.message ?? 'That didn’t work — you can try another photo, or carry on without.');
      setCameoPhoto(null);
    } finally {
      setCameoBusy(false);
    }
  };

  // Sign-off — 'ours' is the AI message the writer already composed
  // for the picked card; it costs nothing and arrives pre-selected.
  const [insideMode, setInsideMode] = useState<'ours' | 'own' | 'blank'>('ours');
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

  const ageNum = ageOf(brief);
  const occasionLabel = occasionLabelFor(brief);
  const whoName = whoPhrase(brief);
  const forWho = whoPossessive(brief);

  // ── Generation ─────────────────────────────────────────────────────
  // The wait is the real one: components/make-narration, reading the
  // brief back and then quoting the lines being drawn.
  const [waitConcepts, setWaitConcepts] = useState<Concept[] | null>(null);
  const [landed, setLanded] = useState(0);
  const [elapsedS, setElapsedS] = useState(0);
  const t0 = useRef(0);
  useEffect(() => {
    if (phase !== 'generating') return;
    setElapsedS(0); t0.current = Date.now();
    const p = setInterval(() => setElapsedS((Date.now() - t0.current) / 1000), 1000);
    return () => clearInterval(p);
  }, [phase]);
  const narrationInput = useMemo(() => ({ brief, age: ageNum, occasionLabel }), [brief, ageNum, occasionLabel]);

  const generate = async (isRegen = false) => {
    if (setsUsed() >= 2) { setPhase('capped'); return; }
    localStorage.setItem(SETS_KEY, String(setsUsed() + 1));
    if (isRegen) setRegenUsed(true);
    setPhase('generating');
    setCells([]); setPicked(null); setInsideUrl(null);
    setWaitConcepts(null); setLanded(0);
    // The PHOTO is part of the brief now, so it survives regens — only
    // the after-pick derivations reset.
    setCameoUrl(null); setCameoKept(null); setCameoError(''); setCameoInSet(null);
    try {
      const j = await researchPost('concepts', {
        occasion: occasionLabel,
        who: brief.who.trim() === 'Someone else' || !brief.who.trim() ? 'Anyone' : brief.who.trim(),
        gender: brief.gender ?? undefined,
        tone: isKidBrief(brief) && brief.vibe === 'rude' ? 'funny' : brief.vibe,
        pipeline: 'celebrait', characters: 'objects', insideMode: 'auto', freeComposition: true,
        freeStyle: true, age: ageNum,
        interest: brief.thing.trim() || undefined,
        dislikes: brief.cant.trim() || undefined,
        recipientName: brief.name.trim() || undefined,
        memory: false,
      });
      const concepts: Concept[] = j.concepts ?? [];
      if (!concepts.length) throw new Error('Nothing came back — try again');
      // The lab's ×1 rule: the cameo lands on the first card that isn't
      // type-only — a likeness on a text-only card is nothing.
      const cameoAt = cameoPhoto
        ? concepts.findIndex((c) => !/type[- ]?led|text[- ]?only|statement/i.test(`${c.format ?? ''} ${(c.art_direction ?? '').slice(0, 40)}`))
        : -1;
      setCameoInSet(cameoAt >= 0 ? cameoAt : null);
      setCells(concepts.map((c) => ({ concept: c })));
      setWaitConcepts(concepts);
      // All three finish before anything shows — the real flow's rule
      // (Aidan reverted cards-as-they-land on /make 2026-09-08).
      await Promise.all(concepts.map((c, i) => renderCell(i, c, i === cameoAt)));
      setPhase('pick');
    } catch (e: any) {
      restartBrief();
      alert(e?.message ?? 'That didn’t work — give it another go');
    }
  };

  const renderCell = async (i: number, c: Concept, withCameo = false) => {
    try {
      const rj = await researchPost('render', {
        front_text: c.front_text, art_direction: c.art_direction, palette: c.palette,
        typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true,
        ...(withCameo && cameoPhoto ? { cameoPhoto } : {}),
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
        interest: brief.thing.trim() || undefined,
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
      // Exactly as typed — no auto "Dear"/"From" wrapping (observed:
      // "Dear Dear Mum" / "From From Aidan" printed on a real inside).
      const core = insideMode === 'ours' ? (c.inside_text ?? '') : insideMode === 'own' ? message.trim() : '';
      const joined = insideMode === 'blank' ? '' : [dear.trim(), core, from.trim()].filter(Boolean).join('\n\n');
      const body = joined ? { mode: 'own', message: joined } : { mode: 'blank' };
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
          who: brief.who || null, gender: brief.gender, age: ageNum, vibe: brief.vibe,
          // New since the shared brief landed (2026-09-12) — the research
          // walk asks the occasion now, exactly as the real flow does.
          occasion: occasionLabel,
          interest: brief.thing.trim() || null, dislike: brief.cant.trim() || null, name: brief.name.trim() || null,
        },
        cards: [
          ...cells.map((c, i) => ({
            front_text: c.concept.front_text, tone: c.concept.tone,
            angle: i === cameoInSet ? `${c.concept.angle ?? ''} · cameo`.trim() : c.concept.angle,
            imageUrl: c.imageUrl,
          })),
          // The painted-in version travels too — it's half the experiment.
          ...(cameoUrl && picked !== null
            ? [{ front_text: cells[picked].concept.front_text, tone: 'cameo', angle: 'painted-in cameo', imageUrl: cameoUrl }]
            : []),
        ],
        picked_index: picked,
        regen_used: regenUsed,
        pickedImageUrl: cameoKept && cameoUrl ? cameoUrl : undefined,
        insideImageUrl: insideUrl ?? undefined,
        answers: {
          ...finalAnswers,
          // Two experiment arms: in-set (photo up front, did the cameo
          // card WIN the pick?) vs after-pick (did they keep it?).
          ...(cameoInSet !== null
            ? { cameo_used: 'yes', cameo_arm: 'in-set', cameo_kept: picked === cameoInSet ? 'yes' : 'no' }
            : cameoUrl
              ? { cameo_used: 'yes', cameo_arm: 'after-pick', cameo_kept: cameoKept ? 'yes' : 'no' }
              : {}),
        },
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
  const Dots = ({ count, at }: { count: number; at: number }) => (
    <div className="flex justify-center gap-1.5 pt-6">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all ${i === at ? 'w-6 bg-brand' : 'w-1.5 bg-stone-200'}`} />
      ))}
    </div>
  );

  // ── Screens ────────────────────────────────────────────────────────
  if (linkOk === false) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-[#FBF9F5] px-6 py-10 text-center">
        <img src={celebraitLogo} alt="Celebrait" className="mx-auto h-10 w-auto" />
        <h1 className="mt-8 text-2xl font-semibold text-stone-800">This preview link isn’t quite right.</h1>
        <p className="mt-3 text-sm text-stone-500">
          It may have been trimmed on its way to you — try tapping the original link again,
          or ask whoever sent it for a fresh one.
        </p>
      </div>
    );
  }

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
          Today you're one of the first people outside the building to try it. Answer a few
          quick questions about someone with a birthday coming up, pick your favourite of
          the three, and then tell us honestly what you thought — about two minutes
          of making, one minute of questions.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          One tip before you start: <span className="font-medium text-stone-700">have a photo of
          them handy</span> — after you pick your favourite, we can put them right in the card.
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
        <img src={celebraitLogo} alt="Celebrait" className="mx-auto mb-8 h-7 w-auto" />
        <h1 className="text-2xl font-semibold text-stone-800">You’ve made your two — thank you!</h1>
        <p className="mt-3 text-sm text-stone-500">
          That’s the preview allowance done. If you’ve got more thoughts, message Aidan directly — he wants them.
        </p>
      </div>
    );
  }

  if (phase === 'generating') {
    return (
      <div className="flex min-h-screen flex-col items-center bg-[#FBF9F5] px-6 pt-10">
        <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" />
        <div className="flex w-full max-w-lg flex-1 flex-col items-center justify-center pb-16 text-center">
          <p className="max-w-[440px] text-[13px] leading-relaxed text-keeper-meta">
            This usually takes <span className="font-medium text-keeper-ink">just over a minute</span>. We write three cards for {whoName} first, then draw all three, then show you the set.
          </p>
          <div className="relative mt-8 aspect-square w-28 overflow-hidden rounded-xl bg-gradient-to-br from-brand-muted via-brand-muted/70 to-brand-muted/90 shadow-[0_8px_30px_-8px_rgba(124,58,237,0.35)] ring-1 ring-brand/15 sm:w-32">
            <div className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
          <div className="mt-8 w-full">
            <MakeNarration input={narrationInput} concepts={waitConcepts} landed={landed} elapsedS={elapsedS} />
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'pick') {
    const allSettled = cells.every((c) => c.imageUrl || c.error);
    return (
      <div className="mx-auto min-h-screen max-w-4xl bg-[#FBF9F5] px-4 py-10">
        <img src={celebraitLogo} alt="Celebrait" className="mx-auto mb-8 h-7 w-auto" />
        <h1 className="text-center text-2xl font-semibold text-stone-800">Three cards for {whoName}. Pick the one.</h1>
        <p className="mt-2 text-center text-sm text-stone-500">Tap your favourite. Next you can put {whoName} in it with a photo (optional), then we design the inside with your words.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {cells.map((c, i) => (
            <button key={i} type="button" disabled={!c.imageUrl}
              onClick={() => {
                setPicked(i); setInsideMode(c.concept.inside_text ? 'ours' : 'own');
                // Photo given up front → the cameo already competed in
                // the pick; straight on. No photo → offer it now.
                if (cameoInSet !== null) { setPhase('signoff'); }
                else { setCameoUrl(null); setCameoKept(null); setCameoError(''); setPhase('cameo'); }
              }}
              className={`overflow-hidden rounded-2xl border-2 bg-white text-left transition-all ${
                picked === i ? 'border-brand' : 'border-transparent hover:border-brand/40'}`}>
              <div className="relative aspect-square bg-stone-100">
                {c.imageUrl
                  ? <img src={c.imageUrl} alt={c.concept.front_text} crossOrigin="anonymous"
                      className="h-full w-full object-cover opacity-0 transition-opacity duration-700"
                      onLoad={(e) => e.currentTarget.classList.remove('opacity-0')} />
                  : c.error
                    ? <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-stone-500">
                        <span>{c.error}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); void tryAgain(i); }}
                          className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-600 hover:border-brand">
                          {c.retrying ? 'Having another go…' : 'Have another go'}
                        </button>
                      </div>
                    : <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#FDFBF7] p-6 text-center">
                        <p className="text-sm font-medium italic leading-snug text-stone-600">“{c.concept.front_text}”</p>
                        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-brand">
                          <Loader2 className="h-3 w-3 animate-spin" /> drawing this one
                        </p>
                      </div>}
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
        <div className="mt-6 text-center text-sm text-stone-400">
          <p>None of them quite right?</p>
          <p className="mt-2 flex items-center justify-center gap-4">
            <button type="button" onClick={restartBrief}
              className="font-medium text-brand underline-offset-2 hover:underline">
              Change the details
            </button>
            <span className="text-stone-300">·</span>
            <button type="button" onClick={() => void generate(true)} className="underline-offset-2 hover:underline">
              Same details, three new cards
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── THE CAMEO OFFER — new since 2026-08-28, signposted as such.
  if (phase === 'cameo' && picked !== null) {
    const c = cells[picked];
    // Result state: both versions exist — they choose, and the choice
    // itself is the research signal.
    if (cameoUrl) {
      return (
        <div className="mx-auto min-h-screen max-w-3xl bg-[#FBF9F5] px-4 py-10">
          <img src={celebraitLogo} alt="Celebrait" className="mx-auto mb-8 h-7 w-auto" />
          <h1 className="text-center text-2xl font-semibold text-stone-800">There they are. Which one are you sending?</h1>
          <p className="mt-2 text-center text-sm text-stone-500">No wrong answer — tap the one you'd actually put in the post.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {([[false, 'The original', c.imageUrl!], [true, 'With them in it', cameoUrl]] as const).map(([keep, label, url]) => (
              <button key={label} type="button"
                onClick={() => { setCameoKept(keep); setPhase('signoff'); }}
                className="overflow-hidden rounded-2xl border-2 border-transparent bg-white text-left transition-all hover:border-brand/60">
                <img src={url} alt={label} crossOrigin="anonymous" className="aspect-square w-full object-cover" />
                <p className="p-3 text-center text-sm font-medium text-stone-700">{label}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (cameoBusy) {
      return (
        <div className="flex min-h-screen flex-col items-center bg-[#FBF9F5] px-6 pt-10 text-center">
          <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" />
          <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-16">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <p className="text-lg font-medium text-stone-700">Putting them into your card…</p>
            <p className="text-sm text-stone-400">Everyone from your photo, drawn in the card's own style. About half a minute.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto min-h-screen max-w-md bg-[#FBF9F5] px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <button type="button" onClick={() => setPhase('pick')} className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600">
            <ArrowLeft className="h-4 w-4" /> Back to the three
          </button>
          <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {c.imageUrl && <img src={c.imageUrl} alt="" crossOrigin="anonymous" className="aspect-square w-full object-cover" />}
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-brand">BRAND NEW — YOU'RE THE FIRST TO TRY IT</p>
        <h1 className="mt-1.5 text-xl font-semibold text-stone-800">Want them actually in the picture?</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          Add a photo — a group one works too — and we'll put them into this exact card,
          drawn in its own art style, right in the middle of things. You'll see both
          versions and choose which to keep.
        </p>
        {cameoError && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{cameoError}</p>}
        <label className="mt-6 block">
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readCameoFile(f).then(setCameoSrc);
              e.target.value = '';
            }} />
          <span className="flex h-12 w-full cursor-pointer items-center justify-center rounded-md bg-brand text-base font-semibold text-white transition-colors hover:bg-brand-dark">
            Add a photo
          </span>
        </label>
        <Button variant="outline" className="mt-3 h-12 w-full text-base" onClick={() => setPhase('signoff')}>
          Skip — keep it as it is
        </Button>
        <p className="mt-4 text-center text-xs text-stone-400">
          We save the finished card artwork to review — never your photo itself.
        </p>
        <CropDialog
          src={cameoSrc}
          autoFace={false}
          onCancel={() => setCameoSrc(null)}
          onConfirm={(bounds) => {
            const src = cameoSrc;
            setCameoSrc(null);
            if (!src) return;
            void cropToDataUrl(src, bounds).then((photo) => {
              setCameoPhoto(photo);
              return renderCameo(photo);
            }).catch(() => setCameoError('That photo wouldn’t crop — try another one.'));
          }}
        />
      </div>
    );
  }

  if (phase === 'signoff' && picked !== null && insideBusy) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-[#FBF9F5] px-6 pt-10 text-center">
        <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-lg font-medium text-stone-700">Designing the inside to match the front…</p>
          <p className="text-sm text-stone-400">Your words, set in the card’s own style — about half a minute.</p>
        </div>
      </div>
    );
  }

  if (phase === 'signoff' && picked !== null) {
    const c = cells[picked];
    return (
      <div className="mx-auto min-h-screen max-w-md bg-[#FBF9F5] px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <button type="button" onClick={() => setPhase('pick')} className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600">
            <ArrowLeft className="h-4 w-4" /> Back to the three
          </button>
          <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {c.imageUrl && <img src={cameoKept && cameoUrl ? cameoUrl : c.imageUrl} alt="" crossOrigin="anonymous" className="aspect-square w-full object-cover" />}
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-brand">FRONT CHOSEN — ONE MORE STEP</p>
        <h1 className="mt-1.5 text-xl font-semibold text-stone-800">Now the inside of the card</h1>
        <p className="mt-1 text-sm text-stone-500">Every card gets a designed inside to match its front. Choose what goes in it — we’ll set the words in the card’s own style.</p>
        <div className="mt-5">
          {/* One clear decision: accept the card's message, or write. */}
          <div className="grid grid-cols-2 gap-2">
            {c.concept.inside_text && (
              <button type="button" onClick={() => setInsideMode('ours')}
                className={`rounded-xl border p-3 text-sm font-semibold transition-colors ${insideMode === 'ours' ? 'border-brand bg-brand text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-brand/50'}`}>
                Use our message
              </button>
            )}
            <button type="button" onClick={() => setInsideMode('own')}
              className={`rounded-xl border p-3 text-sm font-semibold transition-colors ${insideMode === 'own' ? 'border-brand bg-brand text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-brand/50'} ${!c.concept.inside_text ? 'col-span-2' : ''}`}>
              Write my own
            </button>
          </div>
          {insideMode === 'ours' && c.concept.inside_text && (
            <div className="mt-3 rounded-xl border border-brand/40 bg-brand-muted/30 p-3.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand">Written for this card</span>
              <p className="mt-1 text-sm leading-snug text-stone-700">“{c.concept.inside_text}”</p>
            </div>
          )}
          <div className="mt-3 space-y-2.5">
            <Input value={dear} onChange={(e) => setDear(e.target.value)} placeholder="How you open — Dear Mum,… (optional)" className="h-11" />
            {insideMode === 'own' && (
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message…" autoFocus
                className="min-h-[88px] w-full rounded-md border border-stone-200 bg-white p-3 text-sm" />
            )}
            <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="How you sign — Love, Aidan… (optional)" className="h-11" />
          </div>
        </div>
        <Button className="mt-6 h-12 w-full text-base" onClick={() => void renderInside()} disabled={insideBusy || (insideMode === 'own' && !message.trim())}>
          {insideBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {insideBusy ? 'Designing the inside…' : 'Design the inside'}
        </Button>
      </div>
    );
  }

  if (phase === 'done' && picked !== null) {
    const c = cells[picked];
    return (
      <div className="mx-auto min-h-screen max-w-3xl bg-[#FBF9F5] px-4 py-10 text-center">
        <img src={celebraitLogo} alt="Celebrait" className="mx-auto mb-8 h-7 w-auto" />
        <h1 className="text-2xl font-semibold text-stone-800">There it is.</h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {c.imageUrl && <img src={cameoKept && cameoUrl ? cameoUrl : c.imageUrl} alt="front" crossOrigin="anonymous" className="aspect-square w-full object-cover" />}
            <p className="p-2 text-xs text-stone-400">The front</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {insideUrl && <img src={insideUrl} alt="inside" crossOrigin="anonymous" className="aspect-square w-full object-cover" />}
            <p className="p-2 text-xs text-stone-400">The inside</p>
          </div>
        </div>
        <Button className="mt-8 h-12 w-full max-w-sm animate-pulse text-base shadow-[0_0_28px_rgba(91,84,217,0.5)]" onClick={() => { setSIndex(0); setPhase('survey'); }}>
          Six quick questions — 60 seconds
        </Button>
        <p className="mt-3 text-xs text-stone-400">Your answers are the reason this preview exists.</p>
      </div>
    );
  }

  if (phase === 'survey' && submitBusy) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-[#FBF9F5] px-6 pt-10 text-center">
        <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-lg font-medium text-stone-700">Sending your answers…</p>
          <p className="text-sm text-stone-400">Your cards travel with them — just a few seconds.</p>
        </div>
      </div>
    );
  }

  if (phase === 'survey') {
    const q = survey[sIndex];
    const value = answers[q.id] ?? '';
    const isLast = sIndex === survey.length - 1;
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
          <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" />
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
        <Dots count={survey.length} at={sIndex} />
      </div>
    );
  }

  if (phase === 'thanks') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-[#FBF9F5] px-6 py-10 text-center">
        <img src={celebraitLogo} alt="Celebrait" className="mx-auto mb-8 h-7 w-auto" />
        <h1 className="text-2xl font-semibold text-stone-800">That’s genuinely useful — thank you.</h1>
        <p className="mt-3 text-sm text-stone-500">Every answer shapes what gets built next.</p>
        {setsUsed() < 2 && (
          <Button variant="outline" className="mt-8 h-11"
            onClick={() => {
              restartBrief(); setCells([]); setPicked(null); setInsideUrl(null);
              setAnswers({}); setSIndex(0); setSubmitted(false); setRegenUsed(false); resetCameo(); setCameoInSet(null);
            }}>
            Make one more
          </Button>
        )}
      </div>
    );
  }

  // ── The brief — the SAME component /make and the doorway use, so
  // every copy change lands here for free and the tester walks the
  // customer's flow exactly (Aidan 2026-09-12).
  const chips: StepChip[] = [
    ...briefQuestions.map((q) => ({ id: q, label: QUESTION_LABEL[q] })),
    { id: 'cards', label: 'Three cards', locked: true },
    { id: 'photo', label: 'Photo · optional', locked: true },
  ];
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col bg-[#FBF9F5] px-5 py-8">
      <img src={celebraitLogo} alt="Celebrait" className="mx-auto h-7 w-auto" />
      {/* NO lead-time notice here (Aidan 2026-09-12): research is not a
          live printable route — nothing gets ordered, so a delivery
          promise would be a claim we aren't making. */}
      <div className="mt-6">
        <StepChips steps={chips} current={briefStep} furthest={briefFurthest} onJump={(i) => setBriefJump(i)} />
      </div>
      <div className="mt-6 rounded-2xl border border-keeper-hair bg-white/70 p-6 backdrop-blur-sm sm:p-8">
        <BriefQuestions
          skin="landing" brief={brief} onChange={setBrief} onDone={() => void generate()}
          hideDots
          jumpTo={briefJump}
          onStepChange={(i, qs) => { setBriefStep(i); setBriefQuestions(qs); setBriefFurthest((f) => Math.max(f, i)); }}
        />
      </div>
    </div>
  );
}
