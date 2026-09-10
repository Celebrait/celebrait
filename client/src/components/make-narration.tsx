// client/src/components/make-narration.tsx
//
// The three-card route's wait, in words (Aidan 2026-09-08: "better
// signals for the user in the form of words… tailored to what the user
// inputted… like it's thinking and crafting"). The studio's narration
// pattern (components/studio/narration-copy.ts), built from the BRIEF
// instead of a draft: who, occasion, age, vibe, the thing they love, the
// thing they can't stand. Two acts, driven by what's actually happening:
//
//   writing  — the concepts call is out. Beats read the brief back and
//              think aloud about it.
//   drawing  — the three concepts are in, so we can quote the very lines
//              being drawn ("Drawing ‘Forty. Still not a grown-up.’").
//              The parent reports each front as it lands; that shows as
//              a count in words, not tiles.
//
// A clock runs underneath. Past the usual time the copy says so, plainly,
// before the page's own ceilings turn it into a failure.

import { useEffect, useMemo, useState } from 'react';
import { whoPhrase, whoIsName, type Brief } from '@/components/brief-questions';

export type BeatPart =
  | { kind: 'plain'; text: string }
  | { kind: 'name'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'em'; text: string };
export interface Beat { id: string; parts: BeatPart[] }

const plain = (text: string): BeatPart => ({ kind: 'plain', text });
const name = (text: string): BeatPart => ({ kind: 'name', text });
const quote = (text: string): BeatPart => ({ kind: 'quote', text });
const em = (text: string): BeatPart => ({ kind: 'em', text });

function trim(raw: string, max = 56): string {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max - 16 ? cut.slice(0, sp) : cut).trim() + '…';
}
export interface ConceptLine { front_text: string; palette?: string }

export interface MakeNarrationInput {
  brief: Brief;
  /** Age parsed from the brief, if any. */
  age: number | null;
  /** The occasion as the page labels it ("Birthday", "40th Birthday", "Anniversary"). */
  occasionLabel: string;
}

/** Act one — reading the brief back, thinking aloud. Every beat names a
 *  choice the visitor actually made; beats for choices they skipped are
 *  left out rather than faked. */
/** The recipient as a beat part: a real name (or Mum/Dad) in violet,
 *  a role ("your partner") in plain text, "them" when we know nothing. */
function whoPart(brief: Brief): BeatPart {
  const p = whoPhrase(brief);
  return p === 'them' ? plain('them') : whoIsName(brief) ? name(p) : plain(p);
}

export function writingBeats({ brief, age, occasionLabel }: MakeNarrationInput): Beat[] {
  const who = brief.who.trim();
  const hasName = whoPhrase(brief) !== 'them';
  const nm = (): BeatPart => whoPart(brief);
  const thing = brief.thing.trim();
  const cant = brief.cant.trim();
  const occ = occasionLabel.replace(/^\d+(st|nd|rd|th)\s+/i, '').toLowerCase();
  const isBirthday = /birthday/i.test(occasionLabel);
  const beats: Beat[] = [];

  // Opening: the occasion and the person.
  beats.push({
    id: 'open',
    parts: occ && hasName
      ? [plain('Right. A '), em(occ), plain(' card for '), nm(), plain('.')]
      : occ ? [plain('Right. A '), em(occ), plain(' card. Let’s do this properly.')]
        : hasName ? [plain('Right. A card for '), nm(), plain('.')] : [plain('Right. Reading the brief.')],
  });

  // Who they are to you — the relationship shapes the voice.
  if (who && brief.name.trim()) {
    beats.push({ id: 'who', parts: [plain('Your '), em(who.toLowerCase()), plain('. So the voice can be a bit closer than a shop card’s.')] });
  }

  // Age — said like a person would say it.
  if (age !== null) {
    let tail: string;
    if (age < 13) tail = 'A big number when you’re that size.';
    else if (age < 18) tail = 'So: nothing that reads as a kid’s card.';
    else if (age === 18 || age === 21) tail = 'The proper one.';
    else if (age % 10 === 0) tail = 'A big one — the card should know it.';
    else if (age >= 80) tail = 'That earns some respect on the front.';
    else tail = 'Not a round number, so the card has to earn its own laugh.';
    beats.push({ id: 'age', parts: [plain(isBirthday ? `Turning ${age}. ` : `${age} years old. `), plain(tail)] });
  }

  // The thing they love — the whole card hangs off this.
  if (thing) {
    beats.push({ id: 'thing', parts: [plain('So, '), quote(trim(thing)), plain('. Working out what’s true about it, not just what’s obvious.')] });
    beats.push({ id: 'thing2', parts: [plain('Looking for the detail only someone who knows '), nm(), plain(' would spot.')] });
  }

  // The thing they can't stand — a joke waiting to happen.
  if (cant) {
    beats.push({ id: 'cant', parts: [plain('And '), quote(trim(cant)), plain(' — noted. That might land a joke on one of them.')] });
  }

  // The vibe.
  const vibe: Record<Brief['vibe'], BeatPart[]> = {
    funny: [plain('Aiming for the laugh, not the eye-roll.')],
    warm: [plain('Warm, not soppy. There’s a line, and we’re staying on the right side of it.')],
    rude: [plain('Cheeky — the kind you’d still put on the mantelpiece.')],
    mix: [plain('One funny, one warm, one a bit cheeky. You’ll choose.')],
  };
  beats.push({ id: 'vibe', parts: vibe[brief.vibe] });

  beats.push({ id: 'write', parts: [plain('Writing three fronts that don’t sound like each other.')] });
  beats.push({ id: 'cut', parts: [plain('Binning anything a card shop would have printed already.')] });
  beats.push({ id: 'again', parts: hasName ? [plain('Reading them back as '), nm(), plain(' would.')] : [plain('Reading them back as they would.')] });
  return beats;
}

