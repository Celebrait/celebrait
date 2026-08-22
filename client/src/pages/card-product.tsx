// client/src/pages/card-product.tsx
//
// THE PRODUCT PAGE — /card/:id (Aidan: "Clicking one should bring up a
// product page. Shopify pro quality. These can be purchased without
// going into the studio, only the builder needs a sign up.")
//
// Same landing chrome as the occasion pages. Left: the card, large and
// ajar. Right: the buy panel — price, the personalisation fields
// (editable cards may replace the front words; every card takes an
// inside message), delivery promise, and the buy CTA.
//
// ⚠️ COMMERCE BOUNDARY: the guest-checkout endpoint (template → order →
// Stripe, no account) is the NEXT slice. The CTA is real UI wired to a
// clearly-labelled placeholder so the page can be judged whole; it
// never pretends an order happened.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { Loader2, Check, Truck, PenLine } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';

interface ProductCard {
  id: number; occasion: string; front_text: string; inside_text?: string | null;
  tone?: string | null; age?: number | null; recipient?: string | null;
  editable?: boolean; imageUrl: string;
}

export default function CardProductPage() {
  const params = useParams<{ id: string }>();
  const [card, setCard] = useState<ProductCard | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [ownWords, setOwnWords] = useState('');
  const [insideMsg, setInsideMsg] = useState('');
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    fetch(`/api/catalogue/card/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { setCard(j.card); setState('ok'); document.title = `“${j.card.front_text.slice(0, 48)}” — £8.99 | Celebrait`; })
      .catch(() => setState('missing'));
  }, [params.id]);

  if (state === 'loading') {
    return (
      <div className="keeper-serif relative min-h-screen">
        <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
        <KeeperHeader />
        <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-keeper-stone" /></div>
      </div>
    );
  }
  if (state === 'missing' || !card) {
    return (
      <div className="keeper-serif relative min-h-screen">
        <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
        <KeeperHeader />
        <div className="mx-auto max-w-lg px-6 pb-24 pt-40 text-center">
          <h1 className="font-display text-2xl font-bold text-keeper-ink">That card's been taken off the shelf</h1>
          <Link href="/cards/birthday" className="mt-6 inline-block rounded-full bg-keeper-ink px-6 py-3 font-semibold text-keeper-paper">Back to the rack</Link>
        </div>
        <MarketingFooter />
      </div>
    );
  }

  const editable = card.editable !== false;

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-36 sm:px-6">
        <nav className="text-xs text-keeper-meta">
          <Link href="/" className="hover:text-keeper-ink">Home</Link>
          <span className="mx-1.5">/</span>
          <Link href={`/cards/${card.occasion}`} className="capitalize hover:text-keeper-ink">{card.occasion} cards</Link>
          <span className="mx-1.5">/</span>
          <span className="text-keeper-body">This card</span>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          {/* THE CARD — large, ajar, on the paper ground. */}
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative aspect-square" style={{ perspective: '1400px' }}>
              <div className="absolute inset-[3%] rounded-r-lg rounded-l-sm bg-[#FFFDF8] shadow-[inset_-2px_0_6px_rgba(33,29,25,0.08)]" />
              <div
                className="absolute inset-[3%] origin-left overflow-hidden rounded-r-lg rounded-l-sm bg-white [transform:rotateY(-18deg)]"
                style={{ boxShadow: '4px 8px 24px rgba(33,29,25,0.16), 16px 28px 60px -20px rgba(33,29,25,0.35)' }}
              >
                <img src={card.imageUrl} alt={card.front_text} crossOrigin="anonymous" className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-black/10" />
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-keeper-meta">148 × 148&nbsp;mm folded · 300gsm · blank-ready inside · envelope included</p>
          </div>

          {/* THE BUY PANEL */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-keeper-gold">
              {[card.tone, card.age && `${card.age}th`, card.recipient && card.recipient !== 'Anyone' && `for ${card.recipient}`].filter(Boolean).join(' · ') || 'birthday card'}
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold leading-snug text-keeper-ink sm:text-3xl">“{card.front_text}”</h1>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-display text-3xl font-bold text-keeper-ink">£8.99</span>
              <span className="text-sm text-keeper-meta">+ postage from £3.95, straight to their door</span>
            </div>

            {/* Personalisation — the point of the shop. */}
            <div className="mt-7 space-y-5 rounded-2xl border border-keeper-hair bg-white/70 p-5 backdrop-blur-sm">
              {editable ? (
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-keeper-ink"><PenLine className="h-3.5 w-3.5 text-keeper-gold" /> Your words on the front</label>
                  <p className="mt-0.5 text-xs text-keeper-meta">This design carries anyone's words — leave blank to keep the original line.</p>
                  <input value={ownWords} onChange={(e) => setOwnWords(e.target.value)} placeholder={card.front_text}
                    className="mt-2 w-full rounded-lg border border-keeper-hair bg-white px-3 py-2.5 text-sm text-keeper-body outline-none focus:border-keeper-gold" />
                </div>
              ) : (
                <p className="text-sm text-keeper-body"><span className="font-semibold">The words are the card</span> — this design is sold exactly as written, and the inside is all yours.</p>
              )}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-keeper-ink"><PenLine className="h-3.5 w-3.5 text-keeper-gold" /> Your message inside</label>
                <p className="mt-0.5 text-xs text-keeper-meta">Set in the card's own style — or leave blank to write it by hand.</p>
                <textarea value={insideMsg} onChange={(e) => setInsideMsg(e.target.value)} placeholder="Dear…"
                  className="mt-2 min-h-[88px] w-full rounded-lg border border-keeper-hair bg-white px-3 py-2.5 text-sm text-keeper-body outline-none focus:border-keeper-gold" />
              </div>
            </div>

            <button type="button" onClick={() => setNotice(true)}
              className="mt-6 w-full rounded-full bg-keeper-ink py-4 text-base font-semibold text-keeper-paper transition-colors hover:bg-black">
              Buy this card — £8.99
            </button>
            {notice && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Checkout for rack cards is landing shortly — this page is the preview build. The studio can make and send cards today.
              </p>
            )}
            <p className="mt-3 text-center text-xs text-keeper-meta">No account needed to buy a card — only our card builder asks you to sign up.</p>

            <ul className="mt-7 space-y-2.5 text-sm text-keeper-body">
              <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cta" /> Printed on 300gsm card with a proper envelope</li>
              <li className="flex items-start gap-2.5"><Truck className="mt-0.5 h-4 w-4 shrink-0 text-cta" /> Made and posted within 72 hours, UK-wide</li>
              <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cta" /> Send it to them directly, or to yourself to hand over</li>
            </ul>
          </div>
        </div>

        {/* Cross-sell back to the wall */}
        <div className="mt-16 border-t border-keeper-hair pt-8 text-center">
          <Link href={`/cards/${card.occasion}`} className="text-sm font-medium text-keeper-gold hover:underline">← More {card.occasion} cards</Link>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
