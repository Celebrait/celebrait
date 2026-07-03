// client/src/pages/pricing.tsx
//
// Pricing page — print-led "Free for me. Paid for them." model
// (Free + one printed card that includes a free digital link),
// driven by the shared/pricing.ts config so the landing strip,
// checkout, and any numbers quoted in emails can never drift.
//
// UK-PRIMARY LAUNCH (decided 2026-05-12). GBP only — no currency
// toggle, no ZAR copy, no SA shipping bullet. ZAR pricing still
// exists as dormant data in shared/pricing.ts for when SA goes
// live, but this page does not render it. When you reactivate SA,
// restore the CurrencyToggle component and the ZAR-aware overnight
// add-on branch from git history.
//
// Build order (per next_pricing_and_regen_economics.md):
//   1. shared/pricing.ts config  ← shipped
//   2. this page                  ← here
//   3. landing strip teaser       ← shipped
//   4. lock numbers after Cost Ledger has ~2 weeks of regen data
//
// Overnight delivery is intentionally NOT a tier — it's an add-on
// under the Printed card (UK-only). The digital share link is
// included free with the printed card, not sold separately
// (decided 2026-07-01, next_digital_card_strategy.md).

import { Link } from 'wouter';
import { Check, Heart, Truck, Zap } from 'lucide-react';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { MarketingHeader } from '@/components/landing/marketing-header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';
import {
  PRICING_TIERS,
  OVERNIGHT_DELIVERY,
  formatPrice,
  type PricingTier,
  type TierId,
} from '@shared/pricing';

// Icon + colour theming lives at the page level — the shared config
// stays UI-free so the server can import it for emails.
const TIER_VISUALS: Record<TierId, {
  icon: typeof Heart;
  iconBg: string;
  iconColor: string;
}> = {
  free: {
    icon: Heart,
    iconBg: 'bg-accent-coral-light',
    iconColor: 'text-accent-coral-dark',
  },
  printed: {
    icon: Truck,
    iconBg: 'bg-cta-light',
    iconColor: 'text-cta-hover',
  },
};

interface PriceCardProps {
  tier: PricingTier;
  /** Authed visitors link straight to the studio; everyone else opens
   *  the auth modal (kept in-page rather than bounced to /login). */
  authed: boolean;
}

function PriceCard({ tier, authed }: PriceCardProps) {
  const { openAuth } = useAuthModal();
  const visuals = TIER_VISUALS[tier.id];
  const Icon = visuals.icon;
  const priceLabel = formatPrice(tier.price, 'GBP');

  // Overnight is GBP-only by config (ZAR null). Pull it out once
  // here so the JSX stays clean.
  const overnightPenceGBP = OVERNIGHT_DELIVERY.price.GBP;
  const overnightLabel = formatPrice(
    { GBP: overnightPenceGBP, ZAR: 0 },
    'GBP',
  );

  return (
    <div
      className={`relative bg-surface-card rounded-2xl p-6 md:p-8 border flex flex-col ${
        tier.highlight
          ? 'border-brand ring-2 ring-brand/20 shadow-xl'
          : 'border-stone-200 shadow-sm'
      }`}
    >
      {tier.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 bg-brand text-brand-foreground text-[11px] uppercase tracking-[0.18em] font-semibold px-3 py-1 rounded-full">
            Most popular
          </span>
        </div>
      )}

      <div className={`${visuals.iconBg} rounded-xl w-12 h-12 flex items-center justify-center mb-5`}>
        <Icon className={`w-5 h-5 ${visuals.iconColor}`} strokeWidth={1.75} />
      </div>

      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-xl md:text-2xl font-semibold text-ink tracking-tight">
          {tier.name}
        </h3>
        <span className="text-[11px] uppercase tracking-[0.18em] text-ink-soft font-medium">
          {tier.tagline}
        </span>
      </div>
      <p className="text-sm text-ink-soft leading-relaxed mb-6">{tier.blurb}</p>

      <div className="mb-6 pb-6 border-b border-stone-100">
        <p className="text-3xl md:text-4xl font-semibold text-ink tracking-tight">
          {priceLabel}
        </p>
        {tier.id !== 'free' && (
          <p className="text-xs text-ink-soft mt-1">per card · plus postage</p>
        )}
      </div>

      <ul className="space-y-2.5 mb-8 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-ink-soft">
            <Check
              className="w-4 h-4 text-cta-hover shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* Overnight add-on note lives on the Printed card only */}
      {tier.id === 'printed' && (
        <div className="mb-6 -mt-2 rounded-xl bg-accent-amber-light/60 border border-accent-amber/30 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Zap
              className="w-4 h-4 text-accent-amber-dark shrink-0 mt-0.5"
              strokeWidth={2.25}
            />
            <div className="text-xs text-ink-soft leading-relaxed">
              <span className="font-semibold text-ink">
                Add overnight delivery · {overnightLabel}
              </span>
              <br />
              {OVERNIGHT_DELIVERY.description}
            </div>
          </div>
        </div>
      )}

      {authed ? (
        <Link href="/studio">
          <Button
            className={`w-full h-11 text-sm font-medium ${
              tier.highlight
                ? 'bg-brand hover:bg-brand-dark text-brand-foreground'
                : 'bg-ink hover:bg-ink/90 text-white'
            }`}
          >
            {tier.ctaLabel}
          </Button>
        </Link>
      ) : (
        <Button
          onClick={() => openAuth('/studio/new-card')}
          className={`w-full h-11 text-sm font-medium ${
            tier.highlight
              ? 'bg-brand hover:bg-brand-dark text-brand-foreground'
              : 'bg-ink hover:bg-ink/90 text-white'
          }`}
        >
          {tier.ctaLabel}
        </Button>
      )}
    </div>
  );
}

