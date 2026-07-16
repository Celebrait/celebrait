// client/src/components/studio/generation-wait.tsx
//
// The screen the user sees while ONE side of their card generates
// (front, then — after they sign off — inside). Each side is a single
// opaque ~90s image call, so we choreograph honest progress around it.
//
// Layout (2026-06-27 — Kevin: "proper loading bars + quiet stage copy,
// keep the quotes, they show we care about asking people to wait"):
//
//   ┌─────────────────────────────────────────────┐
//   │           ┌───────────────┐                 │
//   │           │░░ square ░░░░░│  ← shimmering    │
//   │           │░░ silhouette ░│    card (matches │
//   │           └───────────────┘    the real card)│
//   │                                             │
//   │        ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░    ← progress bar │
//   │        • Creating the scene   ← quiet stage  │
//   │                                             │
//   │     " The Dutch call certain birthdays      │
//   │       crown years — 5, 10, 15, 20, 21, 50…  │
//   └─────────────────────────────────────────────┘
//
//   • Square silhouette — the real cards are square, so the "being made"
//     placeholder is too (was 5:7 portrait, which quietly lied).
//   • Determinate progress bar — eases toward ~90% over the ~90s
//     estimate and HOLDS. It never hits 100% on a timer; the parent
//     swaps this whole screen out the instant the real image lands
//     (front → "Here's the front", inside → assemble). On the legacy
//     combined path, stage='ready' snaps it to 100%. So the bar is
//     anchored to real arrival, not the clock — no repeat of the
//     2026-05-13 "finishing touches" copy that escalated while the
//     front hadn't even started.
//   • Quiet stage copy under the bar — side-aware sub-steps ("Analysing
//     your photo → Creating the scene → Rendering the text → Adding the
//     final details"; inside mirrors with style-match / background /
//     message). Small + calm; the bar carries "something's happening".
//   • Celebration quote at the bottom — kept as the warm centrepiece.
//     Facts from lib/celebration-facts.ts (static, occasion-tagged).
//
// The finalize/"assemble the card" step is NOT a generation — it's a
// quick composite — so it gets <AssemblingCard> (a plain spinner)
// instead of this screen. See review-step.tsx.

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import {
  buildCelebrationFeed,
  type CelebrationFact,
} from '@/lib/celebration-facts';

/** The four stages a generation passes through. Derived in the
 *  parent from poll data — see `deriveGenerationStage()` in
 *  review-step.tsx. */
export type GenerationStage = 'front' | 'inside' | 'finishing' | 'ready';

interface GenerationWaitStageProps {
  /** Optional occasion key (e.g. 'birthday') — biases the feed toward
   *  occasion-specific facts. Unknown/missing falls back to general. */
  occasion?: string | null;
  /** Where the server is in the generation pipeline. Drives the bar +
   *  the side-aware stage copy. Defaults to 'front'. */
  stage?: GenerationStage;
  /** Whether the user has chosen `inside: 'blank'`. When true we never
   *  show the inside copy — the gen skips that step. */
  hasInside?: boolean;
  /** How many photos the user uploaded — only used to singularise the
   *  first front sub-step ("photo" vs "photos"). Defaults to plural. */
  photoCount?: number;
}

// Time each celebration fact sits on screen before the next fades in.
const CYCLE_MS = 5500;

// Per-side generation estimate. gpt-image-2 at medium routinely runs
// ~60–120s per side; 90s is the honest middle we choreograph the bar
// and stage copy against.
const ESTIMATE_MS = 90_000;

// The first three sub-steps each get a third of the estimate; the
// fourth ("…final details") holds open past it so a slow gen doesn't
// run out of copy. Bar easing is independent (asymptotic, below).
const SUBSTEP_MS = ESTIMATE_MS / 3;

// Asymptotic bar fill: pct = CAP · (1 − e^(−elapsed/TAU)). TAU≈35s with
// CAP=0.92 puts the bar at ~85% by 90s and creeps toward 92% forever —
// so it always looks alive but never claims done before the image is.
const PROGRESS_TAU = 35_000;
const PROGRESS_CAP = 0.92;

// If a side runs well past the estimate, soften the last stage so the
// hold reads as reassurance, not a freeze.
const SLOW_AFTER_MS = 130_000;

// Side-aware sub-steps. Front and inside tell different little stories
// of what's being made. finishing/ready are legacy-path fallbacks (the
// finalize window now shows <AssemblingCard> instead).
const SUBSTAGES: Record<GenerationStage, string[]> = {
  front: [
    'Analysing your photo',
    'Creating the scene',
    'Rendering the text',
    'Adding the final details',
  ],
  inside: [
    "Matching the front's style",
    'Creating the background art',
    'Rendering your message',
    'Bringing it together',
  ],
  finishing: ['Putting it together'],
  ready: ['Ready'],
};

function easedProgress(elapsed: number, stage: GenerationStage): number {
  if (stage === 'ready') return 1;
  if (stage === 'finishing') return 0.96;
  return PROGRESS_CAP * (1 - Math.exp(-elapsed / PROGRESS_TAU));
}

