// client/src/components/studio/step-example.tsx
//
// StepExample — a small "See an example →" helper dropped onto the authoring
// steps (scene / front text / inside text). Click it → a pop-up showing ONE
// house-style example card as a front-on 3D render, with a short description.
//
// Design intent (Kevin 2026-06-02):
//   • ONE example card, used CONSISTENTLY across the steps. Per-step copy +
//     which FACE is shown differ; the art is the same everywhere.
//   • Trigger = helper icon + text. Pop-up = the 3D card, front-on:
//       - show='front'  → slightly-ajar resting pose (like the landing 3D)
//       - show='inside' → already open, inside facing you, cover spilling off
//   • It's an EXAMPLE, not a preview of the user's card.
//
// Perf — "lands with the module, not a beat later":
//   The 3D card lagged behind the DOM text because (a) its PNGs decode and
//   (b) the WebGL canvas spins up only when the modal opens. We fix both:
//     1. Preload textures the moment the trigger renders (browser cache +
//        drei cache).
//     2. WARM the canvas on trigger hover/focus — render the (hidden) modal
//        content so the WebGL context + first frame are ready BEFORE the
//        click. Built on Radix primitives with forceMount so the canvas can
//        live hidden (visibility, not display, so it keeps rendering) until
//        opened. Only mounts after first hover, so there's no idle 3D canvas
//        on a step the user never engages with.
//
// TODO(Kevin): swap the placeholder hero card art for curated house-style
// art once produced. One swap here updates every step.

import { useEffect, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { useTexture } from '@react-three/drei';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Card3DViewer } from '@/components/card-3d-viewer';
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
   *  'front'  → card slightly ajar (the landing resting pose).
   *  'inside' → card open, the inside facing you. */
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
  // `mounted` renders the (hidden) modal content so the 3D canvas warms
  // before the click. Set on trigger hover/focus; stays for the step once
  // engaged (no idle canvas on a step the user never hovers).
  const [mounted, setMounted] = useState(false);
  const showInside = show === 'inside';

  // Preload the example textures the moment the trigger renders.
  useEffect(() => {
    const urls = [exampleFront, exampleInside];
    const links = urls.map((url) => {
      const el = document.createElement('link');
      el.rel = 'preload';
      el.as = 'image';
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
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setMounted(true);
      }}
    >
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          onMouseEnter={() => setMounted(true)}
          onFocus={() => setMounted(true)}
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
      </DialogPrimitive.Trigger>

      {(mounted || open) && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay
            forceMount
            className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=closed]:invisible data-[state=closed]:pointer-events-none"
          />
          <DialogPrimitive.Content
            forceMount
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-xl -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 sm:rounded-lg data-[state=closed]:invisible data-[state=closed]:pointer-events-none"
          >
            {/* No visible headline — the eyebrow + card carry it. Title is
                screen-reader only (Radix a11y). */}
            <DialogPrimitive.Title className="sr-only">
              {modalTitle}
            </DialogPrimitive.Title>

            <div className="flex flex-col items-center gap-4 pt-1 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
                {eyebrow}
              </span>

              {/* Card — front-on 3D. Inside view: already open, cover spills
                  off the left + over the eyebrow/body (canvas taller than its
                  slot, z-layered above, full-bleed -mx-6). Front view: the
                  slightly-ajar landing pose. Static. */}
              <div className="self-stretch -mx-6 h-[300px] relative">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[460px] z-20 pointer-events-none">
                  <Card3DViewer
                    frontImageUrl={exampleFront}
                    insideImageUrl={exampleInside}
                    open={showInside}
                    instantOpen={showInside}
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
              </div>

              <p className="max-w-[420px] text-center text-[14px] leading-relaxed text-stone-700">
                {modalDescription}
              </p>
              <p className="text-[11px] text-stone-400">
                An example of our house style — yours will be your own.
              </p>
            </div>

            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
}
