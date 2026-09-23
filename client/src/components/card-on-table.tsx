// client/src/components/card-on-table.tsx — THE CARD, ON A REAL TABLE
//
// A photographic mockup: the finished card art warped into a real
// photograph of a card standing on a wooden table, beside a plant, a
// pen and an envelope (Aidan 2026-09-23: "any way you could get this
// card looking like its on a real kitchen counter as the reveal lol?"
// — static, which is exactly what lets it look real rather than a flat
// card floating on a backdrop).
//
// The plate is `/hero-real-card.webp`, already in the repo. Its card
// stands slightly open with BOTH panels unoccluded — no hand or object
// crossing an edge — which is the whole reason it works as a mockup.
// The finished front is warped onto the panel the real front occupies;
// the right-hand page, a narrow strip seen almost edge-on, is filled
// with warm paper rather than art (see below). The plate's lighting is
// then rebuilt over the top so the new art sits in the same warm key
// instead of looking pasted on.
//
// Nothing is generated and nothing is fetched: one photograph and a
// couple of CSS transforms, so it costs nothing and lands instantly.

import { useEffect, useRef, useState } from 'react';

const PLATE = '/hero-real-card.webp';
const PLATE_W = 1100;
const PLATE_H = 734;

type Quad = [number, number][]; // tl, tr, br, bl — in plate pixels

/** Where the real card's two panels sit in the photograph. Measured off
 *  the plate, then nudged out a few pixels so no sliver of the original
 *  card can peek around the edge of the new art. */
const FRONT_QUAD: Quad = [[268, 40], [780, 92], [778, 662], [270, 626]];
const INSIDE_QUAD: Quad = [[780, 92], [860, 8], [828, 600], [778, 662]];
/** The far page's top edge, visible as a band ABOVE the front panel
 *  because the card stands open. Left as the plate, it is the original
 *  card's floral border sitting over the new art. */
const FAR_TOP_QUAD: Quad = [[258, 12], [862, 4], [780, 92], [268, 40]];

/** Unit square → quad, the closed form (Heckbert). The nine numbers of
 *  the homography, which CSS then takes as a matrix3d. */
function unitSquareTo(q: Quad) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  if (dx3 === 0 && dy3 === 0) {
    return { a: x1 - x0, b: x2 - x1, c: x0, d: y1 - y0, e: y2 - y1, f: y0, g: 0, h: 0 };
  }
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  return {
    a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0,
    d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0, g, h,
  };
}

/** What an element of `w`×`h` needs to land exactly on `q`. The scale
 *  maps the element onto the unit square; the matrix maps that square
 *  onto the quad, in plate pixels. */
function quadTransform(q: Quad, w: number, h: number): string {
  const { a, b, c, d, e, f, g, h: hh } = unitSquareTo(q);
  const m = [a, d, 0, g, b, e, 0, hh, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${m.join(',')}) scale(${1 / w}, ${1 / h})`;
}

const SRC = 1000; // the square every layer is authored at, pre-warp

export interface CardOnTableProps {
  frontImageUrl: string;
  className?: string;
  /** Fires once the art has decoded, so a caller can hold the screen
   *  back rather than let it pop in. */
  onReady?: () => void;
}

export function CardOnTable({ frontImageUrl, className = '', onReady }: CardOnTableProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [ready, setReady] = useState(false);

  // Everything is laid out in the plate's own pixel space and scaled as
  // one piece, so every quad stays registered to the photo at any size.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) setScale(r.width / PLATE_W);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { if (ready) onReady?.(); }, [ready, onReady]);

  /** A flat layer shaped to a quad — art or shading. */
  const layer = (q: Quad, style: React.CSSProperties, key: string, children?: React.ReactNode) => (
    <div
      key={key}
      aria-hidden="true"
      style={{
        position: 'absolute', left: 0, top: 0, width: SRC, height: SRC,
        transformOrigin: '0 0', transform: quadTransform(q, SRC, SRC),
        ...style,
      }}
    >
      {children}
    </div>
  );

  return (
    <div ref={boxRef} className={`relative overflow-hidden ${className}`} style={{ aspectRatio: `${PLATE_W} / ${PLATE_H}` }}>
      <img src={PLATE} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', left: 0, top: 0, width: PLATE_W, height: PLATE_H,
          transformOrigin: '0 0', transform: `scale(${scale})`,
          opacity: scale && ready ? 1 : 0, transition: 'opacity 420ms ease',
        }}
      >
        {/* The right-hand page: a ~60px strip seen almost edge-on.
            Squeezing a whole card image into it only smears, so it gets
            warm paper falling into shadow — which is what the inside of
            a card looks like from that angle anyway. */}
        {layer(FAR_TOP_QUAD, { background: 'linear-gradient(180deg, #efe6d4 0%, #d9ccb5 100%)' }, 'far-top')}
        {layer(INSIDE_QUAD, { background: 'linear-gradient(100deg, #a8977f 0%, #cdbfa6 40%, #e8ddc9 100%)' }, 'inside-page')}
        {/* The finished front. */}
        {layer(FRONT_QUAD, {}, 'front', (
          <img src={frontImageUrl} alt="" crossOrigin="anonymous" onLoad={() => setReady(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ))}
        {/* The plate's light, REBUILT rather than sampled: a warm key
            from the upper left, the fold falling away into shadow, and
            the bottom edge picking up bounce off the wood. Multiplying
            the photograph itself back over the card is the obvious idea
            and the wrong one — it drags the original card's artwork
            through as a ghost (caught 2026-09-23). */}
        {layer(FRONT_QUAD, { background: 'linear-gradient(105deg, rgba(255,241,216,0.28) 0%, rgba(255,236,206,0.08) 36%, rgba(76,54,33,0.10) 74%, rgba(58,40,24,0.30) 100%)' }, 'key')}
        {layer(FRONT_QUAD, { background: 'linear-gradient(0deg, rgba(122,88,56,0.24) 0%, rgba(122,88,56,0) 15%)' }, 'bounce')}
      </div>
    </div>
  );
}
