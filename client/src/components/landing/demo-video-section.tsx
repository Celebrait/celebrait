// client/src/components/landing/demo-video-section.tsx
//
// "How it works" section, sat directly under the hero. Click-to-play
// video placeholder + a punchy headline anchored to the Celebrait
// thesis (anti-Hallmark, observational, opinionated).
//
// Layout (Kevin call 2026-05-06):
//
//     Unforgettable. Unbinnable.        ← small violet eyebrow
//     Welcome to the end of ~boring~    ← big h2, "boring" struck
//                                         through with a violet line
//     [VIDEO POSTER, max-w-5xl]         ← back to original size
//
// Headline size matches the "Imagine it. Describe it. Send it."
// section so this reads as the page's second hero moment.
//
// To wire in the real video later: replace the <img> poster + the
// disabled button with a <video> element (or click-to-open modal).
// The "Demo coming soon" caption can come off at the same time.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Play } from 'lucide-react';
// Poster image — captured 2026-05-06 from the actual /studio dashboard
// at 1440×900 / 2x DPR (puppeteer + headless Chrome, dev OTP login).
// Re-snap with the same flow if the dashboard chrome changes:
//   /tmp/snap-studio.mjs (puppeteer-core), saves to
//   client/src/assets/studio-dashboard-poster.png.
import studioDashboardPoster from '@/assets/studio-dashboard-poster.png';

