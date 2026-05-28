// shared/pricing.ts
//
// Pricing config — single source of truth for every surface that
// shows a price. The /pricing page, the landing strip, the
// checkout flow, and any email templates that quote a number all
// import from here. Keep numbers + copy + feature lists in one
// place so they can never drift out of sync.
//
// Decided 2026-05-12:
//   • Three tiers. No bundle (Printed already includes everything
//     Digital does).
//   • "Free for me. Paid for them" framing — free tier exists, but
//     it's about making the card for yourself. Paid tiers are about
//     the gift moment.
//   • UK-PRIMARY LAUNCH. ZAR numbers stay in this file as dormant
//     data — tuned per the SA market research note, ready for the
//     day SA goes live — but no UI consumes them today. The landing
//     strip and /pricing page render GBP only. Re-activate by adding
//     the currency toggle back when SA launches.
//
// Numbers are PLACEHOLDER until Cost Ledger has ~2 weeks of post-
// launch regen-rate data (per next_pricing_and_regen_economics.md).
// The structure can ship now; numbers lock after data.

export type CurrencyCode = 'GBP' | 'ZAR';
export type TierId = 'free' | 'digital' | 'printed';

/** Smallest currency unit (pence for GBP, cents for ZAR). 0 = free. */
export interface TierPrice {
  GBP: number;
  ZAR: number;
}

export interface PricingTier {
  id: TierId;
  /** Short user-facing label, e.g. "Digital". */
  name: string;
  /** "For me" / "For them" / "For the post" — the framing line that
   *  sits below the name on the price card. */
  tagline: string;
  /** One-sentence description below the tagline. */
  blurb: string;
  /** Minor units (pence / cents). 0 for free. */
  price: TierPrice;
  /** Bullet list shown on the tier card. Order matters — most
   *  compelling first. */
  features: string[];
  /** Marks this as the recommended / most-popular tier (gets a badge
   *  + stronger visual treatment). Only one tier should be highlighted. */
  highlight?: boolean;
  /** CTA copy when this tier's button is the call-to-action. */
  ctaLabel: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'For me',
    blurb: 'Make the card. Keep it for yourself.',
    price: { GBP: 0, ZAR: 0 },
    features: [
      'Unlimited generations',
      'Download front + inside as images',
      'Save to your gallery',
      'No payment needed',
    ],
    ctaLabel: 'Start making',
  },
  {
    id: 'digital',
    name: 'Digital',
    tagline: 'For them',
    blurb: 'Send the gift moment — straight to their inbox.',
    price: { GBP: 199, ZAR: 4900 },
    features: [
      'Everything in Free',
      '3D opening card view',
      'Scheduled email delivery',
      '"Designed by you" signature on the back',
      'Shareable view link, works anywhere',
      'See when they opened it',
      'Link never expires',
    ],
    highlight: true,
    ctaLabel: 'Send digital',
  },
  {
    id: 'printed',
    name: 'Printed',
    tagline: 'For the post',
    blurb: 'Premium card delivered. Plus everything digital includes.',
    price: { GBP: 899, ZAR: 19900 },
    features: [
      'Everything in Digital',
      'Premium 350gsm uncoated card',
      'Posted in a kraft envelope',
      'Tracked delivery, 3–5 days',
      'Print-resolution file',
    ],
    ctaLabel: 'Order print',
  },
];

/** Overnight delivery upgrade — NOT a tier, an add-on at checkout
 *  for the Printed path. UK only for now (SAPO is dead; Courier Guy
 *  and Aramex don't do consumer next-day reliably at this price). */
export const OVERNIGHT_DELIVERY = {
  price: { GBP: 1599, ZAR: null }, // ZAR null = not available
  description: 'UK only · order before 2pm for next-day',
  ukOnly: true,
} as const;

// ─────────────────────────────────────────────────────────────────────
// Checkout extras — shipping cost + bundle discount.
//
// Lives here (not in checkout.tsx / studio-checkout.ts) so the client
// and server can't drift apart. The audit
// (next_checkout_shipping_robust.md, 2026-05-27) caught a 50p server
// underprice for "both" orders because the bundle discount lived only
// in the client. One source of truth, both consumers import.
//
// Numbers stay UK-GBP only for V1 — SA is parked.
// ─────────────────────────────────────────────────────────────────────

/** Flat UK standard shipping for a single printed card. In minor units
 *  (pence). Real shipping-tier UX (Standard / Express / Tracked) is
 *  V1.5 — see the checkout-robust note's build order. */
export const UK_SHIPPING_STANDARD_GBP = 150;

/** Discount applied to a "both" order (digital + printed) — the print
 *  tier already includes the digital share, so the bundle saves the
 *  user from paying twice for what they get once. In minor units. */
export const BUNDLE_DISCOUNT_GBP = 50;

/** Derive the GBP price of a tier in minor units. Tiny helper so
 *  consumers don't have to remember the price-shape (`.GBP` indexing). */
export function tierPriceGBP(id: TierId): number {
  return getTier(id).price.GBP;
}

/** Format a TierPrice for display. Returns "Free" when 0. */
export function formatPrice(price: TierPrice, currency: CurrencyCode): string {
  if (price[currency] === 0) return 'Free';
  if (currency === 'GBP') {
    return `£${(price.GBP / 100).toFixed(2)}`;
  }
  // ZAR rendered as whole rand (no cents needed at these prices)
  return `R${Math.round(price.ZAR / 100)}`;
}

/** Lookup helper. */
export function getTier(id: TierId): PricingTier {
  const tier = PRICING_TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown tier id: ${id}`);
  return tier;
}
