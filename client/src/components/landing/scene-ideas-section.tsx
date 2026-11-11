// client/src/components/landing/scene-ideas-section.tsx — "A few words
// will do." A short FILM of the scene-ideas helper ending on a real card
// (third build, 2026-11-12).
//
// History, so nobody rebuilds a rejected version:
//   v1  a wall of ready-made scenes that pre-filled the maker. Aidan: "I
//       would not allow the click to render the scene description", and
//       the heading ("Stuck for a scene? Steal one.") was "rubbish".
//   v2  the maker's "Get scene ideas" box copied at full size, playing on
//       a loop. Aidan: "flat and static and feels usable on the page" —
//       a real-size text box and button look like a working form, and
//       words turning into more words has no payoff.
//   v3  (this) the same helper, but inside a PHONE FRAME so it reads as a
//       demo and not a form, and with an ending: a few words → three
//       scenes → one picked → one of our REAL cards. The three steps
//       beside it light up in time, so the still frame explains itself.
//
// Nothing here is interactive and nothing calls the model. The typed
// words and the three suggestions are re-enacted (and say so under the
// phone); the card at the end is a real Celebrait card. The helper being
// demonstrated IS open to signed-out visitors, one screen into the maker.
//
// At rest (first paint, off screen, reduced motion) it shows the ENDING
// of the first film — typed words, chosen scene, finished card — so no
// one ever sees an empty phone. The loop runs only while on screen.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { Rise } from '@/components/landing/rise';
import { DISPLAY, EYEBROW } from '@/pages/doorway';

interface Film {
  who: string;
  /** What gets typed. Fragments, lowercase, like a real brief. */
  brief: string;
  /** The three suggestions. The FIRST is the one that gets picked, and
   *  it must describe the real card below. */
  ideas: [string, string, string];
  card: string;
  cardAlt: string;
  source: string;
  caption: string;
}

// Both endings are real cards already on this site (the scenes row). No
// logos or badges on either, which is why the Wembley card isn't here.
const FILMS: Film[] = [
  {
    who: 'Rach',
    brief: 'loves a dare, London, her 30th',
    ideas: [
      'Rach and Lulu abseiling off Big Ben at sunset, grinning.',
      'Rach and Lulu zip-lining over the Thames in party hats.',
      'Rach and Lulu on the roof of a London bus, confetti cannons going off.',
    ],
    card: '/proof-bigben-front.webp',
    cardAlt: 'The finished card: Rach and Lulu abseiling off Big Ben',
    source: '/proof-bigben-source.webp',
    caption: 'Rach’s 30th · from Lulu',
  },
  {
    who: 'Sarah',
    brief: 'ten years, a surprise trip, New York',
    ideas: [
      'The two of you toasting on a New York rooftop at sunset.',
      'The two of you in a yellow cab, heads out of the windows, skyline behind.',
      'The two of you on the ferry at dusk, the city lights coming on.',
    ],
    card: '/hero-card-front.webp',
    cardAlt: 'The finished card: a couple toasting on a New York rooftop at sunset',
    source: '/hero-source-photo.webp',
    caption: 'Sarah’s 10th anniversary',
  },
];

type Stage = 'type' | 'think' | 'ideas' | 'pick' | 'draw' | 'card';
const TYPE_MS = 46;
const WAIT: Record<Exclude<Stage, 'type' | 'ideas'>, number> = { think: 1100, pick: 1300, draw: 1500, card: 5200 };
const REVEAL_MS = 330;

/** Which of the three steps a stage belongs to. */
const stepOf = (s: Stage): 0 | 1 | 2 => (s === 'type' || s === 'think' ? 0 : s === 'ideas' || s === 'pick' ? 1 : 2);

const STEPS: Array<{ title: string; body: string }> = [
  { title: 'Tell us a little about them', body: 'A hobby, a place, a running joke. A few words is enough.' },
  { title: 'Pick from three scenes', body: 'We suggest three. Choose one, or change every word.' },
  { title: 'We draw the card', body: 'Them, in that scene, on the front. It takes a few minutes.' },
];

