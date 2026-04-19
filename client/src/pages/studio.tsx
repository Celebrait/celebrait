// client/src/pages/studio.tsx
//
// Studio home — "My cards". Shows a grid of the user's cards (newest
// first) with a dashed "New card" tile as the first cell. Empty state
// is rare because users typically arrive from the landing-page
// free-generator funnel already owning a card.

import { useQuery } from '@tanstack/react-query';
import { CardGrid, CardGridSkeleton } from '@/components/studio/card-grid';
import type { CardGridItem } from '@shared/schema';

export default function StudioHome() {
  const { data, isLoading, error } = useQuery<CardGridItem[]>({
    queryKey: ['/api/user/cards'],
  });

  if (isLoading) return <CardGridSkeleton />;

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <p className="text-sm text-red-600 mb-2">Couldn't load your cards.</p>
        <p className="text-xs text-stone-500">
          {error instanceof Error ? error.message : 'Please try again.'}
        </p>
      </div>
    );
  }

  // No separate empty state — the CardGrid always renders the dashed
  // "New card" tile as the first cell, so a zero-card library still
  // has a visible CTA. Keeps the UX consistent whether the user has
  // 0 cards or 50.
  return <CardGrid cards={data ?? []} />;
}
