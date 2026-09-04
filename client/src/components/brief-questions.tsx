// client/src/components/brief-questions.tsx — THE BRIEF, ONE QUESTION AT A TIME
//
// The research maker's questions (who → celebration → age → vibe → one
// thing → can't stand → name), one per screen, as a component with two
// skins: 'landing' (the doorway hero — white pills on paper, so the
// questions swap in place under the headline) and 'studio' (inside the
// builder's panel). Aidan 2026-09-02: "keep the initial journey on one
// page, one question at a time but it changes as they click." The brief
// itself round-trips through the URL (briefToSearch / readBriefFromSearch)
// so refresh, back and the hand-off to /make all carry it.

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { OCCASION_ICON } from '@/components/studio/steps/recipient-step';
import { OCCASION_OPTIONS, getOccasionLabel } from '@/components/studio/scene-presets';

// ── the brief ────────────────────────────────────────────────────────
export type Vibe = 'funny' | 'warm' | 'rude' | 'mix';
export interface Brief {
  who: string; gender: 'him' | 'her' | null; occasion: string; age: string;
  vibe: Vibe; thing: string; cant: string; name: string;
}
export const emptyBrief = (): Brief => ({ who: '', gender: null, occasion: '', age: '', vibe: 'mix', thing: '', cant: '', name: '' });

