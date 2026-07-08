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

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import {
  Sparkles,
  Pencil,
  User,
  Image as ImageIcon,
  MessageSquare,
  FileText,
  Type,
  Loader2,
  Printer,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import type { CardDraftState, StepId } from '@shared/schema';
import { deriveDefaultFrontText } from '@shared/schema';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { useTexture } from '@react-three/drei';
import { GestureHints } from '@/components/gesture-hints';
import {
  GenerationWaitStage,
  AssemblingCard,
  type GenerationStage,
} from '@/components/studio/generation-wait';
import {
  InsideStep,
  isInsideStepReady,
} from '@/components/studio/steps/inside-step';
import {
  CardOuterSpread,
  CardInnerSpread,
} from '@/components/studio/card-print-template';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
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
  /** Hook-provided debounced save + flush — threaded to the post-reveal
   *  InsideComposeStage (the inside message is written AFTER the front
   *  reveal since 2026-07-07; the composer autosaves like the old
   *  Inside step did). */
  scheduleSave?: (delayMs: number) => void;
  flushSave?: () => Promise<void>;
  /** Called when the user hits Generate. Parent handles the POST and
   *  subsequent status polling. */
  onGenerate: () => void;
  /** FRONT-FIRST: generate the inside after the user approves the front.
   *  Called from the front-ready approval bar. */
  onStartInsideGeneration?: () => Promise<void>;
  /** FRONT-FIRST: sign off the inside ('inside-ready' → 'completed') so
   *  the card assembles into the 3D reveal. */
  onFinalize?: () => Promise<void>;
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
  scheduleSave,
  flushSave,
  onGenerate,
  onStartInsideGeneration,
  onFinalize,
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
    status === 'generating' ||
    status === 'completed' ||
    isGenerating ||
    // Front-first intermediate states (studio front-first flow).
    status === 'generating-front' ||
    status === 'front-ready' ||
    status === 'generating-inside' ||
    status === 'inside-ready' ||
    status === 'inside-failed';

  if (inReveal) {
    return (
      <RevealView
        cardId={cardId}
        frontUrl={generatedFrontUrl}
        insideUrl={generatedInsideUrl}
        status={status}
        state={state}
        insideMode={state.inside?.mode ?? null}
        onChange={onChange}
        scheduleSave={scheduleSave}
        flushSave={flushSave}
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
        onStartInsideGeneration={onStartInsideGeneration}
        onFinalize={onFinalize}
        failure={failure ?? null}
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

  // Default: review + generate. Two framings for one surface:
  //   • organic first pass — "take one last look"
  //   • a "Start again with these details" clone (rerollOfCardId set) —
  //     "take two": signpost the fresh start, link back to the first
  //     take, and let the CTA say what it really does (Kevin 2026-07-08:
  //     "we're not going back… we're starting fresh, signpost better").
  const recipientName = state.recipient?.name?.trim();
  const isTakeTwo = !!state.rerollOfCardId;
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <p className="text-sm text-stone-600 leading-relaxed">
        {isTakeTwo
          ? 'Same details, clean slate. Sharpen anything below — the scene wording moves the needle most — or roll straight away. Every roll paints a brand-new card.'
          : 'Everything below is still a draft. Tap any section to change it — nothing gets sent until you say so.'}
      </p>

      {isTakeTwo && state.rerollOfCardId && (
        <FirstTakeRow cardId={state.rerollOfCardId} />
      )}

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
          {isTakeTwo
            ? recipientName
              ? `Roll a fresh take for ${recipientName}`
              : 'Roll a fresh take'
            : recipientName
              ? `Generate ${recipientName}'s card`
              : 'Generate my card'}
        </Button>
        <p className="text-[11px] text-stone-500 text-center mt-2 leading-relaxed">
          {isTakeTwo
            ? `About ${TYPICAL_GENERATION_SECONDS} seconds. Your first take stays in your drafts — nothing here overwrites it.`
            : `About ${TYPICAL_GENERATION_SECONDS} seconds to draft. Don't love it? Start again with the same details, free — your card saves as you go.`}
        </p>
      </div>
    </div>
  );
}

// ── FirstTakeRow ─────────────────────────────────────────────────────
// On a "take two" Review (a Start-again clone), show the FIRST take as
// a small reference row — thumbnail + reassurance + a link back. The
// user can compare without fear that rolling again destroys anything.
function FirstTakeRow({ cardId }: { cardId: number }) {
  const { data } = useQuery<{ frontImageUrl: string | null }>({
    queryKey: [`/api/studio/drafts/${cardId}`],
  });
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3"
      data-testid="first-take-row"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-stone-200 bg-white">
        {data?.frontImageUrl && (
          <img
            src={data.frontImageUrl}
            alt="Your first take"
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink">
          Your first take is safe in your drafts.
        </p>
        <p className="text-[11px] text-stone-500">
          Rolling again paints a brand-new card — it won't touch this one.
        </p>
      </div>
      <Link
        href={`/studio/card/${cardId}`}
        className="shrink-0 text-[12px] font-medium text-brand hover:text-brand-dark"
        data-testid="first-take-view"
      >
        View it →
      </Link>
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

      {/* Inside row. Since 2026-07-07 the message is written AFTER the
          front reveal, so on a fresh draft this row explains what's
          coming rather than reading "Not set" (which sounded like the
          user forgot something). Drafts that already carry a decision
          (resumed pre-re-sequence drafts, or the Buy-dialog recovery
          path) still show it, with the edit link. */}
      {insideMode === 'blank' ? (
        <SummaryRow
          icon={FileText}
          label="Inside"
          onEdit={() => onJumpToStep(stepIndexById.inside)}
          testId="summary-inside"
        >
          <div>
            <div className="text-sm text-stone-700">
              Blank centre with decorative border
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">
              We'll post it to you to handwrite inside.
            </div>
          </div>
        </SummaryRow>
      ) : insideMode === 'write' && insideWrite.message?.trim() ? (
        <SummaryRow
          icon={FileText}
          label="Inside"
          onEdit={() => onJumpToStep(stepIndexById.inside)}
          testId="summary-inside"
        >
          <div className="space-y-0.5 text-sm text-stone-700">
            {insideWrite.salutation && <div>{insideWrite.salutation}</div>}
            {insideWrite.message && (
              <div className="whitespace-pre-wrap">{insideWrite.message}</div>
            )}
            {insideWrite.signoff && <div>{insideWrite.signoff}</div>}
          </div>
        </SummaryRow>
      ) : (
        <SummaryRow icon={FileText} label="Inside" testId="summary-inside">
          <div className="text-sm text-stone-600">
            You'll write the inside once you've seen the front — so you
            know exactly what you're writing in.
          </div>
        </SummaryRow>
      )}
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
  /** Omit to render an informational row with no Edit link (the
   *  pre-reveal Inside row — there's nothing to edit yet). */
  onEdit?: () => void;
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
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="text-[11px] text-brand hover:text-brand-dark flex items-center gap-1"
              data-testid={`${testId}-edit`}
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
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
// ── FrontFirstStage ──────────────────────────────────────────────────
// The front-first WAIT + error states: front-gen wait, inside-gen wait,
// and the inside-failure retry. The front-ready PREVIEW + tweak is the
// proven RegenEditMode workbench (rendered separately in RevealView).
// The finished card reveals via the existing 3D ceremony at 'completed'.
function FrontFirstStage({
  status,
  occasion,
  insideMode,
  photoCount,
  onStartInsideGeneration,
  failure,
}: {
  status: string;
  occasion: string | null;
  insideMode: 'write' | 'blank' | null;
  photoCount?: number;
  onStartInsideGeneration?: () => Promise<void>;
  failure?: import('@/hooks/use-card-maker').DraftFailureDTO | null;
}) {
  if (status === 'generating-front' || status === 'generating-inside') {
    return (
      <div className="h-[60vh] sm:h-[68vh] w-full relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <GenerationWaitStage
            occasion={occasion}
            stage={status === 'generating-front' ? 'front' : 'inside'}
            hasInside={insideMode === 'write'}
            photoCount={photoCount}
          />
        </div>
      </div>
    );
  }

  // inside-failed
  return (
    <div className="max-w-md mx-auto py-16 text-center space-y-5">
      <p className="text-lg font-semibold text-ink">The inside didn't come out</p>
      <p className="text-sm text-stone-600">
        Your front is safe — let's just try the inside again.
      </p>
      {failure && (failure.kind || failure.message) && (
        <div className="mx-auto max-w-sm rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-left text-xs text-stone-600">
          <p className="font-semibold uppercase tracking-wide text-stone-500">
            {failure.kind ?? 'error'}
          </p>
          {failure.message && <p className="mt-1 break-words">{failure.message}</p>}
          {failure.modelExplanation && (
            <p className="mt-1 break-words text-stone-500">{failure.modelExplanation}</p>
          )}
        </div>
      )}
      <button
        onClick={() => onStartInsideGeneration?.()}
        className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark"
      >
        Try the inside again
      </button>
    </div>
  );
}

function frontFirstSubject(state: CardDraftState): string | null {
  const name = state.recipient?.name?.trim();
  if (!name) return null;
  const occ = state.recipient?.occasion?.trim();
  return occ ? `${name}'s ${occ} card` : `${name}'s card`;
}

// ── StartAgainButton ─────────────────────────────────────────────────
// The regen replacement (Kevin 2026-07-07 — tweak workbench parked
// for Premium): clone this card's inputs into a fresh draft and jump
// to its Review. Every re-roll goes through the full crafted
// generation prompt — the engine that impresses — never the edit
// pipeline. The current card is untouched (stays in drafts).
export function StartAgainButton({
  cardId,
  pill = false,
  className,
}: {
  cardId: number;
  /** Match a rounded-full primary (the sign-off screens) instead of
   *  the default rounded-lg (Send rows). */
  pill?: boolean;
  /** Extra layout classes on the trigger button. */
  className?: string;
}) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const startAgain = async () => {
    setBusy(true);
    try {
      const res = await apiRequest(
        'POST',
        `/api/studio/drafts/${cardId}/duplicate`,
        {},
      );
      const { id } = (await res.json()) as { id: number };
      setLocation(`/studio/card/${id}/edit`);
    } catch (err: any) {
      toast({
        title: "Couldn't start again",
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      {/* SAME-SIZE sibling to the primary beside it (Kevin 2026-07-08)
          — the explanation lives in the module, not the button. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        // Dimensions EXACTLY mirror the primary beside it: same fixed
        // height, same fixed sm width (pill pair = w-80 on the
        // sign-off screens, lg pair = w-64 beside Send).
        className={`inline-flex h-[52px] w-full items-center justify-center border border-stone-300 bg-white text-[15px] font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-dark ${
          pill ? 'max-w-[320px] rounded-full sm:w-80' : 'rounded-lg sm:w-64'
        } ${className ?? ''}`}
        data-testid="btn-start-again"
      >
        Not quite right?
      </button>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-semibold text-ink">
            Start again with these details
          </DialogTitle>
          <div className="space-y-3 pt-1">
            <ExplainRow icon={RotateCcw}>
              We copy everything across — recipient, photo, scene, your
              words — into a fresh card you can tweak before rolling.
            </ExplainRow>
            <ExplainRow icon={Sparkles}>
              Generating paints a brand-new take. Every roll comes out
              different — that's the fun of it.
            </ExplainRow>
            <ExplainRow icon={FileText}>
              This take stays saved in your drafts, so you can compare
              and send whichever one you love. Free until you buy.
            </ExplainRow>
          </div>
          <div className="flex flex-col gap-2 pt-3 sm:flex-row-reverse">
            <Button
              onClick={() => void startAgain()}
              disabled={busy}
              className="bg-brand hover:bg-brand-dark text-brand-foreground sm:flex-1"
              data-testid="btn-start-again-confirm"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up your next take…
                </>
              ) : (
                'Start my fresh take →'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="border-stone-300 sm:flex-1"
              data-testid="btn-start-again-cancel"
            >
              Keep this take
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExplainRow({
  icon: Icon,
  children,
}: {
  icon: typeof RotateCcw;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand-dark">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <p className="text-sm leading-relaxed text-stone-600">{children}</p>
    </div>
  );
}

// ── FrontFirstReview ─────────────────────────────────────────────────
// The DEFAULT front-first review surface: big card image (hero) + a small
// print-ready spread (secondary) + a primary sign-off and a quiet "Make a
// change" that opens the edit workbench. Editing is deliberately behind a
// button so the step reads as "look at your card", not "edit your card".
function FrontFirstReview({
  title,
  subject,
  heroUrl,
  printVisual,
  approveLabel,
  onApprove,
  secondary,
}: {
  title: string;
  subject: string | null;
  heroUrl: string | null;
  printVisual: React.ReactNode;
  approveLabel: string;
  onApprove?: () => Promise<void>;
  /** Secondary action under the approve button — the StartAgainButton
   *  (the tweak workbench is parked for Premium, 2026-07-07). */
  secondary?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  // Toggle the hero between the full card image and the print-ready
  // spread. The toggle is a CHIP on the hero's corner (was a separate
  // 120px block below it, which pushed the actions under the fold —
  // Kevin 2026-07-08).
  const [heroView, setHeroView] = useState<'image' | 'print'>('image');
  const showingPrint = heroView === 'print';
  return (
    <div className="mx-auto max-w-2xl py-4">
      <div className="mb-4 text-center">
        <p className="text-lg font-semibold text-ink">{title}</p>
        {subject && <p className="mt-0.5 text-sm text-stone-500">{subject}</p>}
      </div>

      {/* Fixed square footprint so toggling image ↔ print never moves
          the CTAs below. The landscape print spread centres vertically
          inside the square; the full image fills it. */}
      <div className="relative mx-auto flex aspect-square w-full max-w-[300px] items-center justify-center">
        {showingPrint ? (
          <div className="w-full">{printVisual}</div>
        ) : (
          <div className="aspect-square w-full overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-[0_30px_60px_-22px_rgba(15,23,42,0.30)]">
            {heroUrl && <img src={heroUrl} alt="Your card" className="h-full w-full object-cover" />}
          </div>
        )}
        <button
          type="button"
          onClick={() => setHeroView((v) => (v === 'print' ? 'image' : 'print'))}
          className="absolute -bottom-3 right-2 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-stone-600 shadow-sm transition-colors hover:border-brand/40 hover:text-brand-dark"
          aria-label={showingPrint ? 'Show the full image' : 'Show the print-ready layout'}
          data-testid="btn-hero-print-toggle"
        >
          <Printer className="h-3 w-3" strokeWidth={1.75} />
          {showingPrint ? 'Card view' : 'Print view'}
        </button>
      </div>

      {/* Actions — side-by-side on desktop so BOTH choices sit above
          the fold; stacked on mobile with tightened rhythm. */}
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-center">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onApprove?.();
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex h-[52px] w-full max-w-[320px] items-center justify-center rounded-full bg-brand px-6 text-[15px] font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50 sm:w-80"
        >
          {busy ? 'One sec…' : approveLabel}
        </button>
        {secondary}
      </div>
    </div>
  );
}

// ── InsideComposeStage ───────────────────────────────────────────────
// The post-reveal inside composer (2026-07-07 re-sequence). The user
// has just approved the front; now — with that front visible beside
// them — they pick write/blank and write the message. Reuses the
// InsideStep fork/form wholesale so the two entry points (this stage +
// the Buy-dialog recovery jump to the old step) never drift apart.
function InsideComposeStage({
  cardId,
  state,
  subject,
  frontUrl,
  onChange,
  scheduleSave,
  flushSave,
  onBack,
  onSubmit,
}: {
  cardId: number;
  state: CardDraftState;
  subject: string | null;
  frontUrl: string | null;
  onChange: (patch: Partial<CardDraftState>) => void;
  scheduleSave?: (delayMs: number) => void;
  flushSave?: () => Promise<void>;
  onBack: () => void;
  onSubmit: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const ready = isInsideStepReady(state);
  const blank = state.inside?.mode === 'blank';
  const recipientName = state.recipient?.name?.trim();
  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-6 text-center">
        <p className="text-lg font-semibold text-ink">Now, the inside</p>
        <p className="mt-0.5 text-sm text-stone-500">
          {recipientName
            ? `This is what ${recipientName} reads when they open it.`
            : 'This is what they read when they open it.'}
        </p>
      </div>

      {/* The approved front stays on screen, small — the whole point of
          writing HERE is writing in its company. */}
      {frontUrl && (
        <div className="mx-auto mb-6 flex items-center justify-center gap-3">
          <div className="aspect-square w-20 overflow-hidden rounded-md border border-stone-200 shadow-sm">
            <img src={frontUrl} alt="Your card front" className="h-full w-full object-cover" />
          </div>
          <p className="max-w-[200px] text-left text-[11.5px] leading-snug text-stone-500">
            {subject ? `The front of ${subject} — locked in.` : 'Your front — locked in.'}{' '}
            We'll design the inside to match.
          </p>
        </div>
      )}

      <InsideStep
        cardId={cardId}
        state={state}
        onChange={onChange}
        scheduleSave={scheduleSave ?? (() => {})}
        flushSave={flushSave ?? (async () => {})}
      />

      <div className="mt-7 flex flex-col items-center gap-3">
        <button
          disabled={!ready || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSubmit();
            } finally {
              setBusy(false);
            }
          }}
          className="w-full max-w-[320px] rounded-full bg-brand px-6 py-3.5 text-[15px] font-medium text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
          data-testid="btn-make-inside"
        >
          {busy
            ? 'One sec…'
            : blank
              ? 'Finish the card →'
              : 'Make the inside →'}
        </button>
        {!ready && (
          <p className="text-[11.5px] text-stone-400">
            Write your message — or choose to leave it blank — to carry on.
          </p>
        )}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-4 py-2 text-[13px] text-stone-600 transition-colors hover:bg-stone-50"
          data-testid="btn-back-to-front"
        >
          ← Back to the front
        </button>
      </div>
    </div>
  );
}

function RevealView({
  cardId,
  frontUrl,
  insideUrl,
  status,
  state,
  insideMode,
  onChange,
  scheduleSave,
  flushSave,
  onEditInside,
  attempts,
  isRegenerating,
  regenError,
  onRegenerate,
  onSelectAttempt,
  onJumpToStepFromRegenFailure,
  onUpdateInputs,
  onStartInsideGeneration,
  onFinalize,
  failure,
}: {
  cardId: number;
  frontUrl: string | null;
  insideUrl: string | null;
  status: string | null;
  /** Full draft — NarrationStage personalises every beat from it. */
  state: CardDraftState;
  insideMode: 'write' | 'blank' | null;
  /** Draft patcher + autosave pair — power the post-reveal
   *  InsideComposeStage (write the message after seeing the front). */
  onChange: (patch: Partial<CardDraftState>) => void;
  scheduleSave?: (delayMs: number) => void;
  flushSave?: () => Promise<void>;
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
  /** FRONT-FIRST: generate the inside after the front is approved. */
  onStartInsideGeneration?: () => Promise<void>;
  /** FRONT-FIRST: sign off the inside → assemble (3D reveal). */
  onFinalize?: () => Promise<void>;
  /** Failure metadata (inside-failed) — shown on the inside-failed stage. */
  failure?: import('@/hooks/use-card-maker').DraftFailureDTO | null;
}) {
  // Ready = server says done and both image URLs have landed on the
  // client. `frontUrl` alone isn't enough (server persists it mid-gen;
  // client deliberately waits for the complete picture).
  // Blank-inside cards generate NO inside image, so don't gate readiness on
  // insideUrl — otherwise isReady never flips and the wait-stage spinner hangs
  // forever (the "card finished generating but a purple spinner stayed" bug).
  const isReady =
    status === 'completed' && !!frontUrl && (insideMode !== 'write' || !!insideUrl);

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
      // Match Three.js's crossOrigin='anonymous' loader — otherwise a no-cors
      // preload poisons the cache for cross-origin (R2) images and the texture
      // load fails (no ACAO) → WebGL context lost.
      el.crossOrigin = 'anonymous';
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
  // (editMode + frontFirstEditing removed 2026-07-07 — the tweak
  // workbench is parked for Premium; StartAgainButton is the iterate
  // affordance now.)
  // Post-reveal inside composer (2026-07-07 re-sequence): approving the
  // front opens the write/blank fork + message form HERE — in front of
  // the approved front — instead of the message having been collected
  // blind back at a stepper step.
  const [insideComposing, setInsideComposing] = useState(false);
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

  // ── FRONT-FIRST intermediate states ────────────────────────────────
  // Purely additive: legacy 'full' cards go straight generating →
  // completed and never enter these. Front-first cards pass through here
  // (front preview + approve) BEFORE the existing completed-card 3D
  // ceremony below, which still runs unchanged at status 'completed'.
  // The tweak workbench (RegenEditMode) was PARKED for Premium
  // 2026-07-07 — the iterate affordance is now StartAgainButton (clone
  // the inputs, re-roll through the full crafted prompt).
  if (status === 'front-ready') {
    // Approving the front opens the inside composer (write/blank fork +
    // message form) — the message is written IN CONTEXT of the approved
    // front (Kevin's June call, built 2026-07-07). generate-inside only
    // fires from the composer's own CTA.
    if (insideComposing) {
      return (
        <InsideComposeStage
          cardId={cardId}
          state={state}
          subject={frontFirstSubject(state)}
          frontUrl={frontUrl}
          onChange={onChange}
          scheduleSave={scheduleSave}
          flushSave={flushSave}
          onBack={() => setInsideComposing(false)}
          onSubmit={async () => {
            await flushSave?.();
            await onStartInsideGeneration?.();
          }}
        />
      );
    }
    return (
      <FrontFirstReview
        title="Here's the front"
        subject={frontFirstSubject(state)}
        heroUrl={frontUrl}
        printVisual={<CardOuterSpread frontUrl={frontUrl} />}
        approveLabel="Looks good — now the inside →"
        onApprove={async () => setInsideComposing(true)}
        secondary={<StartAgainButton cardId={cardId} pill />}
      />
    );
  }

  // Inside-ready: mirror the front step — big inside image + the print
  // spread. Sign off → finalize → the 3D assemble. The escape hatch is
  // the same start-again clone (the crafted prompt re-rolls everything;
  // a surgical inside-only tweak is a Premium-tier problem).
  if (status === 'inside-ready') {
    return (
      <FrontFirstReview
        title="Here's the inside"
        subject={frontFirstSubject(state)}
        heroUrl={insideUrl}
        printVisual={<CardInnerSpread insideUrl={insideUrl} />}
        approveLabel="Looks good — assemble the card →"
        onApprove={onFinalize}
        secondary={<StartAgainButton cardId={cardId} pill />}
      />
    );
  }

  if (
    status === 'generating-front' ||
    status === 'generating-inside' ||
    status === 'inside-failed'
  ) {
    return (
      <FrontFirstStage
        status={status}
        occasion={state.recipient?.occasion ?? null}
        insideMode={insideMode}
        photoCount={state.photos?.photoIds?.length ?? 0}
        onStartInsideGeneration={onStartInsideGeneration}
        failure={failure}
      />
    );
  }

  // (The completed-reveal edit mode — RegenEditMode workbench — was
  // PARKED for Premium 2026-07-07 along with the whole tweak flow.
  // regen-controls.tsx is preserved for revival.)

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
                    enableRotate={false}
                    enableZoom={false}
                    // Rest slightly AJAR with a touch of turn. Fully
                    // closed + straight-on read as "a flat image"
                    // (Kevin 2026-07-07); the crack of visible inside
                    // is what sells it as a physical card before the
                    // first tap. ~22° (Kevin's dial-in; the landing
                    // hero sits wider at ~31°).
                    closedAngle={-0.38}
                    restYaw={-0.12}
                    className="w-full h-full"
                  />
                </div>
              </motion.div>
            ) : (
              /* Pre-reveal wait. When the card is still GENERATING a side
                 (legacy combined path: front/inside), show the full
                 wait — bar + quiet stages + celebration quotes. When
                 we're just ASSEMBLING (both sides done, status flipped
                 to completed → stage 'finishing'/'ready'), it's a quick
                 composite, not a gen — so show a plain spinner instead
                 of the 90s-style quotes screen (Kevin, 2026-06-27). */
              <motion.div
                key="wait"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
              >
                {generationStage === 'finishing' ||
                generationStage === 'ready' ? (
                  <AssemblingCard />
                ) : (
                  <GenerationWaitStage
                    occasion={state.recipient?.occasion ?? null}
                    stage={generationStage}
                    hasInside={expectsInsideImage}
                    photoCount={state.photos?.photoIds?.length ?? 0}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Post-reveal CTA stack — confirmation, Send CTA, gesture
            hints, regen entry. Only fires once showReveal flips so the
            entry doesn't race the card's materialise animation. */}
        {/* -mt lifts the whole CTA group (hint + button) up toward the
            fixed 3D card above, as one unit (Kevin 2026-06-27). */}
        <div className="relative z-30 -mt-8 max-w-xl mx-auto px-4 pt-2 text-center">
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

                {/* "Tap to open" hint — sits directly under the 3D card,
                    ABOVE the Send CTA. Only the open hint shows (rotate +
                    zoom disabled). Collapses once the card is opened.
                    There is intentionally NO tweak/regen entry on the
                    final reveal — tweaking happens only at the front and
                    inside review steps (Kevin 2026-06-27). */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isInteracting ? 0 : 1 }}
                  transition={{
                    duration: 0.5,
                    delay: isInteracting ? 0 : 0.5,
                  }}
                  style={{ pointerEvents: isInteracting ? 'none' : 'auto' }}
                  className="mt-6"
                >
                  {/* FIXED-height slot (Kevin 2026-07-08: the old
                      collapse-on-open shoved the page when already
                      scrolled). The hint never leaves — its label
                      toggles Tap to open ↔ Tap to close instead. */}
                  <div className="flex h-[72px] items-start justify-center">
                    <GestureHints
                      open={open}
                      mountDelayMs={450}
                      hideRotateHint
                      hideZoomHint
                      openLabel="Tap to close"
                    />
                  </div>
                </motion.div>

                {/* Send CTA + the iterate escape on ONE row (sm+) so
                    both choices share the fold (Kevin 2026-07-08 —
                    start-again was buried below it). Stacked on
                    mobile; Send always first. */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 }}
                  className="mt-2 flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-center"
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
                    className="bg-brand hover:bg-brand-dark text-brand-foreground font-semibold h-[52px] rounded-lg w-full sm:w-64"
                    size="lg"
                    data-testid="btn-buy-card"
                  >
                    Send this card
                  </Button>
                  <StartAgainButton cardId={cardId} />
                </motion.div>
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
