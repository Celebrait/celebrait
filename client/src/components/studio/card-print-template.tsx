// client/src/components/studio/card-print-template.tsx
//
// Small print-style reminders shown during the front-first review steps,
// so the creation reads as "you're building a real, printable card" —
// kept SECONDARY to the big card image, not the hero.
//   • CardOuterSpread — front step: tiny [back (logo) | front] spread.
//   • CardInnerSpread — inside step: tiny [blank-left | inside-right].
//   • CardPrintStrip  — 3D reveal: the 1-2-3-4 print file, as a reminder.
// See next_card_template_visual_approach.md.

import { Printer } from 'lucide-react';
import logoSrc from '@/assets/Logo2.png';

const cell = 'relative aspect-square flex-1 overflow-hidden bg-stone-100';

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-stone-400">
      <Printer className="h-3 w-3" strokeWidth={1.75} />
      {children}
    </span>
  );
}

/** Front step — small outer spread: back of card (logo) + front of card. */
export function CardOuterSpread({ frontUrl }: { frontUrl: string | null }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex w-[160px] overflow-hidden rounded-md border border-stone-300">
        <div className="relative flex aspect-square flex-1 items-end justify-center border-r border-dashed border-stone-300 bg-white pb-1.5">
          <img src={logoSrc} alt="Celebrait" className="h-2 opacity-60" />
        </div>
        <div className={cell}>
          {frontUrl && <img src={frontUrl} alt="" className="h-full w-full object-cover" />}
        </div>
      </div>
      <Caption>Print-ready · back + front</Caption>
    </div>
  );
}

/** Inside step — small inner spread: blank left + the inside artwork right. */
export function CardInnerSpread({ insideUrl }: { insideUrl: string | null }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex w-[160px] overflow-hidden rounded-md border border-stone-300">
        <div className="aspect-square flex-1 border-r border-dashed border-stone-300 bg-[#faf7f0]" />
        <div className={cell}>
          {insideUrl && <img src={insideUrl} alt="" className="h-full w-full object-cover" />}
        </div>
      </div>
      <Caption>Print-ready · inside spread</Caption>
    </div>
  );
}

/** 3D reveal — the print file laid out 1-2-3-4 (back · front · inside · inside),
 *  small, as a production reminder above the 3D card. */
export function CardPrintStrip({
  frontUrl,
  insideUrl,
}: {
  frontUrl: string | null;
  insideUrl: string | null;
}) {
  const panel = 'aspect-square w-11 shrink-0 overflow-hidden rounded-[3px] border border-stone-300';
  return (
    <div className="mx-auto flex flex-col items-center">
      <div className="flex gap-1">
        <div className={`${panel} flex items-end justify-center bg-white pb-1`}>
          <img src={logoSrc} alt="" className="h-2 opacity-60" />
        </div>
        <div className={`${panel} bg-stone-100`}>
          {frontUrl && <img src={frontUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className={`${panel} bg-[#faf7f0]`} />
        <div className={`${panel} bg-stone-100`}>
          {insideUrl && <img src={insideUrl} alt="" className="h-full w-full object-cover" />}
        </div>
      </div>
      <div className="mt-1 flex gap-1 text-[9px] text-stone-400">
        <span className="w-11 text-center">1 Back</span>
        <span className="w-11 text-center">2 Front</span>
        <span className="w-11 text-center">3 Inside</span>
        <span className="w-11 text-center">4 Inside</span>
      </div>
      <p className="mt-1.5 text-[11px] text-stone-400">Print file — how it's produced</p>
    </div>
  );
}
