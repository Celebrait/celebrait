// client/src/components/studio/regen-controls.tsx
//
// REGEN EDIT MODE — full-screen "workbench" surface for iterating
// on a generated card. Replaces the inline-expand-panel approach
// (audit 2026-04-26): trying to make one screen serve both "look at
// the card → buy" and "iterate on the card" was the root cause of
// every regen-feels-clunky symptom Kevin flagged.
//
// Mode is owned by the parent (review-step's RevealView and
// studio-card-view), which switches between the reveal layout
// (3D card + Buy CTA) and rendering this component. Entry is the
// "Not 100% happy? Make a change." pill on the reveal screen;
// exit is the Done button at the top of edit mode.
//
//   ┌───────────────────────────────────────────────────────┐
//   │  ← Mum's birthday card                          Done │  header
//   ├───────────────────────────────────────────────────────┤
//   │           [ Front | Inside | Both ]                   │  side picker
//   │                                                       │
//   │           ┌───────────────┐                           │
//   │           │     thumb     │  CardThumb (2D, ~280px)   │
//   │           └───────────────┘                           │
//   │           v1 ─ v2 ─ ●v3   versions rail (scoped)      │
//   │                                                       │
//   │  ┌──────────────────────────────────────┐            │
//   │  │ What would you like to change?       │  textarea  │
//   │  │ e.g. swap the dog for a cat          │  persists  │
//   │  └──────────────────────────────────────┘            │
//   │                          [ Try with this change ]    │  submit
//   └───────────────────────────────────────────────────────┘
//
// Loop semantics (the killer fix vs v1):
//   • Textarea value PERSISTS across submits — most users tweak the
//     tweak ("warmer light" → "warmer light, less orange"). Clearing
//     was a v1 mistake.
//   • Focus stays in the textarea after a submit lands — type-and-
//     iterate without re-clicking.
//   • No "panel open/closed" state, no expand/collapse, no
//     just-completed confirmation strip. The thumb itself changing
//     IS the completion signal.
//
// Submit flow:
//   1. User types tweak (or leaves blank for clean re-roll)
//   2. Hits "Try with this change" or Cmd/Ctrl+Enter
//   3. Thumb swaps to NarrationStage; submit button shows spinner
//   4. New attempt lands; thumb crossfades to new image; versions
//      rail gets a new dot. Selected attempt = the new one (server
//      promoted it). Textarea + focus preserved.
//   5. User can immediately type the next tweak.

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CardThumb, type ThumbTarget } from '@/components/studio/card-thumb';
import type { CardAttemptDTO } from '@/hooks/use-card-maker';
import type { CardSide, CardDraftState } from '@shared/schema';

interface RegenEditModeProps {
  /** Recipient + occasion drive the header title and the narration
   *  beats inside the thumb. Parent threads the whole draft state. */
  state: CardDraftState;
  frontUrl: string | null;
  insideUrl: string | null;
  /** All attempts (front + inside, completed + in-flight). The
   *  versions rail is scoped to whichever target is active. */
  attempts: CardAttemptDTO[];
  /** Which side is regenerating right now, or null. */
  isRegenerating: CardSide | null;
  /** True when the card has an inside (write or blank) — toggles
   *  whether the Inside / Both segments appear. */
  hasInside: boolean;
  onRegenerate: (side: CardSide, tweak?: string) => Promise<void>;
  onSelectAttempt: (attemptId: number) => Promise<void>;
  /** Exit edit mode and return to the reveal layout. */
  onExit: () => void;
}

/** Soft cap — show the "sometimes the first one was the one" nudge
 *  once a side has this many attempts. Not blocking; just a gentle
 *  reminder before the user burns more. */
const SOFT_CAP_PER_SIDE = 3;