/** Act two — the words are in, so quote them while they're drawn. */
export function drawingBeats({ brief }: MakeNarrationInput, concepts: ConceptLine[]): Beat[] {
  const hasName = whoPhrase(brief) !== 'them';
  const nm = (): BeatPart => whoPart(brief);
  const thing = brief.thing.trim();
  const beats: Beat[] = [{ id: 'in', parts: [plain('The words are in. Now the pictures.')] }];
  concepts.forEach((c, i) => {
    if (c.front_text?.trim()) beats.push({ id: `draw${i}`, parts: [plain('Drawing '), quote(trim(c.front_text).replace(/[.!?…]+$/, '')), plain('.')] });
  });
  const pal = concepts.map((c) => c.palette?.trim()).find((p) => p && p.length <= 48);
  if (pal) beats.push({ id: 'pal', parts: [plain('Colours: '), em(pal.toLowerCase()), plain('.')] });
  else if (thing) beats.push({ id: 'pal', parts: [plain('Colours from the world of '), quote(trim(thing, 32)), plain('.')] });
  beats.push({ id: 'letters', parts: [plain('Getting the lettering to sit right — it’s half the joke.')] });
  beats.push({ id: 'front', parts: hasName ? [plain('Making sure '), nm(), plain(`${whoPhrase(brief).endsWith('s') ? '’' : '’s'} front is one you’d actually pick up.`)] : [plain('Making sure each front is one you’d actually pick up.')] });
  // The photo comes after the pick on this route — say so while they wait.
  beats.push({ id: 'photo', parts: [plain('Once you’ve picked, a photo puts '), nm(), plain(' right in it. Optional. Worth it.')] });
  return beats;
}

/** How many fronts are done, in words. */
export function landedLine(landed: number, total = 3): string | null {
  if (landed <= 0) return null;
  if (landed >= total) return 'All three done. Just tidying.';
  if (landed === 1) return 'First one’s done. Two still drawing.';
  return 'Two done. Last one’s on its way.';
}

/** Honest words for a wait that has outrun the usual. */
export function slowLine(elapsedS: number): string | null {
  if (elapsedS < 75) return null;
  if (elapsedS < 110) return 'Taking a touch longer than usual. Still drawing — nothing’s stuck.';
  return 'Slower than normal today. We’ll keep at it a little longer, then tell you straight if it isn’t happening.';
}

// ── rendering ─────────────────────────────────────────────────────────

const BEAT_MS = 4600;

function BeatText({ beat }: { beat: Beat }) {
  return (
    <>
      {beat.parts.map((p, i) => {
        if (p.kind === 'name') return <span key={i} className="italic text-brand">{p.text}</span>;
        if (p.kind === 'quote') return <span key={i} className="italic text-keeper-ink">‘{p.text}’</span>;
        if (p.kind === 'em') return <span key={i} className="font-medium text-keeper-ink">{p.text}</span>;
        return <span key={i}>{p.text}</span>;
      })}
    </>
  );
}

interface MakeNarrationProps {
  input: MakeNarrationInput;
  /** Null while the concepts are still being written. */
  concepts: ConceptLine[] | null;
  /** Fronts finished so far (only meaningful once concepts exist). */
  landed: number;
  /** Seconds since the wait began. */
  elapsedS: number;
}

export function MakeNarration({ input, concepts, landed, elapsedS }: MakeNarrationProps) {
  const act: 'writing' | 'drawing' = concepts ? 'drawing' : 'writing';
  const beats = useMemo(() => (concepts ? drawingBeats(input, concepts) : writingBeats(input)), [input, concepts]);
  const [i, setI] = useState(0);
  // New act → start from its first beat.
  useEffect(() => { setI(0); }, [act]);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1 < beats.length ? n + 1 : beats.length - 1)), BEAT_MS);
    return () => window.clearInterval(t);
  }, [beats.length, act]);
  const beat = beats[Math.min(i, beats.length - 1)];
  const count = concepts ? landedLine(landed) : null;
  const slow = slowLine(elapsedS);

  return (
    <div className="flex w-full flex-col items-center gap-3 text-center" aria-live="polite">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-keeper-meta">{act === 'writing' ? 'Writing' : 'Drawing'}</p>
      {/* Keyed remounts with a CSS enter animation, not an exit-then-enter
          pair: a throttled tab (or the browser pane) can stall exit
          animations, and the words must never freeze on a stale beat. */}
      <div className="relative min-h-[3.25rem] w-full max-w-[460px]">
        <p key={`${act}:${beat.id}`} className="animate-in fade-in slide-in-from-bottom-1 duration-300 font-display text-[19px] leading-snug text-keeper-body sm:text-[21px]">
          <BeatText beat={beat} />
        </p>
      </div>
      {(count || slow) && (
        <div key={`${count ?? ''}|${slow ?? ''}`} className="animate-in fade-in duration-300 space-y-1">
          {count && <p className="text-[13px] font-medium text-keeper-ink">{count}</p>}
          {slow && <p className="max-w-[420px] text-[13px] leading-relaxed text-keeper-meta">{slow}</p>}
        </div>
      )}
    </div>
  );
}
