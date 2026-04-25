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
import { GenerationWaitStage } from '@/components/studio/generation-wait';

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
}: {
  cardId: number;
  frontUrl: string | null;
  insideUrl: string | null;
  status: string | null;
  /** Full draft — NarrationStage personalises every beat from it. */
  state: CardDraftState;
  insideMode: 'write' | 'blank' | null;
  onEditInside: () => void;
}) {
  // Ready = server says done and both image URLs have landed on the
  // client. `frontUrl` alone isn't enough (server persists it mid-gen;
  // client deliberately waits for the complete picture).
  const isReady = status === 'completed' && !!frontUrl && !!insideUrl;

  // Ceremony timing: once `isReady` flips, hold the READY_LINE on screen
  // for ~1600ms, then crossfade into the 3D viewer over ~1200ms. Neither
  // number is a loading bar — they're pacing dials. Tune with Kevin.
  const READY_HOLD_MS = 1600;
  const [showReveal, setShowReveal] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    const t = window.setTimeout(() => setShowReveal(true), READY_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [isReady]);

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
        data-testid={showReveal ? 'review-completed' : 'review-generating'}
      >
        {/* Stage — constant dimensions across both phases so
            narration → card reveal reads as one continuous surface. */}
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
                  onWheel={bumpInteract}
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
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Post-reveal CTA stack — confirmation line, Buy, gesture
            hints. Only fires once showReveal flips so the entry is
            clean and doesn't race the card's materialise animation. */}
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
                    onClick={() => setBuyOpen(true)}
                    className="bg-brand hover:bg-brand-dark text-brand-foreground font-semibold px-10 py-3.5 rounded-lg w-full sm:w-auto"
                    size="lg"
                    data-testid="btn-buy-card"
                  >
                    Buy this card
                  </Button>
                  {/* Caption beneath ("Choose digital or print next") was
                      removed 2026-04-25 — the 3D card has just appeared,
                      meta-instructing the user about UI yet to come dilutes
                      the moment. Buy button speaks for itself. */}
                </motion.div>

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
