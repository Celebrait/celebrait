// client/src/components/thumb-img.tsx — THE GRID-TIER <img>
//
// Drop-in replacement for <img> anywhere a card front is shown at tile
// size. Given the FULL image URL, it climbs down a ladder:
//
//   1. `<name>_t.webp` — the ~512px grid thumb (tens of KB), which
//      every image stored since 2026-08-28 has from birth.
//   2. `/api/thumb/<name>.png` — the self-healing route: generates and
//      stores the missing thumb, so step 1 hits for everyone after.
//   3. the original URL — full-res PNG, always exists.
//
// Non-PNG sources (data URLs, dev /images paths still work — they just
// short-circuit to the original). crossOrigin stays "anonymous" on
// every rung: mixed-mode loads are how the WebGL cache poisoning bug
// happened (see project memory) — never remove it.

import { useEffect, useMemo, useState, type ImgHTMLAttributes } from 'react';

const PNG_URL = /^(https?:\/\/[^?#]+\/|\/images\/)([A-Za-z0-9_-]+)\.png$/;

interface ThumbImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  /** The FULL image URL (what you'd have put on a plain <img>). */
  src: string;
  /** Fires only when the LAST rung (the original) also fails — i.e.
   *  what onError meant on a plain <img>. */
  onFinalError?: () => void;
}

export function ThumbImg({ src, onFinalError, ...rest }: ThumbImgProps) {
  const ladder = useMemo(() => {
    const m = PNG_URL.exec(src ?? '');
    if (!m) return [src];
    return [
      `${m[1]}${m[2]}_t.webp`,
      `/api/thumb/${m[2]}.png`,
      src,
    ];
  }, [src]);
  const [rung, setRung] = useState(0);
  // A new src resets the climb — grids recycle component instances.
  useEffect(() => setRung(0), [src]);
  return (
    <img
      key={src}
      {...rest}
      src={ladder[Math.min(rung, ladder.length - 1)]}
      crossOrigin="anonymous"
      loading={rest.loading ?? 'lazy'}
      decoding={rest.decoding ?? 'async'}
      onError={() => setRung((r) => {
        if (r < ladder.length - 1) return r + 1;
        onFinalError?.();
        return r;
      })}
    />
  );
}
