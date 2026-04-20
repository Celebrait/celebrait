// client/src/pages/checkout-dev-confirm.tsx
//
// Stubs the payment gateway's hosted page. The stub PaymentProvider
// redirects here with ?ref=...&return=... so we can exercise the full
// flow end-to-end until a real gateway is wired. Dies as soon as the
// real provider lands.

import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CheckoutDevConfirmPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const qs = new URLSearchParams(window.location.search);
  const ref = qs.get('ref') ?? '';
  const returnUrl = qs.get('return') ?? '/studio';

  // The stub reference format is `stub_<orderId8>_<timestamp>`. We
  // don't parse the orderId out of it — the server resolves by
  // paymentReference → orderId internally. But we need the orderId
  // for /dev-confirm, so the server endpoint keys off the order row.
  // To call /api/studio/orders/:orderId/dev-confirm we'd need the
  // orderId; simpler to pass orderId through the returnUrl (which
  // already has ?orderId=...).
  const returnParsed = (() => {
    try {
      return new URL(returnUrl, window.location.origin);
    } catch {
      return null;
    }
  })();
  const orderId = returnParsed?.searchParams.get('orderId') ?? '';

  const handleConfirm = async (outcome: 'pay' | 'cancel') => {
    setLoading(true);
    try {
      if (outcome === 'pay' && orderId) {
        await apiRequest('POST', `/api/studio/orders/${orderId}/dev-confirm`);
      }
      setLocation(outcome === 'pay' ? returnUrl : '/studio');
    } catch (err: any) {
      toast({
        title: "Couldn't confirm",
        description: err?.message ?? 'Something went wrong.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f1] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl border border-stone-200 p-6 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">
            Dev stub — no real payment
          </p>
          <h1 className="text-xl font-semibold text-ink">Confirm payment</h1>
          <p className="text-sm text-stone-600 mt-1">
            Swap this page for the real gateway once a provider is chosen.
          </p>
        </div>

        <div className="text-xs font-mono bg-stone-50 border border-stone-200 rounded p-3 break-all">
          {ref || '(no reference)'}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleConfirm('cancel')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => handleConfirm('pay')}
            disabled={loading || !orderId}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark as paid'}
          </Button>
        </div>
      </div>
    </div>
  );
}