export default function PricingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const showAuthedTreatment = !isLoading && isAuthenticated;

  return (
    <div className="min-h-screen bg-surface-card">
      <MarketingHeader />

      <main className="pt-32 md:pt-36 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          {/* Header */}
          <div className="text-center mb-12 md:mb-16 max-w-3xl mx-auto">
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent-coral-dark font-semibold mb-4">
              Pricing
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-ink tracking-tight leading-[1.05]">
              Free for me. Paid for them.
            </h1>
            <p className="text-lg text-ink-soft leading-relaxed mt-6">
              Make as many cards as you like — that bit's on us. Pay only when
              you're sending one to someone special.
            </p>
          </div>

          {/* Price tiers */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-3xl mx-auto">
            {PRICING_TIERS.map((tier) => (
              <PriceCard key={tier.id} tier={tier} authed={showAuthedTreatment} />
            ))}
          </div>

          {/* Placeholder-pricing disclosure — remove once Cost Ledger
              has 2 weeks of data and numbers are locked. */}
          <p className="text-center text-xs text-ink-soft mt-6">
            Launch pricing. Numbers may settle slightly once we've seen how
            real regenerations behave.
          </p>

          {/* Notes */}
          <div className="mt-16 md:mt-20 max-w-3xl mx-auto bg-surface rounded-2xl p-8 md:p-10 border border-stone-200">
            <h2 className="text-xl md:text-2xl font-semibold text-ink tracking-tight mb-4">
              The fine print, kept short.
            </h2>
            <ul className="space-y-3 text-sm text-ink-soft leading-relaxed">
              <li>
                <strong className="text-ink font-semibold">Where we ship:</strong>{' '}
                United Kingdom today. More territories coming — sign in and
                we'll let you know when yours is live.
              </li>
              <li>
                <strong className="text-ink font-semibold">Paper &amp; print:</strong>{' '}
                280gsm gloss-coated art card, printed on an HP Indigo press
                for crisp, vivid colour. Sustainably sourced, vegan-friendly,
                plastic-free and recyclable — packaging included.
              </li>
              <li>
                <strong className="text-ink font-semibold">Delivery:</strong>{' '}
                Standard tracked delivery in 3–5 working days. Order before
                2pm for next-day with the overnight add-on.
              </li>
              <li>
                <strong className="text-ink font-semibold">Free regenerations:</strong>{' '}
                Tweak any part of your card — front, inside, scene, style — as
                many times as you like before sending or printing.
              </li>
              <li>
                <strong className="text-ink font-semibold">Keep what you make:</strong>{' '}
                The free tier lets you download the front and inside as images.
                Order the printed card and you also get the gift moment free —
                the 3D opening view and a private share link that never expires.
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="mt-16 md:mt-20 text-center">
            {showAuthedTreatment ? (
              <Link href="/studio">
                <Button className="bg-brand hover:bg-brand-dark text-brand-foreground h-12 px-8 text-base font-medium">
                  Open my studio
                </Button>
              </Link>
            ) : (
              <Button
                onClick={() => openAuth('/studio/new-card')}
                className="bg-cta hover:bg-cta-hover text-cta-foreground h-12 px-8 text-base font-medium"
              >
                Make my first card
              </Button>
            )}
            <p className="text-xs text-ink-soft mt-4">
              Free to start. No card needed.
            </p>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
