// client/src/components/landing/studio-build-steps.tsx
//
// The build journey as PURE-SCROLL reveal steps — no sticky pinning, no snap,
// no dolly fly-through. Each step is a full-viewport section you simply scroll
// down to; as it enters view it gently fades + SLIGHTLY zooms in (scale + a
// small rise), and its reveal (photo-select / typing) autoplays. Calm and
// effortless. The card finale (StudioFlowSection) follows.

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { User, Check } from 'lucide-react';

const SCENE =
  'Sarah on a sunlit terrace in Positano, laughing with a glass of wine as the sea glows gold behind her.';
const FRONT = 'Happy Anniversary, Sarah';
const INSIDE =
  "Twenty-five years, and you still make me laugh like it's day one. Here's to every adventure still to come.";

const EASE = [0.22, 1, 0.36, 1] as const;
const CARD =
  'w-[340px] sm:w-[380px] rounded-[28px] bg-white px-6 py-7 shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70';
const HEAD =
  'font-display text-[30px] sm:text-[42px] font-bold text-ink leading-[1.02] tracking-[-0.02em] text-center';
const PHOTO_GRADIENTS = [
  'from-rose-300 to-orange-200',
  'from-sky-300 to-blue-200',
  'from-amber-200 to-yellow-200',
  'from-emerald-200 to-teal-200',
  'from-violet-300 to-fuchsia-200',
  'from-stone-200 to-stone-300',
];
const SELECT_ORDER = [0, 4, 2];

// Time-based typewriter — writes to a ref (no per-char re-render). Plays once
// `play` flips true (when the step enters view); reduced-motion shows it whole.
function Typewriter({
  text,
  play,
  speed = 28,
  delay = 0,
  reduced,
}: {
  text: string;
  play: boolean;
  speed?: number;
  delay?: number;
  reduced: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!play) {
      el.textContent = '';
      return;
    }
    if (reduced) {
      el.textContent = text;
      return;
    }
    el.textContent = '';
    let i = 0;
    let interval = 0;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        i += 1;
        el.textContent = text.slice(0, i);
        if (i >= text.length) window.clearInterval(interval);
      }, speed);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [text, play, speed, delay, reduced]);
  return <span ref={ref} />;
}

const Caret = () => (
  <span className="ml-0.5 inline-block h-[15px] w-[2px] animate-pulse bg-brand align-middle" />
);

function PhotoCard({ active, reduced }: { active: boolean; reduced: boolean }) {
  const [sel, setSel] = useState(reduced ? SELECT_ORDER.length : 0);
  useEffect(() => {
    if (!active) {
      setSel(0);
      return;
    }
    if (reduced) {
      setSel(SELECT_ORDER.length);
      return;
    }
    const ts = [
      window.setTimeout(() => setSel(1), 450),
      window.setTimeout(() => setSel(2), 750),
      window.setTimeout(() => setSel(3), 1050),
    ];
    return () => ts.forEach(clearTimeout);
  }, [active, reduced]);
  return (
    <div className={CARD}>
      <div className="grid grid-cols-3 gap-2.5">
        {PHOTO_GRADIENTS.map((g, i) => {
          const pos = SELECT_ORDER.indexOf(i);
          const on = pos !== -1 && pos < sel;
          return (
            <div
              key={i}
              className={`relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br ${g} ring-2 transition-all duration-200 ${
                on ? 'ring-brand' : 'ring-transparent'
              } ${sel > 0 && !on ? 'opacity-60' : 'opacity-100'}`}
            >
              <span className="absolute inset-0 flex items-center justify-center">
                <User className="h-7 w-7 text-white/75" strokeWidth={1.75} />
              </span>
              <div
                style={{ opacity: on ? 1 : 0, transform: on ? 'scale(1)' : 'scale(0.5)' }}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand shadow-md transition-all duration-200"
              >
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 h-5 text-center text-[13px] font-semibold text-ink">
        {sel > 0 ? `Sarah — ${sel} selected` : ''}
      </p>
    </div>
  );
}

// One full-viewport step. Pure scroll: it scrolls up the page normally; as it
// enters view it fades + slightly zooms in, and `children(inView)` lets the
// content autoplay only while on screen.
function BuildStep({ children }: { children: (active: boolean) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const reduced = useReducedMotion() ?? false;
  return (
    <section
      ref={ref}
      className="snap-center relative flex min-h-screen items-center justify-center px-6"
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 48 }}
        animate={
          inView
            ? { opacity: 1, scale: 1, y: 0 }
            : reduced
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.9, y: 48 }
        }
        transition={{ duration: 0.6, ease: EASE }}
        className="flex flex-col items-center gap-8 will-change-transform"
      >
        {children(inView)}
      </motion.div>
    </section>
  );
}

export function StudioBuildSteps() {
  const reduced = useReducedMotion() ?? false;
  return (
    <>
      <BuildStep>
        {(active) => (
          <>
            <h1 className={HEAD}>Select your photo(s)</h1>
            <PhotoCard active={active} reduced={reduced} />
          </>
        )}
      </BuildStep>

      <BuildStep>
        {(active) => (
          <>
            <h1 className={HEAD}>Put them in the picture</h1>
            <div className={CARD}>
              <p className="mb-1.5 text-[13px] text-ink">The picture</p>
              <div className="h-[150px] overflow-hidden rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[15px] leading-relaxed text-ink">
                <Typewriter text={SCENE} play={active} delay={350} reduced={reduced} />
                {active && <Caret />}
              </div>
            </div>
          </>
        )}
      </BuildStep>

      <BuildStep>
        {(active) => (
          <>
            <h1 className={HEAD}>Add your words</h1>
            <div className={CARD}>
              <p className="mb-1.5 text-[13px] text-ink">What's on the front?</p>
              <div className="flex min-h-[46px] items-center rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[15px] font-medium text-ink">
                <Typewriter text={FRONT} play={active} delay={350} reduced={reduced} />
                {active && <Caret />}
              </div>
              <p className="mb-1.5 mt-4 text-[13px] text-ink">What's on the inside?</p>
              <div className="h-[120px] overflow-hidden rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[14px] leading-relaxed text-ink">
                <Typewriter text={INSIDE} play={active} delay={1500} reduced={reduced} />
                {active && <Caret />}
              </div>
            </div>
          </>
        )}
      </BuildStep>
    </>
  );
}
