// client/src/components/studio/regen-controls.tsx
//
// REGEN EDIT MODE — full-screen "workbench" surface for iterating on
// a generated card. The reveal screen's "Make a change" pill flips
// here; the Back button (or "Use this version" CTA) flips back.
//
// 2026-04-27 review pass (Kevin): the screen had the right mechanics
// but the scaffolding was too quiet — new users couldn't tell where
// they were, what was safe, or how long things would take. This pass:
//   • Action title + subtitle (was just the recipient's name).
//   • Persistent safety line: originals are kept, you can flip back.
//   • Single 3-way segmented control (Front / Inside / Both) — replaces
//     the 2-pill + italic-link pattern that hid Both as a tertiary action.
//   • "Currently showing v3 of 3" label above the thumb so the user
//     always knows which version is committed.
//   • Versions rail visible from v1 (not v2+), bigger thumbs (64×64
//     SQUARE — Celebrait cards are 5.5×5.5; the thumbs were briefly
//     portrait 56×72 between 2026-04-26 and 2026-04-30 which made
//     square outputs look distorted) so it's a real compare surface,
//     and clearer copy.
//   • Single submit-button label ("Make a new version") with a clean
//     loading state instead of 5 variants.
//   • Time hint always visible next to the submit button.
//
// 2026-04-27 second pass (Kevin again): "after a new gen renders we
// can lose the text boxes and let the user decide whether to use or
// tweak". Two-mode state machine:
//
//   mode='tweaking' (default + after "Keep tweaking" click)
//     → textarea + submit visible. Standard authoring surface.
//
//   mode='deciding' (entered automatically on regen completion)
//     → textarea + submit HIDDEN. Big "Use this version" / "Keep
//       tweaking" decision panel is the only action surface.
//
// Why: previously the post-regen banner sat *above* the still-visible
// textareas (with stale typed content) — two competing surfaces, no
// clear primary action. The new flow forces a decision before re-
// engaging with authoring, which matches how users actually think
// ("did the AI nail it? — yes/no").
//
// Tweak-text persistence (unchanged): when the user clicks "Keep
// tweaking", their typed tweak text is preserved so iteration stays
// warm ("warmer light" → "warmer light, less orange").
//
// Loop semantics (unchanged):
//   • Empty submit = pure re-roll. The coach copy labels this
//     explicitly ("…or leave blank for a fresh take").
//   • Switching versions via the rail is non-destructive — the server
//     just updates which attempt is "selected"; nothing is deleted.
//     Rail switching works in BOTH modes; in 'deciding' mode, the
//     decision panel keeps showing — "use this version" then refers
//     to whatever's active after the rail click.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Loader2, PenLine } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CardThumb, type ThumbTarget } from '@/components/studio/card-thumb';
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
  /** Which side is regenerating right now, or null. */
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
   *  retry fires the right regen. Optional — the panel falls back to
   *  hiding chips when not provided. */
  onJumpToStepFromRegenFailure?: (
    stepId: 'scene' | 'photo',
    side: CardSide,
  ) => void;
  /** Patch the draft AND flush to server. Was used by the photo/style
   *  pill controls to persist a swap before regen. Those intents are gone
   *  (regen is text-tweak only now), so this is currently unused inside
   *  the component — kept on the interface because callers still pass it
   *  and a future input-changing intent would want it. */
  onUpdateInputs: (patch: Partial<CardDraftState>) => Promise<void>;
}

/** Soft cap — show the "sometimes the first one was the one" nudge
 *  once a side has this many completed attempts. */
const SOFT_CAP_PER_SIDE = 3;

