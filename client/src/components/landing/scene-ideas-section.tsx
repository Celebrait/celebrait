// client/src/components/landing/scene-ideas-section.tsx — a PRODUCT DEMO
// of the maker's "Get scene ideas" box (rebuilt 2026-11-12).
//
// Aidan's brief, after rejecting the first version (a wall of ready-made
// scenes that pre-filled the maker): "more of a product demo here,
// showing that the user just needs to type some simple text to get 3
// ideas presented". So this plays the real thing: a few plain words are
// typed into the brief, the button is pressed, three lettered scenes come
// back. It mirrors the panel in components/studio/steps/scene-step.tsx
// (same title, button, hint line and A/B/C tiles) so what a visitor sees
// here is what they get one screen into the maker — and that helper IS
// open to signed-out visitors, unlike the brainstorm chat this slot used
// to sell.
//
// NOT interactive, on purpose: nothing here calls the model, and nothing
// is clickable except the page's own button underneath. The scenes are
// written examples and are labelled "Example".
//
// At rest it shows a COMPLETE example (words typed, three scenes shown),
// so a still frame, a skimming reader or a reduced-motion visitor never
// sees an empty box. The loop only runs while the section is on screen.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { Rise } from '@/components/landing/rise';
import { DISPLAY, EYEBROW } from '@/pages/doorway';

// What gets typed, and what comes back. Written to the maker's own rules:
// the person from the photo, in a place, doing something; no celebrities,
// brands, teams or trademarked shows. Edit freely.
const DEMOS: Array<{ who: string; brief: string; ideas: [string, string, string] }> = [
  {
    who: 'Mum',
    brief: 'her garden, the greenhouse, prize tomatoes',
    ideas: [
      'Mum in her greenhouse at golden hour, holding up a tomato the size of a football like a trophy.',
      'Mum on the winner’s podium at the village show, rosette on her cardigan, tomatoes piled high.',
      'Mum asleep in a deckchair in a jungle of her own tomato plants, sun hat tipped over her eyes.',
    ],
  },
  {
    who: 'Dad',
    brief: 'camping in the Lakes, rain or shine',
    ideas: [
      'Dad outside a tiny tent by a Lake District tarn, brewing tea in the pouring rain, grinning.',
      'Dad on a summit above the clouds, arms wide, flask in one hand.',
      'Dad zipped into a sleeping bag under a sky full of stars, boots steaming by the fire.',
    ],
  },
  {
    who: 'Nan',
    brief: 'baking, always flour on her jumper',
    ideas: [
      'Nan in a cloud of flour, holding up a showstopper cake taller than she is.',
      'Nan judging the village bake-off, spoon raised, giving nothing away.',
      'Nan dancing round the kitchen with a wooden spoon for a microphone, cake cooling on the side.',
    ],
  },
];

const TYPE_MS = 42;       // per character
const THINK_MS = 1100;    // "Sketching three ideas…"
const REVEAL_MS = 320;    // between tiles
const HOLD_MS = 5200;     // read the three before the next one starts

type Phase = 'typing' | 'thinking' | 'ideas';

