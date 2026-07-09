// client/src/components/studio/new-card-tile.tsx
//
// The first tile in the My Cards grid — a cream-washed tile with a
// subtle brand gradient on hover that starts a new card. Always
// rendered first so the CTA is obvious.
//
// Warmer than the dashed-border stone treatment — the grid is a
// greeting-card gallery, not a Kanban board. Cream surface + coral
// accent on the icon nudges it toward celebratory.

import { Link } from 'wouter';
import { Wand2 } from 'lucide-react';

// Green (cta) — "New card" is a decided super-important moment (start of
// the value loop), so the primary grid CTA wears the go colour like the
// sidebar/gallery New-card buttons. Green tint at rest, deeper on hover.
// No emoji — vector icon only per the brand direction.
export function NewCardTile() {
  return (
    <Link
      href="/studio/new-card"
      className="group relative flex flex-col items-center justify-center aspect-square rounded-2xl bg-cta-light border-2 border-cta text-cta-hover hover:bg-cta hover:border-cta hover:text-white transition-colors overflow-hidden"
      data-testid="new-card-tile"
    >
      <div className="w-14 h-14 rounded-full bg-white border-2 border-cta flex items-center justify-center mb-3 shadow-sm transition-colors">
        <Wand2
          className="w-7 h-7 text-cta-hover transition-colors"
          strokeWidth={1.75}
        />
      </div>
      <p className="text-sm font-semibold">Start a card</p>
      <p className="text-xs opacity-75 mt-0.5">Blank canvas, 2 min</p>
    </Link>
  );
}
