// client/src/components/catalogue/ajar-tile.tsx
//
// A catalogue tile that reads as a GREETING CARD, not a thumbnail:
// the cover sits slightly ajar (CSS 3D — the locked interaction model
// says cards rest ajar), a cream inside sliver peeks out behind it,
// and layered shadows give the shelf depth. Hover opens the cover a
// touch more — an invitation, not a reveal.
//
// CSS rather than the WebGL AjarCardRender on purpose: a wall renders
// dozens of these; one canvas each would melt phones. At tile sizes
// (150–300px) the fold reads correctly — the 80px failures that
// justified WebGL were thumbnail-scale.

import { ThumbImg } from '@/components/thumb-img';

interface AjarTileProps {
  imageUrl: string;
  alt: string;
}

export function AjarTile({ imageUrl, alt }: AjarTileProps) {
  return (
    <div className="relative aspect-square" style={{ perspective: '900px' }}>
      {/* The inside — cream page peeking from behind the cover's
          opening edge. */}
      <div className="absolute inset-0 rounded-r-[6px] rounded-l-[2px] bg-[#FFFDF8] shadow-[inset_-1px_0_3px_rgba(33,29,25,0.08)]" />
      {/* The cover — hinged on the left like a real card. */}
      <div
        className="absolute inset-0 origin-left overflow-hidden rounded-r-[6px] rounded-l-[2px] bg-white transition-transform duration-300 ease-out [transform:rotateY(-14deg)] group-hover:[transform:rotateY(-22deg)]"
        style={{
          boxShadow:
            '2px 4px 14px rgba(33,29,25,0.18), 8px 14px 32px -12px rgba(33,29,25,0.28)',
        }}
      >
        <ThumbImg
          src={imageUrl}
          alt={alt}
          className="h-full w-full object-cover"
        />
        {/* Cover sheen — the fold catching the light. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-black/10" />
      </div>
    </div>
  );
}
