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
import { motion } from 'framer-motion';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { useTexture } from '@react-three/drei';
import { GestureHints } from '@/components/gesture-hints';
import { StartAgainButton } from '@/components/studio/steps/review-step';
import { familyKey, isGeneratedStatus } from '@/lib/studio-card-buckets';
import type { CardGridItem } from '@shared/schema';
import { getOccasionLabel } from '@/components/studio/scene-presets';
import { apiRequest } from '@/lib/queryClient';
import { useMarkCardSeen } from '@/hooks/use-card-ready-notifications';
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
  /** Per-side background-regen failure (most-recent attempt failed). */
  regenFailures?: { side: CardSide; kind: string }[];
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

  // Mark the "your card is ready" in-app notification seen the moment
  // the sender lands here — this IS the reveal moment we were
  // notifying about, so any toast for it should not re-fire. Safe to
  // call when notifiedAt is already set (server filter makes it a
  // no-op) and when there was never a notification queued (the cache
  // update is also a no-op when the cardId isn't in the unread list).
  const markCardSeen = useMarkCardSeen();
  useEffect(() => {
    if (Number.isFinite(cardId)) markCardSeen(cardId);
  }, [cardId, markCardSeen]);

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

  // Unfinished drafts go back into the maker. This includes the
  // front-first in-progress states (front-ready / generating-front /
  // generating-inside / inside-failed) — those are mid-flow cards that
  // belong in the maker's reveal, not this completed-card viewer.
  if (
    data.status === 'draft' ||
    data.status === 'generating' ||
    data.status === 'generating-front' ||
    data.status === 'front-ready' ||
    data.status === 'generating-inside' ||
    data.status === 'inside-ready' ||
    data.status === 'inside-failed' ||
    data.status === 'failed'
  ) {
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
  const [open3D, setOpen3D] = useState(false);
  // Edit mode flips the surface from "look at the card / buy" to a
  // focused regen workbench. Same pattern as RevealView in the
  // maker — both surfaces stay visually aligned. Only available to
  // unpaid cards (paid cards hide the entry pill below).

  const paidOrder = orders.find(
    (o) => o.cardId === card.id && o.paymentStatus === 'paid',
  );
  const hasPaid = !!paidOrder;
  const shareUrl = paidOrder?.shareUrl ?? null;

  const title = deriveTitle(card.state);
  const backHref = '/studio';

  // ── Texture preload ──────────────────────────────────────────────
  // Same speedup as the in-Studio reveal (review-step.tsx) — the
  // moment the URLs are available, fire a browser <link rel=preload>
  // and drei's useTexture.preload so the 3D viewer's textures decode
  // in parallel with React mounting the viewer chunk. Without this
  // the card visibly pops in ~500ms-1s after the page renders.
  useEffect(() => {
    const urls = [card.frontImageUrl, card.insideImageUrl].filter(
      (u): u is string => !!u && u.length > 0,
    );
    if (urls.length === 0) return;

    const links = urls.map((url) => {
      const el = document.createElement('link');
      el.rel = 'preload';
      el.as = 'image';
      // MUST match how Three.js loads the texture (crossOrigin='anonymous').
      // Without this, a cross-origin (R2) image preloaded no-cors poisons the
      // cache; Three's CORS request then fails ("no ACAO header") → WebGL
      // context lost → the 3D card never renders.
      el.crossOrigin = 'anonymous';
      el.href = url;
      document.head.appendChild(el);
      return el;
    });

    try {
      useTexture.preload(urls);
    } catch (err) {
      console.warn('[studio-card-view] texture preload failed', err);
    }

    return () => {
      for (const el of links) {
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    };
  }, [card.frontImageUrl, card.insideImageUrl]);

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
    // Optimistically point the card's displayed image (and the isSelected
    // flags) at the chosen attempt IMMEDIATELY. Without this, the new
    // version's URL only lands on the next refetch (onSettled), so exiting
    // to the 3D view rendered the OLD texture for a beat before swapping —
    // the "not fresh clean when landing on the new version" flash. Updating
    // the cache here means frontImageUrl/insideImageUrl (and the texture
    // preload that depends on them) are already correct before we leave the
    // regen surface, so the 3D mounts straight onto the new version.
    onMutate: async (vars) => {
      const key = [`/api/studio/drafts/${card.id}`];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<CardViewData>(key);
      const attempt = prev?.attempts?.find((a) => a.id === vars.attemptId);
      if (prev && attempt?.imageUrl) {
        queryClient.setQueryData<CardViewData>(key, {
          ...prev,
          frontImageUrl:
            attempt.side === 'front' ? attempt.imageUrl : prev.frontImageUrl,
          insideImageUrl:
            attempt.side === 'inside' ? attempt.imageUrl : prev.insideImageUrl,
          attempts: (prev.attempts ?? []).map((a) =>
            a.side === attempt.side
              ? { ...a, isSelected: a.id === attempt.id }
              : a,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back so the UI doesn't lie about the committed version.
      if (ctx?.prev) {
        queryClient.setQueryData(
          [`/api/studio/drafts/${card.id}`],
          ctx.prev,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/studio/drafts/${card.id}`],
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/cards'] });
    },
  });

  // Patch the draft's inputs while in regen edit mode. RegenEditMode
  // exposes pill-style swap controls (photo / style) that need to
  // persist into the draft before the user fires another regen — the
  // server reads conversationData when building the regen prompt.
  //
  // The PATCH endpoint expects the FULL CardDraftState (it's small,
  // and full-overwrite avoids merge-semantic edge cases). We merge
  // the caller's partial patch with the current card state and send.
  const updateInputsMutation = useMutation({
    mutationFn: async (patch: Partial<CardDraftState>) => {
      const nextState: CardDraftState = {
        ...card.state,
        ...patch,
      };
      await apiRequest('PATCH', `/api/studio/drafts/${card.id}`, {
        state: nextState,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/studio/drafts/${card.id}`],
      });
    },
  });
  const handleUpdateInputs = async (patch: Partial<CardDraftState>) => {
    await updateInputsMutation.mutateAsync(patch);
  };

  // `isRegenerating` is the UNION of two signals:
  //
  //   (a) regenMutation.isPending — true from click → API response
  //       (~100ms after the route change). Disables the button
  //       INSTANTLY on click, before the first poll completes.
  //
  //   (b) any attempt in polled data with status='generating' — true
  //       for the long gen window (3-5min on gpt-image-2 high quality).
  //       Self-clearing when the attempt completes/fails.
  //
  // Without (a), there's a ~2-second window between click and the
  // first poll seeing the new attempt where the button stays
  // clickable. Kevin caught this 2026-05-15: 6 rapid clicks fired
  // 6 separate regens. Server-side guard added too as defence-in-depth.
  //
  // Without (b), the spinner would clear the instant the API
  // returned — long before the gen actually finished. (The original
  // bug we set out to fix.)
  const generatingAttempt = card.attempts?.find(
    (a) => a.status === 'generating',
  );
  const polledRegenSide: CardSide | null = generatingAttempt?.side ?? null;
  const pendingRegenSide: CardSide | null = regenMutation.isPending
    ? (regenMutation.variables?.side ?? null)
    : null;

  // THIRD signal — bridge the gap between the mutation resolving and the
  // react-query refetch actually seeing the new 'generating' attempt. In
  // that window pendingRegenSide AND polledRegenSide are both null, so
  // isRegenerating dropped to null and the "Your new version is ready"
  // panel flashed mid-regen (the long-hunted "landing too early" bug —
  // it lived in THIS card-view path, not the maker's useCardMaker hook).
  // firedRegen stays set from the click until a NEW completed attempt for
  // that side lands (or it fails). See next_regen_interaction_polish.md.
  const [firedRegen, setFiredRegen] = useState<{
    side: CardSide;
    baseline: number;
  } | null>(null);
  useEffect(() => {
    if (!firedRegen) return;
    const completedNow = (card.attempts ?? []).filter(
      (a) => a.side === firedRegen.side && a.status === 'completed',
    ).length;
    const failed = (card.regenFailures ?? []).some(
      (f) => f.side === firedRegen.side,
    );
    if (completedNow > firedRegen.baseline || failed) setFiredRegen(null);
  }, [card.attempts, card.regenFailures, firedRegen]);

  const isRegenerating: CardSide | null =
    pendingRegenSide ?? polledRegenSide ?? firedRegen?.side ?? null;

  // Poll-detected failure → inline error panel (G1 parity with the maker
  // path). null when no side's latest attempt failed.
  const regenError = card.regenFailures?.[0] ?? null;

  const handleRegenerate = async (side: CardSide, tweak?: string) => {
    const baseline = (card.attempts ?? []).filter(
      (a) => a.side === side && a.status === 'completed',
    ).length;
    setFiredRegen({ side, baseline });
    await regenMutation.mutateAsync({ side, tweak });
  };
  const handleSelectAttempt = async (attemptId: number) => {
    await selectMutation.mutateAsync({ attemptId });
  };

  const insideMode = card.state.inside?.mode ?? null;
  const hasInside = insideMode === 'write' || insideMode === 'blank';

  // (The RegenEditMode workbench branch that lived here was PARKED for
  // Premium 2026-07-07 — the regen plumbing above stays dormant for its
  // revival; the iterate affordance is now the StartAgainButton pill
  // below the card.)
  void isRegenerating;
  void regenError;
  void hasInside;
  void handleRegenerate;
  void handleSelectAttempt;
  void handleUpdateInputs;

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
            /* Resting ajar — the site-wide pose (~22°, Kevin's
               2026-07-07 dial-in on the studio reveal). Orbit gadget
               removed site-wide the same day: tap to open/close is
               the whole interaction model. */
            closedAngle={-0.38}
            restYaw={-0.12}
            enableRotate={false}
            enableZoom={false}
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
            onClick={() =>
              setLocation(
                // Blank inside skips the Giving Moment (no choice to
                // make → printed + posted to the sender, always);
                // every other card lands on the Giving Moment screen
                // for the format + destination choice. Same routing
                // as the post-reveal "Send this card" in the maker.
                insideMode === 'blank'
                  ? `/checkout/${card.id}?product=print`
                  : `/studio/card/${card.id}/give`,
              )
            }
            className="bg-brand hover:bg-brand-dark text-brand-foreground font-semibold px-10 py-3.5 rounded-lg w-full sm:w-auto"
            size="lg"
            data-testid="btn-card-view-buy"
          >
            Send this card
          </Button>
        )}

        {/* Gesture hints first — keep them close to the Buy CTA above
            (the hints are about the 3D card, so spatial proximity to
            the card+CTA cluster reads better than burying them under
            the regen panel). */}
        <div className="mt-2 flex h-16 items-start justify-center">
          <GestureHints
            open={open3D}
            hideRotateHint
            hideZoomHint
            openLabel="Tap to close"
          />
        </div>

        {/* Regen entry — small pill that flips the whole surface into
            edit mode. Only for unpaid cards: once paid, the gift's
            on its way and further regens are pointless chrome.
            Subordinate to Buy by design — quiet safety net, not a
            parallel CTA. Fades out in lockstep with the gesture
            hints when the card opens (Kevin 2026-04-26: chrome
            shouldn't compete with the moment of opening the card). */}
        {!hasPaid && (
          <motion.div
            animate={{ opacity: open3D ? 0 : 1 }}
            transition={{ duration: 0.5 }}
            style={{ pointerEvents: open3D ? 'none' : 'auto' }}
            className="mt-2"
          >
            <StartAgainButton cardId={card.id} className="mx-auto" />
          </motion.div>
        )}

        {/* Takes rail — every finished take in this card's family, one
            tap to view/buy a different one (Kevin 2026-07-08). Unpaid
            cards only: once one take is bought, switching is noise. */}
        {!hasPaid && (
          <TakesRail
            currentId={card.id}
            famKey={card.state.rerollFamilyId ?? card.id}
          />
        )}
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Takes rail — thumbnails of every finished take in this card's
// family (Start-again clones + the original). Clicking navigates to
// that take's own card view, where its Send CTA buys THAT take. Uses
// the cached /api/user/cards list — no new endpoint.
// ─────────────────────────────────────────────────────────────────────

function TakesRail({ currentId, famKey }: { currentId: number; famKey: number }) {
  const [, setLocation] = useLocation();
  const { data: allCards } = useQuery<CardGridItem[]>({
    queryKey: ['/api/user/cards'],
  });
  const takes = (allCards ?? [])
    .filter(
      (c) =>
        familyKey(c) === famKey &&
        isGeneratedStatus(c.status) &&
        !!c.frontImageUrl,
    )
    .sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return at - bt; // oldest first — reads as take 1, 2, 3…
    });
  if (takes.length < 2) return null;
  return (
    <div className="mt-6" data-testid="takes-rail">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2">
        Your takes
      </p>
      <div className="flex flex-wrap items-start justify-center gap-2">
        {takes.map((t, idx) => {
          const isCurrent = t.id === currentId;
          return (
            <button
              key={t.id}
              type="button"
              disabled={isCurrent}
              onClick={() => setLocation(`/studio/card/${t.id}`)}
              className={`group flex flex-col items-center gap-1 ${
                isCurrent ? 'cursor-default' : 'cursor-pointer'
              }`}
              data-testid={`take-thumb-${t.id}`}
            >
              <span
                className={`block h-16 w-16 overflow-hidden rounded-lg border-2 transition-all ${
                  isCurrent
                    ? 'border-brand shadow-sm'
                    : 'border-transparent opacity-70 group-hover:opacity-100 group-hover:border-stone-300'
                }`}
              >
                <img
                  src={t.frontImageUrl!}
                  alt={`Take ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </span>
              <span
                className={`text-[10px] ${
                  isCurrent ? 'font-semibold text-brand-dark' : 'text-stone-400'
                }`}
              >
                Take {idx + 1}
              </span>
            </button>
          );
        })}
      </div>
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

// (BuyDialog + BuyOption + pricing helpers removed 2026-05-20 — the
//  send/buy flow now navigates to /studio/card/:id/give → /checkout
//  instead of opening a modal. Same change as in review-step.tsx
//  earlier. See next_delivery_destination_usp.md.)

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
