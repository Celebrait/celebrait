// client/src/pages/flow-v2-preview.tsx
//
// PREVIEW (/flow-v2) — prototype of the "snap-station + autoplay" hero-flow
// model from the smoothness audit (P1). Each step is a full-viewport station;
// a single swipe/scroll SNAPS to the next (native CSS scroll-snap, momentum-
// respecting — not scroll-jacking). On arrival, the step's content AUTOPLAYS
// at a readable, time-based pace, so the read is guaranteed regardless of how
// fast you scroll. Self-contained; does NOT touch the live StudioFlowSection.

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { User, Check, ChevronUp } from 'lucide-react';
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

// Time-based typewriter — writes to a ref imperatively (no per-char re-render).
// Starts `delay` ms after `play` flips true; reduced-motion shows it instantly.
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

function SwipeHint() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-1 text-ink-soft/70">
      <motion.div
        animate={{ y: [3, -4, 3] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronUp className="h-5 w-5 text-brand" strokeWidth={2.5} />
      </motion.div>
      <span className="text-[12px] tracking-[0.04em]">swipe</span>
    </div>
  );
}

// Generic station: full-viewport, snap-aligned, reports when it's the active
// one, and fades/lifts its content in on arrival. `children(active)` passes the
// in-view flag so each card can autoplay only while it's the current step.
function Station({
  index,
  setActive,
  last,
  children,
}: {
  index: number;
  setActive: (i: number) => void;
  last?: boolean;
  children: (active: boolean) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.55 });
  const reduced = useReducedMotion() ?? false;
  useEffect(() => {
    if (inView) setActive(index);
  }, [inView, index, setActive]);
  // Zoom-in on arrival: content sits pushed back in 3D space + faded when the
  // station isn't the current one, then dollies to z:0 as it becomes active —
  // keeping the premium "camera moves in to greet you" feel within the snap
  // model. Reduced-motion users just get a clean fade, no z/translate.
  const target = reduced
    ? { opacity: inView ? 1 : 0 }
    : { opacity: inView ? 1 : 0, z: inView ? 0 : -300, y: inView ? 0 : 34 };
  return (
    <section
      ref={ref}
      className="relative flex h-[100dvh] snap-start snap-always flex-col items-center justify-center px-6"
      style={{ perspective: '1100px' }}
    >
      <motion.div
        animate={target}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex flex-col items-center gap-8 will-change-transform"
      >
        {children(inView)}
      </motion.div>
      {!last && <SwipeHint />}
    </section>
  );
}

function PhotoStation({ active, reduced }: { active: boolean; reduced: boolean }) {
  const [sel, setSel] = useState(0);
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
      window.setTimeout(() => setSel(1), 400),
      window.setTimeout(() => setSel(2), 700),
      window.setTimeout(() => setSel(3), 1000),
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

export default function FlowV2Preview() {
  const reduced = useReducedMotion() ?? false;
  const [, setActive] = useState(0);

  return (
    <div
      className="fixed inset-0 snap-y snap-mandatory overflow-y-scroll"
      style={{ background: 'linear-gradient(180deg,#ffffff 0%,#f3f2fb 100%)' }}
    >
      <Station index={0} setActive={setActive}>
        {(active) => (
          <>
            <h1 className={HEAD}>Select your photo(s)</h1>
            <PhotoStation active={active} reduced={reduced} />
          </>
        )}
      </Station>

      <Station index={1} setActive={setActive}>
        {(active) => (
          <>
            <h1 className={HEAD}>Put them in the picture</h1>
            <div className={CARD}>
              <p className="mb-1.5 text-[13px] text-ink">The picture</p>
              <div className="h-[150px] overflow-hidden rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[15px] leading-relaxed text-ink">
                <Typewriter text={SCENE} play={active} reduced={reduced} />
                {active && <Caret />}
              </div>
            </div>
          </>
        )}
      </Station>

      <Station index={2} setActive={setActive}>
        {(active) => (
          <>
            <h1 className={HEAD}>Add your words</h1>
            <div className={CARD}>
              <p className="mb-1.5 text-[13px] text-ink">What's on the front?</p>
              <div className="flex min-h-[46px] items-center rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[15px] font-medium text-ink">
                <Typewriter text={FRONT} play={active} reduced={reduced} />
                {active && <Caret />}
              </div>
              <p className="mb-1.5 mt-4 text-[13px] text-ink">What's on the inside?</p>
              <div className="h-[120px] overflow-hidden rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[14px] leading-relaxed text-ink">
                <Typewriter text={INSIDE} play={active} delay={1400} reduced={reduced} />
                {active && <Caret />}
              </div>
            </div>
          </>
        )}
      </Station>

      <Station index={3} setActive={setActive} last>
        {(active) => (
          <>
            <h1 className={HEAD}>
              And we bring it
              <br />
              to life.
            </h1>
            <motion.img
              src={revealFront}
              alt=""
              animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.94 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="w-[300px] rounded-[14px] shadow-[0_40px_90px_-30px_rgba(15,23,42,0.45)] sm:w-[340px]"
            />
          </>
        )}
      </Station>
    </div>
  );
}
