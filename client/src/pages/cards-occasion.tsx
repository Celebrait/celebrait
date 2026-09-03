// client/src/pages/cards-occasion.tsx
//
// THE OCCASION PAGE, in full brand (Aidan, 2026-08-22: "Refer to my
// landing page and design this page beautifully. Treat it like a key
// landing page people will arrive from"). Shares the landing's exact
// chrome — KeeperHeader pill nav (auth included), CelebrationBackdrop
// (the fixed warm-paper ground), keeper-serif type, MarketingFooter —
// so an SEO arrival lands on unmistakably the same site.
//
// The wall itself (maker band, chips, AjarTile grid, aisle rails) lives
// in components/catalogue/rack-wall.tsx since 2026-09-02, shared with
// the doorway. This page keeps the SEO furniture: breadcrumb, masthead,
// the signature band.

import { Link, useParams } from 'wouter';
import { useSeo } from '@/lib/use-seo';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { RackWall } from '@/components/catalogue/rack-wall';

const OCCASION_LABELS: Record<string, string> = { birthday: 'Birthday', christmas: 'Christmas' };

function aisleTitle(occasion: string, aisle: string | null): string {
  const occ = OCCASION_LABELS[occasion] ?? occasion;
  if (!aisle) return `${occ} Cards`;
  if (/^\d/.test(aisle)) return `${aisle} ${occ} Cards`;
  if (aisle.startsWith('for-')) return `${occ} Cards for ${aisle.slice(4).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`;
  return `${aisle.replace(/\b\w/g, (c) => c.toUpperCase())} ${occ} Cards`;
}

export default function CardsOccasionPage() {
  const params = useParams<{ occasion: string; aisle?: string }>();
  const occasion = params.occasion ?? 'birthday';
  const aisle = params.aisle ?? null;

  useSeo(`/cards/${occasion}${aisle ? `/${aisle}` : ''}`);
  const title = aisleTitle(occasion, aisle);

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-36 sm:px-6">
        {/* Breadcrumb */}
        <nav className="text-xs text-keeper-meta">
          <Link href="/" className="hover:text-keeper-ink">Home</Link>
          <span className="mx-1.5">/</span>
          {aisle
            ? <><Link href={`/cards/${occasion}`} className="hover:text-keeper-ink">{OCCASION_LABELS[occasion] ?? occasion} cards</Link><span className="mx-1.5">/</span><span className="text-keeper-body">{title}</span></>
            : <span className="text-keeper-body">{OCCASION_LABELS[occasion] ?? occasion} cards</span>}
        </nav>

        {/* The masthead — landing-page typography, not admin chrome. */}
        <div className="mt-6 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-keeper-gold">The Celebrait rack</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] text-keeper-ink sm:text-5xl">
            {title.replace(' Cards', '')} <span className="text-keeper-gold">cards</span>
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-keeper-body">
            Every card here was made for a real person's brief — not a warehouse.
            Send one as it is, or make it theirs.
          </p>
        </div>

        <RackWall occasion={occasion} aisle={aisle}>
          {/* The step-up — the signature act. */}
          <div className="mt-16 overflow-hidden rounded-3xl bg-keeper-ink p-8 text-center sm:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cta">The Celebrait signature</p>
            <h2 className="mt-3 font-display text-2xl font-bold text-keeper-paper sm:text-3xl">Or put them in the picture</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-keeper-paper/70">
              The one they keep forever — made from their photo, in any scene you can describe.
            </p>
            <Link href="/" className="mt-6 inline-block rounded-full bg-keeper-paper px-6 py-3 text-sm font-semibold text-keeper-ink transition-colors hover:bg-white">
              See how it works
            </Link>
          </div>
        </RackWall>
      </main>
      <MarketingFooter />
    </div>
  );
}
