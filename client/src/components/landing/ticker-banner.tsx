// client/src/components/landing/ticker-banner.tsx
//
// ONE OFFER, ONE SWITCH (Aidan 2026-11-27: "turn it off site wide,
// simple toggle to activate with consistency"). The only offer there is:
// the first PHOTO card on us, switched at /admin/site. Switch off (or its
// caps reached) and this strip shows the post line alone, on every page.
// Switch on and it says the same words on every page that shows it. It
// used to say "half price" on the home page and "on us" on the photo
// page, and tapping the half-price line opened the free-card popup.
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
import { Link, useLocation } from 'wouter';
import { shippingPrice } from '@shared/pricing';
import { useFirstCardOnUs } from '@/hooks/use-first-card-offer';
import { formatMoney } from '@shared/market';
import { useMakerEnabled } from '@/hooks/use-maker';
import { useBetaMode } from '@/hooks/use-beta';
import { useAuth } from '@/hooks/use-auth';

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
export function useClaimFreeCard() {
  const [location, setLocation] = useLocation();
  // While the three-card route is parked, `/` renders the photo page too.
  const maker = useMakerEnabled() === true;
  const { isAuthenticated } = useAuth();
  const offerOpen = useFirstCardOnUs();
  return () => {
    // No offer on: there is nothing to claim, so this is simply "start a
    // card": the studio for an account, the public photo maker otherwise.
    if (!offerOpen) {
      setLocation(isAuthenticated ? '/studio/new-card' : '/photo/make');
      return;
    }
    // Signed in already: the invite modal refuses to open (it's a sign-up
    // surface), so "Claim it" went nowhere (Aidan 2026-11-07). The dates
    // live on Moments — that IS the claim for an account.
    if (isAuthenticated) {
      setLocation('/studio/moments');
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

/** Pages where the offer is never shown, even when it is on. The
 *  three-card route (/create, /make): the offer is for a PHOTO card, and
 *  that route's visitors, the Christmas ad's among them, came for a card
 *  it does not cover. And the till (/buy, /order): the card there is
 *  already priced, and tapping the strip walked the buyer out of checkout
 *  with the form lost (launch audit 2026-11-26). */
function offerHiddenOn(path: string): boolean {
  return /^\/(create|make|buy|order)(\/|$)/.test(path);
}

export function TickerBanner() {
  const [tickerPath] = useLocation();
  const claimTap = useClaimFreeCard();
  const onUs = useFirstCardOnUs();
  const noOffer = !onUs || offerHiddenOn(tickerPath);
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
        {/* "Photo card" every time: on the home page or the pricing page
            "your first card" could be either kind, and only one is free.
            Postage is in the same breath on phones too (a free claim shows
            its terms). */}
        <span className="sm:hidden">
          First photo card <b className="text-accent-coral">on us</b>, just {formatMoney(shippingPrice())} postage ›
        </span>
        <span className="hidden sm:inline">
          Tell us 3 dates that matter and your first photo card’s <b className="text-accent-coral">on us</b>. Seriously. Just {formatMoney(shippingPrice())} postage. Claim it ›
        </span>
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
