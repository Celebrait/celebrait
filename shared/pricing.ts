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
      '280gsm gloss-coated art card, HP Indigo print',
      'Posted in a kraft envelope, tracked',
      'Sustainably sourced, plastic-free & recyclable',
      'Free digital link included — 3D opening view, share anywhere',
      'See when they open it',
      'Print-resolution file to keep',
    ],
    highlight: true,
    ctaLabel: 'Make & send a card',
  },
];

// ─────────────────────────────────────────────────────────────────────
// Delivery — production time + shipping tiers.
//
// TWO things the customer must understand, kept SEPARATE so we never
// over-promise:
//
//   1. PRODUCTION. Every card is printed to order. Prodigi typically
//      dispatches greeting cards within 24–48h, but their SLA ceiling is
//      up to 72h / 3 working days (live-chat confirmed "no more than 3
//      working days"). We always quote the 72h ceiling.
//   2. SHIPPING. The carrier leg AFTER dispatch. Three speeds below.
//
// The customer's delivery estimate = production (up to 72h) + carrier.
// The fast tiers buy a faster SHIPPING leg, NOT faster production — so we
// deliberately never sell "next day" as next-day-from-order. That honest
// framing must show up site-wide (production banner).
//
// Prices include a small markup over Prodigi's pass-through cost
// (Prodigi 2026-07-03: Budget £1.45, Standard £1.95, Express £5.70,
// Overnight £10.75).
// ─────────────────────────────────────────────────────────────────────

/** Worst-case production/dispatch ceiling before the card leaves the lab. */
export const PRODUCTION_HOURS = 72;

export type ShippingTierId = 'standard' | 'express' | 'overnight';

export interface ShippingTier {
  id: ShippingTierId;
  /** Customer-facing label. */
  name: string;
  /** Carrier + service — the fine print under the label. */
  carrier: string;
  /** Prodigi `shippingMethod` enum value. */
  prodigiMethod: 'Standard' | 'Express' | 'Overnight';
  /** Price charged to the customer, minor units (pence). */
  price: number;
  /** The SHIPPING leg only (after dispatch) — for the estimate line. */
  shippingEstimate: string;
}

export const SHIPPING_TIERS: ShippingTier[] = [
  {
    id: 'standard',
    name: 'Standard',
    carrier: 'Royal Mail 24, tracked',
    prodigiMethod: 'Standard',
    price: 195,
    shippingEstimate: '1–2 working days',
  },
  {
    id: 'express',
    name: 'Express',
    carrier: 'Evri Next Day',
    prodigiMethod: 'Express',
    price: 595,
    shippingEstimate: 'next working day',
  },
  {
    id: 'overnight',
    name: 'Overnight',
    carrier: 'DPD Local Next Day',
    prodigiMethod: 'Overnight',
    price: 1095,
    shippingEstimate: 'next working day',
  },
];

export const DEFAULT_SHIPPING_TIER: ShippingTierId = 'standard';

export function getShippingTier(id: ShippingTierId): ShippingTier {
  const t = SHIPPING_TIERS.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown shipping tier: ${id}`);
  return t;
}

/** The honest expectation-setting line for a tier: production + carrier. */
export function deliveryEstimateCopy(id: ShippingTierId): string {
  const t = getShippingTier(id);
  return `Made to order in up to ${PRODUCTION_HOURS} hrs, then ${t.carrier} (${t.shippingEstimate}).`;
}

/** One-liner for the site-wide production banner + any "how long" copy. */
export const PRODUCTION_NOTICE = `Every card is printed to order — allow up to ${PRODUCTION_HOURS} hrs for production, then your chosen delivery on top.`;

/** Overnight delivery — kept for the /pricing page's add-on callout. The
 *  full picker (SHIPPING_TIERS) is the source of truth at checkout; this
 *  mirrors the overnight tier's price. £10.95 (Prodigi Overnight £10.75 +
 *  small markup). NOTE: "next-day" is the SHIPPING leg — production (up to
 *  72h) still applies first. */
export const OVERNIGHT_DELIVERY = {
  price: { GBP: 1095, ZAR: null }, // ZAR null = not available
  description: 'UK only · next-day courier once printed',
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

/** UK standard shipping — the default/cheapest tier's price, in minor
 *  units (pence). Superseded by SHIPPING_TIERS (the full picker); kept as
 *  the back-compat default when no tier is chosen. Mirrors
 *  getShippingTier('standard').price. */
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