export const VIBE_LABEL: Record<Vibe, string> = { mix: 'One of each', funny: 'All funny', warm: 'All warm', rude: 'Cheekier' };
/** Customer-facing labels only — the engine still receives funny/warm/rude/mix. */
const VIBE_META: Record<Vibe, { label: string; sub: string }> = {
  funny: { label: 'Light humour', sub: 'a good laugh, kindly meant' },
  warm: { label: 'Warm', sub: 'heartfelt — the kind they keep' },
  rude: { label: 'Cheeky', sub: 'proper swearing, tastefully starred out' },
  mix: { label: 'One of each', sub: 'three cards, three vibes — you choose after' },
};
const VIBES: Vibe[] = ['mix', 'funny', 'warm', 'rude'];
const DISLIKE_ON: Vibe[] = ['funny', 'rude', 'mix'];
export const RECIPIENTS: Array<{ label: string; implies?: 'him' | 'her' }> = [
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
/** A deliberate mix of short and long — a word works, and so does a whole little story. */
const PLACEHOLDERS = ['fishing', 'just passed her driving test', 'Man United', 'a Barbie-themed party', 'her allotment', 'Ibiza with the girls in June', 'Toy Story', '30 years of questionable golf'];
/** The studio's occasion picker: four up front, the rest behind More, and Other as free text. */
const PRIMARY_OCCASIONS: readonly string[] = ['birthday', 'christmas', 'anniversary', 'wedding'];
const VIBE_SET = new Set<string>(VIBES);

export function readBriefFromSearch(search: string): Brief {
  const q = new URLSearchParams(search);
  const who = q.get('who') ?? '';
  const g = q.get('gender');
  const v = q.get('vibe') ?? '';
  return {
    who,
    gender: g === 'him' || g === 'her' ? g : (RECIPIENTS.find((r) => r.label === who)?.implies ?? null),
    occasion: (q.get('occasion') ?? '').toLowerCase().slice(0, 40),
    age: (q.get('age') ?? '').replace(/\D/g, '').slice(0, 3),
    vibe: VIBE_SET.has(v) ? (v as Vibe) : 'mix',
    thing: (q.get('thing') ?? '').slice(0, 80),
    cant: (q.get('cant') ?? '').slice(0, 60),
    name: (q.get('name') ?? '').slice(0, 40),
  };
}
export function briefToSearch(b: Brief): string {
  const q = new URLSearchParams();
  if (b.who) q.set('who', b.who);
  if (b.gender) q.set('gender', b.gender);
  if (b.occasion) q.set('occasion', b.occasion);
  if (b.age) q.set('age', b.age);
  if (b.vibe !== 'mix') q.set('vibe', b.vibe);
  if (b.thing) q.set('thing', b.thing);
  if (b.cant) q.set('cant', b.cant);
  if (b.name) q.set('name', b.name);
  return q.toString();
}
export const ageOf = (b: Brief): number | null => { const n = parseInt(b.age, 10); return Number.isInteger(n) && n >= 1 && n <= 110 ? n : null; };
export const isKidBrief = (b: Brief) => { const a = ageOf(b); return a !== null && a < 18; };
const isKnownOccasion = (o: string) => (OCCASION_OPTIONS as readonly string[]).includes(o);
export function occasionLabelFor(b: Brief): string {
  if (b.occasion === 'birthday' || !b.occasion) { const a = ageOf(b); return a ? `${a}th Birthday` : 'Birthday'; }
  return isKnownOccasion(b.occasion) ? getOccasionLabel(b.occasion) : b.occasion.trim();
}
/** Enough to generate: who, and a real occasion. */
export const isBriefComplete = (b: Brief) => b.who.trim().length > 0 && b.occasion.trim().length > 0 && b.occasion !== 'other';

export type QuestionKey = 'who' | 'occasion' | 'age' | 'vibe' | 'interest' | 'dislike' | 'name';
/** The research maker's order; occasion after who; age on EVERY
 *  occasion (Aidan 2026-09-03: it arms the kids register and switches
 *  Cheeky off under 18, which matters at Christmas as much as a
 *  birthday); dislike only when there's humour to feed. */
export function questionsFor(b: Brief): QuestionKey[] {
  const q: QuestionKey[] = ['who', 'occasion', 'age', 'vibe', 'interest'];
  if (DISLIKE_ON.includes(b.vibe)) q.push('dislike');
  q.push('name');
  return q;
}

// ── two skins ────────────────────────────────────────────────────────
type Skin = 'landing' | 'studio';
const SKIN = {
  landing: {
    h1: 'text-[17px] font-medium text-keeper-ink',
    sub: 'mt-1 text-[14px] text-keeper-body',
    chip: (on: boolean) => `rounded-full border px-4 py-2.5 text-[15px] font-medium shadow-[0_1px_2px_rgba(33,29,25,0.05)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-keeper-gold ${on ? 'border-keeper-gold bg-keeper-gold-wash text-keeper-gold-deep' : 'border-keeper-hair bg-white/80 text-keeper-ink hover:border-keeper-gold hover:bg-keeper-gold-wash hover:text-keeper-gold-deep'}`,
    tile: (on: boolean) => `relative flex items-center gap-3 text-left p-3 rounded-xl border transition-colors ${on ? 'border-keeper-gold bg-keeper-gold-wash' : 'border-keeper-hair bg-white/80 hover:border-keeper-gold'}`,
    tileIcon: (on: boolean) => `flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${on ? 'bg-keeper-gold text-white' : 'bg-keeper-gold-wash text-keeper-gold'}`,
    tick: 'ml-auto w-5 h-5 rounded-full bg-keeper-gold text-white flex items-center justify-center shrink-0',
    input: 'h-12 rounded-full border-keeper-hair bg-white/90 px-4 text-[15px] focus-visible:border-keeper-gold focus-visible:ring-keeper-gold/20',
    helper: 'mt-2 text-[12.5px] text-keeper-meta',
    next: 'inline-flex items-center gap-1.5 rounded-full bg-keeper-ink px-5 py-2.5 text-sm font-semibold text-keeper-paper transition-colors hover:bg-black disabled:opacity-40 disabled:pointer-events-none',
    done: 'inline-flex items-center gap-2 rounded-full bg-keeper-ink px-5 py-2.5 text-sm font-semibold text-keeper-paper transition-colors hover:bg-black disabled:opacity-40 disabled:pointer-events-none',
    doneIcon: 'h-4 w-4 text-cta',
    back: 'inline-flex items-center gap-1 text-sm text-keeper-meta transition-colors hover:text-keeper-ink',
    skip: 'text-sm text-keeper-meta underline decoration-keeper-hair underline-offset-4 transition-colors hover:text-keeper-ink',
    dotOn: 'w-6 bg-keeper-gold', dotOff: 'w-1.5 bg-keeper-hair',
    warn: 'mt-2 text-xs font-medium text-accent-red-dark',
  },
  studio: {
    h1: 'text-xl sm:text-2xl font-display font-bold tracking-[-0.015em] text-keeper-ink',
    sub: 'mt-1 text-sm text-keeper-body',
    chip: (on: boolean) => `rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${on ? 'bg-brand text-brand-foreground' : 'bg-stone-100 text-keeper-body hover:bg-stone-200'}`,
    tile: (on: boolean) => `relative flex items-center gap-3 text-left p-3 rounded-xl border-2 transition-all ${on ? 'border-brand bg-brand-muted shadow-sm' : 'border-keeper-hair hover:border-brand hover:bg-brand-muted/40 bg-white'}`,
    tileIcon: (on: boolean) => `flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${on ? 'bg-brand text-brand-foreground' : 'bg-keeper-gold-wash text-keeper-gold'}`,
    tick: 'ml-auto w-5 h-5 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0 shadow-sm',
    input: 'text-base border-brand-light focus-visible:border-brand focus-visible:ring-brand/20',
    helper: 'mt-1.5 text-[11px] text-keeper-meta',
    next: 'inline-flex items-center gap-1.5 rounded-full bg-go px-5 py-2.5 text-sm font-semibold text-go-foreground transition-colors hover:bg-go-hover disabled:opacity-50 disabled:pointer-events-none',
    done: 'inline-flex items-center justify-center gap-2 bg-cta hover:bg-cta-hover text-cta-foreground rounded-full px-5 py-2.5 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none',
    doneIcon: 'w-4 h-4',
    back: 'inline-flex items-center gap-1 text-sm text-keeper-body hover:text-keeper-ink',
    skip: 'text-sm text-brand hover:text-brand-dark underline underline-offset-4',
    dotOn: 'w-6 bg-brand', dotOff: 'w-1.5 bg-stone-200',
    warn: 'mt-2 text-xs font-medium text-accent-red-dark',
  },
} as const;

interface BriefQuestionsProps {
  brief: Brief;
  onChange: (b: Brief) => void;
  /** The last question's button — fires with the finished brief. */
  onDone: (b: Brief) => void;
  skin: Skin;
  /** Which question to open on (e.g. 1 when "who" arrived answered). */
  initialStep?: number;
  doneLabel?: string;
  /** The landing hero keeps the lead short; the studio panel can breathe. */
  compact?: boolean;
}

export function BriefQuestions({ brief, onChange, onDone, skin, initialStep = 0, doneLabel = 'Write their three cards', compact = false }: BriefQuestionsProps) {
  const s = SKIN[skin];
  const [qIndex, setQIndex] = useState(initialStep);
  const [showMore, setShowMore] = useState(false);
  const [otherText, setOtherText] = useState(() => (brief.occasion && !isKnownOccasion(brief.occasion) ? brief.occasion : ''));
  const [placeholder] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);

  const questions = useMemo(() => questionsFor(brief), [brief.occasion, brief.vibe]); // eslint-disable-line react-hooks/exhaustive-deps
  const idx = Math.min(qIndex, questions.length - 1);
  const question = questions[idx];
  const isLast = idx === questions.length - 1;
  const isKid = isKidBrief(brief);
  const set = (patch: Partial<Brief>) => onChange({ ...brief, ...patch });
  const canNext = question === 'who' ? brief.who.trim().length > 0 : question === 'occasion' ? isBriefComplete(brief) : true;
  const optionalQ = question === 'age' || question === 'interest' || question === 'dislike' || question === 'name';
  const next = () => { if (!isLast) setQIndex(idx + 1); else onDone(brief); };
  const back = () => { if (idx > 0) setQIndex(idx - 1); };

  const isOtherPicked = brief.occasion === 'other' || (!!brief.occasion && !isKnownOccasion(brief.occasion));
  const moreOccasions = OCCASION_OPTIONS.filter((o) => !PRIMARY_OCCASIONS.includes(o) && o !== 'other');
  const showMoreRow = showMore || isOtherPicked || (!!brief.occasion && !PRIMARY_OCCASIONS.includes(brief.occasion));
  const occasionTile = (o: string, labelText: string, Icon: typeof OCCASION_ICON[string] | undefined, on: boolean, onPick: () => void) => (
    <button key={o} type="button" onClick={onPick} className={s.tile(on)}>
      {Icon && <span className={s.tileIcon(on)}><Icon className="w-[18px] h-[18px]" strokeWidth={1.75} /></span>}
      <span className="text-sm font-medium text-keeper-ink truncate">{labelText}</span>
      {on && <span className={s.tick}><Check className="w-3 h-3" strokeWidth={3} /></span>}
    </button>
  );
  const optionalTag = <span className="ml-2 align-middle text-xs font-normal text-keeper-meta">optional</span>;
  const occasionWord = occasionLabelFor(brief).toLowerCase();

  return (
    <div className={compact ? 'min-h-[300px] flex flex-col' : 'flex flex-col'}>
      <div className="flex-1">
        {question === 'who' && (
          <>
            <p className={s.h1}>{skin === 'landing' ? "Start here — who's it for?" : "Right — who's the card for?"}</p>
            <p className={`${s.sub} mb-4`}>{skin === 'landing' ? 'Tap one. We write and illustrate three original cards for them in about a minute. Pick your favourite, add your words, and we print and post it.' : 'Three original cards, written and drawn for one person.'}</p>
            <div className="flex flex-wrap gap-2">
              {RECIPIENTS.map((r) => (
                <button key={r.label} type="button" className={s.chip(brief.who === r.label)} onClick={() => { const b = { ...brief, who: r.label, gender: r.implies ?? null }; onChange(b); if (!AMBIGUOUS.has(r.label)) setQIndex(idx + 1); }}>{r.label}</button>
              ))}
            </div>
            {brief.who && AMBIGUOUS.has(brief.who) && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-keeper-body">
                for a…
                {(['him', 'her'] as const).map((g) => <button key={g} type="button" className={s.chip(brief.gender === g)} onClick={() => set({ gender: brief.gender === g ? null : g })}>{g}</button>)}
                <button type="button" className={s.chip(brief.gender === null)} onClick={() => set({ gender: null })}>not saying</button>
              </div>
            )}
          </>
        )}

        {question === 'occasion' && (
          <>
            <p className={s.h1}>What's the celebration{brief.who && brief.who !== 'Someone else' ? ` for ${brief.who}` : ''}?</p>
            <p className={`${s.sub} mb-4`}>The occasion shapes everything — the jokes, the look, the words inside.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRIMARY_OCCASIONS.map((o) => occasionTile(o, getOccasionLabel(o), OCCASION_ICON[o], brief.occasion === o, () => { set({ occasion: o }); setQIndex(idx + 1); }))}
            </div>
            {!showMoreRow && (
              <button type="button" onClick={() => setShowMore(true)} className={`${s.skip} mt-3 inline-flex items-center gap-1`}>More occasions <ChevronDown className="w-4 h-4" /></button>
            )}
            {showMoreRow && (
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {moreOccasions.map((o) => occasionTile(o, getOccasionLabel(o), OCCASION_ICON[o], brief.occasion === o, () => { set({ occasion: o }); setQIndex(idx + 1); }))}
                {occasionTile('other', 'Something else', OCCASION_ICON.other, isOtherPicked, () => set({ occasion: otherText.trim() || 'other' }))}
              </div>
            )}
            {isOtherPicked && (
              <Input value={otherText} autoFocus onChange={(e) => { const v = e.target.value.slice(0, 40); setOtherText(v); set({ occasion: v.trim() || 'other' }); }}
                placeholder="Type the occasion… e.g. Retirement, New home" className={`${s.input} mt-3`} />
            )}
          </>
        )}

        {question === 'age' && (
          <>
            {brief.occasion === 'birthday' ? (
              <>
                <p className={s.h1}>How old {brief.who && brief.who !== 'Someone else' ? `is ${brief.who}` : 'are they'} turning?{optionalTag}</p>
                <p className={s.sub}>The age does two jobs: it tunes the whole card — the jokes, the references, the look — and if it's a big one (18, 21, 30, 40…) the number itself becomes the star. Skip it and everything stays completely age-free.</p>
              </>
            ) : (
              <>
                <p className={s.h1}>How old {brief.who && brief.who !== 'Someone else' ? `is ${brief.who}` : 'are they'}?{optionalTag}</p>
                <p className={s.sub}>Roughly is fine. It tunes the whole card — the jokes, the references, the look — and under 18 keeps everything kid-safe. Skip it and everything stays completely age-free.</p>
              </>
            )}
            <Input value={brief.age} onChange={(e) => set({ age: e.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" placeholder="Their age" className={`${s.input} mt-5 h-14 text-center text-2xl max-w-[220px]`} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') next(); }} />
          </>
        )}

        {question === 'vibe' && (
          <>
            <p className={s.h1}>What's the vibe?</p>
            <p className={`${s.sub} mb-4`}>You'll see three cards either way — this sets what they lean towards.</p>
            <div className="space-y-2.5">
              {VIBES.map((t) => {
                const off = t === 'rude' && isKid;
                return (
                  <button key={t} type="button" disabled={off} onClick={() => { set({ vibe: t }); setQIndex(idx + 1); }} className={`${s.tile(brief.vibe === t)} w-full disabled:opacity-40`}>
                    <span className="min-w-0"><span className="block text-sm font-medium text-keeper-ink">{VIBE_META[t].label}</span><span className="block text-xs text-keeper-meta">{off ? 'off for under-18s' : VIBE_META[t].sub}</span></span>
                    {brief.vibe === t && <span className={s.tick}><Check className="w-3 h-3" strokeWidth={3} /></span>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {question === 'interest' && (
          <>
            <p className={s.h1}>What's one thing you want the card to mention?{optionalTag}</p>
            <p className={s.sub}>A passion, a place, a plan, a party theme, a claim to fame, a running joke — whatever you'd bring up first about them. The more specific, the better the card.</p>
            <Input value={brief.thing} onChange={(e) => set({ thing: e.target.value.slice(0, 80) })} placeholder={placeholder} className={`${s.input} mt-5`} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') next(); }} />
            <p className={s.helper}>Or skip it — we'll make it a beautiful {occasionWord} card, no homework.</p>
          </>
        )}

        {question === 'dislike' && (
          <>
            <p className={s.h1}>Anything they can't stand?{optionalTag}</p>
            <p className={s.sub}>This one's pure joke fuel. Tell us the thing — the rival team, mornings, oat milk, slow walkers — and one of your three cards will be built around it: making light of the thing they hate, never of them. Some of our funniest cards start here.</p>
            <Input value={brief.cant} onChange={(e) => set({ cant: e.target.value.slice(0, 60) })} placeholder="The rival team / mornings / slow walkers" className={`${s.input} mt-5`} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') next(); }} />
          </>
        )}

        {question === 'name' && (
          <>
            <p className={s.h1}>Want their name on the front?{optionalTag}</p>
            <p className={s.sub}>We'll design it in properly — one of the cards will make it the artwork.</p>
            <Input value={brief.name} onChange={(e) => set({ name: e.target.value.slice(0, 40) })} placeholder="Their first name" className={`${s.input} mt-5`} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') next(); }} />
            {brief.name.trim() && <p className={s.warn}>It'll be printed exactly as you type it — worth a double-check.</p>}
            <p className={`${s.helper} mt-4`}>Got a photo of them handy? After you pick your favourite, we can put them right in the card.</p>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {idx > 0 ? <button type="button" onClick={back} className={s.back}><ChevronLeft className="w-4 h-4" /> Back</button> : <span />}
          {optionalQ && !isLast && <button type="button" onClick={next} className={s.skip}>Skip this one</button>}
        </div>
        {isLast
          ? <button type="button" disabled={!canNext} onClick={next} className={s.done}><Sparkles className={s.doneIcon} strokeWidth={1.75} /> {doneLabel}</button>
          : (question !== 'who' && question !== 'occasion' && question !== 'vibe') || canNext
            ? <button type="button" disabled={!canNext} onClick={next} className={s.next}>Next <ChevronRight className="w-4 h-4" /></button>
            : <span />}
      </div>
      <div className="flex gap-1.5 pt-5">
        {questions.map((q, i) => <span key={q} className={`h-1.5 rounded-full transition-all ${i === idx ? s.dotOn : s.dotOff}`} />)}
      </div>
    </div>
  );
}
