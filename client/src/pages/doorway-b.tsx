// client/src/pages/doorway-b.tsx — DOORWAY, VARIANT B (/door2)
//
// Aidan, 2026-09-02: "feel like the hero might need to be the first
// step of /make … also some kinda scrolling recently-made carousel —
// maybe in the hero — like a 3D wall lol — too complex?"
//
// So the hero IS the builder's first question: "Who's the card for?"
// with the research maker's recipient chips. Tap Mum → /make with Mum
// answered, landing on question two. The photo route is one quiet line
// beneath. Under that, THE WALL: a slow sideways drift of real ajar
// cards from the rack (CSS, not WebGL — one canvas per card melts
// phones; the tile is already CSS 3D). Pauses on hover, static under
// reduced motion, every card tappable. The full rack with its filters
// follows, exactly as on /door.

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Camera, ArrowRight } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { TrustChips } from '@/pages/landing-keeper';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import { DISPLAY, DoorRack } from '@/pages/doorway';
import type { RackPayload, CatalogueCard } from '@/components/catalogue/rack-wall';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

const RECIPIENTS = ['Mum', 'Dad', 'Nan', 'Grandad', 'Sister', 'Brother', 'Daughter', 'Son', 'Partner', 'Best mate', 'Friend', 'Colleague', 'Someone else'];

const chip = 'rounded-full border border-keeper-hair bg-white/80 px-4 py-2.5 text-[15px] font-medium text-keeper-ink shadow-[0_1px_2px_rgba(33,29,25,0.05)] transition-colors hover:border-keeper-gold hover:bg-keeper-gold-wash hover:text-keeper-gold-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-keeper-gold';

/** The drifting wall — the rack's cards, interleaved across occasions,
 *  duplicated once so the loop is seamless. */
function CardDrift({ cards }: { cards: CatalogueCard[] }) {
  const row = useMemo(() => [...cards, ...cards], [cards]);
  if (!cards.length) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-square w-[150px] shrink-0 animate-pulse rounded-lg bg-keeper-hair/50 sm:w-[190px]" />)}
      </div>
    );
  }
  return (
    <div className="door-drift-mask overflow-hidden">
      <style>{`
        @keyframes door-drift { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .door-drift { animation: door-drift ${Math.max(40, cards.length * 4)}s linear infinite; width: max-content; }
        .door-drift:hover, .door-drift:focus-within { animation-play-state: paused; }
        .door-drift-mask { -webkit-mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent); mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent); }
        @media (prefers-reduced-motion: reduce) { .door-drift { animation: none; width: auto; overflow-x: auto; } }
      `}</style>
      {/* pb-10 + -mb-6: the tiles' layered shadows need ~40px below to
          fade out; clipping them at the strip's edge drew a hard line
          under the row (Aidan: "ditch that weird line along the bottom"). */}
      <div className="door-drift -mb-6 flex gap-4 pb-10 pt-4">
        {row.map((c, i) => (
          <Link key={`${c.id}-${i}`} href={`/card/${c.id}`} className="group block w-[150px] shrink-0 sm:w-[190px]" aria-hidden={i >= cards.length ? true : undefined} tabIndex={i >= cards.length ? -1 : undefined}>
            <AjarTile imageUrl={c.imageUrl} alt={c.front_text} />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DoorwayBPage() {
  useSeo('/door2');
  const [, navigate] = useLocation();
  const [cards, setCards] = useState<CatalogueCard[]>([]);
  // Birthdays only in the wall (Aidan 2026-09-02) — the evergreen rack.
  // A fresh shuffle of the WHOLE birthday rack on every visit, twenty
  // drawn ("randomise the carousel a bit more"), so no two arrivals see
  // the same wall and the newest cards don't always lead.
  useEffect(() => {
    fetch('/api/catalogue/birthday').then((r) => (r.ok ? r.json() : null))
      .then((b: RackPayload | null) => {
        const pool = [...((b?.cards ?? []) as CatalogueCard[])];
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        setCards(pool.slice(0, 20));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="pt-32">
        {/* ── The hero IS step one of the builder ── */}
        <section className="pb-12 pt-10 md:pb-16 md:pt-20">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">Unbinnable Greetings Cards</p>
            <h1 className={`mt-4 text-[clamp(44px,7vw,74px)] leading-[1.04] ${DISPLAY}`}>
              Cards made
              <br />
              for one person.
            </h1>

            <div className="mt-8 max-w-3xl">
              <p className="text-[17px] font-medium text-keeper-ink">Who's the card for?</p>
              <p className="mt-1 text-[14px] text-keeper-body">Tap one — we'll write and illustrate three original cards for them, in about a minute.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {RECIPIENTS.map((r) => (
                  <button key={r} type="button" className={chip} onClick={() => navigate(`/make?who=${encodeURIComponent(r)}`)}>{r}</button>
                ))}
              </div>
              <p className="mt-4 text-[14px] text-keeper-body">
                <span className="text-keeper-meta">from {gbp(cardPriceGBP('rack'))} · nothing to pay until you print</span>
                <span className="mx-2 text-keeper-hair">|</span>
                <Link href="/studio" className="inline-flex items-center gap-1.5 font-medium text-keeper-ink transition-colors hover:text-keeper-gold">
                  <Camera className="h-4 w-4 text-keeper-gold" /> Or start with a photo <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </p>
            </div>
          </div>

          {/* ── The wall: real cards, drifting ── */}
          <div className="mt-10 md:mt-14">
            <div className="mx-auto max-w-6xl px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-keeper-gold">From the rack · every one made from a real brief</p>
            </div>
            <div className="mt-3 pl-6 md:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]">
              <CardDrift cards={cards} />
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-6xl px-6"><TrustChips /></div>
        </section>

        <DoorRack />
      </main>
      <MarketingFooter />
    </div>
  );
}
