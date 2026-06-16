// client/src/components/landing/pricing-strip-section.tsx
//
// Landing-page pricing teaser — three compact cards summarising the
// Free / Digital / Printed tiers, with a "See full pricing →" link
// to /pricing for the detailed table + currency toggle + fine print.
//
// Sits between the testimonial carousel and FAQ on the lander. The
// narrative is: hero (what) → demo (how) → brainstorm reveal (magic)
// → testimonials (proof) → pricing strip (what it costs) → FAQ
// (loose ends) → final CTA.
//
// Same source of truth as /pricing — both render from
// @shared/pricing.PRICING_TIERS so numbers and copy stay aligned.
// UK-PRIMARY LAUNCH (2026-05-12): GBP only across both surfaces. ZAR
// data lives dormant in shared/pricing.ts for when SA goes live.

import { Link } from 'wouter';
import { ArrowRight, Check } from 'lucide-react';
import { PRICING_TIERS, formatPrice, type PricingTier } from '@shared/pricing';

// Strip shows a tighter feature set than /pricing — top 3 bullets
// per tier so the cards stay scannable at a glance. The full list
// lives one click away.
const STRIP_FEATURE_LIMIT = 3;

function StripTier({ tier }: { tier: PricingTier }) {
  const price = formatPrice(tier.price, 'GBP');
  const features = tier.features.slice(0, STRIP_FEATURE_LIMIT);

  return (
    <div
      className={`relative bg-surface-card rounded-2xl p-6 md:p-7 border flex flex-col ${
        tier.highlight
          ? 'border-brand ring-2 ring-brand/20 shadow-lg'
          : 'border-stone-200 shadow-sm'
      }`}
    >
      {tier.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center bg-brand text-brand-foreground text-[10px] uppercase tracking-[0.18em] font-semibold px-2.5 py-1 rounded-full">
            Most popular
          </span>
        </div>
      )}

      <div className="mb-1 flex items-baseline gap-2">
        <h3 className="text-lg md:text-xl font-semibold text-ink tracking-tight">
          {tier.name}
        </h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-ink-soft font-medium">
          {tier.tagline}
        </span>
      </div>

      <p className="text-2xl md:text-3xl font-semibold text-ink tracking-tight mt-3">
        {price}
      </p>
      <p className="text-xs text-ink-soft mt-1 mb-5">
        {tier.id === 'free' ? 'No card needed' : 'per card · one-off'}
      </p>

      <ul className="space-y-2 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
            <Check
              className="w-3.5 h-3.5 text-cta-hover shrink-0 mt-1"
              strokeWidth={2.5}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PricingStripSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        {/* Header */}
        <div className="text-center mb-12 md:mb-14 max-w-2xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-coral-dark font-semibold mb-3">
            Pricing
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-ink tracking-tight leading-[1.1]">
            Free for me. Paid for them.
          </h2>
          <p className="text-base md:text-lg text-ink-soft leading-relaxed mt-5">
            Make as many as you like. Pay only when you're sending one to
            someone special.
          </p>
        </div>

        {/* Tiers */}
        <div className="grid md:grid-cols-3 gap-5 md:gap-6 max-w-5xl mx-auto">
          {PRICING_TIERS.map((tier) => (
            <StripTier key={tier.id} tier={tier} />
          ))}
        </div>

        {/* See-full link.
            NOTE: wouter's <Link> renders its own <a> element. Don't
            wrap children in another <a> — that produces nested <a>
            tags and a `validateDOMNesting` warning. Style className
            and children go straight on <Link>. */}
        <div className="text-center mt-10 md:mt-12">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark transition-colors"
          >
            See full pricing
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
          <p className="text-xs text-ink-soft mt-2">
            Free to start. No card needed.
          </p>
        </div>
      </div>
    </section>
  );
}
