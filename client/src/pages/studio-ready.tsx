// client/src/pages/studio-ready.tsx
//
// Ready surface — cards that have finished generating but haven't been
// purchased yet. Split out from Sent 2026-04-24 so the two states
// stop sharing a page (Kevin: "Sent is holding unpurchased cards
// atm — should be another tab").
//
// Tile look matches the other filtered pages — a small "Ready to send"
// chip on the thumbnail (see card-thumbnail.tsx) is the only visual
// difference. Click still goes through the normal card-view route
// where the Buy CTA lives.

import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Wand2, Package } from 'lucide-react';
import { CardGrid, CardGridSkeleton } from '@/components/studio/card-grid';
import { bucketCards } from '@/lib/studio-card-buckets';
import type { CardGridItem } from '@shared/schema';

export default function StudioReady() {
  const { data, isLoading, error } = useQuery<CardGridItem[]>({
    queryKey: ['/api/user/cards'],
  });

  return (
    <>
      <PageHeader />

      {isLoading ? (
        <CardGridSkeleton />
      ) : error ? (
        <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} />
      ) : (
        <CardGrid
          cards={bucketCards(data ?? []).ready}
          showNewCardTile={false}
          emptyHint={<ReadyEmpty />}
        />
      )}
    </>
  );
}

function PageHeader() {
  return (
    <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-ink">Ready</h1>
        <p className="text-sm text-stone-600 mt-1">
          Finished cards, waiting for you to send them.
        </p>
      </div>
      <Link
        href="/studio/new-card"
        className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white rounded-full px-4 py-2 text-sm font-semibold transition-colors shadow-sm flex-shrink-0"
        data-testid="ready-new-card"
      >
        <Wand2 className="w-4 h-4" />
        <span className="hidden sm:inline">New card</span>
      </Link>
    </div>
  );
}

function ReadyEmpty() {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-14 h-14 rounded-full bg-brand-muted text-brand-dark flex items-center justify-center mx-auto mb-4">
        <Package className="w-6 h-6" />
      </div>
      <p className="text-base font-semibold text-ink mb-1">No cards waiting</p>
      <p className="text-sm text-stone-600 mb-6 max-w-sm mx-auto">
        Cards that are finished but not yet sent will show here — ready
        for you to choose digital, print, or both.
      </p>
      <Link
        href="/studio/new-card"
        className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white rounded-full px-5 py-2.5 text-sm font-semibold transition-colors shadow-sm"
        data-testid="ready-empty-start-card"
      >
        <Wand2 className="w-4 h-4" />
        Start a card
      </Link>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-12">
      <p className="text-sm text-red-600 mb-2">Couldn't load your cards.</p>
      <p className="text-xs text-stone-500">{message}</p>
    </div>
  );
}
