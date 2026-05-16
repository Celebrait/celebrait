// client/src/components/studio/generation-wait.tsx
//
// The screen the user sees while their card generates.
//
// Layout (2026-04-27 — Kevin: "the quotes are great but it's not
// actually obvious a card is generating, needs a clearer visual"):
//
//   ┌─────────────────────────────────────────────┐
//   │                                             │
//   │           ┌───────────────┐                 │
//   │           │░░░░░░░░░░░░░░│  ← shimmering    │
//   │           │ ░░ sweeping ░│    card silhouette│
//   │           │░░░░░░░░░░░░░░│  (the "I am being │
//   │           └───────────────┘   made" anchor)  │
//   │                                             │
//   │       •  Drawing the front — this bit takes  │
//   │          the longest                         │
//   │                                             │
//   │     " The Dutch call certain birthdays      │
//   │       crown years — 5, 10, 15, 20, 21, 50…  │
//   │                                             │
//   └─────────────────────────────────────────────┘
//
//   • Card-shaped skeleton with a diagonal shimmer sweep is the primary
//     "your card is being made" signal — no words required.
//   • Below it, a status row driven by the actual GENERATION STAGE the
//     server is on (front / inside / finishing / ready). Replaces the
//     2026-04-27 elapsed-time tiers, which lied to the user about what
//     was happening — they cycled through "polishing the details" and
//     "finishing touches" even when the front image hadn't started yet
//     (per server logs 2026-05-13). Stage signal is derived in
//     RevealView from `frontUrl` / `insideUrl` / `insideMode` /
//     `status`, both populated by the existing /api/studio/drafts/:id
//     poll — no new server work needed.
//   • Per-stage "taking longer than usual" warning kicks in if the
//     current stage exceeds 120s. The gpt-image-2 worst-case is ~4 min
//     per side, so users hit this around halfway through each stage
//     and get a real reassurance instead of a static "about a minute"
//     that's been wrong for 90 seconds.
//   • Centred column, left-aligned celebration quote at the bottom for
//     warmth. Hanging open-quote in brand/50.
//
// Facts come from lib/celebration-facts.ts (static, occasion-tagged).

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  /** Where the server is in the generation pipeline. Drives the
   *  status copy beneath the silhouette. Defaults to 'front' so older
   *  call sites that don't pass it still render sensibly. */
  stage?: GenerationStage;
  /** Whether the user has chosen `inside: 'blank'`. When true we never
   *  show the "writing the inside" copy — the gen skips that step and
   *  goes front → finishing. */
  hasInside?: boolean;
}

// Time each fact sits on screen before the next fades in.
// Was 7500ms — Kevin's test 2026-04-26 read it as too slow. Dropped
// to 5500ms so a ~45s gen cycles ~8 facts (was ~6) — more energy,
// fewer "is anything happening?" moments without rushing the read.
const CYCLE_MS = 5500;

// If the current stage has been running for >SLOW_AFTER_MS, swap the
// sub-label to a reassuring "the model is having a moment" variant.
// 120s picked because gpt-image-2 at quality=high routinely runs
// 3–4 min per side; halfway through is where users start to wonder.
const SLOW_AFTER_MS = 120_000;

// Per-stage status copy. Replaces the old elapsed-time-tiered copy
// which lied about what was happening (escalated by wall-clock even
// when the actual stage hadn't progressed).
interface StageCopy {
  label: string;
  subLabel: string;
  slowSubLabel: string;
}

const STAGE_COPY: Record<GenerationStage, StageCopy> = {
  front: {
    label: 'Drawing the front',
    subLabel: 'this bit takes the longest',
    slowSubLabel: "the model's taking its time — hang tight",
  },
  inside: {
    label: 'Now writing the inside',
    subLabel: 'almost there',
    slowSubLabel: 'still working on it — nearly done',
  },
  finishing: {
    label: 'Final touches',
    subLabel: 'putting it together',
    slowSubLabel: 'putting it together',
  },
  ready: {
    label: 'Your card has arrived',
    subLabel: '',
    slowSubLabel: '',
  },
};

