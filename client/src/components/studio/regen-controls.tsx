// client/src/components/studio/regen-controls.tsx
//
// REGEN EDIT MODE — full-screen "workbench" surface for iterating on
// a generated card. The reveal screen's "Make a change" pill flips
// here; the Done button (or the new "Keep this and finish" CTA) flips
// back.
//
//   ┌───────────────────────────────────────────────────────┐
//   │  ← Mum's birthday card                          Done │  header
//   ├───────────────────────────────────────────────────────┤
//   │             ┌────────┐  ┌────────┐                    │
//   │             │  Front │  │ Inside │  (Both: side-by-   │
//   │             └────────┘  └────────┘   side, max-560)   │
//   │              v1 ─ v2 ─ ●v3   versions rail (scoped)   │
//   │                                                       │
//   │   ┌────────────────────────────────────────────┐      │
//   │   │ ✓ Keep this and finish · Try another change │ ← post-regen
//   │   └────────────────────────────────────────────┘      │
//   │                                                       │
//   │  ┌──────────────────────────────────────┐            │
//   │  │ What would you like to change?       │            │
//   │  │ (in Both mode: TWO labelled textareas)│           │
//   │  └──────────────────────────────────────┘            │
//   │                          [ Try with this change ]    │
//   └───────────────────────────────────────────────────────┘
//
// Loop semantics:
//   • Single textareas per side (front / inside) — Both mode shows
//     BOTH textareas, one per side. Audit-reverse 2026-04-26 from a
//     shared single textarea; real-use feedback was that two boxes
//     match user expectation.
//   • Textarea values PERSIST across submits — most users tweak the
//     tweak ("warmer light" → "warmer light, less orange").
//   • Focus stays in the (last-edited) textarea after a submit lands.
//   • After a successful regen, a small banner offers "Keep this and
//     finish" (= exit edit mode) or "Try another change" (= dismiss).
//     Without it the user couldn't tell the new image was committed.
//   • The thumb shows a clean spinner during regen — no narration
//     text inside the chassis (was reading as stale during ~30s wait).

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CardThumb, type ThumbTarget } from '@/components/studio/card-thumb';
import type { CardAttemptDTO } from '@/hooks/use-card-maker';
import type { CardSide, CardDraftState } from '@shared/schema';

interface RegenEditModeProps {
  /** Recipient + occasion drive the header title. */
  state: CardDraftState;
  frontUrl: string | null;
  insideUrl: string | null;
  /** All attempts (front + inside, completed + in-flight). */
  attempts: CardAttemptDTO[];
  /** Which side is regenerating right now, or null. */
  isRegenerating: CardSide | null;
  /** True when the card has an inside (write or blank). */
  hasInside: boolean;
  onRegenerate: (side: CardSide, tweak?: string) => Promise<void>;
  onSelectAttempt: (attemptId: number) => Promise<void>;
  /** Exit edit mode and return to the reveal layout. */
  onExit: () => void;
}

/** Soft cap — show the "sometimes the first one was the one" nudge
 *  once a side has this many completed attempts. */
const SOFT_CAP_PER_SIDE = 3;

/** How long the "Keep this and finish / Try another change" banner
 *  stays up after a regen lands before fading. Long enough to read,
 *  short enough that the textarea isn't covered for an active user. */
