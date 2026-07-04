// client/src/pages/landing.tsx
//
// The Celebrait marketing landing page (locked direction, 2026-05-01).
//
// Strategy: Studio is locked behind signup (Option H from the
// product-strategy thread). The lander does the conversion work via
// marketing surface — sample quality, animations, FAQ, social proof —
// rather than letting visitors tinker before signup. Every CTA on the
// page routes to /login?redirect=/studio/new-card so the post-signup
// landing state is the new-card flow.
//
// Sections (locked, 2026-05-06):
//   1. MarketingHeader (sticky)
//   2. PromoStrip (40px tinted band)
//   3. HeroSection (Card3DViewer + headline + CTA)
//   4. DemoVideoSection ("Welcome to the end of boring" + dashboard
//      poster + click-to-play placeholder)
//   5. ImagineDescribeShip (autoplay brainstorm chat → 3D card reveal)
//   6. TestimonialCarousel (social proof — SIL slide V1)
//   7. PricingStrip (3-tier teaser → /pricing for full table)
//   8. FaqSection (accordion)
//   9. BlogTeaser (3 placeholder cards, "Coming soon")
//  10. FinalCtaBand (bg-brand violet)
//  11. MarketingFooter (dark)
//
// History:
//   - 2026-05-05: introduced BigDemoSection — a 3-row Style/Refine/
//     Inside walkthrough. Killed 2026-05-06 — content covered better
//     by other sections.
//   - 2026-05-06: KILLED CreativeFreedom, FrontAndInside, SendItYourWay,
//     NeverMissADate, FounderNote (Kevin call: delete all of this).
//     Section files left on disk in case any are revived; just
//     unmounted from the lander. This shrinks the page significantly
//     — now just hero → "end of boring" video → brainstorm reveal →
//     FAQ → blog teasers → final CTA → footer.
//
// Kept this file thin on purpose — each section lives in its own
// component under client/src/components/landing/* so iteration on any
// one section is local.

import { useEffect } from 'react';
import { BlogTeaserSection } from '@/components/landing/blog-teaser-section';
import { DemoVideoSection } from '@/components/landing/demo-video-section';
import { FaqSection } from '@/components/landing/faq-section';
import { FinalCtaBand } from '@/components/landing/final-cta-band';
import { HeroFloatingSection } from '@/components/landing/hero-floating-section';
import { StudioBuildSteps } from '@/components/landing/studio-build-steps';
import { ImagineDescribeShipSection } from '@/components/landing/imagine-describe-ship-section';
import { CelebrationBackdrop, StudioFlowSection, MakeYourOwnSection } from '@/pages/hero-scroll-poc';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { MarketingHeader } from '@/components/landing/marketing-header';
import { PricingStripSection } from '@/components/landing/pricing-strip-section';
import { PromoStrip } from '@/components/landing/promo-strip';
import { TestimonialCarouselSection } from '@/components/landing/testimonial-carousel-section';

export default function Landing() {
  // Gentle scroll-snap through the JOURNEY only (hero → build steps →
  // example card → make-your-own): those sections carry `snap-start`;
  // the reading tail (FAQ, pricing, testimonials…) has no snap points so
  // it scrolls free. `proximity` (not mandatory) = native magnetism when
  // a swipe ends near a boundary, never a hijack — the JS proximity-snap
  // experiment (HeroFlowSnap) that fought sticky sections was rejected as
  // "super clunky"; this is the browser's own compositor snapping on a
  // page that no longer has scrub pins. Applied to <html> only while the
  // landing is mounted so studio/checkout scrolling is untouched.
  // scroll-padding-top = fixed header (80px) + promo strip (40px).
  useEffect(() => {
    const html = document.documentElement;
    html.style.scrollSnapType = 'y proximity';
    html.style.scrollPaddingTop = '120px';
    return () => {
      html.style.scrollSnapType = '';
      html.style.scrollPaddingTop = '';
    };
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Always-on celebration field — a single fixed -z-10 backdrop so the
          floating objects persist behind the WHOLE page (hero + flow are
          transparent and sit over it). */}
      <CelebrationBackdrop />
      {/* Opaque header at the top; promo strip pinned just below it. Both fixed. */}
      <MarketingHeader />
      <PromoStrip />
      {/* Offset content below both fixed bars (80px header + 40px strip). */}
      <main className="pt-[120px]">
        <HeroFloatingSection />
        {/* Build steps — pure scroll, gentle fade + slight zoom in, autoplay. */}
        <StudioBuildSteps />
        {/* Card finale — loads → reveals → opens → closes → envelope → flick. */}
        <StudioFlowSection />
        <MakeYourOwnSection />
        <ImagineDescribeShipSection />
        <DemoVideoSection />
        <TestimonialCarouselSection />
        <PricingStripSection />
        <FaqSection />
        <BlogTeaserSection />
        <FinalCtaBand />
      </main>
      <MarketingFooter />
    </div>
  );
}
