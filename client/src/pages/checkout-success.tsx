// client/src/pages/checkout-success.tsx
//
// Landing page after a successful payment. Polls the order until
// paymentStatus flips to 'paid' (or gives up after ~20s → a calm "check
// Orders" state), then shows a summary + the digital share link.

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Copy, Loader2, Package, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import CheckoutLayout from '@/layouts/checkout-layout';

interface OrderResponse {
  order: {
    id: string;
    cardId: number;
    includesPrint: boolean;
    includesDigital: boolean;
    paymentStatus: string;
    fulfillmentStatus: string;
    totalAmount: number;
    currency: string;
  };
  shareUrl: string | null;
}

function formatGBP(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

export default function CheckoutSuccessPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qs = new URLSearchParams(window.location.search);
  const orderId = qs.get('orderId') ?? '';

  const timedOutRef = useRef(false);
  const [timedOut, setTimedOut] = useState(false);

  const { data, isLoading } = useQuery<OrderResponse>({
    queryKey: [`/api/studio/orders/${orderId}`],
    enabled: orderId.length > 0,
    refetchInterval: (q) => {
      const order = (q.state.data as OrderResponse | undefined)?.order;
      if (order?.paymentStatus === 'paid') return false;
      // Give up after ~20s — don't poll forever on an order that never
      // confirms (the header used to claim this but never did; audit
      // 2026-07-02).
      if (timedOutRef.current) return false;
      return 1500;
    },
  });

  const paid = data?.order.paymentStatus === 'paid';

  // Stop confirming after 20s if payment hasn't landed — surface a calm
  // "check Orders" state instead of a forever spinner.
  useEffect(() => {
    if (paid) return;
    const t = setTimeout(() => {
      timedOutRef.current = true;
      setTimedOut(true);
    }, 20000);
    return () => clearTimeout(t);
  }, [paid]);
  const fullShareUrl = data?.shareUrl
    ? `${window.location.origin}${data.shareUrl}`
    : null;

  const copyLink = async () => {
    if (!fullShareUrl) return;
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: "Couldn't copy", variant: 'destructive' });
    }
  };

  if (!orderId) {
    return (
      <CheckoutLayout backHref="/studio" backLabel="Back to Studio">
        <Centered>No order to show.</Centered>
      </CheckoutLayout>
    );
  }

  if (!paid && !timedOut) {
    return (
      <CheckoutLayout backHref="/studio" backLabel="Back to Studio">
        <Centered>
          <Loader2 className="w-6 h-6 animate-spin text-brand mb-3" />
          <p className="text-sm text-keeper-body">Confirming your order…</p>
        </Centered>
      </CheckoutLayout>
    );
  }

  if (!paid && timedOut) {
    return (
      <CheckoutLayout backHref="/studio" backLabel="Back to Studio">
        <Centered>
          <p className="text-sm font-medium text-keeper-ink mb-2">
            This is taking longer than usual
          </p>
          <p className="text-xs text-keeper-meta mb-6 max-w-xs leading-relaxed">
            Your payment may still be going through — we'll email your receipt
            as soon as it confirms. You can also find it under Orders.
          </p>
          <Button onClick={() => setLocation('/studio/orders')}>
            Go to Orders
          </Button>
        </Centered>
      </CheckoutLayout>
    );
  }

  // Paid — data is present (paid is derived from it). Belt-and-braces
  // guard so the success render can read data without optional chaining.
  if (!data) return null;

  return (
    <CheckoutLayout backHref="/studio" backLabel="Back to Studio">
      <div className="max-w-md mx-auto pt-6 sm:pt-12">
        <div className="bg-white rounded-2xl border border-keeper-hair p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-cta-light text-cta shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-bold tracking-[-0.01em] text-keeper-ink">
                Thanks — we've got it
              </h1>
              <p className="text-sm text-keeper-body mt-1">
                {formatGBP(data.order.totalAmount)} paid. You'll get a confirmation by email.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-keeper-hair">
            {data.order.includesPrint && (
              <div className="flex items-center gap-2 text-sm text-keeper-body">
                <Package className="w-4 h-4 text-keeper-meta" />
                <span>Printed card is on its way to print.</span>
              </div>
            )}
            {data.order.includesDigital && (
              <div className="flex items-center gap-2 text-sm text-keeper-body">
                <Sparkles className="w-4 h-4 text-brand" />
                <span>Digital share link ready.</span>
              </div>
            )}
          </div>

          {fullShareUrl && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.15em] text-keeper-meta">
                Share link
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-xs font-mono bg-stone-50 border border-keeper-hair rounded-lg px-3 py-2 truncate">
                  {fullShareUrl}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyLink}
                  data-testid="checkout-success-copy"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setLocation('/studio')}
            >
              Back to Studio
            </Button>
            {data.shareUrl && (
              <Button
                className="flex-1 bg-go hover:bg-go-hover text-brand-foreground"
                onClick={() => setLocation(data.shareUrl!)}
              >
                Open the card
              </Button>
            )}
          </div>
        </div>
      </div>
    </CheckoutLayout>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      {children}
    </div>
  );
}
