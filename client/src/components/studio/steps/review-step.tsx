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
import { useLocation } from 'wouter';
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
import { useToast } from '@/hooks/use-toast';
import { Card3DViewer, toWebpDisplay } from '@/components/card-3d-viewer';
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
import { CardArtImg } from '@/components/studio/card-art-img';
import { GenerationErrorPanel } from '@/components/studio/generation-error-panel';
import { familyKey } from '@/lib/studio-card-buckets';
import { likenessNoteForSet } from '@/lib/photo-likeness';
import type { Photo } from '@shared/models/photos';
import type { CardAttemptDTO } from '@/hooks/use-card-maker';
import type { CardSide, CardGridItem } from '@shared/schema';

// Approximate generation time per side (front / inside). Used to size the
// pre-gen advice copy ("about 90 seconds") so it matches the progress
// bar's ESTIMATE_MS=90s in generation-wait.tsx — and reality: observed
// front gens run ~80s (Kevin 2026-07-09), so 45 was under-promising and
// over-disappointing. Not a hard timeout — some providers are slower.
const TYPICAL_GENERATION_SECONDS = 90;

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
  // ── Blank front-headline confirm (Kevin 2026-07-21) ─────────────────
  // "Leave the front blank → we use the derived default" is easy to miss
  // (tiny helper text), so a user can generate with an unintended headline.
  // If they hit Generate with no headline typed AND a default would be used,
  // confirm first: keep the default, go text-free, or write one. Text-free
  // must persist mode='none' BEFORE generating (the server reads the SAVED
  // draft), so we flushSave then generate via a one-shot effect once the
  // state has committed — avoids racing the fire-and-forget save.
  const [frontConfirmOpen, setFrontConfirmOpen] = useState(false);
  const [pendingTextFreeGen, setPendingTextFreeGen] = useState(false);
  const defaultFrontText = deriveDefaultFrontText(state);
  const needsFrontConfirm =
    state.front?.mode !== 'none' &&
    !state.front?.text?.trim() &&
    !!defaultFrontText;

  const handleGenerateClick = () => {
    if (needsFrontConfirm) setFrontConfirmOpen(true);
    else onGenerate();
  };
  const confirmUseDefault = () => {
    setFrontConfirmOpen(false);
    onGenerate();
  };
  const confirmTextFree = () => {
    onChange({ front: { ...state.front, mode: 'none' } });
    setFrontConfirmOpen(false);
    setPendingTextFreeGen(true);
  };
  useEffect(() => {
    if (pendingTextFreeGen && state.front?.mode === 'none') {
      setPendingTextFreeGen(false);
      void (async () => {
        await flushSave?.();
        onGenerate();
      })();
    }
  }, [pendingTextFreeGen, state.front?.mode, flushSave, onGenerate]);

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
  //     a fresh take: signpost it, show the WHOLE take family (not just
  //     the parent), and let the CTA say what it does. The take number
  //     + prior-take thumbnails come from the family (TakesStrip);
  //     nothing is hardcoded (the old "take two" was wrong from take 3).
  const recipientName = state.recipient?.name?.trim();
  const isReroll = !!state.rerollOfCardId;
  const familyId = state.rerollFamilyId ?? cardId;
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <p className="text-sm text-keeper-body leading-relaxed">
        {isReroll
          ? 'Same details, clean slate. Sharpen anything below — the scene wording moves the needle most — or roll straight away. Every roll paints a brand-new card, and every take you make is kept.'
          : 'Everything below is still a draft. Tap any section to change it — nothing gets sent until you say so.'}
      </p>

      {isReroll && <TakesStrip currentCardId={cardId} familyId={familyId} />}

      <SummaryPanel
        state={state}
        stepIndexById={stepIndexById}
        onJumpToStep={onJumpToStep}
        isReroll={isReroll}
      />

      <PhotoQualityNote state={state} onJumpToStep={onJumpToStep} stepIndexById={stepIndexById} />

      <div className="pt-2">
        <Button
          onClick={handleGenerateClick}
          className="w-full bg-cta hover:bg-cta-hover text-cta-foreground text-base py-6 shadow-sm hover:shadow-md transition-shadow"
          data-testid="btn-generate-card"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          {isReroll
            ? recipientName
              ? `Roll a fresh take for ${recipientName}`
              : 'Roll a fresh take'
            : recipientName
              ? `Generate ${recipientName}'s card`
              : 'Generate my card'}
        </Button>
        <p className="text-[11px] text-keeper-meta text-center mt-2 leading-relaxed">
          {isReroll
            ? `About ${TYPICAL_GENERATION_SECONDS} seconds. Your earlier takes stay in your drafts — nothing here overwrites them.`
            : `About ${TYPICAL_GENERATION_SECONDS} seconds to draft. Don't love it? Start again with the same details, free — your card saves as you go.`}
        </p>
      </div>

      {/* Blank front-headline confirm — fires when Generate is pressed with
          no headline typed and a default would be used. */}
      <Dialog open={frontConfirmOpen} onOpenChange={setFrontConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-display font-bold tracking-[-0.015em] text-keeper-ink">
            No front headline yet
          </DialogTitle>
          <p className="pt-1 text-sm text-keeper-body leading-relaxed">
            You haven't written a headline for the front. We'll add{' '}
            <strong className="text-keeper-ink">“{defaultFrontText}”</strong> —
            or the front can stay text-free, just the scene.
          </p>
          <div className="flex flex-col gap-2 pt-4">
            <Button
              onClick={confirmUseDefault}
              className="bg-go hover:bg-go-hover text-go-foreground"
              data-testid="btn-front-confirm-default"
            >
              Use “{defaultFrontText}”
            </Button>
            <Button
              variant="outline"
              onClick={confirmTextFree}
              className="border-stone-300"
              data-testid="btn-front-confirm-textfree"
            >
              Leave the front text-free
            </Button>
            <button
              type="button"
              onClick={() => {
                setFrontConfirmOpen(false);
                onJumpToStep(stepIndexById.front);
              }}
              className="mt-1 text-xs text-keeper-meta underline underline-offset-2 hover:text-keeper-body"
              data-testid="btn-front-confirm-write"
            >
              Actually, I'll write one
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── TakesStrip ───────────────────────────────────────────────────────
// On a reroll Review, show the WHOLE take family — every prior take as
// a clickable thumbnail (Take 1, 2, …) plus the current in-progress one
// marked "you're here." Fixes the old FirstTakeRow, which only showed
// the immediate PARENT mislabelled as "your first take" (so take 3
// called take 2 the original + take 1 vanished). Same family logic as
// the card-view TakesRail: filter by familyKey, generated + has image,
// oldest-first. Take numbers are derived here — self-healing, no
// hardcoded count, no stored field.
function TakesStrip({
  currentCardId,
  familyId,
}: {
  currentCardId: number;
  familyId: number;
}) {
  const [, setLocation] = useLocation();
  const { data: allCards } = useQuery<CardGridItem[]>({
    queryKey: ['/api/user/cards'],
  });
  const prior = (allCards ?? [])
    .filter(
      (c) =>
        familyKey(c) === familyId &&
        c.id !== currentCardId &&
        // Any take that produced a front counts (incl. front-ready /
        // inside-ready restarts, not just 'completed') — the card view
        // safely redirects non-completed clicks to the editor.
        !!c.frontImageUrl,
    )
    .sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return at - bt; // oldest first — reads as take 1, 2, 3…
    });
  const currentNumber = prior.length + 1;

  return (
    <div
      className="rounded-xl border border-keeper-hair bg-stone-50 p-4"
      data-testid="takes-strip"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-keeper-meta">
          Your takes
        </p>
        <p className="text-[11px] text-keeper-meta">
          Every take is saved — flip back any time.
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        {prior.map((t, idx) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setLocation(`/studio/card/${t.id}`)}
            className="group flex flex-col items-center gap-1"
            data-testid={`takes-strip-thumb-${t.id}`}
          >
            <span className="block h-16 w-16 overflow-hidden rounded-lg border border-keeper-hair opacity-80 transition-all group-hover:border-brand/40 group-hover:opacity-100">
              <img
                src={t.frontImageUrl!}
                alt={`Take ${idx + 1}`}
                crossOrigin="anonymous"
                className="h-full w-full object-cover"
              />
            </span>
            <span className="text-[10px] text-keeper-meta transition-colors group-hover:text-brand-dark">
              Take {idx + 1}
            </span>
          </button>
        ))}
        {/* Current in-progress take — the one they're about to roll. */}
        <div className="flex flex-col items-center gap-1" data-testid="takes-strip-current">
          <span className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-brand/50 bg-brand-muted/30 text-brand">
            <Sparkles className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="text-[10px] font-semibold text-brand-dark">
            Take {currentNumber}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Summary panel — card-frame-shaped list of chosen fields ──────────
