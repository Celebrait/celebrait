// client/src/components/studio/narration-stage.tsx
//
// Personalised generation narration — the "Workbench" treatment
// (2026-04-24). Looks like looking over a craftsperson's shoulder as
// they build the card.
//
//   • Inter throughout — serif experiments were reverted 2026-04-24.
//     A typography pass may revisit later.
//   • Structured beats — the recipient's name renders in brand violet
//     italic; user-supplied quote fragments (scene, front text) render
//     in italic with curly quotes
//   • Thin violet progress line below — one segment per beat, grows in
//     sync with the headline cycling. Reads as craft progression, not
//     a loading bar
//
// Cycles indefinitely while server generation runs. On `mode="ready"`
// the current beat fades out and the ready line fades in, held until
// the parent unmounts the component for the card reveal.

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  buildPersonalBeats,
  buildReadyBeat,
  type NarrationBeat,
  type BeatPart,
} from './narration-copy';
import type { CardDraftState } from '@shared/schema';

export type NarrationMode = 'running' | 'ready';

interface NarrationStageProps {
  mode: NarrationMode;
  /** Full draft — used to personalise every beat (name, occasion,
   *  scene quote, style adjective, front-text quote, inside treatment). */
  state: CardDraftState;
}

// Per-beat dwell time. Picked to read as "considered pause" without
// dragging. Across 6 beats that's ~25s per full cycle — generation
// typically outlasts that, so we just loop.
const BEAT_MS = 4200;

export function NarrationStage({ mode, state }: NarrationStageProps) {
  const isReady = mode === 'ready';
  const beats = buildPersonalBeats(state);
  const readyBeat = buildReadyBeat(state);

  const [beatIndex, setBeatIndex] = useState(0);

  useEffect(() => {
    if (isReady) return;
    const t = window.setInterval(() => {
      setBeatIndex((i) => (i + 1) % beats.length);
    }, BEAT_MS);
    return () => window.clearInterval(t);
  }, [isReady, beats.length]);

  // Which beat to render. In ready mode we short-circuit to the ready
  // beat — index is used only for the progress-line segment count.
  const currentBeat = isReady ? readyBeat : beats[beatIndex]!;
  const swapKey = isReady ? 'ready' : `beat-${beatIndex}`;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Cream background dropped 2026-04-24 — Kevin felt it fought the
          rest of the studio chrome. The page's default surface shows
          through. Typography + progress line carry the warmth on their
          own. */}

      <div className="relative flex flex-col items-center gap-10 px-6 max-w-[760px] w-full">
        {/* Small label at top — signals this is the making moment,
            not a loading screen. Small caps, barely there. */}
        <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium">
          Crafting
        </p>

        {/* Headline beat — serif, large, personalised */}
        <div className="min-h-[6rem] sm:min-h-[7rem] flex items-center justify-center w-full">
          <AnimatePresence mode="wait">
            <motion.p
              key={swapKey}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
              className="text-3xl sm:text-4xl md:text-5xl font-semibold text-ink text-center leading-tight"
              data-testid={isReady ? 'narration-ready-line' : 'narration-headline'}
              data-beat-id={currentBeat.id}
            >
              {currentBeat.parts.map((p, i) => (
                <BeatPartSpan key={i} part={p} />
              ))}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress line — 6 beats = 6 segments. Each lights up
            violet as its beat plays. In ready mode every segment is
            filled (visual cue that we've reached the end). Segments
            stay lit once filled so the line reads as accumulated craft,
            not a reset-every-cycle loader. */}
        <ProgressLine
          segments={beats.length}
          activeIndex={isReady ? beats.length : beatIndex}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// BeatPartSpan — renders one structured piece of a beat with styling
// that depends on its kind. Name = brand violet italic, quote = italic
// with curly punctuation, em = soft italic, plain = regular weight.
// ─────────────────────────────────────────────────────────────────────

function BeatPartSpan({ part }: { part: BeatPart }) {
  switch (part.kind) {
    case 'plain':
      return <span>{part.text}</span>;
    case 'name':
      return (
        <span className="italic text-brand-dark font-medium">{part.text}</span>
      );
    case 'quote':
      // Rendered with curly quotes so a fragment reads as quoted
      // material, not a typed string.
      return (
        <span className="italic text-ink/85">
          {'\u201C'}
          {part.text}
          {'\u201D'}
        </span>
      );
    case 'em':
      return <span className="italic text-ink/75">{part.text}</span>;
  }
}

// ─────────────────────────────────────────────────────────────────────
// ProgressLine — thin horizontal row of violet segments that light up
// one per beat as narration cycles. Purely decorative; no "estimated
// time left" pretence. The final segment is the "ready" beat.
// ─────────────────────────────────────────────────────────────────────

function ProgressLine({
  segments,
  activeIndex,
}: {
  segments: number;
  activeIndex: number;
}) {
  return (
    <div className="flex items-center gap-1.5 w-40 sm:w-56">
      {Array.from({ length: segments }).map((_, i) => (
        <motion.div
          key={i}
          className="h-px flex-1 rounded-full origin-left"
          initial={false}
          animate={{
            backgroundColor:
              i < activeIndex
                ? 'rgba(92,87,212,0.85)' // brand-dark — filled
                : i === activeIndex
                  ? 'rgba(122,118,232,0.7)' // brand — currently-playing
                  : 'rgba(0,0,0,0.08)', // inactive
            scaleX: i <= activeIndex ? 1 : 0.85,
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
