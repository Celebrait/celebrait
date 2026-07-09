// client/src/pages/checkout-dev-confirm.tsx
//
// Stubs the payment gateway's hosted page. The stub PaymentProvider
// redirects here with ?ref=...&return=... so we can exercise the full
// flow end-to-end until a real gateway is wired. Dies the day a real
// provider lands.

import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CheckoutLayout from '@/layouts/checkout-layout';

export default function CheckoutDevConfirmPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const qs = new URLSearchParams(window.location.search);
  const ref = qs.get('ref') ?? '';
  const returnUrl = qs.get('return') ?? '/studio';

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
    <CheckoutLayout backHref="/studio" backLabel="Cancel">
      <div className="max-w-md mx-auto pt-6 sm:pt-12">
        <div className="bg-white rounded-2xl border border-keeper-hair p-6 sm:p-8 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">
              Dev stub — no real payment
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-ink">Confirm payment</h1>
            <p className="text-sm text-stone-600 mt-1">
              Swap this page for the real gateway once a provider is chosen.
            </p>
          </div>

          <div className="text-xs font-mono bg-stone-50 border border-keeper-hair rounded-lg p-3 break-all">
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
              className="flex-1 bg-brand hover:bg-brand-dark text-brand-foreground"
              onClick={() => handleConfirm('pay')}
              disabled={loading || !orderId}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark as paid'}
            </Button>
          </div>
        </div>
      </div>
    </CheckoutLayout>
  );
}
