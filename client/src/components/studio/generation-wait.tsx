// client/src/components/studio/generation-wait.tsx
//
// The screen the user sees while their card generates. Replaces the
// older NarrationStage with a top-anchored status whisper + a centred
// celebration quote — Kevin 2026-04-24, audit'd 2026-04-25, simplified
// further the same morning (kicker dropped, status moved up).
//
// Layout:
//
//   ┌─────────────────────────────────────────────┐
//   │       •  Crafting your card — about a minute │
//   │                                             │
//   │                                             │
//   │     " The Dutch call certain birthdays      │
//   │       crown years — 5, 10, 15, 20, 21, 50 — │
//   │       and decorate the birthday chair       │
//   │       with flowers and paper garlands.      │
//   │                                             │
//   └─────────────────────────────────────────────┘
//
//   • Single chrome element at the top (pulsing dot + copy) does
//     both jobs: confirms generation is active + carries gift-voice
//     brand language. No kicker, no bottom status — one anchor only.
//   • Centred column, left-aligned prose.
//   • Hanging open-quote in brand/50 — the single typographic flourish.
//
// Facts come from lib/celebration-facts.ts (static, occasion-tagged).

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  buildCelebrationFeed,
  type CelebrationFact,
} from '@/lib/celebration-facts';

interface GenerationWaitStageProps {
  /** Optional occasion key (e.g. 'birthday') — biases the feed toward
   *  occasion-specific facts. Unknown/missing falls back to general. */
  occasion?: string | null;
}

// Time each fact sits on screen before the next fades in.
const CYCLE_MS = 7500;

export function GenerationWaitStage({ occasion = null }: GenerationWaitStageProps) {
  const facts = useMemo(() => buildCelebrationFeed(occasion), [occasion]);
  const [idx, setIdx] = useState(0);

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

  const current: CelebrationFact | null = facts[idx] ?? null;

  return (
    // Wrapper px-8 minimum so the hanging quote glyph (-left-5 / -7)
    // doesn't clip on narrow viewports.
    <div className="relative w-full h-full flex flex-col items-center justify-center px-8">
      {/* Status — top of the container. Pulsing brand dot + warm copy.
          The single chrome element on the page; carries both "system
          alive" and the gift-voice. */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"
        />
        <p className="text-[11px] font-medium tracking-wide text-stone-500 whitespace-nowrap">
          Crafting your card
          <span className="text-stone-400"> — about a minute</span>
        </p>
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
                className="relative text-[22px] sm:text-[26px] text-ink leading-[1.5] font-light tracking-[-0.01em]"
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
