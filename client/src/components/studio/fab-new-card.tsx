// client/src/components/studio/fab-new-card.tsx
//
// Floating action button — MOBILE ONLY.
// Desktop has the pinned "+ New card" in the sidebar, so the FAB there
// was redundant and competed with in-page CTAs (Buy on the viewer,
// Start a card on empty states). Hidden at ≥sm; shown only at <sm
// where the sidebar collapses into a hamburger sheet.
//
// Still hidden entirely on the card maker + viewer — StudioLayout owns
// those route checks via HIDE_FAB_ON.

import { Link } from 'wouter';
import { Plus } from 'lucide-react';

export function FabNewCard() {
  return (
    <Link
      href="/studio/new-card"
      className="fixed bottom-6 right-6 z-40 sm:hidden flex items-center gap-2 pl-4 pr-5 h-14 rounded-full bg-go hover:bg-go-hover text-go-foreground shadow-lg shadow-cta/30 hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
      data-testid="fab-new-card"
      data-hint="new-card"
    >
      <Plus className="w-5 h-5" strokeWidth={2.5} />
      <span className="text-sm font-semibold">New card</span>
    </Link>
  );
}
