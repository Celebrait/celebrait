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
import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
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
  Package,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { CardDraftState, StepId } from '@shared/schema';
import { deriveDefaultFrontText } from '@shared/schema';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { GestureHints } from '@/components/gesture-hints';

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
}

export function ReviewStep({
  cardId,
  state,
  status,
  stepIndexById,
  onJumpToStep,
  onChange,
  onGenerate,
  onRetry,
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
        recipientName={state.recipient?.name?.trim() ?? null}
        insideMode={state.inside?.mode ?? null}
        onEditInside={() => {
          // The user clicked the Buy dialog's "Add a message inside →"
          // recovery link, so they want write mode. Flip the mode AS we
          // navigate — they arrive in the write panel with the textarea
          // ready, not re-selecting the blank they're trying to undo.
          onChange({
            inside: { ...state.inside, mode: 'write' },
          });
          onJumpToStep(stepIndexById.inside);
        }}
      />
    );
  }

  if (status === 'generating' || isGenerating) {
    return <GeneratingView />;
  }

  if (status === 'failed') {
    return <FailedView onRetry={onRetry} />;
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
        We're drafting the front and inside. Usually about{' '}
        {TYPICAL_GENERATION_SECONDS} seconds — hang tight.
      </p>
      <p className="text-xs text-stone-400 mt-4">
        Closing this tab is fine — we'll keep drafting. Your card saves to
        My Cards.
      </p>
    </div>
  );
}

// ── Completed view — full 3D viewer experience + single-CTA purchase ──
// Matches the public viewer pattern: canvas bleeds past the stage in
// all directions so the card can rotate/zoom freely (no cropping even
// at max zoom), gesture hints that retire after first interaction,
// the UI below fades out while the user is actively manipulating the
// card. Single violet "Buy this card" CTA opens a modal for the
// digital/print/both decision.

type ProductChoice = 'digital' | 'print' | 'both';

const PRINT_PRICE = 599;
const DIGITAL_PRICE = 99;
const UK_SHIPPING = 150;
const BUNDLE_DISCOUNT = 50;

function totalsFor(choice: ProductChoice): number {
  const print = choice === 'digital' ? 0 : PRINT_PRICE;
  const digital = choice === 'print' ? 0 : DIGITAL_PRICE;
  const shipping = choice === 'digital' ? 0 : UK_SHIPPING;
  const discount = choice === 'both' ? BUNDLE_DISCOUNT : 0;
  return print + digital + shipping - discount;
}

