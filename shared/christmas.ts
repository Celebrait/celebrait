// shared/christmas.ts — THE CHRISTMAS CUT-OFF (2026-11-18)
//
// One place for the dates every Christmas surface quotes: the ad's
// landing page (/create?occasion=christmas), the lead-time strip, the
// FAQ and the checkout's date check. Change the date here and all of
// them follow.
//
// WHY 14 DECEMBER: Royal Mail's last recommended posting date for 1st
// Class / Tracked 24 in 2026 is Monday 21 December. A card is printed to
// order (up to three working days), so an order on Monday 14th is posted
// by Thursday 17th, two working days clear.
//
// CHECKED AGAINST PRODIGI 2026-11-23 (prodigi.com/christmas-delivery-dates,
// classic greetings cards to the UK): Standard last order Thursday 17
// December, Express Friday 18 December. Those are "recommended, not
// guaranteed" and Prodigi may still revise them, so look again in early
// December. The 14th is three days inside Prodigi's date and Aidan chose
// to keep it rather than sell to the 16th: a late Christmas card is a
// refund and a bad review.
//
// GB only. ZA prints and couriers by hand on its own calendar.

import { marketId } from './market';

const YEAR = 2026;
/** The season opens (the strips and the Christmas page can show). */
const SEASON_OPENS = new Date(YEAR, 10, 1);
/** Last day an order is promised for Christmas. */
export const CHRISTMAS_LAST_ORDER = new Date(YEAR, 11, 14);
/** Royal Mail's last recommended posting date (1st Class / Tracked 24). */
export const CHRISTMAS_LAST_POST = new Date(YEAR, 11, 21);
export const CHRISTMAS_DAY = new Date(YEAR, 11, 25);
/** How the cut-off is said, everywhere. */
export const CHRISTMAS_LAST_ORDER_LABEL = 'Monday 14 December';

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** 'open' = an order placed now is promised for Christmas; 'closed' = the
 *  cut-off has passed and Christmas is still ahead; 'off' = out of season. */
export type ChristmasPhase = 'off' | 'open' | 'closed';
export function christmasPhase(now: Date = new Date()): ChristmasPhase {
  if (marketId() !== 'GB') return 'off';
  const t = dayStart(now);
  if (t < dayStart(SEASON_OPENS) || t > dayStart(CHRISTMAS_DAY)) return 'off';
  return t <= dayStart(CHRISTMAS_LAST_ORDER) ? 'open' : 'closed';
}

/** Whole days left to order, counting today (0 = today is the last day). */
export function christmasOrderDaysLeft(now: Date = new Date()): number {
  return Math.round((dayStart(CHRISTMAS_LAST_ORDER) - dayStart(now)) / 86_400_000);
}

/** The one line the strips show for the current phase ('' out of season). */
export function christmasOrderLine(now: Date = new Date()): string {
  const phase = christmasPhase(now);
  if (phase === 'open') {
    return christmasOrderDaysLeft(now) === 0
      ? 'Today is the last day to order for Christmas.'
      : `Order by ${CHRISTMAS_LAST_ORDER_LABEL} for Christmas.`;
  }
  if (phase === 'closed') return `Christmas orders closed on ${CHRISTMAS_LAST_ORDER_LABEL}. A card ordered now may arrive after Christmas.`;
  return '';
}

/** Needed on or before Christmas Day, in the season: the Christmas post
 *  decides whether it arrives, not the usual working-day sum. */
export function isChristmasNeedBy(needBy: Date, now: Date = new Date()): boolean {
  return christmasPhase(now) !== 'off' && dayStart(needBy) <= dayStart(CHRISTMAS_DAY);
}

// ── FULL PRICE FOR THE CHRISTMAS AD (Aidan 2026-11-18: "make them pay
// full price") ──────────────────────────────────────────────────────────
// The Christmas landing page carries no offer, so the checkout must not
// hand one out either. The rule is by CARD, not by visitor, so the server
// can check it and a crafted request can't dodge it: a three-card card
// (source 'maker') made for Christmas takes no first-card credit while
// Christmas orders are open. The credit is not burned: it waits for the
// customer's next card. Photo cards and rack cards are untouched.

/** True = this card is sold at its full price: no first-card offer is
 *  shown for it and none is applied. Used by both checkouts, server and
 *  client, so the quoted price is the charged price. */
export function christmasFullPrice(
  source: string | null | undefined,
  occasion: string | null | undefined,
  now: Date = new Date(),
): boolean {
  return source === 'maker' && /christmas/i.test(occasion ?? '') && christmasPhase(now) === 'open';
}

/** True = this account's first touch was the three-card door (/create or
 *  /make) while Christmas orders are open: the Christmas ad's traffic.
 *  Their emails must not promise an offer the checkout won't give. */
export function arrivedForChristmasCards(landingPath: string | null | undefined, now: Date = new Date()): boolean {
  return /^\/(create|make)(\/|$)/.test(landingPath ?? '') && christmasPhase(now) === 'open';
}
