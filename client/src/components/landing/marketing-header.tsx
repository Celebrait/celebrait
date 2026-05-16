// client/src/components/landing/marketing-header.tsx
//
// Fixed top header. Always white now (was transparent-over-hero with
// scroll-state opacity) so the promo strip directly below it has a
// crisp tint contrast — the strip's `bg-surface` (warm stone) reads
// as a distinct band against the white header.
//
// Authenticated visitors get a different chrome: the "Sign in" link
// becomes "Open my studio" and the CTA becomes a violet `bg-brand`
// "Open my studio" button.

import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

export function MarketingHeader() {
  const { isAuthenticated, isLoading } = useAuth();

  // z-[150] keeps the header above the hero card's bleed wrapper
  // (z-[100]) and any other section's z-stack. Was z-30, but the
  // hero's 3D card bleed scrolled past and sat on top of the header
  // (Kevin call 2026-05-06: "the 3d render, the hints, the CTA, all
  // overlap the header section when scrolling").
  return (
    <header className="fixed top-0 left-0 right-0 z-[150] bg-surface-card border-b border-stone-200">
      <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-6 md:px-10">
        <Link
          href="/"
          className="text-2xl md:text-[26px] font-semibold text-ink tracking-[-0.035em]"
        >
          Celebrait
        </Link>

        <div className="flex items-center gap-6">
          {!isLoading && isAuthenticated ? (
            <Link
              href="/studio"
              className="text-xs uppercase tracking-wider font-medium text-ink-soft hover:text-brand transition-colors"
            >
              Open my studio →
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-xs uppercase tracking-wider font-medium text-ink-soft hover:text-brand transition-colors"
            >
              Sign in
            </Link>
          )}

          {!isLoading && isAuthenticated ? (
            <Link href="/studio">
              <Button className="bg-brand hover:bg-brand-dark text-brand-foreground h-10 px-5 text-sm font-medium">
                Open my studio
              </Button>
            </Link>
          ) : (
            <Link href="/login?redirect=/studio/new-card">
              <Button className="bg-brand hover:bg-brand-dark text-brand-foreground h-10 px-5 text-sm font-medium">
                Make my first card
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
