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
//   • 2026-10-15: SUPERSEDED for prices: ZAR is live behind the market
//     switch (shared/market.ts). Surfaces call the market-aware
//     cardPrice()/firstOrderPrice()/shippingPrice() at the bottom of
//     this file; the *GBP functions are kept as GB-pinned aliases.
//   • UK-PRIMARY LAUNCH. ZAR numbers stay in this file as dormant
//     data — tuned per the SA market research note, ready for the
//     day SA goes live — but no UI consumes them today. The landing
//     strip and /pricing page render GBP only. Re-activate by adding
//     the currency toggle back when SA launches.
//
// Numbers are PLACEHOLDER until Cost Ledger has ~2 weeks of post-
// launch regen-rate data (per next_pricing_and_regen_economics.md).
// The structure can ship now; numbers lock after data.

import { MARKETS, formatMoney, marketId, type MarketId } from './market';

export type CurrencyCode = 'GBP' | 'ZAR';

// ═════════════════════════════════════════════════════════════════════
// SOUTH AFRICA (ZAR) PRICES: PLACEHOLDERS (2026-10-15)
//
// Aidan hasn't set the SA prices yet. Change them HERE and nowhere
// else: every rand on the site, at both checkouts, in the server's
// charge and in emails derives from this one object (via cardPrice(),
// firstOrderPrice(), shippingPrice() below). Minor units (cents):
// 9900 = R99. Only read when the market is ZA (env MARKET=ZA); the UK
// prices further down are untouched by it.
// ═════════════════════════════════════════════════════════════════════
export const ZAR_PRICES = {
  card: {
    rack: 9900,   // R99, off the shelf
    maker: 12900, // R129, made for them
    photo: 14900, // R149, from your photo
  },
  /** Standard delivery by courier, tracked. Charged once per order. */
  shipping: 7900, // R79
  /** Wax-seal envelope sticker: NOT offered in South Africa (0 = never
   *  shown, never charged). */
  envelopeSticker: 0,
} as const;

/** ZA courier leg after printing, in working days (PLACEHOLDER: no
 *  courier chosen yet). Feeds the "expect it by" date, the shipped
 *  email's arrival window and the JSON-LD transit time. */
export const ZA_COURIER_WORKING_DAYS = { min: 2, max: 4 } as const;
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

// The 'free' tier was dropped from this list 2026-09-09 (Aidan: "free
// route can go, no need to advertise this"). Making is still free; it
// just isn't sold as a product. TierId keeps 'free' for old references.
export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'printed',
    name: 'Printed & posted',
    tagline: 'For them',
    blurb: 'The real thing in the post, with a free digital link to share too.',
    // ⚠️ THE "FROM" PRICE, NOT THE ONLY PRICE (2026-08-27). Cards are
    // priced by door — £4.99 off the shelf, £5.99 made for them, £6.99
    // from your photo (CARD_PRICES_GBP). This tier exists for the
    // /pricing page's headline, so it carries the cheapest. The AMOUNT
    // CHARGED always comes from cardPrice(card.source), never from
    // here — see UX_THREE_DOORS.md §8a.
    price: { GBP: 499, ZAR: ZAR_PRICES.card.rack },
    // A getter, so the price line is written in the active market's
    // currency when it is read (the market is known by then).
    get features() {
      return [
        `${formatMoney(cardPrice('rack'))} off the shelf · ${formatMoney(cardPrice('maker'))} made for them · ${formatMoney(cardPrice('photo'))} from your photo`,
        ...PRINTED_FEATURES_REST,
      ];
    },
    highlight: true,
    ctaLabel: 'Make & send a card',
  },
];

