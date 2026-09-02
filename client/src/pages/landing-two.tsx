// client/src/pages/landing-two.tsx — LP2, THE BOOKING-ENGINE FRONT DOOR
//
// UX_LP2.md is the spec. This page ships at /lp2 and replaces / when
// signed off. It is mostly COMPOSITION of proven parts around one new
// hero: the booking bar. Reused verbatim from landing-keeper.tsx —
// ProofSection (the photo studio's real worked examples and copy),
// InsideSection, HandoverSection, TrustChips, PrimaryCta — plus the
// shared shells. New: BookingBar, RackGateway, the how-it-works strip
// and the price ladder rewrite.

import { Link } from 'wouter';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { FreeCardInvite } from '@/components/landing/free-card-invite';
import { OccasionsPromoSection } from '@/components/landing/occasions-promo-section';
import { FaqSection } from '@/components/landing/faq-section';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { BookingBar } from '@/components/landing/booking-bar';
import { RackGateway } from '@/components/landing/rack-gateway';
import { DISPLAY, TrustChips, ProofSection, InsideSection, HandoverSection } from '@/pages/landing-keeper';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP, SHIPPING_TIERS } from '@shared/pricing';

const H2 = `${DISPLAY} text-[clamp(30px,4.4vw,44px)] leading-[1.08]`;
const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/** WIREFRAME marker — visible in /lp2 only, stripped before the flip. */
function Wire({ label }: { label: string }) {
  return (
    <span className="rounded border border-dashed border-brand-dark/40 bg-brand-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-dark">
      wireframe · {label}
    </span>
  );
}

function HeroSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.22em] text-brand-dark">Personalised greetings cards · printed &amp; posted</p>
      <h1 className={`${DISPLAY} mt-3 max-w-[17ch] text-[clamp(34px,5.6vw,56px)] leading-[1.06] text-balance`}>
        Who's it for, and when do they need it?
      </h1>
      <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-keeper-body">
        Tell us four things and we'll write and illustrate three original cards just for them —
        or take one straight off the shelf. Every card here was made for a real person. No two alike.
      </p>
      <div className="mt-8">
        <BookingBar />
      </div>
      <div className="mt-5">
        <TrustChips />
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { k: 'Step 1', h: 'Three cards appear', p: 'Written and illustrated for them — about a minute. You watch them get made.' },
    { k: 'Step 2', h: 'Pick your favourite', p: 'Then we design its inside with your words in it — or the message we wrote for it.' },
    { k: 'Step 3', h: 'Put them in it', p: 'Add a photo and they’re drawn right into the artwork. Your call, after you’ve chosen.' },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.k} className="rounded-2xl border border-keeper-hair bg-white/70 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-dark">{s.k}</span>
              <Wire label="icon" />
            </div>
            <h3 className="mt-2 font-display text-lg font-bold text-keeper-ink">{s.h}</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-keeper-body">{s.p}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PhotoStudioBridge() {
  // The starboy gets its eyebrow here; the ProofSection beneath carries
  // the real worked examples and the copy, untouched.
  return (
    <div className="mx-auto max-w-6xl px-4 pb-2 sm:px-6">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.22em] text-brand-dark">
        From your photo · our directed route — you describe the scene, we make it real
      </p>
    </div>
  );
}

function LadderSection() {
  const standard = SHIPPING_TIERS.find((t) => t.id === 'standard');
  const tiers = [
    { name: 'Off the shelf', price: cardPriceGBP('rack'), sub: 'Real cards, ready now. Send as-is or add your words inside.', href: '/cards/christmas' },
    { name: 'Made for them', price: cardPriceGBP('maker'), sub: 'Three originals written and drawn for one person. You pick the winner.', href: '#top', hot: true },
    { name: 'From your photo', price: cardPriceGBP('photo'), sub: 'They become the artwork, in any scene you can describe. First one’s on us.', href: '/studio' },
  ];
  return (
    <section id="price" className="mx-auto max-w-6xl px-4 sm:px-6">
      <h2 className={H2}>Three ways in. One printed card at the end.</h2>
      <p className="mt-3 max-w-[56ch] text-keeper-body">
        Every route ends the same way: 280gsm card, kraft envelope, printed to order in the UK and posted
        first class — {standard ? gbp(standard.price) : '£2.95'} postage per order, however many cards are in it.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {tiers.map((t) => (
          <Link key={t.name} href={t.href}
            className={`block rounded-2xl border p-5 transition-colors ${t.hot ? 'border-brand-dark bg-brand-muted' : 'border-keeper-hair bg-white/70 hover:border-brand-dark/50'}`}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-lg font-bold text-keeper-ink">{t.name}</h3>
              <span className="font-display text-2xl font-bold text-keeper-ink">{gbp(t.price)}</span>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-keeper-body">{t.sub}</p>
          </Link>
        ))}
      </div>
      <div className="mt-6"><TrustChips /></div>
    </section>
  );
}

function SocialProofWire() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="flex items-center justify-between rounded-2xl border border-dashed border-keeper-hair p-6 text-sm text-keeper-meta">
        <span>Testimonial band — hidden until real quotes and photos land (array is empty by decision).</span>
        <Wire label="social proof" />
      </div>
    </section>
  );
}

export default function LandingTwo() {
  useSeo('/lp2');
  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main id="top" className="space-y-20 pb-24 pt-32 md:space-y-28">
        <HeroSection />
        <RackGateway />
        <HowItWorks />
        <div>
          <PhotoStudioBridge />
          <ProofSection />
        </div>
        <InsideSection />
        <HandoverSection />
        <LadderSection />
        <OccasionsPromoSection />
        <SocialProofWire />
        <FaqSection />
      </main>
      <MarketingFooter />
      <FreeCardInvite />
    </div>
  );
}
