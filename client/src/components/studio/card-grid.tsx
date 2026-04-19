// client/src/components/studio/card-grid.tsx
//
// Renders the user's card library. The "New card" tile is always the
// first cell so the CTA is prominent regardless of how many cards the
// user has. Unified grid (no tabs by status) — decided in Sprint 2.

import { CardThumbnail } from './card-thumbnail';
import { NewCardTile } from './new-card-tile';
import type { CardGridItem } from '@shared/schema';

interface CardGridProps {
  cards: CardGridItem[];
}

export function CardGrid({ cards }: CardGridProps) {
  // Newest first. The API already returns them unordered; sort
  // client-side so we don't depend on server ordering guarantees.
  const sorted = [...cards].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      <NewCardTile />
      {sorted.map((card) => (
        <CardThumbnail key={card.id} card={card} />
      ))}
    </div>
  );
}

export function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[1/1.15] rounded-2xl bg-stone-100 animate-pulse"
        />
      ))}
    </div>
  );
}
