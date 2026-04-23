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
        recipientName={state.recipient?.name?.trim() ?? null}
        state={state}
        insideMode={state.inside?.mode ?? null}
        onEditInside={() => {
          onChange({
            inside: { ...state.inside, mode: 'write' },
          });
          onJumpToStep(stepIndexById.inside);
        }}
      />
    );
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

// ── Build narration — Stage 1 of RevealView ───────────────────────────
// A short, confident step-by-step script of what we're building, drawn
// from the user's actual draft. No handwriting, no silhouettes, no AI
// voice — one clean line at a time, large type, cycling every ~4s so
// the user reads what we're doing for them, step by step.
//
// The script is built from `state` so every line reflects a real
// choice the user made. Generic fallbacks kick in only if a field is
// missing (legacy drafts).

/** Turn the draft state into a narration script: five beats shown
 *  pre-front (one per Studio step), plus a single line that runs
 *  while the inside is being drafted. */
function buildNarration(state: CardDraftState): {
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

/**
 * Cycling single-line narration. Auto-advances every ~4.2s, stops at
 * the last beat (where it holds until the caller unmounts the component
 * — typically when the front URL lands). Framer handles the line-change
 * transitions (fade + 12px rise).
 */
function BuildNarration({ beats }: { beats: string[] }) {
  const [index, setIndex] = useState(0);
  const lastIndex = beats.length - 1;

  useEffect(() => {
    if (index >= lastIndex) return;
    const t = window.setTimeout(() => setIndex((i) => i + 1), 4200);
    return () => window.clearTimeout(t);
  }, [index, lastIndex]);

  return (
    <div className="w-full h-full flex items-center justify-center px-6">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="text-3xl sm:text-4xl md:text-5xl font-semibold text-ink text-center leading-tight max-w-[720px]"
          data-testid="build-narration-line"
        >
          {beats[index]}
        </motion.p>
      </AnimatePresence>
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

/**
 * RevealView — one continuous canvas from the moment Generate is pressed
 * through the final interactive 3D card. Three internal stages, but the
 * outer frame never changes:
 *
 *   Stage 1 — no frontUrl yet (~0–25s):
 *     Soft card-shaped silhouette + single framing line below.
 *
 *   Stage 2 — frontUrl arrived, status still 'generating' (~25–45s):
 *     Card3DViewer mounts with the real front, inside locked to the front
 *     for now (viewer fallback); card stays closed, non-interactive.
 *     Subtitle softens to "front's in, writing the inside now".
 *
 *   Stage 3 — status 'completed':
 *     Same viewer, now with the real inside, open controls wired.
 *     Staggered entry choreography for the confirmation line → Buy CTA
 *     → gesture hints. One emotional beat, three breaths.
 *
 * Why continuous canvas (vs separate GeneratingView / CompletedView):
 * swapping views mid-render reads as "loading → loaded" (utility tool
 * voice). Keeping the viewer mounted from Stage 2 onwards means the card
 * just *arrives* — same frame, same lighting, lights come up. The tone
 * bible calls this out as the moment that most betrays the "gift"
 * illusion; continuous canvas is the fix.
 */
function RevealView({
  cardId,
  frontUrl,
  insideUrl,
  status,
  recipientName,
  state,
  insideMode,
  onEditInside,
}: {
  cardId: number;
  frontUrl: string | null;
  insideUrl: string | null;
  status: string | null;
  recipientName: string | null;
  /** Full draft so Stage 1 narration can reflect the user's own
   *  choices — name, occasion, photo mode, scene, style, card text,
   *  inside mode. */
  state: CardDraftState;
  insideMode: 'write' | 'blank' | null;
  onEditInside: () => void;
}) {
  const narration = buildNarration(state);
  const hasFront = !!frontUrl;
  const isComplete = status === 'completed' && hasFront;

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
      <div
        className="max-w-3xl mx-auto"
        data-testid={isComplete ? 'review-completed' : 'review-generating'}
      >
        {/* Stage — dimensions constant across all three stages so the
            silhouette → front → full reveal is a texture swap, not a
            layout jump. */}
        <div className="h-[50vh] sm:h-[56vh] w-full relative">
          <div
            className="absolute top-[-22vh] bottom-[-22vh] left-[-20vw] right-[-20vw] z-[25]"
            style={{ filter: 'drop-shadow(0 24px 32px rgba(0,0,0,0.1))' }}
            onPointerDown={isComplete ? startInteract : undefined}
            onPointerUp={isComplete ? endInteract : undefined}
            onPointerCancel={isComplete ? endInteract : undefined}
            onPointerLeave={isComplete ? endInteract : undefined}
            onWheel={isComplete ? bumpInteract : undefined}
          >
            {/* Stage 1 (paper) → Stage 2 (card) crossfade. Synchronous
                fade (mode="sync") so the paper and card overlap in the
                same plane for ~300ms — reads as "the paper became a
                card", not "paper gone, card appeared." */}
            <AnimatePresence>
              {hasFront ? (
                <motion.div
                  key="viewer"
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                >
                  <Card3DViewer
                    frontImageUrl={frontUrl}
                    // Stage 2: insideUrl hasn't arrived; Card3DViewer
                    // falls back to the front texture for the inside
                    // face. Card stays closed so the user never sees
                    // that fallback.
                    insideImageUrl={isComplete ? insideUrl : null}
                    open={isComplete ? open : false}
                    onOpenChange={isComplete ? setOpen : () => {}}
                    className="w-full h-full"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="narration"
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                >
                  <BuildNarration beats={narration.preFront} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Copy + actions stack below the stage. AnimatePresence swaps
            the subtitle block as we progress through stages; the CTA
            group (Stage 3 only) has its own staggered choreography so
            the confirmation lands → Buy appears → hints fade in last. */}
        <div className="relative z-30 max-w-xl mx-auto px-4 pt-2 text-center">
          <AnimatePresence mode="wait">
            {/* Stage 1 has no subtitle — the narration IS the message. */}
            {hasFront && !isComplete && (
              <motion.p
                key="stage-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="text-sm text-stone-600 mt-2"
              >
                {narration.duringInside}
              </motion.p>
            )}
            {isComplete && (
              <motion.div
                key="stage-3"
                className="flex flex-col items-center"
              >
                {/* Confirmation line — first beat (~400ms in) */}
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="text-base font-medium text-ink mt-2"
                >
                  {recipientName
                    ? `${recipientName}'s card is ready.`
                    : 'Your card is ready.'}
                </motion.p>

                {/* Buy CTA + subtext — second beat (~900ms in) */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 }}
                  className="mt-8 flex flex-col items-center gap-7"
                >
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
                </motion.div>

                {/* Gesture hints — last beat (~1.4s in). Fade on active
                    interaction and collapse permanently after the first
                    touch. */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isInteracting ? 0 : 1 }}
                  transition={{
                    duration: 0.5,
                    delay: hasInteracted || isInteracting ? 0 : 1.4,
                  }}
                  style={{ pointerEvents: isInteracting ? 'none' : 'auto' }}
                  className="mt-6"
                >
                  <div
                    className="flex justify-center items-start overflow-hidden transition-[max-height] duration-500 ease-out"
                    style={{ maxHeight: hasInteracted ? 0 : 72 }}
                  >
                    <GestureHints open={open || hasInteracted} />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
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
