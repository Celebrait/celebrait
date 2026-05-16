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

import { BlogTeaserSection } from '@/components/landing/blog-teaser-section';
import { DemoVideoSection } from '@/components/landing/demo-video-section';
import { FaqSection } from '@/components/landing/faq-section';
import { FinalCtaBand } from '@/components/landing/final-cta-band';
import { HeroSection } from '@/components/landing/hero-section';
import { ImagineDescribeShipSection } from '@/components/landing/imagine-describe-ship-section';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { MarketingHeader } from '@/components/landing/marketing-header';
import { PricingStripSection } from '@/components/landing/pricing-strip-section';
import { PromoStrip } from '@/components/landing/promo-strip';
import { TestimonialCarouselSection } from '@/components/landing/testimonial-carousel-section';

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface-card">
      <MarketingHeader />
      <PromoStrip />
      <main>
        <HeroSection />
        <DemoVideoSection />
        <ImagineDescribeShipSection />
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
