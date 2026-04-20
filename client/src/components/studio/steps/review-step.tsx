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

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Loader2,
  Pencil,
  User,
  Image as ImageIcon,
  Palette,
  MessageSquare,
  FileText,
  Type,
  AlertTriangle,
  PartyPopper,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import type { CardDraftState, StepId } from '@shared/schema';
import { deriveDefaultFrontText } from '@shared/schema';
import { Card3DViewer } from '@/components/card-3d-viewer';

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
  /** Called when the user hits Generate. Parent handles the POST and
   *  subsequent status polling. */
  onGenerate: () => void;
  isGenerating: boolean;
  generatedFrontUrl: string | null;
  generatedInsideUrl: string | null;
}

export function ReviewStep({
  cardId,
  state,
  status,
  stepIndexById,
  onJumpToStep,
  onGenerate,
  isGenerating,
  generatedFrontUrl,
  generatedInsideUrl,
}: ReviewStepProps) {
  if (status === 'completed' && generatedFrontUrl) {
    return (
      <CompletedView
        cardId={cardId}
        frontUrl={generatedFrontUrl}
        insideUrl={generatedInsideUrl}
      />
    );
  }

  if (status === 'generating' || isGenerating) {
    return <GeneratingView />;
  }

  if (status === 'failed') {
    return <FailedView cardId={cardId} />;
  }

  // Default: review + generate.
  const recipientName = state.recipient?.name?.trim();
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <p className="text-sm text-stone-600">
        Here's what you've chosen. Tap any section to change it.
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
        <p className="text-[11px] text-stone-400 text-center mt-2">
          Usually about {TYPICAL_GENERATION_SECONDS} seconds.
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
  const styleMode = state.style?.mode;
  const styleCustom = state.style?.custom ?? '';
  const insideMode = state.inside?.mode;
  const insideWrite = state.inside?.write ?? {};
  const photoCount = state.photos?.photoIds?.length ?? 0;
  // Resolved front text for display — mirrors server's buildCardText()
  // precedence so what we show matches what'll render.
  const frontText = state.front?.text?.trim() || deriveDefaultFrontText(state);
  const frontTextIsDefault = !state.front?.text?.trim();

  const styleLabel =
    styleMode === 'animated'
      ? 'Animated'
      : styleMode === 'realistic'
        ? 'Realistic'
        : styleMode === 'custom'
          ? 'Custom'
          : '—';

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

      <SummaryRow
        icon={Palette}
        label="Style"
        onEdit={() => onJumpToStep(stepIndexById.style)}
        testId="summary-style"
      >
        <div className="text-sm text-ink font-medium">{styleLabel}</div>
        {styleMode === 'custom' && styleCustom && (
          <div className="text-xs text-stone-500 mt-0.5 line-clamp-2">
            {styleCustom}
          </div>
        )}
      </SummaryRow>

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
          <div className="text-sm text-stone-700">
            Blank centre with decorative border
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

// ── In-progress view ──────────────────────────────────────────────────
function GeneratingView() {
  return (
    <div
      className="max-w-md mx-auto text-center py-12"
      data-testid="review-generating"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-muted text-brand mb-6">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
      <h2 className="text-lg font-semibold text-ink mb-2">
        Crafting your card…
      </h2>
      <p className="text-sm text-stone-600">
        Our AI is painting the scene and composing the inside. This usually
        takes about {TYPICAL_GENERATION_SECONDS} seconds.
      </p>
      <p className="text-xs text-stone-400 mt-4">
        You can close this tab — we'll keep working. Come back any time to
        see the result.
      </p>
    </div>
  );
}

// ── Completed view — show the rendered images ─────────────────────────
function CompletedView({
  cardId,
  frontUrl,
  insideUrl,
}: {
  cardId: number;
  frontUrl: string;
  insideUrl: string | null;
}) {
  return (
    <div className="max-w-3xl mx-auto" data-testid="review-completed">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cta-light text-cta mb-3">
          <PartyPopper className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-ink mb-1">
          Your card is ready ✨
        </h2>
        <p className="text-sm text-stone-600">
          Tap the card to open it.
        </p>
      </div>

      {/* Inline 3D preview — primary presentation. Pure white container;
          the card's cover-back is slightly off-white so its edges still
          read against the white. */}
      <div className="rounded-2xl overflow-hidden mb-6 aspect-[4/3] bg-white">
        <Card3DViewer
          frontImageUrl={frontUrl}
          insideImageUrl={insideUrl}
          className="w-full h-full"
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
        <a
          href={`/checkout/${cardId}`}
          className="inline-flex items-center justify-center gap-2 bg-cta hover:bg-cta/90 text-cta-foreground text-base font-semibold px-7 py-3.5 rounded-lg transition-colors w-full sm:w-auto"
          data-testid="btn-send-card"
        >
          Send this card
        </a>
        <a
          href={`/card/${cardId}/view`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 text-sm text-brand hover:text-brand-dark font-medium px-4 py-2"
          data-testid="btn-view-3d"
        >
          <Sparkles className="w-4 h-4" />
          Preview in 3D
        </a>
      </div>
    </div>
  );
}

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

// ── Failure view — offer a retry ──────────────────────────────────────
function FailedView({ cardId }: { cardId: number }) {
  const queryClient = useQueryClient();

  // Retry: flip the draft's status back to 'draft' so the button can
  // start a fresh generation. Done via PATCH since there's no dedicated
  // retry endpoint — the draft state is still intact.
  const retryMutation = useMutation({
    mutationFn: async () => {
      // Just re-fetch — simplest way to re-read the current state, which
      // the parent's useCardMaker already re-loads when we invalidate.
      // Status flip happens server-side when Generate is hit again.
      await apiRequest('POST', `/api/studio/drafts/${cardId}/retry`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/studio/drafts/${cardId}`] });
    },
    onError: (err: Error) => {
      toast({
        title: 'Retry failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="max-w-md mx-auto text-center py-12" data-testid="review-failed">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700 mb-4">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-stone-600 mb-6">
        The AI couldn't make your card that time. Give it another go.
      </p>
      <Button
        onClick={() => retryMutation.mutate()}
        disabled={retryMutation.isPending}
        className="bg-brand hover:bg-brand-dark text-brand-foreground"
        data-testid="btn-retry-generation"
      >
        {retryMutation.isPending ? 'Resetting…' : 'Try again'}
      </Button>
    </div>
  );
}

/** Review is always "ready" in the step-readiness sense — you can only
 *  land on it if all prior steps passed. The Generate button has its
 *  own in-component gate on the POST. */
export function isReviewStepReady(_state: CardDraftState): boolean {
  return true;
}
