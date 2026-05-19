// client/src/pages/studio-give.tsx
//
// The Giving Moment — its own screen. Route: /studio/card/:id/give.
//
// Reached from the review step's reveal ("Send this card"), written-
// inside cards only. The sender has JUST watched the 3D reveal, so
// this screen does NOT re-show the card big — it leads with the
// decision (how should it reach them?) and offers a small "take
// another look" link that pops the card in a modal for anyone who
// wants to refresh their memory. See next_delivery_destination_usp.md.
//
// Flow: review/reveal  →  /studio/card/:id/give  →  /checkout/:id

import { useState } from 'react';
import { useRoute, Redirect } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Eye } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GivingMoment } from '@/components/studio/giving-moment';
import type { CardDraftState } from '@shared/schema';

interface DraftResponse {
  id: number;
  status: string | null;
  frontImageUrl: string | null;
  insideImageUrl: string | null;
  /** The draft state (conversationData). The GET endpoint always
   *  returns a defaulted object even when the column is null. */
  state: CardDraftState;
}

export default function StudioGivePage() {
  const [, params] = useRoute<{ id: string }>('/studio/card/:id/give');
  const cardId = params ? parseInt(params.id, 10) : NaN;

  const [viewerOpen, setViewerOpen] = useState(false);

  const { data: card, isLoading } = useQuery<DraftResponse>({
    queryKey: [`/api/studio/drafts/${cardId}`],
    enabled: Number.isFinite(cardId),
  });

  if (!Number.isFinite(cardId)) return <Redirect to="/studio" />;
  if (isLoading) return <CenterSpinner />;

  // Guard — the giving screen only makes sense once the card is
  // generated. Anyone who deep-links here with a draft/in-progress
  // card is bounced back into the maker rather than shown an empty
  // shell.
  if (!card || card.status !== 'completed' || !card.frontImageUrl) {
    return <Redirect to={`/studio/card/${cardId}/edit`} />;
  }

  const state = card.state;
  const recipientName = state.recipient?.name?.trim() ?? '';
  const insideMode = state.inside?.mode ?? null;

  // A blank inside has no giving choice to make — it can only be
  // printed and posted to the sender. Skip the Giving Moment and go
  // straight to checkout. The review reveal already routes blank →
  // checkout; this guard covers a direct visit / bookmark of /give.
  if (insideMode === 'blank') {
    return <Redirect to={`/checkout/${cardId}?product=print`} />;
  }

  // Persist the Giving Moment's choice onto the draft. The PATCH
  // endpoint replaces conversationData wholesale, so send the full
  // state with `delivery` merged in. Awaited by <GivingMoment> before
  // it navigates to checkout, so the choice survives a refresh.
  const saveDelivery = async (
    delivery: NonNullable<CardDraftState['delivery']>,
  ): Promise<void> => {
    const merged: CardDraftState = { ...state, delivery };
    await apiRequest('PATCH', `/api/studio/drafts/${cardId}`, {
      state: merged,
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-10">
      {/* Compact card reference — a small front thumbnail + a "take
          another look" trigger. The sender just saw the full 3D
          reveal, so the card isn't re-shown big here; this is just a
          quiet memory-refresh affordance that pops the modal below.
          The decision (rendered by <GivingMoment>) stays above the
          fold. */}
      <button
        type="button"
        onClick={() => setViewerOpen(true)}
        className="mb-6 flex items-center gap-3 group"
        data-testid="give-view-card"
      >
        <img
          src={card.frontImageUrl}
          alt="Your card"
          className="w-12 h-12 rounded-md object-cover border border-stone-200 shrink-0"
        />
        <span className="text-left">
          <span className="block text-sm font-medium text-ink">
            {recipientName ? `${recipientName}'s card` : 'Your card'}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-brand group-hover:text-brand-dark">
            <Eye className="w-3 h-3" strokeWidth={2} />
            Take another look
          </span>
        </span>
      </button>

      <GivingMoment
        cardId={cardId}
        recipientName={recipientName}
        saveDelivery={saveDelivery}
      />

      {/* Memory-refresh modal — front + inside flat, on demand. */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-left">
              {recipientName ? `${recipientName}'s card` : 'Your card'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-1">
            <CardFace url={card.frontImageUrl} label="Front" />
            <CardFace url={card.insideImageUrl} label="Inside" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Flat card face — front or inside ─────────────────────────────────
// The give page only renders for written-inside cards (blank inside is
// redirected away above), so there's always an inside image to show.
function CardFace({ url, label }: { url: string | null; label: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <div className="aspect-square rounded-xl overflow-hidden border border-stone-200 bg-stone-50 flex items-center justify-center">
        {url ? (
          <img
            src={url}
            alt={`Card ${label.toLowerCase()}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <p className="text-xs text-stone-400">—</p>
        )}
      </div>
    </div>
  );
}

function CenterSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 text-brand animate-spin" strokeWidth={1.75} />
    </div>
  );
}
