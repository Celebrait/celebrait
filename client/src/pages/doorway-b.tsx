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
import { Camera, ArrowRight, Sparkles } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { BriefQuestions, readBriefFromSearch, briefToSearch, type Brief } from '@/components/brief-questions';
import { ShimmerWord } from '@/pages/landing-keeper';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { TrustChips } from '@/pages/landing-keeper';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import { DISPLAY } from '@/pages/doorway';
import type { RackPayload, CatalogueCard } from '@/components/catalogue/rack-wall';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/** "Say goodbye to …" — the three pains, rotating (Aidan 2026-09-02). */
const ENDINGS = ['not knowing which card suits them', '“that one will do”', 'staring at a generic rack'];


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
    <div className="door-drift-mask -mb-6 overflow-hidden">
      <style>{`
        @keyframes door-drift { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .door-drift { animation: door-drift ${Math.max(40, cards.length * 4)}s linear infinite; width: max-content; }
        .door-drift:hover, .door-drift:focus-within { animation-play-state: paused; }
        .door-drift-mask { -webkit-mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent); mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent); }
        @media (prefers-reduced-motion: reduce) { .door-drift { animation: none; width: auto; overflow-x: auto; } }
      `}</style>
      {/* The tiles' layered shadows reach ~34px below the card; the
          clipping container must keep all 40px of padding, so the
          spacing pull-back (-mb-6) lives on the CONTAINER, not here —
          on the child it just moved the clip edge back to 16px and
          the hard line stayed (Aidan: "the line is still there"). */}
      <div className="door-drift flex gap-4 pb-10 pt-4">
        {row.map((c, i) => (
          <Link key={`${c.id}-${i}`} href={`/card/${c.id}`} className="group block w-[150px] shrink-0 sm:w-[190px]" aria-hidden={i >= cards.length ? true : undefined} tabIndex={i >= cards.length ? -1 : undefined}>
            {/* The strip moves, so the browser's lazy-load check lags it:
                the first ten load eagerly, the rest as they drift in. */}
            <AjarTile imageUrl={c.imageUrl} alt={c.front_text} eager={i < 10} />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DoorwayBPage() {
  useSeo('/door2');
  const [, navigate] = useLocation();
  // The brief lives in the URL as it's answered (refresh/back/share all
  // keep it); the hand-off to /make carries it with go=1.
  const [brief, setBriefState] = useState<Brief>(() => readBriefFromSearch(typeof window !== 'undefined' ? window.location.search : ''));
  const setBrief = (b: Brief) => {
    setBriefState(b);
    const qs = briefToSearch(b);
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  };
  // "Get started" swaps the hero copy for the questions, same spot. A
  // brief already in the URL means they're mid-way — open on the questions.
  const [started, setStarted] = useState<boolean>(() => brief.who.trim().length > 0);
  // The rotating ending (the old LP's persona mechanic): three pains,
  // 2.2s each, 200ms fade, paused while the tab is hidden, still under
  // reduced motion.
  const reduced = useReducedMotion();
  const [ending, setEnding] = useState(0);
  const [endingVisible, setEndingVisible] = useState(true);
  useEffect(() => {
    if (reduced || started) return;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      setEndingVisible(false);
      window.setTimeout(() => { setEnding((e) => (e + 1) % ENDINGS.length); setEndingVisible(true); }, 200);
    }, 2600);
    return () => window.clearInterval(t);
  }, [reduced, started]);
  const [cards, setCards] = useState<CatalogueCard[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    fetch('/api/catalogue/christmas').then((r) => (r.ok ? r.json() : null))
      .then((x: RackPayload | null) => { if (x) setCounts((c) => ({ ...c, christmas: x.count })); }).catch(() => {});
  }, []);
  // Birthdays only in the wall (Aidan 2026-09-02) — the evergreen rack.
  // A fresh shuffle of the WHOLE birthday rack on every visit, twenty
  // drawn ("randomise the carousel a bit more"), so no two arrivals see
  // the same wall and the newest cards don't always lead.
  useEffect(() => {
    fetch('/api/catalogue/birthday').then((r) => (r.ok ? r.json() : null))
      .then((b: RackPayload | null) => {
        if (b) setCounts((c) => ({ ...c, birthday: b.count }));
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
            {!started ? (
              <>
                {/* "Say goodbye to" + a rotating ending with the LP's violet
                    shimmer and a soft glow. The endings wrap to two lines
                    at every width, so all three sit invisibly in the same
                    grid cell to fix the height — the page never reflows
                    as the words change (the old LP's sizer trick). */}
                <h1 className={`mt-4 max-w-[22ch] text-[clamp(40px,7vw,74px)] leading-[1.04] ${DISPLAY}`}>
                  Say goodbye to
                  <span className="grid">
                    {ENDINGS.map((e) => <span key={e} aria-hidden className="invisible col-start-1 row-start-1 px-1">{e}</span>)}
                    <span className="col-start-1 row-start-1 transition-opacity duration-200 [filter:drop-shadow(0_0_22px_rgba(92,87,212,0.38))]" style={{ opacity: endingVisible ? 1 : 0 }}>
                      <ShimmerWord reduced={!!reduced}>{ENDINGS[ending]}</ShimmerWord>
                    </span>
                  </span>
                </h1>
                <p className="mt-5 max-w-[36rem] text-[17px] leading-relaxed text-keeper-body">
                  Create a personalised greetings card they'll probably keep, in under 2 minutes.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <button type="button" onClick={() => setStarted(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-keeper-ink px-7 py-3.5 text-[15px] font-semibold text-keeper-paper shadow-[0_10px_30px_-12px_rgba(33,29,25,0.5)] transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-keeper-gold">
                    <Sparkles className="h-4 w-4 text-cta" /> Get started
                  </button>
                  <span className="text-[13px] text-keeper-meta">Seven quick questions · about a minute</span>
                </div>
              </>
            ) : (
              /* Get started swaps the copy for the questions, one at a
                 time, in the same place — the wall below never moves. The
                 page only changes at "Write their three cards" (→ /make). */
              <div className="mt-6 max-w-3xl">
                <BriefQuestions skin="landing" compact brief={brief} onChange={setBrief}
                  initialStep={!brief.who ? 0 : !brief.occasion ? 1 : 2}
                  onDone={(b) => navigate(`/make?${briefToSearch(b)}&go=1`)} />
              </div>
            )}

            <div className="mt-8 max-w-3xl">
              <p className="text-[14px] text-keeper-body">
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

          {/* The carousel IS the shelf (Aidan: the full wall beneath it
              was "too much") — two links into the racks proper, which
              carry the toggle, the filters and the search. */}
          <div className="mx-auto mt-5 max-w-6xl px-6">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-keeper-body">
              <span>Or take one off the shelf:</span>
              <Link href="/cards/christmas" className="font-medium text-keeper-ink underline decoration-keeper-hair underline-offset-4 transition-colors hover:text-keeper-gold hover:decoration-keeper-gold">
                Christmas{counts.christmas ? <span className="ml-1 text-[12px] text-keeper-meta">{counts.christmas}</span> : null}
              </Link>
              <span className="text-keeper-hair">·</span>
              <Link href="/cards/birthday" className="font-medium text-keeper-ink underline decoration-keeper-hair underline-offset-4 transition-colors hover:text-keeper-gold hover:decoration-keeper-gold">
                Birthdays{counts.birthday ? <span className="ml-1 text-[12px] text-keeper-meta">{counts.birthday}</span> : null}
              </Link>
              <span className="text-[13px] text-keeper-meta">· from {gbp(cardPriceGBP('rack'))}, printed today if you order by 3pm</span>
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-6xl px-6"><TrustChips /></div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
