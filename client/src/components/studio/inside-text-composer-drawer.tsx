// client/src/components/studio/inside-text-composer-drawer.tsx
//
// Macro composer drawer — "Write it for me" path on the Inside step
// (2026-05-17). Sibling to inside-text-helper-drawer.tsx which is the
// per-field rewriter; this one composes ALL THREE fields (greeting +
// message + sign-off) in one shot.
//
// Mental model:
//   1. User picks "Write it for me" on the Inside step pre-question.
//   2. This drawer opens, showing:
//        • An optional brief textarea ("anything specific to mention?")
//        • Style chip row (funny / a poem / heartfelt / brief / sweet)
//        • [Write the inside] button — disabled until a style is picked
//   3. Click → POST /api/studio/inside-text/compose → result returns
//        as { greeting, message, signoff, grounding[] }.
//   4. Drawer renders the result as the ASSEMBLED CARD PREVIEW —
//        greeting on its own line, message in the body, sign-off
//        below — so the user sees the three fields as one coherent
//        message, not three separate AI outputs.
//   5. Grounding receipt below proves it's specific to their card.
//   6. Footer: [Use this] (fills all three fields + toast with undo),
//      [Try another version] (regen same style + brief, different
//      angle), [Change vibe] (in-drawer chip swap).
//
// Why a separate component from the rewriter drawer:
//   • Different input model (brief + style vs. existing draft + style)
//   • Different result shape (three fields vs. one)
//   • Different visual treatment (card preview vs. single text block)
//   • Different "first state" (rewriter auto-fires on open; composer
//     waits for the user to pick a style first)
// Could be merged behind a mode flag later if both stabilise; clean
// separation is easier to iterate on right now.

import { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
  ImageIcon,
  PenLine,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { apiRequest } from '@/lib/queryClient';
import {
  STYLE_CHIPS,
  type RewriteStyle,
} from '@/components/studio/inside-text-helper-drawer';

// ── Response types (mirror server's ComposeResponse) ────────────────

interface ComposeResult {
  greeting: string;
  message: string;
  signoff: string;
  grounding: string[];
}

interface ComposeResponse {
  result: ComposeResult;
}

// ── Component ───────────────────────────────────────────────────────

export interface InsideTextComposerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: number;
  /** Called when the user accepts a composition. Fills all THREE
   *  inside-text fields on the parent step. The parent is responsible
   *  for showing a "Restore my original" toast — this drawer just
   *  surfaces the three strings and closes. */
  onAccept: (result: {
    greeting: string;
    message: string;
    signoff: string;
  }) => void;
  /** Optional context strip shown in the header — recipient name,
   *  occasion, scene snippet. Pure visual reassurance that the
   *  composer is grounding in the user's actual card. */
  contextStrip?: {
    recipientName?: string;
    occasion?: string;
    sceneDescription?: string;
  };
}

