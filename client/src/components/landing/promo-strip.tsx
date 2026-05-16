// client/src/components/landing/promo-strip.tsx
//
// Apple-style promo strip — sits below the fixed marketing header,
// above the hero. A subtle one-line strip that surfaces the
// next-day-delivery + pricing claim without crowding the hero.
//
// Sits in document flow so it scrolls away naturally when the user
// scrolls into the hero. The fixed header (z-30) overlays this on
// scroll past 80px.
//
// `mt-16` clears the fixed header (h-16 = 64px) so the strip is
// visible at scroll 0.

import { Link } from 'wouter';

export function PromoStrip() {
  return (
    <div className="relative mt-16 bg-surface border-y border-stone-200/70">
      <div className="max-w-7xl mx-auto h-10 px-6 md:px-10 flex items-center justify-center">
        <p className="text-xs md:text-sm text-ink-soft text-center">
          Made today, delivered tomorrow. Printed cards from £7.99.{' '}
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
