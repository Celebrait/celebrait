// client/src/components/studio/steps/review-step.tsx
//
// Step 6: Review + Generate. The final stop before the AI generation
// kicks off. Shows the customer their choices back as a summary panel
// in a card-shaped frame — recipient, photo, scene, style, inside
// message — with small edit-links per section that jump back to the
// owning step.
//
// NOT a preview of the card. The AI rendering will look nothing like
// this panel; we're only confirming what's been asked for. See
// ROADMAP_IDEAS.md "Journey preview panel" for the always-visible
// visual preview we deliberately deferred.
//
// States:
//   - ready        → summary + green Generate button
//   - generating   → spinner + "Crafting your card…" (polls every 2s)
//   - completed    → show the rendered front + inside images
//   - failed       → error + retry button (flips status back to draft)

import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'wouter';
import {
  Sparkles,
  Pencil,
  User,
  Image as ImageIcon,
  MessageSquare,
  FileText,
  Type,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import type { CardDraftState, StepId } from '@shared/schema';
import { deriveDefaultFrontText } from '@shared/schema';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { useTexture } from '@react-three/drei';
import { GestureHints } from '@/components/gesture-hints';
import {
  GenerationWaitStage,
  type GenerationStage,
} from '@/components/studio/generation-wait';
import { RegenEditMode } from '@/components/studio/regen-controls';
import { GenerationErrorPanel } from '@/components/studio/generation-error-panel';
import type { CardAttemptDTO } from '@/hooks/use-card-maker';
import type { CardSide } from '@shared/schema';

// Approximate generation time for a front + inside pair. Used to size
// the progress copy ("this usually takes ~45 seconds"). Not a hard
// timeout — some providers are slower.
const TYPICAL_GENERATION_SECONDS = 45;

interface ReviewStepProps {
  cardId: number;
  state: CardDraftState;
  status: string | null;
  /** Frontend step index for each StepId — used by edit-links to jump
   *  back. Matches CARD_MAKER_STEPS order in the parent. */
  stepIndexById: Record<StepId, number>;
  onJumpToStep: (stepIndex: number) => void;
  /** Variant of onJumpToStep used by the INITIAL-gen failure panel's
   *  action chips. Opens the fix-and-retry dialog in initial-gen mode.
   *  Optional — falls back to onJumpToStep when not provided. */
  onJumpToStepFromFailure?: (stepId: 'scene' | 'photo') => void;
  /** Variant of the above used by the REGEN failure panel's action
   *  chips (rendered inside RegenEditMode). Opens the dialog in regen
   *  mode and remembers which side failed so the right regen fires. */
  onJumpToStepFromRegenFailure?: (
    stepId: 'scene' | 'photo',
    side: CardSide,
  ) => void;
  /** Patch + flush the draft. Used by the photo / style pill controls
   *  inside RegenEditMode so a swap persists before the next regen
   *  picks up the saved state. */
  onUpdateInputs?: (patch: Partial<CardDraftState>) => Promise<void>;
  /** Patch the draft. Used by the Buy dialog's "add a message" recovery
   *  link to flip inside mode from blank → write as the user navigates
   *  back — so they land in the write panel with the textarea ready,
   *  not re-staring at the blank selection they're trying to undo. */
  onChange: (patch: Partial<CardDraftState>) => void;
  /** Called when the user hits Generate. Parent handles the POST and
   *  subsequent status polling. */
  onGenerate: () => void;
  /** Called when the user hits "Try again" from the FailedView. Parent
   *  does the two-step dance: POST /retry to flip status from failed →
   *  draft, then call startGeneration so the draft actually runs again.
   *  Without this the retry endpoint leaves the UI stuck on FailedView. */
  onRetry: () => Promise<void>;
  isGenerating: boolean;
  generatedFrontUrl: string | null;
  generatedInsideUrl: string | null;
  /** Regen state + actions, threaded from useCardMaker. Undefined on
   *  surfaces that don't support regen (none today, but the prop is
   *  optional so future read-only viewers don't have to mock these). */
  attempts?: CardAttemptDTO[];
  isRegenerating?: CardSide | null;
  /** Poll-detected background-regen failure. Drives the regen surface's
   *  inline error panel — fire-and-forget regens can't throw to the
   *  client. See next_regen_interaction_polish.md (G1). */
  regenError?: import('@/hooks/use-card-maker').RegenError | null;
  onRegenerate?: (side: CardSide, tweak?: string) => Promise<void>;
  onSelectAttempt?: (attemptId: number) => Promise<void>;
  /** Failure metadata when status === 'failed'. Drives the
   *  <GenerationErrorPanel>'s kind-specific copy + chips. Null on
   *  success / generating / draft. */
  failure?: import('@/hooks/use-card-maker').DraftFailureDTO | null;
}

export function ReviewStep({
  cardId,
  state,
  status,
  stepIndexById,
  onJumpToStep,
  onJumpToStepFromFailure,
  onJumpToStepFromRegenFailure,
  onChange,
  onGenerate,
  onRetry,
  isGenerating,
  generatedFrontUrl,
  generatedInsideUrl,
  attempts,
  isRegenerating,
  regenError,
  onRegenerate,
  onSelectAttempt,
  failure,
  onUpdateInputs,
}: ReviewStepProps) {
  // Collapse the "generating" and "completed" screens into one
  // continuous RevealView — same canvas from Stage 1 (silhouette)
  // through Stage 2 (front arrived, inside pending) to Stage 3
  // (both arrived, interactive). Avoids the hard-handoff flash
  // where the old GeneratingView unmounts and CompletedView mounts
  // cold.
  const inReveal =
    status === 'generating' || status === 'completed' || isGenerating;

  if (inReveal) {
    return (
      <RevealView
        cardId={cardId}
        frontUrl={generatedFrontUrl}
        insideUrl={generatedInsideUrl}
        status={status}
        state={state}
        insideMode={state.inside?.mode ?? null}
        onEditInside={() => {
          onChange({
            inside: { ...state.inside, mode: 'write' },
          });
          onJumpToStep(stepIndexById.inside);
        }}
        attempts={attempts ?? []}
        isRegenerating={isRegenerating ?? null}
        regenError={regenError ?? null}
        onRegenerate={onRegenerate}
        onSelectAttempt={onSelectAttempt}
        onJumpToStepFromRegenFailure={onJumpToStepFromRegenFailure}
        onUpdateInputs={onUpdateInputs}
      />
    );
  }

  if (status === 'failed') {
    return (
      <FailedView
        onRetry={onRetry}
        failure={failure ?? null}
        stepIndexById={stepIndexById}
        onJumpToStep={onJumpToStep}
        onJumpToStepFromFailure={onJumpToStepFromFailure}
      />
    );
  }

  // Default: review + generate.
  const recipientName = state.recipient?.name?.trim();
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <p className="text-sm text-stone-600 leading-relaxed">
        Everything below is still a draft. Tap any section to change it — you
        can re-roll the result after, tweak the copy, or come back tomorrow.
        Nothing gets sent until you say so.
      </p>

      <SummaryPanel
        state={state}
        stepIndexById={stepIndexById}
        onJumpToStep={onJumpToStep}
      />

      <div className="pt-2">
        <Button
          onClick={onGenerate}
          className="w-full bg-cta hover:bg-cta-hover text-cta-foreground text-base py-6 shadow-sm hover:shadow-md transition-shadow"
          data-testid="btn-generate-card"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          {recipientName ? `Generate ${recipientName}'s card` : 'Generate my card'}
        </Button>
        <p className="text-[11px] text-stone-500 text-center mt-2 leading-relaxed">
          About {TYPICAL_GENERATION_SECONDS} seconds to draft. If you don't
          love it, re-roll it or edit any step — your card saves as you go.
        </p>
      </div>
    </div>
  );
}