const PRINTED_FEATURES_REST = [
  '280gsm gloss-coated art card, HP Indigo print',
  'Posted in a kraft envelope, tracked',
  'Sustainably sourced, plastic-free & recyclable',
  'Free digital link included: 3D opening view, share anywhere',
  'See when they open it',
  'Print-resolution file to keep',
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
// Prices cover Prodigi's real INC-VAT shipping cost + a small margin.
// Celebrait is NOT VAT-registered, so we can't reclaim Prodigi's VAT — the
// true cost is the inc-VAT figure (Kevin 2026-07-21, from live invoices):
// Standard (RM24) £2.35 ex → £2.82 inc; Express (Evri) £6.45 → £7.74;
// Overnight (DPD) £10.75 → £12.90. Charging £3.95/£8.95/£13.95 clears cost
// by ~£1 each (the old £1.95/£5.95/£10.95 sold every tier at a loss).
// ─────────────────────────────────────────────────────────────────────

/** Worst-case production/dispatch ceiling before the card leaves the lab. */
export const PRODUCTION_HOURS = 72;

export type ShippingTierId = 'standard' | 'express' | 'overnight';

export interface ShippingTier {
  id: ShippingTierId;
  /** Customer-facing label. */
  name: string;
  /** Carrier + service — the fine print under the label. GB wording:
   *  surfaces read shippingCarrierLabel() for the active market. */
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
    // £2.95 (Aidan, 2026-08-27). Deliberately AT COST — true inc-VAT
    // cost is £2.82, so standard postage clears ~13p. Postage is a
    // conversion lever, not a margin line: the card carries the margin
    // (see UX_THREE_DOORS.md §8a) and with the basket this is charged
    // ONCE per order however many cards are in it. ⚠️ Any Prodigi
    // shipping increase puts this underwater — watch it.
    price: 295,
    shippingEstimate: '1–2 working days',
  },
  {
    id: 'express',
    name: 'Express',
    carrier: 'Evri Next Day',
    prodigiMethod: 'Express',
    price: 895,
    shippingEstimate: 'next working day',
  },
  {
    id: 'overnight',
    name: 'Overnight',
    carrier: 'DPD Local Next Day',
    prodigiMethod: 'Overnight',
    price: 1395,
    shippingEstimate: 'next working day',
  },
];

export const DEFAULT_SHIPPING_TIER: ShippingTierId = 'standard';

// ── ONE POSTAGE OPTION AT LAUNCH (Aidan 2026-09-09) ─────────────────
// Express and Overnight bought a faster carrier leg on top of up to three
// working days of production — pricey, and they couldn't deliver what a
// "next day" label promises on any other shop. So the picker is gone:
// every order ships Standard, and the promise is set the other way
// round — ORDER A WEEK AHEAD. The other tiers stay in SHIPPING_TIERS so
// historical orders (emails, admin, Prodigi resubmits) still resolve.
export const OFFERED_SHIPPING_TIER_IDS: readonly ShippingTierId[] = ['standard'];
export const OFFERED_SHIPPING_TIERS: ShippingTier[] = SHIPPING_TIERS.filter((t) => OFFERED_SHIPPING_TIER_IDS.includes(t.id));