const POST_REGEN_BANNER_MS = 30_000;

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
  // Per-side tweak state. Both mode renders BOTH textareas (one per
  // side); single-side modes render one. Switching target preserves
  // what the user typed in either box. Cleared only by Cancel or
  // explicit "Try another change" on the post-regen banner.
  const [tweakFront, setTweakFront] = useState('');
  const [tweakInside, setTweakInside] = useState('');

  const frontTextareaRef = useRef<HTMLTextAreaElement>(null);
  const insideTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Force target back to 'front' if hasInside flips off mid-flow.
  useEffect(() => {
    if (!hasInside && target !== 'front') setTarget('front');
  }, [hasInside, target]);

  // ── Post-regen banner state machine ────────────────────────────────
  // When a regen completes (isRegenerating flips non-null → null),
  // pop a banner offering "keep this" or "try another". Without this
  // the user has no clear signal that the new image is committed —
  // they're left wondering if they need to do something else.
  const [showPostRegenBanner, setShowPostRegenBanner] = useState(false);
  const wasRegeneratingRef = useRef<CardSide | null>(null);
  useEffect(() => {
    const was = wasRegeneratingRef.current;
    if (was && !isRegenerating) {
      setShowPostRegenBanner(true);
      // Refocus the most relevant textarea after a regen lands so
      // the iterate loop stays warm. For Both mode, focus front
      // (arbitrary default; user can tab/click to inside).
      if (target === 'inside') {
        insideTextareaRef.current?.focus();
      } else {
        frontTextareaRef.current?.focus();
      }
      const t = setTimeout(() => setShowPostRegenBanner(false), POST_REGEN_BANNER_MS);
      wasRegeneratingRef.current = isRegenerating;
      return () => clearTimeout(t);
    }
    wasRegeneratingRef.current = isRegenerating;
  }, [isRegenerating, target]);

  // Auto-dismiss the banner if the user starts typing — they're
  // clearly opting into "another change" so the banner becomes noise.
  useEffect(() => {
    if (showPostRegenBanner && (tweakFront || tweakInside)) {
      setShowPostRegenBanner(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tweakFront, tweakInside]);

  const front = attempts.filter((a) => a.side === 'front').sort((a, b) => a.attemptNumber - b.attemptNumber);
  const inside = attempts.filter((a) => a.side === 'inside').sort((a, b) => a.attemptNumber - b.attemptNumber);

  const completedFront = front.filter((a) => a.status === 'completed');
  const completedInside = inside.filter((a) => a.status === 'completed');
  const totalAttempts = completedFront.length + completedInside.length;

  const showSoftCap =
    completedFront.length >= SOFT_CAP_PER_SIDE ||
    completedInside.length >= SOFT_CAP_PER_SIDE;

  // Versions rail content depends on target. Hidden in Both mode.
  const railAttempts =
    target === 'front'
      ? completedFront
      : target === 'inside'
        ? completedInside
        : [];

  const handleSubmit = async () => {
    const front = tweakFront.trim() || undefined;
    const inside = tweakInside.trim() || undefined;

    // Banner clears immediately on submit — we're regenerating again.
    setShowPostRegenBanner(false);

    try {
      if (target === 'both') {
        // Sequenced front-then-inside, each with its own tweak. Pure
        // re-roll on either side if its box is empty. ~1 minute total.
        await onRegenerate('front', front);
        await onRegenerate('inside', inside);
      } else if (target === 'front') {
        await onRegenerate('front', front);
      } else {
        await onRegenerate('inside', inside);
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

  // Header title — derives from the draft.
  const recipient = state.recipient?.name?.trim();
  const occasion = state.recipient?.occasion?.trim();
  const title = recipient
    ? occasion
      ? `${recipient}'s ${occasion} card`
      : `${recipient}'s card`
    : 'Make a change';

  // Submit button label — adapts to target + tweak content.
  const submitLabel = (() => {
    if (isRegenerating) return `Crafting your new ${isRegenerating}…`;
    if (target === 'both') {
      const has = !!(tweakFront.trim() || tweakInside.trim());
      return has ? 'Try with these changes' : 'Try both again';
    }
    const text = target === 'front' ? tweakFront : tweakInside;
    return text.trim() ? 'Try with this change' : 'Try again';
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="max-w-2xl mx-auto px-4 sm:px-6 pb-32 sm:pb-12"
      data-testid="regen-edit-mode"
    >
      {/* Header */}
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

      {/* Card thumb */}
      <div className="mb-3">
        <CardThumb
          frontUrl={frontUrl}
          insideUrl={insideUrl}
          target={target}
          hasInside={hasInside}
          regeneratingSide={isRegenerating}
        />
      </div>

      {/* Side switcher — checkout-style pill. Hidden in Both mode. */}
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

      {/* Both-sides affordance */}
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

      {/* Versions rail — scoped to current target. Hidden on Both. */}
      {railAttempts.length > 1 && (
        <div className="mb-5">
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

      {/* Post-regen banner — fades in after a successful regen.
          Two clear actions: keep + exit, or stay for another tweak. */}
      <AnimatePresence>
        {showPostRegenBanner && !isRegenerating && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="mb-4 rounded-xl border border-brand/30 bg-brand/5 p-3"
            data-testid="regen-post-banner"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-sm text-ink flex items-center gap-1.5">
                <Check className="w-4 h-4 text-brand-dark" />
                New version ready — happy with it?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPostRegenBanner(false)}
                  className="text-xs text-stone-500 hover:text-ink px-2 py-1"
                  data-testid="btn-post-regen-try-again"
                >
                  Try another change
                </button>
                <Button
                  type="button"
                  size="sm"
                  onClick={onExit}
                  className="bg-brand hover:bg-brand-dark text-brand-foreground"
                  data-testid="btn-post-regen-keep"
                >
                  Keep this and finish
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tweak input(s). Single textarea for front/inside; TWO labelled
          textareas in Both mode (audit-reverse 2026-04-26). */}
      {target === 'both' ? (
        <div className="mb-4 space-y-3">
          <p className="text-[11px] text-stone-500">
            What to change for each side?{' '}
            <span className="text-stone-400">(both optional)</span>
          </p>
          <SidedTweakInput
            label="Front"
            value={tweakFront}
            onChange={setTweakFront}
            placeholder='e.g. "swap the dog for a cat"'
            onSubmit={handleSubmit}
            inputRef={frontTextareaRef}
            disabled={!!isRegenerating}
            testId="input-regen-tweak-front"
          />
          <SidedTweakInput
            label="Inside"
            value={tweakInside}
            onChange={setTweakInside}
            placeholder='e.g. "tidier handwriting"'
            onSubmit={handleSubmit}
            inputRef={insideTextareaRef}
            disabled={!!isRegenerating}
            testId="input-regen-tweak-inside"
          />
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-[11px] text-stone-500 mb-1.5">
            What would you like to change?{' '}
            <span className="text-stone-400">(optional)</span>
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
            autoFocus
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
      )}

      {/* Soft-cap nudge */}
      {showSoftCap && !isRegenerating && (
        <p
          className="text-[11px] italic text-stone-500 text-center mb-4"
          data-testid="regen-soft-cap"
        >
          Sometimes the first one was the one — flip back through the
          versions before trying again.
        </p>
      )}

      {/* Submit — sticky-bottom on mobile so it stays above the keyboard */}
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
            {isRegenerating && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {submitLabel}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ── PreviewTab — checkout-style pill switcher ──────────────────────
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

// ── SidedTweakInput — labelled textarea row used inside Both mode ──
function SidedTweakInput({
  label,
  value,
  onChange,
  placeholder,
  onSubmit,
  inputRef,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  onSubmit: () => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  disabled?: boolean;
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
