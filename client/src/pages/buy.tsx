// client/src/pages/buy.tsx — THE GUEST CHECKOUT (Door 1)
//
// A deliberately SLIM checkout for rack cards: email, name, address,
// delivery speed, pay. No account, no sign-up — the card's ownership
// token (handed out when the product page created the card, held in
// sessionStorage) proves this browser may buy it.
//
// Deliberately NOT the studio checkout page: that one is built around
// the photo journey (giving moment, free-card credit, draft state) and
// is battle-audited for it. A £4.99 impulse buy wants a postcard-sized
// form, and forking it keeps the studio flow untouched.

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'wouter';
import { Loader2, Lock } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { SHIPPING_TIERS, type ShippingTierId, cardPriceGBP, PRODUCTION_NOTICE } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export const rackTokenKey = (cardId: number | string) => `celebrait_rack_token_${cardId}`;

interface ShopCard {
  id: number;
  source: string;
  status: string | null;
  frontImageUrl: string | null;
  insideImageUrl: string | null;
  price: number;
  insideMode: 'ours' | 'own' | 'blank' | null;
}

export default function BuyPage() {
  const params = useParams<{ cardId: string }>();
  const cardId = Number(params.cardId);
  const token = typeof window !== 'undefined' ? sessionStorage.getItem(rackTokenKey(cardId)) ?? '' : '';

  const [card, setCard] = useState<ShopCard | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'gone'>('loading');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [shipTo, setShipTo] = useState<'sender' | 'recipient'>('recipient');
  const [tier, setTier] = useState<ShippingTierId>('standard');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cancelled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cancelled');

  useEffect(() => {
    if (!Number.isFinite(cardId) || !token) { setState('gone'); return; }
    fetch(`/api/shop/cards/${cardId}?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { setCard(j.card); setState('ok'); document.title = 'Checkout — Celebrait'; })
      .catch(() => setState('gone'));
  }, [cardId, token]);

  const totals = useMemo(() => {
    const print = card?.price ?? cardPriceGBP('rack');
    const ship = SHIPPING_TIERS.find((t) => t.id === tier)?.price ?? 0;
    return { print, ship, total: print + ship };
  }, [card, tier]);

  const canPay = email.includes('@') && name.trim() && line1.trim() && city.trim() && postcode.trim()
    && (shipTo === 'sender' || recipientName.trim());

  const pay = async () => {
    if (busy || !canPay) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/studio/cards/${cardId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: email.trim(),
          customerName: name.trim(),
          cardToken: token,
          shipTo,
          shippingTier: tier,
          shippingAddress: {
            name: shipTo === 'recipient' ? recipientName.trim() : name.trim(),
            line1: line1.trim(), line2: line2.trim() || undefined,
            city: city.trim(), postcode: postcode.trim().toUpperCase(), country: 'GB',
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? 'That didn’t work — try again');
      if (j?.payment?.mode === 'redirect' && j.payment.redirectUrl) {
        window.location.href = j.payment.redirectUrl;
        return;
      }
      // Stub/zero-total paths land straight on the order page.
      if (j?.orderId) { window.location.href = `/order/${j.orderId}`; return; }
      throw new Error('Unexpected response — try again');
    } catch (e: any) {
      setError(e?.message ?? 'That didn’t work — try again');
      setBusy(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="keeper-serif relative min-h-screen">
        <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
        <KeeperHeader />
        <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-keeper-stone" /></div>
      </div>
    );
  }
  if (state === 'gone' || !card) {
    return (
      <div className="keeper-serif relative min-h-screen">
        <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
        <KeeperHeader />
        <div className="mx-auto max-w-lg px-6 pb-24 pt-40 text-center">
          <h1 className="font-display text-2xl font-bold text-keeper-ink">We couldn't find that card</h1>
          <p className="mt-3 text-sm text-keeper-meta">The link may have expired with your session — pick the card again and it'll be waiting.</p>
          <Link href="/cards/birthday" className="mt-6 inline-block rounded-full bg-keeper-ink px-6 py-3 font-semibold text-keeper-paper">Back to the cards</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="relative mx-auto max-w-4xl px-4 pb-20 pt-36 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-keeper-ink">Nearly there</h1>
        {cancelled && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Payment was cancelled — your card is still here whenever you're ready.</p>}

        <div className="mt-8 grid gap-10 md:grid-cols-[0.8fr_1fr]">
          <div>
            {card.frontImageUrl && (
              <img src={card.frontImageUrl} alt="Your card" crossOrigin="anonymous" className="aspect-square w-full rounded-xl border border-keeper-hair object-cover shadow-sm" />
            )}
            <div className="mt-4 space-y-1.5 text-sm text-keeper-body">
              <p className="flex justify-between"><span>Card</span><span>{gbp(totals.print)}</span></p>
              <p className="flex justify-between"><span>Postage ({SHIPPING_TIERS.find((t) => t.id === tier)?.name})</span><span>{gbp(totals.ship)}</span></p>
              <p className="flex justify-between border-t border-keeper-hair pt-1.5 font-semibold text-keeper-ink"><span>Total</span><span>{gbp(totals.total)}</span></p>
            </div>
            <p className="mt-3 text-xs text-keeper-meta">{PRODUCTION_NOTICE}</p>
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-keeper-ink">Where's it going?</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setShipTo('recipient')}
                  className={`rounded-full border px-4 py-2 text-sm ${shipTo === 'recipient' ? 'border-keeper-gold bg-keeper-gold-wash text-keeper-gold' : 'border-keeper-hair bg-white/70 text-keeper-body'}`}>Straight to them</button>
                <button type="button" onClick={() => setShipTo('sender')}
                  className={`rounded-full border px-4 py-2 text-sm ${shipTo === 'sender' ? 'border-keeper-gold bg-keeper-gold-wash text-keeper-gold' : 'border-keeper-hair bg-white/70 text-keeper-body'}`}>To me, to hand over</button>
              </div>
            </div>

            {shipTo === 'recipient' && (
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Their name (for the envelope)"
                className="w-full rounded-lg border border-keeper-hair bg-white px-3 py-2.5 text-sm outline-none focus:border-keeper-gold" />
            )}
            <div className="grid gap-2.5">
              <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Address line 1"
                className="w-full rounded-lg border border-keeper-hair bg-white px-3 py-2.5 text-sm outline-none focus:border-keeper-gold" />
              <input value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Address line 2 (optional)"
                className="w-full rounded-lg border border-keeper-hair bg-white px-3 py-2.5 text-sm outline-none focus:border-keeper-gold" />
              <div className="grid grid-cols-2 gap-2.5">
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Town / city"
                  className="w-full rounded-lg border border-keeper-hair bg-white px-3 py-2.5 text-sm outline-none focus:border-keeper-gold" />
                <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode"
                  className="w-full rounded-lg border border-keeper-hair bg-white px-3 py-2.5 text-sm outline-none focus:border-keeper-gold" />
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-keeper-ink">Delivery speed</p>
              <div className="mt-2 space-y-2">
                {SHIPPING_TIERS.map((t) => (
                  <button key={t.id} type="button" onClick={() => setTier(t.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm ${tier === t.id ? 'border-keeper-gold bg-keeper-gold-wash/60' : 'border-keeper-hair bg-white/70'}`}>
                    <span><span className="font-medium text-keeper-ink">{t.name}</span>
                      <span className="ml-2 text-xs text-keeper-meta">{t.carrier} · {t.shippingEstimate} after printing</span></span>
                    <span className="font-semibold text-keeper-ink">{gbp(t.price)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2.5">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                className="w-full rounded-lg border border-keeper-hair bg-white px-3 py-2.5 text-sm outline-none focus:border-keeper-gold" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Your email — for the receipt and tracking"
                className="w-full rounded-lg border border-keeper-hair bg-white px-3 py-2.5 text-sm outline-none focus:border-keeper-gold" />
            </div>

            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button type="button" onClick={() => void pay()} disabled={!canPay || busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-keeper-ink py-4 text-base font-semibold text-keeper-paper transition-colors hover:bg-black disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {busy ? 'Taking you to payment…' : `Pay ${gbp(totals.total)}`}
            </button>
            <p className="text-center text-xs text-keeper-meta">Secure payment by Stripe · no account needed</p>
          </div>
        </div>
      </main>
    </div>
  );
}