export function RegenEditMode({
  state,
  frontUrl,
  insideUrl,
  attempts,
  isRegenerating,
  hasInside,
  onRegenerate,
  onSelectAttempt,
  onExit,
}: RegenEditModeProps) {
  const [target, setTarget] = useState<ThumbTarget>('front');
  // Single shared textarea even for "Both" — the audit's call
  // (2026-04-26): with provider.refine() doing image-edit per side,
  // a tweak like "warmer tone" applies cleanly to both, and "swap
  // the dog" naturally only matches the front. v1's per-side
  // textareas were a hedge against LLM confusion that refine
  // largely eliminates. Revisit if Cost Ledger data shows otherwise.
  const [tweak, setTweak] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Force target back to 'front' if hasInside flips off mid-flow
  // (defensive — shouldn't happen in practice).
  useEffect(() => {
    if (!hasInside && target !== 'front') setTarget('front');
  }, [hasInside, target]);

  // Refocus the textarea after a regen lands, so the iterate loop
  // stays warm (type → submit → see → type next without clicking).
  const wasRegeneratingRef = useRef<CardSide | null>(null);
  useEffect(() => {
    if (wasRegeneratingRef.current && !isRegenerating) {
      // Just transitioned regenerating → done. Restore focus.
      textareaRef.current?.focus();
    }
    wasRegeneratingRef.current = isRegenerating;
  }, [isRegenerating]);

  const front = attempts
    .filter((a) => a.side === 'front')
    .sort((a, b) => a.attemptNumber - b.attemptNumber);
  const inside = attempts
    .filter((a) => a.side === 'inside')
    .sort((a, b) => a.attemptNumber - b.attemptNumber);

  const completedFront = front.filter((a) => a.status === 'completed');
  const completedInside = inside.filter((a) => a.status === 'completed');
  const totalAttempts = completedFront.length + completedInside.length;

  // Soft cap: fire once any side has 3+ completed attempts.
  const showSoftCap =
    completedFront.length >= SOFT_CAP_PER_SIDE ||
    completedInside.length >= SOFT_CAP_PER_SIDE;

  // Versions rail content depends on target. For 'both' we show no
  // rail — mixing front + inside thumbnails in one strip would be
  // confusing, and the typical "Both" user is doing wholesale tweaks
  // not flipping back to a specific past version of one side.
  const railAttempts =
    target === 'front'
      ? completedFront
      : target === 'inside'
        ? completedInside
        : [];

  const handleSubmit = async () => {
    const value = tweak.trim() || undefined;
    // Deliberately DO NOT clear `tweak` — persisting across submits
    // is the whole point of the iterate loop redesign. User can
    // edit-and-resubmit ("warmer" → "warmer, softer light") without
    // retyping. They can clear it manually if they want a fresh
    // tweak.
    try {
      if (target === 'both') {
        // Sequenced: front first, then inside. Both refine calls
        // get the same tweak; refine's image-edit semantics + each
        // side's own base image mean atmospheric tweaks land on
        // both, sided tweaks naturally only match where they
        // apply. Server runs sequentially anyway.
        await onRegenerate('front', value);
        await onRegenerate('inside', value);
      } else {
        await onRegenerate(target as CardSide, value);
      }
    } catch (err: any) {
      toast({
        title: "That one didn't land",
        description: `Your card's still here. ${err?.message ?? 'Have another go in a moment.'}`,
        variant: 'destructive',
      });
    }
  };

  const handleSelect = async (attemptId: number) => {
    try {
      await onSelectAttempt(attemptId);
    } catch (err: any) {
      toast({
        title: "Couldn't switch version",
        description: err?.message ?? 'Try again in a moment.',
        variant: 'destructive',
      });
    }
  };

  // Header title — derives from the draft. Falls back gracefully
  // if a field is missing.
  const recipient = state.recipient?.name?.trim();
  const occasion = state.recipient?.occasion?.trim();
  const title = recipient
    ? occasion
      ? `${recipient}'s ${occasion} card`
      : `${recipient}'s card`
    : 'Make a change';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="max-w-2xl mx-auto px-4 sm:px-6 pb-32 sm:pb-12"
      data-testid="regen-edit-mode"
    >
      {/* Header — compact, with Done as the exit affordance. */}
      <div className="flex items-center justify-between gap-3 py-4 mb-2">
        <p className="text-sm text-stone-500 truncate">{title}</p>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-ink transition-colors"
          data-testid="btn-regen-exit"
        >
          Done
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Card thumb — 2D, swaps to narration during regen. Visual
          chassis matched to /checkout (Kevin's reference 2026-04-26):
          white border, aspect-square + object-contain, label strip. */}
      <div className="mb-3">
        <CardThumb
          frontUrl={frontUrl}
          insideUrl={insideUrl}
          target={target}
          hasInside={hasInside}
          regeneratingSide={isRegenerating}
          state={state}
        />
      </div>

      {/* Side switcher — checkout-style pill ("bg-stone-100 rounded-
          full p-1" with PreviewTab children). Sits beneath the thumb
          so it reads as a property of the thumb, not a separate
          control. Only renders when there IS an inside to switch
          to — single-side cards don't need it. Hidden in Both mode
          (the two stacked thumbs already show what's what). */}
      {hasInside && target !== 'both' && (
        <div className="mb-3 flex items-center justify-center">
          <div className="inline-flex bg-stone-100 rounded-full p-1">
            <PreviewTab
              active={target === 'front'}
              onClick={() => setTarget('front')}
              disabled={!!isRegenerating}
              testId="pill-target-front"
            >
              Front
            </PreviewTab>
            <PreviewTab
              active={target === 'inside'}
              onClick={() => setTarget('inside')}
              disabled={!!isRegenerating}
              testId="pill-target-inside"
            >
              Inside
            </PreviewTab>
          </div>
        </div>
      )}

      {/* Both-sides affordance — deliberately lower weight than the
          Front/Inside pill above. A small text link rather than a
          third equal tab, because hammering "Both" doubles the
          regen cost and we don't want indecisive users defaulting
          to it on every iteration. The "About a minute" subtitle
          on activation makes the cost-of-time legible. */}
      {hasInside && (
        <div className="mb-5 text-center">
          {target === 'both' ? (
            <button
              type="button"
              onClick={() => setTarget('front')}
              disabled={!!isRegenerating}
              className="text-xs text-stone-500 hover:text-ink underline-offset-4 hover:underline disabled:opacity-50"
              data-testid="btn-target-back-to-single"
            >
              ← Back to single side
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setTarget('both')}
              disabled={!!isRegenerating}
              className="text-xs text-stone-500 hover:text-brand-dark italic underline-offset-4 hover:underline disabled:opacity-50"
              data-testid="btn-target-both"
            >
              Or change both sides at once
            </button>
          )}
          {target === 'both' && (
            <p className="text-[11px] text-stone-500 mt-1">
              Two new versions, one after the other. About a minute.
            </p>
          )}
        </div>
      )}

      {/* Versions rail — scoped to current target. Hidden on Both
          (no sensible mixed strip) and hidden when there's only
          one attempt (nothing to switch between yet). */}
      {railAttempts.length > 1 && (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 text-center mb-2">
            Past versions
          </p>
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
            {railAttempts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleSelect(a.id)}
                disabled={!!isRegenerating}
                className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                  a.isSelected
                    ? 'border-brand scale-105 shadow-sm'
                    : 'border-stone-200 hover:border-stone-400 opacity-80 hover:opacity-100'
                } disabled:cursor-not-allowed disabled:opacity-50`}
                aria-label={`Use version ${a.attemptNumber}`}
                data-testid={`regen-thumb-${target}-${a.attemptNumber}`}
              >
                {a.imageUrl ? (
                  <img
                    src={a.imageUrl}
                    alt={`Version ${a.attemptNumber}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-stone-100" />
                )}
                <span className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[9px] font-medium leading-none py-0.5 text-center">
                  v{a.attemptNumber}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tweak textarea — persistent, focused on mount. */}
      <div className="mb-4">
        <p className="text-[11px] text-stone-500 mb-1.5">
          What would you like to change?{' '}
          <span className="text-stone-400">(optional)</span>
        </p>
        <Textarea
          ref={textareaRef}
          value={tweak}
          onChange={(e) => setTweak(e.target.value)}
          placeholder={placeholderFor(target)}
          rows={3}
          className="text-sm resize-none"
          autoFocus
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              if (!isRegenerating) void handleSubmit();
            }
          }}
          data-testid="input-regen-tweak"
        />
      </div>

      {/* Soft-cap nudge — italic, low-volume; aimed at slowing
          slot-machine behaviour without scolding. */}
      {showSoftCap && !isRegenerating && (
        <p
          className="text-[11px] italic text-stone-500 text-center mb-4"
          data-testid="regen-soft-cap"
        >
          Sometimes the first one was the one — flip back through the
          versions before trying again.
        </p>
      )}

      {/* Submit — sticky-bottom on mobile so it stays above the
          on-screen keyboard. Inline-static on desktop. */}
      <div className="fixed sm:static bottom-0 inset-x-0 px-4 sm:px-0 py-3 sm:py-0 bg-white/95 sm:bg-transparent backdrop-blur sm:backdrop-blur-0 border-t sm:border-0 border-stone-200">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 hidden sm:block">
            {totalAttempts > 0
              ? `${totalAttempts} ${totalAttempts === 1 ? 'try' : 'tries'} so far`
              : ''}
          </p>
          <Button
            type="button"
            size="lg"
            onClick={handleSubmit}
            disabled={!!isRegenerating}
            className="bg-brand hover:bg-brand-dark text-brand-foreground w-full sm:w-auto"
            data-testid="btn-regen-submit"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Crafting your new {isRegenerating}…
              </>
            ) : (
              submitLabel(target, tweak)
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ── PreviewTab — pill-switcher tab matching /checkout exactly ─────
// Visual + interaction parity with checkout.tsx's PreviewTab so the
// switcher feels like the same control across both surfaces. Active
// state: white pill with shadow. Inactive: stone-500 hover-to-ink.
function PreviewTab({
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
      className={`px-4 py-1 text-xs font-medium rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? 'bg-white text-ink shadow-sm' : 'text-stone-500 hover:text-ink'
      }`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

// ── helpers ──────────────────────────────────────────────────────────
function placeholderFor(target: ThumbTarget): string {
  if (target === 'inside') {
    return 'e.g. "tidier handwriting" or "warmer tone"';
  }
  if (target === 'both') {
    return 'e.g. "warmer light throughout" or "more autumnal feel"';
  }
  return 'e.g. "make it more autumnal" or "swap the dog for a cat"';
}

function submitLabel(target: ThumbTarget, tweak: string): string {
  const has = !!tweak.trim();
  if (target === 'both') return has ? 'Try with these changes' : 'Try both again';
  return has ? 'Try with this change' : 'Try again';
}
