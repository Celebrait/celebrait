// client/src/components/studio/new-card-tile.tsx
//
// The first tile in the My Cards grid — a dashed-border "+" that starts
// a new card at /studio/new-card. Always rendered first so the CTA is
// obvious even when the library already has cards.

import { Link } from 'wouter';
import { Plus } from 'lucide-react';

export function NewCardTile() {
  return (
    <Link
      href="/studio/new-card"
      className="group flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/40 hover:border-brand hover:bg-brand-muted/40 transition-colors text-stone-500 hover:text-brand"
      data-testid="new-card-tile"
    >
      <div className="w-14 h-14 rounded-full bg-white border border-stone-200 group-hover:border-brand flex items-center justify-center mb-3 transition-colors">
        <Plus className="w-7 h-7" strokeWidth={2} />
      </div>
      <p className="text-sm font-medium">New card</p>
      <p className="text-xs text-stone-400 mt-0.5">Start from scratch</p>
    </Link>
  );
}
