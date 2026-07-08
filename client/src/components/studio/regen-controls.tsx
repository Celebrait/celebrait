// client/src/components/studio/regen-controls.tsx
//
// ⚠️ PARKED FOR PREMIUM — 2026-07-07 (Kevin's launch call).
// The tweak workbench is UNMOUNTED from every surface (review-step +
// studio-card-view). Reasoning: the refine/edit pipeline is a
// different, less mature engine than the crafted initial-generation
// prompt, and pre-payment economics favour one deliberate re-roll
// ("Start again with these details" → StartAgainButton +
// /drafts/:id/duplicate) over open-ended surgical tweaks. Preserved
// intact — like the inside-text helper — for revival under Celebrait
// Premium, where a capped "keep the art, change one detail" power
// tool belongs. See memory: regen launch decision 2026-07-07.
//
//
// REGEN EDIT MODE — full-screen "workbench" surface for iterating on
// a generated card. The reveal screen's "Make a change" pill flips
// here; the Back button (or "Use this version" CTA) flips back.
//
// 2026-06-01 layout (Kevin): show BOTH sides at once.
//   • Front + Inside previews side-by-side (even on mobile) so the user
//     sees the whole card they're editing — like an open card.
//   • Front + Inside tweak boxes BOTH visible, stacked beneath. The rule
//     that makes this safe: a BLANK box means "leave that side exactly as
//     it is" — only the side(s) you actually type in get regenerated.
//     This is what the old "Both" target got wrong (it regenerated both
//     regardless, which is what caused "it remade the whole card").
//   • One submit. Disabled only when both boxes are blank.
//
// Concurrency: when both boxes are filled we fire two independent
// fire-and-forget regens. The per-side "busy" signal is derived from the
// attempt list (+ a local fired-baseline for the pre-first-poll window),
// so both previews spin independently and the "your new version is ready"
// decision panel only appears once BOTH sides have finished. This keeps
// the G1 (silent-failure) and "landing too early" fixes intact under
// concurrency. See next_regen_interaction_polish.md.
//
// Two-mode state machine (unchanged in spirit):
//   mode='tweaking' (default) → previews + text boxes + submit visible.
//   mode='deciding' (entered when a regen completes) → text boxes hidden,
//     a "Use this version" / "Keep tweaking" decision panel takes over.
//
// Loop semantics:
//   • Switching versions via a side's rail is non-destructive — the
//     server just updates which attempt is "selected"; nothing deleted.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Loader2, PenLine } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CardThumb } from '@/components/studio/card-thumb';
import { HowTweakingWorks } from '@/components/studio/how-tweaking-works';
import {
  GenerationErrorPanel,
  type GenerationErrorKind,
} from '@/components/studio/generation-error-panel';
import type { CardAttemptDTO } from '@/hooks/use-card-maker';
import type { CardSide, CardDraftState } from '@shared/schema';

