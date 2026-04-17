// client/src/pages/card-maker.tsx
//
// The Studio card maker shell (Phase 1 of Sprint 3). Renders the
// six-step stepper and a placeholder panel per step. Real fields are
// wired in later phases — this page is the chassis everything else
// bolts onto.
//
// Two entry points:
//   /studio/new-card       → creates a fresh draft, redirects to edit
//   /studio/card/:id/edit  → loads an existing draft by id
//
// Both render under StudioLayout so the sidebar + header stay. The
// FAB is auto-hidden on these routes by StudioLayout's HIDE_FAB_ON.

import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useCardMaker } from '@/hooks/use-card-maker';
import { Stepper } from '@/components/studio/stepper';
import {
  RecipientStep,
  isRecipientStepReady,
} from '@/components/studio/steps/recipient-step';
import { SceneStep, isSceneStepReady } from '@/components/studio/steps/scene-step';
import { CARD_MAKER_STEPS, type CardDraftState } from '@shared/schema';

// ── Entry: POST a new draft, then redirect to the edit URL ───────────
// Keeping the "create draft" side-effect on the /studio/new-card route
// means the edit route is the persistent, bookmarkable one. Refreshing
// /studio/card/:id/edit resumes exactly where you left off; refreshing
// /studio/new-card would (wrongly) create another empty draft.
export function NewCardPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest('POST', '/api/studio/drafts');
        const { id } = (await res.json()) as { id: number };
        if (!cancelled) setLocation(`/studio/card/${id}/edit`);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Could not start a new card.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-sm text-red-600 mb-2">Couldn't start a new card.</p>
        <p className="text-xs text-stone-500 mb-6">{error}</p>
        <Button onClick={() => setLocation('/studio')}>Back to Studio</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-brand" />
    </div>
  );
}

// ── The actual maker ─────────────────────────────────────────────────
export function CardMakerPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ id: string }>('/studio/card/:id/edit');
  const cardId = params ? parseInt(params.id, 10) : NaN;

  if (!Number.isFinite(cardId)) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-sm text-red-600">Invalid card id.</p>
        <Button className="mt-4" onClick={() => setLocation('/studio')}>
          Back to Studio
        </Button>
      </div>
    );
  }

  return <CardMakerInner cardId={cardId} />;
}

function CardMakerInner({ cardId }: { cardId: number }) {
  const [, setLocation] = useLocation();
  const {
    state,
    isLoading,
    loadError,
    isSaving,
    update,
    setStep,
    goNext,
    goBack,
    currentStep,
    totalSteps,
  } = useCardMaker({ cardId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-sm text-red-600 mb-2">Couldn't load this card.</p>
        <p className="text-xs text-stone-500 mb-6">{loadError}</p>
        <Button onClick={() => setLocation('/studio')}>Back to Studio</Button>
      </div>
    );
  }

  const stepLabel = CARD_MAKER_STEPS[currentStep]?.label ?? '';
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  // "Furthest reached" = the max of currentStep and whatever was stored
  // on the draft. Lets the user click back to any earlier step but not
  // skip forward past where they've been.
  const furthestStep = Math.max(currentStep, state.step ?? 0);

  // Gate the Next button on the current step being complete.
  const canAdvance = isStepReady(currentStep, state);

  return (
    <div>
      {/* ── Top bar: stepper + save status + start over ───────── */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold text-stone-900">
            {stepLabel}
          </h1>
          <div className="flex items-center gap-3 text-xs text-stone-500">
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving…
              </span>
            ) : (
              <span className="text-stone-400">Saved</span>
            )}
            <button
              type="button"
              onClick={() => setLocation('/studio')}
              className="text-stone-400 hover:text-stone-700 underline underline-offset-2"
              data-testid="link-start-over"
            >
              Exit
            </button>
          </div>
        </div>
        <Stepper
          currentStep={currentStep}
          furthestStep={furthestStep}
          onStepClick={setStep}
        />
      </div>

      {/* ── Step panel ─────────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-10 min-h-[380px]">
        {currentStep === 0 && <RecipientStep state={state} onChange={update} />}
        {currentStep === 1 && <SceneStep state={state} onChange={update} />}
        {currentStep >= 2 && <StepPanelPlaceholder stepIndex={currentStep} />}
      </div>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="ghost"
          onClick={goBack}
          disabled={isFirst}
          className="text-stone-600"
          data-testid="btn-card-maker-back"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        {!isLast ? (
          <Button
            onClick={goNext}
            disabled={!canAdvance}
            className="bg-brand hover:bg-brand-dark text-brand-foreground disabled:opacity-50"
            data-testid="btn-card-maker-next"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          // The green Generate button — wired up for real in Phase 6.
          <Button
            disabled
            className="bg-cta text-cta-foreground opacity-60 cursor-not-allowed"
            data-testid="btn-card-maker-generate"
          >
            Generate (coming in Phase 6)
          </Button>
        )}
      </div>
    </div>
  );
}

// Per-step readiness gate. Steps that haven't been built yet default
// to "ready" (true) so the Next button works through the whole flow;
// as each step arrives it gains its own isXStepReady check here.
function isStepReady(stepIndex: number, state: CardDraftState): boolean {
  if (stepIndex === 0) return isRecipientStepReady(state);
  if (stepIndex === 1) return isSceneStepReady(state);
  return true;
}

// Placeholder panel rendered for every step until the real step
// components land in phases 2-5. Keeps Phase 1 visually complete so
// the stepper and nav can be tested end-to-end.
function StepPanelPlaceholder({ stepIndex }: { stepIndex: number }) {
  const step = CARD_MAKER_STEPS[stepIndex];
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-muted text-brand-dark mb-4 text-sm font-semibold">
        {stepIndex + 1}
      </div>
      <p className="text-lg font-medium text-stone-900 mb-2">{step?.label}</p>
      <p className="text-sm text-stone-500 max-w-sm mx-auto">
        This step's form lands in a later sprint phase. For now, use the
        stepper above or the Next / Back buttons to move through the flow
        — progress is auto-saved.
      </p>
    </div>
  );
}
