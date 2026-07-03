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
// Print-led V1 (decided 2026-07-01): the printed card is the only paid
// product and it INCLUDES a free digital link. No standalone 'digital'
// tier. See next_digital_card_strategy.md.
export type TierId = 'free' | 'printed';

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
    id: 'printed',
    name: 'Printed & posted',
    tagline: 'For them',
    blurb: 'The real thing in the post — with a free digital link to share too.',
    // Card price only. UK postage is a separate line at checkout
    // (UK_SHIPPING_STANDARD_GBP below); overnight is an optional add-on.
    price: { GBP: 899, ZAR: 19900 },
    features: [
      'Premium 350gsm uncoated card',
      'Posted in a kraft envelope',
      'Tracked delivery, 3–5 days',
      'Free digital link included — 3D opening view, share anywhere',
      'See when they open it',
      'Print-resolution file to keep',
    ],
    highlight: true,
    ctaLabel: 'Make & send a card',
  },
];

/** Overnight delivery upgrade — NOT a tier, an add-on at checkout for the
 *  Printed path. UK only. £10.75 = Prodigi's Overnight rate (their SKU
 *  GLOBAL-GRE-GLOS-6X6-DIR, confirmed 2026-07-03), passed through at cost. */
export const OVERNIGHT_DELIVERY = {
  price: { GBP: 1075, ZAR: null }, // ZAR null = not available
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

/** UK standard shipping for a single printed card, shown as its own line
 *  at checkout. In minor units (pence). £1.95 = Prodigi's Standard rate
 *  (Royal Mail RM24, SKU GLOBAL-GRE-GLOS-6X6-DIR, confirmed 2026-07-03),
 *  passed through at cost. Prodigi's other tiers for the same SKU: Budget
 *  £1.45, Express £5.70, Overnight £10.75 (see OVERNIGHT_DELIVERY). A full
 *  shipping-tier picker at checkout is the follow-on (needs a delivery-
 *  speed field on the order, threaded to the Prodigi shippingMethod). */
export const UK_SHIPPING_STANDARD_GBP = 195;

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