function formatGBP(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function CompletedView({
  cardId,
  frontUrl,
  insideUrl,
  insideMode,
  onEditInside,
}: {
  cardId: number;
  frontUrl: string;
  insideUrl: string | null;
  recipientName: string | null;
  /** Blank inside = digital version has no message — the Buy dialog
   *  hides digital options and surfaces an "add a message" recovery
   *  link when this is 'blank'. */
  insideMode: 'write' | 'blank' | null;
  /** Jumps the stepper back to the Inside step (used by the Buy
   *  dialog's recovery link when the user wants to switch from
   *  blank to write). */
  onEditInside: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
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
  const bumpInteract = () => {
    startInteract();
    endInteract();
  };

  return (
    <>
      <div className="max-w-3xl mx-auto" data-testid="review-completed">
        {/* Stage — mirrors public viewer. Canvas absolutely positioned
            inside with generous bleed so the card can rotate/zoom
            past the step panel edges without clipping. Step panel's
            overflow is visible by default so the bleed shows. */}
        <div className="h-[50vh] sm:h-[56vh] w-full relative">
          <div
            className="absolute top-[-22vh] bottom-[-22vh] left-[-20vw] right-[-20vw] z-[25]"
            style={{ filter: 'drop-shadow(0 24px 32px rgba(0,0,0,0.1))' }}
            onPointerDown={startInteract}
            onPointerUp={endInteract}
            onPointerCancel={endInteract}
            onPointerLeave={endInteract}
            onWheel={bumpInteract}
          >
            <Card3DViewer
              frontImageUrl={frontUrl}
              insideImageUrl={insideUrl}
              open={open}
              onOpenChange={setOpen}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* UI container sits above canvas at z-30. Hints fade on
            interact; the CTA group below stays fully visible at all
            times — Buy this card is the step's primary job, it
            shouldn't disappear just because the user is rotating. */}
        <div className="relative z-30 max-w-xl mx-auto px-4 pt-2">
          {/* Gesture hints — fade on active interaction AND collapse
              permanently after the first touch. */}
          <div
            className="transition-opacity duration-500"
            style={{
              opacity: isInteracting ? 0 : 1,
              pointerEvents: isInteracting ? 'none' : 'auto',
            }}
          >
            <div
              className="flex justify-center items-start overflow-hidden transition-[max-height] duration-500 ease-out"
              style={{ maxHeight: hasInteracted ? 0 : 72 }}
            >
              <GestureHints open={open || hasInteracted} />
            </div>
          </div>

          {/* Always-visible primary CTA + stylised subtext. Sits
              below the hint row with generous gap. */}
          <div className="mt-8 flex flex-col items-center gap-7">
            <Button
              onClick={() => setBuyOpen(true)}
              className="bg-brand hover:bg-brand-dark text-brand-foreground font-semibold px-10 py-3.5 rounded-lg w-full sm:w-auto"
              size="lg"
              data-testid="btn-buy-card"
            >
              Buy this card
            </Button>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              <span className="text-base" aria-hidden>🎁</span>
              <span>
                Choose <span className="text-brand font-semibold">digital</span>{' '}
                or <span className="text-brand font-semibold">print</span> next
              </span>
            </p>
          </div>
        </div>
      </div>

      <BuyDialog
        open={buyOpen}
        onOpenChange={setBuyOpen}
        cardId={cardId}
        insideMode={insideMode}
        onEditInside={onEditInside}
      />
    </>
  );
}

// ── BuyDialog ─────────────────────────────────────────────────────────
// The "digital / print / both" choice moment. Three clickable option
// cards; each handoff navigates to /checkout/:id?product={choice}.
// Digital's value prop is made explicit — they get a share link with
// the exact 3D viewer the sender just played with.
function BuyDialog({
  open,
  onOpenChange,
  cardId,
  insideMode,
  onEditInside,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cardId: number;
  /** When 'blank', hide the digital option — the recipient can't read
   *  an empty inside — and offer a recovery link to the Inside step. */
  insideMode: 'write' | 'blank' | null;
  onEditInside: () => void;
}) {
  const [, setLocation] = useLocation();
  const go = (choice: ProductChoice) => {
    onOpenChange(false);
    setLocation(`/checkout/${cardId}?product=${choice}`);
  };
  const handleEditInside = () => {
    onOpenChange(false);
    onEditInside();
  };
  const isBlank = insideMode === 'blank';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left">How would you like to send it?</DialogTitle>
          <DialogDescription className="text-left">
            {isBlank
              ? "You chose a blank inside, so this one's for the post."
              : 'Pick one — you can change your mind at checkout.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-3">
          {!isBlank && (
            <BuyOption
              icon={<Sparkles className="w-5 h-5 text-brand" />}
              title="Digital"
              description="A share link that opens with the same 3D viewer you're playing with now. Instant."
              price={formatGBP(totalsFor('digital'))}
              onClick={() => go('digital')}
              testId="btn-buy-digital"
            />
          )}
          <BuyOption
            icon={<Package className="w-5 h-5 text-stone-700" />}
            title="Printed"
            description="Premium square card, posted in the UK."
            price={formatGBP(totalsFor('print'))}
            onClick={() => go('print')}
            testId="btn-buy-print"
          />
          {!isBlank && (
            <BuyOption
              icon={
                <div className="flex gap-1">
                  <Package className="w-5 h-5 text-stone-700" />
                  <Sparkles className="w-5 h-5 text-brand" />
                </div>
              }
              title="Printed + digital"
              description="The real thing in the post plus the instant 3D share link. Most popular."
              price={formatGBP(totalsFor('both'))}
              badge="Best value"
              onClick={() => go('both')}
              testId="btn-buy-both"
            />
          )}
        </div>

        {isBlank && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={handleEditInside}
              className="text-xs text-brand hover:text-brand-dark underline underline-offset-2"
              data-testid="btn-buy-edit-inside"
            >
              Want to send digitally? Add a message inside →
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BuyOption({
  icon,
  title,
  description,
  price,
  badge,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  price: string;
  badge?: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="relative w-full text-left bg-white border border-stone-200 rounded-xl p-4 hover:border-brand/60 hover:shadow-sm transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-muted flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="text-sm font-semibold text-ink whitespace-nowrap">{price}</p>
          </div>
          <p className="text-xs text-stone-600 mt-1 leading-relaxed">{description}</p>
          {badge && (
            <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-medium text-brand">
              {badge}
            </span>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-brand mt-2 flex-shrink-0" />
      </div>
    </button>
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
function FailedView({ onRetry }: { onRetry: () => Promise<void> }) {
  // Retry is a two-step operation orchestrated by the parent: first
  // POST /retry to flip the draft's server-side status from 'failed'
  // back to 'draft', then call startGeneration to kick off a fresh
  // run. The parent owns both because it also owns the cardId +
  // useCardMaker's status state. Mutation here just wraps it for the
  // button's pending state.
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

  return (
    <div className="max-w-md mx-auto text-center py-12" data-testid="review-failed">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700 mb-4">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink mb-2">
        That one didn't land
      </h2>
      <p className="text-sm text-stone-600 mb-6">
        The draft fell over mid-paint. Nothing's lost — your choices are all
        still here. Give it another go.
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
