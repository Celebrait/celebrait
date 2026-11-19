// shared/market.ts: ONE switch for which country this deployment sells in.
//
// Aidan 2026-10-15: the launch moves to South Africa (celebrait.co.za,
// PayFast, a local printer, his media company as the trader). Built as a
// switch, not a fork: the UK stays intact behind it for the day it comes
// back. The SERVER reads `MARKET` from env (default GB, so nothing on the
// live site changes until it is flipped); the CLIENT reads the value the
// server injects into the HTML shell (`window.__CELEBRAIT__`), so a page
// never renders a frame in the wrong currency.
//
// Everything that differs by country hangs off MarketConfig. Code asks
// the market, never compares a literal country string.

export type MarketId = 'GB' | 'ZA';
export type MarketCurrency = 'GBP' | 'ZAR';

export interface MarketConfig {
  id: MarketId;
  /** "the United Kingdom" / "South Africa": for sentences. */
  countryName: string;
  currency: MarketCurrency;
  /** Intl locale for dates and numbers. */
  locale: 'en-GB' | 'en-ZA';
  /** Symbol prefix for display: "£" / "R". */
  currencySymbol: string;
  /** Canonical public origin, no trailing slash. PUBLIC_APP_ORIGIN still
   *  overrides it on the server (staging, previews). */
  origin: string;
  /** The www host the server redirects bare and old hosts to. */
  canonicalHost: string;
  /** The one customer inbox. */
  supportEmail: string;
  /** International dialling prefix, for the phone field's placeholder. */
  phonePrefix: string;
  /** Postcode shape the address forms accept. */
  postcodePattern: RegExp;
  postcodeLabel: string;
  postcodeHint: string;
  /** ISO country code sent to the print/courier provider. */
  isoCountry: 'GB' | 'ZA';
  /** The delivery service customer copy may NAME ("Royal Mail 24").
   *  Undefined = copy says "courier" and names nobody (ZA at launch:
   *  printed and couriered by hand, no service chosen yet). */
  courierName?: string;
  /** Whether customer copy may promise tracking. */
  tracked: boolean;
  /** The site-wide lead-time line in this market. Same words in both
   *  today; shared/pricing.ts HONEST_LEAD_LINE is the GB source. */
  leadTimeLine: string;
}

export const MARKETS: Record<MarketId, MarketConfig> = {
  GB: {
    id: 'GB',
    countryName: 'the United Kingdom',
    currency: 'GBP',
    locale: 'en-GB',
    currencySymbol: '£',
    origin: 'https://www.celebrait.co.uk',
    canonicalHost: 'www.celebrait.co.uk',
    supportEmail: 'greetings@celebrait.co.uk',
    phonePrefix: '+44',
    // All live UK formats, permissive on spacing/case.
    postcodePattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/,
    postcodeLabel: 'Postcode',
    postcodeHint: 'A UK postcode. We post within the UK only.',
    isoCountry: 'GB',
    courierName: 'Royal Mail 24',
    tracked: true,
    leadTimeLine: 'Our cards are one-off prints. Please allow at least a week from order to arrival.',
  },
  ZA: {
    id: 'ZA',
    countryName: 'South Africa',
    currency: 'ZAR',
    locale: 'en-ZA',
    currencySymbol: 'R',
    origin: 'https://www.celebrait.co.za',
    canonicalHost: 'www.celebrait.co.za',
    // The co.za domain already has a Microsoft 365 mailbox (MX → outlook).
    supportEmail: 'greetings@celebrait.co.za',
    phonePrefix: '+27',
    // SA postal codes are four digits.
    postcodePattern: /^\d{4}$/,
    postcodeLabel: 'Postal code',
    postcodeHint: 'A four-digit South African postal code.',
    isoCountry: 'ZA',
    courierName: undefined,
    tracked: false,
    leadTimeLine: 'Our cards are one-off prints. Please allow at least a week from order to arrival.',
  },
};

const isMarketId = (v: unknown): v is MarketId => v === 'GB' || v === 'ZA';

/** Server side: the market this process sells in. */
export function serverMarketId(env: Record<string, string | undefined> = (typeof process !== 'undefined' ? process.env : {})): MarketId {
  const v = (env.MARKET ?? '').trim().toUpperCase();
  return isMarketId(v) ? v : 'GB';
}

declare global {
  interface Window {
    __CELEBRAIT__?: { market?: MarketId; pixel?: string };
  }
}

/** The active market, on either side. In the browser it is whatever the
 *  server injected into the shell; on the server it is env MARKET. */
export function marketId(): MarketId {
  if (typeof window !== 'undefined') {
    const m = window.__CELEBRAIT__?.market;
    return isMarketId(m) ? m : 'GB';
  }
  return serverMarketId();
}

export function market(): MarketConfig {
  return MARKETS[marketId()];
}

/** Public origin for links in emails, share URLs, OG tags. Server env
 *  PUBLIC_APP_ORIGIN wins (previews, staging); else the market's own. */
export function publicOrigin(): string {
  const env = typeof process !== 'undefined' ? process.env.PUBLIC_APP_ORIGIN : undefined;
  return (env?.trim() || market().origin).replace(/\/+$/, '');
}

/** Money in minor units → display string in the active market's
 *  currency: 599 → "£5.99", 14900 → "R149". Rand shows whole rands
 *  when the cents are zero, as SA retail does. */
export function formatMoney(minor: number, currency: MarketCurrency = market().currency): string {
  const major = minor / 100;
  if (currency === 'ZAR') {
    return Number.isInteger(major) ? `R${major}` : `R${major.toFixed(2)}`;
  }
  return `£${major.toFixed(2)}`;
}

/** The Meta Pixel id the server injects (env META_PIXEL_ID), digits only.
 *  Undefined = no pixel configured: no consent banner, no script, no
 *  requests. See client/src/lib/pixel.ts. */
export function serverPixelId(env: Record<string, string | undefined> = (typeof process !== 'undefined' ? process.env : {})): string | undefined {
  const v = (env.META_PIXEL_ID ?? '').trim();
  return /^\d{5,20}$/.test(v) ? v : undefined;
}

/** The `<script>` the server puts in every HTML shell. */
export function marketBootScript(id: MarketId = serverMarketId()): string {
  const pixel = serverPixelId();
  return `<script>window.__CELEBRAIT__=${JSON.stringify(pixel ? { market: id, pixel } : { market: id })}</script>`;
}
