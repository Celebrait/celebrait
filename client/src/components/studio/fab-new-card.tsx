// client/src/components/studio/fab-new-card.tsx
//
// Floating action button. Always-visible shortcut to start a new card
// from anywhere in the Studio. Hidden on the card maker itself (where
// the user is already making a card) — StudioLayout handles the route
// check.

import { Link } from 'wouter';
import { Plus } from 'lucide-react';

export function FabNewCard() {
  return (
    <Link
      href="/studio/new-card"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 pl-4 pr-5 h-14 rounded-full bg-cta hover:bg-cta-hover text-cta-foreground shadow-lg shadow-cta/30 hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
      data-testid="fab-new-card"
    >
      <Plus className="w-5 h-5" strokeWidth={2.5} />
      <span className="text-sm font-semibold">New card</span>
    </Link>
  );
}
