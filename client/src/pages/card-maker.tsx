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

import { useEffect, useRef, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2, Sparkle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { useCardMaker } from '@/hooks/use-card-maker';
import { useMarkCardSeen } from '@/hooks/use-card-ready-notifications';
import { Stepper } from '@/components/studio/stepper';
import {
  RecipientStep,
  isRecipientStepReady,
} from '@/components/studio/steps/recipient-step';
import { SceneStep, isSceneStepReady } from '@/components/studio/steps/scene-step';
// StyleStep parked for Celebrait Premium tier — V1 locks to the
// "warm illustrated" default which is what we render today. The file
// stays in the repo for revival under Premium. See next_celebrait_premium.md
// + the CARD_MAKER_STEPS removal note in shared/models/card-draft.ts.
// import { StyleStep, isStyleStepReady } from '@/components/studio/steps/style-step';
import { FrontStep, isFrontStepReady } from '@/components/studio/steps/front-step';
import { PhotoStep, isPhotoStepReady } from '@/components/studio/steps/photo-step';
import { InsideStep, isInsideStepReady } from '@/components/studio/steps/inside-step';
import { ReviewStep } from '@/components/studio/steps/review-step';
import {
  FixAndRetryDialog,
  type FixAndRetryEditor,
} from '@/components/studio/fix-and-retry-dialog';
import {
  CARD_MAKER_STEPS,
  type CardDraftState,
  type CardSide,
  type StepId,
} from '@shared/schema';
import { getOccasionLabel } from '@/components/studio/scene-presets';

// ── Entry: POST a new draft, then redirect to the edit URL ───────────
// Keeping the "create draft" side-effect on the /studio/new-card route
// means the edit route is the persistent, bookmarkable one. Refreshing
// /studio/card/:id/edit resumes exactly where you left off; refreshing
// /studio/new-card would (wrongly) create another empty draft.
export function NewCardPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  // Track how long we've been waiting so the fast-path stays near-invisible
  // (no artificial delay) while a slow path (Neon cold start, etc.) gets
  // the full branded treatment.
  const [showBrandedWait, setShowBrandedWait] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Only dress up the wait if it's been slow enough to need it.
    // Sub-400ms requests never flash the animation — they just redirect.
    const brandedTimer = setTimeout(() => {
      if (!cancelled) setShowBrandedWait(true);
    }, 400);
    (async () => {
      try {
        // Prefill from a reminder deep-link
        // (/studio/new-card?recipient=…&occasion=…) so "Start Mum's card"
        // opens a draft that already knows who it's for (audit 2026-07-02).
        const qp = new URLSearchParams(window.location.search);
        const recipientName = qp.get('recipient')?.trim() || undefined;
        const occasion = qp.get('occasion')?.trim() || undefined;
        const seedBody =
          recipientName || occasion ? { recipientName, occasion } : undefined;
        const res = await apiRequest('POST', '/api/studio/drafts', seedBody);
        const { id } = (await res.json()) as { id: number };
        if (!cancelled) setLocation(`/studio/card/${id}/edit`);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Could not start a new card.');
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(brandedTimer);
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

  // Fast-path: brief minimal spinner, no visual noise.
  if (!showBrandedWait) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  // Slow-path (Neon cold start etc.): branded "booting the studio" state.
  // Gentle pulse + copy that says "we haven't stalled."
  return (
    <div className="max-w-md mx-auto text-center py-24" data-testid="new-card-branded-wait">
      <div className="relative inline-flex items-center justify-center mb-5">
        <span className="absolute inline-flex w-20 h-20 rounded-full bg-brand-muted animate-ping opacity-60" />
        <span className="relative inline-flex w-16 h-16 rounded-full bg-brand-muted border-2 border-brand items-center justify-center">
          <Sparkle className="w-7 h-7 text-accent-amber" />
        </span>
      </div>
      <p className="text-base font-semibold text-ink mb-1">Warming up the Studio…</p>
      <p className="text-xs text-stone-500">This usually takes a second or two.</p>
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
    startInsideGeneration,
    finalizeCard,
    isStartingGeneration,
    attempts,
    isRegenerating,
    regenError,
    regenerate,
    selectAttempt,
    failure,
    currentStep,
    totalSteps,
  } = useCardMaker({ cardId });

  // When a card reveals as completed IN THE MAKER, mark its "ready"
  // notification seen so the 30s cross-app poll doesn't fire a redundant
  // "your card is ready" toast for the card the user is already looking
  // at. Fires once per cardId (server-side mark is idempotent anyway).
  const markCardSeen = useMarkCardSeen();
  const seenFiredRef = useRef(false);
  useEffect(() => {
    if (status === 'completed' && !seenFiredRef.current) {
      seenFiredRef.current = true;
      markCardSeen(cardId);
    }
  }, [status, cardId, markCardSeen]);

  // Hooks must run every render — keep them above the isLoading /
  // loadError early returns. stateRef backs the delayed re-check in
  // handleAutoAdvance so we read the latest state when the timer fires.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Fix-and-retry dialog ───────────────────────────────────────────
  // Opens when the user clicks an action chip on the
  // <GenerationErrorPanel>. Lets them fix one input (scene / photo /
  // style) without leaving the failure context, with the OTHER inputs
  // visible as "Also using" reminders.
  //
  // Earlier design (now scrapped): set "retry-pending" mode on the
  // maker stepper, render a banner across every step, let user re-walk.
  // Kevin's call 2026-05-09: "feels weird to go back into the flow
  // again — way more sense for this to be a separate UI". The dialog
  // IS that separate UI.
  //
  // The dialog can be opened from two places:
  //   - INITIAL-gen failure on Review step → uses /retry + startGeneration
  //   - REGEN failure inside RegenEditMode → uses regenerate(side)
  // The `fixDialogContext` flag tracks which path opened it so the
  // right retry handler fires when the user clicks "Try again with these".
  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [fixDialogEditor, setFixDialogEditor] = useState<FixAndRetryEditor>('scene');
  type FixDialogContext = { mode: 'initial' } | { mode: 'regen'; side: CardSide };
  const [fixDialogContext, setFixDialogContext] = useState<FixDialogContext>({
    mode: 'initial',
  });

  // Shared retry handler. Two-step server dance: flip 'failed' →
  // 'draft', then kick off generation. Then navigate back to Review
  // so the user sees the reveal happening. Used by both the
  // <GenerationErrorPanel>'s "Try again" button and the
  // <FixAndRetryDialog>'s "Try again with these" button on the
  // INITIAL-gen path.
  const handleRetryGeneration = async () => {
    await apiRequest('POST', `/api/studio/drafts/${cardId}/retry`, {});
    await startGeneration();
    setStep(stepIndexById.review);
  };

  // Save patch + retry — INITIAL-gen variant. Applies the patch via
  // useCardMaker's update() (which handles autosave), flushes so the
  // server has it before /retry runs, then fires retry.
  const handleSaveAndRetry = async (patch: Partial<CardDraftState>) => {
    if (Object.keys(patch).length > 0) {
      update(patch);
      await flushSave();
    }
    await handleRetryGeneration();
    setFixDialogOpen(false);
  };

  // Save patch + retry — REGEN variant. Same patch+flush pattern, but
  // fires regenerate(side) instead of /retry + startGeneration.
  // No setStep — the user is already on Review (regen only happens
  // there), so we don't need to navigate.
  const handleSaveAndRetryRegen = async (
    patch: Partial<CardDraftState>,
    side: CardSide,
  ) => {
    if (Object.keys(patch).length > 0) {
      update(patch);
      await flushSave();
    }
    await regenerate(side);
    setFixDialogOpen(false);
  };

  // Chip click from the INITIAL-gen failure panel → open dialog,
  // initial mode.
  const handleOpenFixDialog = (editor: 'scene' | 'photo') => {
    setFixDialogEditor(editor);
    setFixDialogContext({ mode: 'initial' });
    setFixDialogOpen(true);
  };

  // Chip click from a REGEN failure panel → open dialog, regen mode,
  // remember which side failed so the retry fires the right regen.
  const handleOpenFixDialogRegen = (
    editor: 'scene' | 'photo',
    side: CardSide,
  ) => {
    setFixDialogEditor(editor);
    setFixDialogContext({ mode: 'regen', side });
    setFixDialogOpen(true);
  };

  // Computed save handler — pulled by the dialog. Switches based on
  // which path opened the dialog; the dialog itself stays opaque to
  // the distinction (just calls onSaveAndRetry(patch)).
  const dialogSaveHandler = (patch: Partial<CardDraftState>) =>
    fixDialogContext.mode === 'initial'
      ? handleSaveAndRetry(patch)
      : handleSaveAndRetryRegen(patch, fixDialogContext.side);

  // Respect prefers-reduced-motion. When true, step transitions swap
  // instantly with no fade-up (accessibility baseline).
  const prefersReducedMotion = useReducedMotion();

  // Map step IDs back to their indexes so the Review step's "Edit"
  // links can jump to the right step without hardcoding numbers.
  const stepIndexById = CARD_MAKER_STEPS.reduce((acc, step, idx) => {
    acc[step.id] = idx;
    return acc;
  }, {} as Record<StepId, number>);

  // ── Focused edit overlay (Kevin 2026-07-08) ────────────────────────
  // Review's Edit links used to setStep(n) — which PERSISTS the step,
  // collapsing "furthest reached" and forcing the user to Next their
  // way back through every step. Now an edit from Review opens the
  // target step as an OVERLAY: the draft stays parked on Review, the
  // user changes the one thing, and "Done — back to review" returns
  // in a single tap. Local state only — a refresh lands back on
  // Review, which is exactly right.
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const jumpToStepForEdit = (idx: number) => {
    if (currentStep === stepIndexById.review && idx !== stepIndexById.review) {
      setEditingStep(idx);
    } else {
      setStep(idx);
    }
  };
  const finishEditing = async () => {
    await flushSave();
    setEditingStep(null);
  };

  // The saving indicator only renders if a save has been in flight long
  // enough to be worth signalling — fast saves stay invisible. Below
  // ~600ms we'd just flash "Saving…" then "Saved" for a beat, which
  // reads SaaS-tic and undermines the gift framing. Mirrors the
  // showBrandedWait pattern in NewCardPage. The "Saved" branch was
  // dropped entirely (2026-04-25) — silent success is the default.
  // MUST live above the isLoading / loadError early-returns: every
  // hook on this component has to run on every render, full stop.
  const [showSaving, setShowSaving] = useState(false);
  useEffect(() => {
    if (!isSaving) {
      setShowSaving(false);
      return;
    }
    const t = window.setTimeout(() => setShowSaving(true), 600);
    return () => window.clearTimeout(t);
  }, [isSaving]);

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

  // While the edit overlay is open, the PANEL shows the overlay step;
  // the draft's persisted step stays parked on Review.
  const displayStep = editingStep ?? currentStep;
  const currentStepId = CARD_MAKER_STEPS[displayStep]?.id;
  // Conversational headline per step — name-woven where possible. The
  // stepper below keeps short-noun labels for scannable navigation;
  // the h1 carries the voice.
  const stepHeadline = currentStepId ? getStepHeadline(currentStepId, state) : '';
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  // ── Inside step skipped in the linear walk (2026-07-07) ────────────
  // The inside message is now written AFTER the front reveal (the
  // InsideComposeStage in review-step.tsx), so Next from Front jumps
  // straight to Review and Back from Review returns to Front. The
  // InsideStep panel + its index stay fully functional for direct
  // jumps (the Buy dialog's "add a message" recovery path) —
  // deliberately NOT re-indexing CARD_MAKER_STEPS (two prod bugs
  // last time).
  const handleNext = () => {
    if (currentStep === stepIndexById.front) {
      setStep(stepIndexById.review);
    } else {
      goNext();
    }
  };
  const handleBack = () => {
    if (currentStep === stepIndexById.review) {
      setStep(stepIndexById.front);
    } else {
      goBack();
    }
  };

  // "Furthest reached" = the max of currentStep and whatever was stored
  // on the draft. Lets the user click back to any earlier step but not
  // skip forward past where they've been.
  const furthestStep = Math.max(currentStep, state.step ?? 0);

  // Gate the Next button on the current step being complete.
  const canAdvance = isStepReady(currentStep, state);

  // Auto-advance on steps that have a clear "done" signal (Recipient
  // picks + name, Style pick/custom confirm). The trigger fires from
  // the step component on that transition; we gate here so it only
  // works on forward progress (the user's frontier step), never on
  // revisits. 250ms delay lets the picked-state animation render
  // before the step swaps out. Re-check readiness at fire time since
  // state could have moved during the delay.
  const handleAutoAdvance = (fromStep: number) => {
    if (fromStep !== furthestStep) return;
    if (fromStep !== currentStep) return;
    if (!isStepReady(fromStep, state)) return;
    setTimeout(() => {
      if (isStepReady(fromStep, stateRef.current)) {
        goNext();
      }
    }, 250);
  };

  // On the Review step, once Generate has been pressed we treat the
  // whole page as "the moment of unveiling" — any chrome around the card
  // is a distraction. Hide the h1, stepper, step-panel frame, and the
  // saving indicator until the user comes back to a non-reveal state
  // (e.g. by clicking Close, or on a fresh load where we're not
  // mid-render). `isRevealMode` gates all of these in one place so they
  // stay in sync. Failed is included because its "That one didn't land"
  // screen is its own full-page visual — stacking the step h1 above it
  // is just two competing headlines.
  // Review is step index 5 (it was 6 before the Style step was removed
  // in the V1 scope cut — this check wasn't updated then, which left
  // isRevealMode permanently false: the h1 / stepper / panel frame
  // stopped hiding during the reveal). Fixed 2026-05-19.
  const isRevealMode =
    currentStep === 5 &&
    editingStep === null &&
    (status === 'generating' ||
      status === 'generating-front' ||
      status === 'front-ready' ||
      status === 'generating-inside' ||
      status === 'inside-ready' ||
      status === 'inside-failed' ||
      status === 'completed' ||
      status === 'failed' ||
      isStartingGeneration);

  // (showSaving hook was here originally; moved above the early-returns
  // so the hook order stays consistent every render — see top of fn.)

  return (
    <div>
      {/* ── Top bar: optional Saving indicator + Close ─────────── */}
      <div className="flex items-center justify-end gap-3 mb-3 text-xs text-stone-500">
        {!isRevealMode && showSaving && (
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving…
          </span>
        )}
        <button
          type="button"
          onClick={() => setLocation('/studio')}
          className="text-stone-400 hover:text-stone-700 underline underline-offset-2"
          data-testid="link-start-over"
        >
          Close
        </button>
      </div>

      {/* ── Stepper (global nav) — hidden during the reveal so the
          user isn't tempted to mid-render-rewind, and so nothing
          competes with the card itself. */}
      {!isRevealMode && editingStep === null && (
        <div className="mb-6 sm:mb-8">
          <Stepper
            currentStep={currentStep}
            furthestStep={furthestStep}
            onStepClick={setStep}
          />
        </div>
      )}
      {editingStep !== null && (
        <div className="mb-6 sm:mb-8">
          <button
            type="button"
            onClick={() => void finishEditing()}
            className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-ink transition-colors"
            data-testid="btn-edit-overlay-breadcrumb"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to review
          </button>
        </div>
      )}

      {/* ── Step panel — conversational title lives inside. During
          reveal mode the white panel + border are dropped so the
          canvas can bleed (Hero Card pattern). */}
      <div
        className={
          isRevealMode
            ? 'min-h-[380px]'
            : 'bg-white border border-stone-200 rounded-2xl p-6 sm:p-10 min-h-[380px]'
        }
      >
        {/* Fade-up transition between steps. Outer panel stays put so
            the white card doesn't flicker; only the h1 + body animate.
            Key on currentStep so each advance remounts the motion div
            and replays the enter. Reduced-motion users get an instant
            swap (0 duration, no transform). */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={displayStep}
            initial={
              prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.22,
              ease: 'easeOut',
            }}
          >
            {/* h1 uses the same max-w-2xl + mx-auto as the step body below
                so it aligns with the form on desktop (Recipient is narrower
                at max-w-xl — close enough; the h1 left edge matches the
                wider form grid). Suppressed entirely during reveal mode
                (Review step, Generate pressed) — the 3D card is the
                subject, we don't want text above it. */}
            {!isRevealMode && (
              <h1 className="max-w-2xl mx-auto text-xl sm:text-2xl font-semibold text-stone-900 mb-5 sm:mb-6">
                {stepHeadline}
              </h1>
            )}

            {/* Step order: Recipient → Photo → Scene → Style → Front → Inside → Review.
                Photo moved to position 2 (index 1) so the emotional "we've got
                them" moment happens before the blank scene textarea. Front text
                (index 4) was added 2026-04-19 so the user sees + can edit the
                headline that's always been rendered on the card front. */}
            {displayStep === 0 && (
              <RecipientStep
                state={state}
                onChange={update}
                onAdvance={() => handleAutoAdvance(0)}
              />
            )}
            {displayStep === 1 && (
              <PhotoStep
                state={state}
                onChange={update}
                editIntent={editingStep !== null}
              />
            )}
            {displayStep === 2 && (
              <SceneStep state={state} onChange={update} cardId={cardId} />
            )}
            {/* Step 3 is FRONT TEXT in V1 (Style step removed — parked for
                Celebrait Premium; see CARD_MAKER_STEPS comment in
                shared/models/card-draft.ts). All step indices below
                shifted down by one accordingly. */}
            {displayStep === 3 && <FrontStep state={state} onChange={update} />}
            {displayStep === 4 && (
              <InsideStep
                cardId={cardId}
                state={state}
                onChange={update}
                scheduleSave={scheduleSave}
                flushSave={flushSave}
              />
            )}
            {displayStep === 5 && (
              <ReviewStep
                cardId={cardId}
                state={state}
                status={status}
                stepIndexById={stepIndexById}
                scheduleSave={scheduleSave}
                flushSave={flushSave}
                onJumpToStep={jumpToStepForEdit}
                onJumpToStepFromFailure={handleOpenFixDialog}
                onJumpToStepFromRegenFailure={handleOpenFixDialogRegen}
                onChange={update}
                onUpdateInputs={async (patch) => {
                  // Combined patch + flush — used by the photo/style
                  // pill controls in RegenEditMode so a swap persists
                  // before the next regen reads the saved state.
                  update(patch);
                  await flushSave();
                }}
                onRetry={handleRetryGeneration}
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
                        description: `You've made ${err.used} cards today (${err.limit} max). Try again tomorrow.`,
                        variant: 'destructive',
                      });
                    } else {
                      toast({
                        title: "Couldn't start making your card",
                        description: err.message,
                        variant: 'destructive',
                      });
                    }
                  });
                }}
                isGenerating={isStartingGeneration}
                generatedFrontUrl={frontImageUrl}
                generatedInsideUrl={insideImageUrl}
                attempts={attempts}
                isRegenerating={isRegenerating}
                regenError={regenError}
                onRegenerate={regenerate}
                onSelectAttempt={selectAttempt}
                onStartInsideGeneration={startInsideGeneration}
                onFinalize={finalizeCard}
                failure={failure}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      {/* The Review step owns its own Generate button, and once a
          generation is in flight (or complete) there's nothing useful
          to do with Back. Hide the whole nav on the Review step
          except when the user is still on the review summary and
          might want to go back to the Inside step. */}
      {/* Edit-overlay nav: one action, back to Review. Gated on the
          step being complete so a half-cleared field can't return to a
          Review that would then fail generation. */}
      {editingStep !== null && (
        <div className="flex items-center justify-end mt-6">
          <Button
            onClick={() => void finishEditing()}
            disabled={!isStepReady(editingStep, state)}
            className="bg-brand hover:bg-brand-dark text-brand-foreground disabled:opacity-50"
            data-testid="btn-edit-overlay-done"
          >
            Done — back to review
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
      {editingStep === null && !isLast && (
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={isFirst}
            className="text-stone-600"
            data-testid="btn-card-maker-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canAdvance}
            className="bg-brand hover:bg-brand-dark text-brand-foreground disabled:opacity-50"
            data-testid="btn-card-maker-next"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
      {editingStep === null && isLast && (status === null || status === 'draft') && (
        <div className="flex items-center justify-start mt-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="text-stone-600"
            data-testid="btn-card-maker-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </div>
      )}

      {/* ── Fix-and-retry dialog ────────────────────────────────────
          Opens from the GenerationErrorPanel's action chips when the
          card is in 'failed' status. Contained edit-and-retry surface
          — the user fixes one input + sees the others as reminders +
          retries, all without leaving the failure context. */}
      <FixAndRetryDialog
        open={fixDialogOpen}
        onOpenChange={setFixDialogOpen}
        initialEditor={fixDialogEditor}
        state={state}
        onSaveAndRetry={dialogSaveHandler}
        isRetrying={
          // For initial-gen retries, parent's startGeneration is what
          // tracks "in flight"; for regen retries, isRegenerating != null.
          // Either signal means the dialog's CTA should reflect pending.
          fixDialogContext.mode === 'initial'
            ? isStartingGeneration
            : isRegenerating !== null
        }
      />
    </div>
  );
}

// Per-step readiness gate. Steps that haven't been built yet default
// to "ready" (true) so the Next button works through the whole flow;
// as each step arrives it gains its own isXStepReady check here.
// Step indexes follow CARD_MAKER_STEPS (V1 — Style step removed):
//   0 recipient, 1 photo, 2 scene, 3 front, 4 inside, 5 review
function isStepReady(stepIndex: number, state: CardDraftState): boolean {
  if (stepIndex === 0) return isRecipientStepReady(state);
  if (stepIndex === 1) return isPhotoStepReady(state);
  if (stepIndex === 2) return isSceneStepReady(state);
  if (stepIndex === 3) return isFrontStepReady(state);
  if (stepIndex === 4) return isInsideStepReady(state);
  return true;
}

// Conversational h1 per step. Name-weaves where we have a recipient
// name; graceful fallback otherwise. Shown above the stepper as the
// page's primary voice — the stepper itself stays short-noun for
// scannability (those are navigation, not narrative).
function getStepHeadline(stepId: StepId, state: CardDraftState): string {
  const name = state.recipient?.name?.trim();
  const occasionKey = state.recipient?.occasion?.trim();
  // Occasion label weaves into "Aidan's birthday card" format — lowercase
  // because it's mid-sentence. 'other' means the preset didn't match, so
  // we drop the label and fall back to just "card" to avoid awkward copy.
  const occasionLabel =
    occasionKey && occasionKey !== 'other'
      ? getOccasionLabel(occasionKey).toLowerCase()
      : '';
  const cardNoun = occasionLabel ? `${occasionLabel} card` : 'card';
  const ownedCard = name ? `${name}'s ${cardNoun}` : `the ${cardNoun}`;

  switch (stepId) {
    case 'recipient':
      return "Who's this card for?";
    case 'photo':
      return 'Upload Photo(s)';
    case 'scene':
      return `Describe the scene for the front of ${ownedCard}`;
    case 'front':
      return `What should it say on the front of ${ownedCard}?`;
    case 'inside':
      return `What should it say inside ${ownedCard}?`;
    case 'review':
      // Reroll (Start-again clone): NO hardcoded number — the take
      // number + the whole family live in the Review body's TakesStrip
      // (it has the family query; this h1 only has `state`). The old
      // "take two" was wrong from take 3 onward (Kevin 2026-07-09).
      if (state.rerollOfCardId) {
        return name ? `${name}'s card — another take` : 'Another take';
      }
      return name
        ? `${name}'s card — take one last look`
        : 'Take one last look';
  }
}