export function GenerationWaitStage({
  occasion = null,
  stage = 'front',
  hasInside = true,
}: GenerationWaitStageProps) {
  const facts = useMemo(() => buildCelebrationFeed(occasion), [occasion]);
  const [idx, setIdx] = useState(0);

  // Per-stage elapsed timer. Resets whenever the stage transitions so
  // a 4-minute front stage doesn't carry its "slow" flag into the
  // inside stage. The dependency on `stage` in the effect below is the
  // reset trigger.
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

  // Tick elapsed-in-current-stage every second; reset on stage change.
  useEffect(() => {
    setElapsedInStageMs(0);
    const start = Date.now();
    const t = window.setInterval(() => {
      setElapsedInStageMs(Date.now() - start);
    }, 1000);
    return () => window.clearInterval(t);
  }, [stage]);

  // If the user picked `inside: 'blank'`, the generation skips the
  // inside stage entirely (front → finishing → ready). Pre-empt the
  // 'inside' label if we ever briefly receive that stage from upstream
  // — defensive, shouldn't happen if the derive function is correct.
  const effectiveStage: GenerationStage =
    !hasInside && stage === 'inside' ? 'finishing' : stage;

  const copy = STAGE_COPY[effectiveStage];
  const isSlow = elapsedInStageMs > SLOW_AFTER_MS;
  const subLabel = isSlow ? copy.slowSubLabel : copy.subLabel;

  const current: CelebrationFact | null = facts[idx] ?? null;

  return (
    // Wrapper px-8 minimum so the hanging quote glyph (-left-5 / -7)
    // doesn't clip on narrow viewports. Vertical stack: silhouette →
    // status → quote. gap-* tuned so all three breathe even on tighter
    // viewports without the silhouette losing presence.
    <div className="relative w-full h-full flex flex-col items-center justify-center px-8 gap-6 sm:gap-8 py-8">
      {/* Card silhouette — the primary "this is happening" anchor.
          Aspect ratio approximates the real card chassis (5:7-ish)
          so the eye reads it as a card, not a generic block. The
          shimmer band is a single absolutely-positioned div sweeping
          left-to-right via the keyframe in index.css; it's clipped
          to the rounded corners by overflow-hidden on the parent.
          Subtle bg gradient + brand glow adds warmth so it doesn't
          feel like a sterile loading skeleton. */}
      <div
        className="relative w-32 sm:w-36 aspect-[5/7] rounded-xl overflow-hidden bg-gradient-to-br from-brand-muted via-brand-muted/70 to-brand-muted/90 shadow-[0_8px_30px_-8px_rgba(124,58,237,0.35)] ring-1 ring-brand/15"
        aria-hidden
        data-testid="generation-card-silhouette"
      >
        {/* Diagonal shimmer band — soft bright stripe sweeping across
            the silhouette every 2.4s. Skewed for a more natural light
            sweep feel. */}
        <div className="absolute inset-y-0 -inset-x-1/2 flex items-center">
          <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/70 to-transparent skew-x-[-12deg] animate-shimmer-sweep" />
        </div>
        {/* Three faint placeholder lines at the bottom — reads as "card
            text being laid down" without committing to specific content.
            Pulse softly on top of the shimmer for layered motion. */}
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

      {/* Status — pulsing brand dot + stage-driven copy. Crossfades on
          stage transitions (front → inside → finishing → ready) and
          when the per-stage slow flag flips. */}
      <div className="flex items-center gap-2 min-h-[1.25rem]">
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"
        />
        <AnimatePresence mode="wait">
          <motion.p
            key={`${effectiveStage}-${isSlow ? 'slow' : 'normal'}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="text-[12px] font-medium tracking-wide text-stone-600 whitespace-nowrap"
            aria-live="polite"
            role="status"
            data-testid="generation-status"
            data-stage={effectiveStage}
          >
            {copy.label}
            {subLabel && (
              <span className="text-stone-400"> — {subLabel}</span>
            )}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* The fact — centred column, left-aligned prose, hanging
          open-quote in brand/50. min-h reserves space so the layout
          doesn't jump on quote swap. font-serif on the quote glyph
          uses the system serif fallback (Iowan / Georgia) — no font
          load needed. */}
      <div className="max-w-[560px] w-full text-left">
        <div className="min-h-[10rem]">
          <AnimatePresence mode="wait">
            {current && (
              <motion.p
                key={`${idx}-${current.text.slice(0, 40)}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                className="relative text-[20px] sm:text-[24px] text-ink leading-[1.5] font-light tracking-[-0.01em]"
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
