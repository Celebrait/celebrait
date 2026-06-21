// client/src/pages/flow-v2-preview.tsx
//
// PREVIEW (/flow-v2) — prototype of the "snap + autoplay + in-place zoom"
// hero-flow model (audit P1, option B). A single swipe/scroll advances one
// step (native scroll-snap on an INVISIBLE track, so momentum + one-swipe-
// per-step come for free). The step content lives in a FIXED, centred stage
// that zooms the new step in from depth (translateZ, toward you) and crossfades
// — NO vertical travel, so it reads as the camera dollying in, like the live
// flow, not "rising from below". Each step autoplays its reveal on arrival.
// Self-contained; does not touch the live StudioFlowSection.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { User, Check, ChevronUp } from 'lucide-react';
import revealFront from '@/assets/hero-card-front.png';
import revealInside from '@/assets/hero-card-inside.png';
import envelopeImg from '@/assets/envelope.png';

const SCENE =
  'Sarah on a sunlit terrace in Positano, laughing with a glass of wine as the sea glows gold behind her.';
const FRONT = 'Happy Anniversary, Sarah';
const INSIDE =
  "Twenty-five years, and you still make me laugh like it's day one. Here's to every adventure still to come.";

const EASE = [0.22, 1, 0.36, 1] as const;
const GRADIENT = 'linear-gradient(180deg,#ffffff 0%,#f3f2fb 100%)';
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
const STEP_COUNT = 4;

// Time-based typewriter — writes to a ref imperatively (no per-char re-render).
// Starts `delay` ms after mount; reduced-motion shows it instantly.
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

function SwipeHint() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex flex-col items-center gap-1 text-ink-soft/70">
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

// Invisible full-viewport scroll-snap target. Its only job is to report when it
// becomes the centred one, so the fixed stage knows which step to show.
function Sentinel({ index, setActive }: { index: number; setActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  useEffect(() => {
    if (inView) setActive(index);
  }, [inView, index, setActive]);
  return <div ref={ref} className="h-[100dvh] snap-start snap-always" />;
}

// Photo step — auto-selects on mount (it only mounts while it's the active step).
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

// Finale — autoplays on arrival: card front → opens (read inside) → closes →
// envelope covers it → the whole thing flies off-screen GETTING SMALLER
// (recedes into the distance), then "Make your own" fades in.
// phases: 0 front · 1 open · 2 closed+envelope · 3 fly away · 4 done
function FinaleStep({ reduced }: { reduced: boolean }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (reduced) {
      setPhase(4);
      return;
    }
    const ts = [
      window.setTimeout(() => setPhase(1), 800),
      window.setTimeout(() => setPhase(2), 2600),
      window.setTimeout(() => setPhase(3), 3500),
      window.setTimeout(() => setPhase(4), 4400),
    ];
    return () => ts.forEach(clearTimeout);
  }, [reduced]);

  return (
    <div className="relative flex flex-col items-center gap-9">
      <motion.div
        // The card+envelope unit. On fly-away it shrinks + drifts up-right +
        // fades — receding into the distance (smaller as it goes), not growing.
        animate={
          phase >= 3
            ? { x: 180, y: -260, scale: 0.08, opacity: 0 }
            : { x: 0, y: 0, scale: 1, opacity: 1 }
        }
        transition={{ duration: 0.85, ease: [0.4, 0, 0.2, 1] }}
        style={{ perspective: '1000px' }}
      >
        <div
          className="relative"
          style={{ width: 300, height: 300, transformStyle: 'preserve-3d' }}
        >
          {/* Inside (revealed when the cover opens) */}
          <img
            src={revealInside}
            alt=""
            className="absolute inset-0 h-full w-full rounded-[10px] object-cover shadow-[0_30px_70px_-28px_rgba(15,23,42,0.45)]"
          />
          {/* Cover (front) — hinges open during the read, then closes */}
          <motion.div
            className="absolute inset-0"
            style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d' }}
            animate={{ rotateY: phase === 1 ? -158 : 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <img
              src={revealFront}
              alt=""
              className="absolute inset-0 h-full w-full rounded-[10px] object-cover shadow-[0_30px_70px_-28px_rgba(15,23,42,0.45)]"
              style={{ backfaceVisibility: 'hidden' }}
            />
          </motion.div>
          {/* Envelope — covers the closed front before it flies off */}
          <motion.img
            src={envelopeImg}
            alt=""
            className="absolute inset-0 h-full w-full scale-[1.16] rounded-[10px] object-cover"
            animate={{ opacity: phase >= 2 ? 1 : 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          />
        </div>
      </motion.div>

      <motion.div
        className="flex flex-col items-center gap-3"
        animate={{ opacity: phase >= 4 ? 1 : 0, y: phase >= 4 ? 0 : 12 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <h1 className={HEAD}>Make their day.</h1>
        <button className="rounded-full bg-brand px-7 py-3 text-base font-medium text-brand-foreground">
          Make my first card
        </button>
      </motion.div>
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
      return <FinaleStep reduced={reduced} />;
  }
}

export default function FlowV2Preview() {
  const reduced = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: GRADIENT }}>
      {/* Visual stage — fixed + centred. The active step zooms in from depth
          (translateZ) and crossfades; the previous one drifts toward you and
          fades. No vertical travel → reads as a dolly toward the viewer. */}
      <div className="pointer-events-none absolute inset-0" style={{ perspective: '820px' }}>
        <AnimatePresence>
          <motion.div
            key={active}
            className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6 will-change-transform"
            // Step 0 (photos) zooms UP FROM BELOW (rise + dolly) — the entrance
            // you liked. Every later step zooms in from depth, in place.
            initial={
              reduced
                ? { opacity: 0 }
                : active === 0
                  ? { opacity: 0, y: 170, z: -320 }
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

      {/* Invisible scroll track — native snap drives which step is active. */}
      <div className="absolute inset-0 snap-y snap-mandatory overflow-y-scroll">
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <Sentinel key={i} index={i} setActive={setActive} />
        ))}
      </div>

      {active < STEP_COUNT - 1 && <SwipeHint />}
    </div>
  );
}
