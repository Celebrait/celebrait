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
//
// Three render modes, controlled by `target`:
//
//   • 'front'  — single chassis showing the front, label strip = "Front"
//   • 'inside' — single chassis showing the inside, label strip = "Inside"
//   • 'both'   — two chassis side-by-side (Front left, Inside right) on
//                desktop; stacked only at the very narrowest breakpoints
//                where horizontal layout would crush both thumbs. Each
//                chassis has its own label.
//
// During regen the chassis swaps to a clean spinner — no narration
// text, no progress beats. Dropped 2026-04-26 per Kevin's feedback:
// the in-thumb narration was reading as stale during the ~30s wait
// and competing with the action elsewhere on the page. A spinner is
// the honest "this is happening, hold on" signal.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ImageOff, Loader2 } from 'lucide-react';

export type ThumbTarget = 'front' | 'inside' | 'both';

// G10 — staged wait copy shown under the spinner during a regen, advancing
// every ~13s. Honest stages (no fake progress %); makes a 45-90s wait read
// as "working" rather than "stuck on a spinner".
const WAIT_MESSAGES = [
  'Reading your tweak…',
  'Re-drawing the scene…',
  'Bringing it to life…',
  'Almost there…',
];

interface CardThumbProps {
  frontUrl: string | null;
  insideUrl: string | null;
  /** Which face(s) to show. */
  target: ThumbTarget;
  /** True if the card was created with an inside (write or blank).
   *  When false, 'inside' and 'both' targets fall back to 'front'. */
  hasInside: boolean;
  /** Whether this side is currently being regenerated. The matching
   *  half (or whole, for single-side targets) shows a spinner instead
   *  of the image. */
  regeneratingSide: 'front' | 'inside' | null;
  /** Optional className for outer sizing. Default: max-w-[320px]
   *  (single side) / max-w-[560px] (both, side-by-side). */
  className?: string;
}

export function CardThumb({
  frontUrl,
  insideUrl,
  target,
  hasInside,
  regeneratingSide,
  className,
}: CardThumbProps) {
  const resolvedTarget: ThumbTarget = !hasInside ? 'front' : target;

  if (resolvedTarget === 'both') {
    // Side-by-side on most viewports — they're both small thumbs;
    // horizontal lets the eye compare front + inside at a glance.
    // Stacks only on the tightest mobile (<420px or so) where
    // ~140px thumbs would feel cramped horizontally.
    return (
      <div
        className={`grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 w-full max-w-[560px] mx-auto ${className ?? ''}`}
        data-testid="card-thumb-both"
      >
        <ThumbChassis
          url={frontUrl}
          label="Front"
          isGenerating={regeneratingSide === 'front'}
        />
        <ThumbChassis
          url={insideUrl}
          label="Inside"
          isGenerating={regeneratingSide === 'inside'}
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
      <ThumbChassis url={url} label={label} isGenerating={generating} />
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
}: {
  url: string | null;
  label: string;
  isGenerating: boolean;
}) {
  // The url whose pixels are actually painted on screen. Drives the
  // decode-gate so the spinner only lifts to REAL pixels, never a stale
  // frame ("lands too early then pops"). onLoad fires for cached images
  // too, so preloaded version switches resolve in ~a frame.
  const [paintedUrl, setPaintedUrl] = useState<string | null>(url);

  // Hold the working overlay across a regen COMPLETION until the new
  // image has decoded. Plain version switches (not preceded by
  // generating) don't set this — the src swap is instant for preloaded
  // images, so we don't veil them.
  const [holdForDecode, setHoldForDecode] = useState(false);
  const prevGeneratingRef = useRef(isGenerating);
  useEffect(() => {
    if (prevGeneratingRef.current && !isGenerating) {
      // regen just ended — if the (new) image hasn't painted yet, keep
      // the overlay up until it does.
      setHoldForDecode(url != null && url !== paintedUrl);
    }
    prevGeneratingRef.current = isGenerating;
  }, [isGenerating, url, paintedUrl]);
  useEffect(() => {
    if (paintedUrl === url) setHoldForDecode(false);
  }, [paintedUrl, url]);

  const showOverlay = isGenerating || holdForDecode;

  // G10 — progressive wait feedback. A lone static spinner for 45-90s
  // reads as "stuck"; a line that advances through honest stages reads as
  // "working". Steps are time-based (no fake %), capped at the last one.
  const [waitStep, setWaitStep] = useState(0);
  useEffect(() => {
    if (!isGenerating) {
      setWaitStep(0);
      return;
    }
    const id = setInterval(
      () => setWaitStep((s) => Math.min(s + 1, WAIT_MESSAGES.length - 1)),
      13000,
    );
    return () => clearInterval(id);
  }, [isGenerating]);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      <div className="aspect-square bg-stone-50 relative">
        {/* The image stays MOUNTED across regens + version switches.
            Two wins vs the old AnimatePresence-mode="wait" swap:
            (1) no remount → preloaded version-rail switches are instant,
            no cross-fade lag; (2) changing src keeps the previous frame
            painted until the new one decodes → no flash to white. */}
        {url ? (
          <img
            src={url}
            alt={label}
            onLoad={() => setPaintedUrl(url)}
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : !isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-stone-400">
            <ImageOff className="w-5 h-5" />
            <p className="text-[10px] uppercase tracking-[0.2em]">
              No image yet
            </p>
          </div>
        ) : null}

        {/* Regen spinner is an OVERLAY on top of the prior image — the
            user keeps seeing THEIR card, just "working". It stays up
            until the NEW image has decoded (holdForDecode), so it lifts
            to real pixels in one clean reveal — never to the old frame. */}
        <AnimatePresence>
          {showOverlay && (
            <motion.div
              key="regen-overlay"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              data-testid="thumb-spinner"
            >
              <Loader2 className="w-6 h-6 text-brand animate-spin" />
              {/* G10 — rotating wait copy. Crossfade between honest stages so a
                  45-90s wait reads as "working", not "stuck". During the brief
                  decode-hold (holdForDecode, not isGenerating) waitStep is 0,
                  so it settles on the first line — fine for a sub-second beat. */}
              <div className="h-3 flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={waitStep}
                    className="text-[10px] uppercase tracking-[0.2em] font-medium text-stone-500"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                  >
                    {WAIT_MESSAGES[waitStep]}
                  </motion.p>
                </AnimatePresence>
              </div>
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
