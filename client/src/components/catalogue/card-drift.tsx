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

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import type { CatalogueCard } from '@/components/catalogue/rack-wall';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

// three.js only loads when a card is actually opened.
const Card3DViewer = lazy(() => import('@/components/card-3d-viewer').then((m) => ({ default: m.Card3DViewer })));

interface CardDriftProps {
  /** How many distinct cards the loop carries (duplicated once for the seamless wrap). */
  size?: number;
  /** Which rack pads the picks; null = the admin's carousel picks ONLY
   *  (the gate, 2026-09-06 — "hand selected cards from the admin"). */
  padFrom?: string | null;
  /** Extra classes on the outer (masked) wrapper. */
  className?: string;
  /** Tap opens the card in place (3D, ajar → tap to open) instead of
   *  leaving the page (the gate, Aidan 2026-09-06). */
  peek?: boolean;
  /** Cards the page already holds — skips this component's own fetch. */
  cards?: CatalogueCard[];
}

const shuffle = <T,>(a: T[]): T[] => { const p = [...a]; for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return p; };

export function useDriftCards(size = 20, padFrom: string | null = 'birthday', enabled = true): { cards: CatalogueCard[]; loaded: boolean } {
  const [cards, setCards] = useState<CatalogueCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.all([
      fetch('/api/catalogue/featured').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      padFrom ? fetch(`/api/catalogue/${padFrom}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null),
    ]).then(([f, b]) => {
      if (cancelled) return;
      const picks: CatalogueCard[] = (f?.cards ?? []) as CatalogueCard[];
      if (!padFrom) {
        // Picks only. A short hand-picked set is repeated so the loop
        // is still wider than the viewport before it's mirrored.
        let list = picks;
        while (list.length && list.length < 12) list = [...list, ...picks];
        setCards(list);
      } else {
        const seen = new Set(picks.map((c) => c.id));
        const pad = shuffle(((b?.cards ?? []) as CatalogueCard[]).filter((c) => !seen.has(c.id)));
        setCards([...picks, ...pad].slice(0, Math.max(size, picks.length)));
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [size, padFrom, enabled]);
  return { cards, loaded };
}

export function CardDrift({ size = 20, padFrom = 'birthday', className = '', peek = false, cards: given }: CardDriftProps) {
  const own = useDriftCards(size, given ? null : padFrom, !given);
  const cards = given ?? own.cards;
  const loaded = given ? true : own.loaded;
  const [peeking, setPeeking] = useState<CatalogueCard | null>(null);
  const row = useMemo(() => [...cards, ...cards], [cards]);
  // Nothing picked yet → render nothing at all (the page hides the block).
  if (loaded && !cards.length) return null;
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
          peek ? (
            <button key={`${c.id}-${i}`} type="button" onClick={() => setPeeking(c)} className="group block w-[150px] shrink-0 text-left sm:w-[190px]" aria-hidden={i >= cards.length ? true : undefined} tabIndex={i >= cards.length ? -1 : undefined} aria-label={`Open “${c.front_text}”`}>
              <AjarTile imageUrl={c.imageUrl} alt={c.front_text} eager={i < 10} />
            </button>
          ) : (
          <Link key={`${c.id}-${i}`} href={c.published === false ? '/photo' : `/card/${c.id}`} className="group block w-[150px] shrink-0 sm:w-[190px]" aria-hidden={i >= cards.length ? true : undefined} tabIndex={i >= cards.length ? -1 : undefined}>
            <AjarTile imageUrl={c.imageUrl} alt={c.front_text} eager={i < 10} />
          </Link>
          )
        ))}
      </div>
      {peek && <CardPeek card={peeking} onClose={() => setPeeking(null)} />}
    </div>
  );
}

/** The lightbox: the card ajar, tap to open, one way onward. */
function CardPeek({ card, onClose }: { card: CatalogueCard | null; onClose: () => void }) {
  const showcase = card?.published === false;
  return (
    <Dialog open={!!card} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        {card && (
          <div>
            <DialogTitle className="sr-only">{card.front_text}</DialogTitle>
            {/* Square, exactly as the card page frames the same viewer. */}
            <div className="aspect-square w-full bg-keeper-paper">
              <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>}>
                <Card3DViewer frontImageUrl={card.imageUrl} insideImageUrl={card.insideImageUrl ?? null} className="h-full w-full" framingMargin={1.3} />
              </Suspense>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <p className="text-[12.5px] text-keeper-meta">{card.insideImageUrl ? 'Tap the card to look inside' : 'Tap the card to turn it'}</p>
              {showcase ? (
                <Link href="/photo/make" className="inline-flex items-center rounded-full bg-go px-4 py-2 text-[13px] font-semibold text-go-foreground hover:bg-go-hover">Make one from a photo</Link>
              ) : (
                <Link href={`/card/${card.id}`} className="inline-flex items-center rounded-full bg-go px-4 py-2 text-[13px] font-semibold text-go-foreground hover:bg-go-hover">See this card</Link>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
