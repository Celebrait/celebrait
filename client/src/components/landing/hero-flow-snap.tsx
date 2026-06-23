// client/src/components/landing/hero-flow-snap.tsx
//
// Snap + autoplay + in-place-dolly studio flow, as an IN-PAGE section (so the
// landing keeps scrolling above + below it, unlike the full-screen /flow-v2
// demo). Structure: a tall section with a STICKY centred stage; invisible
// full-viewport snap markers underneath drive which step is active. Each step
// zooms in (dolly) in place + autoplays its reveal on arrival.
//
// Steps: photos (zoom UP FROM BELOW) → picture → words → the card HITS.
// Everything from the card hitting onward is intentionally left to iterate.
// Preview-only for now (mounted on /lp); does not replace StudioFlowSection.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { User, Check } from 'lucide-react';
import revealFront from '@/assets/hero-card-front.png';

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
const STEP_COUNT = 4; // photos · picture · words · card-hits

function Typewriter({
  text,
  speed = 28,
  delay = 0,
  reduced,
}: {
  text: string;
  speed?: number;
  delay?: number;
  reduced: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
  }, [text, speed, delay, reduced]);
  return <span ref={ref} />;
}

const Caret = () => (
  <span className="ml-0.5 inline-block h-[15px] w-[2px] animate-pulse bg-brand align-middle" />
);

function PhotoStep({ reduced }: { reduced: boolean }) {
  const [sel, setSel] = useState(reduced ? SELECT_ORDER.length : 0);
  useEffect(() => {
    if (reduced) return;
    const ts = [
      window.setTimeout(() => setSel(1), 550),
      window.setTimeout(() => setSel(2), 850),
      window.setTimeout(() => setSel(3), 1150),
    ];
    return () => ts.forEach(clearTimeout);
  }, [reduced]);
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

function renderStep(i: number, reduced: boolean) {
  switch (i) {
    case 0:
      return (
        <>
          <h1 className={HEAD}>Select your photo(s)</h1>
          <PhotoStep reduced={reduced} />
        </>
      );
    case 1:
      return (
        <>
          <h1 className={HEAD}>Put them in the picture</h1>
          <div className={CARD}>
            <p className="mb-1.5 text-[13px] text-ink">The picture</p>
            <div className="h-[150px] overflow-hidden rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[15px] leading-relaxed text-ink">
              <Typewriter text={SCENE} delay={450} reduced={reduced} />
              <Caret />
            </div>
          </div>
        </>
      );
    case 2:
      return (
        <>
          <h1 className={HEAD}>Add your words</h1>
          <div className={CARD}>
            <p className="mb-1.5 text-[13px] text-ink">What's on the front?</p>
            <div className="flex min-h-[46px] items-center rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[15px] font-medium text-ink">
              <Typewriter text={FRONT} delay={450} reduced={reduced} />
              <Caret />
            </div>
            <p className="mb-1.5 mt-4 text-[13px] text-ink">What's on the inside?</p>
            <div className="h-[120px] overflow-hidden rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[14px] leading-relaxed text-ink">
              <Typewriter text={INSIDE} delay={1700} reduced={reduced} />
              <Caret />
            </div>
          </div>
        </>
      );
    default:
      // The card HITS — dollies in (via the stage) and holds. Everything from
      // here on (open / envelope / etc.) is the next iteration.
      return (
        <img
          src={revealFront}
          alt=""
          className="w-[clamp(300px,40vw,440px)] rounded-[14px] shadow-[0_44px_100px_-30px_rgba(15,23,42,0.5)]"
        />
      );
  }
}

// Invisible full-viewport snap target. Reports when it's the centred one.
function Marker({ index, setActive }: { index: number; setActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  useEffect(() => {
    if (inView) setActive(index);
  }, [inView, index, setActive]);
  return <div ref={ref} className="h-screen snap-start snap-always" />;
}

export function HeroFlowSnap() {
  const reduced = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);

  return (
    <section className="relative">
      {/* Sticky centred stage — pins while you scroll the markers. The active
          step dollies in (in place) + autoplays. */}
      <div
        className="pointer-events-none sticky top-0 flex h-screen items-center justify-center overflow-hidden"
        style={{ perspective: '820px' }}
      >
        <AnimatePresence>
          <motion.div
            key={active}
            className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6 will-change-transform"
            initial={
              reduced
                ? { opacity: 0 }
                : active === 0
                  ? // Photos sweep UP FROM BELOW (big rise, light zoom) —
                    // the original entrance, distinct from the other steps'
                    // zoom-from-behind.
                    { opacity: 0, y: 360, z: -120 }
                  : { opacity: 0, z: -900 }
            }
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, z: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, z: 520 }}
            transition={{ duration: 0.62, ease: EASE }}
          >
            {renderStep(active, reduced)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Snap track — pulled up under the sticky stage; each marker is one
          step's snap point + active trigger. */}
      <div className="relative -mt-[100vh]">
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <Marker key={i} index={i} setActive={setActive} />
        ))}
      </div>
    </section>
  );
}
