// client/src/components/studio/step-example.tsx
//
// StepExample — a small "see an example" helper dropped onto the authoring
// steps (scene / front text / inside text). Click it → a pop-up module
// shows ONE house-style example card as a 3D render, front-on, with a short
// line of assist copy.
//
// Design intent (Kevin 2026-06-02):
//   • ONE example card, used CONSISTENTLY across the steps — the user
//     builds familiarity with the house style rather than browsing a
//     gallery. Per-step copy + which FACE is shown differ; the art is the
//     same everywhere.
//   • It's an EXAMPLE, not a preview of the user's card (nothing's
//     generated yet at these steps).
//   • Trigger = helper icon + text. Pop-up = the 3D card, front-on:
//       - show='front'  → closed, the front facing you (scene / front text)
//       - show='inside' → open, only the inside facing you (inside text)
//
// Rollout: proven on the inside step first; the scene + front-text steps
// reuse this with their own `eyebrow` / `assist` / copy + show='front'.
//
// TODO(Kevin): swap the placeholder hero card art for a CURATED house-style
// example once produced. One swap here updates every step.

import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Card3DViewer } from '@/components/card-3d-viewer';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import exampleFront from '@/assets/hero-card-front.png';
import exampleInside from '@/assets/hero-card-inside.png';

interface StepExampleProps {
  /** Small eyebrow label above the card, e.g. "Inside Text Example". */
  eyebrow: string;
  /** Short line in the trigger — what this step's example shows. */
  assist: string;
  /** Accessible pop-up title (visually hidden — the card carries it). */
  modalTitle: string;
  /** Pop-up body — what to notice / how to think about this step. */
  modalDescription: string;
  /** Which face to present, front-on:
   *  'front'  → card closed, front facing you.
   *  'inside' → card open, only the inside facing you. */
  show: 'front' | 'inside';
}

export function StepExample({
  eyebrow,
  assist,
  modalTitle,
  modalDescription,
  show,
}: StepExampleProps) {
  const [open, setOpen] = useState(false);
  const showInside = show === 'inside';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-3 w-full sm:w-auto rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-left transition-colors hover:border-brand/40 hover:bg-white"
          data-testid="step-example-trigger"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-muted text-brand shrink-0">
            <Lightbulb className="w-4 h-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] text-stone-600 leading-snug">
              {assist}
            </span>
            <span className="text-[13px] font-medium text-brand group-hover:text-brand-dark">
              See an example →
            </span>
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        {/* No visible headline (Kevin) — the eyebrow + card carry it. Title
            stays for screen-reader/Radix a11y only. */}
        <DialogTitle className="sr-only">{modalTitle}</DialogTitle>

        <div className="flex flex-col items-center gap-4 pt-1 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
            {eyebrow}
          </span>

          {/* The card as a front-on 3D render — closed (front) or open
              (inside) per `show`. Renders ALREADY open (no swing), centred
              on the INSIDE square.
              - FULL-BLEEDS the dialog padding (-mx-6) so the cover flows off
                the left edge with no whitespace border.
              - The canvas is TALLER than its layout slot and z-layered ABOVE
                the eyebrow/body, so the opened cover spills OVER those areas
                (it's transparent + sits on the left, clear of the centred
                text) for a full open-card effect instead of being clipped
                behind the slot. framingMargin is scaled to the taller canvas
                so the inside stays the same on-screen size.
              Static: no rotate/zoom. */}
          <div className="self-stretch -mx-6 h-[300px] relative">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[460px] z-20 pointer-events-none">
              <Card3DViewer
                frontImageUrl={exampleFront}
                insideImageUrl={exampleInside}
                open={showInside}
                instantOpen={showInside}
                closedAngle={0}
                restYaw={0}
                interactive={false}
                enableRotate={false}
                enableZoom={false}
                framingMargin={showInside ? 1.72 : 1.7}
                minDistance={showInside ? 1.0 : 2.5}
                className="w-full h-full"
              />
            </div>
          </div>

          <p className="max-w-[420px] text-center text-[14px] leading-relaxed text-stone-700">
            {modalDescription}
          </p>
          <p className="text-[11px] text-stone-400">
            An example of our house style — yours will be your own.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
