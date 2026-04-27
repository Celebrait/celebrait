// client/src/pages/studio-card-view.tsx
//
// Dedicated viewer for a sender's own completed card — the surface
// you land on when you click a card tile from the dashboard (Ready,
// Sent, Home activity).
//
// Before this existed (Apr 2026), /studio/card/:id redirected blindly
// into the card-maker flow, which dropped you on the review step and
// read as "re-edit this card". Wrong mental model — once a card is
// generated, the expectation is "show me the card".
//
// Unfinished drafts (status = draft / generating / failed) still
// redirect to /edit so the user can pick up where they left off.
// Everything else renders the 3D viewer + recipient/occasion header
// + Buy (if unpaid) / Share (if paid digital) / Close actions.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocation, useParams } from 'wouter';
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Share2, Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { GestureHints } from '@/components/gesture-hints';
import { RegenEditMode } from '@/components/studio/regen-controls';
import { getOccasionLabel } from '@/components/studio/scene-presets';
import { apiRequest } from '@/lib/queryClient';
import type { CardAttemptDTO } from '@/hooks/use-card-maker';
import type { CardDraftState, CardSide } from '@shared/schema';

type CardViewData = {
  id: number;
  status: string | null;
  frontImageUrl: string | null;
  insideImageUrl: string | null;
  createdAt: string | null;
  state: CardDraftState;
  /** Regen attempts (per side) — same shape as the maker. Always
   *  present in responses from /api/studio/drafts/:id since 2026-04-25. */
  attempts?: CardAttemptDTO[];
};

type OrderSummary = {
  id: string;
  cardId: number;
  paymentStatus: string;
  includesPrint: boolean;
  includesDigital: boolean;
  shareUrl: string | null;
};

export default function StudioCardViewPage() {
  const params = useParams();
  const cardId = Number(params.id);

  const { data, isLoading, error } = useQuery<CardViewData>({
    queryKey: [`/api/studio/drafts/${cardId}`],
    enabled: Number.isFinite(cardId),
    // Keep polling while any attempt is mid-flight so the versions
    // strip + thumbnails update without a manual refresh.
    refetchInterval: (q) => {
      const d = q.state.data as CardViewData | undefined;
      if (d?.attempts?.some((a) => a.status === 'generating')) return 2000;
      return false;
    },
  });

  // Orders list — we cross-reference to find a paid digital share link
  // if one exists. Cheap call (already-cached on the Orders page).
  const { data: orders } = useQuery<OrderSummary[]>({
    queryKey: ['/api/studio/orders'],
  });

  if (!Number.isFinite(cardId)) {
    return <Redirect to="/studio" />;
  }

  if (isLoading) {
    return <LoadingView />;
  }

  if (error || !data) {
    return <NotFoundView />;
  }

  // Unfinished drafts go back into the maker. Everything else renders
  // the viewer here.
  if (data.status === 'draft' || data.status === 'generating' || data.status === 'failed') {
    return <Redirect to={`/studio/card/${cardId}/edit`} />;
  }

  // Legacy / orphaned cards — image never stored. Bounce to studio
  // home rather than render a broken viewer.
  if (!data.frontImageUrl) {
    return <NotFoundView />;
  }

  return <LoadedView card={data} orders={orders ?? []} />;
}

// ─────────────────────────────────────────────────────────────────────

