// client/src/components/ajar-card-render.tsx
//
// Reusable miniature 3D card render — the cover locked slightly ajar
// so the inside peeks out, fully static (no rotate / zoom / tap-to-
// open). Built from Card3DViewer with `interactive={false}`, so the
// hit zone is pointer-events: none and clicks pass through to any
// wrapping element.
//
// First use: the "Take another look" thumbnail on the Giving Moment
// screen (pages/studio-give.tsx). Held for landing-page use too —
// dropped into homepage sections with bespoke card artwork (front
// + inside images) to carry narrative beats. See
// next_delivery_destination_usp.md / next_landing_v1_social_proof.md.
//
// Why a real 3D viewer for what is essentially a thumbnail:
// CSS/SVG attempts at "open card from 3/4 angle" kept failing at
// small sizes — they read as flat rectangles, not a card. Using the
// real card render guarantees the shape regardless of size, and the
// textures are usually already warm (this is downstream of a reveal
// or another viewer mount).

import { Card3DViewer } from '@/components/card-3d-viewer';

interface AjarCardRenderProps {
  frontImageUrl: string;
  insideImageUrl?: string | null;
  /** Square wrapper edge in px. Default 80 — the thumbnail size used
   *  on the give page. Bump up for hero-narrative usage on landing. */
  size?: number;
  /** Cover rotation at rest (radians, negative = ajar). Default -0.8
   *  (~46°) — "instantly readable as an open card" without becoming
   *  a half-reveal. -0.5 is the subtler marketing-hero ambient value;
   *  values past -1.0 stop reading as a thumbnail. */
  closedAngle?: number;
  /** Camera framing margin around the card. Default 1.6 — tighter
   *  than the in-Studio default (2.0) so a small wrapper isn't
   *  mostly dead space. */
  framingMargin?: number;
  /** Optional extra class on the wrapper. The wrapper is always
   *  `pointer-events-none` so clicks pass through. */
  className?: string;
}

/**
 * Static, ajar miniature of a Celebrait card. Drop inside any
 * clickable parent (or as a standalone visual) — the wrapper is
 * pointer-events: none so it never traps clicks.
 */
export function AjarCardRender({
  frontImageUrl,
  insideImageUrl,
  size = 80,
  closedAngle = -0.8,
  framingMargin = 1.6,
  className,
}: AjarCardRenderProps) {
  return (
    <div
      className={`relative shrink-0 pointer-events-none ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <Card3DViewer
        frontImageUrl={frontImageUrl}
        insideImageUrl={insideImageUrl}
        open={false}
        closedAngle={closedAngle}
        interactive={false}
        enableRotate={false}
        enableZoom={false}
        framingMargin={framingMargin}
        className="w-full h-full"
      />
    </div>
  );
}