export function getShippingTier(id: ShippingTierId): ShippingTier {
  const t = SHIPPING_TIERS.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown shipping tier: ${id}`);
  return t;
}

/** The honest expectation-setting line for a tier: production + carrier. */
export function deliveryEstimateCopy(id: ShippingTierId): string {
  return `Printed to order (up to ${PRODUCTION_WORKING_DAYS} working days), then ${shippingCarrierLabel(id)} (${shippingEstimateLabel(id)}).`;
}

/** One-liner for the site-wide production banner + any "how long" copy. */
export const PRODUCTION_NOTICE = `Our cards are one-off prints. Please allow at least a week from order to arrival.`;
/** THE lead-time line, site-wide — banner, maker touchpoints, giving
 *  moment, pricing, FAQ (Aidan 2026-09-09, his words). Prominent, not
 *  small print: every card is printed once, to order, by a partner
 *  printer, then posted Royal Mail 24. */
export const HONEST_LEAD_LINE = PRODUCTION_NOTICE;

// ── The delivery window, as DATES ───────────────────────────────────
// A customer buying a card for a day doesn't think in "72 hrs + 1–2
// working days"; they think "will it be there by Saturday?". So every
// checkout surface says a date. The window is production (Prodigi's
// ceiling: 3 working days) + Royal Mail 24 (1–2 working days), counted
// in working days from the order — weekends don't print or post.
// "Order a week ahead" is the same promise said simply.

/** Prodigi's stated ceiling, in working days (their "up to 72h"). */
export const PRODUCTION_WORKING_DAYS = 3;
/** Royal Mail 24: usually next working day, allow two. */
export const STANDARD_POST_WORKING_DAYS = { min: 1, max: 2 } as const;
/** The plain-English promise we make everywhere. */
export const ORDER_AHEAD_DAYS = 7;

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) left -= 1;
  }
  return d;
}

/** The arrival window for an order placed at `from` (now).
 *
 *  `latest` is THE date we quote — "expect it by" — and it honours the
 *  promise on every page: never sooner than ORDER_AHEAD_DAYS calendar
 *  days out (rolled past a weekend), and never sooner than the print +
 *  post working days either. `earliest` is what the post can physically
 *  do (used only to tell "might make it" from "won't") — it is never
 *  shown, because a date range that reads "Mon 14 – Thu 17" under a line
 *  saying "allow at least a week" is a contradiction (Aidan 2026-09-10). */
export function deliveryWindow(from: Date = new Date()): { earliest: Date; latest: Date } {
  const post = transitWorkingDays();
  const earliest = addWorkingDays(from, 1 + post.min);
  const promised = new Date(from.getFullYear(), from.getMonth(), from.getDate() + ORDER_AHEAD_DAYS);
  while (isWeekend(promised)) promised.setDate(promised.getDate() + 1);
  const byWork = addWorkingDays(from, PRODUCTION_WORKING_DAYS + post.max);
  return { earliest, latest: byWork > promised ? byWork : promised };
}

/** The one date we quote: "expect it by Thu 17 Sept". */
export function expectedBy(from: Date = new Date()): Date {
  return deliveryWindow(from).latest;
}

/** "Tue 16 Sep" — short, British, no year (the window is days away). */
export function formatDayMonth(d: Date): string {
  return d.toLocaleDateString(MARKETS[marketId()].locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Parse a YYYY-MM-DD (the <input type=date> value) as a local date. */
export function parseISODate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export type ArrivalTone = 'ok' | 'tight' | 'late';
export interface ArrivalVerdict {
  tone: ArrivalTone;
  /** Days between the latest arrival and the day they need it (negative = late). */
  spareDays: number;
  earliest: Date;
  latest: Date;
}

/** Will a card ordered at `from` be there by `needBy`? Never blocks a
 *  purchase — it tells the truth so the customer can decide (and knows
 *  the free digital link lands instantly either way). */
export function arrivalVerdict(needBy: Date, from: Date = new Date()): ArrivalVerdict {
  const { earliest, latest } = deliveryWindow(from);
  const day = 24 * 60 * 60 * 1000;
  const spareDays = Math.round((needBy.getTime() - latest.getTime()) / day);
  const tone: ArrivalTone = spareDays >= 0 ? 'ok' : needBy.getTime() >= earliest.getTime() ? 'tight' : 'late';
  return { tone, spareDays, earliest, latest };
}

/** Overnight delivery — NOT OFFERED since 2026-09-09 (see
 *  OFFERED_SHIPPING_TIER_IDS). Kept as data only; no surface renders it. */
export const OVERNIGHT_DELIVERY = {
  price: { GBP: 1395, ZAR: null }, // ZAR null = not available
  // Not offered anywhere since 2026-09-09; never sold in ZA.
  get description() {
    return marketId() === 'GB' ? 'UK only · next-day courier once printed' : 'Not available in South Africa';
  },
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
export const UK_SHIPPING_STANDARD_GBP = 295;

/** Optional wax-seal envelope sticker ("only open on your special day"),
 *  minor units (pence). An OPT-IN add-on (Kevin 2026-07-21) — it's pricey,
 *  so the customer chooses it at checkout rather than it being baked into a
 *  direct-delivery surcharge. Covers the ~£1.20 inc-VAT Prodigi cost + a bit.
 *  Only offered/charged on direct-to-recipient sends (the seal goes on the
 *  kraft envelope WE post). Direct delivery itself is now FREE. Lives here so
 *  the client display and the server charge can't drift. */
export const ENVELOPE_STICKER_GBP = 150;

/** The envelope-sticker charge: £1.50 when chosen (direct sends only), else
 *  £0. Server + client both call this so the shown total equals the charge. */
export function envelopeStickerGBP(
  chosen: boolean,
  shipTo: 'sender' | 'recipient' | null | undefined,
): number {
  return envelopeStickerPrice(chosen, shipTo, 'GB');
}

/** Derive the GBP price of a tier in minor units. Tiny helper so
 *  consumers don't have to remember the price-shape (`.GBP` indexing). */
export function tierPriceGBP(id: TierId): number {
  return tierPrice(id, 'GB');
}

// ─────────────────────────────────────────────────────────────────────
// PRICE BY DOOR — the three-tier ladder (Aidan, 2026-08-27).
// See UX_THREE_DOORS.md §8a. Supersedes the flat £8.99: customers read
// pre-made < made-for-you < made-from-your-photo instantly, and the
// cost ladder matches the price ladder. Every card's price derives
// from its `source`, so a basket of mixed doors totals correctly.
// ─────────────────────────────────────────────────────────────────────

/** Which door produced a card. Mirrors `cards.source`. */
export type CardSource = 'rack' | 'maker' | 'photo';

export const CARD_PRICES_GBP: Record<CardSource, number> = {
  rack: 499,   // pre-made stock, no generation spend
  maker: 599,  // written and drawn for them (~£0.21 of tokens)
  photo: 699,  // the differentiator, highest production cost
};

/** The GBP price (minor units) of a card from a given door. Unknown or
 *  legacy sources fall back to `photo` — the historic £8.99 product was
 *  the photo card, so an unlabelled row is a photo row. */
export function cardPriceGBP(source: string | null | undefined): number {
  return cardPrice(source, 'GB');
}

/** Time to make, start to finish, by door (Aidan 2026-09-10: "roughly
 *  3–5 mins for casual, 7–10 mins director"). Said on every route. */
export const MAKE_TIME: Record<CardSource, string> = {
  rack: 'about a minute',
  maker: '3–5 minutes',
  photo: '7–10 minutes',
};

/** The cheapest door, for "from £X" copy. */
export const CARD_PRICE_FROM_GBP = Math.min(...Object.values(CARD_PRICES_GBP));

/** Format a TierPrice for display. Returns "Free" when 0. */
export function formatPrice(price: TierPrice, currency: CurrencyCode): string {
  if (price[currency] === 0) return 'Free';
  return formatMoney(price[currency], currency);
}

/** Lookup helper. */
export function getTier(id: TierId): PricingTier {
  const tier = PRICING_TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown tier id: ${id}`);
  return tier;
}

