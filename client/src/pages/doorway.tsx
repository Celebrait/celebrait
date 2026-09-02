// client/src/pages/doorway.tsx — THE DOORWAY (/door → becomes / when signed off)
//
// Aidan, 2026-09-02: "a ridiculously simple LP doorway that gives the
// options, cos they are different." Two doors, one line, nothing else.
// Copy is Set A. Design is the STUDIO's, verbatim — its header, its
// panels, its type ladder, its buttons (see the studio recipe: page h1
// = font-display semibold, panels = white/2xl/hairline, green only on
// the commit moment, violet for links). Fraunces once, then silence.
//
// Door one → /make (public builder, guest gate). Door two → /studio
// (sign-in: the photo route runs the heavier models, members only).

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP, SHIPPING_TIERS } from '@shared/pricing';
import celebraitLogo from '@/assets/celebrait.webp';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

interface RackCard { id: number; front_text: string; imageUrl: string }

export function PublicHeader() {
  return (
    <header className="relative z-40 h-16 bg-white/70 backdrop-blur-md border-b border-keeper-hair flex items-center px-4 sm:px-6 gap-3">
      <Link href="/door" className="flex items-center" aria-label="Celebrait home">
        <img src={celebraitLogo} alt="Celebrait" className="h-6 w-auto" />
      </Link>
      <nav className="ml-auto flex items-center gap-5">
        <Link href="/cards/christmas" className="hidden sm:inline text-sm text-keeper-body hover:text-keeper-ink">Christmas</Link>
        <Link href="/cards/birthday" className="hidden sm:inline text-sm text-keeper-body hover:text-keeper-ink">Birthdays</Link>
        <Link href="/studio" className="text-sm font-medium text-keeper-ink hover:text-brand-dark">Sign in</Link>
      </nav>
    </header>
  );
}

const door = 'group block bg-white rounded-2xl border border-keeper-hair p-5 sm:p-6 hover:border-brand hover:shadow-lg transition-all';
const goPill = 'inline-flex items-center gap-2 bg-cta group-hover:bg-cta-hover text-cta-foreground rounded-full px-4 py-2 text-sm font-semibold transition-colors shadow-sm whitespace-nowrap';

export default function DoorwayPage() {
  useSeo('/door');
  const [bday, setBday] = useState<RackCard[]>([]);
  const [xmas, setXmas] = useState<RackCard[]>([]);
  useEffect(() => {
    fetch('/api/catalogue/birthday').then((r) => (r.ok ? r.json() : null)).then((j) => setBday(j?.cards ?? [])).catch(() => {});
    fetch('/api/catalogue/christmas').then((r) => (r.ok ? r.json() : null)).then((j) => setXmas(j?.cards ?? [])).catch(() => {});
  }, []);
  const three = bday.slice(0, 3);
  const shelf = [...xmas.slice(0, 3), ...bday.slice(3, 6)];
  const standard = SHIPPING_TIERS.find((t) => t.id === 'standard');

  return (
    <div className="min-h-screen bg-keeper-paper flex flex-col">
      <PublicHeader />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-10 sm:py-16">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.015em] text-keeper-ink text-balance">
          Cards made for one person.
        </h1>
        <p className="mt-2 text-[15px] text-keeper-body">Tell us who. Or show us who.</p>

        <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 md:grid-cols-2">
          {/* Door one — made for them */}
          <Link href="/make" className={door}>
            <div className="aspect-[16/9] rounded-xl bg-stone-100 overflow-hidden">
              <div className="grid h-full grid-cols-3 items-center gap-2 p-3">
                {(three.length ? three : [null, null, null]).map((c, i) =>
                  c ? (
                    <div key={c.id} className="aspect-square rounded-lg overflow-hidden bg-white shadow-sm">
                      <img src={c.imageUrl} alt={c.front_text} crossOrigin="anonymous" className="w-full h-full object-cover" />
                    </div>
                  ) : <div key={i} className="aspect-square rounded-lg bg-stone-200/70 animate-pulse" />,
                )}
              </div>
            </div>
            <h2 className="mt-5 text-lg sm:text-xl font-semibold text-keeper-ink">A card made for them.</h2>
            <p className="mt-1 text-sm text-keeper-body">Tell us who. Three originals in a minute, and they can be in it.</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-keeper-meta">from {gbp(cardPriceGBP('rack'))} · about a minute</span>
              <span className={goPill}>Start with who it's for <ArrowRight className="w-4 h-4" /></span>
            </div>
          </Link>

          {/* Door two — a scene made around them */}
          <Link href="/studio" className={door}>
            <div className="aspect-[16/9] rounded-xl bg-stone-100 overflow-hidden">
              <img src="/hero-real-card.webp" alt="A printed Celebrait card standing on a desk beside its envelope" className="w-full h-full object-cover" />
            </div>
            <h2 className="mt-5 text-lg sm:text-xl font-semibold text-keeper-ink">A scene made around them.</h2>
            <p className="mt-1 text-sm text-keeper-body">From one photo. You describe the moment, we make it real.</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-keeper-meta">{gbp(cardPriceGBP('photo'))} · first one's on us</span>
              <span className={goPill}>Start with a photo <ArrowRight className="w-4 h-4" /></span>
            </div>
          </Link>
        </div>

        {/* The shelf — ready now */}
        <section className="mt-10 sm:mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-keeper-ink">Or one that's ready now</h2>
            <span className="text-[12.5px] text-keeper-meta">from {gbp(cardPriceGBP('rack'))} · printed today if you order by 3pm</span>
          </div>
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-3">
            {(shelf.length ? shelf : Array.from({ length: 6 }, () => null)).map((c, i) =>
              c ? (
                <Link key={c.id} href={`/card/${c.id}`} className="block aspect-square rounded-xl overflow-hidden bg-stone-100 border border-keeper-hair hover:border-brand transition-colors">
                  <img src={c.imageUrl} alt={c.front_text} crossOrigin="anonymous" className="w-full h-full object-cover" />
                </Link>
              ) : <div key={i} className="aspect-square rounded-xl bg-stone-100 animate-pulse" />,
            )}
          </div>
          <div className="mt-3 flex gap-5 text-sm">
            <Link href="/cards/christmas" className="text-brand hover:text-brand-dark">Christmas cards →</Link>
            <Link href="/cards/birthday" className="text-brand hover:text-brand-dark">Birthday cards →</Link>
          </div>
        </section>

        <p className="mt-10 text-[12.5px] text-keeper-meta">
          280gsm card · kraft envelope · printed to order in the UK · posted first class · {standard ? gbp(standard.price) : '£2.95'} postage per order
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
