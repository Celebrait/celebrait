// client/src/components/landing/promo-strip.tsx
//
// Apple-style promo strip — pinned directly BELOW the fixed marketing
// header, staying static with it as the page scrolls beneath. A subtle
// one-line strip surfacing the print-to-order production time + pricing.
// Production time MUST be honest here (no "delivered tomorrow" — every
// card is printed to order, up to 72h before dispatch).
//
// `fixed top-20` (= the 80px header height) sits it just under the header.
// Opaque band (bg-surface) so it reads as a distinct strip. z-[140] sits
// just under the header's z-[150]. The page offsets its content by
// header + strip height (120px).

import { Link } from 'wouter';

export function PromoStrip() {
  return (
    <div className="fixed top-20 left-0 right-0 z-[140] bg-surface border-y border-stone-200/70">
      <div className="max-w-7xl mx-auto h-10 px-6 md:px-10 flex items-center justify-center">
        <p className="text-xs md:text-sm text-ink-soft text-center">
          Printed to order — allow up to 72&nbsp;hrs, then posted. Cards £8.99
          + delivery.{' '}
          <Link
            href="/pricing"
            className="text-brand hover:text-brand-dark font-medium ml-1"
          >
            See pricing →
          </Link>
        </p>
      </div>
    </div>
  );
}
