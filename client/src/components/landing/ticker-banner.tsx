// client/src/components/landing/ticker-banner.tsx
//
// The top banner — a STATIC single message (Aidan 2026-08-03: "Remove
// the £8.99 plus delivery one, lead with the offer, so static"). One
// line, one job: the free-first-card offer, tappable into the claim
// flow. The production promise lives on in the studio banner, checkout
// and pricing page.
//
// NB "limited time" was dropped 2026-08-06. The offer has no end date
// and we don't intend to set one, and the ASA regularly upholds against
// urgency claims on offers that just run and run. "Your first card is
// on us" is true indefinitely and needs no defending.
//
// (Name kept from the brief marquee era so call sites didn't churn.)

import { Gift } from 'lucide-react';
import { useLocation } from 'wouter';

/** Fired when the offer is tapped. The landing page's FreeCardInvite
 *  listens and opens the claim modal. */
export const CLAIM_EVENT = 'celebrait:claim-free-card';

export function TickerBanner() {
  const [location, setLocation] = useLocation();

  const claimTap = () => {
    if (location === '/') {
      window.dispatchEvent(
        new CustomEvent(CLAIM_EVENT, { detail: { intent: 'asked' } }),
      );
    } else {
      // Other pages don't mount the invite — head home, where the
      // pill/modal carries on.
      setLocation('/');
    }
  };

  return (
    <div
      className="pointer-events-auto flex h-10 items-center justify-center px-4"
      style={{ background: 'linear-gradient(90deg, #211D19 0%, #5c57d4 100%)' }}
      data-testid="ticker-banner"
    >
      <button
        type="button"
        onClick={claimTap}
        className="flex items-center gap-2 whitespace-nowrap font-sans text-[11.5px] font-medium text-white underline-offset-2 hover:underline sm:text-[12.5px]"
        data-testid="ticker-free-card"
      >
        <Gift className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="sm:hidden">
          Your first card is on us — just pay postage. Claim it ›
        </span>
        <span className="hidden sm:inline">
          Your first card is on us.{' '}
          <span className="line-through opacity-70">£8.99</span> <b>£0</b>,
          just the postage. Claim it ›
        </span>
      </button>
    </div>
  );
}
