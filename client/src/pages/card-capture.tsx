// /card-capture — a production-styled, chrome-free stage for
// screen-recording the 3D card for marketing (IG carousel slide-1
// videos, Reels, TikTok). Unlisted; renders public hero assets only.
//
// Layout: the RECORDABLE AREA is the centred cream square, marked by
// corner ticks that sit OUTSIDE its edge — drag QuickTime's selection
// corner-to-corner on the ticks and the guide itself never appears in
// the recording. Inside: the keeper-cream stage, the landing page's
// faint floating celebration icons, a soft vignette, and the card
// breathing open/closed on a ~7s seamless loop. framingMargin is sized
// so the FULLY OPEN card always fits inside the square (no cropping).
//
// Query params:
//   ?front=URL&inside=URL — override the card faces (defaults: hero pair)
//   ?bg=white             — white stage instead of keeper cream
//   ?still=open|ajar      — freeze the pose (for photo captures)
import { useEffect, useState } from 'react';
import { Card3DViewer } from '@/components/card-3d-viewer';
import iconCake from '@/assets/icons/cake.png';
import iconCelebrate from '@/assets/icons/celebrate.png';
import iconHeart from '@/assets/icons/heart.png';
import iconPresent from '@/assets/icons/present.png';
import iconRibbon from '@/assets/icons/ribbon.png';
import iconRing from '@/assets/icons/ring.png';

// Same faint-scatter motif as the landing's CelebrationBackdrop / OG
// card. Positions are % of the stage, kept to the edges so the open
// card never collides. Each floats gently on its own period/delay.
const STAGE_ICONS = [
  { src: iconHeart,     left: '7%',  top: '9%',  size: '6%',   rot: 14,  op: 0.13, dur: 11, delay: 0 },
  { src: iconCelebrate, left: '82%', top: '7%',  size: '6.5%', rot: -10, op: 0.12, dur: 13, delay: 1.5 },
  { src: iconRing,      left: '52%', top: '4%',  size: '5%',   rot: -14, op: 0.11, dur: 9,  delay: 3 },
  { src: iconCake,      left: '5%',  top: '55%', size: '7%',   rot: 10,  op: 0.11, dur: 12, delay: 2 },
  { src: iconPresent,   left: '84%', top: '72%', size: '7.5%', rot: -12, op: 0.13, dur: 10, delay: 0.8 },
  { src: iconRibbon,    left: '10%', top: '84%', size: '5.5%', rot: 8,   op: 0.12, dur: 14, delay: 4 },
];

// Corner ticks OUTSIDE the stage edge — the QuickTime drag targets.
const TICK = 26;
const TICK_GAP = 6;

export default function CardCapturePage() {
  const params = new URLSearchParams(window.location.search);
  const front = params.get('front') || '/hero-card-front.webp';
  const inside = params.get('inside') || '/hero-card-inside.webp';
  const stageBg = params.get('bg') === 'white' ? '#ffffff' : '#FAF7F2';
  const still = params.get('still'); // 'open' | 'ajar' | null

  const [open, setOpen] = useState(still === 'open');

  // The breathing loop: ajar 2.5s → open 3s → back; the viewer's spring
  // physics supply the motion, we only flip the target.
  useEffect(() => {
    if (still) return;
    let cancelled = false;
    let t: number;
    const cycle = (nextOpen: boolean) => {
      if (cancelled) return;
      setOpen(nextOpen);
      t = window.setTimeout(() => cycle(!nextOpen), nextOpen ? 3000 : 2500);
    };
    t = window.setTimeout(() => cycle(true), 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [still]);

  const tickStyle = (v: 'top' | 'bottom', h: 'left' | 'right') => ({
    position: 'absolute' as const,
    width: TICK,
    height: TICK,
    [v]: -(TICK + TICK_GAP),
    [h]: -(TICK + TICK_GAP),
    [`border${v[0].toUpperCase() + v.slice(1)}`]: '3px solid #C9C2B6',
    [`border${h[0].toUpperCase() + h.slice(1)}`]: '3px solid #C9C2B6',
    borderRadius: 2,
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        // Outside the recordable square: a step darker so the stage
        // reads unmistakably as "record THIS".
        background: '#EDE7DC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'none',
      }}
    >
      <style>{`
        @keyframes capture-float {
          from { transform: translateY(-8px) rotate(var(--rot)); }
          to   { transform: translateY(8px)  rotate(calc(var(--rot) + 4deg)); }
        }
      `}</style>

      {/* The recordable square */}
      <div
        style={{
          position: 'relative',
          width: 'min(86vmin, 980px)',
          height: 'min(86vmin, 980px)',
        }}
      >
        {/* Corner ticks — OUTSIDE the edge, never in the recording */}
        <div style={tickStyle('top', 'left')} />
        <div style={tickStyle('top', 'right')} />
        <div style={tickStyle('bottom', 'left')} />
        <div style={tickStyle('bottom', 'right')} />

        {/* The stage itself */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: stageBg,
            overflow: 'hidden',
            boxShadow: '0 24px 80px -32px rgba(33,29,25,0.28)',
          }}
        >
          {/* Faint celebration icons, gently floating */}
          {STAGE_ICONS.map((ic, i) => (
            <img
              key={i}
              src={ic.src}
              alt=""
              style={{
                position: 'absolute',
                left: ic.left,
                top: ic.top,
                width: ic.size,
                opacity: ic.op,
                ['--rot' as any]: `${ic.rot}deg`,
                animation: `capture-float ${ic.dur}s ease-in-out ${ic.delay}s infinite alternate`,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          ))}

          {/* Soft warm vignette — corners settle ~3% darker */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'radial-gradient(circle at 50% 46%, rgba(0,0,0,0) 55%, rgba(60,50,35,0.05) 100%)',
            }}
          />

          {/* The card — margin sized so FULL OPEN never crops */}
          <div style={{ position: 'absolute', inset: 0 }}>
            <Card3DViewer
              frontImageUrl={front}
              insideImageUrl={inside}
              open={open}
              onOpenChange={setOpen}
              enableRotate={false}
              enableZoom={false}
              closedAngle={-0.38}
              restYaw={-0.12}
              framingMargin={2.1}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