export function SceneIdeasSection({ cta }: { cta?: ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  // Starts on the ENDING of the first film.
  const [idx, setIdx] = useState(0);
  const [stage, setStage] = useState<Stage>('card');
  const [chars, setChars] = useState(FILMS[0].brief.length);
  const [shown, setShown] = useState(3);
  const film = FILMS[idx];

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // One timer at a time; each step schedules the next. Paused off screen,
  // never started for reduced motion.
  useEffect(() => {
    if (reduced || !inView) return;
    let t: number;
    if (stage === 'type') {
      t = chars < film.brief.length
        ? window.setTimeout(() => setChars((c) => c + 1), TYPE_MS)
        : window.setTimeout(() => setStage('think'), 550);
    } else if (stage === 'think') {
      t = window.setTimeout(() => { setShown(0); setStage('ideas'); }, WAIT.think);
    } else if (stage === 'ideas') {
      t = shown < 3
        ? window.setTimeout(() => setShown((n) => n + 1), REVEAL_MS)
        : window.setTimeout(() => setStage('pick'), 1000);
    } else if (stage === 'pick') {
      t = window.setTimeout(() => setStage('draw'), WAIT.pick);
    } else if (stage === 'draw') {
      t = window.setTimeout(() => setStage('card'), WAIT.draw);
    } else {
      t = window.setTimeout(() => {
        setIdx((i) => (i + 1) % FILMS.length);
        setChars(0);
        setShown(0);
        setStage('type');
      }, WAIT.card);
    }
    return () => window.clearTimeout(t);
  }, [reduced, inView, stage, chars, shown, film.brief.length]);

  const step = stepOf(stage);
  const helper = stage !== 'draw' && stage !== 'card';
  const picked = stage === 'pick';
  const fade = 'transition-opacity duration-500 motion-reduce:transition-none';

  return (
    <section id="scene-ideas" className="scroll-mt-32 px-6 py-16 md:py-28" data-testid="scene-ideas">
      <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[auto_1fr] md:gap-20">
        {/* ── The words: heading, then the three steps the film plays ── */}
        <Rise className="md:order-2">
          <p className={EYEBROW}>Not sure what to write?</p>
          <h2 className={`mt-3 text-[clamp(30px,4.4vw,44px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>
            A few words will do.
          </h2>
          <ol className="mt-8 space-y-5">
            {STEPS.map((s, i) => {
              const on = i === step;
              return (
                <li key={s.title} className="flex gap-4" data-testid={`scene-step-${i}`} data-on={on}>
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold transition-colors duration-300 motion-reduce:transition-none ${
                      on ? 'bg-brand text-brand-foreground' : 'bg-brand-muted text-brand-dark'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span>
                    {/* Serif comes from `.keeper-serif h3`; weight is set there. */}
                    <h3 className={`text-[19px] leading-tight transition-colors duration-300 motion-reduce:transition-none ${on ? 'text-keeper-ink' : 'text-keeper-meta'}`}>
                      {s.title}
                    </h3>
                    <p className="mt-1 max-w-[40ch] text-[15px] leading-relaxed text-keeper-body">{s.body}</p>
                  </span>
                </li>
              );
            })}
          </ol>
          {cta && <div className="mt-9">{cta}</div>}
        </Rise>

        {/* ── The film, in a phone so it reads as a demo and not a form ── */}
        <Rise delay={0.08} className="md:order-1">
          <p className="sr-only">
            Example: typing “{FILMS[0].brief}” suggests three scenes. Picking “{FILMS[0].ideas[0]}” produced this card:{' '}
            {FILMS[0].cardAlt}.
          </p>
          <div
            ref={ref}
            aria-hidden="true"
            className="pointer-events-none mx-auto w-[280px] select-none sm:w-[300px]"
            data-testid="scene-ideas-demo"
            data-stage={stage}
          >
            <div className="relative aspect-[9/17] rounded-[44px] border-[9px] border-keeper-ink bg-keeper-ink shadow-[0_40px_80px_-36px_rgba(33,29,25,0.55)]">
              <div className="absolute left-1/2 top-2 z-20 h-[18px] w-[84px] -translate-x-1/2 rounded-full bg-keeper-ink" />
              <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-keeper-paper">
                {/* Screen 1 — the helper: brief, button, three scenes. */}
                <div className={`absolute inset-0 flex flex-col px-3.5 pb-4 pt-10 ${fade} ${helper ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="flex items-center justify-between">
                    <p className="inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-brand-dark">
                      <Sparkles className="h-3 w-3" />
                      Get scene ideas
                    </p>
                    <p className="text-[9.5px] text-keeper-meta">for {film.who}</p>
                  </div>
                  <div className="mt-2.5 min-h-[52px] rounded-md border border-keeper-hair bg-white px-2.5 py-2 text-[12.5px] leading-snug text-keeper-ink">
                    {film.brief.slice(0, chars)}
                    <span className={`ml-px inline-block h-[1em] w-[1.5px] translate-y-[2px] bg-brand-dark ${stage === 'type' && !reduced ? 'animate-pulse' : 'opacity-0'}`} />
                  </div>
                  <div
                    className={`mt-2 flex h-8 items-center justify-center rounded-md bg-brand-dark text-[11.5px] font-semibold text-brand-foreground transition-transform duration-150 ${stage === 'think' ? 'scale-[0.97]' : ''}`}
                  >
                    {stage === 'think' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span className="ml-1.5">Show me ideas</span>
                  </div>
                  <p className="mt-3 text-[9.5px] font-semibold uppercase tracking-wider text-keeper-meta">
                    {stage === 'think' ? 'Sketching three ideas…' : stage === 'type' ? ' ' : 'Three scenes'}
                  </p>
                  <div className="mt-1.5 flex flex-col gap-2">
                    {film.ideas.map((text, i) => {
                      const visible = (stage === 'ideas' && i < shown) || stage === 'pick';
                      const chosen = picked && i === 0;
                      return (
                        <div
                          key={`${idx}-${i}`}
                          className={`flex min-h-[62px] items-start gap-2 rounded-lg border p-2.5 transition-all duration-300 motion-reduce:transition-none ${
                            chosen
                              ? 'border-brand bg-brand-muted ring-2 ring-brand/25'
                              : visible
                                ? `border-keeper-hair bg-white ${picked ? 'opacity-45' : ''}`
                                : `border-keeper-hair/60 bg-white/50 ${stage === 'think' ? 'animate-pulse' : ''}`
                          }`}
                        >
                          <span
                            className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                              chosen ? 'bg-brand-dark text-brand-foreground' : visible ? 'bg-brand-muted text-brand-dark' : 'bg-white text-keeper-meta/40'
                            }`}
                          >
                            {chosen ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : String.fromCharCode(65 + i)}
                          </span>
                          <span className={`text-[12px] leading-snug text-keeper-body transition-opacity duration-300 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}>
                            {text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Screen 2 — drawing, then the real card. */}
                <div className={`absolute inset-0 flex flex-col px-3.5 pb-4 pt-10 ${fade} ${helper ? 'opacity-0' : 'opacity-100'}`}>
                  <p className="truncate rounded-full border border-keeper-hair bg-white px-2.5 py-1 text-center text-[10px] text-keeper-meta">
                    “{film.brief}”
                  </p>
                  <div className="relative mt-5 flex-1">
                    <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${fade} ${stage === 'draw' ? 'opacity-100' : 'opacity-0'}`}>
                      <Loader2 className="h-5 w-5 animate-spin text-brand" />
                      <p className="text-[11.5px] font-medium text-keeper-body">Drawing {film.who}’s card…</p>
                    </div>
                    <div className={`absolute inset-0 flex flex-col justify-center pb-6 ${fade} ${stage === 'card' ? 'opacity-100' : 'opacity-0'}`}>
                      <div className="relative mx-auto w-[92%]">
                        <img
                          src={film.card}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          width={900}
                          height={900}
                          className="block aspect-square w-full -rotate-2 rounded-[6px] object-cover shadow-[0_18px_36px_-16px_rgba(33,29,25,0.6)] ring-1 ring-black/5"
                        />
                        <img
                          src={film.source}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          width={500}
                          height={500}
                          className="absolute -bottom-4 -left-3 block aspect-square w-[30%] -rotate-[8deg] rounded-[4px] border-[3px] border-white object-cover shadow-[0_10px_20px_-10px_rgba(33,29,25,0.6)]"
                        />
                      </div>
                      <p className="mt-9 text-center font-display text-[14px] font-bold leading-snug text-keeper-ink">
                        “{film.ideas[0].replace(/\.$/, '')}”
                      </p>
                      <p className="mt-1.5 text-center text-[11px] text-keeper-meta">{film.caption}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-[11.5px] text-keeper-meta">Re-enacted. The cards are real.</p>
          </div>
        </Rise>
      </div>
    </section>
  );
}