interface RegenEditModeProps {
  /** Recipient + occasion drive the header subtitle. */
  state: CardDraftState;
  frontUrl: string | null;
  insideUrl: string | null;
  /** All attempts (front + inside, completed + in-flight). */
  attempts: CardAttemptDTO[];
  /** Which side is regenerating right now, or null. A hint from the
   *  parent; the component also derives per-side busy from `attempts`
   *  so it survives concurrent (front+inside) regens. */
  isRegenerating: CardSide | null;
  /** Poll-detected background-regen failure. Drives the inline error
   *  panel — fire-and-forget regens can't throw to handleSubmit's catch,
   *  so this is how a failure surfaces. See
   *  next_regen_interaction_polish.md (G1). */
  regenError?: import('@/hooks/use-card-maker').RegenError | null;
  /** True when the card has an inside (write or blank). */
  hasInside: boolean;
  onRegenerate: (side: CardSide, tweak?: string) => Promise<void>;
  onSelectAttempt: (attemptId: number) => Promise<void>;
  /** Exit edit mode and return to the reveal layout. */
  onExit: () => void;
  /** Open the parent's fix-and-retry dialog in regen mode. Called by
   *  the inline <GenerationErrorPanel> chips when a regen safety
   *  failure happens, with the side that just failed so the dialog's
   *  retry fires the right regen. Optional. */
  onJumpToStepFromRegenFailure?: (
    stepId: 'scene' | 'photo',
    side: CardSide,
  ) => void;
  /** Patch the draft AND flush to server. Currently unused inside the
   *  component (regen is text-tweak only) — kept on the interface because
   *  callers still pass it and a future input-changing intent would want
   *  it. */
  onUpdateInputs: (patch: Partial<CardDraftState>) => Promise<void>;
  /** Header title override. Default 'Tweak your card'. */
  title?: string;
  /** Override for the finish/commit action label ('Use this card' /
   *  'Use this version'). When set, the header "Back to your card" exit is
   *  hidden and the commit buttons read as a forward step — used by the
   *  front-first flow to show 'Looks good — write the inside →', so onExit
   *  means "approve this front + generate the inside". */
  finishLabel?: string;
  /** When set, that side is a read-only REMINDER — its preview shows but
   *  its version rail + tweak box are hidden (already signed off). Used by
   *  the inside-ready step: lock the front, edit only the inside. */
  lockedSide?: 'front' | 'inside';
  /** Replace the default thumb previews with a custom node (e.g. the
   *  print-style spread). Receives the currently-displayed image URLs so
   *  it reflects the selected version. The version rails for editable
   *  sides still render beneath it. */
  renderPreview?: (args: { frontUrl: string | null; insideUrl: string | null }) => React.ReactNode;
}

/** Soft cap — show the "sometimes the first one was the one" nudge
 *  once a side has this many completed attempts. */
const SOFT_CAP_PER_SIDE = 3;

/** Hard cap — tweaks allowed per side before the box swaps for a
 *  "start fresh" panel (Kevin 2026-07-07: past a handful, tweaks stop
 *  converging — a fresh card beats attempt #9). MUST match the
 *  server's REGEN_HARD_CAP_PER_SIDE (background-generator.ts), which
 *  is the real enforcement — this constant only surfaces it kindly
 *  before the 429 would. */
const REGEN_HARD_CAP_PER_SIDE_UI = 8;

/** Two-mode state machine. See file header. */
type Mode = 'tweaking' | 'deciding';