export function SceneIdeasSection({ cta }: { cta?: ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  // Starts COMPLETE: first example, fully typed, all three scenes showing.
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('ideas');
  const [chars, setChars] = useState(DEMOS[0].brief.length);
  const [shown, setShown] = useState(3);
  const demo = DEMOS[idx];

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // One timer at a time; each step schedules the next. Paused off screen
  // and never started for reduced motion (the complete first example stays).
  useEffect(() => {
    if (reduced || !inView) return;
    let t: number;
    if (phase === 'typing') {
      t = chars < demo.brief.length
        ? window.setTimeout(() => setChars((c) => c + 1), TYPE_MS)
        : window.setTimeout(() => setPhase('thinking'), 500);
    } else if (phase === 'thinking') {
      t = window.setTimeout(() => { setShown(0); setPhase('ideas'); }, THINK_MS);
    } else if (shown < 3) {
      t = window.setTimeout(() => setShown((n) => n + 1), REVEAL_MS);
    } else {
      t = window.setTimeout(() => {
        setIdx((i) => (i + 1) % DEMOS.length);
        setChars(0);
        setShown(0);
        setPhase('typing');
      }, HOLD_MS);
    }
    return () => window.clearTimeout(t);
  }, [reduced, inView, phase, chars, shown, demo.brief.length]);

  const typed = demo.brief.slice(0, chars);
  const thinking = phase === 'thinking';

  return (
    <section id="scene-ideas" className="scroll-mt-32 px-6 py-16 md:py-28" data-testid="scene-ideas">
      <div className="mx-auto max-w-5xl">
        <Rise className="mx-auto max-w-3xl text-center">
          <p className={EYEBROW}>Scene ideas</p>
          <h2 className={`mt-3 text-[clamp(30px,4.4vw,44px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>
            Type a few words. Get three scenes.
          </h2>
          <p className="mx-auto mt-4 max-w-[54ch] text-[17px] leading-[1.6] text-keeper-body">
            Not sure where to put them? Tell us a little about them, a hobby, a place, a running joke, and we’ll
            suggest three scenes. Pick one and make it yours.
          </p>
        </Rise>

        <Rise delay={0.06}>
          {/* Screen readers get the gist in one sentence; the animation
              itself is decoration and is hidden from them. */}
          <p className="sr-only">
            Example: typing “{DEMOS[0].brief}” for {DEMOS[0].who} gives three scene ideas, such as: {DEMOS[0].ideas[0]}
          </p>
          <div
            ref={ref}
            aria-hidden="true"
            className="mt-10 grid items-stretch gap-4 md:mt-14 md:grid-cols-2 md:gap-6"
            data-testid="scene-ideas-demo"
            data-phase={phase}
          >
            {/* ── What you type: the maker's own panel ── */}
            <div className="flex flex-col rounded-2xl border border-brand/15 bg-gradient-to-b from-brand-muted/60 via-brand-muted/30 to-brand-muted/10 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-dark">
                  <Sparkles className="h-3.5 w-3.5" />
                  Get scene ideas
                </p>
                <p className="text-[11px] text-keeper-meta">made for {demo.who}</p>
              </div>
              <div className="mt-4 min-h-[76px] rounded-md border border-keeper-hair bg-white px-3 py-2.5 text-[15px] leading-relaxed text-keeper-ink">
                {typed}
                <span
                  className={`ml-px inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-brand-dark ${phase === 'typing' && !reduced ? 'animate-pulse' : 'opacity-0'}`}
                />
              </div>
              <div
                className={`mt-3 inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-dark px-4 text-sm font-semibold text-brand-foreground shadow-sm transition-transform duration-150 sm:w-auto sm:self-start ${thinking ? 'scale-[0.97]' : ''}`}
              >
                {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span className="ml-1.5">Show me ideas</span>
              </div>
              <p className="mt-3 text-[11.5px] text-keeper-meta">
                Even one word helps. We’ll turn it into three scenes.
              </p>
            </div>

            {/* ── What comes back: three lettered scenes ── */}
            <div className="flex flex-col rounded-2xl border border-keeper-hair bg-white p-5 shadow-[0_24px_60px_-36px_rgba(33,29,25,0.4)] sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-keeper-meta">
                  {thinking ? 'Sketching three ideas…' : 'Three scenes to choose from'}
                </p>
                <span className="rounded-full border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-keeper-meta">
                  Example
                </span>
              </div>
              <div className="mt-4 flex flex-1 flex-col gap-2.5">
                {demo.ideas.map((text, i) => {
                  const visible = phase === 'ideas' && i < shown;
                  return (
                    <div
                      key={`${idx}-${i}`}
                      className={`flex min-h-[84px] flex-1 items-start gap-3 rounded-xl border p-3.5 transition-all duration-300 motion-reduce:transition-none sm:p-4 ${
                        visible
                          ? 'border-keeper-hair bg-white opacity-100 shadow-sm'
                          : `border-keeper-hair/70 bg-keeper-paper/80 ${thinking ? 'animate-pulse' : ''}`
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${visible ? 'bg-brand-muted text-brand-dark' : 'bg-white/70 text-keeper-meta/50'}`}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className={`text-[14px] leading-relaxed text-keeper-body transition-opacity duration-300 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}>
                        {text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Rise>

        {cta && <div className="mt-10 text-center md:mt-12">{cta}</div>}
      </div>
    </section>
  );
}
