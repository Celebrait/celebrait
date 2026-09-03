// client/src/pages/doorway.tsx — THE DOORWAY (/door → becomes / when signed off)
//
// Aidan, 2026-09-02: "needs to look exactly like my current LP with the
// same header, same menu, same background, same bold Fraunces as the
// headline. Lead with the full racks below, lazy load, able to toggle
// occasions, tone, age, same layout as the current /cards page … so
// the user moves seamlessly into my catalogue."
//
// So: the landing's exact chrome (KeeperHeader + ticker, Celebration-
// Backdrop, keeper-serif, the DISPLAY headline at the hero's clamp),
// two doors in the landing's card style (Set A copy), the trust chips,
// then THE RACK ITSELF — components/catalogue/rack-wall.tsx, the same
// component /cards renders — mounted lazily when scrolled into view,
// with an occasion toggle above its own style/age chips and search.
//
// Variant B lives in doorway-b.tsx (/door2): the hero is the builder's
// first question + a drifting wall of real cards. DoorRack is shared.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { Sparkles, Camera, ArrowRight } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { TrustChips } from '@/pages/landing-keeper';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import { RackWall, type RackPayload } from '@/components/catalogue/rack-wall';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;
// The landing's display style, verbatim (landing-keeper.tsx DISPLAY).
export const DISPLAY = 'font-display font-bold tracking-[-0.015em] text-keeper-ink';

export const OCCASIONS = [
  { slug: 'christmas', label: 'Christmas' },
  { slug: 'birthday', label: 'Birthdays' },
] as const;

/** Mounts children the first time they scroll near the viewport. */
export function LazyMount({ children, minHeight = '60vh' }: { children: ReactNode; minHeight?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (on) return;
    const el = ref.current; if (!el) return;
    if (!('IntersectionObserver' in window)) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: '480px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [on]);
  return <div ref={ref} style={on ? undefined : { minHeight }}>{on ? children : null}</div>;
}

/** The rack section — the same wall /cards renders, with an occasion
 *  toggle above its style/age chips. Self-contained; shared by both
 *  doorway variants. */
export function DoorRack() {
  const [occasion, setOccasion] = useState<string>('christmas');
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    for (const o of OCCASIONS) {
      fetch(`/api/catalogue/${o.slug}`).then((r) => (r.ok ? r.json() : null)).then((j: RackPayload | null) => {
        if (j) setCounts((c) => ({ ...c, [o.slug]: j.count }));
      }).catch(() => {});
    }
  }, []);
  return (
    <section id="rack" className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-keeper-gold">The Celebrait rack</p>
        <h2 className="mt-2 font-display text-4xl font-bold leading-[1.05] text-keeper-ink sm:text-5xl">
          Or straight off the <span className="text-keeper-gold">shelf</span>
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-keeper-body">
          Every card here was made for a real person's brief — not a warehouse.
          Send one as it is, or make it theirs.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-keeper-meta">Occasion</span>
        {OCCASIONS.map((o) => (
          <button key={o.slug} type="button" onClick={() => setOccasion(o.slug)}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${occasion === o.slug ? 'border-keeper-gold bg-keeper-gold-wash text-keeper-gold' : 'border-keeper-hair bg-white/70 text-keeper-body hover:border-keeper-gold'}`}>
            {o.label}{counts[o.slug] ? <span className="ml-1.5 text-[11px] text-keeper-meta">{counts[o.slug]}</span> : null}
          </button>
        ))}
        <Link href={`/cards/${occasion}`} className="ml-auto inline-flex items-center gap-1 text-sm text-keeper-meta transition-colors hover:text-keeper-gold">
          Open the {occasion === 'christmas' ? 'Christmas' : 'birthday'} rack <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <LazyMount>
        <RackWall key={occasion} occasion={occasion} />
      </LazyMount>
    </section>
  );
}

const doorCls = 'group flex flex-col rounded-2xl border border-keeper-hair bg-white/70 p-5 shadow-[0_12px_40px_-24px_rgba(33,29,25,0.3)] backdrop-blur-sm transition-colors hover:border-keeper-gold sm:p-6';
const doorCta = 'inline-flex items-center gap-2 rounded-full bg-keeper-ink px-5 py-2.5 text-sm font-semibold text-keeper-paper transition-colors group-hover:bg-black';

export default function DoorwayPage() {
  useSeo('/door');
  const [three, setThree] = useState<Array<{ id: number; front_text: string; imageUrl: string }>>([]);
  useEffect(() => {
    fetch('/api/catalogue/birthday').then((r) => (r.ok ? r.json() : null)).then((j: RackPayload | null) => { if (j) setThree(j.cards.slice(0, 3)); }).catch(() => {});
  }, []);

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="pt-32">
        {/* ── The hero: the landing's headline, then the two doors ── */}
        <section className="px-6 pb-16 pt-10 md:pb-20 md:pt-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">Unbinnable Greetings Cards</p>
            <h1 className={`mt-4 text-[clamp(44px,7vw,74px)] leading-[1.04] ${DISPLAY}`}>
              Cards made
              <br />
              for one person.
            </h1>
            <p className="mt-4 max-w-[30rem] text-[17px] font-medium text-keeper-ink">Tell us who. Or show us who.</p>

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {/* Door one — a card made for them → the builder */}
              <Link href="/make" className={doorCls}>
                <div className="grid grid-cols-3 gap-3">
                  {(three.length ? three : [null, null, null]).map((c, i) =>
                    c ? <AjarTile key={c.id} imageUrl={c.imageUrl} alt={c.front_text} /> : <div key={i} className="aspect-square animate-pulse rounded-lg bg-keeper-hair/50" />,
                  )}
                </div>
                <h2 className="mt-5 font-display text-xl font-bold text-keeper-ink">A card made for them.</h2>
                <p className="mt-1 text-sm leading-relaxed text-keeper-body">Tell us who. Three originals in a minute, and they can be in it.</p>
                <div className="mt-4 flex flex-1 flex-wrap items-end justify-between gap-3">
                  <span className="text-[12px] text-keeper-meta">from {gbp(cardPriceGBP('rack'))} · about a minute</span>
                  <span className={doorCta}><Sparkles className="h-4 w-4 text-cta" /> Start with who it's for</span>
                </div>
              </Link>

              {/* Door two — a scene made around them → the studio */}
              <Link href="/studio" className={doorCls}>
                <div className="overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_-24px_rgba(33,29,25,0.45)]">
                  <img src="/hero-real-card.webp" alt="A printed Celebrait card standing on a desk beside its envelope" className="aspect-[16/9] w-full object-cover" />
                </div>
                <h2 className="mt-5 font-display text-xl font-bold text-keeper-ink">A scene made around them.</h2>
                <p className="mt-1 text-sm leading-relaxed text-keeper-body">From one photo. You describe the moment, we make it real.</p>
                <div className="mt-4 flex flex-1 flex-wrap items-end justify-between gap-3">
                  <span className="text-[12px] text-keeper-meta">{gbp(cardPriceGBP('photo'))} · first one's on us</span>
                  <span className={doorCta}><Camera className="h-4 w-4 text-cta" /> Start with a photo</span>
                </div>
              </Link>
            </div>

            <div className="mt-8"><TrustChips /></div>
          </div>
        </section>

        <DoorRack />
      </main>
      <MarketingFooter />
    </div>
  );
}