// ── Provider-cost currency (admin views only) ────────────────────────
// AI generation is billed by providers in USD, so generation_log costs
// (and the Cost Ledger) are in USD. We operate in GBP, so the admin views
// convert for display using a fixed approximate rate. DISPLAY ONLY — never
// used for customer billing. Bump this when the rate drifts materially.
export const USD_TO_GBP = 0.79;

/** generation_log.costCentsX100 is USD cents × 100 (1340 = $0.134).
 *  Returns the approximate cost in GBP pounds. */
export function genCostUsdX100ToGbp(costCentsX100: number): number {
  return (costCentsX100 / 10_000) * USD_TO_GBP;
}

// ── The first-order offer (2026-09-02) ──────────────────────────────
// Replaces the photo-only free first card: add three key dates and your
// FIRST made-for-them card is half price. The reference price is the
// everyday `cardPriceGBP` (never inflated for the strike-through — CAP
// Code). Rounded DOWN to the penny so the customer never loses a fraction.
export const FIRST_ORDER_DISCOUNT = 0.5;
export function firstOrderPriceGBP(source: Parameters<typeof cardPriceGBP>[0]): number {
  return firstOrderPrice(source, 'GB');
}

// ═════════════════════════════════════════════════════════════════════
// MARKET-AWARE PRICES (2026-10-15): what every surface calls.
//
// Each returns MINOR UNITS in the active market's currency (pence in
// GB, cents in ZA; see shared/market.ts). The client knows the market
// from the shell the server injects; the server from env MARKET. The
// optional `m` pins a market (tests, and the *GBP aliases above).
// Display with formatMoney() from shared/market. The server charges
// from these same functions, so the shown total is the charged total.
// ═════════════════════════════════════════════════════════════════════

interface MarketPrices {
  card: Readonly<Record<CardSource, number>>;
  /** The one postage option sold at launch. */
  shipping: number;
  /** 0 = the sticker is not offered in this market. */
  envelopeSticker: number;
}

function pricesFor(m: MarketId): MarketPrices {
  if (m === 'ZA') return ZAR_PRICES;
  return {
    card: CARD_PRICES_GBP,
    shipping: UK_SHIPPING_STANDARD_GBP,
    envelopeSticker: ENVELOPE_STICKER_GBP,
  };
}

/** Every door's price in the active market. */
export function cardPrices(m: MarketId = marketId()): Readonly<Record<CardSource, number>> {
  return pricesFor(m).card;
}

/** The price of a card from a given door. Unknown or legacy sources
 *  fall back to `photo` (an unlabelled row is a photo row). */
export function cardPrice(source: string | null | undefined, m: MarketId = marketId()): number {
  const table = pricesFor(m).card;
  return table[(source ?? 'photo') as CardSource] ?? table.photo;
}

/** The first-order offer price (half the everyday price, rounded DOWN
 *  to the minor unit so the customer never loses a fraction). */
export function firstOrderPrice(source: string | null | undefined, m: MarketId = marketId()): number {
  return Math.floor(cardPrice(source, m) * (1 - FIRST_ORDER_DISCOUNT));
}