// ── Summary panel — card-frame-shaped list of chosen fields ──────────
function SummaryPanel({
  state,
  stepIndexById,
  onJumpToStep,
}: {
  state: CardDraftState;
  stepIndexById: Record<StepId, number>;
  onJumpToStep: (stepIndex: number) => void;
}) {
  const recipient = state.recipient;
  const scene = state.scene?.description ?? '';
  const insideMode = state.inside?.mode;
  const insideWrite = state.inside?.write ?? {};
  const photoCount = state.photos?.photoIds?.length ?? 0;
  // Resolved front text for display — mirrors server's buildCardText()
  // precedence so what we show matches what'll render.
  // mode='none' is the explicit opt-out (added 2026-04-27); takes
  // priority over text + default so the row reads "No text on front"
  // even if there's a stale `text` value lingering in the draft.
  const frontMode = state.front?.mode;
  const frontText =
    frontMode === 'none'
      ? ''
      : state.front?.text?.trim() || deriveDefaultFrontText(state);
  const frontTextIsDefault = frontMode !== 'none' && !state.front?.text?.trim();
  const frontExplicitlySkipped = frontMode === 'none';

  return (
    <div className="space-y-3">
      <SummaryRow
        icon={User}
        label="Recipient"
        onEdit={() => onJumpToStep(stepIndexById.recipient)}
        testId="summary-recipient"
      >
        <div className="text-sm text-ink font-medium">
          {recipient?.name || <span className="text-stone-400 font-normal">Not set</span>}
        </div>
        {recipient?.occasion && (
          <div className="text-xs text-stone-500 capitalize mt-0.5">
            {recipient.occasion}
          </div>
        )}
      </SummaryRow>

      <SummaryRow
        icon={ImageIcon}
        label="Photo"
        onEdit={() => onJumpToStep(stepIndexById.photo)}
        testId="summary-photo"
      >
        <div className="text-sm text-ink">
          {photoCount === 0 ? (
            <span className="text-stone-400">Not uploaded</span>
          ) : photoCount === 1 ? (
            '1 photo'
          ) : (
            `${photoCount} photos`
          )}
        </div>
      </SummaryRow>

      <SummaryRow
        icon={MessageSquare}
        label="Scene"
        onEdit={() => onJumpToStep(stepIndexById.scene)}
        testId="summary-scene"
      >
        {scene ? (
          <p className="text-sm text-ink leading-relaxed">{scene}</p>
        ) : (
          <span className="text-sm text-stone-400">Not set</span>
        )}
      </SummaryRow>

      {/* Style summary row REMOVED 2026-05-17 — style picker parked
          for Celebrait Premium. V1 locks to the warm illustrated
          default which is what we render today. See
          next_celebrait_premium.md. */}

      <SummaryRow
        icon={Type}
        label="Front text"
        onEdit={() => onJumpToStep(stepIndexById.front)}
        testId="summary-front"
      >
        {frontText ? (
          <>
            <div className="text-sm text-ink font-medium">{frontText}</div>
            {frontTextIsDefault && (
              <div className="text-xs text-stone-500 mt-0.5">
                Default — tap Edit to change.
              </div>
            )}
          </>
        ) : frontExplicitlySkipped ? (
          <div>
            <div className="text-sm text-stone-700">No headline on the front</div>
            <div className="text-[11px] text-stone-500 mt-0.5">
              The scene stands alone.
            </div>
          </div>
        ) : (
          <span className="text-sm text-stone-400">No text on front</span>
        )}
      </SummaryRow>

      <SummaryRow
        icon={FileText}
        label="Inside"
        onEdit={() => onJumpToStep(stepIndexById.inside)}
        testId="summary-inside"
      >
        {insideMode === 'blank' ? (
          <div>
            <div className="text-sm text-stone-700">
              Blank centre with decorative border
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">
              Print only — digital needs a message inside.
            </div>
          </div>
        ) : insideMode === 'write' ? (
          <div className="space-y-0.5 text-sm text-stone-700">
            {insideWrite.salutation && <div>{insideWrite.salutation}</div>}
            {insideWrite.message && (
              <div className="whitespace-pre-wrap">{insideWrite.message}</div>
            )}
            {insideWrite.signoff && <div>{insideWrite.signoff}</div>}
          </div>
        ) : (
          <span className="text-sm text-stone-400">Not set</span>
        )}
      </SummaryRow>
    </div>
  );
}

