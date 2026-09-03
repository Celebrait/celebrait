// client/src/components/catalogue/rack-wall.tsx — THE RACK, as a component
//
// Extracted verbatim from cards-occasion.tsx (2026-09-02) so the same
// wall — the maker band, the style/age chips + search, the AjarTile
// grid, the aisle rails — renders on the occasion pages AND on the
// doorway (Aidan: "lead with the full racks below … same layout as
// the current /cards page … so the user moves seamlessly into my
// catalogue"). One source of truth for how the shelf looks.
//
// The page-only furniture (breadcrumb, masthead, the signature band)
// stays with the page; anything the page wants after the wall comes
// in as children and renders once the wall has loaded.

import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { Loader2, Sparkles } from 'lucide-react';
import { cardPriceGBP } from '@shared/pricing';
import { AjarTile } from '@/components/catalogue/ajar-tile';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export interface CatalogueCard {
  id: number; front_text: string; tone?: string | null; age?: number | null; age_max?: number | null;
  recipient?: string | null; editable?: boolean; interest?: string | null; imageUrl: string;
}
export interface AisleLink { slug: string; label: string; count: number }
export interface RackPayload {
  occasion: string; aisle: string | null; count: number;
  aisles: { ages: AisleLink[]; recipients: AisleLink[]; styles: AisleLink[]; interests?: AisleLink[] };
  cards: CatalogueCard[];
}

interface RackWallProps {
  occasion: string;
  aisle?: string | null;
  /** Called with the hub's card count once loaded (the doorway's chips show it). */
  onLoaded?: (payload: RackPayload) => void;
  children?: ReactNode;
}

export function RackWall({ occasion, aisle = null, onLoaded, children }: RackWallProps) {
  const [data, setData] = useState<RackPayload | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  /** In-page narrowing (Aidan: "Do we need Funny, Warm, Rude filters?
   *  Wb ages?"). Filters the loaded wall client-side; the aisle PAGES
   *  remain the SEO surface — chips here are for the person browsing. */
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [ageFilter, setAgeFilter] = useState<number | null>(null);
  /** One search box, two behaviours: digits = an exact age (works
   *  below the aisle threshold); words = free text over the card's
   *  front AND the brief it was made from, so "ibiza" finds the Es
   *  Vedrà card whose front never says Ibiza. */
  const [query, setQuery] = useState('');

  useEffect(() => {
    setState('loading'); setStyleFilter(null); setAgeFilter(null); setQuery('');
    let cancelled = false;
    fetch(`/api/catalogue/${occasion}${aisle ? `?aisle=${encodeURIComponent(aisle)}` : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: RackPayload) => { if (cancelled) return; setData(j); setState('ok'); onLoaded?.(j); })
      .catch(() => { if (!cancelled) setState('missing'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occasion, aisle]);

  if (state === 'loading') {
    return <div className="flex justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-keeper-stone" /></div>;
  }
  if (state === 'missing' || !data) {
    return (
      <div className="py-24 text-center">
        <h2 className="font-display text-2xl font-bold text-keeper-ink">Nothing on this shelf yet</h2>
        <p className="mt-3 text-keeper-body">We're stocking it — but we can make theirs right now, from one thing they love.</p>
        <Link href="/make" className="mt-6 inline-block rounded-full bg-keeper-ink px-6 py-3 font-semibold text-keeper-paper transition-colors hover:bg-black">Make their card</Link>
      </div>
    );
  }

  const chipCls = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? 'border-keeper-gold bg-keeper-gold-wash text-keeper-gold' : 'border-keeper-hair bg-white/70 text-keeper-body'}`;

  return (
    <>
      {/* The maker band — the twist no other card site has. */}
      <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-keeper-hair bg-white/70 p-5 shadow-[0_12px_40px_-24px_rgba(33,29,25,0.3)] backdrop-blur-sm sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="font-display text-lg font-bold text-keeper-ink">Nothing quite them?</p>
          <p className="mt-0.5 text-sm text-keeper-body">Tell us one thing they love — we'll make three just for them, in minutes.</p>
        </div>
        <Link href="/make" className="flex shrink-0 items-center gap-2 rounded-full bg-keeper-ink px-5 py-2.5 text-sm font-semibold text-keeper-paper transition-colors hover:bg-black">
          <Sparkles className="h-4 w-4 text-cta" /> Make their card
        </Link>
      </div>

      {/* Filters — narrowing without leaving the wall. Only shown when
          the hub has the variety to warrant them. */}
      {!aisle && (data.aisles.styles.length > 1 || data.aisles.ages.length > 1) && (
        <div className="mt-8 space-y-2.5">
          {data.aisles.styles.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-keeper-meta">Style</span>
              <button type="button" onClick={() => setStyleFilter(null)} className={chipCls(styleFilter === null)}>All</button>
              {data.aisles.styles.map((l) => (
                <button key={l.slug} type="button" onClick={() => setStyleFilter(styleFilter === l.slug ? null : l.slug)} className={`${chipCls(styleFilter === l.slug)} capitalize`}>{l.label}</button>
              ))}
            </div>
          )}
          {/* The age row renders when ANY age aisle exists — on
              mostly-ageless occasions (christmas) the Kids door and the
              search must not vanish with the numeric chips. */}
          <div className="flex flex-wrap items-center gap-2">
            {data.aisles.ages.length > 0 && <span className="text-xs font-semibold uppercase tracking-wide text-keeper-meta">Age</span>}
            {data.aisles.ages.filter((l) => l.slug !== 'kids').length > 0 && (
              <button type="button" onClick={() => setAgeFilter(null)} className={chipCls(ageFilter === null)}>All</button>
            )}
            {data.aisles.ages.some((l) => l.slug === 'kids') && (
              <Link href={`/cards/${occasion}/kids`} className="rounded-full border border-keeper-hair bg-white/70 px-3 py-1 text-sm text-keeper-body hover:border-keeper-gold">Kids</Link>
            )}
            {data.aisles.ages.filter((l) => l.slug !== 'kids').map((l) => (
              <button key={l.slug} type="button" onClick={() => { setQuery(''); setAgeFilter(ageFilter === parseInt(l.slug) ? null : parseInt(l.slug)); }} className={chipCls(ageFilter === parseInt(l.slug))}>{l.slug}</button>
            ))}
            <input value={query}
              onChange={(e) => { const v = e.target.value.slice(0, 40); setQuery(v); setAgeFilter(/^\d{1,3}$/.test(v.trim()) ? parseInt(v.trim()) : null); }}
              placeholder="Search — ibiza, 6, fishing…"
              className="h-8 w-44 rounded-full border border-keeper-hair bg-white/70 px-3 text-sm text-keeper-body outline-none placeholder:text-keeper-meta focus:border-keeper-gold" />
          </div>
        </div>
      )}

      {/* THE WALL — cards that look like cards. 2-up on every phone. */}
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
                  <span className="text-[11px] text-keeper-meta transition-colors group-hover:text-keeper-gold">Personalise inside →</span>
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

      {children}
    </>
  );
}
