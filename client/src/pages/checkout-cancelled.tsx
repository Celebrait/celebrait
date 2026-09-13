// Post-Stripe-cancel landing (audit 2026-07-27): this used to be a bare
// <Redirect to="/studio" /> — the abandoning payer hit the dashboard with
// no explanation and an unexplained red "Awaiting payment" chip on their
// order. Instead: say what happened, reassure the card is safe, and offer
// the two honest next moves. Stripe's cancel_url carries ?cardId= so
// "Finish sending it" can land straight back on the checkout.
import { Link } from 'wouter';
import CheckoutLayout from '@/layouts/checkout-layout';
import { Undo2 } from 'lucide-react';

export default function CheckoutCancelledPage() {
  const cardId = new URLSearchParams(window.location.search).get('cardId');
  return (
    <CheckoutLayout backHref={cardId ? `/checkout/${cardId}` : '/studio'}>
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-brand-muted text-brand-dark flex items-center justify-center mx-auto mb-4">
          <Undo2 className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-semibold text-keeper-ink mb-2">
          Payment cancelled
        </h1>
        <p className="text-sm text-keeper-body mb-8">
          No charge was made. Your card is saved and ready whenever you are.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {cardId && (
            <Link
              href={`/checkout/${cardId}`}
              className="inline-flex items-center justify-center rounded-full bg-go hover:bg-go-hover text-white px-5 py-2.5 text-sm font-semibold transition-colors"
              data-testid="cancelled-retry-checkout"
            >
              Finish sending it →
            </Link>
          )}
          <Link
            href="/studio"
            className="inline-flex items-center justify-center rounded-full border border-keeper-hair bg-white hover:bg-stone-50 text-keeper-ink px-5 py-2.5 text-sm font-semibold transition-colors"
            data-testid="cancelled-back-studio"
          >
            Back to Studio
          </Link>
        </div>
      </div>
    </CheckoutLayout>
  );
}
