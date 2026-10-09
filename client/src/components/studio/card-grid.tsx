// client/src/components/studio/card-grid.tsx
//
// Renders a grid of the user's cards. Used by:
//   - /studio (Home) — shows the NewCardTile first, unfiltered list
//     (historical behaviour, kept as the default)
//   - /studio/drafts — filtered to drafts, NewCardTile hidden
//   - /studio/sent — filtered to paid/completed, NewCardTile hidden
//
// Week 1 dashboard rebuild (2026-04-24): added `showNewCardTile` and
// `emptyHint` props so the same grid can power multiple surfaces with
// surface-appropriate empty states. The unified-grid decision from
// Sprint 2 ("no tabs by status") is superseded by the sidebar split.

import type { ReactNode } from 'react';
import { CardThumbnail } from './card-thumbnail';
import type { CardGridItem } from '@shared/schema';

interface CardGridProps {
  cards: CardGridItem[];
  /** Cover-card id → family size (from collapseFamilies). Badges the
   *  tile with "N takes" when its family has more than one. */
  takeCounts?: Map<number, number>;
  /** Render the dashed/violet "Start a card" tile as the first cell.
   *  Default true — matches original Sprint 2 behaviour on /studio. */
  /** Content shown when the grid has no cards AND no new-card tile.
   *  (Grids never render a new-card tile — removed 2026-08-01.)
   *  truly empty in that mode). */
  emptyHint?: ReactNode;
}

export function CardGrid({
  cards,
  takeCounts,
  emptyHint,
}: CardGridProps) {
  // Newest first. The API already returns them unordered; sort
  // client-side so we don't depend on server ordering guarantees.
  const sorted = [...cards].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });

  // Empty state for filtered surfaces (Drafts/Sent) — no new-card tile
  // here by design; use the sidebar's pinned CTA for that. emptyHint
  // is the caller's responsibility so the copy matches the surface.
  if (sorted.length === 0) {
    return <>{emptyHint ?? null}</>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {sorted.map((card) => (
        <CardThumbnail
          key={card.id}
          card={card}
          takesCount={takeCounts?.get(card.id)}
        />
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
