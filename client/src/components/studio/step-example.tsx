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

import { useEffect, useState } from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import { useTexture } from '@react-three/drei';
import { Card3DViewer } from '@/components/card-3d-viewer';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import exampleFront from '@/assets/hero-card-front.jpg';
import exampleInside from '@/assets/hero-card-inside.jpg';

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex items-center gap-3 w-full sm:w-auto rounded-xl border border-keeper-hair bg-stone-50 px-4 py-3 text-left transition-colors hover:border-brand/40 hover:bg-white"
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
      <ExampleCardDialog
        open={open}
        onOpenChange={setOpen}
        eyebrow={eyebrow}
        modalTitle={modalTitle}
        modalDescription={modalDescription}
        show={show}
      />
    </>
  );
}

// ── ExampleCardDialog ────────────────────────────────────────────────
// The 3D example pop-up on its own, trigger-agnostic — extracted
// 2026-07-07 so surfaces with their own trigger markup (the inside
// fork cards in the post-reveal composer) can open the same example
// without inheriting StepExample's lightbulb trigger.
export function ExampleCardDialog({
  open,
  onOpenChange,
  eyebrow,
  modalTitle,
  modalDescription,
  show,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow: string;
  modalTitle: string;
  modalDescription: string;
  show: 'front' | 'inside';
}) {
  const showInside = show === 'inside';

  // Spinner-then-card: the 3D canvas takes a beat to spin up on open. Show a
  // spinner in the card slot until it's had time to render, then fade to the
  // card — so the wait reads as an intentional load, not a late pop-in. The
  // canvas remounts on each open, so reset per open.
  const [cardReady, setCardReady] = useState(false);
  useEffect(() => {
    if (!open) {
      setCardReady(false);
      return;
    }
    const t = window.setTimeout(() => setCardReady(true), 550);
    return () => window.clearTimeout(t);
  }, [open]);

  // Preload the example textures the moment the trigger renders on the step
  // — well before the user opens the modal — so the 3D card materialises
  // WITH the rest of the module instead of popping in a beat later (the
  // PNGs are a couple of MB to decode). Warms both the browser image cache
  // (<link rel=preload>) and drei's texture cache (useTexture.preload), so
  // the Card3DViewer's useTexture resolves instantly on open.
  useEffect(() => {
    const urls = [exampleFront, exampleInside];
    const links = urls.map((url) => {
      const el = document.createElement('link');
      el.rel = 'preload';
      el.as = 'image';
      // Match Three.js's crossOrigin='anonymous' loader — otherwise a no-cors
      // preload poisons the cache for cross-origin (R2) images and the texture
      // load fails (no ACAO) → WebGL context lost.
      el.crossOrigin = 'anonymous';
      el.href = url;
      document.head.appendChild(el);
      return el;
    });
    try {
      useTexture.preload(urls);
    } catch {
      /* drei occasionally throws on dev HMR re-runs — not worth crashing */
    }
    return () => {
      for (const el of links) el.parentNode?.removeChild(el);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            {/* The card (incl. the cover that overflows the slot) is faded in
                only once it's had time to render, so no part of it pops in
                during the spinner. opacity (not visibility) so r3f keeps
                rendering it warm behind the fade. */}
            <div
              className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-[460px] z-20 pointer-events-none transition-opacity duration-300 ${
                cardReady ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <Card3DViewer
                frontImageUrl={exampleFront}
                insideImageUrl={exampleInside}
                open={showInside}
                instantOpen={showInside}
                // Inside view: open + straight-on. Front view: the slightly-
                // ajar resting pose used on the landing 3D (gentle peek + a
                // touch of left turn) so it reads as a real 3D card, not flat.
                closedAngle={showInside ? 0 : -0.3}
                restYaw={showInside ? 0 : -0.1}
                interactive={false}
                enableRotate={false}
                enableZoom={false}
                framingMargin={showInside ? 1.72 : 1.7}
                minDistance={showInside ? 1.0 : 2.5}
                className="w-full h-full"
              />
            </div>
            {/* Spinner in the slot while the canvas spins up; fades out as
                the card fades in. No background — the card is hidden via its
                own opacity, and the centred eyebrow/body must stay visible. */}
            <div
              className={`absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-300 ${
                cardReady ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
              aria-hidden
            >
              <Loader2
                className="w-7 h-7 text-brand animate-spin"
                strokeWidth={1.75}
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
