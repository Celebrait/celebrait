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
import { toast } from '@/hooks/use-toast';
import { useCardMaker } from '@/hooks/use-card-maker';
import { Stepper } from '@/components/studio/stepper';
import {
  RecipientStep,
  isRecipientStepReady,
} from '@/components/studio/steps/recipient-step';
import { SceneStep, isSceneStepReady } from '@/components/studio/steps/scene-step';
import { StyleStep, isStyleStepReady } from '@/components/studio/steps/style-step';
import { PhotoStep, isPhotoStepReady } from '@/components/studio/steps/photo-step';
import { InsideStep, isInsideStepReady } from '@/components/studio/steps/inside-step';
import { ReviewStep } from '@/components/studio/steps/review-step';
import { CARD_MAKER_STEPS, type CardDraftState, type StepId } from '@shared/schema';

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
    status,
    frontImageUrl,
    insideImageUrl,
    update,
    setStep,
    goNext,
    goBack,
    scheduleSave,
    flushSave,
    startGeneration,
    isStartingGeneration,
    currentStep,
    totalSteps,
  } = useCardMaker({ cardId });

  // Map step IDs back to their indexes so the Review step's "Edit"
  // links can jump to the right step without hardcoding numbers.
  const stepIndexById = CARD_MAKER_STEPS.reduce((acc, step, idx) => {
    acc[step.id] = idx;
    return acc;
  }, {} as Record<StepId, number>);

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
        {/* Step order: Recipient → Photo → Scene → Style → Inside → Review.
            Photo moved to position 2 (index 1) so the emotional "we've got
            them" moment happens before the blank scene textarea. */}
        {currentStep === 0 && <RecipientStep state={state} onChange={update} />}
        {currentStep === 1 && <PhotoStep state={state} onChange={update} />}
        {currentStep === 2 && <SceneStep state={state} onChange={update} />}
        {currentStep === 3 && <StyleStep state={state} onChange={update} />}
        {currentStep === 4 && (
          <InsideStep
            state={state}
            onChange={update}
            scheduleSave={scheduleSave}
            flushSave={flushSave}
          />
        )}
        {currentStep === 5 && (
          <ReviewStep
            cardId={cardId}
            state={state}
            status={status}
            stepIndexById={stepIndexById}
            onJumpToStep={setStep}
            onGenerate={() => {
              void startGeneration().catch((err: Error & { used?: number; limit?: number }) => {
                console.error('[CARD_MAKER] startGeneration failed:', err);
                // Rate-limit errors carry structured `used` / `limit`
                // fields from the server (via apiRequest's error
                // hydration). Show a clear daily-limit toast in that
                // case; generic failure toast otherwise.
                if (typeof err.limit === 'number') {
                  toast({
                    title: "You've reached today's limit",
                    description: `${err.used}/${err.limit} cards generated in the last 24 hours. Try again tomorrow.`,
                    variant: 'destructive',
                  });
                } else {
                  toast({
                    title: "Couldn't start generation",
                    description: err.message,
                    variant: 'destructive',
                  });
                }
              });
            }}
            isGenerating={isStartingGeneration}
            generatedFrontUrl={frontImageUrl}
            generatedInsideUrl={insideImageUrl}
          />
        )}
      </div>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      {/* The Review step owns its own Generate button, and once a
          generation is in flight (or complete) there's nothing useful
          to do with Back. Hide the whole nav on the Review step
          except when the user is still on the review summary and
          might want to go back to the Inside step. */}
      {!isLast && (
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
          <Button
            onClick={goNext}
            disabled={!canAdvance}
            className="bg-brand hover:bg-brand-dark text-brand-foreground disabled:opacity-50"
            data-testid="btn-card-maker-next"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
      {isLast && (status === null || status === 'draft') && (
        <div className="flex items-center justify-start mt-6">
          <Button
            variant="ghost"
            onClick={goBack}
            className="text-stone-600"
            data-testid="btn-card-maker-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </div>
      )}
    </div>
  );
}

// Per-step readiness gate. Steps that haven't been built yet default
// to "ready" (true) so the Next button works through the whole flow;
// as each step arrives it gains its own isXStepReady check here.
// Step indexes follow CARD_MAKER_STEPS:
//   0 recipient, 1 photo, 2 scene, 3 style, 4 inside, 5 review
function isStepReady(stepIndex: number, state: CardDraftState): boolean {
  if (stepIndex === 0) return isRecipientStepReady(state);
  if (stepIndex === 1) return isPhotoStepReady(state);
  if (stepIndex === 2) return isSceneStepReady(state);
  if (stepIndex === 3) return isStyleStepReady(state);
  if (stepIndex === 4) return isInsideStepReady(state);
  return true;
}

