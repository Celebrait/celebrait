// client/src/pages/studio-drafts.tsx
//
// Drafts surface — every card the user hasn't finished yet.
// Week 1 dashboard rebuild: splits out from the unified CardGrid on
// /studio so half-finished and finished cards stop sharing a surface.

import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Wand2, FileEdit } from 'lucide-react';
import { CardGrid, CardGridSkeleton } from '@/components/studio/card-grid';
import { bucketCards } from '@/lib/studio-card-buckets';
import type { CardGridItem } from '@shared/schema';

export default function StudioDrafts() {
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
          cards={bucketCards(data ?? []).drafts}
          showNewCardTile={false}
          emptyHint={<DraftsEmpty />}
        />
      )}
    </>
  );
}

function PageHeader() {
  return (
    <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-ink">Drafts</h1>
        <p className="text-sm text-stone-600 mt-1">
          Pick up where you left off — drafts save automatically.
        </p>
      </div>
      <Link
        href="/studio/new-card"
        className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white rounded-full px-4 py-2 text-sm font-semibold transition-colors shadow-sm flex-shrink-0"
        data-testid="drafts-new-card"
      >
        <Wand2 className="w-4 h-4" />
        <span className="hidden sm:inline">New card</span>
      </Link>
    </div>
  );
}

function DraftsEmpty() {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-14 h-14 rounded-full bg-brand-muted text-brand-dark flex items-center justify-center mx-auto mb-4">
        <FileEdit className="w-6 h-6" />
      </div>
      <p className="text-base font-semibold text-ink mb-1">No drafts right now</p>
      <p className="text-sm text-stone-600 mb-6 max-w-sm mx-auto">
        When you start a card and step away, it'll live here until you come back.
      </p>
      <Link
        href="/studio/new-card"
        className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white rounded-full px-5 py-2.5 text-sm font-semibold transition-colors shadow-sm"
        data-testid="drafts-empty-start-card"
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
      <p className="text-sm text-red-600 mb-2">Couldn't load your drafts.</p>
      <p className="text-xs text-stone-500">{message}</p>
    </div>
  );
}
