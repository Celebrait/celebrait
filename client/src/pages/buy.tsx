// client/src/pages/buy.tsx — THE GUEST CHECKOUT (Door 1 + the maker)
//
// A deliberately SLIM checkout for rack and made-for-them cards: date,
// contact, address, pay. No account, no sign-up — the card's ownership
// token (handed out when the card was created, held in sessionStorage)
// proves this browser may buy it; a signed-in owner needs no token.
//
// Rebuilt 2026-09-09 after the checkout audit (Aidan: "Shopify Pro
// level"). The shape is the one every good checkout has settled on:
//   • the order on the right (sticky), the form on the left, one column
//     on phones with the card and total up top and Pay pinned to the
//     bottom of the screen;
//   • Contact → Delivery → Pay, in that order, with browser autofill
//     wired on every field (autocomplete + inputMode);
//   • ONE postage option, and instead of a speed picker the question
//     that actually matters — "when's the big day?" — with a straight
//     answer about whether it'll make it (components/checkout/need-by);
//   • errors inline on the field that needs fixing, never a dead button;
//   • the pre-contract line (personalised goods can't be cancelled once
//     printing starts) and the trust line, both above the fold of Pay.
//
// Deliberately NOT the studio checkout page: that one carries the
// signed-in extras (free-card credit, comp codes, draft state).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'wouter';
import { Loader2, Lock, ShieldCheck, Truck } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { NeedByField, arrivalWindowCopy } from '@/components/checkout/need-by';
import { getShippingTier, DEFAULT_SHIPPING_TIER, cardPriceGBP } from '@shared/pricing';

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
  recipientName: string | null;
}

const UK_POSTCODE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const field = 'h-12 w-full rounded-lg border bg-white px-3.5 text-[15px] text-keeper-ink outline-none transition-colors placeholder:text-keeper-meta/80 focus:border-keeper-gold';
const fieldOk = `${field} border-keeper-hair`;
const fieldBad = `${field} border-accent-red`;
const label = 'mb-1.5 block text-xs font-medium text-keeper-body';
const section = 'rounded-2xl border border-keeper-hair bg-white/80 p-5 backdrop-blur-sm sm:p-6';
const h2 = 'text-[15px] font-semibold text-keeper-ink';

