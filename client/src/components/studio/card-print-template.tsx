// client/src/components/studio/card-print-template.tsx
//
// Print-style card templates shown during the front-first review steps,
// so the creation reads as "you're building a real, printable card".
//   • CardOuterSpread — the front step: [back (logo) | front] spread.
//   • CardInnerSpread — the inside step: [blank-left | inside-right] spread.
//   • CardPrintStrip  — the 3D reveal: the 1-2-3-4 print file, small, as a
//     "here's how it's produced" reminder.
// See next_card_template_visual_approach.md.

import logoSrc from '@/assets/Logo2.png';

function PanelLabels({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-1.5 flex">
      <span className="flex-1 text-center text-[11px] text-stone-400">{left}</span>
      <span className="flex-1 text-center text-[11px] text-stone-400">{right}</span>
    </div>
  );
}

/** Front step — the outer spread: back of card (logo) + front of card. */
export function CardOuterSpread({ frontUrl }: { frontUrl: string | null }) {
  return (
    <div className="mx-auto max-w-[380px]">
      <div className="rounded-xl border border-stone-200 bg-white p-3.5">
        <div className="flex overflow-hidden rounded-md border border-stone-300">
          <div className="relative flex aspect-square flex-1 items-end justify-center border-r border-dashed border-stone-300 bg-white pb-3">
            <img src={logoSrc} alt="Celebrait" className="h-3.5 opacity-70" />
          </div>
          <div className="relative aspect-square flex-1 overflow-hidden bg-stone-100">
            {frontUrl && (
              <img src={frontUrl} alt="Card front" className="h-full w-full object-cover" />
            )}
          </div>
        </div>
        <PanelLabels left="Back of card" right="Front of card" />
      </div>
    </div>
  );
}

/** Inside step — the inner spread: blank left + the inside artwork right. */
export function CardInnerSpread({ insideUrl }: { insideUrl: string | null }) {
  return (
    <div className="mx-auto max-w-[380px]">
      <div className="rounded-xl border border-stone-200 bg-white p-3.5">
        <div className="flex overflow-hidden rounded-md border border-stone-300">
          <div className="aspect-square flex-1 border-r border-dashed border-stone-300 bg-[#faf7f0]" />
          <div className="relative aspect-square flex-1 overflow-hidden bg-stone-100">
            {insideUrl && (
              <img src={insideUrl} alt="Card inside" className="h-full w-full object-cover" />
            )}
          </div>
        </div>
        <PanelLabels left="Inside left (blank)" right="Inside" />
      </div>
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
  const cell = 'aspect-square w-11 shrink-0 overflow-hidden rounded-[3px] border border-stone-300';
  return (
    <div className="mx-auto flex flex-col items-center">
      <div className="flex gap-1">
        <div className={`${cell} flex items-end justify-center bg-white pb-1`}>
          <img src={logoSrc} alt="" className="h-2 opacity-60" />
        </div>
        <div className={`${cell} bg-stone-100`}>
          {frontUrl && <img src={frontUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className={`${cell} bg-[#faf7f0]`} />
        <div className={`${cell} bg-stone-100`}>
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