/** Approximate wait copy for a single-side tweak. */
const SINGLE_WAIT_LABEL = '~45s';

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
}: RegenEditModeProps) {
  // target is 'front' | 'inside' in practice — the 'both' member of
  // ThumbTarget is no longer reachable (the Both segment was removed
  // 2026-05-31). Typed as ThumbTarget only because <CardThumb> takes it.
  const [target, setTarget] = useState<ThumbTarget>('front');
  // Per-side tweak state. The single textarea reads/writes whichever side
  // `target` points at; we keep both so switching target preserves what
  // the user typed in either box. Cleared only by "Keep tweaking".
  const [tweakFront, setTweakFront] = useState('');
  const [tweakInside, setTweakInside] = useState('');

  // ── Regen failure state ────────────────────────────────────────────
  // When a regen attempt throws (safety filter, rate limit, server
  // overload, etc.), we capture the structured ProviderError fields
  // here and render <GenerationErrorPanel> inline above the regen
  // controls. Replaces the old destructive red toast for `safety` —
  // a persistent, on-brand panel the user can act on. Other kinds
  // (rate / server / unknown) still toast for now (they're transient
  // and don't need a persistent surface).
  //
  // Cleared on the next attempt (a new `isRegenerating` value), or
  // when the user dismisses the panel via "Try again" / a chip click.
  type RegenFailure = {
    kind: GenerationErrorKind;
    modelExplanation: string | null;
    suggestions: string[] | null;
    provider: string | null;
    code: string | null;
    /** Which side failed — drives the dialog's regen target if the
     *  user clicks a chip. 'both' falls back to 'front' (the side
     *  the regen pipeline runs first). */
    side: CardSide;
  };
  const [regenFailure, setRegenFailure] = useState<RegenFailure | null>(null);

  // Auto-clear the failure panel when a new regen kicks off — the
  // user is trying again, the failure surface is no longer relevant.
  useEffect(() => {
    if (isRegenerating !== null) setRegenFailure(null);
  }, [isRegenerating]);

  // G1: map the poll-detected background-regen failure (prop) into the
  // local failure panel. Fire-and-forget regens can't throw to
  // handleSubmit's catch, so this is how a server/safety/503 failure
  // actually reaches the UI. The errorCode column stores the kind; coerce
  // to a known GenerationErrorKind, else 'unknown'.
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

  // The regen flow used to be a wizard (pick scene / photo / style, then a
  // contextual surface). Photo + style intents were removed (2026-05-17 /
  // 2026-05-31), leaving the scene text-tweak as the only path — so the
  // intent picker and the photo/style state it drove are gone entirely
  // (dead-code cleanup, G8, 2026-06-01). What's left is just: type a tweak
  // for the chosen side, regenerate.

  const frontTextareaRef = useRef<HTMLTextAreaElement>(null);
  const insideTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Force target back to 'front' if hasInside flips off mid-flow.
  useEffect(() => {
    if (!hasInside && target !== 'front') setTarget('front');
  }, [hasInside, target]);

  // ── Mode state machine ────────────────────────────────────────────
  // Default 'tweaking' (textarea + submit visible). Flips to 'deciding'
  // automatically when a regen completes — the textarea hides, and a
  // big "Use this / Keep tweaking" decision panel takes over until the
  // user picks. No timeout: stealing their decision is worse than
  // letting the panel sit.
  const [mode, setMode] = useState<Mode>('tweaking');
  const wasRegeneratingRef = useRef<CardSide | null>(null);
  useEffect(() => {
    const was = wasRegeneratingRef.current;
    if (was && !isRegenerating) {
      // A regen just ended. If it FAILED (G1), stay in 'tweaking' so the
      // error panel + the textarea/retry show — don't flip to 'deciding'
      // and pretend a new version is ready (that was the silent-failure
      // glitch). On success, show the decision surface as before.
      setMode(regenError ? 'tweaking' : 'deciding');
    }
    wasRegeneratingRef.current = isRegenerating;
  }, [isRegenerating, regenError]);

  // "Keep tweaking" from the deciding surface → back to the authoring
  // textarea for another pass.
  const enterTweakingMode = () => {
    setMode('tweaking');
  };

  const frontAttempts = attempts
    .filter((a) => a.side === 'front')
    .sort((a, b) => a.attemptNumber - b.attemptNumber);
  const insideAttempts = attempts
    .filter((a) => a.side === 'inside')
    .sort((a, b) => a.attemptNumber - b.attemptNumber);

  const completedFront = frontAttempts.filter((a) => a.status === 'completed');
  const completedInside = insideAttempts.filter((a) => a.status === 'completed');
  const totalAttempts = completedFront.length + completedInside.length;

  // Is the SERVER still generating an attempt? The projection includes
  // the in-flight 'generating' row, so this is authoritative regardless
  // of the client's isRegenerating flag. Used to gate the "ready"
  // decision panel: never declare a version ready while one is still
  // cooking, even if isRegenerating momentarily clears (the "decision
  // panel flashes mid-regen" bug). See next_regen_interaction_polish.md.
  const someAttemptGenerating = attempts.some(
    (a) => a.status === 'generating',
  );

  // Which side's spinner to show. Prefer the client's isRegenerating
  // flag; fall back to the server's attempt status so the spinner holds
  // even if isRegenerating momentarily wobbles mid-regen.
  const regeneratingSide: CardSide | null =
    isRegenerating ??
    (frontAttempts.some((a) => a.status === 'generating')
      ? 'front'
      : insideAttempts.some((a) => a.status === 'generating')
        ? 'inside'
        : null);

  const showSoftCap =
    completedFront.length >= SOFT_CAP_PER_SIDE ||
    completedInside.length >= SOFT_CAP_PER_SIDE;

  // Versions rail content for the active side. Shown from v1 onwards so
  // the concept is taught immediately, not retroactively at v2+.
  const railAttempts = target === 'front' ? completedFront : completedInside;

  // Find the "currently showing" attempt for the active target so we
  // can show "Currently showing v3 of 3" above the thumb.
  const currentRailAttempt = railAttempts.find((a) => a.isSelected);
  const currentVersionNumber = currentRailAttempt?.attemptNumber;

  const handleSubmit = async () => {
    const front = tweakFront.trim() || undefined;
    const inside = tweakInside.trim() || undefined;

    // Submit only fires from 'tweaking' mode (the button isn't rendered
    // in 'deciding' mode), so no mode flip needed here. The post-regen
    // useEffect will flip us to 'deciding' once isRegenerating clears.

    // The side this submit runs against — whichever the segmented control
    // points at. Also drives the failure panel's retry target below.
    const submitSide: CardSide = target === 'inside' ? 'inside' : 'front';

    try {
      // Single-side text tweak → refine that one side. The typed tweak is
      // passed straight through as the `tweak` arg (no draft mutation).
      if (target === 'inside') {
        await onRegenerate('inside', inside);
      } else {
        await onRegenerate('front', front);
      }
    } catch (err: any) {
      // The server returns ProviderError fields (kind, suggestions,
      // modelExplanation, etc.) on the Error object via throwIfResNotOk.
      //
      // ALL failure kinds now get the persistent inline
      // <GenerationErrorPanel> (the panel handles every kind incl. null
      // via configFor). Previously only 'safety' got the panel and
      // transient kinds (rate/server/unknown) toasted destructively —
      // but an auto-dismissing red toast meant a transient provider 503
      // flashed and vanished, leaving a blank that read as "nothing
      // rendered" (exactly what bit a real test). A "wait and retry"
      // error should stay on screen with a Try-again button, calmly.
      // See next_regen_ux_audit.md (P1).
      const kind = (err?.kind ?? null) as GenerationErrorKind | null;

      setRegenFailure({
        // null/non-ProviderError (e.g. a raw network failure) → 'unknown'
        // so the panel always has a sensible presentation + retry.
        kind: kind ?? 'unknown',
        modelExplanation: err?.modelExplanation ?? null,
        suggestions: err?.suggestions ?? null,
        provider: err?.provider ?? null,
        code: err?.code ?? null,
        side: submitSide,
      });
    }
  };

  // "Try again" on the regen failure panel — re-fires the same submit
  // with the user's current tweaks. Clearing the panel happens via the
  // useEffect above when isRegenerating flips on.
  const handleRetryRegen = async () => {
    setRegenFailure(null);
    await handleSubmit();
  };

  // ── Optimistic version switching ─────────────────────────────────
  // selectAttempt does PATCH → reload-draft → re-render. With image
  // fetch on top, the displayed thumb felt sluggish (~500ms of dead
  // time per click). Two-layer fix:
  //
  //   1. Preload every attempt image on mount (hidden <img> below)
  //      so the browser cache is hot before the user clicks anything.
  //   2. Optimistic URL override — when a thumb is clicked we know
  //      the target imageUrl locally (it's in the rail attempt). Set
  //      it as the displayed URL immediately, fire the server call in
  //      the background. When the parent re-passes the URL it'll
  //      match what we already have on screen — no flicker.
  const [optimisticFrontUrl, setOptimisticFrontUrl] = useState<string | null>(null);
  const [optimisticInsideUrl, setOptimisticInsideUrl] = useState<string | null>(null);

  // Clear optimistic overrides once the parent's "real" URL catches up
  // (i.e. the server roundtrip completed and the URL matches what we
  // optimistically set). Keeps us from showing a stale optimistic URL
  // if the user does a regen-then-switch in quick succession.
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

  // G7: when a regen ENDS, drop any leftover optimistic rail override.
  // The exact-match clears above don't fire when a regen promotes a NEW
  // image (it never equals the user's earlier optimistic url), so a
  // pre-regen version-switch could keep shadowing the freshly-
  // regenerated card. On regen end the server's URL is authoritative
  // (new attempt on success, unchanged card on failure) — clear the
  // override so the real image shows. See next_regen_interaction_polish.md.
  const prevRegenSideRef = useRef<CardSide | null>(null);
  useEffect(() => {
    if (prevRegenSideRef.current && !isRegenerating) {
      setOptimisticFrontUrl(null);
      setOptimisticInsideUrl(null);
    }
    prevRegenSideRef.current = isRegenerating;
  }, [isRegenerating]);

  const displayedFrontUrl = optimisticFrontUrl ?? frontUrl;
  const displayedInsideUrl = optimisticInsideUrl ?? insideUrl;

  const handleSelect = async (attemptId: number) => {
    // Find the attempt locally so we can swap the displayed URL
    // before waiting on the server.
    const attempt = attempts.find((a) => a.id === attemptId);
    if (attempt?.imageUrl) {
      if (attempt.side === 'front') {
        setOptimisticFrontUrl(attempt.imageUrl);
      } else {
        setOptimisticInsideUrl(attempt.imageUrl);
      }
    }
    try {
      await onSelectAttempt(attemptId);
    } catch (err: any) {
      // Roll back the optimistic state on failure so the UI doesn't
      // lie about which version is committed.
      if (attempt?.side === 'front') setOptimisticFrontUrl(null);
      else if (attempt?.side === 'inside') setOptimisticInsideUrl(null);
      toast({
        title: "Couldn't switch version",
        description: err?.message ?? 'Try again in a moment.',
        variant: 'destructive',
      });
    }
  };

  // Header subtitle — recipient. Per-side version count was dropped
  // 2026-04-27: it summed front + inside attempts ("3 front + 4 inside
  // = 7 versions saved") which read as "I made 7 changes" to users,
  // but each side has its own scoped history. The rail's "Currently
  // showing v3 of 3" caption is the accurate per-side surface; one
  // truth is enough.
  const recipient = state.recipient?.name?.trim();
  const occasion = state.recipient?.occasion?.trim();
  const subtitleSubject = recipient
    ? occasion
      ? `${recipient}'s ${occasion} card`
      : `${recipient}'s card`
    : 'Your card';
  // Suppress unused-var warning — totalAttempts no longer goes into
  // the subtitle but the value is still useful as a future hook
  // (e.g. analytics, "X tweaks so far" surface).
  void totalAttempts;

  const timeHint = SINGLE_WAIT_LABEL;

  // Empty-tweak guard. An empty scene submit used to fall through to the
  // server's RE-ROLL path (a full from-scratch remake) — the exact
  // behaviour the photo/both removal was meant to kill. Block it: a tweak
  // must say something so it always lands on refine(). See
  // next_regen_ux_audit.md.
  const activeTweak = target === 'inside' ? tweakInside : tweakFront;
  const sceneTweakEmpty = activeTweak.trim().length === 0;

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
            Tweak your card
          </h1>
          <p className="text-xs text-stone-500 truncate mt-0.5">
            {subtitleSubject}
          </p>
        </div>
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
      </div>

      {/* Reassurance is now a one-line nudge + a "How tweaking works" module
          (2026-06-01, Kevin). The old always-on paragraph carried the whole
          mental model in a run-on sentence AND pushed the card — the thing
          the user came to see — down the page. The detail (you're editing
          THIS design; be specific; you can change expressions/actions/
          details/front text/inside message; you CAN'T change the photo or
          likeness; front vs inside defined) now lives one tap away in
          <HowTweakingWorks>. See next_regen_ux_audit.md. */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[12px] text-stone-500 leading-snug">
          Describe a change — your photo &amp; likeness stay put.
        </p>
        <HowTweakingWorks />
      </div>

      {/* Inline failure panel — only renders when a regen attempt failed
          on safety. Same component the initial-gen path uses (one source
          of truth for failure UX). Sits between the safety-line banner
          and the card thumb so the user sees it the moment a regen
          comes back blocked, with the existing card preserved below
          for context. */}
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
              // Hand off to the parent's regen-aware dialog opener so
              // chip clicks land in the fix-and-retry dialog with the
              // right side context. Falls back to no-op if the prop
              // isn't wired (defensive — should always be wired in
              // production but useful for storybook/standalone tests).
              if (onJumpToStepFromRegenFailure) {
                onJumpToStepFromRegenFailure(editor, regenFailure.side);
              }
            }}
            isRetrying={isRegenerating !== null}
          />
        </div>
      )}

      {/* "Currently showing" caption — anchors the user in version
          history. Shown only when there's >1 version so v1 doesn't say
          "showing v1 of 1" (noise). */}
      {railAttempts.length > 1 && currentVersionNumber && (
        <p
          className="text-center text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-2"
          data-testid="regen-current-version-caption"
        >
          Currently showing v{currentVersionNumber} of {railAttempts.length}
        </p>
      )}

      {/* Card thumb. Uses optimistic URLs (set immediately on rail click)
          when present, otherwise the parent's "real" URL — keeps the
          displayed image in sync with the user's intent without waiting
          on the server roundtrip. */}
      <div className="mb-3">
        <CardThumb
          frontUrl={displayedFrontUrl}
          insideUrl={displayedInsideUrl}
          target={target}
          hasInside={hasInside}
          // Robust spinner: show it while the client is regenerating OR
          // the server still has a generating attempt for that side, so
          // it never flickers off mid-regen if isRegenerating wobbles.
          regeneratingSide={regeneratingSide}
        />
      </div>

      {/* Image preload — hidden, off-screen <img> tags for every
          completed attempt's URL. Browser caches them so subsequent
          rail clicks feel instant. Width/height kept tiny so layout
          isn't affected; loading="eager" defeats lazy-load deferral.
          ARIA-hidden because these are pure cache primers, not content. */}
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

      {/* Front / Inside segmented control. Hidden when there's no inside
          (then Front is the only option, so the choice is noise). */}
      {hasInside && (
        <div className="mb-5 flex flex-col items-center gap-2">
          {/* Label so the control reads as a real decision, not chrome. */}
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-soft font-semibold">
            Which side?
          </p>
          <div
            className="inline-flex bg-stone-100 rounded-full p-1.5"
            data-testid="regen-target-segmented"
          >
            <SegmentTab
              active={target === 'front'}
              onClick={() => setTarget('front')}
              disabled={!!isRegenerating}
              testId="pill-target-front"
            >
              Front
            </SegmentTab>
            <SegmentTab
              active={target === 'inside'}
              onClick={() => setTarget('inside')}
              disabled={!!isRegenerating}
              testId="pill-target-inside"
            >
              Inside
            </SegmentTab>
            {/* 'Both' target REMOVED 2026-05-31: tweaking the scene should
                only touch the side you're editing. Regenerating the inside
                when you edit the front (the scene) was wasted cost + the
                source of "it remade the whole card". Front/Inside only now;
                each is a single-side text tweak → always the refine path. */}
          </div>
        </div>
      )}

      {/* Versions rail — square 64×64 thumbs (Celebrait cards are
          5.5×5.5 square), shown from v1 onwards so the concept is taught
          immediately. Tap any version to switch back. The active version
          gets a brand border + soft glow. */}
      {railAttempts.length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] text-stone-500 text-center mb-2">
            {railAttempts.length === 1
              ? 'Your card so far'
              : 'Tap a version to switch back'}
          </p>
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
            {railAttempts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleSelect(a.id)}
                disabled={!!isRegenerating || a.isSelected}
                className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                  a.isSelected
                    ? 'border-brand shadow-md shadow-brand/20'
                    : 'border-stone-200 hover:border-brand/60 opacity-80 hover:opacity-100'
                } disabled:cursor-not-allowed`}
                aria-label={
                  a.isSelected
                    ? `Currently showing version ${a.attemptNumber}`
                    : `Switch to version ${a.attemptNumber}`
                }
                data-testid={`regen-thumb-${target}-${a.attemptNumber}`}
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
                  className={`absolute bottom-0 inset-x-0 text-[10px] font-medium leading-none py-1 text-center ${
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
      )}

      {/* ───────────────────────────────────────────────────────────
          MODE: 'deciding' — full decision panel replaces textarea.
          User must pick "Use this version" or "Keep tweaking" before
          they can author again. Rail switching still works underneath
          (handled above) — if they pick a different version while
          deciding, the panel keeps showing and "Use this version"
          refers to whatever's now active.
          ─────────────────────────────────────────────────────────── */}
      {/* AnimatePresence with `initial={false}`: don't run the entry
          animation on the very first render. The parent motion.div
          already does its own fade-in for the whole component; running
          a second fade on the inner mode panel made the submit button
          flash on entry to the regen page (Kevin 2026-04-27). Mode
          transitions AFTER mount still cross-fade — that's the point.

          mode="popLayout" (was "wait", changed 2026-06-01 for G5): "wait"
          fully unmounts the exiting panel BEFORE mounting the new one, so
          for one frame neither is in flow and everything below collapses
          up then drops back down — the un-animated reflow "jump" Kevin
          flagged. popLayout pops the exiting panel out of layout flow (it
          fades out in place) while the entering panel takes its spot
          immediately, so the surrounding chrome never sees a zero-height
          gap. See next_regen_interaction_polish.md (G5). */}
      {/* `relative` gives popLayout's absolutely-positioned exiting panel a
          containing block, so the old panel fades out exactly where it sat
          (top of this box) and the new one fades in over the same spot — a
          true cross-fade rather than the exiting panel flying to a stray
          ancestor's origin. */}
      <div className="relative">
      <AnimatePresence mode="popLayout" initial={false}>
        {mode === 'deciding' && !isRegenerating && !someAttemptGenerating ? (
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
                    ? "Like it? Use it as your card. Or keep tweaking — earlier versions are still saved below."
                    : "Like it? Use it as your card. Or keep tweaking — every try is saved so you can compare."}
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
                Use this version
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
                Sometimes the first one was the one — flip back through
                the versions before trying again.
              </p>
            )}
          </motion.div>
        ) : (
          /* ─────────────────────────────────────────────────────────
              MODE: 'tweaking' — textarea(s) + submit. The default
              authoring surface. Hidden during 'deciding' so the user
              isn't presented with two competing surfaces.
              ───────────────────────────────────────────────────── */
          <motion.div
            key="tweaking-surface"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Tweak input — a single textarea for whichever side the
                segmented control points at. (The old wizard's photo/style
                surfaces and the Both two-textarea layout were removed —
                regen is a single-side text tweak now.) */}
            <div className="mb-4">
              <p className="text-sm text-ink font-medium mb-1.5">
                Tell us what to change.
              </p>
              <Textarea
                ref={target === 'front' ? frontTextareaRef : insideTextareaRef}
                value={target === 'front' ? tweakFront : tweakInside}
                onChange={(e) =>
                  target === 'front'
                    ? setTweakFront(e.target.value)
                    : setTweakInside(e.target.value)
                }
                placeholder={
                  target === 'front'
                    ? 'e.g. "make it more autumnal" or "swap the dog for a cat"'
                    : 'e.g. "tidier handwriting" or "warmer tone"'
                }
                rows={3}
                className="text-sm resize-none"
                disabled={!!isRegenerating}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (!isRegenerating) void handleSubmit();
                  }
                }}
                data-testid="input-regen-tweak"
              />
            </div>

            {/* Soft-cap nudge — copy unchanged, this one's already good.
                Only shown in tweaking mode; the deciding panel has its
                own copy of the same nudge inline. */}
            {showSoftCap && !isRegenerating && (
              <p
                className="text-[11px] italic text-stone-500 text-center mb-4"
                data-testid="regen-soft-cap"
              >
                Sometimes the first one was the one — flip back through
                the versions before trying again.
              </p>
            )}

            {/* Start over — restored 2026-05-31. When the intent picker
                was skipped (only the scene intent remains), the picker's
                "Start over" link became unreachable; this is the escape
                for a user who wants a different card altogether, not a
                tweak of this one. Quiet, in normal flow (above the mobile
                sticky submit). See next_regen_ux_audit.md. */}
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

            {/* Submit — sticky-bottom on mobile so it stays above the
                keyboard. Single label, time hint always visible. */}
            <div className="fixed sm:static bottom-0 inset-x-0 px-4 sm:px-0 py-3 sm:py-0 bg-white/95 sm:bg-transparent backdrop-blur sm:backdrop-blur-0 border-t sm:border-0 border-stone-200">
              <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                <p
                  className="text-[11px] text-stone-400 hidden sm:block"
                  data-testid="regen-time-hint"
                >
                  {isRegenerating
                    ? `Crafting your new ${isRegenerating}…`
                    : sceneTweakEmpty
                      ? 'Type a change to begin'
                      : timeHint}
                </p>
                {(() => {
                  // Disabled when regenerating, or when the tweak is empty
                  // (an empty submit would hit the server's re-roll/full-
                  // remake path — blocked, see sceneTweakEmpty above).
                  const submitDisabled = !!isRegenerating || sceneTweakEmpty;
                  return (
                    <Button
                      type="button"
                      size="lg"
                      onClick={handleSubmit}
                      disabled={submitDisabled}
                      className="bg-brand hover:bg-brand-dark text-brand-foreground w-full sm:w-auto"
                      data-testid="btn-regen-submit"
                    >
                      {isRegenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Crafting your new {isRegenerating}…
                        </>
                      ) : (
                        'Make a new version'
                      )}
                    </Button>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── SegmentTab — Front / Inside target toggle.
// Bumped weight 2026-05-10 (Kevin's call: "needs more signposting that
// this is an option") — bigger padding, semibold labels, brand-violet
// active state instead of white-with-shadow. Reads as a real choice,
// not chrome.
function SegmentTab({
  active,
  onClick,
  children,
  disabled,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2 text-sm font-semibold rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'bg-brand text-brand-foreground shadow-sm shadow-brand/20'
          : 'text-ink-soft hover:text-ink'
      }`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

