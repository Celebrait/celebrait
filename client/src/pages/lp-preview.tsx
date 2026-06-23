// client/src/pages/lp-preview.tsx
//
// PREVIEW (/lp) — the real landing chrome + hero + the new snap+autoplay+dolly
// studio flow (HeroFlowSnap), ending when the greetings card HITS. Everything
// from the card onward is a placeholder for the next iteration. Lets us judge
// the flow in real landing-page context (hero above, page continues below)
// without touching the live landing. Page-level scroll-snap is applied only
// while this route is mounted.

import { useEffect } from 'react';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { MarketingHeader } from '@/components/landing/marketing-header';
import { PromoStrip } from '@/components/landing/promo-strip';
import { HeroFloatingSection } from '@/components/landing/hero-floating-section';
import { HeroFlowSnap } from '@/components/landing/hero-flow-snap';

export default function LpPreview() {
  // Gentle page-level snap — only the flow's markers carry snap-align, so the
  // hero + the section below scroll freely; the flow steps snap one-per-swipe.
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.scrollSnapType;
    el.style.scrollSnapType = 'y proximity';
    return () => {
      el.style.scrollSnapType = prev;
    };
  }, []);

  return (
    <div className="relative min-h-screen">
      <CelebrationBackdrop />
      <MarketingHeader />
      <PromoStrip />
      <main className="pt-[120px]">
        <HeroFloatingSection />
        <HeroFlowSnap />
        {/* Placeholder — where we iterate from the card hitting onwards. */}
        <section className="relative flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-[13px] uppercase tracking-[0.2em] text-brand">Next iteration</p>
          <h2 className="font-display text-[28px] font-bold text-ink sm:text-[40px]">
            From the card hitting onwards →
          </h2>
          <p className="max-w-[42ch] text-ink-soft">
            The card reveal, the giving moment, and the rest of the page get
            designed from here.
          </p>
        </section>
      </main>
    </div>
  );
}