export default function BuyPage() {
  const params = useParams<{ cardId: string }>();
  const cardId = Number(params.cardId);
  const token = typeof window !== 'undefined' ? sessionStorage.getItem(rackTokenKey(cardId)) ?? '' : '';

  const [card, setCard] = useState<ShopCard | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'gone'>('loading');

  const [needBy, setNeedBy] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [shipTo, setShipTo] = useState<'sender' | 'recipient'>('recipient');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Field errors show after the first Pay attempt, then live.
  const [tried, setTried] = useState(false);
  const formTop = useRef<HTMLDivElement>(null);

  const cancelled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cancelled');
  const tier = getShippingTier(DEFAULT_SHIPPING_TIER);

  useEffect(() => {
    if (!Number.isFinite(cardId)) { setState('gone'); return; }
    fetch(`/api/shop/cards/${cardId}${token ? `?token=${encodeURIComponent(token)}` : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        setCard(j.card); setState('ok'); document.title = 'Checkout — Celebrait';
        // The card already knows who it's for — don't make them type it.
        if (j.card?.recipientName) setRecipientName((cur) => cur || j.card.recipientName);
      })
      .catch(() => setState('gone'));
  }, [cardId, token]);

  const totals = useMemo(() => {
    const print = card?.price ?? cardPriceGBP('rack');
    return { print, ship: tier.price, total: print + tier.price };
  }, [card, tier.price]);

  // Postcode → town, on blur (postcodes.io, free, no key). Saves a field
  // on most orders; silent if it can't.
  const lookupPostcode = async () => {
    const pc = postcode.trim();
    if (!UK_POSTCODE.test(pc) || city.trim()) return;
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
      if (!res.ok) return;
      const body = await res.json();
      const town = body?.result?.post_town || body?.result?.admin_district;
      if (town) setCity(String(town).replace(/\b\w+/g, (w: string) => w[0] + w.slice(1).toLowerCase()));
    } catch { /* nice-to-have */ }
  };

  const errors = {
    name: name.trim() ? '' : 'Your name, for the receipt.',
    email: EMAIL.test(email.trim()) ? '' : 'A valid email — the receipt and tracking go here.',
    recipientName: shipTo === 'recipient' && !recipientName.trim() ? 'Whose name goes on the envelope?' : '',
    line1: line1.trim() ? '' : 'The first line of the address.',
    city: city.trim() ? '' : 'Town or city.',
    postcode: UK_POSTCODE.test(postcode.trim()) ? '' : postcode.trim() ? 'That doesn’t look like a UK postcode.' : 'A UK postcode — we post within the UK only.',
  };
  const firstError = Object.values(errors).find(Boolean) ?? '';
  const valid = !firstError;
  const show = (k: keyof typeof errors) => (tried ? errors[k] : '');

  const pay = async () => {
    if (busy) return;
    setTried(true);
    if (!valid) {
      setError('');
      formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/studio/cards/${cardId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: email.trim(),
          customerName: name.trim(),
          cardToken: token || undefined,
          shipTo,
          shippingTier: DEFAULT_SHIPPING_TIER,
          needByDate: needBy || undefined,
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

  const them = recipientName.trim() || card.recipientName || 'them';

  const summary = (
    <div className="rounded-2xl border border-keeper-hair bg-white/80 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex gap-4">
        {card.frontImageUrl && (
          <img src={card.frontImageUrl} alt="Your card" crossOrigin="anonymous" className="h-24 w-24 shrink-0 rounded-lg border border-keeper-hair object-cover sm:h-28 sm:w-28" />
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-keeper-ink">{card.recipientName ? `${card.recipientName}'s card` : 'Your card'}</p>
          <p className="mt-0.5 text-xs text-keeper-meta">280gsm gloss, kraft envelope · free digital link</p>
          <div className="mt-3 space-y-1 text-keeper-body">
            <p className="flex justify-between"><span>Card</span><span>{gbp(totals.print)}</span></p>
            <p className="flex justify-between"><span>Postage · {tier.carrier}</span><span>{gbp(totals.ship)}</span></p>
          </div>
        </div>
      </div>
      <p className="mt-3 flex justify-between border-t border-keeper-hair pt-3 text-base font-semibold text-keeper-ink"><span>Total</span><span>{gbp(totals.total)}</span></p>
      <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-keeper-meta">
        <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span>Printed to order, then posted tracked. Ordered today: arrives <span className="font-medium text-keeper-ink">{arrivalWindowCopy()}</span>.</span>
      </p>
    </div>
  );

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="relative mx-auto max-w-5xl px-4 pb-32 pt-36 sm:px-6 md:pb-20">
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-keeper-ink sm:text-3xl">Checkout</h1>
          <p className="inline-flex items-center gap-1.5 text-xs text-keeper-meta"><Lock className="h-3.5 w-3.5" /> Secure</p>
        </div>
        {cancelled && <p className="mt-3 rounded-lg border border-keeper-hair bg-white/80 px-3 py-2 text-sm text-keeper-body">Payment was cancelled and nothing was charged — your card is still here whenever you're ready.</p>}

        {/* Phones: the order first, so the total is never a surprise. */}
        <div className="mt-6 md:hidden">{summary}</div>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_340px] md:gap-8">
          <div className="space-y-4" ref={formTop}>
            {/* 1 · The date — the question that replaces the speed picker. */}
            <section className={section}>
              <h2 className={h2}>Delivery</h2>
              <div className="mt-3">
                <NeedByField value={needBy} onChange={setNeedBy} recipientName={card.recipientName ?? undefined} />
              </div>
            </section>

            {/* 2 · Contact */}
            <section className={section}>
              <h2 className={h2}>Your details</h2>
              <div className="mt-3 grid gap-3">
                <div>
                  <label htmlFor="buy-name" className={label}>Your name</label>
                  <input id="buy-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={show('name') ? fieldBad : fieldOk} data-testid="buy-name" />
                  {show('name') && <p className="mt-1 text-xs text-accent-red-dark">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="buy-email" className={label}>Email <span className="font-normal text-keeper-meta">— for the receipt and tracking</span></label>
                  <input id="buy-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" autoCapitalize="off" spellCheck={false} className={show('email') ? fieldBad : fieldOk} data-testid="buy-email" />
                  {show('email') && <p className="mt-1 text-xs text-accent-red-dark">{errors.email}</p>}
                </div>
              </div>
            </section>

            {/* 3 · Where it's going */}
            <section className={section}>
              <h2 className={h2}>Where's it going?</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([['recipient', `Straight to ${them}`, 'Addressed to them, tracked'], ['sender', 'To me first', 'To hand over in person']] as const).map(([v, t, s]) => (
                  <button key={v} type="button" onClick={() => setShipTo(v)} aria-pressed={shipTo === v}
                    className={`rounded-xl border-2 px-3 py-3 text-left transition-colors ${shipTo === v ? 'border-brand bg-brand-muted' : 'border-keeper-hair bg-white hover:border-brand/50'}`}>
                    <span className="block text-sm font-medium text-keeper-ink">{t}</span>
                    <span className="block text-xs text-keeper-meta">{s}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 rounded-md bg-keeper-paper px-3 py-2 text-[12px] leading-relaxed text-keeper-meta">We post to UK addresses only for now. Buying from abroad is fine — have it sent straight to them.</p>
              <div className="mt-3 grid gap-3">
                {shipTo === 'recipient' && (
                  <div>
                    <label htmlFor="buy-recipient" className={label}>Their name <span className="font-normal text-keeper-meta">— on the envelope</span></label>
                    <input id="buy-recipient" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} autoComplete="off" className={show('recipientName') ? fieldBad : fieldOk} data-testid="buy-recipient" />
                    {show('recipientName') && <p className="mt-1 text-xs text-accent-red-dark">{errors.recipientName}</p>}
                  </div>
                )}
                <div>
                  <label htmlFor="buy-line1" className={label}>Address</label>
                  <input id="buy-line1" value={line1} onChange={(e) => setLine1(e.target.value)} autoComplete="shipping address-line1" placeholder="House number and street" className={show('line1') ? fieldBad : fieldOk} data-testid="buy-line1" />
                  {show('line1') && <p className="mt-1 text-xs text-accent-red-dark">{errors.line1}</p>}
                </div>
                <input value={line2} onChange={(e) => setLine2(e.target.value)} autoComplete="shipping address-line2" placeholder="Flat, building (optional)" aria-label="Address line 2 (optional)" className={fieldOk} />
                <div className="grid grid-cols-[1fr_140px] gap-3">
                  <div>
                    <label htmlFor="buy-city" className={label}>Town / city</label>
                    <input id="buy-city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="shipping address-level2" className={show('city') ? fieldBad : fieldOk} data-testid="buy-city" />
                    {show('city') && <p className="mt-1 text-xs text-accent-red-dark">{errors.city}</p>}
                  </div>
                  <div>
                    <label htmlFor="buy-postcode" className={label}>Postcode</label>
                    <input id="buy-postcode" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} onBlur={lookupPostcode} autoComplete="shipping postal-code" autoCapitalize="characters" placeholder="SW1A 1AA" className={show('postcode') ? fieldBad : fieldOk} data-testid="buy-postcode" />
                    {show('postcode') && <p className="mt-1 text-xs text-accent-red-dark">{errors.postcode}</p>}
                  </div>
                </div>
              </div>
            </section>

            {error && <p className="rounded-lg border border-accent-red/30 bg-accent-red-light px-3 py-2 text-sm text-accent-red-dark" role="alert">{error}</p>}
            {tried && !valid && !error && <p className="text-sm text-accent-red-dark" role="alert">{firstError}</p>}

            {/* Desktop Pay sits under the form; phones get the pinned bar
                plus the full pre-contract line here, above it. */}
            <div className="hidden md:block">
              <PayBlock busy={busy} total={totals.total} onPay={pay} />
            </div>
            <p className="text-center text-xs leading-relaxed text-keeper-meta md:hidden">
              No account needed. Personalised cards can't be cancelled once printing begins — see our <a href="/terms-of-service" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-keeper-ink">Terms</a>.
            </p>
          </div>

          <aside className="hidden md:block md:sticky md:top-28 md:self-start">
            {summary}
            <p className="mt-3 flex items-start gap-1.5 px-1 text-[11.5px] leading-relaxed text-keeper-meta">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span>Card payments, Apple Pay and Google Pay, handled by Stripe. We never see your card number.</span>
            </p>
          </aside>
        </div>
      </main>

      {/* Phones: Pay pinned to the bottom, total in the button. */}
      <div className="fixed inset-x-0 bottom-0 z-[120] border-t border-keeper-hair bg-white/90 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-md md:hidden">
        <PayBlock busy={busy} total={totals.total} onPay={pay} compact />
      </div>
    </div>
  );
}

function PayBlock({ busy, total, onPay, compact = false }: { busy: boolean; total: number; onPay: () => void; compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
      <button type="button" onClick={onPay} disabled={busy} data-testid="buy-pay"
        className="flex w-full items-center justify-center gap-2 rounded-full bg-go py-3.5 text-base font-semibold text-go-foreground transition-colors hover:bg-go-hover disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {busy ? 'Taking you to payment…' : `Pay ${gbp(total)}`}
      </button>
      {compact ? (
        <p className="text-center text-[11px] text-keeper-meta">
          Secure payment by Stripe · you agree to our <a href="/terms-of-service" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-keeper-ink">Terms</a>
        </p>
      ) : (
        <p className="text-center text-xs leading-relaxed text-keeper-meta">
          Secure payment by Stripe · no account needed.{' '}
          By paying you agree to our <a href="/terms-of-service" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-keeper-ink">Terms</a> — personalised cards can't be cancelled once printing begins.
        </p>
      )}
    </div>
  );
}
