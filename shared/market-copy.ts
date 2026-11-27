// shared/market-copy.ts: the country WORDS that change with the market.
//
// Prices and the £/R live in shared/pricing.ts + formatMoney; this file
// is only the prose: where we post, who carries it, what the footer
// says. GB strings are today's copy word for word (the live site must
// not move until MARKET flips). ZA strings are plain and honest: at
// launch the cards are printed and couriered by hand, so no courier is
// named and no tracking is promised unless MarketConfig says so.

import { market, type MarketConfig } from './market';

/** "posted Royal Mail 24, tracked" / "sent by courier". Driven by
 *  MarketConfig.courierName + tracked, never a literal. */
export function shipPhrase(m: MarketConfig = market(), withTracking = true): string {
  const t = withTracking && m.tracked ? ', tracked' : '';
  return m.courierName ? `posted ${m.courierName}${t}` : `sent by courier${t}`;
}

export function copyFor(m: MarketConfig = market()) {
  const za = m.id === 'ZA';
  return {
    za,
    /** "the UK" / "South Africa": the short name for sentences. */
    country: za ? 'South Africa' : 'the UK',
    /** "anywhere in the UK" / "anywhere in South Africa". */
    anywhere: za ? 'anywhere in South Africa' : 'anywhere in the UK',
    /** "printed in the UK" / "printed in South Africa". */
    printedIn: za ? 'printed in South Africa' : 'printed in the UK',
    /** Footer sign-off. */
    madeIn: za ? 'Made in South Africa' : 'Made in Manchester',
    /** Pricing/checkout note on where we deliver. */
    addressesOnly: za
      ? 'South African addresses only for now. Buying from abroad is fine; have it sent straight to them.'
      : 'UK addresses only for now. Buying from abroad is fine; have it sent straight to them.',
    /** ZA's one delivery sentence (GB surfaces keep their own wording). */
    deliveryLine: `Printed to order, then ${shipPhrase(m, false)} to anywhere in ${za ? 'South Africa' : 'the UK'}. Please allow at least a week from order to arrival.`,
    shipPhrase: shipPhrase(m),
    /** "Posted tracked" (GB) / "Sent by courier" (ZA): sentence opener. */
    sentHow: `${za ? 'Sent by courier' : 'Posted'}${m.tracked ? ' tracked' : ''}`,
    /** "celebrait.co.uk" / "celebrait.co.za": the bare domain for print + art. */
    domain: m.canonicalHost.replace(/^www\./, ''),
  };
}
