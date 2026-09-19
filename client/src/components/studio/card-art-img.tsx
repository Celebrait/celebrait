// client/src/components/studio/card-art-img.tsx
//
// Card artwork <img> with a graceful failure state — a quiet branded
// placeholder instead of the browser's raw broken-image "?" (which a
// real customer saw on the home carousel, Aidan 2026-08-03; legacy
// pre-R2 cards can point at art that no longer exists anywhere).
//
// RULE (project_3d_card_cors_cache_poisoning): every card-image <img>
// sets crossOrigin="anonymous" — a plain load would poison the 3D
// viewer's texture cache for the same URL.

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

export function CardArtImg({
  src,
  alt,
  className,
  /** Classes for the placeholder box when there's no image / it failed.
   *  Defaults to filling the parent like the img would. */
  fallbackClassName,
  /** Icon-only fallback for tiles too small to carry the label. */
  compact = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={
          fallbackClassName ??
          'flex h-full w-full flex-col items-center justify-center gap-1 bg-stone-100 text-stone-400'
        }
        role="img"
        aria-label={`${alt} — artwork unavailable`}
        data-testid="card-art-fallback"
      >
        <ImageOff className={compact ? 'h-4 w-4' : 'h-6 w-6'} strokeWidth={1.5} />
        {!compact && (
          <span className="text-[10px] font-medium">Artwork unavailable</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      crossOrigin="anonymous"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
