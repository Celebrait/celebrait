// client/src/pages/studio-give.tsx
//
// The Giving Moment — its own screen. Route: /studio/card/:id/give.
//
// Reached from the review step's reveal ("Send this card"). The 3D
// card reveal is its own untouched moment on the previous screen; this
// screen shows the finished card FLAT (front + inside, side by side)
// above the delivery questions, and gives the "how does this reach
// them?" decision the room it deserves. See
// next_delivery_destination_usp.md.
//
// Flow: review/reveal  →  /studio/card/:id/give  →  /checkout/:id

import { useRoute, Redirect } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
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
      {/* The finished card, flat — front + inside side by side. The
          3D reveal already had its moment on the previous screen;
          here the card is simply shown as the thing being given,
          calm and complete, while the decision is made below. */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-3 text-center">
          {recipientName ? `${recipientName}'s card` : 'Your card'}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <CardFace url={card.frontImageUrl} label="Front" />
          <CardFace url={card.insideImageUrl} label="Inside" />
        </div>
      </div>

      <GivingMoment
        cardId={cardId}
        recipientName={recipientName}
        saveDelivery={saveDelivery}
      />
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
