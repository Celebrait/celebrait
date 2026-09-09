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
import { Link, useLocation } from 'wouter';

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
  return () => {
    // The invite modal mounts on the PHOTO landing page — /photo since
    // the gate took / (2026-09-03).
    if (location === '/photo' || location === '/keeper') {
      window.dispatchEvent(
        new CustomEvent(CLAIM_EVENT, { detail: { intent: 'asked' } }),
      );
    } else {
      setLocation(`/photo?${CLAIM_PARAM}=1`);
    }
  };
}

const HOLD_MS = 8000;

export function TickerBanner() {
  const claimTap = useClaimFreeCard();
  // 0 = the offer, 1 = the honest lead line.
  const [slot, setSlot] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSlot((s) => (s + 1) % 2), HOLD_MS);
    return () => window.clearInterval(t);
  }, []);

  const msg = 'flex items-center gap-2 whitespace-nowrap font-sans text-[11.5px] font-medium text-white underline-offset-2 hover:underline sm:text-[12.5px] transition-opacity duration-500 motion-reduce:transition-none';

  return (
    <div
      className="pointer-events-auto relative flex h-10 items-center justify-center px-4"
      style={{ background: 'linear-gradient(90deg, #211D19 0%, #5c57d4 100%)' }}
      data-testid="ticker-banner"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={claimTap}
        aria-hidden={slot !== 0}
        tabIndex={slot === 0 ? 0 : -1}
        className={`${msg} ${slot === 0 ? 'opacity-100' : 'pointer-events-none absolute opacity-0'}`}
        data-testid="ticker-free-card"
      >
        {/* Coral trial (Aidan 2026-09-04): the warm accent on the OFFER only. */}
        <Gift className="h-3.5 w-3.5 shrink-0 text-accent-coral" aria-hidden="true" />
        <span className="sm:hidden">
          Add 3 dates that matter — <b className="text-accent-coral">50% off</b> your first card. Claim it ›
        </span>
        <span className="hidden sm:inline">
          Tell us 3 dates that matter and your first card is{' '}
          <span className="line-through opacity-70">£5.99</span> <b className="text-accent-coral">£2.99</b>.
          Claim it ›
        </span>
      </button>

      <Link
        href="/pricing"
        aria-hidden={slot !== 1}
        tabIndex={slot === 1 ? 0 : -1}
        className={`${msg} ${slot === 1 ? 'opacity-100' : 'pointer-events-none absolute opacity-0'}`}
        data-testid="ticker-honest-lead"
      >
        <Truck className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden="true" />
        <span className="sm:hidden">
          Printed to order by a partner printer — <b>allow a week</b> for the post ›
        </span>
        <span className="hidden sm:inline">
          Honest bit: right now our cards are printed by a partner printer, so <b>allow at least a week</b> for the post ›
        </span>
      </Link>
    </div>
  );
}
