// client/src/components/landing/ticker-banner.tsx
//
// The top banner. TWO messages, rotating (Aidan 2026-09-09): the
// first-card offer, and the honest bit about the post — "right now we
// rely on a partner printer, so allow a week." Each holds for eight
// seconds and crossfades; the honesty line taps through to the delivery
// answer on /pricing. Reduced-motion viewers get the same two messages
// swapped without the fade.
//
// NB "limited time" was dropped 2026-08-06. The offer has no end date
// and we don't intend to set one, and the ASA regularly upholds against
// urgency claims on offers that just run and run. "Your first card is
// on us" is true indefinitely and needs no defending.
//
// (Name kept from the brief marquee era so call sites didn't churn.)

import { useEffect, useState } from 'react';
import { Gift, Truck } from 'lucide-react';
import { Link, useLocation, useSearch } from 'wouter';
import { cardPrice, firstOrderPrice, shippingPrice } from '@shared/pricing';
import { useFirstCardOnUs } from '@/hooks/use-first-card-offer';
import { formatMoney } from '@shared/market';
import { useMakerEnabled } from '@/hooks/use-maker';
import { useBetaMode } from '@/hooks/use-beta';
import { useAuth } from '@/hooks/use-auth';
import { christmasPhase } from '@shared/christmas';

/** Fired when the offer is tapped. The landing page's FreeCardInvite
 *  listens and opens the claim modal. */
export const CLAIM_EVENT = 'celebrait:claim-free-card';

/** Query flag that opens the claim on arrival. The invite modal only
 *  mounts on the landing page, so a CTA on /blog or /pricing can't just
 *  fire the event — it has to get the visitor home AND open the offer
 *  there. Without this they'd land on / with nothing happening. */
export const CLAIM_PARAM = 'claim';

/** Open the free-card claim from anywhere. On the landing page that's the
 *  event; elsewhere it's a trip home carrying the flag. Every signed-out
 *  "start a card" CTA should use this, so the offer is what greets them
 *  (Aidan 2026-08-06: "just want everyone presented with this"). */
/** Which door's price the offer should quote. The header (and so this
 *  ticker) is shared by both landing pages, and the line was hardcoded to
 *  the three-card price — so on /photo it promised £5.99→£2.99 for a card
 *  that is £6.99→£3.49 at checkout (audit 2026-10-06). The number must be
 *  the number this door will actually charge. */
/** With the three-card route parked (2026-10-29) every page is the
 *  photo door: it is the only card a customer can make. */
function doorFor(path: string, maker = true): 'photo' | 'maker' {
  return !maker || path.startsWith('/photo') ? 'photo' : 'maker';
}

export function useClaimFreeCard() {
  const [location, setLocation] = useLocation();
  // While the three-card route is parked, `/` renders the photo page too.
  const maker = useMakerEnabled() === true;
  const { isAuthenticated } = useAuth();
  return () => {
    // Signed in already: the invite modal refuses to open (it's a sign-up
    // surface), so "Claim it" went nowhere (Aidan 2026-11-07). The dates
    // live on Moments — that IS the claim for an account.
    if (isAuthenticated) {
      setLocation('/studio/moments');
      return;
    }
    // On the three-card door the offer is that door's own (half price on
    // the first card for three dates), claimed by signing up and adding
    // the dates. It used to go to the photo page's invite, which promises
    // a free PHOTO card: the wrong offer for someone who came for three
    // cards, and it walked ad traffic off the route under test (2026-11-17).
    if (maker && /^\/(create|make)(\/|$)/.test(location)) {
      setLocation(`/login?redirect=${encodeURIComponent('/studio/moments')}`);
      return;
    }
    // The invite modal mounts on the PHOTO landing page — /photo since
    // the gate took / (2026-09-03).
    if (location === '/photo' || location === '/keeper' || (location === '/' && !maker)) {
      window.dispatchEvent(
        new CustomEvent(CLAIM_EVENT, { detail: { intent: 'asked' } }),
      );
    } else {
      setLocation(`/photo?${CLAIM_PARAM}=1`);
    }
  };
}

const HOLD_MS = 8000;

