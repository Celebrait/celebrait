// client/src/pages/studio-give.tsx
//
// The Giving Moment — its own screen. Route: /studio/card/:id/give.
//
// Reached from the review step's reveal ("Send this card"), written-
// inside cards only. The sender has JUST watched the 3D reveal, so
// this screen does NOT re-show the card big — it leads with the
// decision (rendered by <GivingMoment>, a two-step flow) and offers
// a small "take another look" thumbnail (an open-card-from-above
// composition) that pops a compact interactive 3D viewer in a modal
// for anyone who wants to refresh their memory. See
// next_delivery_destination_usp.md.
//
// Flow: review/reveal  →  /studio/card/:id/give  →  /checkout/:id

import { useEffect, useState } from 'react';
import { useRoute, Redirect } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { GestureHints } from '@/components/gesture-hints';
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
  // The 3D card's open/closed state inside the modal. Reset each time
  // the modal opens so the viewer always starts closed (one tap to
  // open is the expected interaction).
  const [cardOpen, setCardOpen] = useState(false);
  useEffect(() => {
    if (!viewerOpen) setCardOpen(false);
  }, [viewerOpen]);

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
      {/* Compact card reference — a small "standing open card"
          thumbnail (front + a peek of the inside, tilted at a slight
          angle) + a "Take another look" trigger. The sender just saw
          the full 3D reveal, so the card isn't re-shown big here;
          this is just a quiet memory-refresh affordance that pops the
          3D viewer modal below. The decision (rendered by
          <GivingMoment>) stays above the fold. */}
      <button
        type="button"
        onClick={() => setViewerOpen(true)}
        className="mb-6 flex items-center gap-3 group"
        data-testid="give-view-card"
      >
        <CardStandingUpThumb
          frontUrl={card.frontImageUrl}
          insideUrl={card.insideImageUrl}
        />
        <span className="text-left">
          <span className="block text-sm font-medium text-ink">
            {recipientName ? `${recipientName}'s card` : 'Your card'}
          </span>
          <span className="text-xs text-brand group-hover:text-brand-dark">
            Take another look ↗
          </span>
        </span>
      </button>

      <GivingMoment
        cardId={cardId}
        recipientName={recipientName}
        saveDelivery={saveDelivery}
      />

      {/* Memory-refresh modal — compact 3D viewer, click to open the
          card, no zoom (it's a refresher, not a re-reveal). Hints
          render statically (alwaysVisible) so the modal's height
          doesn't change as the user interacts. Title is sr-only —
          required for Radix Dialog a11y but visually unneeded
          (the modal opens with the card front and centre). */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">
              {recipientName ? `${recipientName}'s card` : 'Your card'}
            </DialogTitle>
          </DialogHeader>
          {/* 3D stage — fixed height so the modal doesn't grow
              wildly on tall viewports. Negative-margin bleed lets the
              card rotate without clipping at the edges, same pattern
              as the public card viewer. */}
          <div className="relative h-[44vh] sm:h-[48vh] w-full">
            <div
              className="absolute inset-x-[-6vw] top-[-2vh] bottom-[-2vh]"
              style={{ filter: 'drop-shadow(0 18px 24px rgba(0,0,0,0.10))' }}
            >
              <Card3DViewer
                frontImageUrl={card.frontImageUrl}
                insideImageUrl={card.insideImageUrl}
                open={cardOpen}
                onOpenChange={setCardOpen}
                enableZoom={false}
                enableRotate
                className="w-full h-full"
              />
            </div>
          </div>
          <div className="mt-3">
            <GestureHints open={cardOpen} hideZoomHint alwaysVisible />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Standing-open-card thumbnail ─────────────────────────────────────
// A miniature, locked Card3DViewer — uses the actual 3D card render
// with the cover left slightly ajar (closedAngle) so the inside peeks
// out, frozen in place (no rotate, no zoom, no click-to-open). Same
// pattern the marketing hero uses for its ambient ajar card; the
// `interactive={false}` flag makes the hit zone pointer-events: none
// so clicks pass through to the wrapper button (which opens the
// modal with the full interactive viewer).
//
// Earlier CSS attempts (perspective rotation; layered offset images)
// kept reading as "two flat rectangles" rather than a card. Using
// the real 3D viewer is more expensive (one extra Canvas on the
// page) but the card textures are already warm from the reveal, and
// the polish is worth it on the emotional-core surface.
function CardStandingUpThumb({
  frontUrl,
  insideUrl,
}: {
  frontUrl: string;
  insideUrl: string | null;
}) {
  return (
    <div className="relative shrink-0 w-20 h-20 pointer-events-none">
      <Card3DViewer
        frontImageUrl={frontUrl}
        insideImageUrl={insideUrl}
        open={false}
        closedAngle={-0.5}
        interactive={false}
        enableRotate={false}
        enableZoom={false}
        framingMargin={1.6}
        className="w-full h-full"
      />
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