// Single-tint icon tile. Previous five-row per-tint system (coral /
// brand / amber) was decorative pretending to be semantic and broke
// the locked colour rules in UX_STUDIO_TONE.md. Unified to
// brand-muted/brand so the icon glyph itself does the differentiation
// (User vs Image vs Palette) — which is plenty of signal.
function SummaryRow({
  icon: Icon,
  label,
  onEdit,
  children,
  testId,
}: {
  icon: typeof User;
  label: string;
  onEdit: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <div
      className="flex items-start gap-3 bg-white border border-stone-200 rounded-xl p-4 sm:p-5 shadow-sm"
      data-testid={testId}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-brand-muted text-brand">
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            {label}
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="text-[11px] text-brand hover:text-brand-dark flex items-center gap-1"
            data-testid={`${testId}-edit`}
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        </div>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

// Legacy state-driven narration script. No longer rendered by RevealView
// — replaced by the three-layer NarrationStage (Apr 2026). Kept behind
// a leading `_` name so it doesn't collide with the new narration
// without making git history noisy. Safe to delete once the new flow
// has soaked on prod.
//
// Previously: Turn the draft state into a narration script — five
// beats shown pre-front (one per Studio step), plus a single line that
// runs while the inside is being drafted.
function _legacyBuildNarration(state: CardDraftState): {
  preFront: string[];
  duringInside: string;
} {
  const name = state.recipient?.name?.trim() || '';
  const occasionRaw = state.recipient?.occasion?.trim();
  const occasion = occasionRaw && occasionRaw !== 'other' ? occasionRaw : '';
  const occasionPhrase = occasion ? `${occasion.toLowerCase()} card` : 'card';
  const photoMode = state.photos?.mode ?? 'one_person';
  const photoCount = state.photos?.photoIds?.length ?? 0;
  const scene = state.scene?.description?.trim() || '';
  const styleMode = state.style?.mode;
  const customStyle = state.style?.custom?.trim() || '';
  const frontText = state.front?.text?.trim() || '';
  const insideMode = state.inside?.mode;
  const insideMessage = state.inside?.write?.message?.trim() || '';

  const styleLabel =
    styleMode === 'animated'
      ? 'warm, illustrated'
      : styleMode === 'realistic'
        ? 'cinematic, photoreal'
        : customStyle
          ? customStyle.toLowerCase()
          : 'signature';

  const preFront: string[] = [];

  // Beat 1 — opening: who the card is for + occasion
  preFront.push(
    name ? `Making ${name}'s ${occasionPhrase}.` : 'Making your card.',
  );

  // Beat 2 — photo
  if (photoMode === 'group') {
    preFront.push(name ? `Everyone together with ${name}.` : 'Everyone in the photo.');
  } else if (photoCount > 1) {
    preFront.push(name ? `${name}, from every angle.` : 'Captured from every angle.');
  } else {
    preFront.push(name ? `${name}, from the photo you sent.` : 'Starting with your photo.');
  }

  // Beat 3 — scene. User's own words read beautifully back to them.
  if (scene) {
    const trimmed = scene.length > 90 ? scene.slice(0, 88).trim() + '…' : scene;
    preFront.push(`Setting the scene — ${trimmed.toLowerCase()}.`);
  } else {
    preFront.push('Setting the scene.');
  }

  // Beat 4 — style
  preFront.push(`Painting it in a ${styleLabel} style.`);

  // Beat 5 — front text
  if (frontText) {
    preFront.push(`"${frontText}" across the front.`);
  } else {
    preFront.push('Letting the scene speak for itself.');
  }

  // During inside — runs while the front is on screen and the inside
  // is still being drafted. Mode-aware so we're honest about what's
  // actually happening.
  let duringInside: string;
  if (insideMode === 'blank') {
    duringInside = 'Leaving the inside blank for your own words.';
  } else if (insideMessage) {
    duringInside = 'Writing your message on the inside.';
  } else {
    duringInside = 'Composing the inside.';
  }

  return { preFront, duringInside };
}

// (BuildNarration superseded by NarrationStage — see
//  components/studio/narration-stage.tsx)

// ── Completed view — full 3D viewer experience + single-CTA purchase ──
// Matches the public viewer pattern: canvas bleeds past the stage in
// all directions so the card can rotate/zoom freely (no cropping even
// at max zoom), gesture hints that retire after first interaction,
// the UI below fades out while the user is actively manipulating the
// card. Single violet "Buy this card" CTA opens a modal for the
// digital/print/both decision.

// Pricing / format-choice helpers + the BuyDialog modal that used to
// live here were removed 2026-05-19 — the digital/print/both choice
// now lives in the inline <GivingMoment> (giving-moment.tsx). See
// next_delivery_destination_usp.md.

/**
 * RevealView — the end-to-end generation experience.
 *
 *   Phase 1 — NARRATING (`status !== 'completed'` or URLs missing)
 *     Single-line narration cycles through HEADLINE_BEATS. Server
 *     runs in the background; client deliberately ignores mid-gen
 *     frontUrl persists so nothing half-rendered leaks on screen.
 *
 *   Phase 2 — READY (`status === 'completed'` + both URLs in)
 *     Narration transitions to the READY_LINE, holds briefly, then
 *     a slow crossfade into the 3D card viewer. No envelope gate on
 *     this surface — Kevin reverted it 2026-04-24 as too much ceremony
 *     for the creator side (the envelope is kept on the recipient-
 *     facing viewer where it reads as a gift moment, not a loader).
 *
 * Key choice: no visible "loading" beat between narration and card —
 * the narration IS the loader. The handoff is one continuous crossfade
 * that lasts ~1.8s; by the time it settles the 3D card is ready to
 * play with.
 */
function RevealView({
  cardId,
  frontUrl,
  insideUrl,
  status,
  state,
  insideMode,
  onEditInside,
  attempts,
  isRegenerating,
  regenError,
  onRegenerate,
  onSelectAttempt,
  onJumpToStepFromRegenFailure,
  onUpdateInputs,
}: {
  cardId: number;
  frontUrl: string | null;
  insideUrl: string | null;
  status: string | null;
  /** Full draft — NarrationStage personalises every beat from it. */
  state: CardDraftState;
  insideMode: 'write' | 'blank' | null;
  onEditInside: () => void;
  attempts: CardAttemptDTO[];
  isRegenerating: CardSide | null;
  regenError?: import('@/hooks/use-card-maker').RegenError | null;
  onRegenerate?: (side: CardSide, tweak?: string) => Promise<void>;
  onSelectAttempt?: (attemptId: number) => Promise<void>;
  /** Threaded down to RegenEditMode. When a regen fails on safety,
   *  the inline panel's chips call this to open the fix-and-retry
   *  dialog in regen mode. */
  onJumpToStepFromRegenFailure?: (
    stepId: 'scene' | 'photo',
    side: CardSide,
  ) => void;
  /** Patch + flush draft. Powers the photo/style pill swap controls
   *  inside RegenEditMode. */
  onUpdateInputs?: (patch: Partial<CardDraftState>) => Promise<void>;
}) {
  // Ready = server says done and both image URLs have landed on the
  // client. `frontUrl` alone isn't enough (server persists it mid-gen;
  // client deliberately waits for the complete picture).
  const isReady = status === 'completed' && !!frontUrl && !!insideUrl;

  // Generation stage — drives the GenerationWaitStage status copy so
  // the user sees actual progress ("Drawing the front" → "Now writing
  // the inside" → "Final touches") instead of an elapsed-time fiction.
  // Derived from the same poll data that flips `isReady` above:
  //   • frontUrl appears as soon as the front image is stored on disk
  //   • insideUrl appears once the inside lands
  //   • status flips to 'completed' once both attempts are saved and
  //     the selected attempt is finalised on the card row
  // When `insideMode === 'blank'`, no inside image is generated and the
  // pipeline runs front → finishing → ready (skipping the 'inside'
  // beat). `expectsInsideImage` captures that distinction.
  const expectsInsideImage = insideMode === 'write';
  const generationStage: GenerationStage =
    status === 'completed'
      ? 'ready'
      : !frontUrl
        ? 'front'
        : expectsInsideImage && !insideUrl
          ? 'inside'
          : 'finishing';

  // ── Texture preload ──────────────────────────────────────────────
  // Card reveal speedup (2026-05-14). Without this, the Canvas mounts
  // → useTexture suspends → 2MB PNG downloads + decodes synchronously
  // before the card materialises, adding ~500ms-1s of dead air on top
  // of the 1600ms intentional hold and the 1200-1800ms entrance.
  //
  // Two preload paths fired the instant a URL appears in the poll
  // response (typically minutes BEFORE the 3D viewer mounts):
  //
  //   1. <link rel="preload" as="image"> — warms the browser HTTP
  //      cache. When Canvas later requests the image, it's already
  //      bytes-in-RAM. Decode still happens, but the network leg is
  //      gone.
  //
  //   2. useTexture.preload(url) — drei's static method that drives
  //      its own texture cache. When useTexture inside the Canvas
  //      resolves, it sees the cached entry and doesn't Suspense-wait.
  //
  // Combined, the reveal feels noticeably snappier — texture decode
  // overlaps with the 1600ms hold instead of running after it.
  useEffect(() => {
    const urls = [frontUrl, insideUrl].filter(
      (u): u is string => !!u && u.length > 0,
    );
    if (urls.length === 0) return;

    // 1. Browser-level preload via <link>.
    const links = urls.map((url) => {
      const el = document.createElement('link');
      el.rel = 'preload';
      el.as = 'image';
      el.href = url;
      document.head.appendChild(el);
      return el;
    });

    // 2. drei texture cache preload. Static method — safe to call
    //    outside any Canvas. Idempotent for repeated calls on the
    //    same URL.
    try {
      useTexture.preload(urls);
    } catch (err) {
      // Defensive — drei's preload occasionally throws on dev HMR
      // re-runs when the same URL is in flight. Not worth crashing
      // the reveal over.
      console.warn('[review-step] texture preload failed', err);
    }

    return () => {
      // Clean up the preload links on URL change / unmount so they
      // don't accumulate. (They've already served their purpose by
      // now anyway.)
      for (const el of links) {
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    };
  }, [frontUrl, insideUrl]);

  // Ceremony timing: once `isReady` flips, hold the READY_LINE on screen
  // for ~1600ms, then crossfade into the 3D viewer over ~1200ms. Neither
  // number is a loading bar — they're pacing dials. Tune with Kevin.
  const READY_HOLD_MS = 1600;

  // If the card is ALREADY complete the moment this screen mounts, it's a
  // REVISIT (e.g. navigating back from checkout), not a fresh generation —
  // so reveal immediately and skip the wait stage + hold. Replaying the
  // "celebration content looping" generation screen on a finished card
  // reads as "it's generating again". The ceremony only applies to a gen
  // that completes WHILE the user is watching this screen.
  const wasReadyAtMount = useRef(isReady);
  const [showReveal, setShowReveal] = useState(isReady);

  useEffect(() => {
    if (!isReady || showReveal) return;
    if (wasReadyAtMount.current) {
      setShowReveal(true);
      return;
    }
    const t = window.setTimeout(() => setShowReveal(true), READY_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [isReady, showReveal]);

  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  // Edit mode — flips the whole surface from "look at the card / buy"
  // (3D card + Buy CTA) to a focused regen workbench. Triggered by
  // the "Make a change" pill on the reveal layout; exited via the
  // Done button inside RegenEditMode. Keeps state local so leaving
  // and re-entering edit mode resets the textarea + target.
  const [editMode, setEditMode] = useState(false);
  const interactTimerRef = useRef<number | null>(null);

  const startInteract = () => {
    if (interactTimerRef.current) window.clearTimeout(interactTimerRef.current);
    setIsInteracting(true);
    setHasInteracted(true);
  };
  const endInteract = () => {
    if (interactTimerRef.current) window.clearTimeout(interactTimerRef.current);
    interactTimerRef.current = window.setTimeout(() => setIsInteracting(false), 1200);
  };
  // bumpInteract was used to treat wheel-scroll as card interaction
  // (start + end in one tick). Removed 2026-05-10 along with the
  // onWheel handler — wheel = page scroll, not card play. See comment
  // on the interaction wrapper below.

  // Edit mode takes the entire surface — the 3D card + CTA stack
  // are intentionally hidden so the user has a focused workbench.
  // The Giving Moment is an inline view of the normal reveal surface,
  // so it isn't reachable from edit mode — the user exits edit mode
  // (Done) and then continues to give the card.
  if (editMode && onRegenerate && onSelectAttempt) {
    return (
      <RegenEditMode
        state={state}
        frontUrl={frontUrl}
        insideUrl={insideUrl}
        attempts={attempts}
        isRegenerating={isRegenerating}
        regenError={regenError ?? null}
        hasInside={insideMode === 'write' || insideMode === 'blank'}
        onRegenerate={onRegenerate}
        onSelectAttempt={onSelectAttempt}
        onExit={() => setEditMode(false)}
        onJumpToStepFromRegenFailure={onJumpToStepFromRegenFailure}
        onUpdateInputs={
          onUpdateInputs ??
          (async () => {
            /* no-op fallback when not wired (defensive) */
          })
        }
      />
    );
  }

  return (
      <div
        className="max-w-3xl mx-auto"
        data-testid={showReveal ? 'review-completed' : 'review-generating'}
      >
        {/* Stage — constant dimensions across narration → card reveal
            so it reads as one continuous surface. The reveal is its
            own moment; the Giving Moment is a separate screen
            (/studio/card/:id/give) so it never crowds the 3D card. */}
        <div className="h-[60vh] sm:h-[68vh] w-full relative">
          {/* mode="wait" so narration fully exits before the card enters.
              Avoids the two layers animating in tandem — the card used
              to appear to "snap in" because its mount + texture load
              raced the narration's fade-out. Sequenced out-then-in reads
              much calmer. */}
          <AnimatePresence mode="wait">
            {showReveal ? (
              /* Phase 2b — 3D card reveal. Longer ease on both opacity
                 and a gentle rise + scale. The card feels like it's
                 arriving from a distance, not just popping visible. */
              <motion.div
                key="reveal"
                className="absolute inset-0"
                // NO scale animation here — react-three-fiber's Canvas
                // measures its container on mount, so animating scale
                // mid-mount produces a wrong-size camera fit that stays
                // wrong after the animation settles (the card ends up
                // off-centre until a window resize kicks it). Opacity
                // + rise do the "arrival" work; the actual card texture
                // load provides additional cinematic feel.
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  opacity: { duration: 1.6, ease: [0.25, 0.85, 0.25, 1] },
                  y: { duration: 1.8, ease: [0.2, 0.8, 0.2, 1] },
                }}
              >
                <div
                  className="absolute top-[-22vh] bottom-[-22vh] left-[-20vw] right-[-20vw]"
                  style={{ filter: 'drop-shadow(0 24px 32px rgba(0,0,0,0.1))' }}
                  onPointerDown={startInteract}
                  onPointerUp={endInteract}
                  onPointerCancel={endInteract}
                  onPointerLeave={endInteract}
                >
                  <Card3DViewer
                    frontImageUrl={frontUrl!}
                    insideImageUrl={insideUrl}
                    open={open}
                    onOpenChange={setOpen}
                    className="w-full h-full"
                  />
                </div>
              </motion.div>
            ) : (
              /* Generation wait stage — spinner + "on this day" feed.
                 Replaces the older NarrationStage (personalised
                 typographic narration). Simpler read, still filled
                 with interesting content during the 45s wait. Exits
                 with a slow dissolve + gentle rise when showReveal
                 flips so the handoff doesn't feel yanked. */
              <motion.div
                key="wait"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
              >
                <GenerationWaitStage
                  occasion={state.recipient?.occasion ?? null}
                  stage={generationStage}
                  hasInside={expectsInsideImage}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Post-reveal CTA stack — confirmation, Send CTA, gesture
            hints, regen entry. Only fires once showReveal flips so the
            entry doesn't race the card's materialise animation. */}
        <div className="relative z-30 max-w-xl mx-auto px-4 pt-2 text-center">
          <AnimatePresence mode="wait">
            {showReveal && (
              <motion.div
                key="post-reveal"
                className="flex flex-col items-center"
              >
                {/* The "ready" confirmation line was removed 2026-04-24
                    — the card itself is the confirmation, the sentence
                    felt redundant once the viewer was visible. The
                    narration's own ready line carries that beat
                    pre-reveal. */}

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 }}
                  className="mt-8 flex flex-col items-center gap-7"
                >
                  <Button
                    onClick={() =>
                      setLocation(
                        // Blank inside has no giving CHOICE to make
                        // (it can only be printed + posted to the
                        // sender), so it skips the Giving Moment and
                        // goes straight to checkout. A written inside
                        // gets the Giving Moment screen.
                        insideMode === 'blank'
                          ? `/checkout/${cardId}?product=print`
                          : `/studio/card/${cardId}/give`,
                      )
                    }
                    className="bg-brand hover:bg-brand-dark text-brand-foreground font-semibold px-10 py-3.5 rounded-lg w-full sm:w-auto"
                    size="lg"
                    data-testid="btn-buy-card"
                  >
                    Send this card
                  </Button>
                  {/* Caption beneath ("Choose digital or print next") was
                      removed 2026-04-25 — the 3D card has just appeared,
                      meta-instructing the user about UI yet to come dilutes
                      the moment. Buy button speaks for itself. */}
                </motion.div>

                {/* Gesture hints — sit close to the Buy CTA where they
                    were before regen was inserted. Reads better up here:
                    the hints are about the 3D card immediately above,
                    so keeping them adjacent makes the spatial story
                    obvious. They self-collapse once the user has played
                    with the card. */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isInteracting ? 0 : 1 }}
                  transition={{
                    duration: 0.5,
                    delay: hasInteracted || isInteracting ? 0 : 1.2,
                  }}
                  style={{ pointerEvents: isInteracting ? 'none' : 'auto' }}
                  className="mt-6"
                >
                  {/* Reserved-height slot so the regen entry below
                      doesn't get pushed when GestureHints fades in
                      (~900ms after mount). Using `height` not
                      `maxHeight` because hints render NOTHING until
                      their internal mount-delay fires — maxHeight
                      lets the wrapper shrink-to-fit during that gap,
                      so the hints' eventual appearance grows the
                      container from 0 → 72 and snaps everything
                      below down. Reserving height up front keeps
                      the layout still. */}
                  <div
                    className="flex justify-center items-start overflow-hidden transition-[height] duration-500 ease-out"
                    style={{ height: hasInteracted ? 0 : 72 }}
                  >
                    <GestureHints open={open || hasInteracted} />
                  </div>
                </motion.div>

                {/* Regen entry — small pill that flips the whole surface
                    into edit mode. Lives at the bottom of the post-reveal
                    stack so it reads as a quiet safety net, not a
                    parallel CTA. Audit warning (2026-04-26): don't
                    promote this above the Buy CTA in any future polish
                    pass — the hierarchy here is intentional. */}
                {onRegenerate && onSelectAttempt && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isInteracting ? 0 : 1 }}
                    transition={{
                      duration: 0.5,
                      delay: hasInteracted || isInteracting ? 0 : 1.5,
                    }}
                    style={{ pointerEvents: isInteracting ? 'none' : 'auto' }}
                    className="mt-8 flex justify-center"
                  >
                    <button
                      type="button"
                      onClick={() => setEditMode(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/60 hover:bg-white hover:border-brand/40 px-4 py-2 text-sm text-ink-soft hover:text-brand-dark transition-all"
                      data-testid="btn-regen-open"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
                      Think this could be better? Tweak it.
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
  );
}

// (BuyDialog + BuyOption removed 2026-05-19 — replaced by the inline
//  <GivingMoment>. See giving-moment.tsx + next_delivery_destination_usp.md.)

function CardImage({ url, label }: { url: string; label: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="aspect-square rounded-2xl overflow-hidden border border-stone-200 bg-stone-50">
        <img
          src={url}
          alt={`Generated ${label.toLowerCase()} of card`}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}

// ── Failure view ──────────────────────────────────────────────────────
//
// Delegates to <GenerationErrorPanel> which is the single source of
// truth for failure UX (also used by regen failures in a follow-on
// step). Translates the kind string from the server into the panel's
// typed enum, owns the retry mutation, and routes step-jump chips
// through the parent's onJumpToStep + stepIndexById mapping.
function FailedView({
  onRetry,
  failure,
  stepIndexById,
  onJumpToStep,
  onJumpToStepFromFailure,
}: {
  onRetry: () => Promise<void>;
  failure: import('@/hooks/use-card-maker').DraftFailureDTO | null;
  stepIndexById: Record<StepId, number>;
  onJumpToStep: (stepIndex: number) => void;
  onJumpToStepFromFailure?: (stepId: 'scene' | 'photo') => void;
}) {
  // Retry is a two-step operation orchestrated by the parent: first
  // POST /retry to flip the draft's server-side status from 'failed'
  // back to 'draft', then call startGeneration to kick off a fresh
  // run. Mutation here just wraps it for the button's pending state.
  const retryMutation = useMutation({
    mutationFn: onRetry,
    onError: (err: Error) => {
      toast({
        title: 'Retry failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Server returns kind as string (could be null if the failure pre-dated
  // the metadata schema, or if it was a plain Error not a ProviderError).
  // The panel's `kind` prop accepts null → falls back to 'unknown'.
  const kind = (failure?.kind ?? null) as
    | 'safety'
    | 'rate'
    | 'server'
    | 'auth'
    | 'unknown'
    | null;

  return (
    <div data-testid="review-failed">
      <GenerationErrorPanel
        kind={kind}
        modelExplanation={failure?.modelExplanation ?? null}
        suggestions={failure?.suggestions ?? null}
        provider={failure?.provider ?? null}
        code={failure?.code ?? null}
        context="initial"
        onRetry={() => retryMutation.mutate()}
        // Prefer the failure-specific handler from the parent (sets
        // retry-pending mode AND navigates), falling back to plain
        // navigation when the parent didn't supply it.
        onJumpToStep={(stepId) =>
          onJumpToStepFromFailure
            ? onJumpToStepFromFailure(stepId)
            : onJumpToStep(stepIndexById[stepId])
        }
        isRetrying={retryMutation.isPending}
      />
    </div>
  );
}

/** Review is always "ready" in the step-readiness sense — you can only
 *  land on it if all prior steps passed. The Generate button has its
 *  own in-component gate on the POST. */
export function isReviewStepReady(_state: CardDraftState): boolean {
  return true;
}