export function GenerationWaitStage({
  occasion = null,
  stage = 'front',
  hasInside = true,
  photoCount,
}: GenerationWaitStageProps) {
  const facts = useMemo(() => buildCelebrationFeed(occasion), [occasion]);
  const [idx, setIdx] = useState(0);

  // Per-stage elapsed timer. Resets whenever the stage transitions so a
  // long front stage doesn't carry its progress into the inside stage.
  const [elapsedInStageMs, setElapsedInStageMs] = useState(0);

  useEffect(() => {
    if (facts.length < 2) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % facts.length);
    }, CYCLE_MS);
    return () => window.clearInterval(t);
  }, [facts.length]);

  useEffect(() => {
    if (idx >= facts.length) setIdx(0);
  }, [facts.length, idx]);

  // Tick elapsed every 250ms (smoother bar than 1s) — reset on stage change.
  useEffect(() => {
    setElapsedInStageMs(0);
    const start = Date.now();
    const t = window.setInterval(() => {
      setElapsedInStageMs(Date.now() - start);
    }, 250);
    return () => window.clearInterval(t);
  }, [stage]);

  // If the user picked `inside: 'blank'`, the gen skips the inside stage
  // entirely. Defensive: never show inside copy when we don't expect it.
  const effectiveStage: GenerationStage =
    !hasInside && stage === 'inside' ? 'finishing' : stage;

  const steps = SUBSTAGES[effectiveStage] ?? SUBSTAGES.front;
  const stepIndex = Math.min(
    Math.floor(elapsedInStageMs / SUBSTEP_MS),
    steps.length - 1,
  );
  let stepLabel = steps[stepIndex]!;
  // Singularise the very first front step when there's exactly one photo.
  if (effectiveStage === 'front' && stepIndex === 0 && photoCount === 1) {
    stepLabel = 'Analysing your photo';
  } else if (effectiveStage === 'front' && stepIndex === 0) {
    stepLabel = 'Analysing your photos';
  }
  const isSlow = elapsedInStageMs > SLOW_AFTER_MS;
  const showSlowHint =
    isSlow && stepIndex === steps.length - 1 && effectiveStage !== 'ready';

  const pct = Math.round(easedProgress(elapsedInStageMs, effectiveStage) * 100);

  const current: CelebrationFact | null = facts[idx] ?? null;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center px-8 gap-6 sm:gap-7 py-8">
      {/* Card silhouette — SQUARE, matching the real card chassis. The
          shimmer band sweeps via the keyframe in index.css, clipped to
          the rounded corners. */}
      <div
        className="relative w-32 sm:w-36 aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-brand-muted via-brand-muted/70 to-brand-muted/90 shadow-[0_8px_30px_-8px_rgba(124,58,237,0.35)] ring-1 ring-brand/15"
        aria-hidden
        data-testid="generation-card-silhouette"
      >
        <div className="absolute inset-y-0 -inset-x-1/2 flex items-center">
          <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/70 to-transparent skew-x-[-12deg] animate-shimmer-sweep" />
        </div>
        <div className="absolute bottom-3 left-3 right-3 space-y-1.5">
          <div className="h-1.5 rounded-full bg-brand/15 animate-pulse" />
          <div
            className="h-1.5 rounded-full bg-brand/15 w-3/4 animate-pulse"
            style={{ animationDelay: '0.3s' }}
          />
          <div
            className="h-1.5 rounded-full bg-brand/15 w-1/2 animate-pulse"
            style={{ animationDelay: '0.6s' }}
          />
        </div>
      </div>

      {/* Progress bar + quiet stage copy. The bar is the "something's
          happening" anchor; the stage line sits small + calm beneath. */}
      <div className="w-full max-w-[320px] flex flex-col items-center gap-2.5">
        <div
          className="h-1 w-full rounded-full bg-stone-200/80 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          data-testid="generation-progress-bar"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center gap-1.5 min-h-[1rem]">
          <span
            aria-hidden
            className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"
          />
          <AnimatePresence mode="wait">
            <motion.p
              key={`${effectiveStage}-${stepIndex}-${showSlowHint ? 'slow' : ''}`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="text-[11px] font-medium tracking-wide text-keeper-meta whitespace-nowrap"
              aria-live="polite"
              role="status"
              data-testid="generation-stage-copy"
              data-stage={effectiveStage}
            >
              {stepLabel}
              {showSlowHint && (
                <span className="text-keeper-meta"> — almost there</span>
              )}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* The celebration quote — kept as the warm centrepiece. Centred
          column, left-aligned prose, hanging open-quote in brand/50. */}
      <div className="max-w-[560px] w-full text-left">
        <div className="min-h-[9rem]">
          <AnimatePresence mode="wait">
            {current && (
              <motion.p
                key={`${idx}-${current.text.slice(0, 40)}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                className="relative text-[20px] sm:text-[24px] text-keeper-ink leading-[1.5] font-light tracking-[-0.01em]"
                data-testid="celebration-fact"
              >
                <span
                  aria-hidden
                  className="absolute -left-5 sm:-left-7 top-0 text-brand/50 font-serif text-[28px] sm:text-[34px] leading-none select-none"
                >
                  &ldquo;
                </span>
                {current.text}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// AssemblingCard — the finalize/"assemble the card" spinner. NOT a
// generation: both sides already exist + were signed off, so this is a
// quick composite into the 3D reveal. A plain branded spinner reads
// honestly as "a moment", not another 90s wait. Replaces the celebration
// -quotes screen that used to flash here (Kevin, 2026-06-27).
// ─────────────────────────────────────────────────────────────────────
export function AssemblingCard() {
  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center gap-4"
      data-testid="assembling-card"
    >
      <Loader2 className="w-7 h-7 text-brand animate-spin" aria-hidden />
      <p
        className="text-sm font-medium text-keeper-meta tracking-wide"
        aria-live="polite"
        role="status"
      >
        Assembling your card…
      </p>
    </div>
  );
}
