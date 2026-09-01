// client/src/pages/cards-occasion.tsx
//
// THE OCCASION PAGE, in full brand (Aidan, 2026-08-22: "Refer to my
// landing page and design this page beautifully. Treat it like a key
// landing page people will arrive from"). Shares the landing's exact
// chrome — KeeperHeader pill nav (auth included), CelebrationBackdrop
// (the fixed warm-paper ground), keeper-serif type, MarketingFooter —
// so an SEO arrival lands on unmistakably the same site.
//
// The tiles read as GREETING CARDS (AjarTile: cover ajar, inside
// sliver, layered shadow), 2-up on mobile. Clicking one opens the
// product page (/card/:id). Placeat chips wireframe the occasions to
// come without pretending they exist.

import { useEffect, useState } from 'react';
import { cardPriceGBP } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;
import { Link, useParams } from 'wouter';
import { Loader2, Sparkles } from 'lucide-react';
import { useSeo } from '@/lib/use-seo';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { AjarTile } from '@/components/catalogue/ajar-tile';

interface CatalogueCard {
  id: number; front_text: string; tone?: string | null; age?: number | null; age_max?: number | null;
  recipient?: string | null; editable?: boolean; interest?: string | null; imageUrl: string;
}
interface AisleLink { slug: string; label: string; count: number }
interface Payload {
  occasion: string; aisle: string | null; count: number;
  aisles: { ages: AisleLink[]; recipients: AisleLink[]; styles: AisleLink[]; interests?: AisleLink[] };
  cards: CatalogueCard[];
}