/** Postage for an order. GB resolves the tier (historical orders can
 *  carry express/overnight); ZA sells one courier option, so every tier
 *  id resolves to it. */
export function shippingPrice(tier: ShippingTierId = DEFAULT_SHIPPING_TIER, m: MarketId = marketId()): number {
  return m === 'ZA' ? ZAR_PRICES.shipping : getShippingTier(tier).price;
}

/** The postage line's fine print: "Royal Mail 24, tracked" in GB; in
 *  ZA the market's named courier, or plain "Courier" while none is
 *  chosen (and "tracked" only where the market may promise it). */
export function shippingCarrierLabel(tier: ShippingTierId = DEFAULT_SHIPPING_TIER, m: MarketId = marketId()): string {
  if (m === 'GB') return getShippingTier(tier).carrier;
  const cfg = MARKETS[m];
  return `${cfg.courierName ?? 'Courier'}${cfg.tracked ? ', tracked' : ''}`;
}

/** The carrier leg in working days: Royal Mail 24 (1–2) in GB, the
 *  courier placeholder (ZA_COURIER_WORKING_DAYS) in ZA. */
export function transitWorkingDays(m: MarketId = marketId()): { min: number; max: number } {
  return m === 'ZA' ? ZA_COURIER_WORKING_DAYS : STANDARD_POST_WORKING_DAYS;
}

/** The carrier leg as words, for the shipped email and estimate copy:
 *  the tier's own ("1–2 working days") in GB, "2–4 working days" in ZA. */
export function shippingEstimateLabel(tier: ShippingTierId = DEFAULT_SHIPPING_TIER, m: MarketId = marketId()): string {
  if (m === 'GB') return getShippingTier(tier).shippingEstimate;
  const d = transitWorkingDays(m);
  return `${d.min}–${d.max} working days`;
}

/** The cheapest door, for "from R99" / "from £4.99" copy. */
export function cardPriceFrom(m: MarketId = marketId()): number {
  return Math.min(...Object.values(pricesFor(m).card));
}

/** Is the wax-seal envelope sticker sold in this market at all? */
export function envelopeStickerOffered(m: MarketId = marketId()): boolean {
  return pricesFor(m).envelopeSticker > 0;
}

/** The sticker's unit price (0 where it isn't offered). */
export function envelopeStickerUnitPrice(m: MarketId = marketId()): number {
  return pricesFor(m).envelopeSticker;
}

/** The sticker charge for an order: its price when chosen on a direct
 *  send in a market that sells it, else 0. Client and server both call
 *  this so the shown total equals the charge. */
export function envelopeStickerPrice(
  chosen: boolean,
  shipTo: 'sender' | 'recipient' | null | undefined,
  m: MarketId = marketId(),
): number {
  return chosen && shipTo === 'recipient' ? pricesFor(m).envelopeSticker : 0;
}

/** The static shell (client/index.html) states GB prices in its JSON-LD
 *  for crawlers: the photo card ("price": "6.99") and postage ("value":
 *  "2.95"). Rewrite them to the active market's. A no-op in GB. */
export function marketizeShellPrices(html: string, m: MarketId = marketId()): string {
  if (m === 'GB') return html;
  const major = (minor: number) => (minor / 100).toFixed(2);
  const esc = (s: string) => s.replace('.', '\\.');
  const gbT = transitWorkingDays('GB');
  const t = transitWorkingDays(m);
  return html
    // The carrier leg ("transitTime" min/max days) to the market's.
    .replace(
      new RegExp(`("transitTime":\\s*\\{[^}]*?"minValue":\\s*)${gbT.min}(,[^}]*?"maxValue":\\s*)${gbT.max}\\b`),
      `$1${t.min}$2${t.max}`,
    )
    .replace(new RegExp(`("price":\\s*")${esc(major(cardPrice('photo', 'GB')))}(")`, 'g'), `$1${major(cardPrice('photo', m))}$2`)
    .replace(new RegExp(`("value":\\s*")${esc(major(shippingPrice(DEFAULT_SHIPPING_TIER, 'GB')))}(")`, 'g'), `$1${major(shippingPrice(DEFAULT_SHIPPING_TIER, m))}$2`);
}

/** A tier's headline price in the active market's currency. */
export function tierPrice(id: TierId, m: MarketId = marketId()): number {
  return getTier(id).price[m === 'ZA' ? 'ZAR' : 'GBP'];
}