function LoadedView({
  card,
  orders,
}: {
  card: CardViewData;
  orders: OrderSummary[];
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [buyOpen, setBuyOpen] = useState(false);
  const [open3D, setOpen3D] = useState(false);
  // Edit mode flips the surface from "look at the card / buy" to a
  // focused regen workbench. Same pattern as RevealView in the
  // maker — both surfaces stay visually aligned. Only available to
  // unpaid cards (paid cards hide the entry pill below).
  const [editMode, setEditMode] = useState(false);

  const paidOrder = orders.find(
    (o) => o.cardId === card.id && o.paymentStatus === 'paid',
  );
  const hasPaid = !!paidOrder;
  const shareUrl = paidOrder?.shareUrl ?? null;

  const title = deriveTitle(card.state);
  const backHref = '/studio';

  // ── Regen wiring ────────────────────────────────────────────────
  // Same UX as the live maker reveal: per-side controls below the
  // Buy button. Only shown for unpaid cards — once a card has been
  // paid for, the gift's already on its way and regen would be
  // pointless (and confusing). PATCH on success invalidates the
  // draft query so the new attempt + selected pointer flow back.
  const regenMutation = useMutation({
    mutationFn: async (vars: { side: CardSide; tweak?: string }) => {
      const r = await apiRequest('POST', `/api/studio/drafts/${card.id}/regenerate`, {
        side: vars.side,
        tweak: vars.tweak,
      });
      return r.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/studio/drafts/${card.id}`],
      });
      // Card grid (Drafts/Ready/Sent) shows thumbnails — invalidate
      // so a new selected attempt's image lands on the dashboard too.
      queryClient.invalidateQueries({ queryKey: ['/api/user/cards'] });
    },
  });

  const selectMutation = useMutation({
    mutationFn: async (vars: { attemptId: number }) => {
      await apiRequest('PATCH', `/api/studio/cards/${card.id}/select-attempt`, {
        attemptId: vars.attemptId,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/studio/drafts/${card.id}`],
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/cards'] });
    },
  });

  // Mutation.variables is set while pending, undefined otherwise —
  // we read off it to know which side is currently regenerating.
  const isRegenerating: CardSide | null = regenMutation.isPending
    ? regenMutation.variables?.side ?? null
    : null;

  const handleRegenerate = async (side: CardSide, tweak?: string) => {
    await regenMutation.mutateAsync({ side, tweak });
  };
  const handleSelectAttempt = async (attemptId: number) => {
    await selectMutation.mutateAsync({ attemptId });
  };

  const insideMode = card.state.inside?.mode ?? null;
  const hasInside = insideMode === 'write' || insideMode === 'blank';

  // Edit mode takes the entire surface. BuyDialog stays mounted so
  // a regen → exit → buy flow doesn't lose its state. Shown only
  // for unpaid cards because the entry pill only renders below for
  // unpaid (paid cards have nothing to regen for — gift's en route).
  if (editMode && !hasPaid) {
    return (
      <>
        <RegenEditMode
          state={card.state}
          frontUrl={card.frontImageUrl}
          insideUrl={card.insideImageUrl}
          attempts={card.attempts ?? []}
          isRegenerating={isRegenerating}
          hasInside={hasInside}
          onRegenerate={handleRegenerate}
          onSelectAttempt={handleSelectAttempt}
          onExit={() => setEditMode(false)}
        />
        <BuyDialog
          open={buyOpen}
          onOpenChange={setBuyOpen}
          cardId={card.id}
          insideMode={card.state.inside?.mode ?? null}
        />
      </>
    );
  }

  return (
    <div className="max-w-3xl mx-auto" data-testid="card-view">
      {/* Header: Back + title. Must sit above the Card3DViewer's
          negative-offset bleed (which extends -18vh upward) — without
          this z-index the canvas covers the back button and kills
          pointer events. */}
      <div className="relative z-20 flex items-start justify-between gap-4 mb-4">
        <button
          type="button"
          onClick={() => setLocation(backHref)}
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-ink transition-colors"
          data-testid="btn-card-view-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to studio
        </button>
        {hasPaid ? (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-full px-3 py-1">
            <Package className="w-3.5 h-3.5" />
            Sent
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-cta rounded-full px-3 py-1">
            Ready to send
          </div>
        )}
      </div>

      {/* Card title intentionally NOT rendered here (was an h1 for
          "Mum's birthday card"). Kevin 2026-04-24: the 3D card feels
          more "real" when it's the only thing on screen — a text
          label above reads as UI chrome. Back button + status chip
          (above) carry context; the card itself carries identity.
          Screen-reader users still get the title via document.title
          below. */}

      {/* 3D viewer stage — same dimensions as the reveal stage so muscle
          memory is preserved; bleed offsets let the card rotate/zoom
          without clipping. Lower z so the header sits above. */}
      <div className="mb-4" />
      <TitleSROnly title={title} />
      <div className="h-[55vh] sm:h-[62vh] w-full relative z-10">
        <div
          className="absolute top-[-18vh] bottom-[-18vh] left-[-20vw] right-[-20vw]"
          style={{ filter: 'drop-shadow(0 24px 32px rgba(0,0,0,0.1))' }}
        >
          <Card3DViewer
            frontImageUrl={card.frontImageUrl!}
            insideImageUrl={card.insideImageUrl}
            open={open3D}
            onOpenChange={setOpen3D}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="relative z-30 max-w-xl mx-auto px-4 pt-4 text-center flex flex-col items-center gap-5">
        {hasPaid ? (
          <PaidActions
            shareUrl={shareUrl}
            includesDigital={paidOrder?.includesDigital ?? false}
          />
        ) : (
          <Button
            onClick={() => setBuyOpen(true)}
            className="bg-brand hover:bg-brand-dark text-brand-foreground font-semibold px-10 py-3.5 rounded-lg w-full sm:w-auto"
            size="lg"
            data-testid="btn-card-view-buy"
          >
            Buy this card
          </Button>
        )}

        {/* Gesture hints first — keep them close to the Buy CTA above
            (the hints are about the 3D card, so spatial proximity to
            the card+CTA cluster reads better than burying them under
            the regen panel). */}
        <div className="mt-2">
          <GestureHints open={open3D} />
        </div>

        {/* Regen entry — small pill that flips the whole surface into
            edit mode. Only for unpaid cards: once paid, the gift's
            on its way and further regens are pointless chrome.
            Subordinate to Buy by design — quiet safety net, not a
            parallel CTA. */}
        {!hasPaid && (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/60 hover:bg-white hover:border-brand/40 px-4 py-2 text-sm italic text-stone-600 hover:text-brand-dark transition-all"
            data-testid="btn-regen-open"
          >
            <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
            Not 100% happy? Make a change.
          </button>
        )}
      </div>

      <BuyDialog
        open={buyOpen}
        onOpenChange={setBuyOpen}
        cardId={card.id}
        insideMode={card.state.inside?.mode ?? null}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Paid actions — shown when the card has at least one paid order.
// Digital order: surface the share link. Print-only: just a gentle
// "on its way" chip. Reorder is a future ticket.
// ─────────────────────────────────────────────────────────────────────

function PaidActions({
  shareUrl,
  includesDigital,
}: {
  shareUrl: string | null;
  includesDigital: boolean;
}) {
  if (includesDigital && shareUrl) {
    return (
      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white rounded-full px-5 py-2.5 text-sm font-semibold transition-colors shadow-sm"
        data-testid="btn-card-view-share"
      >
        <Share2 className="w-4 h-4" />
        Open the share link
      </a>
    );
  }
  return (
    <p className="text-sm text-stone-500">
      This card has been sent. Track delivery in Orders &amp; delivery.
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Buy dialog — same three-option pattern used by review-step. Copy/
// paste for now; if we refactor review-step's BuyDialog into a shared
// component later, this uses the shared one.
// ─────────────────────────────────────────────────────────────────────

type ProductChoice = 'digital' | 'print' | 'both';

const PRINT_PRICE = 599;
const DIGITAL_PRICE = 99;
const UK_SHIPPING = 150;
const BUNDLE_DISCOUNT = 50;

function totalsFor(choice: ProductChoice): number {
  const print = choice === 'digital' ? 0 : PRINT_PRICE;
  const digital = choice === 'print' ? 0 : DIGITAL_PRICE;
  const shipping = choice === 'digital' ? 0 : UK_SHIPPING;
  const discount = choice === 'both' ? BUNDLE_DISCOUNT : 0;
  return print + digital + shipping - discount;
}

function formatGBP(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function BuyDialog({
  open,
  onOpenChange,
  cardId,
  insideMode,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cardId: number;
  insideMode: 'write' | 'blank' | null;
}) {
  const [, setLocation] = useLocation();
  const isBlank = insideMode === 'blank';
  const go = (choice: ProductChoice) => {
    onOpenChange(false);
    setLocation(`/checkout/${cardId}?product=${choice}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left">How would you like to send it?</DialogTitle>
          <DialogDescription className="text-left">
            {isBlank
              ? "You chose a blank inside, so this one's for the post."
              : 'Pick one — you can change your mind at checkout.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-3">
          {!isBlank && (
            <BuyOption
              title="Digital"
              description="A share link that opens with the same 3D viewer — instant."
              price={formatGBP(totalsFor('digital'))}
              onClick={() => go('digital')}
              testId="btn-card-view-buy-digital"
            />
          )}
          <BuyOption
            title="Printed"
            description="Premium square card, posted in the UK."
            price={formatGBP(totalsFor('print'))}
            onClick={() => go('print')}
            testId="btn-card-view-buy-print"
          />
          {!isBlank && (
            <BuyOption
              title="Printed + digital"
              description="The real thing in the post plus the instant share link."
              price={formatGBP(totalsFor('both'))}
              badge="Best value"
              onClick={() => go('both')}
              testId="btn-card-view-buy-both"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BuyOption({
  title,
  description,
  price,
  badge,
  onClick,
  testId,
}: {
  title: string;
  description: string;
  price: string;
  badge?: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="relative w-full text-left bg-white border border-stone-200 rounded-xl p-4 hover:border-brand/60 hover:shadow-sm transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      data-testid={testId}
    >
      {badge && (
        <span className="absolute top-2 right-2 bg-brand text-white text-[10px] uppercase font-semibold tracking-wide rounded-full px-2 py-0.5">
          {badge}
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="text-xs text-stone-600 mt-0.5">{description}</p>
        </div>
        <p className="text-sm font-semibold text-brand-dark whitespace-nowrap">
          {price}
        </p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TitleSROnly — sets document.title for the tab label and renders a
// visually-hidden h1 so screen readers still announce which card is
// open. The visible h1 was removed 2026-04-24 to keep the 3D render
// feeling like an object, not a labelled UI element.
// ─────────────────────────────────────────────────────────────────────
function TitleSROnly({ title }: { title: string }) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} — Celebrait`;
    return () => {
      document.title = prev;
    };
  }, [title]);
  return <h1 className="sr-only">{title}</h1>;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers + edge-case views
// ─────────────────────────────────────────────────────────────────────

function deriveTitle(state: CardDraftState): string {
  const name = state.recipient?.name?.trim();
  const occasion = state.recipient?.occasion?.trim();
  // Use getOccasionLabel so 'thankyou' \u2192 'Thank you' etc. — raw key
  // was leaking through as "Mum's thankyou card".
  const occasionLabel =
    occasion && occasion !== 'other' ? getOccasionLabel(occasion) : '';
  if (name && occasionLabel) return `${name}'s ${occasionLabel.toLowerCase()} card`;
  if (name) return `Card for ${name}`;
  if (occasionLabel) return `${occasionLabel} card`;
  return 'Your card';
}

function LoadingView() {
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <Loader2 className="w-6 h-6 text-brand animate-spin mx-auto mb-3" />
      <p className="text-sm text-stone-500">Loading your card…</p>
    </div>
  );
}

function NotFoundView() {
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <p className="text-base font-semibold text-ink mb-2">Card not found</p>
      <p className="text-sm text-stone-600 mb-6">
        It might have been deleted, or the link is out of date.
      </p>
      <a
        href="/studio"
        className="inline-flex items-center gap-1.5 text-sm text-brand hover:text-brand-dark underline underline-offset-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to studio
      </a>
    </div>
  );
}
