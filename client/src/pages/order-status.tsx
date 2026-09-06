// client/src/pages/order-status.tsx — THE GUEST ORDER PAGE
//
// /order/:orderId — where a guest's confirmation email points, and
// where Stripe returns them after paying (guests can't reach the
// signed-in /checkout/success). The order id is a v4 uuid, so the URL
// is its own token: unguessable, shareable only by the buyer.
//
// Polls while payment is pending (the API reconciles against Stripe on
// each read, so the webhook race resolves here), then settles into the
// fulfilment story: printing → posted → delivered.

import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'wouter';
import { Loader2, CheckCircle2, Truck, Printer, Clock } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

interface ShopOrder {
  id: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  customerEmail: string | null;
  shippingTier: string;
  totalAmount: number;
  printAmount: number;
  shippingAmount: number;
  createdAt: string;
  trackingUrl: string | null;
  trackingNumber: string | null;
}
interface ShopOrderItem { cardId: number; unitPrice: number; position: number; imageUrl: string | null }

const FULFILMENT_STEPS = [
  { key: 'pending', label: 'Order received', icon: Clock },
  { key: 'submitted', label: 'Being printed', icon: Printer },
  { key: 'shipped', label: 'In the post', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
] as const;

function stepIndex(status: string): number {
  if (status === 'delivered') return 3;
  if (status === 'shipped') return 2;
  if (status === 'submitted' || status === 'printed') return 1;
  return 0;
}

export default function OrderStatusPage() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [items, setItems] = useState<ShopOrderItem[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'gone'>('loading');
  const polls = useRef(0);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/shop/orders/${params.orderId}`);
        if (!r.ok) { if (!stop) setState('gone'); return; }
        const j = await r.json();
        if (stop) return;
        setOrder(j.order); setItems(j.items ?? []); setState('ok');
        document.title = 'Your order — Celebrait';
        // Poll while payment settles (max ~1 min) — the API reconciles
        // with Stripe on each read, so this closes the webhook race.
        if (j.order.paymentStatus !== 'paid' && polls.current < 12) {
          polls.current += 1;
          setTimeout(load, 5000);
        }
      } catch {
        if (!stop) setState('gone');
      }
    };
    void load();
    return () => { stop = true; };
  }, [params.orderId]);

  if (state === 'loading') {
    return (
      <div className="keeper-serif relative min-h-screen">
        <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
        <KeeperHeader />
        <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-keeper-stone" /></div>
      </div>
    );
  }
  if (state === 'gone' || !order) {
    return (
      <div className="keeper-serif relative min-h-screen">
        <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
        <KeeperHeader />
        <div className="mx-auto max-w-lg px-6 pb-24 pt-40 text-center">
          <h1 className="font-display text-2xl font-bold text-keeper-ink">We couldn't find that order</h1>
          <p className="mt-3 text-sm text-keeper-meta">Check the link in your confirmation email — it has the full order reference.</p>
        </div>
      </div>
    );
  }

  const paid = order.paymentStatus === 'paid';
  const idx = stepIndex(order.fulfillmentStatus);

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="relative mx-auto max-w-2xl px-4 pb-20 pt-36 sm:px-6">
        {paid ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-keeper-gold">Order confirmed</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-keeper-ink">It's on its way to the printer.</h1>
            <p className="mt-3 text-sm text-keeper-body">
              A receipt has gone to {order.customerEmail ?? 'your email'}. Every card is printed to
              order — allow up to 72 hours for production, then your chosen delivery on top.
            </p>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-keeper-meta">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Confirming payment
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-keeper-ink">One moment…</h1>
            <p className="mt-3 text-sm text-keeper-body">We're confirming your payment with the bank — this usually takes a few seconds.</p>
          </>
        )}

        {/* The fulfilment story */}
        <div className="mt-10 space-y-0">
          {FULFILMENT_STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = paid && i <= idx;
            return (
              <div key={s.key} className="flex items-start gap-3 pb-6 last:pb-0">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${done ? 'border-keeper-gold bg-keeper-gold-wash text-keeper-gold' : 'border-keeper-hair bg-white/70 text-keeper-meta'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className={`text-sm font-medium ${done ? 'text-keeper-ink' : 'text-keeper-meta'}`}>{s.label}</p>
                  {s.key === 'shipped' && order.trackingUrl && (
                    <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="text-xs text-keeper-gold hover:underline">
                      Track it{order.trackingNumber ? ` — ${order.trackingNumber}` : ''}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* The cards + money */}
        <div className="mt-8 rounded-2xl border border-keeper-hair bg-white/70 p-4 backdrop-blur-sm">
          <div className="flex gap-3">
            {items.map((i) => i.imageUrl ? (
              <img key={i.cardId} src={i.imageUrl} alt="Your card" crossOrigin="anonymous" className="h-24 w-24 rounded-lg border border-keeper-hair object-cover" />
            ) : null)}
          </div>
          <div className="mt-4 space-y-1 text-sm text-keeper-body">
            <p className="flex justify-between"><span>{items.length} card{items.length === 1 ? '' : 's'}</span><span>{gbp(order.printAmount)}</span></p>
            <p className="flex justify-between"><span>Postage</span><span>{gbp(order.shippingAmount)}</span></p>
            <p className="flex justify-between border-t border-keeper-hair pt-1.5 font-semibold text-keeper-ink"><span>Total</span><span>{gbp(order.totalAmount)}</span></p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-keeper-meta">
          Keep this page's link — it's your order reference ({order.id.slice(0, 8)}).
        </p>
        <p className="mt-6 text-center">
          <Link href="/cards/birthday" className="text-sm font-medium text-keeper-gold hover:underline">Send another one? Browse the cards →</Link>
        </p>
      </main>
    </div>
  );
}
