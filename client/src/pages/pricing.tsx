// client/src/pages/pricing.tsx — /pricing
//
// Rebuilt 2026-09-09 (Aidan: "rework the pricing page — types off, no
// mention of 3 card route vs photo route, free route can go"). Three
// facts, in the keeper skin the rest of the public site wears:
//
//   1. The price ladder by door — £4.99 off the shelf, £5.99 made for
//      them (the three-card route), £6.99 from your photo (the
//      director). Numbers come from CARD_PRICES_GBP so this page can't
//      drift from checkout (UX_THREE_DOORS.md §8a).
//   2. Postage — one option, £2.95, and the lead-time notice said the
//      way it's said everywhere: one-off prints, allow at least a week.
//   3. What every card includes, and the fine print.
//
// Making is free and stays free; it just isn't sold as a tier any more.

import { Link } from 'wouter';
import { Camera, Check, LayoutGrid, Sparkles, type LucideIcon } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { DISPLAY, HERO_MAIN, HERO_TOP, EYEBROW, SUB } from '@/pages/doorway';
import { LeadTimeNotice } from '@/components/lead-time-notice';
import { useAuth } from '@/hooks/use-auth';
import { useSeo } from '@/lib/use-seo';
import { CARD_PRICES_GBP, UK_SHIPPING_STANDARD_GBP, type CardSource } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

interface Door {
  source: CardSource;
  icon: LucideIcon;
  title: string;
  line: string;
  points: string[];
  href: string;
  cta: string;
}

const DOORS: Door[] = [
  {
    source: 'rack',
    icon: LayoutGrid,
    title: 'Off the shelf',
    line: 'A card from our rack, with your words inside.',
    points: ['Ready-made front, designed by us', 'Your message set inside, or leave it blank', 'Printed once, just for you'],
    href: '/cards/birthday',
    cta: 'Browse the rack',
  },
  {
    source: 'maker',
    icon: Sparkles,
    title: 'Made for them',
    line: 'Tell us who they are and what they love. We design three cards. You pick the one.',
    points: ['Three original fronts in about a minute', 'Written and drawn around their thing', 'Add their photo once you’ve picked (optional)'],
    href: '/make',
    cta: 'Tell us about them',
  },
  {
    source: 'photo',
    icon: Camera,
    title: 'From your photo',
    line: 'Start with a photo of them and put them in a whole new world.',
    points: ['Any scene you can describe', 'Drawn at full print quality, one card at a time', 'A group photo works too'],
    href: '/photo/make',
    cta: 'Start with a photo',
  },
];

const INCLUDED = [
  '280gsm gloss-coated art card, HP Indigo print',
  'Posted in a kraft envelope, tracked',
  'Straight to them, or to you first to hand over',
  'A free digital link — the card opens in 3D on any screen',
  'Sustainably sourced, plastic-free and recyclable',
  'Make and preview for free; pay only when you post one',
];

export default function PricingPage() {
  useSeo('/pricing');
  const { isAuthenticated, isLoading } = useAuth();
  const photoHref = !isLoading && isAuthenticated ? '/studio/new-card' : '/photo/make';

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className={HERO_MAIN}>
        <section className={`px-6 pb-16 md:pb-24 ${HERO_TOP}`}>
          <div className="mx-auto max-w-4xl">
            <p className={EYEBROW}>Pricing</p>
            <h1 className={`mt-4 max-w-[20ch] text-[clamp(28px,5vw,54px)] leading-[1.06] ${DISPLAY}`}>
              One printed card.
              <br />
              <span className="font-medium italic">Three ways to make it.</span>
            </h1>
            <p className={`max-w-[40rem] ${SUB}`}>
              Every card is printed once, just for them, and posted with a free digital link to share.
              The price depends on how much we make from scratch.
            </p>

            <div className="mt-8 md:mt-10">
              <LeadTimeNotice link={false} />
            </div>

            {/* The ladder */}
            <div className="mt-6 grid gap-4 md:grid-cols-3 md:gap-5">
              {DOORS.map((d) => {
                const Icon = d.icon;
                const href = d.source === 'photo' ? photoHref : d.href;
                return (
                  <div key={d.source} className="flex flex-col rounded-xl border-2 border-keeper-hair bg-white p-5 shadow-[0_12px_40px_-28px_rgba(33,29,25,0.35)] sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-muted text-keeper-gold">
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <span className="font-display text-[26px] font-bold leading-none tracking-[-0.01em] text-keeper-ink">{gbp(CARD_PRICES_GBP[d.source])}</span>
                    </div>
                    <h2 className="mt-4 font-display text-[22px] font-bold leading-[1.1] text-keeper-ink">{d.title}</h2>
                    <p className="mt-1 text-[14px] leading-snug text-keeper-body">{d.line}</p>
                    <ul className="mt-4 flex-1 space-y-2">
                      {d.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-2 text-[13.5px] leading-snug text-keeper-body">
                          <span className="mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cta-light text-cta-dark"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-[12px] text-keeper-meta">+ {gbp(UK_SHIPPING_STANDARD_GBP)} postage, Royal Mail 24 tracked</p>
                    <Link href={href} className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-go px-5 py-2.5 text-[14.5px] font-semibold text-go-foreground transition-colors hover:bg-go-hover">
                      {d.cta}
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Every card */}
            <div className="mt-12 grid gap-8 md:mt-16 md:grid-cols-[1fr_1fr]">
              <div>
                <p className={EYEBROW}>Every card includes</p>
                <ul className="mt-4 space-y-2.5">
                  {INCLUDED.map((pt) => (
                    <li key={pt} className="flex items-start gap-2.5 text-[15px] leading-snug text-keeper-body">
                      <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cta-light text-cta-dark"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={EYEBROW}>Delivery, honestly</p>
                <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-keeper-body">
                  <p>
                    Our cards are one-off prints. Right now they're printed to order by a partner printer, which takes up to three working days, then posted Royal Mail 24, tracked, for {gbp(UK_SHIPPING_STANDARD_GBP)}. Please allow at least a week from order to arrival.
                  </p>
                  <p>
                    At checkout, tell us the date and we'll say straight away whether it'll make it. The free digital link arrives instantly either way.
                  </p>
                  <p>
                    UK addresses only for now. Buying from abroad is fine; have it sent straight to them.
                  </p>
                </div>
              </div>
            </div>

            {/* Fine print */}
            <div className="mt-12 rounded-2xl border border-keeper-hair bg-white/70 p-6 backdrop-blur-sm md:mt-16 md:p-8">
              <p className={EYEBROW}>The fine print, kept short</p>
              <ul className="mt-4 space-y-2.5 text-[14px] leading-relaxed text-keeper-body">
                <li><span className="font-semibold text-keeper-ink">Your first made-for-them card is half price</span> when you add three dates that matter to your studio. One per account.</li>
                <li><span className="font-semibold text-keeper-ink">Personalised cards can't be cancelled</span> once printing begins. We say so before you pay.</li>
                <li><span className="font-semibold text-keeper-ink">Making is free.</span> Roll again, change the details, start over. You only pay when you post one.</li>
                <li><span className="font-semibold text-keeper-ink">No logos, brands or famous faces</span> on the front. Your answers set the scene; we draw it.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter cta="gate" />
    </div>
  );
}