export function RegenEditMode({
  state,
  frontUrl,
  insideUrl,
  attempts,
  isRegenerating,
  regenError,
  hasInside,
  onRegenerate,
  onSelectAttempt,
  onExit,
  onJumpToStepFromRegenFailure,
  title = 'Tweak your card',
  finishLabel,
  lockedSide,
  renderPreview,
}: RegenEditModeProps) {
  // Per-side tweak text. Blank = "leave that side as-is" (no regen).
  const [tweakFront, setTweakFront] = useState('');
  const [tweakInside, setTweakInside] = useState('');

  const frontTextareaRef = useRef<HTMLTextAreaElement>(null);
  const insideTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // G3 — scroll to the top of the edit surface on entry. The reveal the
  // user came from may have been scrolled down, so without this the edit
  // mode opens mid-page (card + controls below the fold = the "scroll
  // jump"). Instant (not smooth) so it doesn't race the surface's fade-in.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // G6 — autofocus the Front tweak box when the user RE-enters tweaking
  // (clicks "Keep tweaking"), but NOT on first landing (that would pop the
  // mobile keyboard over the card before they've even looked at it). Starts
  // false; flipped true the first time enterTweakingMode runs, so every
  // keep-tweaking pass lands the cursor ready to type.
  const [autoFocusTweak, setAutoFocusTweak] = useState(false);

  // ── Regen failure state ────────────────────────────────────────────
  // When a regen fails (safety / rate / server / 503), capture the
  // structured ProviderError fields here and render an inline
  // <GenerationErrorPanel> above the previews — a persistent, on-brand
  // surface the user can act on, not a disappearing red toast.
  type RegenFailure = {
    kind: GenerationErrorKind;
    modelExplanation: string | null;
    suggestions: string[] | null;
    provider: string | null;
    code: string | null;
    /** Which side failed — drives the dialog's regen target on a chip click. */
    side: CardSide;
  };
  const [regenFailure, setRegenFailure] = useState<RegenFailure | null>(null);

  const frontAttempts = attempts
    .filter((a) => a.side === 'front')
    .sort((a, b) => a.attemptNumber - b.attemptNumber);
  const insideAttempts = attempts
    .filter((a) => a.side === 'inside')
    .sort((a, b) => a.attemptNumber - b.attemptNumber);

  const completedFront = frontAttempts.filter((a) => a.status === 'completed');
  const completedInside = insideAttempts.filter((a) => a.status === 'completed');
  const totalAttempts = completedFront.length + completedInside.length;

  // Hard-cap accounting — mirrors the server's check (ALL attempt rows
  // for the side, minus the seeded original #1). Failed attempts count:
  // they cost a generation.
  const frontRegensUsed = Math.max(0, frontAttempts.length - 1);
  const insideRegensUsed = Math.max(0, insideAttempts.length - 1);
  const frontCapped = frontRegensUsed >= REGEN_HARD_CAP_PER_SIDE_UI;
  const insideCapped = insideRegensUsed >= REGEN_HARD_CAP_PER_SIDE_UI;
  // Every side the user could still tweak is capped → the workbench
  // can only commit or start over.
  const editableSides: CardSide[] = [
    ...(lockedSide !== 'front' ? (['front'] as const) : []),
    ...(hasInside && lockedSide !== 'inside' ? (['inside'] as const) : []),
  ];
  const allEditableCapped =
    editableSides.length > 0 &&
    editableSides.every((s) => (s === 'front' ? frontCapped : insideCapped));

  // ── Per-side busy model (concurrency-safe) ─────────────────────────
  // A side is "busy" from the moment the user submits a tweak for it
  // until a NEW completed attempt lands (or it fails). We track a local
  // "fired" baseline (the completed-count at submit time) so the spinner
  // shows IMMEDIATELY — before the first 2s poll creates the 'generating'
  // attempt row — and clears exactly when a new version arrives. The
  // server's 'generating' attempt status is OR'd in as a belt-and-braces
  // signal. Both sides are independent, so front+inside regens don't
  // fight over a single flag.
  const [firedFront, setFiredFront] = useState<number | null>(null);
  const [firedInside, setFiredInside] = useState<number | null>(null);

  // Clear a side's busy when a new version lands (success) or it fails.
  // On SUCCESS also clear that side's tweak box — the instruction has been
  // carried out, so a follow-up "keep tweaking" pass starts blank and the
  // blank-skip rule holds (a stale instruction won't silently re-regen a
  // side you didn't mean to touch). On FAILURE keep the text so the user
  // can retry or edit it.
  useEffect(() => {
    if (firedFront === null) return;
    if (completedFront.length > firedFront) {
      setFiredFront(null);
      setTweakFront('');
    } else if (regenError?.side === 'front') {
      setFiredFront(null);
    }
  }, [completedFront.length, regenError, firedFront]);
  useEffect(() => {
    if (firedInside === null) return;
    if (completedInside.length > firedInside) {
      setFiredInside(null);
      setTweakInside('');
    } else if (regenError?.side === 'inside') {
      setFiredInside(null);
    }
  }, [completedInside.length, regenError, firedInside]);

  const frontServerBusy = frontAttempts.some((a) => a.status === 'generating');
  const insideServerBusy = insideAttempts.some((a) => a.status === 'generating');
  const frontBusy =
    firedFront !== null || frontServerBusy || isRegenerating === 'front';
  const insideBusy =
    firedInside !== null || insideServerBusy || isRegenerating === 'inside';
  const anyBusy = frontBusy || insideBusy;

  // Auto-clear the failure panel when a new regen kicks off.
  useEffect(() => {
    if (anyBusy) setRegenFailure(null);
  }, [anyBusy]);

  // G1: map the poll-detected background failure into the local panel.
  useEffect(() => {
    if (!regenError) return;
    const VALID = ['safety', 'rate', 'server', 'auth', 'unknown'];
    const kind = (
      VALID.includes(regenError.kind) ? regenError.kind : 'unknown'
    ) as GenerationErrorKind;
    setRegenFailure({
      kind,
      modelExplanation: null,
      suggestions: null,
      provider: null,
      code: null,
      side: regenError.side,
    });
  }, [regenError]);

  // ── Mode state machine ────────────────────────────────────────────
  // Flip to 'deciding' when ALL in-flight regens finish (anyBusy goes
  // true→false). On failure stay in 'tweaking' so the error panel + the
  // boxes show. Driven off anyBusy (not the single isRegenerating prop)
  // so a concurrent both-sides regen waits for BOTH before deciding.
  const [mode, setMode] = useState<Mode>('tweaking');
  const wasBusyRef = useRef(false);
  useEffect(() => {
    if (wasBusyRef.current && !anyBusy) {
      setMode(regenError ? 'tweaking' : 'deciding');
    }
    wasBusyRef.current = anyBusy;
  }, [anyBusy, regenError]);

  const enterTweakingMode = () => {
    setAutoFocusTweak(true);
    setMode('tweaking');
  };

  const showSoftCap =
    completedFront.length >= SOFT_CAP_PER_SIDE ||
    completedInside.length >= SOFT_CAP_PER_SIDE;

  // ── Blank-skip submit ──────────────────────────────────────────────
  const frontBlank = tweakFront.trim().length === 0;
  const insideBlank = !hasInside || tweakInside.trim().length === 0;
  const bothBlank = frontBlank && insideBlank;

  // When nothing's typed, the user isn't asking to change anything — the
  // primary action is to COMMIT the selected versions and head back to the
  // card (the 3D render + pay path), not to regenerate. This gives a
  // concrete "I'm done, use these" affordance in the resting state instead
  // of a disabled "Make a new version" dead-end. When a change is typed the
  // primary flips back to the regen action.
  const committing = !anyBusy && bothBlank;

  const handleSubmit = async () => {
    const front = tweakFront.trim() || undefined;
    const inside = hasInside ? tweakInside.trim() || undefined : undefined;
    if (!front && !inside) return; // both blank — nothing to do

    // Failure-panel retry target: prefer the front side if it's in play.
    const submitSide: CardSide = front ? 'front' : 'inside';

    // Optimistic per-side busy — spinner shows instantly.
    if (front) setFiredFront(completedFront.length);
    if (inside) setFiredInside(completedInside.length);

    try {
      // Only the filled side(s) regenerate; a blank side is left untouched.
      if (front) await onRegenerate('front', front);
      if (inside) await onRegenerate('inside', inside);
    } catch (err: any) {
      // POST failed before an attempt row was created — clear the
      // optimistic busy so the spinner doesn't hang, and surface the error.
      setFiredFront(null);
      setFiredInside(null);
      const kind = (err?.kind ?? null) as GenerationErrorKind | null;
      setRegenFailure({
        kind: kind ?? 'unknown',
        modelExplanation: err?.modelExplanation ?? null,
        suggestions: err?.suggestions ?? null,
        provider: err?.provider ?? null,
        code: err?.code ?? null,
        side: submitSide,
      });
    }
  };

  const handleRetryRegen = async () => {
    setRegenFailure(null);
    await handleSubmit();
  };

  // ── Optimistic version switching ─────────────────────────────────
  // Preload every attempt image (hidden) so rail clicks are instant; set
  // the clicked URL locally before the server roundtrip so the thumb
  // swaps with no flicker.
  const [optimisticFrontUrl, setOptimisticFrontUrl] = useState<string | null>(
    null,
  );
  const [optimisticInsideUrl, setOptimisticInsideUrl] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (optimisticFrontUrl && optimisticFrontUrl === frontUrl) {
      setOptimisticFrontUrl(null);
    }
  }, [frontUrl, optimisticFrontUrl]);
  useEffect(() => {
    if (optimisticInsideUrl && optimisticInsideUrl === insideUrl) {
      setOptimisticInsideUrl(null);
    }
  }, [insideUrl, optimisticInsideUrl]);

  // G7: when ALL regens end, drop any leftover optimistic rail override —
  // a fresh regen promotes a new image that never equals the user's
  // earlier optimistic url, so the exact-match clears above wouldn't fire.
  const prevAnyBusyRef = useRef(false);
  useEffect(() => {
    if (prevAnyBusyRef.current && !anyBusy) {
      setOptimisticFrontUrl(null);
      setOptimisticInsideUrl(null);
    }
    prevAnyBusyRef.current = anyBusy;
  }, [anyBusy]);

  const displayedFrontUrl = optimisticFrontUrl ?? frontUrl;
  const displayedInsideUrl = optimisticInsideUrl ?? insideUrl;

  const handleSelect = async (attemptId: number) => {
    const attempt = attempts.find((a) => a.id === attemptId);
    if (attempt?.imageUrl) {
      if (attempt.side === 'front') setOptimisticFrontUrl(attempt.imageUrl);
      else setOptimisticInsideUrl(attempt.imageUrl);
    }
    try {
      await onSelectAttempt(attemptId);
    } catch (err: any) {
      if (attempt?.side === 'front') setOptimisticFrontUrl(null);
      else if (attempt?.side === 'inside') setOptimisticInsideUrl(null);
      toast({
        title: "Couldn't switch version",
        description: err?.message ?? 'Try again in a moment.',
        variant: 'destructive',
      });
    }
  };

  // Header subtitle — recipient.
  const recipient = state.recipient?.name?.trim();
  const occasion = state.recipient?.occasion?.trim();
  const subtitleSubject = recipient
    ? occasion
      ? `${recipient}'s ${occasion} card`
      : `${recipient}'s card`
    : 'Your card';

  // Time hint — two boxes filled ≈ two sequenced gens.
  const willRegenBoth = !frontBlank && !insideBlank;
  const timeHint = willRegenBoth ? '~90s · two new versions' : '~45s';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="max-w-2xl mx-auto px-4 sm:px-6 pb-32 sm:pb-12"
      data-testid="regen-edit-mode"
    >
      {/* Header — action title + recipient subtitle + back button */}
      <div className="flex items-start justify-between gap-3 py-4 mb-1">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-ink leading-tight">
            {title}
          </h1>
          <p className="text-xs text-stone-500 truncate mt-0.5">
            {subtitleSubject}
          </p>
        </div>
        {/* In the front-first context (finishLabel set) there's no card to
            go "back" to yet — the forward action is the commit button. */}
        {!finishLabel && (
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-ink transition-colors shrink-0 pt-1"
            data-testid="btn-regen-exit"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to your card</span>
            <span className="sm:hidden">Back</span>
          </button>
        )}
      </div>

      {/* One-line nudge + the "How tweaking works" module (detail one tap
          away rather than a wall of text pushing the card down). */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[12px] text-stone-500 leading-snug">
          Small, specific changes work best — swap a detail, shift the
          mood, fix the words. Your photo &amp; likeness stay put. Want a
          different scene entirely? That's a new card, not a tweak.
        </p>
        <HowTweakingWorks />
      </div>

      {/* Inline failure panel (G1) — surfaces a background regen failure
          the moment it's polled, with the existing card preserved below. */}
      {regenFailure && (
        <div className="mb-5">
          <GenerationErrorPanel
            kind={regenFailure.kind}
            modelExplanation={regenFailure.modelExplanation}
            suggestions={regenFailure.suggestions}
            provider={regenFailure.provider}
            code={regenFailure.code}
            context="regen"
            onRetry={handleRetryRegen}
            onJumpToStep={(editor) => {
              if (onJumpToStepFromRegenFailure) {
                onJumpToStepFromRegenFailure(editor, regenFailure.side);
              }
            }}
            isRetrying={anyBusy}
          />
        </div>
      )}

      {/* Previews — Front + Inside side-by-side (even on mobile, Kevin's
          call). Two independent thumbs so each spins on its own when both
          sides regenerate at once. Each column carries its own version
          rail beneath. Single column when the card has no inside. */}
      {renderPreview ? (
        <div className="mb-5">
          {renderPreview({ frontUrl: displayedFrontUrl, insideUrl: displayedInsideUrl })}
          {(completedFront.length > 1 || completedInside.length > 1) && (
            <div className="mt-3 flex flex-wrap items-start justify-center gap-x-8 gap-y-2">
              {lockedSide !== 'front' && completedFront.length > 1 && (
                <VersionRail
                  attempts={completedFront}
                  side="front"
                  onSelect={handleSelect}
                  disabled={anyBusy}
                />
              )}
              {hasInside && lockedSide !== 'inside' && completedInside.length > 1 && (
                <VersionRail
                  attempts={completedInside}
                  side="inside"
                  onSelect={handleSelect}
                  disabled={anyBusy}
                />
              )}
            </div>
          )}
        </div>
      ) : (
      <div
        className={`grid ${hasInside ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mb-5`}
        data-testid="regen-previews"
      >
        <div>
          <CardThumb
            frontUrl={displayedFrontUrl}
            insideUrl={null}
            target="front"
            hasInside
            regeneratingSide={frontBusy ? 'front' : null}
          />
          {lockedSide === 'front' ? (
            <p className="mt-1.5 text-center text-[11px] text-stone-400">
              Front — signed off ✓
            </p>
          ) : (
            <VersionRail
              attempts={completedFront}
              side="front"
              onSelect={handleSelect}
              disabled={anyBusy}
            />
          )}
        </div>
        {hasInside && (
          <div>
            <CardThumb
              frontUrl={null}
              insideUrl={displayedInsideUrl}
              target="inside"
              hasInside
              regeneratingSide={insideBusy ? 'inside' : null}
            />
            {lockedSide === 'inside' ? (
              <p className="mt-1.5 text-center text-[11px] text-stone-400">
                Inside — signed off ✓
              </p>
            ) : (
              <VersionRail
                attempts={completedInside}
                side="inside"
                onSelect={handleSelect}
                disabled={anyBusy}
              />
            )}
          </div>
        )}
      </div>
      )}

      {/* Image preload — hidden <img> tags so rail clicks feel instant. */}
      <div
        aria-hidden
        className="absolute -left-[9999px] top-0 w-0 h-0 overflow-hidden"
      >
        {[...completedFront, ...completedInside].map((a) =>
          a.imageUrl ? (
            <img
              key={`preload-${a.id}`}
              src={a.imageUrl}
              alt=""
              loading="eager"
              decoding="async"
              width={1}
              height={1}
            />
          ) : null,
        )}
      </div>

      {/* popLayout cross-fade between the decision panel and the authoring
          surface — no zero-height reflow gap (G5). `relative` gives the
          exiting (absolutely-positioned) panel a containing block. */}
      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {mode === 'deciding' && !anyBusy ? (
            <motion.div
              key="decision-panel"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="mb-4 rounded-2xl border-2 border-brand/30 bg-gradient-to-br from-brand-muted/60 via-white to-brand-muted/40 p-5 sm:p-6 shadow-sm"
              data-testid="regen-decision-panel"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-ink">
                    Your new version is ready
                  </p>
                  <p className="text-xs text-stone-600 mt-0.5">
                    {totalAttempts > 1
                      ? 'Like it? Use it as your card. Or keep tweaking — earlier versions are still saved below each side.'
                      : 'Like it? Use it as your card. Or keep tweaking — every try is saved so you can compare.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  size="lg"
                  onClick={onExit}
                  className="bg-brand hover:bg-brand-dark text-brand-foreground sm:flex-1 shadow-md shadow-brand/20"
                  data-testid="btn-decision-use"
                >
                  <Check className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
                  {finishLabel ?? 'Use this version'}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={enterTweakingMode}
                  className="border-brand/40 bg-white text-brand-dark hover:bg-brand-muted sm:flex-1"
                  data-testid="btn-decision-keep-tweaking"
                >
                  <PenLine className="w-4 h-4 mr-1.5" />
                  Keep tweaking
                </Button>
              </div>
              {showSoftCap && (
                <p
                  className="text-[11px] italic text-stone-500 text-center mt-4"
                  data-testid="regen-soft-cap-deciding"
                >
                  Sometimes the first one was the one — flip back through the
                  versions before trying again.
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="tweaking-surface"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* Tweak boxes — one per side, blank = leave that side as-is. */}
              <p className="text-sm text-ink font-medium mb-2">
                Tell us what to change.{' '}
                {hasInside && !lockedSide && (
                  <span className="text-stone-500 font-normal">
                    Leave a box blank to keep that side as it is.
                  </span>
                )}
              </p>
              <div className="mb-4 space-y-3">
                {lockedSide !== 'front' &&
                  (frontCapped ? (
                    <SideCappedPanel side="Front" />
                  ) : (
                    <div>
                      <SidedTweakInput
                        label="Front"
                        value={tweakFront}
                        onChange={setTweakFront}
                        placeholder='e.g. "make it more autumnal" or "swap the dog for a cat"'
                        onSubmit={handleSubmit}
                        inputRef={frontTextareaRef}
                        disabled={anyBusy}
                        autoFocus={autoFocusTweak}
                        testId="input-regen-tweak-front"
                      />
                      <TweaksLeftHint
                        used={frontRegensUsed}
                        cap={REGEN_HARD_CAP_PER_SIDE_UI}
                      />
                    </div>
                  ))}
                {hasInside &&
                  lockedSide !== 'inside' &&
                  (insideCapped ? (
                    <SideCappedPanel side="Inside" />
                  ) : (
                    <div>
                      <SidedTweakInput
                        label="Inside"
                        value={tweakInside}
                        onChange={setTweakInside}
                        placeholder='e.g. "tidier handwriting" or "warmer tone"'
                        onSubmit={handleSubmit}
                        inputRef={insideTextareaRef}
                        disabled={anyBusy}
                        testId="input-regen-tweak-inside"
                      />
                      <TweaksLeftHint
                        used={insideRegensUsed}
                        cap={REGEN_HARD_CAP_PER_SIDE_UI}
                      />
                    </div>
                  ))}
              </div>

              {showSoftCap && !anyBusy && (
                <p
                  className="text-[11px] italic text-stone-500 text-center mb-4"
                  data-testid="regen-soft-cap"
                >
                  Sometimes the first one was the one — flip back through the
                  versions before trying again.
                </p>
              )}

              {/* Start over — escape to a wholly different card. Promoted
                  to a proper panel when every editable side has hit the
                  hard cap (there's nothing left to tweak). */}
              {allEditableCapped ? (
                <div
                  className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-center"
                  data-testid="regen-all-capped"
                >
                  <p className="text-sm font-medium text-ink">
                    You've taken this design as far as tweaks go.
                  </p>
                  <p className="mt-1 text-xs text-stone-600">
                    Pick your favourite from the versions above — or if none
                    of them are the one,{' '}
                    <Link
                      href="/studio/new-card"
                      className="font-medium text-brand hover:text-brand-dark"
                      data-testid="regen-start-over"
                    >
                      start a fresh card →
                    </Link>
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-ink-soft text-center mb-4">
                  Want a different card altogether?{' '}
                  <Link
                    href="/studio/new-card"
                    className="text-brand hover:text-brand-dark font-medium"
                    data-testid="regen-start-over"
                  >
                    Start over →
                  </Link>
                </p>
              )}

              {/* Submit — sticky-bottom on mobile so it stays above the
                  keyboard. G6: bottom padding adds the safe-area inset so
                  the bar clears the iPhone home indicator / gesture bar
                  instead of sitting under it. */}
              <div className="fixed sm:static bottom-0 inset-x-0 px-4 sm:px-0 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:py-0 bg-white/95 sm:bg-transparent backdrop-blur sm:backdrop-blur-0 border-t sm:border-0 border-stone-200">
                <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                  <p
                    className="text-[11px] text-stone-400 hidden sm:block"
                    data-testid="regen-time-hint"
                  >
                    {anyBusy
                      ? 'Crafting your new version…'
                      : committing
                        ? 'Happy with these? Or describe a change below.'
                        : timeHint}
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    // Contextual primary: commit-and-go when nothing's typed,
                    // regenerate when a change is described.
                    onClick={committing ? onExit : handleSubmit}
                    disabled={anyBusy}
                    className="bg-brand hover:bg-brand-dark text-brand-foreground w-full sm:w-auto"
                    data-testid={committing ? 'btn-regen-use' : 'btn-regen-submit'}
                  >
                    {anyBusy ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Crafting your new version…
                      </>
                    ) : committing ? (
                      <>
                        <Check className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
                        {finishLabel ?? 'Use this card'}
                      </>
                    ) : (
                      'Make a new version'
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── VersionRail — per-side version history under a preview column.
// Shown only once a side has more than one completed version (a lone v1
// thumb would just duplicate the preview above it). Tap a thumb to switch
// the committed version for that side (non-destructive).
function VersionRail({
  attempts,
  side,
  onSelect,
  disabled,
}: {
  attempts: CardAttemptDTO[];
  side: CardSide;
  onSelect: (attemptId: number) => void;
  disabled: boolean;
}) {
  if (attempts.length <= 1) return null;
  const current = attempts.find((a) => a.isSelected);
  return (
    <div className="mt-2">
      {current && (
        <p className="text-center text-[10px] uppercase tracking-[0.16em] text-stone-400 mb-1">
          v{current.attemptNumber} of {attempts.length}
        </p>
      )}
      <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-1">
        {attempts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a.id)}
            disabled={disabled || a.isSelected}
            className={`relative w-12 h-12 rounded-md overflow-hidden border-2 transition-all flex-shrink-0 ${
              a.isSelected
                ? 'border-brand shadow-sm shadow-brand/20'
                : 'border-stone-200 hover:border-brand/60 opacity-80 hover:opacity-100'
            } disabled:cursor-not-allowed`}
            aria-label={
              a.isSelected
                ? `Currently showing ${side} version ${a.attemptNumber}`
                : `Switch ${side} to version ${a.attemptNumber}`
            }
            data-testid={`regen-thumb-${side}-${a.attemptNumber}`}
          >
            {a.imageUrl ? (
              <img
                src={a.imageUrl}
                alt={`Version ${a.attemptNumber}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-stone-100" />
            )}
            <span
              className={`absolute bottom-0 inset-x-0 text-[9px] font-medium leading-none py-0.5 text-center ${
                a.isSelected
                  ? 'bg-brand text-brand-foreground'
                  : 'bg-black/45 text-white'
              }`}
            >
              v{a.attemptNumber}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── SidedTweakInput — labelled textarea row, one per side.
/** Quiet remaining-tweaks counter under a side's box. Silent until the
 *  soft-cap zone so early iteration feels unlimited; from there it sets
 *  the expectation that tweaks are finite BEFORE the hard stop. */
function TweaksLeftHint({ used, cap }: { used: number; cap: number }) {
  const left = cap - used;
  if (left > cap - SOFT_CAP_PER_SIDE) return null;
  return (
    <p className="mt-1 text-right text-[10.5px] text-stone-400" data-testid="tweaks-left-hint">
      {left === 1 ? 'Last tweak for this side' : `${left} tweaks left for this side`}
    </p>
  );
}

/** Replaces a side's tweak box once it hits the hard cap. */
function SideCappedPanel({ side }: { side: 'Front' | 'Inside' }) {
  return (
    <div
      className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3"
      data-testid={`regen-capped-${side.toLowerCase()}`}
    >
      <p className="text-xs font-medium text-stone-600">
        {side} — tweak limit reached
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">
        This side's been through every version it has in it. Flip back
        through the row above and pick the strongest one.
      </p>
    </div>
  );
}

function SidedTweakInput({
  label,
  value,
  onChange,
  placeholder,
  onSubmit,
  inputRef,
  disabled,
  autoFocus,
  testId,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  onSubmit: () => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  disabled?: boolean;
  autoFocus?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400 w-12 shrink-0 pt-2.5">
        {label}
      </p>
      <Textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        disabled={disabled}
        autoFocus={autoFocus}
        className="text-sm resize-none flex-1"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!disabled) onSubmit();
          }
        }}
        data-testid={testId}
      />
    </div>
  );
}