export function InsideTextComposerDrawer({
  open,
  onOpenChange,
  cardId,
  onAccept,
  contextStrip,
}: InsideTextComposerDrawerProps) {
  // ── Input state ───────────────────────────────────────────────
  const [brief, setBrief] = useState('');
  const [style, setStyle] = useState<RewriteStyle | null>(null);

  // ── Output state ──────────────────────────────────────────────
  const [result, setResult] = useState<ComposeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Previous attempts in this (style + brief) combo, used to dedup
   *  on "Try another version". Stored as concatenated strings so the
   *  model sees the full prior context, not just messages. */
  const [previousAttempts, setPreviousAttempts] = useState<string[]>([]);

  /** When true, show the chip row in the result view so the user can
   *  swap styles without losing their brief. */
  const [pickingNewStyle, setPickingNewStyle] = useState(false);

  // Reset everything when the drawer closes so reopening is a fresh
  // session. Keeps the mental model simple: each open is a new
  // composition attempt.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      // Drawer just closed — wipe.
      setBrief('');
      setStyle(null);
      setResult(null);
      setError(null);
      setIsLoading(false);
      setPreviousAttempts([]);
      setPickingNewStyle(false);
    }
    wasOpenRef.current = open;
  }, [open]);

  const generate = async (
    targetStyle: RewriteStyle,
    targetBrief: string,
    history: string[],
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest('POST', '/api/studio/inside-text/compose', {
        cardId,
        style: targetStyle,
        brief: targetBrief || undefined,
        previousAttempts: history,
      });
      const data = (await res.json()) as ComposeResponse;
      setResult(data.result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWrite = () => {
    if (!style) return;
    setResult(null);
    setPreviousAttempts([]);
    void generate(style, brief, []);
  };

  const handleTryAnother = () => {
    if (!style) return;
    const nextHistory = result
      ? [
          ...previousAttempts,
          // Serialize the full result so the model has full prior
          // context — opening line, message angle, sign-off phrasing.
          `Greeting: ${result.greeting}\nMessage: ${result.message}\nSignoff: ${result.signoff}`,
        ].slice(-3) // cap memory at 3 prior attempts (token budget)
      : previousAttempts;
    setPreviousAttempts(nextHistory);
    void generate(style, brief, nextHistory);
  };

  const handlePickNewStyle = (next: RewriteStyle) => {
    setPickingNewStyle(false);
    setStyle(next);
    // Picking a different vibe is conceptually a fresh start — reset
    // the previousAttempts ledger so the new style isn't constrained
    // by the prior style's dedupe list.
    setPreviousAttempts([]);
    void generate(next, brief, []);
  };

  const handleAccept = () => {
    if (!result) return;
    onAccept({
      greeting: result.greeting,
      message: result.message,
      signoff: result.signoff,
    });
    onOpenChange(false);
  };

  // Which view are we showing?
  //   • input view — no result yet, user is composing inputs
  //   • result view — we have a generated composition to display
  const showingResult = !!result && !isLoading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-stone-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-muted flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-brand" strokeWidth={1.75} />
            </div>
            <SheetTitle className="text-lg">
              Write the inside for me
            </SheetTitle>
          </div>
          <SheetDescription className="text-sm text-ink-soft">
            Grounded in your card's scene and occasion. Edit any field
            after — this is a starting point, not a finish line.
          </SheetDescription>
          {contextStrip && <ContextStrip strip={contextStrip} />}
        </SheetHeader>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {!showingResult && (
            <ComposerInputs
              brief={brief}
              setBrief={setBrief}
              style={style}
              setStyle={setStyle}
              isLoading={isLoading}
              onWrite={handleWrite}
              hasResult={!!result}
            />
          )}

          {isLoading && <ComposeSkeleton />}

          {error && !isLoading && (
            <ErrorBlock
              message={error}
              onRetry={() => style && void generate(style, brief, previousAttempts)}
            />
          )}

          {showingResult && result && (
            <>
              <CardPreview
                greeting={result.greeting}
                message={result.message}
                signoff={result.signoff}
                grounding={result.grounding}
              />
              {pickingNewStyle && (
                <div className="rounded-xl border border-brand/40 bg-brand-muted/30 px-4 py-3 space-y-2">
                  <p className="text-xs font-medium text-ink-soft uppercase tracking-wider">
                    Pick another vibe
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {STYLE_CHIPS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => handlePickNewStyle(c.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          c.value === style
                            ? 'bg-ink text-white'
                            : 'bg-white border border-stone-300 text-ink hover:border-brand hover:text-brand-dark'
                        }`}
                        data-testid={`composer-chip-${c.value}`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        {showingResult && result && (
          <div className="border-t border-stone-200 px-6 py-4 flex flex-col gap-2 flex-shrink-0 bg-white">
            <Button
              onClick={handleAccept}
              className="w-full bg-cta hover:bg-cta-hover text-white"
              data-testid="btn-composer-accept"
            >
              <Check className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
              Use this — fill all three boxes
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={handleTryAnother}
                variant="outline"
                className="flex-1"
                data-testid="btn-composer-try-another"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Try another version
              </Button>
              <Button
                onClick={() => setPickingNewStyle((v) => !v)}
                variant="outline"
                className="flex-1"
                data-testid="btn-composer-change-vibe"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {pickingNewStyle ? 'Hide vibes' : 'Change vibe'}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────

function ContextStrip({
  strip,
}: {
  strip: NonNullable<InsideTextComposerDrawerProps['contextStrip']>;
}) {
  const bits: string[] = [];
  if (strip.occasion) bits.push(strip.occasion);
  if (strip.recipientName) bits.push(`for ${strip.recipientName}`);
  if (strip.sceneDescription) {
    const scene =
      strip.sceneDescription.length > 60
        ? strip.sceneDescription.slice(0, 57).trim() + '…'
        : strip.sceneDescription;
    bits.push(scene);
  }
  if (bits.length === 0) return null;
  return (
    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-ink-soft">
      <ImageIcon
        className="w-3 h-3 mt-0.5 shrink-0 text-stone-400"
        strokeWidth={1.75}
      />
      <span className="truncate" title={bits.join(' · ')}>
        {bits.join(' · ')}
      </span>
    </div>
  );
}

function ComposerInputs({
  brief,
  setBrief,
  style,
  setStyle,
  isLoading,
  onWrite,
  hasResult,
}: {
  brief: string;
  setBrief: (v: string) => void;
  style: RewriteStyle | null;
  setStyle: (s: RewriteStyle) => void;
  isLoading: boolean;
  onWrite: () => void;
  hasResult: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* ── Brief textarea ──────────────────────────────────────── */}
      <div>
        <label
          htmlFor="composer-brief"
          className="block text-xs uppercase tracking-wider font-semibold text-ink-soft mb-1.5"
        >
          Anything specific to mention?{' '}
          <span className="text-stone-400 normal-case tracking-normal font-normal">
            (optional)
          </span>
        </label>
        <Textarea
          id="composer-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="It's his 60th, mention the fishing trip he took with my brother, I'm really proud of him…"
          rows={4}
          className="bg-white text-sm leading-relaxed resize-none border-brand-light focus-visible:border-brand focus-visible:ring-brand/20"
          maxLength={500}
          data-testid="composer-brief"
        />
        <p className="text-[11px] text-stone-500 mt-1.5">
          Skip if you'd like — we'll work from your card's scene and occasion alone.
        </p>
      </div>

      {/* ── Style chip row ──────────────────────────────────────── */}
      <div>
        <label className="block text-xs uppercase tracking-wider font-semibold text-ink-soft mb-2">
          Pick a vibe
        </label>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setStyle(c.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                style === c.value
                  ? 'bg-ink text-white'
                  : 'bg-white border border-stone-300 text-ink hover:border-brand hover:text-brand-dark'
              }`}
              data-testid={`composer-style-${c.value}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Action ──────────────────────────────────────────────── */}
      <Button
        onClick={onWrite}
        disabled={!style || isLoading}
        className="w-full bg-brand hover:bg-brand-dark text-white"
        data-testid="btn-composer-write"
      >
        <PenLine className="w-4 h-4 mr-1.5" strokeWidth={2} />
        {hasResult ? 'Write a new version' : 'Write the inside'}
      </Button>
      {!style && (
        <p className="text-[11px] text-stone-400 text-center -mt-3">
          Pick a vibe to continue.
        </p>
      )}
    </div>
  );
}

function ComposeSkeleton() {
  return (
    <div
      className="rounded-xl border-2 border-brand/30 bg-brand-muted/20 px-4 py-10 text-center"
      data-testid="composer-loading"
    >
      <Loader2 className="w-5 h-5 mx-auto mb-3 animate-spin text-brand" />
      <p className="text-sm text-ink-soft">Writing the inside…</p>
      <p className="text-[11px] text-stone-400 mt-1">
        Usually 5–10 seconds.
      </p>
    </div>
  );
}

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl bg-accent-red/10 border border-accent-red/30 px-4 py-3 space-y-2">
      <p className="text-sm text-accent-red">{message}</p>
      <Button
        onClick={onRetry}
        size="sm"
        variant="outline"
        className="border-accent-red/40 text-accent-red hover:bg-accent-red/10"
        data-testid="btn-composer-error-retry"
      >
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Try again
      </Button>
    </div>
  );
}

/**
 * CardPreview renders the three composed fields as they'll appear on
 * the card — greeting on its own line, message in the body, sign-off
 * below — so the user can judge coherence at a glance.
 *
 * The visual mimics a card's inside spread (cream background, ink-coloured
 * type, generous spacing) without trying to replicate the final
 * typography (that lives in the rendered card image). The point is
 * "do these three beats read as ONE message?" not "what will the
 * printed card look like?".
 */
function CardPreview({
  greeting,
  message,
  signoff,
  grounding,
}: {
  greeting: string;
  message: string;
  signoff: string;
  grounding: string[];
}) {
  return (
    <div
      className="rounded-xl border-2 border-brand/40 bg-white px-5 py-5 shadow-sm"
      data-testid="composer-result"
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Wand2 className="w-3.5 h-3.5 text-brand" strokeWidth={2} />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-brand-dark">
          Your inside, written
        </p>
      </div>

      {/* The card preview — cream background to evoke the inside spread.
          Three beats with breathing room so the user can read it as ONE
          message, not three concatenated AI outputs. */}
      <div className="rounded-lg bg-[#FDFBF6] border border-stone-200/60 px-5 py-5 space-y-4">
        <p
          className="text-sm font-medium text-ink"
          data-testid="composer-preview-greeting"
        >
          {greeting}
        </p>
        <p
          className="text-sm text-ink leading-relaxed whitespace-pre-wrap"
          data-testid="composer-preview-message"
        >
          {message}
        </p>
        <p
          className="text-sm text-ink italic"
          data-testid="composer-preview-signoff"
        >
          {signoff}
        </p>
      </div>

      {grounding.length > 0 && (
        <div
          className="mt-3 pt-3 border-t border-stone-100 flex items-start gap-1.5 text-[11px] text-ink-soft italic"
          data-testid="composer-grounding"
        >
          <Sparkles
            className="w-3 h-3 mt-0.5 shrink-0 text-brand/60"
            strokeWidth={2}
          />
          <span>Woven in: {grounding.join(' · ')}</span>
        </div>
      )}
    </div>
  );
}
