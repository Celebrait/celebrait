// client/src/components/catalogue/card-drift.tsx — THE DRIFTING WALL
//
// A slow sideways drift of real ajar cards (CSS, not WebGL — one canvas
// per card melts phones; the tile is already CSS 3D). Pauses on hover,
// static and swipeable under reduced motion, every card tappable.
//
// WHAT IT SHOWS (Aidan 2026-09-03): the hand-picked CAROUSEL cards
// first — templates tagged 'carousel' by an admin, "crucial" interest
// cards that belong on every wall — then a fresh shuffle of the
// birthday rack to fill up to `size`. Drop it on any page.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import type { CatalogueCard } from '@/components/catalogue/rack-wall';

interface CardDriftProps {
  /** How many distinct cards the loop carries (duplicated once for the seamless wrap). */
  size?: number;
  /** Which rack pads the picks. */
  padFrom?: string;
  /** Extra classes on the outer (masked) wrapper. */
  className?: string;
}

const shuffle = <T,>(a: T[]): T[] => { const p = [...a]; for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return p; };

export function useDriftCards(size = 20, padFrom = 'birthday'): CatalogueCard[] {
  const [cards, setCards] = useState<CatalogueCard[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/catalogue/featured').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/catalogue/${padFrom}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([f, b]) => {
      if (cancelled) return;
      const picks: CatalogueCard[] = (f?.cards ?? []) as CatalogueCard[];
      const seen = new Set(picks.map((c) => c.id));
      const pad = shuffle(((b?.cards ?? []) as CatalogueCard[]).filter((c) => !seen.has(c.id)));
      setCards([...picks, ...pad].slice(0, Math.max(size, picks.length)));
    });
    return () => { cancelled = true; };
  }, [size, padFrom]);
  return cards;
}

export function CardDrift({ size = 20, padFrom = 'birthday', className = '' }: CardDriftProps) {
  const cards = useDriftCards(size, padFrom);
  const row = useMemo(() => [...cards, ...cards], [cards]);
  if (!cards.length) {
    return (
      <div className={`flex gap-4 overflow-hidden ${className}`}>
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-square w-[150px] shrink-0 animate-pulse rounded-lg bg-keeper-hair/50 sm:w-[190px]" />)}
      </div>
    );
  }
  return (
    <div className={`door-drift-mask -mb-6 overflow-hidden ${className}`}>
      <style>{`
        @keyframes door-drift { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .door-drift { animation: door-drift ${Math.max(40, cards.length * 4)}s linear infinite; width: max-content; }
        .door-drift:hover, .door-drift:focus-within { animation-play-state: paused; }
        .door-drift-mask { -webkit-mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent); mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent); }
        @media (prefers-reduced-motion: reduce) { .door-drift { animation: none; width: auto; overflow-x: auto; } }
      `}</style>
      {/* pb-10: the tiles' layered shadows need ~40px below to fade; the
          container keeps all of it (the -mb-6 lives on the container). */}
      <div className="door-drift flex gap-4 pb-10 pt-4">
        {row.map((c, i) => (
          <Link key={`${c.id}-${i}`} href={`/card/${c.id}`} className="group block w-[150px] shrink-0 sm:w-[190px]" aria-hidden={i >= cards.length ? true : undefined} tabIndex={i >= cards.length ? -1 : undefined}>
            <AjarTile imageUrl={c.imageUrl} alt={c.front_text} eager={i < 10} />
          </Link>
        ))}
      </div>
    </div>
  );
}
