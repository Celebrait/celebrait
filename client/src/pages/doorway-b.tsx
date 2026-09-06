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
import { Sparkles, Loader2 } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { BriefQuestions, readBriefFromSearch, briefToSearch, type Brief } from '@/components/brief-questions';
import { ShimmerWord } from '@/pages/landing-keeper';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { TrustChips } from '@/pages/landing-keeper';
import { CardDrift } from '@/components/catalogue/card-drift';
import { DISPLAY, HERO_MAIN, HERO_TOP, EYEBROW, SUB } from '@/pages/doorway';
import type { RackPayload } from '@/components/catalogue/rack-wall';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;



/** The drifting wall — the rack's cards, interleaved across occasions,
 *  duplicated once so the loop is seamless. */
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
  // A short beat between the tap and the first question (Aidan: "a
  // loading spinner in the question area once clicked get started") —
  // the swap is instant, so this is acknowledgement, not waiting: 650ms.
  const [starting, setStarting] = useState(false);
  const begin = () => { setStarting(true); window.setTimeout(() => { setStarting(false); setStarted(true); }, 650); };
  const reduced = useReducedMotion();
  // The wall itself lives in components/catalogue/card-drift.tsx (the
  // hand-picked carousel cards first, then a birthday shuffle). Only the
  // rack counts are fetched here.
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    for (const o of ['christmas', 'birthday'] as const) {
      fetch(`/api/catalogue/${o}`).then((r) => (r.ok ? r.json() : null))
        .then((x: RackPayload | null) => { if (x) setCounts((c) => ({ ...c, [o]: x.count })); }).catch(() => {});
    }
  }, []);

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className={HERO_MAIN}>
        {/* ── The hero IS step one of the builder ── */}
        <section className={`pb-16 md:pb-24 ${HERO_TOP}`}>
          <div className="mx-auto max-w-6xl px-6">
            <p className={EYEBROW}>Unbinnable Greetings Cards</p>
            {starting ? (
              <div className="mt-4 flex min-h-[300px] max-w-3xl items-center justify-center" role="status" aria-label="Loading the questions">
                <Loader2 className="h-14 w-14 animate-spin text-keeper-gold" strokeWidth={1.5} />
              </div>
            ) : !started ? (
              <>
                {/* The headline (Aidan 2026-09-02): the human line in
                    Fraunces, the mechanism beneath with the shimmer + glow. */}
                {/* The human bit is the headline; the mechanism is the line
                    under it, with the glow on "just for them". */}
                <h1 className={`mt-4 max-w-[26ch] text-[clamp(30px,5vw,58px)] leading-[1.06] text-balance ${DISPLAY}`}>
                  Why settle for a card that's anything but{' '}
                  <span className="-mx-1 inline-block whitespace-nowrap [filter:drop-shadow(0_0_22px_rgba(92,87,212,0.4))]">
                    <ShimmerWord reduced={!!reduced}>all about them</ShimmerWord>
                  </span>?
                </h1>
                <p className={`max-w-[36rem] ${SUB}`}>
                  In just a few clicks, get 3 personalised greetings cards to choose from. Then design the inside.
                  Thoughtful, funny, gloriously daft?{' '}
                  <span className="font-semibold text-keeper-ink">Over to you.</span>
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <button type="button" onClick={begin}
                    className="inline-flex items-center gap-2 rounded-full bg-go px-7 py-3.5 text-[15px] font-semibold text-go-foreground shadow-[0_10px_30px_-12px_rgba(92,87,212,0.5)] transition-colors hover:bg-go-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-keeper-gold">
                    <Sparkles className="h-4 w-4" /> Get started
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
              {/* The other door (the gate, 2026-09-03): the photo route is
                  live at /photo and each page points at the other. */}
              <p className="text-[14px] text-keeper-body">
                <span className="text-keeper-meta">from {gbp(cardPriceGBP('rack'))} · nothing to pay until you print</span>
                <span className="mx-2 text-keeper-hair">|</span>
                <Link href="/photo" className="font-medium text-keeper-ink underline decoration-keeper-hair underline-offset-4 transition-colors hover:text-keeper-gold hover:decoration-keeper-gold">Got a photo of them? Put them in the picture →</Link>
              </p>
            </div>
          </div>

          {/* ── The wall: real cards, drifting ── */}
          <div className="mt-12 md:mt-16">
            <div className="mx-auto max-w-6xl px-6">
              <p className={EYEBROW}>From the rack · made for real people</p>
            </div>
            <div className="mt-3 pl-6 md:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]">
              <CardDrift />
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
