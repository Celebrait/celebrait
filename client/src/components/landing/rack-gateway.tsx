// client/src/components/landing/rack-gateway.tsx — THE TWO RACKS
//
// UX_LP2.md §2 row 2: "Or straight off the shelf." The catalogue is the
// SEO front door and the proof of quality in one — real cards, live
// from the API, one glance below the bar. Two big doors (Christmas,
// Birthday), each with a rail of four real fronts and the aisle count.
// Airbnb, never Skyscanner: the shelf is always browsable beneath the
// search, never an empty page gated by a form.

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import { cardPriceGBP } from '@shared/pricing';

interface RackCard { id: number; front_text: string; imageUrl: string }
interface RackPayload { count: number; cards: RackCard[]; aisles?: { ages?: Array<{ slug: string }> } }

const DOORS = [
  { slug: 'christmas', label: 'Christmas cards', sub: 'the works do, the dinner, the kids, the cheeseboard' },
  { slug: 'birthday', label: 'Birthday cards', sub: '18th to 90th — every milestone, every mate' },
] as const;

function Door({ slug, label, sub }: (typeof DOORS)[number]) {
  const [data, setData] = useState<RackPayload | null>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    fetch(`/api/catalogue/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setGone(true));
  }, [slug]);
  if (gone) return null;
  const cards = (data?.cards ?? []).slice(0, 4);
  const kids = data?.aisles?.ages?.some((a) => a.slug === 'kids');
  return (
    <div className="rounded-2xl border border-keeper-hair bg-white/70 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-keeper-ink">{label}</h3>
          <p className="text-[13px] text-keeper-meta">{sub}</p>
        </div>
        <Link href={`/cards/${slug}`} className="whitespace-nowrap text-sm font-semibold text-brand-dark hover:underline">
          Browse all{data ? ` ${data.count}` : ''} →
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        {cards.length
          ? cards.map((c) => (
              <Link key={c.id} href={`/card/${c.id}`} className="group block">
                <AjarTile imageUrl={c.imageUrl} alt={c.front_text} />
              </Link>
            ))
          : Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-square animate-pulse rounded-lg bg-keeper-hair/50" />)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-keeper-meta">
        <span>from <b className="text-keeper-ink">£{(cardPriceGBP('rack') / 100).toFixed(2)}</b> · printed today if you order by 3pm</span>
        {kids && (
          <Link href={`/cards/${slug}/kids`} className="rounded-full border border-keeper-hair bg-white px-2.5 py-0.5 text-[12px] font-medium text-keeper-body hover:border-brand-dark">
            Kids
          </Link>
        )}
      </div>
    </div>
  );
}

export function RackGateway() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[clamp(26px,3.6vw,36px)] font-bold leading-[1.08] tracking-[-0.015em] text-keeper-ink">
          Or straight off the shelf
        </h2>
        <p className="text-sm text-keeper-meta">every card here began as somebody's brief — send it as it is, or make it theirs</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {DOORS.map((d) => <Door key={d.slug} {...d} />)}
      </div>
    </section>
  );
}
