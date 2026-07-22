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
import { useAuthModal } from '@/components/auth/auth-modal';
import { Button } from '@/components/ui/button';
import celebraitLogo from '@/assets/celebrait.png';

export function MarketingHeader({
  transparent = false,
  topClass = 'top-0',
}: {
  // When true the header bar paints no background/border so the page
  // (e.g. the landing's celebration backdrop) shows through it. Opaque
  // by default — other pages (pricing) keep the solid white chrome.
  transparent?: boolean;
  // Where the fixed header pins. Default top-0. The landing sets this to
  // `top-10` so the header sits BELOW the 40px promo strip pinned above it.
  topClass?: string;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();

  // z-[150] keeps the header above the hero card's bleed wrapper
  // (z-[100]) and any other section's z-stack. Was z-30, but the
  // hero's 3D card bleed scrolled past and sat on top of the header
  // (Kevin call 2026-05-06: "the 3d render, the hints, the CTA, all
  // overlap the header section when scrolling").
  return (
    <header
      className={`fixed ${topClass} left-0 right-0 z-[150] ${
        transparent
          ? 'bg-transparent'
          : 'bg-surface-card border-b border-stone-200'
      }`}
    >
      <div className="max-w-7xl mx-auto h-20 flex items-center justify-between px-6 md:px-10">
        <Link href="/" className="flex items-center" aria-label="Celebrait home">
          <img
            src={celebraitLogo}
            alt="Celebrait"
            className="h-12 md:h-14 w-auto"
          />
        </Link>

        <div className="flex items-center gap-4 md:gap-6">
          {/* What's New drawer hidden site-wide (Kevin 2026-07-22 — not
              needed atm). See client/src/components/studio/whats-new-drawer.tsx
              to re-enable. */}

          {!isLoading && isAuthenticated ? (
            <Link
              href="/studio"
              className="text-xs uppercase tracking-wider font-medium text-ink-soft hover:text-brand transition-colors"
            >
              Open my studio →
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openAuth('/studio')}
              className="text-xs uppercase tracking-wider font-medium text-ink-soft hover:text-brand transition-colors"
            >
              Sign in
            </button>
          )}

          {!isLoading && isAuthenticated ? (
            <Link href="/studio">
              <Button className="bg-brand hover:bg-brand-dark text-brand-foreground h-10 px-5 text-sm font-medium">
                Open my studio
              </Button>
            </Link>
          ) : (
            <Button
              onClick={() => openAuth('/studio/new-card')}
              className="bg-brand hover:bg-brand-dark text-brand-foreground h-10 px-5 text-sm font-medium"
            >
              Make my first card
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
