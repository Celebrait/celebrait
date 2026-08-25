// client/src/pages/research-photo.tsx — F&F RESEARCH, THE PHOTO ROUTE
//
// The companion to /research (Aidan, 2026-08-25): same keyed link, but
// testers walk the REAL photo studio — real signup, real free-card
// offer, the product exactly as it ships — in another tab, then come
// back here for the questions. Deliberately touches ZERO studio code:
// the studio is the thing being tested, not a thing to rebuild.
//
// The survey differs from the maker's by one question: likeness —
// the only question that matters uniquely on this route. The keyed
// link silently mints a throwaway session, so testers land in the
// real studio with no sign-up screen and no email asked.

import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import celebraitLogo from '@/assets/celebrait.webp';

const key = () => new URLSearchParams(window.location.search).get('k') ?? '';

interface SurveyQ {
  id: string;
  title: string;
  kind: 'choice' | 'text';
  options?: string[];
  sub?: string;
  optional?: boolean;
}
const SURVEY: SurveyQ[] = [
  { id: 'likeness', title: 'Honestly — did the card actually look like them?', kind: 'choice', options: ['Spot on', 'Close enough', 'Not really', 'Not at all'] },
  { id: 'would_send', title: 'Would you have sent that card to a real person?', kind: 'choice', options: ['Yes, exactly as it is', 'Yes, with a tweak or two', 'No'] },
  { id: 'expected_price', title: 'What would you expect to pay for it, printed and posted to their door?', kind: 'text', sub: 'Whatever number feels right — there’s no wrong answer.' },
  { id: 'price_feel', title: 'It’s £5.99 + postage. How does that feel?', kind: 'choice', options: ['Bargain', 'Fair', 'A bit steep', 'Wouldn’t pay that'] },
  { id: 'friction', title: 'Did anything nearly stop you, or annoy you along the way?', kind: 'text', optional: true },
  { id: 'vs_market', title: 'Compared to Moonpig or Thortful, this is…', kind: 'choice', options: ['Much better', 'A bit better', 'About the same', 'Worse'] },
];

type Phase = 'welcome' | 'survey' | 'thanks';

export default function ResearchPhotoPage() {
  const [phase, setPhase] = useState<Phase>('welcome');
  const [opening, setOpening] = useState(false);

  /** Silent session mint, then the real studio in a new tab — the
   *  tester never sees a sign-up screen. */
  const openStudio = async () => {
    setOpening(true);
    try {
      const r = await fetch('/api/research/photo/session', {
        method: 'POST',
        headers: { 'x-research-key': key() },
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'Could not open the maker — try again');
      window.open('/studio', '_blank');
    } catch (e: any) {
      alert(e?.message ?? 'Could not open the maker — try again');
    } finally {
      setOpening(false);
    }
  };
  const [linkOk, setLinkOk] = useState<boolean | null>(null);
  const [sIndex, setSIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [testerName, setTesterName] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/research/ping`, { headers: { 'x-research-key': key() } })
      .then((r) => setLinkOk(r.ok))
      .catch(() => setLinkOk(true));
  }, []);

  const submit = async (finalAnswers: Record<string, string>, nameForRow: string) => {
    if (submitted) { setPhase('thanks'); return; }
    setSubmitBusy(true);
    try {
      const r = await fetch('/api/research/response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-research-key': key() },
        body: JSON.stringify({
          tester_name: nameForRow.trim() || undefined,
          brief: { route: 'photo' },
          answers: finalAnswers,
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'Could not save — try once more?');
      setSubmitted(true);
      setPhase('thanks');
    } catch (e: any) {
      alert(e?.message ?? 'Could not save your answers — try once more?');
    } finally {
      setSubmitBusy(false);
    }
  };

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
        <h1 className="mt-8 text-2xl font-semibold text-stone-800">Thank you for testing the photo card maker.</h1>
        <p className="mt-4 text-sm leading-relaxed text-stone-600">
          This one’s our headline act: you upload a photo of someone, and we turn them into
          the star of a hand-illustrated card — them, their world, their moment.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          The card maker opens in a new tab, ready to go — no account, no sign-up, nothing to
          fill in. Make a card, open it up, have a proper look.
          <span className="font-medium text-stone-700"> No need to order anything.</span> Then
          come back to this tab — six quick questions will be waiting.
        </p>
        <Button className="mt-8 h-12 w-full text-base" disabled={opening} onClick={() => void openStudio()}>
          {opening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Open the card maker <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" className="mt-3 h-11 w-full" onClick={() => { setSIndex(0); setPhase('survey'); }}>
          I’ve made my card — ask away
        </Button>
        <p className="mt-6 text-xs text-stone-400">
          Friends &amp; family preview — we’ll keep your answers, to make Celebrait better.
          Thank you for taking the time.
        </p>
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
            : <button type="button" onClick={() => setPhase('welcome')} className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600"><ArrowLeft className="h-4 w-4" /> Back</button>}
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
        <div className="flex justify-center gap-1.5 pt-6">
          {SURVEY.map((qq, i) => (
            <span key={qq.id} className={`h-1.5 rounded-full transition-all ${i === sIndex ? 'w-6 bg-brand' : 'w-1.5 bg-stone-200'}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-[#FBF9F5] px-6 py-10 text-center">
      <img src={celebraitLogo} alt="Celebrait" className="mx-auto mb-8 h-7 w-auto" />
      <h1 className="text-2xl font-semibold text-stone-800">That’s genuinely useful — thank you.</h1>
      <p className="mt-3 text-sm text-stone-500">Every answer shapes what gets built next.</p>
    </div>
  );
}