/** The Christmas ad's journey (/create and /make carrying
 *  occasion=christmas, while Christmas orders are open) runs with NO offer
 *  (Aidan 2026-11-18: "lets have no offer"): the ad sells the card at its
 *  price, so the strip must not dangle half price over it. */
function isChristmasVisit(path: string, search: string): boolean {
  return /^\/(create|make)(\/|$)/.test(path)
    && new URLSearchParams(search).get('occasion') === 'christmas'
    && christmasPhase() === 'open';
}

export function TickerBanner() {
  const [tickerPath] = useLocation();
  const search = useSearch();
  const door = doorFor(tickerPath, useMakerEnabled() === true);
  const claimTap = useClaimFreeCard();
  const noOffer = isChristmasVisit(tickerPath, search);
  // 0 = the offer, 1 = the honest lead line.
  const [rotating, setSlot] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSlot((s) => (s + 1) % 2), HOLD_MS);
    return () => window.clearInterval(t);
  }, []);
  // No offer to rotate to: the honest line holds.
  const slot = noOffer ? 1 : rotating;

  // Beta (2026-11-05): a "50% off" offer over a site that sells nothing is
  // a lie — no strip at all while beta mode is on.
  const betaMode = useBetaMode();
  // The free first card is a PHOTO card. On the three-card door the line
  // must quote what that door charges (half price), never "on us".
  const onUs = useFirstCardOnUs() && door === 'photo';
  if (betaMode) return null;

  const msg = 'flex items-center gap-2 whitespace-nowrap font-sans text-[11.5px] font-medium text-white underline-offset-2 hover:underline sm:text-[12.5px] transition-opacity duration-500 motion-reduce:transition-none';

  return (
    <div
      className="pointer-events-auto relative flex h-10 items-center justify-center px-4"
      style={{ background: 'linear-gradient(90deg, #211D19 0%, #5c57d4 100%)' }}
      data-testid="ticker-banner"
      aria-live="polite"
    >
      {!noOffer && <button
        type="button"
        onClick={claimTap}
        aria-hidden={slot !== 0}
        tabIndex={slot === 0 ? 0 : -1}
        className={`${msg} ${slot === 0 ? 'opacity-100' : 'pointer-events-none absolute opacity-0'}`}
        data-testid="ticker-free-card"
      >
        {/* Coral trial (Aidan 2026-09-04): the warm accent on the OFFER only. */}
        <Gift className="h-3.5 w-3.5 shrink-0 text-accent-coral" aria-hidden="true" />
        {onUs ? (
          <>
            <span className="sm:hidden">
              Your first card’s <b className="text-accent-coral">on us</b>. Seriously. Claim it ›
            </span>
            <span className="hidden sm:inline">
              Tell us 3 dates that matter and your first card’s <b className="text-accent-coral">on us</b>. Seriously. Just {formatMoney(shippingPrice())} postage. Claim it ›
            </span>
          </>
        ) : (
          <>
            <span className="sm:hidden">
              Add 3 dates that matter for <b className="text-accent-coral">50% off</b> your first card. Claim it ›
            </span>
            <span className="hidden sm:inline">
              Tell us 3 dates that matter and your first card is{' '}
              <span className="line-through opacity-70">{formatMoney(cardPrice(door))}</span> <b className="text-accent-coral">{formatMoney(firstOrderPrice(door))}</b>.
              Claim it ›
            </span>
          </>
        )}
      </button>}

      <Link
        href="/pricing"
        aria-hidden={slot !== 1}
        tabIndex={slot === 1 ? 0 : -1}
        className={`${msg} ${slot === 1 ? 'opacity-100' : 'pointer-events-none absolute opacity-0'}`}
        data-testid="ticker-honest-lead"
      >
        <Truck className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden="true" />
        {/* Phones get the short form: the full line is 391px wide at this
            size and ran off both edges of a 375px screen (found 2026-11-18). */}
        <span className="sm:hidden">
          One-off prints. Please <b>allow at least a week</b> ›
        </span>
        <span className="hidden sm:inline">
          Our cards are one-off prints. Please <b>allow at least a week</b> from order to arrival ›
        </span>
      </Link>
    </div>
  );
}
