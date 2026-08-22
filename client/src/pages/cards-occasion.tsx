// client/src/pages/cards-occasion.tsx
//
// THE OCCASION PAGE — the uniform template from UX_PLATFORM_IA.md §4,
// serving both the hub (/cards/birthday) and every aisle
// (/cards/birthday/18th, /for-mum, /funny) from one component. Public,
// SEO-first: cards lead, the quick maker is the twist, the photo route
// is the step-up. Card-wall discipline from the Keeper blueprint:
// the cards are the design; the chrome stays out of the way.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { Loader2, Sparkles } from 'lucide-react';
import { useSeo } from '@/lib/use-seo';

interface CatalogueCard {
  id: number; front_text: string; tone?: string | null; age?: number | null;
  recipient?: string | null; editable?: boolean; imageUrl: string;
}
interface AisleLink { slug: string; label: string; count: number }
interface Payload {
  occasion: string; aisle: string | null; count: number;
  aisles: { ages: AisleLink[]; recipients: AisleLink[]; styles: AisleLink[] };
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

  useEffect(() => {
    setState('loading');
    fetch(`/api/catalogue/${occasion}${aisle ? `?aisle=${encodeURIComponent(aisle)}` : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { setData(j); setState('ok'); })
      .catch(() => setState('missing'));
  }, [occasion, aisle]);

  const title = aisleTitle(occasion, aisle);
  // useSeo takes the PATH — title/description come from the shared
  // grammar in shared/seo.ts, so crawler injection and the SPA agree.
  useSeo(`/cards/${occasion}${aisle ? `/${aisle}` : ''}`);

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-300" /></div>;
  }
  if (state === 'missing' || !data) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold text-stone-800">Nothing on this shelf yet</h1>
        <p className="mt-3 text-stone-500">We're stocking it — but we can make theirs right now, from one thing they love.</p>
        <Link href="/studio" className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-medium text-white">Make their card</Link>
      </div>
    );
  }

  const rails: Array<{ heading: string; links: AisleLink[] }> = [
    { heading: 'By age', links: data.aisles.ages },
    { heading: 'By recipient', links: data.aisles.recipients },
    { heading: 'By style', links: data.aisles.styles },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Breadcrumb — humans and crawlers both */}
      <nav className="text-xs text-stone-400">
        <Link href="/" className="hover:text-stone-600">Home</Link>
        <span className="mx-1.5">/</span>
        {aisle
          ? <><Link href={`/cards/${occasion}`} className="hover:text-stone-600">{OCCASION_LABELS[occasion] ?? occasion} cards</Link><span className="mx-1.5">/</span><span className="text-stone-600">{title}</span></>
          : <span className="text-stone-600">{OCCASION_LABELS[occasion] ?? occasion} cards</span>}
      </nav>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900">{title}</h1>
      <p className="mt-2 max-w-2xl text-stone-500">
        Every card here was made for a real brief — pick one and send it, or make it theirs with your own words.
      </p>

      {/* The maker invitation — a slim band, not a hero. The page sells
          cards first; the maker is the twist nobody else has. */}
      <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-brand/20 bg-brand-muted/20 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-medium text-stone-800">Tell us one thing they love — we'll make three just for them.</p>
          <p className="text-sm text-stone-500">In and out in minutes. 'Man United' beats 'football'.</p>
        </div>
        <Link href="/studio" className="flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white">
          <Sparkles className="h-4 w-4" /> Make their card
        </Link>
      </div>

      {/* The card wall */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {data.cards.map((c) => (
          <div key={c.id} className="group overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="aspect-square overflow-hidden bg-stone-50">
              <img src={c.imageUrl} alt={c.front_text} loading="lazy" crossOrigin="anonymous"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            </div>
            <div className="p-3">
              <p className="line-clamp-2 min-h-[2.5em] text-xs font-medium leading-snug text-stone-700">“{c.front_text}”</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-800">£8.99</span>
                <Link href="/studio" className="rounded-full border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-600 transition-colors hover:border-brand hover:text-brand-dark">
                  {c.editable === false ? 'Personalise inside' : 'Make it theirs'}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Aisle rails — the SEO lattice */}
      {!aisle && rails.some((r) => r.links.length > 0) && (
        <div className="mt-12 space-y-6">
          {rails.filter((r) => r.links.length > 0).map((r) => (
            <div key={r.heading}>
              <h2 className="text-sm font-semibold text-stone-700">{r.heading}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {r.links.map((l) => (
                  <Link key={l.slug} href={`/cards/${occasion}/${l.slug}`}
                    className="rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-sm capitalize text-stone-600 transition-colors hover:border-brand hover:text-brand-dark">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* The step-up — the signature, never buried entirely */}
      <div className="mt-12 rounded-2xl border border-stone-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold text-stone-800">Or put them in the picture</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
          The one they keep forever — made from their photo, in any scene you can describe.
        </p>
        <Link href="/" className="mt-4 inline-block rounded-full border border-brand px-5 py-2.5 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-muted/30">
          See how it works
        </Link>
      </div>
    </div>
  );
}
