// client/src/components/landing/ticker-banner.tsx
//
// The rolling top banner — news-ticker style (Kevin 2026-08-03),
// replacing the static production-promise line. Two messages drift
// through on the ink→violet gradient:
//
//   1. The free-first-card offer, now marketed site-wide ("limited
//      time" — Kevin's call; the offer is genuinely withdrawable).
//      Tapping it opens the claim invite (landing) or heads home.
//   2. The honest production promise, verbatim: printed to order,
//      up to 72 hrs, £8.99 + delivery.
//
// Mechanics: the row renders twice inside a w-max flex track animated
// translateX(0 → -50%), so the loop is seamless at any viewport width.
// Hover pauses it; prefers-reduced-motion stops it entirely (the two
// messages then sit static, first one visible). Keyframes live in
// index.css (`ticker-scroll`).

import { Gift, Send } from 'lucide-react';
import { useLocation } from 'wouter';

/** Fired when the free-card ticker item is tapped. The landing page's
 *  FreeCardInvite listens and opens the claim modal. */
export const CLAIM_EVENT = 'celebrait:claim-free-card';

export function TickerBanner() {
  const [location, setLocation] = useLocation();

  const claimTap = () => {
    if (location === '/') {
      window.dispatchEvent(new CustomEvent(CLAIM_EVENT));
    } else {
      // Other pages don't mount the invite — head home, where the
      // pill/modal carries on.
      setLocation('/');
    }
  };

  // One pass of the ticker content. Rendered twice for the seamless
  // loop; the duplicate is aria-hidden so screen readers hear it once.
  const Row = ({ hidden }: { hidden?: boolean }) => (
    <div
      className="flex shrink-0 items-center gap-10 pr-10"
      aria-hidden={hidden || undefined}
    >
      <button
        type="button"
        onClick={claimTap}
        className="flex items-center gap-2 whitespace-nowrap font-sans text-[11.5px] font-medium text-white hover:underline underline-offset-2 sm:text-[12.5px]"
        data-testid="ticker-free-card"
        tabIndex={hidden ? -1 : 0}
      >
        <Gift className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Limited time — your first card is on us.{' '}
          <span className="line-through opacity-70">£8.99</span>{' '}
          <b>£0</b>, just the postage. Claim it ›
        </span>
      </button>
      <span aria-hidden="true" className="text-white/50">
        ✦
      </span>
      <span className="flex items-center gap-2 whitespace-nowrap font-sans text-[11.5px] font-medium text-white sm:text-[12.5px]">
        Every card is printed to order, just for them — allow up to 72 hrs,
        then posted. £8.99 + delivery.
        <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </span>
      <span aria-hidden="true" className="text-white/50">
        ✦
      </span>
    </div>
  );

  return (
    <div
      className="ticker-wrap pointer-events-auto h-10 overflow-hidden"
      style={{ background: 'linear-gradient(90deg, #211D19 0%, #5c57d4 100%)' }}
      data-testid="ticker-banner"
    >
      <div className="animate-ticker flex h-10 w-max items-center">
        <Row />
        <Row hidden />
      </div>
    </div>
  );
}
