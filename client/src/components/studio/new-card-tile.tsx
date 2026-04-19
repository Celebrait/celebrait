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
import { Sparkles } from 'lucide-react';

export function NewCardTile() {
  return (
    <Link
      href="/studio/new-card"
      className="group relative flex flex-col items-center justify-center aspect-square rounded-2xl bg-surface-cream border border-accent-coral-light hover:border-brand hover:bg-brand-muted transition-colors text-stone-600 hover:text-brand overflow-hidden"
      data-testid="new-card-tile"
    >
      {/* Subtle shimmering accent dot in the corner — decorative only. */}
      <span className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-accent-amber opacity-70 group-hover:opacity-100 transition-opacity" />
      <div className="w-14 h-14 rounded-full bg-white border border-accent-coral-light group-hover:border-brand flex items-center justify-center mb-3 shadow-sm transition-colors">
        <Sparkles className="w-7 h-7 text-accent-coral-dark group-hover:text-brand" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-semibold text-ink">Start a card</p>
      <p className="text-xs text-stone-500 mt-0.5">Blank canvas, 2 min</p>
    </Link>
  );
}