const OCCASION_LABELS: Record<string, string> = { birthday: 'Birthday' };

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

  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  /** In-page narrowing (Aidan: "Do we need Funny, Warm, Rude filters?
   *  Wb ages?"). Filters the loaded wall client-side; the aisle PAGES
   *  remain the SEO surface — chips here are for the person browsing. */
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [ageFilter, setAgeFilter] = useState<number | null>(null);
  /** One search box, two behaviours (Aidan: "Free search would be
   *  cool tbh, like ibiza will find my ibiza cards" + the 6-year-old
   *  problem): digits = an exact age (works below the aisle
   *  threshold); words = free text over the card's front AND the
   *  brief it was made from, so "ibiza" finds the Es Vedrà card whose
   *  front never says Ibiza. */
  const [query, setQuery] = useState('');

  useEffect(() => {
    setState('loading');
    fetch(`/api/catalogue/${occasion}${aisle ? `?aisle=${encodeURIComponent(aisle)}` : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { setData(j); setState('ok'); })
      .catch(() => setState('missing'));
  }, [occasion, aisle]);

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

        {state === 'loading' && (
          <div className="flex justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-keeper-stone" /></div>
        )}

        {state === 'missing' && (
          <div className="py-24 text-center">
            <h2 className="font-display text-2xl font-bold text-keeper-ink">Nothing on this shelf yet</h2>
            <p className="mt-3 text-keeper-body">We're stocking it — but we can make theirs right now, from one thing they love.</p>
            <Link href="/studio" className="mt-6 inline-block rounded-full bg-keeper-ink px-6 py-3 font-semibold text-keeper-paper transition-colors hover:bg-black">Make their card</Link>
          </div>
        )}

        {state === 'ok' && data && (
          <>
            {/* The maker band — the twist no other card site has. */}
            <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-keeper-hair bg-white/70 p-5 shadow-[0_12px_40px_-24px_rgba(33,29,25,0.3)] backdrop-blur-sm sm:flex-row sm:items-center sm:p-6">
              <div>
                <p className="font-display text-lg font-bold text-keeper-ink">Nothing quite them?</p>
                <p className="mt-0.5 text-sm text-keeper-body">Tell us one thing they love — we'll make three just for them, in minutes.</p>
              </div>
              <Link href="/studio" className="flex shrink-0 items-center gap-2 rounded-full bg-keeper-ink px-5 py-2.5 text-sm font-semibold text-keeper-paper transition-colors hover:bg-black">
                <Sparkles className="h-4 w-4 text-cta" /> Make their card
              </Link>
            </div>

            {/* Filters — narrowing without leaving the wall. Only shown
                when the hub has the variety to warrant them. */}
            {!aisle && (data.aisles.styles.length > 1 || data.aisles.ages.length > 1) && (
              <div className="mt-8 space-y-2.5">
                {data.aisles.styles.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-keeper-meta">Style</span>
                    <button type="button" onClick={() => setStyleFilter(null)}
                      className={`rounded-full border px-3 py-1 text-sm ${styleFilter === null ? 'border-keeper-gold bg-keeper-gold-wash text-keeper-gold' : 'border-keeper-hair bg-white/70 text-keeper-body'}`}>All</button>
                    {data.aisles.styles.map((l) => (
                      <button key={l.slug} type="button" onClick={() => setStyleFilter(styleFilter === l.slug ? null : l.slug)}
                        className={`rounded-full border px-3 py-1 text-sm capitalize ${styleFilter === l.slug ? 'border-keeper-gold bg-keeper-gold-wash text-keeper-gold' : 'border-keeper-hair bg-white/70 text-keeper-body'}`}>{l.label}</button>
                    ))}
                  </div>
                )}
                {/* The age row renders when ANY age aisle exists — on
                    mostly-ageless occasions (christmas) the Kids door
                    and the search must not vanish with the numeric
                    chips (the >1 gate hid both). Numeric milestone
                    chips only appear where numeric aisles exist. */}
                {(
                  <div className="flex flex-wrap items-center gap-2">
                    {data.aisles.ages.length > 0 && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-keeper-meta">Age</span>
                    )}
                    {data.aisles.ages.filter((l) => l.slug !== 'kids').length > 0 && (
                      <button type="button" onClick={() => setAgeFilter(null)}
                        className={`rounded-full border px-3 py-1 text-sm ${ageFilter === null ? 'border-keeper-gold bg-keeper-gold-wash text-keeper-gold' : 'border-keeper-hair bg-white/70 text-keeper-body'}`}>All</button>
                    )}
                    {data.aisles.ages.some((l) => l.slug === 'kids') && (
                      <Link href={`/cards/${occasion}/kids`}
                        className="rounded-full border border-keeper-hair bg-white/70 px-3 py-1 text-sm text-keeper-body hover:border-keeper-gold">
                        Kids
                      </Link>
                    )}
                    {data.aisles.ages.filter((l) => l.slug !== 'kids').map((l) => (
                      <button key={l.slug} type="button" onClick={() => { setQuery(''); setAgeFilter(ageFilter === parseInt(l.slug) ? null : parseInt(l.slug)); }}
                        className={`rounded-full border px-3 py-1 text-sm ${ageFilter === parseInt(l.slug) ? 'border-keeper-gold bg-keeper-gold-wash text-keeper-gold' : 'border-keeper-hair bg-white/70 text-keeper-body'}`}>{l.slug}</button>
                    ))}
                    <input value={query}
                      onChange={(e) => { const v = e.target.value.slice(0, 40); setQuery(v); setAgeFilter(/^\d{1,3}$/.test(v.trim()) ? parseInt(v.trim()) : null); }}
                      placeholder="Search — ibiza, 6, fishing…"
                      className="h-8 w-44 rounded-full border border-keeper-hair bg-white/70 px-3 text-sm text-keeper-body outline-none placeholder:text-keeper-meta focus:border-keeper-gold" />
                  </div>
                )}
              </div>
            )}

            {/* THE WALL — cards that look like cards. 2-up on every
                phone (md, not sm, is the 3-up breakpoint — larger
                phones were crossing 640px and getting cramped 3-up). */}
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4">
              {data.cards
                .filter((c) => (styleFilter === null || (c.tone ?? '').toLowerCase() === styleFilter)
                  && (ageFilter === null || c.age === ageFilter || (c.age != null && c.age_max != null && ageFilter >= c.age && ageFilter <= c.age_max))
                  && (ageFilter !== null || !query.trim() || /^\d{1,3}$/.test(query.trim())
                    || `${c.front_text} ${c.interest ?? ''} ${c.recipient ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())))
                .map((c) => (
                <Link key={c.id} href={`/card/${c.id}`} className="group block">
                  <AjarTile imageUrl={c.imageUrl} alt={c.front_text} />
                  <div className="mt-3 px-0.5">
                    <p className="line-clamp-2 min-h-[2.4em] text-[13px] font-medium leading-snug text-keeper-body">“{c.front_text}”</p>
                    <div className="mt-1.5 flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-keeper-ink">{gbp(cardPriceGBP('rack'))}</span>
                      <span className="text-[11px] text-keeper-meta transition-colors group-hover:text-keeper-gold">
                        Personalise inside →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Aisle rails — the lattice. */}
            {!aisle && (
              <div className="mt-16 space-y-6 border-t border-keeper-hair pt-10">
                {[
                  { heading: 'Shop by age', links: data.aisles.ages },
                  { heading: 'Shop by recipient', links: data.aisles.recipients },
                  { heading: 'Shop by style', links: data.aisles.styles },
                  { heading: 'Shop by their thing', links: data.aisles.interests ?? [] },
                ].filter((r) => r.links.length > 0).map((r) => (
                  <div key={r.heading}>
                    <h2 className="font-display text-base font-bold text-keeper-ink">{r.heading}</h2>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {r.links.map((l) => (
                        <Link key={l.slug} href={`/cards/${occasion}/${l.slug}`}
                          className="rounded-full border border-keeper-hair bg-white/70 px-3.5 py-1.5 text-sm capitalize text-keeper-body transition-colors hover:border-keeper-gold hover:text-keeper-gold">
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

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
          </>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