function SummaryPanel({
  state,
  stepIndexById,
  onJumpToStep,
  isReroll = false,
}: {
  state: CardDraftState;
  stepIndexById: Record<StepId, number>;
  onJumpToStep: (stepIndex: number) => void;
  /** On a reroll, the inside is INHERITED and confirmed post-front, so
   *  the Review defers it (no pre-front editing) — one inside
   *  touchpoint, consistent with the first-time flow (Kevin
   *  2026-07-09). */
  isReroll?: boolean;
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
        <div className="text-sm text-keeper-ink font-medium">
          {recipient?.name || <span className="text-keeper-meta font-normal">Not set</span>}
        </div>
        {recipient?.occasion && (
          <div className="text-xs text-keeper-meta capitalize mt-0.5">
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
        <div className="text-sm text-keeper-ink">
          {photoCount === 0 ? (
            <span className="text-keeper-meta">Not uploaded</span>
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
          <p className="text-sm text-keeper-ink leading-relaxed">{scene}</p>
        ) : (
          <span className="text-sm text-keeper-meta">Not set</span>
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
            <div className="text-sm text-keeper-ink font-medium">{frontText}</div>
            {frontTextIsDefault && (
              <div className="text-xs text-keeper-meta mt-0.5">
                Default — tap Edit to change.
              </div>
            )}
          </>
        ) : frontExplicitlySkipped ? (
          <div>
            <div className="text-sm text-keeper-body">No headline on the front</div>
            <div className="text-[11px] text-keeper-meta mt-0.5">
              The scene stands alone.
            </div>
          </div>
        ) : (
          <span className="text-sm text-keeper-meta">No text on front</span>
        )}
      </SummaryRow>

      {/* Inside row. Since 2026-07-07 the message is written AFTER the
          front reveal, so on a fresh draft this row explains what's
          coming rather than reading "Not set" (which sounded like the
          user forgot something). Drafts that already carry a decision
          (resumed pre-re-sequence drafts, or the Buy-dialog recovery
          path) still show it, with the edit link. */}
      {isReroll ? (
        // Reroll: inside is inherited + confirmed AFTER the front (one
        // touchpoint). Defer here — no pre-front edit link — so it
        // isn't asked for twice.
        <SummaryRow icon={FileText} label="Inside" testId="summary-inside">
          <div className="text-sm text-keeper-body">
            {insideMode === 'blank'
              ? "Your blank inside carries over — you'll confirm it after the front."
              : "Your inside message carries over — you'll confirm it after the front."}
          </div>
        </SummaryRow>
      ) : insideMode === 'blank' ? (
        <SummaryRow
          icon={FileText}
          label="Inside"
          onEdit={() => onJumpToStep(stepIndexById.inside)}
          testId="summary-inside"
        >
          <div>
            <div className="text-sm text-keeper-body">
              Blank centre with decorative border
            </div>
            <div className="text-[11px] text-keeper-meta mt-0.5">
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
          <div className="space-y-0.5 text-sm text-keeper-body">
            {insideWrite.salutation && <div>{insideWrite.salutation}</div>}
            {insideWrite.message && (
              <div className="whitespace-pre-wrap">{insideWrite.message}</div>
            )}
            {insideWrite.signoff && <div>{insideWrite.signoff}</div>}
          </div>
        </SummaryRow>
      ) : (
        <SummaryRow icon={FileText} label="Inside" testId="summary-inside">
          <div className="text-sm text-keeper-body">
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
      className="flex items-start gap-3 bg-white border border-keeper-hair rounded-xl p-4 sm:p-5 shadow-sm"
      data-testid={testId}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-brand-muted text-brand">
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-keeper-meta uppercase tracking-wider">
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
  preFront.push(`Giving it a ${styleLabel} style.`);

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
  onEditInsideMessage,
  failure,
}: {
  status: string;
  occasion: string | null;
  insideMode: 'write' | 'blank' | null;
  photoCount?: number;
  onStartInsideGeneration?: () => Promise<void>;
  /** Jump back to the Inside step so the user can CHANGE the words —
   *  without this, a safety-rejected message was an infinite loop:
   *  the only button re-sent the identical text (audit 2026-07-27). */
  onEditInsideMessage?: () => void;
  failure?: import('@/hooks/use-card-maker').DraftFailureDTO | null;
}) {
  const { toast } = useToast();
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
      <p className="text-lg font-display font-bold tracking-[-0.015em] text-keeper-ink">The inside didn't come out</p>
      <p className="text-sm text-keeper-body">
        Your front is safe — let's just try the inside again.
      </p>
      {failure && (failure.kind || failure.message) && (
        <div className="mx-auto max-w-sm rounded-xl border border-keeper-hair bg-stone-50 px-4 py-3 text-left text-xs text-keeper-body">
          <p className="font-semibold uppercase tracking-wide text-keeper-meta">
            {failure.kind ?? 'error'}
          </p>
          {failure.message && <p className="mt-1 break-words">{failure.message}</p>}
          {failure.modelExplanation && (
            <p className="mt-1 break-words text-keeper-meta">{failure.modelExplanation}</p>
          )}
        </div>
      )}
      <button
        onClick={() =>
          onStartInsideGeneration?.().catch((err: any) =>
            // Un-awaited rejections used to vanish — a cap/limit 429 made
            // the button a silent no-op (audit 2026-07-27).
            toast({
              title: "Couldn't start the inside",
              description: err?.message ?? 'Try again in a moment.',
              variant: 'destructive',
            }),
          )
        }
        className="rounded-full bg-go px-6 py-3 text-sm font-medium text-go-foreground transition-colors hover:bg-go-hover"
      >
        Try the inside again
      </button>
      {onEditInsideMessage && (
        <button
          onClick={onEditInsideMessage}
          className="block mx-auto text-xs text-brand underline underline-offset-2 hover:text-brand-dark"
          data-testid="inside-failed-edit-message"
        >
          Change the message first
        </button>
      )}
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
  quiet = false,
  label = 'Not quite right?',
  className,
}: {
  cardId: number;
  /** Match a rounded-full primary (the sign-off screens) instead of
   *  the default rounded-lg (Send rows). */
  pill?: boolean;
  /** Render as a small underline text link rather than a boxed button —
   *  used when start-over is the tertiary escape (e.g. under "Change the
   *  inside" on the inside reveal), not a co-primary. */
  quiet?: boolean;
  /** Trigger copy. Defaults to "Not quite right?"; the inside reveal
   *  passes "Start over completely" since a lighter redo sits above it. */
  label?: string;
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
      {/* Quiet variant: a small underline link for when start-over is the
          tertiary escape (a lighter redo sits above it). */}
      {quiet ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`text-[13px] font-medium text-keeper-meta underline decoration-keeper-hair underline-offset-4 transition-colors hover:text-keeper-ink ${
            className ?? ''
          }`}
          data-testid="btn-start-again"
        >
          {label}
        </button>
      ) : (
        /* SAME-SIZE sibling to the primary beside it (Kevin 2026-07-08)
           — the explanation lives in the module, not the button. */
        <button
          type="button"
          onClick={() => setOpen(true)}
          // Dimensions EXACTLY mirror the primary beside it: same fixed
          // height, same fixed sm width (pill pair = w-80 on the
          // sign-off screens, lg pair = w-64 beside Send).
          className={`inline-flex h-[52px] w-full items-center justify-center rounded-full border border-keeper-hair bg-white text-[15px] font-semibold text-keeper-ink transition-colors hover:border-brand/50 hover:text-brand-dark ${
            pill ? 'max-w-[320px] sm:w-80' : 'sm:w-64'
          } ${className ?? ''}`}
          data-testid="btn-start-again"
        >
          {label}
        </button>
      )}

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-display font-bold tracking-[-0.015em] text-keeper-ink">
            Try another version
          </DialogTitle>
          <div className="space-y-3 pt-1">
            <ExplainRow icon={RotateCcw}>
              We keep your photo, scene and message. Change anything first,
              or leave it as it is.
            </ExplainRow>
            <ExplainRow icon={Sparkles}>
              Each version comes out a little different — you might get an
              even better one.
            </ExplainRow>
            <ExplainRow icon={FileText}>
              Both versions stay in your drafts, so you can compare them and
              send your favourite. Free until you buy.
            </ExplainRow>
          </div>
          <div className="flex flex-col gap-2 pt-3 sm:flex-row-reverse">
            <Button
              onClick={() => void startAgain()}
              disabled={busy}
              className="bg-go hover:bg-go-hover text-go-foreground sm:flex-1"
              data-testid="btn-start-again-confirm"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up…
                </>
              ) : (
                'Make another →'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="border-stone-300 sm:flex-1"
              data-testid="btn-start-again-cancel"
            >
              Keep this one
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
      <p className="text-sm leading-relaxed text-keeper-body">{children}</p>
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
  frontReference,
  frontReferenceLabel,
  printLabel,
  stackActions = false,
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
  /** Inside reveal only: a print-ready thumbnail of the APPROVED FRONT,
   *  shown beside the inside's print thumbnail so the user can compare
   *  front vs inside side by side (Kevin 2026-07-11). */
  frontReference?: React.ReactNode;
  /** Caption under the front reference (e.g. "Front · approved"). */
  frontReferenceLabel?: string;
  /** Caption on the hero's own print thumbnail. Defaults to the generic
   *  "Print-ready · tap to view"; the inside reveal passes "Inside" so
   *  the pair reads Front · Inside. */
  printLabel?: string;
  /** Stack the primary + secondary actions vertically instead of the
   *  default side-by-side (the inside reveal has three actions). */
  stackActions?: boolean;
}) {
  const { toast: approveToast } = useToast();
  const [busy, setBusy] = useState(false);
  // Toggle the hero between the full card image and the print-ready
  // spread. Shown as a small print-ready THUMBNAIL below the hero
  // ("Print-ready · tap to view") so the user SEES they're buying a real
  // printed 4-panel card, not just a digital image — tap swaps it up.
  // (Restored 2026-07-09 — Kevin: the print-ready view should be visible,
  // not hidden behind the corner chip that replaced it on 07-08.)
  // 'image' = the full card image · 'print' = this side's print spread ·
  // 'front' = the approved FRONT's print spread (inside reveal only, when a
  // frontReference is supplied). Tapping either thumbnail swaps its content
  // up into the hero.
  const [heroView, setHeroView] = useState<'image' | 'print' | 'front'>('image');
  const showingPrint = heroView === 'print';
  const showingFront = heroView === 'front';
  return (
    <div className="mx-auto max-w-2xl py-4">
      <div className="mb-4 text-center">
        <p className="text-lg font-display font-bold tracking-[-0.015em] text-keeper-ink">{title}</p>
        {subject && <p className="mt-0.5 text-sm text-keeper-meta">{subject}</p>}
      </div>

      {/* Fixed square footprint so toggling image ↔ print never moves
          the CTAs below. The landscape print spread centres vertically
          inside the square; the full image fills it. */}
      <div className="mx-auto flex aspect-square w-full max-w-[300px] items-center justify-center">
        {showingFront && frontReference ? (
          <div className="w-full">{frontReference}</div>
        ) : showingPrint ? (
          <div className="w-full">{printVisual}</div>
        ) : (
          <div className="aspect-square w-full overflow-hidden rounded-lg border border-keeper-hair bg-stone-100 shadow-[0_30px_60px_-22px_rgba(33,29,25,0.30)]">
            {heroUrl && <img src={heroUrl} alt="Your card" crossOrigin="anonymous" className="h-full w-full object-cover" />}
          </div>
        )}
      </div>

      {/* Print-ready preview underneath — the actual 4-panel print layout
          so the user can SEE the printed product they're buying. On the
          inside reveal a static print-ready thumbnail of the APPROVED
          FRONT sits alongside it (frontReference) for side-by-side
          comparison. Tapping the inside thumbnail swaps it up into the
          hero. */}
      <div className="mt-4 flex items-start justify-center gap-4">
        {frontReference && (
          <button
            type="button"
            onClick={() => setHeroView((v) => (v === 'front' ? 'image' : 'front'))}
            className="group flex w-[88px] flex-col items-center"
            aria-label={
              showingFront
                ? 'Show the inside'
                : 'Show the approved front print layout'
            }
            data-testid="btn-front-reference-toggle"
          >
            <div
              className={`flex aspect-square w-[88px] items-center justify-center rounded-md border p-1 shadow-sm transition-transform group-hover:scale-[1.06] ${
                showingFront
                  ? 'border-brand bg-brand-muted/40'
                  : 'border-keeper-hair bg-white/70'
              }`}
            >
              <div className="w-full">{frontReference}</div>
            </div>
            <span className="mt-1.5 inline-flex items-center gap-1 text-center text-[11px] font-medium text-keeper-meta transition-colors group-hover:text-keeper-ink">
              <Printer className="h-3 w-3" strokeWidth={1.75} />
              {showingFront
                ? 'Tap for the inside'
                : `${frontReferenceLabel ?? 'Front'} · tap to view`}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setHeroView((v) => (v === 'print' ? 'image' : 'print'))}
          className="group flex w-[88px] flex-col items-center"
          aria-label={showingPrint ? 'Show the full image' : 'Show the print-ready layout'}
          data-testid="btn-hero-print-toggle"
        >
          <div className="flex aspect-square w-[88px] items-center justify-center rounded-md border border-keeper-hair bg-white/70 p-1 shadow-sm transition-transform group-hover:scale-[1.06]">
            {showingPrint ? (
              <div className="aspect-square w-full overflow-hidden rounded-sm bg-stone-100">
                {heroUrl && <img src={heroUrl} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />}
              </div>
            ) : (
              <div className="w-full">{printVisual}</div>
            )}
          </div>
          <span className="mt-1.5 inline-flex items-center gap-1 text-center text-[11px] font-medium text-keeper-meta transition-colors group-hover:text-keeper-ink">
            <Printer className="h-3 w-3" strokeWidth={1.75} />
            {showingPrint
              ? 'Tap for the full image'
              : `${printLabel ?? 'Print-ready'} · tap to view`}
          </span>
        </button>
      </div>

      {/* Actions — side-by-side on desktop so BOTH choices sit above
          the fold; stacked on mobile with tightened rhythm. The inside
          reveal (stackActions) keeps them stacked at every width because
          it has three: assemble / change the inside / start over. */}
      <div
        className={`mt-8 flex flex-col items-center justify-center gap-3 ${
          stackActions ? '' : 'sm:flex-row sm:items-center'
        }`}
      >
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onApprove?.();
            } catch (err: any) {
              // Same silent-429 fix as InsideComposeStage.submit
              // (audit 2026-07-27).
              approveToast({
                title: "That didn't go through",
                description: err?.message ?? 'Try again in a moment.',
                variant: 'destructive',
              });
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex h-[52px] w-full max-w-[320px] items-center justify-center rounded-full bg-go px-6 text-[15px] font-semibold text-go-foreground transition-colors hover:bg-go-hover disabled:opacity-50 sm:w-80"
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
  isReroll = false,
  textOnly = false,
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
  /** Reroll: the inside is INHERITED, so this stage is a SIGN-OFF
   *  (read the inherited inside back, confirm or edit) rather than a
   *  fresh authoring task — the message was already written on the
   *  original take (Kevin 2026-07-09). */
  isReroll?: boolean;
  /** "Change the inside" from the inside reveal. The WORDS are the only
   *  thing on the table — the scene/style are fixed (a different design
   *  means starting again). Goes straight to the form (no read-back) and
   *  says so plainly. Switching to a blank inside is still allowed, since
   *  that's a text decision (handwrite it yourself), not a design one. */
  textOnly?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const ready = isInsideStepReady(state);
  const blank = state.inside?.mode === 'blank';
  const write = state.inside?.write ?? {};
  const recipientName = state.recipient?.name?.trim();
  // Sign-off = a reroll whose inside is already decided (blank, or a
  // written message) and the user hasn't tapped "edit". Reads the
  // inherited inside back for confirmation instead of re-presenting a
  // blank authoring form — that's what made it feel like redoing work.
  const hasDecision =
    blank || (state.inside?.mode === 'write' && !!write.message?.trim());
  const signOff = isReroll && hasDecision && !editing;

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit();
    } catch (err: any) {
      // Without this catch a 429 (daily cap / re-roll limit) was a
      // silent busy-blip — the screen just didn't change (audit
      // 2026-07-27). The server's messages are already friendly.
      toast({
        title: "Couldn't update the inside",
        description: err?.message ?? 'Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  // The approved front stays on screen, small — the inside is set (or
  // confirmed) in its company.
  const frontThumb = frontUrl && (
    <div className="mx-auto mb-6 flex items-center justify-center gap-3">
      <div className="aspect-square w-20 overflow-hidden rounded-md border border-keeper-hair shadow-sm">
        <img src={frontUrl} alt="Your card front" crossOrigin="anonymous" className="h-full w-full object-cover" />
      </div>
      <p className="max-w-[200px] text-left text-[11.5px] leading-snug text-keeper-meta">
        {subject ? `The front of ${subject} — locked in.` : 'Your front — locked in.'}
      </p>
    </div>
  );

  const backButton = (
    <button
      onClick={onBack}
      className="inline-flex items-center gap-1.5 rounded-full border border-keeper-hair px-4 py-2 text-[13px] text-keeper-body transition-colors hover:bg-stone-50"
      data-testid="btn-back-to-front"
    >
      {textOnly ? '← Back to the inside' : '← Back to the front'}
    </button>
  );

  // ── Sign-off (reroll): read the inherited inside back — confirm or edit ──
  if (signOff) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <div className="mb-6 text-center">
          <p className="text-lg font-display font-bold tracking-[-0.015em] text-keeper-ink">
            {blank ? 'Your inside' : 'Your inside message'}
          </p>
          <p className="mt-0.5 text-sm text-keeper-meta">
            Carried over from your last take — still right for this front?
          </p>
        </div>
        {frontThumb}
        <div
          className="mx-auto max-w-md rounded-xl border border-keeper-hair bg-stone-50 p-4"
          data-testid="inside-signoff-readback"
        >
          {blank ? (
            <p className="text-sm text-keeper-body">
              Blank centre with a decorative border — we'll post it to you to
              handwrite inside.
            </p>
          ) : (
            <div className="space-y-1 text-sm text-keeper-body">
              {write.salutation && <div>{write.salutation}</div>}
              {write.message && (
                <div className="whitespace-pre-wrap">{write.message}</div>
              )}
              {write.signoff && <div>{write.signoff}</div>}
            </div>
          )}
        </div>
        <div className="mt-7 flex flex-col items-center gap-3">
          <button
            disabled={busy}
            onClick={submit}
            className="w-full max-w-[320px] rounded-full bg-cta px-6 py-3.5 text-[15px] font-medium text-cta-foreground transition-colors hover:bg-cta-hover disabled:opacity-50"
            data-testid="btn-make-inside"
          >
            {busy
              ? 'One sec…'
              : blank
                ? 'Finish the card →'
                : 'Looks good — make the inside →'}
          </button>
          <button
            onClick={() => {
              // From blank, jump straight into the write form (not the
              // blank panel) so "add a message" is one tap, not two.
              if (blank) onChange({ inside: { ...state.inside, mode: 'write' } });
              setEditing(true);
            }}
            className="text-[13px] font-medium text-brand underline underline-offset-4 hover:text-brand-dark"
            data-testid="btn-edit-inside"
          >
            {blank ? 'Add a message instead' : 'Edit the message'}
          </button>
          {backButton}
        </div>
      </div>
    );
  }

  // ── Authoring: first-card fresh write, a reroll "edit", or the
  //    text-only "Change the inside" edit from the inside reveal ──
  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-6 text-center">
        <p className="text-lg font-display font-bold tracking-[-0.015em] text-keeper-ink">
          {textOnly ? 'Change the words' : isReroll ? 'Edit the inside' : 'Now, the inside'}
        </p>
        <p className="mt-0.5 text-sm text-keeper-meta">
          {recipientName
            ? `This is what ${recipientName} reads when they open it.`
            : 'This is what they read when they open it.'}
        </p>
      </div>

      {/* Say plainly what IS and ISN'T on the table here, so nobody re-rolls
          hoping for a new look and feels cheated when the same design comes
          back with different words (Kevin 2026-07-14). */}
      {textOnly && (
        <div
          className="mx-auto mb-6 max-w-md rounded-xl border border-keeper-hair bg-stone-50 p-4"
          data-testid="inside-text-only-notice"
        >
          <p className="text-[13px] leading-relaxed text-keeper-body">
            You're changing{' '}
            <span className="font-semibold text-keeper-ink">the words only</span>. The scene
            and style stay exactly as they are — if you want a different design, start the
            card again.
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-keeper-meta">
            Would you rather write it in your own hand? Pick{' '}
            <span className="font-medium text-keeper-ink">Leave it blank</span> below and
            we'll print a decorative border, ready for you to fill in.
          </p>
        </div>
      )}

      {/* Front thumb only once a mode is chosen (write/blank) — on the
          fork picker it's redundant reassurance (the front was approved
          seconds ago) and added to the mobile clutter (Kevin 2026-07-09).
          When writing, it earns its place: you see the front you match. */}
      {state.inside?.mode && frontThumb}

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
          onClick={submit}
          className="w-full max-w-[320px] rounded-full bg-cta px-6 py-3.5 text-[15px] font-medium text-cta-foreground transition-colors hover:bg-cta-hover disabled:opacity-50"
          data-testid="btn-make-inside"
        >
          {busy
            ? 'One sec…'
            : textOnly
              ? 'Update the inside →'
              : blank
                ? 'Finish the card →'
                : 'Make the inside →'}
        </button>
        {!ready && (
          <p className="text-[11.5px] text-keeper-meta">
            Write your message — or choose to leave it blank — to carry on.
          </p>
        )}
        {backButton}
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
    // toWebpDisplay is NOT optional here: the 3D viewer's useTexture loads
    // the .webp display siblings, and drei's cache is keyed by exact URL.
    // Preloading the .png (as this did between the Jul-17 webp swap and
    // 2026-07-27) warms NOTHING the texture uses → useTexture suspends at
    // the reveal → the suspension escapes the Canvas to the route-level
    // Suspense → whole page blanks ("white flash / blank until click").
    const urls = [frontUrl, insideUrl]
      .map((u) => toWebpDisplay(u))
      .filter((u): u is string => !!u && u.length > 0);
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
  // Inside composer — reachable from BOTH the front sign-off (write the
  // inside in front of the approved front) AND the inside reveal ("Change
  // the inside" — re-do the inside while KEEPING the approved front). The
  // approved front is never touched; submitting fires an inside-only gen
  // that appends a new version. Gated to the two reveal states so a stale
  // `insideComposing` can't hijack the generating / completed views, and
  // reset on submit so we drop back to the reveal once gen kicks off.
  if (insideComposing && (status === 'front-ready' || status === 'inside-ready')) {
    // Three entries, three intents:
    //   • front-ready, first card  → fresh authoring.
    //   • front-ready, reroll clone → SIGN-OFF (read the inherited inside
    //     back, confirm or edit) — the message was written on the last take.
    //   • inside-ready ("Change the inside") → TEXT-ONLY edit. Straight into
    //     the form: the whole point of the tap is to change the words, so a
    //     read-back is pointless indirection (it's what made a re-roll look
    //     like it did nothing — you'd confirm the SAME text). The design is
    //     deliberately NOT re-rollable here; a different look = start again.
    //     (Kevin 2026-07-14)
    const textOnly = status === 'inside-ready';
    const isReroll = !!state.rerollOfCardId;
    return (
      <InsideComposeStage
        cardId={cardId}
        state={state}
        subject={frontFirstSubject(state)}
        frontUrl={frontUrl}
        isReroll={isReroll}
        textOnly={textOnly}
        onChange={onChange}
        scheduleSave={scheduleSave}
        flushSave={flushSave}
        onBack={() => setInsideComposing(false)}
        onSubmit={async () => {
          await flushSave?.();
          await onStartInsideGeneration?.();
          setInsideComposing(false);
        }}
      />
    );
  }

  if (status === 'front-ready') {
    // Approving the front opens the inside composer (above). On a FIRST
    // card that's fresh authoring; on a REROLL it's a sign-off.
    const isReroll = !!state.rerollOfCardId;
    return (
      <FrontFirstReview
        title="Here's the front"
        subject={frontFirstSubject(state)}
        heroUrl={frontUrl}
        printVisual={<CardOuterSpread frontUrl={frontUrl} />}
        approveLabel={
          isReroll ? 'Looks good — confirm the inside →' : 'Looks good — now the inside →'
        }
        onApprove={async () => setInsideComposing(true)}
        secondary={<StartAgainButton cardId={cardId} pill />}
      />
    );
  }

  // Inside-ready: mirror the front step — big inside image + the print
  // spread, PLUS a print-ready reference of the APPROVED FRONT (compare
  // front vs inside side by side) and a version switcher across the insides
  // generated so far. Sign off → finalize → the 3D assemble. "Change the
  // inside" re-does ONLY the inside, keeping the approved front; "start
  // over completely" is the quieter full re-roll (Kevin 2026-07-11).
  if (status === 'inside-ready') {
    return (
      <FrontFirstReview
        title="Here's the inside"
        subject={frontFirstSubject(state)}
        heroUrl={insideUrl}
        printVisual={<CardInnerSpread insideUrl={insideUrl} />}
        printLabel="Inside"
        frontReference={<CardOuterSpread frontUrl={frontUrl} />}
        frontReferenceLabel="Front · approved"
        approveLabel="Looks good — assemble the card →"
        onApprove={onFinalize}
        stackActions
        secondary={
          <>
            <button
              type="button"
              onClick={() => setInsideComposing(true)}
              className="inline-flex h-[52px] w-full max-w-[320px] items-center justify-center rounded-full border border-brand/40 bg-white px-6 text-[15px] font-semibold text-brand-dark transition-colors hover:border-brand hover:bg-brand-muted/40 sm:w-80"
              data-testid="btn-change-inside"
            >
              Change the inside
            </button>
            <StartAgainButton
              cardId={cardId}
              quiet
              label="Start over completely (new front too)"
            />
          </>
        }
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
        onEditInsideMessage={onEditInside}
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
                    className="bg-cta hover:bg-cta-hover text-cta-foreground font-semibold h-[52px] rounded-full w-full sm:w-64"
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
      <p className="text-[11px] font-semibold text-keeper-meta uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="aspect-square rounded-2xl overflow-hidden border border-keeper-hair bg-stone-50">
        {/* CardArtImg, not a bare <img>: this loads the SAME urls as the
            hero above, which sets crossOrigin. A plain load caches a
            non-CORS entry for that url, and the CORS request then can't
            reuse it — so flicking between the main image and print-ready
            broke the card (Aidan 2026-08-06, Toia's birthday card).
            See project_3d_card_cors_cache_poisoning. */}
        <CardArtImg
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

/** Advisory nudge when EVERY selected photo assessed weak for likeness
 *  (see lib/photo-likeness for the policy). Renders nothing for strong
 *  sets, unassessed legacy photos, or while analysis is still landing —
 *  silence is the default, and it NEVER gates generation. */
function PhotoQualityNote({
  state,
  onJumpToStep,
  stepIndexById,
}: {
  state: CardDraftState;
  onJumpToStep: (index: number) => void;
  stepIndexById: Record<StepId, number>;
}) {
  const { data: photos } = useQuery<Photo[]>({ queryKey: ['/api/user/photos'] });
  const ids = state.photos?.photoIds ?? [];
  if (!photos || ids.length === 0) return null;
  const selected = ids
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is Photo => !!p);
  const note = likenessNoteForSet(selected, state.photos?.mode ?? 'one_person');
  // Review renders warnings and blocks only. The green confirmation
  // lives on the photo step, where it answers the just-uploaded
  // question — repeating it here would be noise on a summary screen.
  if (!note || note.tone === 'good') return null;
  return (
    <div
      className={`rounded-xl border p-4 ${
        note.tone === 'block' ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'
      }`}
      data-testid="photo-quality-note"
    >
      <p className="text-sm font-semibold text-keeper-ink">{note.headline}</p>
      <p className="mt-1 text-[13px] leading-snug text-keeper-body">{note.detail}</p>
      <button
        type="button"
        onClick={() => onJumpToStep(stepIndexById.photo)}
        className="mt-2 text-[13px] font-medium text-brand underline underline-offset-2"
        data-testid="btn-photo-note-change"
      >
        Change or add photos
      </button>
    </div>
  );
}
