// /card-capture — a clean, chrome-free stage for screen-recording the 3D
// card for marketing (Instagram carousel slide-1 videos, Reels, TikTok).
// Not linked from anywhere; harmless if found (renders the same public
// hero assets as the landing page).
//
// The card rests ajar (site-wide pose), then a timer breathes it:
// open → hold → close → hold, on a ~7s cycle that loops seamlessly.
// Record two cycles (~14s) with QuickTime (Cmd+Shift+5 → record
// selected portion, drag around the card).
//
// Query params:
//   ?front=URL&inside=URL — override the card faces (defaults: hero pair)
//   ?bg=white             — white stage instead of keeper paper
//   ?still=open|ajar      — freeze the pose (for photo captures)
import { useEffect, useState } from 'react';
import { Card3DViewer } from '@/components/card-3d-viewer';

export default function CardCapturePage() {
  const params = new URLSearchParams(window.location.search);
  const front = params.get('front') || '/hero-card-front.webp';
  const inside = params.get('inside') || '/hero-card-inside.webp';
  const bg = params.get('bg') === 'white' ? '#ffffff' : '#FAF7F2';
  const still = params.get('still'); // 'open' | 'ajar' | null

  const [open, setOpen] = useState(still === 'open');

  // The breathing loop: ajar 2.5s → open 3s → back. The viewer's own
  // spring physics make the motion; we only flip the target state.
  useEffect(() => {
    if (still) return;
    let cancelled = false;
    let t: number;
    const cycle = (nextOpen: boolean) => {
      if (cancelled) return;
      setOpen(nextOpen);
      t = window.setTimeout(() => cycle(!nextOpen), nextOpen ? 3000 : 2500);
    };
    // First open ~1.5s in so a recording can start on the resting pose.
    t = window.setTimeout(() => cycle(true), 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [still]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'none', // no cursor in recordings
      }}
    >
      <div style={{ width: 'min(88vmin, 900px)', height: 'min(88vmin, 900px)' }}>
        <Card3DViewer
          frontImageUrl={front}
          insideImageUrl={inside}
          open={open}
          onOpenChange={setOpen}
          enableRotate={false}
          enableZoom={false}
          closedAngle={-0.38}
          restYaw={-0.12}
          framingMargin={1.5}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
