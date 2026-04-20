// client/src/pages/checkout-success.tsx
//
// Landing page after a successful payment. Polls the order until
// paymentStatus flips to 'paid' (or gives up after ~10s), then shows
// a summary + the digital share link (if the order included digital).

import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Copy, Loader2, Package, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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

  const { data, isLoading } = useQuery<OrderResponse>({
    queryKey: [`/api/studio/orders/${orderId}`],
    enabled: orderId.length > 0,
    refetchInterval: (q) => {
      const order = (q.state.data as OrderResponse | undefined)?.order;
      return order?.paymentStatus === 'paid' ? false : 1500;
    },
  });

  const paid = data?.order.paymentStatus === 'paid';
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
    return <Centered>No order to show.</Centered>;
  }

  if (isLoading || !paid) {
    return (
      <Centered>
        <Loader2 className="w-6 h-6 animate-spin text-brand mb-3" />
        <p className="text-sm text-stone-600">Confirming your order…</p>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7f1] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl border border-stone-200 p-6 space-y-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-brand shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-semibold text-ink">Thanks — we've got it</h1>
            <p className="text-sm text-stone-600 mt-1">
              {formatGBP(data.order.totalAmount)} paid. You'll get a confirmation by email.
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-stone-200">
          {data.order.includesPrint && (
            <div className="flex items-center gap-2 text-sm text-stone-700">
              <Package className="w-4 h-4 text-stone-400" />
              <span>Printed card is on its way to print.</span>
            </div>
          )}
          {data.order.includesDigital && (
            <div className="flex items-center gap-2 text-sm text-stone-700">
              <Sparkles className="w-4 h-4 text-brand" />
              <span>Digital share link ready.</span>
            </div>
          )}
        </div>

        {fullShareUrl && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.15em] text-stone-500">
              Share link
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-xs font-mono bg-stone-50 border border-stone-200 rounded px-3 py-2 truncate">
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
              className="flex-1"
              onClick={() => setLocation(data.shareUrl!)}
            >
              Open the card
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf7f1] flex flex-col items-center justify-center text-center p-6">
      {children}
    </div>
  );
}