export function DemoVideoSection() {
  return (
    <section className="relative py-16 md:py-20 lg:py-24">
      <div className="max-w-5xl mx-auto px-6 md:px-10">
        {/* Header — eyebrow + headline only. Sub-paragraph dropped
            (Kevin call 2026-05-06). */}
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
          <p className="text-xs sm:text-sm uppercase tracking-[0.18em] text-brand font-semibold mb-4">
            Introducing the Unbinnable
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-6xl font-semibold text-ink tracking-tight leading-[1.05]">
            Welcome to the end of <Strike>boring</Strike>
          </h2>
        </div>

        {/* Video placeholder card — back to max-w-5xl (Kevin call
            2026-05-06: "Video same size as before"). */}
        <div
          className="relative rounded-3xl border border-stone-200 aspect-video overflow-hidden shadow-xl"
          style={{
            boxShadow:
              '0 30px 60px -25px rgba(15,23,42,0.18), 0 12px 24px -12px rgba(15,23,42,0.10)',
          }}
        >
          <img
            src={studioDashboardPoster}
            alt="Preview — the Studio dashboard, where you make a card"
            className="absolute inset-0 w-full h-full object-cover object-top"
          />

          {/* Darkening vignettes — top + bottom only. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(15,23,42,0.18) 0%, rgba(15,23,42,0) 35%, rgba(15,23,42,0) 65%, rgba(15,23,42,0.32) 100%)',
            }}
          />
          {/* Centre brand halo. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(122,118,232,0.20) 0%, rgba(122,118,232,0) 45%)',
            }}
          />

          {/* Play button + status label */}
          <div className="relative h-full flex flex-col items-center justify-center gap-5">
            <button
              type="button"
              disabled
              className="group relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-cta text-cta-foreground flex items-center justify-center shadow-2xl cursor-not-allowed ring-4 ring-white/30"
              aria-label="Demo video — coming soon"
            >
              <Play
                className="w-8 h-8 md:w-10 md:h-10 ml-1"
                fill="currentColor"
                strokeWidth={0}
              />
            </button>
            <p className="text-xs uppercase tracking-[0.16em] text-white/90 font-semibold drop-shadow">
              Demo coming soon
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Strike ────────────────────────────────────────────────────
 * Straight-line strikethrough on a single word. Brand violet,
 * draws L→R via CSS scaleX animation (Kevin call 2026-05-06:
 * "Straight lines through please" + "the line through boring stops
 * mid way through the word"). Two-play loop — strike draws, holds,
 * fades out, redraws, holds forever.
 *
 * Implementation note: was an SVG path with `pathLength` animation,
 * but the combination of `vector-effect="non-scaling-stroke"` +
 * `preserveAspectRatio="none"` doesn't always draw the full
 * stretched line — so for wide words like "boring" the strike
 * stopped partway through. Swapped to a positioned div + scaleX
 * animation, which is simple, reliable, and font-size relative
 * (`h-[0.09em]`) so the line thickness scales with the headline.
 *
 * useReducedMotion shortcuts straight to the struck state.
 * ─────────────────────────────────────────────────────────────── */

const STRIKE_EASE = [0.22, 1, 0.36, 1] as const;

function Strike({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.7 });
  const [phase, setPhase] = useState<'idle' | 'drawing'>('idle');
  const [playKey, setPlayKey] = useState(0);

  useEffect(() => {
    if (reduced) {
      setPhase('drawing');
      return;
    }
    if (!inView) return;

    const timers: number[] = [];
    let elapsed = 0;
    const schedule = (deltaMs: number, cb: () => void) => {
      elapsed += deltaMs;
      timers.push(window.setTimeout(cb, elapsed));
    };

    // Play 1: rest → draw → hold (4.5s) → fade out
    schedule(800, () => setPhase('drawing'));
    schedule(850 + 4500, () => setPhase('idle'));
    // Brief pause, then play 2 with fresh key — final state, holds forever
    schedule(700, () => {
      setPlayKey((k) => k + 1);
      setPhase('drawing');
    });

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [inView, reduced]);

  return (
    <span ref={ref} className="relative inline-block">
      <span>{children}</span>
      <AnimatePresence mode="wait">
        {phase === 'drawing' && (
          <motion.span
            key={playKey}
            aria-hidden
            className="absolute left-[-3%] right-[-3%] top-1/2 -translate-y-1/2 h-[0.09em] bg-brand rounded-full"
            style={{ transformOrigin: 'left center' }}
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
            transition={{
              scaleX: { duration: reduced ? 0 : 0.85, ease: STRIKE_EASE },
            }}
          />
        )}
      </AnimatePresence>
    </span>
  );
}

/* ─── CrossSwap (kept as reference, no longer mounted) ─────────
 * Earlier word-swap effect — superseded 2026-05-06 by Scribble
 * (above). Kept around so we can revert if the scribble pattern
 * doesn't land.
 *
 * Looping headline word animation (Kevin call 2026-05-06).
 *
 * Phases (one full cycle):
 *
 *   REST   — `from` word visible at full opacity, no strike line.
 *   STRIKE — a brand-violet heavy line draws L→R across the
 *            `from` word (slow, deliberate). Both CrossSwaps in
 *            the headline strike at the same moment.
 *   SWAP   — the `from` word + its strike FADE UP and out;
 *            at the same time the `to` word fades UP from below
 *            into its place. Same typography, same baseline.
 *   HOLD   — `to` word visible, dwell ~4.5s.
 *   RESET  — `to` word fades DOWN out, `from` word fades DOWN
 *            back into the rest position, strike line fades to 0.
 *
 * Sequence: REST → STRIKE → SWAP → HOLD → RESET → REST → STRIKE
 *           → SWAP → HOLD (final, holds forever).
 *
 * Total: 2 plays of strike→swap ("repeat in case user does not
 * see it" — Kevin). Settles on the `to` state after the second
 * play. The shimmer (toShimmer) keeps animating in the held state
 * so the final word visibly breathes with brand violet.
 *
 * Width is anchored by an invisible "ghost" of the longer word so
 * the headline never reflows as the words swap.
 *
 * useReducedMotion shortcuts to the final `to` word at rest.
 * ─────────────────────────────────────────────────────────────── */

type SwapPhase = 'rest' | 'strike' | 'swap' | 'hold' | 'reset';

const SWAP_EASE = [0.22, 1, 0.36, 1] as const;
// Strike duration bumped 0.55s → 0.95s 2026-05-06 (Kevin: "cross
// outs to slow down a little"). Reads as a deliberate brand
// strike rather than a quick flick.
const STRIKE_DURATION_S = 0.95;
const SWAP_DURATION_S = 0.55;

function CrossSwap({
  from,
  to,
  toShimmer = false,
  toClass,
}: {
  from: string;
  to: string;
  /** When true, the `to` word renders inside a continuously-shimmering
   *  brand-violet gradient (matches the hero's "reimagined." treatment).
   *  Used on the destination word that sits at rest after the loop. */
  toShimmer?: boolean;
  /** Optional tailwind class applied to the `to` word's wrapper —
   *  used for font-family / size / tracking overrides. Color is
   *  ignored when `toShimmer` is true (the gradient owns it), but
   *  font-family etc. still apply through to the gradient text. */
  toClass?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.7 });
  const [phase, setPhase] = useState<SwapPhase>('rest');

  useEffect(() => {
    if (reduced) {
      setPhase('hold');
      return;
    }
    if (!inView) return;

    // Sequence the two plays. `schedule` is a small helper that
    // chains setTimeouts based on cumulative elapsed time.
    const timers: number[] = [];
    let elapsed = 0;
    const schedule = (deltaMs: number, p: SwapPhase) => {
      elapsed += deltaMs;
      timers.push(window.setTimeout(() => setPhase(p), elapsed));
    };

    // Play 1
    schedule(1100, 'strike'); // T+1.1s
    schedule(950, 'swap'); //   T+2.05s
    schedule(550, 'hold'); //   T+2.6s
    schedule(4500, 'reset'); // T+7.1s — long enough to read

    // Play 2
    schedule(550, 'rest'); //   T+7.65s
    schedule(700, 'strike'); // T+8.35s
    schedule(950, 'swap'); //   T+9.3s
    schedule(550, 'hold'); //   T+9.85s — final hold

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [inView, reduced]);

  // Use the longer word as the layout anchor so the box never
  // reflows mid-swap.
  const anchor = from.length >= to.length ? from : to;

  // Resting OR transitioning toward "from visible" states
  const fromVisible = phase === 'rest' || phase === 'strike' || phase === 'reset';
  // States where the strike line should be drawn through the from word
  const strikeDrawn = phase === 'strike' || phase === 'swap' || phase === 'hold';

  return (
    <span
      ref={ref}
      className="relative inline-block whitespace-nowrap align-baseline"
    >
      {/* Layout anchor — invisible, sets the box width to the
          longer of the two words. */}
      <span className="invisible">{anchor}</span>

      {/* OLD word (with strike line). Rises up + fades on swap;
          falls back down into place on reset. */}
      <motion.span
        aria-hidden={!fromVisible}
        animate={{
          opacity: fromVisible ? 1 : 0,
          y: fromVisible ? '0%' : '-45%',
        }}
        transition={{ duration: SWAP_DURATION_S, ease: SWAP_EASE }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="relative inline-block">
          {from}
          <motion.span
            aria-hidden
            className="absolute left-[-4%] right-[-4%] top-1/2 -translate-y-1/2 h-[0.085em] bg-brand rounded-full"
            animate={{
              scaleX: strikeDrawn ? 1 : 0,
              opacity: phase === 'reset' ? 0 : strikeDrawn ? 1 : 0,
            }}
            style={{ transformOrigin: 'left center' }}
            transition={{
              scaleX: { duration: STRIKE_DURATION_S, ease: SWAP_EASE },
              opacity: { duration: 0.35, ease: SWAP_EASE },
            }}
          />
        </span>
      </motion.span>

      {/* NEW word — rises up from below + fades in on swap.
          Falls back down out of frame on reset. */}
      <motion.span
        aria-hidden={fromVisible}
        initial={{ opacity: 0, y: '45%' }}
        animate={{
          opacity: fromVisible ? 0 : 1,
          y: fromVisible ? '45%' : '0%',
        }}
        transition={{ duration: SWAP_DURATION_S, ease: SWAP_EASE }}
        className={`absolute inset-0 flex items-center justify-center ${
          toClass ?? ''
        }`}
      >
        {toShimmer ? <ShimmerWord>{to}</ShimmerWord> : to}
      </motion.span>
    </span>
  );
}

/* ─── ShimmerWord ─────────────────────────────────────────────────
 * Brand-violet shimmer wave that sweeps L→R across the word every
 * few seconds. Same idiom as the hero's "reimagined." headline —
 * a wide gradient anchored mostly to ink with a narrow violet
 * stripe; backgroundPosition animates within visible range so the
 * text never goes transparent. Use for the destination word in a
 * CrossSwap that sits at rest after the loop, so the held state
 * still visibly breathes.
 * ──────────────────────────────────────────────────────────────── */

function ShimmerWord({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  // `pb-[0.12em] overflow-visible leading-[1.05]` — same fix as the
  // hero's "reimagined." span (Kevin call 2026-05-06: "slightly
  // cropped"). bg-clip-text on an inline-block tightens its bounding
  // box around glyphs which clips descenders (g, y, etc.) against
  // the parent h2's leading-[1.05]. Adding 0.12em of bottom padding
  // grows the line box just enough to fit the descender; overflow-
  // visible defends against any further clipping by ancestors.
  return (
    <motion.span
      className="bg-clip-text text-transparent inline-block leading-[1.05] pb-[0.12em] overflow-visible"
      style={{
        backgroundImage:
          'linear-gradient(90deg, #0f172a 0%, #0f172a 30%, #7a76e8 45%, #5c57d4 50%, #7a76e8 55%, #0f172a 70%, #0f172a 100%)',
        backgroundSize: '220% 100%',
        backgroundRepeat: 'no-repeat',
      }}
      initial={{ backgroundPosition: '0% 0%' }}
      animate={
        reduced
          ? undefined
          : { backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }
      }
      transition={
        reduced
          ? undefined
          : {
              duration: 4,
              repeat: Infinity,
              repeatDelay: 4,
              ease: 'easeInOut',
              times: [0, 0.5, 1],
            }
      }
    >
      {children}
    </motion.span>
  );
}
