// client/src/components/studio/card-thumb.tsx
//
// Compact 2D card preview used inside the regen edit mode. Replaces
// the 3D Card3DViewer in that surface for two reasons:
//
//   1. Three.js + drei is ~150kb of work to render — wasted while the
//      user is typing changes and looking at thumbnails of past tries.
//   2. The 3D viewer wants 60-68vh; edit mode wants the user to be
//      able to type, see the card, and see version history without
//      scrolling. A 2D thumb at ~280-320px solves all three at once.
//
// Visual language matches the /checkout preview chassis (Kevin's
// reference, 2026-04-26): white border, square aspect with
// object-contain so the whole card shows, divider, label strip.
// The pill switcher beneath single-side mode also mirrors checkout's
// PreviewTab — see the parent component for that.
//
// Three render modes, controlled by `target`:
//
//   • 'front'  — single chassis showing the front, label strip = "Front"
//   • 'inside' — single chassis showing the inside, label strip = "Inside"
//   • 'both'   — two chassis stacked vertically (Front above, Inside
//                below), each with its own label. No internal switcher.
//
// During regen, the image is replaced by a NarrationStage scaled to
// the chassis. One completion signal (the new image fading in) — no
// separate "✓ done" beat fighting for attention.

import { AnimatePresence, motion } from 'framer-motion';
import { ImageOff } from 'lucide-react';
import { NarrationStage } from './narration-stage';
import type { CardDraftState } from '@shared/schema';

export type ThumbTarget = 'front' | 'inside' | 'both';

interface CardThumbProps {
  frontUrl: string | null;
  insideUrl: string | null;
  /** Which face(s) to show. */
  target: ThumbTarget;
  /** True if the card was created with an inside (write or blank).
   *  When false, 'inside' and 'both' targets fall back to 'front'. */
  hasInside: boolean;
  /** Whether this side is currently being regenerated. The matching
   *  half (or whole, for single-side targets) shows the narration
   *  stage instead of the image. */
  regeneratingSide: 'front' | 'inside' | null;
  /** Draft state for narration personalisation — same source of truth
   *  the reveal-screen narration uses. */
  state: CardDraftState;
  /** Optional className for outer sizing. Default: max-w-[320px]. */
  className?: string;
}

export function CardThumb({
  frontUrl,
  insideUrl,
  target,
  hasInside,
  regeneratingSide,
  state,
  className,
}: CardThumbProps) {
  const resolvedTarget: ThumbTarget = !hasInside ? 'front' : target;

  if (resolvedTarget === 'both') {
    return (
      <div
        className={`flex flex-col gap-3 w-full max-w-[280px] sm:max-w-[320px] mx-auto ${className ?? ''}`}
        data-testid="card-thumb-both"
      >
        <ThumbChassis
          url={frontUrl}
          label="Front"
          isGenerating={regeneratingSide === 'front'}
          state={state}
        />
        <ThumbChassis
          url={insideUrl}
          label="Inside"
          isGenerating={regeneratingSide === 'inside'}
          state={state}
        />
      </div>
    );
  }

  const url = resolvedTarget === 'front' ? frontUrl : insideUrl;
  const label = resolvedTarget === 'front' ? 'Front' : 'Inside';
  const generating =
    (resolvedTarget === 'front' && regeneratingSide === 'front') ||
    (resolvedTarget === 'inside' && regeneratingSide === 'inside');

  return (
    <div
      className={`w-full max-w-[280px] sm:max-w-[320px] mx-auto ${className ?? ''}`}
      data-testid={`card-thumb-${resolvedTarget}`}
    >
      <ThumbChassis
        url={url}
        label={label}
        isGenerating={generating}
        state={state}
      />
    </div>
  );
}

// ── ThumbChassis — single labelled card preview ──────────────────────
// Visual language matched to the checkout preview chassis: white
// rounded border, aspect-square image well with object-contain so
// the whole card shows (greeting cards are square, but the chassis
// keeps everything aligned to a grid even if a future card uses a
// different aspect), a thin divider, and a label strip beneath.
function ThumbChassis({
  url,
  label,
  isGenerating,
  state,
}: {
  url: string | null;
  label: string;
  isGenerating: boolean;
  state: CardDraftState;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      <div className="aspect-square bg-stone-50 relative">
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="narration"
              className="absolute inset-0 flex items-center justify-center bg-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              data-testid="thumb-narration"
            >
              <div className="w-full h-full">
                <NarrationStage mode="running" state={state} />
              </div>
            </motion.div>
          ) : url ? (
            <motion.img
              key={url}
              src={url}
              alt={label}
              className="absolute inset-0 w-full h-full object-contain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          ) : (
            <motion.div
              key="empty"
              className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-stone-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ImageOff className="w-5 h-5" />
              <p className="text-[10px] uppercase tracking-[0.2em]">
                No image yet
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Label strip — same chassis pattern checkout uses for its
          Front/Inside switcher row, but here it's a static caption
          (the switcher itself lives outside the chassis in the
          parent so it can switch between two thumbs without
          duplicating chrome). Border-top divider matches checkout. */}
      <div className="px-4 py-2 border-t border-stone-100 flex items-center justify-center">
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-stone-500">
          {label}
        </p>
      </div>
    </div>
  );
}
