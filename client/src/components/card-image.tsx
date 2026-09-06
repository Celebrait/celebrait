// client/src/components/card-image.tsx
//
// The ONE correct way to render a card image (front / inside / attempt)
// that lives on Cloudflare R2. Use this instead of a bare <img> for any
// R2 card image, everywhere.
//
// WHY THIS EXISTS — the bug it makes impossible:
//   R2's public bucket returns `Access-Control-Allow-Origin` ONLY when the
//   request carries an `Origin` header (it sends `Vary: Origin`). A plain
//   <img> (no crossOrigin) sends no Origin → gets a NO-CORS response → and
//   the browser CACHES that response for the URL. The 3D card's WebGL
//   texture loader (which is always crossOrigin='anonymous') then requests
//   the SAME url, needs the CORS header, but is served the poisoned cache
//   entry → CORS block → the card renders blank / a broken "?" icon.
//
//   Because the fix is per-<img>, this exact bug has been reintroduced
//   THREE times (56c89884, a2b3fd77, cbe5d95c) — every time a new studio
//   screen shipped a card thumbnail as a bare <img>. <CardImage> hard-sets
//   crossOrigin so a card image can never poison the cache again. The
//   attribute is applied AFTER {...props} so a caller can't override it.
//
// ENFORCED by scripts/check-card-image-cors.mjs (run in `npm run check`):
// a bare <img> whose src is a card image url without crossOrigin fails the
// build. Reach for <CardImage> and it stays green.

import { forwardRef, type ImgHTMLAttributes } from 'react';

export type CardImageProps = ImgHTMLAttributes<HTMLImageElement>;

export const CardImage = forwardRef<HTMLImageElement, CardImageProps>(
  function CardImage(props, ref) {
    // crossOrigin last → non-overridable. This is the whole point.
    return <img ref={ref} {...props} crossOrigin="anonymous" />;
  },
);
