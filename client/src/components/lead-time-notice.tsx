// client/src/components/lead-time-notice.tsx — the lead-time notice
//
// One component, one sentence, everywhere a customer is about to invest
// time or money (Aidan 2026-09-09: "needs to be more prominent — Our
// cards are one-off prints. Please allow at least a week from order to
// arrival."). A violet-tinted strip, not meta text: it has to be read
// before twenty minutes of crafting, not discovered at checkout.

//
// CHRISTMAS (2026-11-18): pass the card's occasion. In the season a
// Christmas card's strip says the last order date instead (or that
// Christmas orders have closed), from shared/christmas.ts.

import { Truck, Gift } from 'lucide-react';
import { Link } from 'wouter';
import { HONEST_LEAD_LINE } from '@shared/pricing';
import { christmasOrderLine } from '@shared/christmas';

export function LeadTimeNotice({ className = '', link = true, occasion }: { className?: string; link?: boolean; occasion?: string }) {
  const xmasLine = occasion === 'christmas' ? christmasOrderLine() : '';
  if (xmasLine) {
    return (
      <div
        className={`flex items-start gap-2.5 rounded-xl border border-brand-light bg-brand-muted px-3.5 py-2.5 text-[13px] leading-snug text-keeper-ink sm:items-center ${className}`}
        role="note"
        data-testid="christmas-order-notice"
      >
        <Gift className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark sm:mt-0" strokeWidth={1.75} />
        <span>
          <span className="font-semibold">{xmasLine}</span>{' '}
          <span className="text-keeper-body">Printed to order, then posted Royal Mail 24.</span>
        </span>
      </div>
    );
  }
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border border-brand-light bg-brand-muted px-3.5 py-2.5 text-[13px] leading-snug text-keeper-ink sm:items-center ${className}`}
      role="note"
      data-testid="lead-time-notice"
    >
      <Truck className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark sm:mt-0" strokeWidth={1.75} />
      <span>
        <span className="font-semibold">{HONEST_LEAD_LINE}</span>
        {link && (
          <>
            {' '}
            <Link href="/pricing" className="whitespace-nowrap text-brand-dark underline underline-offset-2 hover:text-brand">How delivery works</Link>
          </>
        )}
      </span>
    </div>
  );
}
