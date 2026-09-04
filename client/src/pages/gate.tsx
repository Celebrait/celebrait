// client/src/pages/gate.tsx — THE GATE (/)
//
// Aidan, 2026-09-03: "a super ridic simple doorway that asks the users
// what kind of creator they are — and then points them at either the
// current LP or the door one. Both can have links to the others. But
// they need to be live as my photo route is just too too good."
//
// One question, two answers, nothing else. The landing's chrome so it
// is unmistakably the same site. Each door is a real page that already
// works: /photo (the photo landing page, moved from /) and /create (the
// three-card doorway). Each of those points back at the other.

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Camera, Sparkles, ArrowRight } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { TrustChips } from '@/pages/landing-keeper';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import { DISPLAY } from '@/pages/doorway';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

const doorCls = 'group flex flex-col rounded-2xl border border-keeper-hair bg-white/70 p-5 shadow-[0_12px_40px_-24px_rgba(33,29,25,0.3)] backdrop-blur-sm transition-colors hover:border-keeper-gold sm:p-6';
const doorCta = 'inline-flex items-center gap-2 rounded-full bg-keeper-ink px-5 py-2.5 text-sm font-semibold text-keeper-paper transition-colors group-hover:bg-black';

export default function GatePage() {
  useSeo('/');
  const [three, setThree] = useState<Array<{ id: number; front_text: string; imageUrl: string }>>([]);
  useEffect(() => {
    // The three-card door shows three real fronts: the hand-picked
    // carousel cards first, the birthday rack behind them.
    Promise.all([
      fetch('/api/catalogue/featured').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/catalogue/birthday').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([f, b]) => {
      const picks = (f?.cards ?? []) as typeof three;
      const seen = new Set(picks.map((c) => c.id));
      const pad = ((b?.cards ?? []) as typeof three).filter((c) => !seen.has(c.id));
      setThree([...picks, ...pad].slice(0, 3));
    });
  }, []);

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="pt-32">
        <section className="px-6 pb-16 pt-10 md:pb-20 md:pt-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">Unbinnable Greetings Cards</p>
            <h1 className={`mt-4 max-w-[18ch] text-[clamp(40px,6.4vw,70px)] leading-[1.04] ${DISPLAY}`}>
              What kind of card maker are you?
            </h1>
            <p className="mt-4 max-w-[34rem] text-[17px] leading-relaxed text-keeper-body">
              Two ways to make a card that's all about them. Pick yours — you can switch on the next page.
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {/* Door one — the photo route */}
              <Link href="/photo" className={doorCls}>
                <div className="overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_-24px_rgba(33,29,25,0.45)]">
                  <img src="/hero-real-card.webp" alt="A printed Celebrait card made from a phone photo, standing on a desk beside its envelope" className="aspect-[16/9] w-full object-cover" />
                </div>
                <h2 className="mt-5 font-display text-xl font-bold text-keeper-ink">I've got a photo of them.</h2>
                <p className="mt-1 text-sm leading-relaxed text-keeper-body">They become the artwork — in any scene you can describe. Best friends abseiling off Big Ben, Mum under the Northern Lights.</p>
                <div className="mt-4 flex flex-1 flex-wrap items-end justify-between gap-3">
                  <span className="text-[12px] text-keeper-meta">{gbp(cardPriceGBP('photo'))} · from one photo</span>
                  <span className={doorCta}><Camera className="h-4 w-4 text-cta" /> Start with a photo <ArrowRight className="h-3.5 w-3.5" /></span>
                </div>
              </Link>

              {/* Door two — tell us about them */}
              <Link href="/create" className={doorCls}>
                <div className="grid grid-cols-3 gap-3">
                  {(three.length ? three : [null, null, null]).map((c, i) =>
                    c ? <AjarTile key={c.id} imageUrl={c.imageUrl} alt={c.front_text} eager /> : <div key={i} className="aspect-square animate-pulse rounded-lg bg-keeper-hair/50" />,
                  )}
                </div>
                <h2 className="mt-5 font-display text-xl font-bold text-keeper-ink">I'll tell you about them.</h2>
                <p className="mt-1 text-sm leading-relaxed text-keeper-body">One thing they love, a few quick questions, and three original cards to choose from. You pick the one.</p>
                <div className="mt-4 flex flex-1 flex-wrap items-end justify-between gap-3">
                  <span className="text-[12px] text-keeper-meta">from {gbp(cardPriceGBP('rack'))} · about a minute</span>
                  <span className={doorCta}><Sparkles className="h-4 w-4 text-cta" /> Tell us about them <ArrowRight className="h-3.5 w-3.5" /></span>
                </div>
              </Link>
            </div>

            <div className="mt-8"><TrustChips /></div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
