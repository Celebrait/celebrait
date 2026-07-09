// client/src/components/studio/inside-text-helper-drawer.tsx
//
// Inside-card message rewriter drawer — STYLE TRANSFORM rebuild
// (2026-05-16). See also next_inside_text_helper_polish_rebuild.md.
//
// Mental model: the user has written a draft inside-message. They
// click a "vibe" chip under the textarea (funny / a poem / heartfelt
// / brief / sweet). This drawer slides in, immediately fires the
// rewrite against /api/studio/inside-text/suggest, and shows:
//
//   • Header   — the style they picked + a quick context strip showing
//                what the rewriter is grounding the result in (scene
//                description + recipient name).
//   • Body     — their original draft (readonly preview) → the rewrite
//                in the chosen style, with a "grounding receipt" that
//                lists which context elements were actually used. The
//                receipt is the antidote to "feels like AI" — it makes
//                the grounding visible.
//   • Footer   — [Use this] [Try {style} again] [Try another vibe]
//                "Try again" regenerates the same style; the server
//                gets the previous attempts and is told to find a
//                different angle. "Try another vibe" reveals the chip
//                row inside the drawer so the user can switch style
//                without closing.
//
// What's intentionally NOT here (vs the previous version):
//   • Tabs (Fresh ideas / Adapt mine). One job: rewrite a draft.
//   • Fresh-generate-from-nothing path. The textarea is the canonical
//     input — if it's empty, the chips outside this drawer are disabled
//     and you can't even open it.
//   • Three suggestion cards. One result per click. If you don't like
//     it, try again or try another vibe — fewer choices, clearer call.
//   • Tone chips for narrowing. The chosen style IS the narrowing.

import { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
  ImageIcon,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { apiRequest } from '@/lib/queryClient';

// ── Style catalogue (mirror of server's STYLE_INSTRUCTIONS keys) ─────

export type RewriteStyle = 'funny' | 'poem' | 'heartfelt' | 'brief' | 'sweet';

/** Chip label = what the user sees. Reads as "Make it ___" in context
 *  (the chip row's leading label is "Make it:"). "A poem" not "poem"
 *  so the natural sentence holds. */
export const STYLE_CHIPS: Array<{ value: RewriteStyle; label: string }> = [
  { value: 'funny', label: 'funny' },
  { value: 'poem', label: 'a poem' },
  { value: 'heartfelt', label: 'heartfelt' },
  { value: 'brief', label: 'brief' },
  { value: 'sweet', label: 'sweet' },
];

/** Header copy when a style is active in the drawer. */
const STYLE_HEADER_LABEL: Record<RewriteStyle, string> = {
  funny: 'Funny version',
  poem: 'As a poem',
  heartfelt: 'Heartfelt version',
  brief: 'Brief version',
  sweet: 'Sweet version',
};

/** Verb used in the loading state and "try X again" button. Picked
 *  per-style so the UI doesn't all say the same generic "Rewriting…". */
const STYLE_VERB: Record<RewriteStyle, string> = {
  funny: 'Making it funny',
  poem: 'Writing the poem',
  heartfelt: 'Making it heartfelt',
  brief: 'Tightening',
  sweet: 'Making it sweet',
};

// ── Response types ──────────────────────────────────────────────────

interface RewriteResult {
  text: string;
  /** Short labels for the context elements the model claims to have
   *  used. Surfaced as a "grounding receipt" below the result. */
  grounding: string[];
}

interface RewriteResponse {
  result: RewriteResult;
}

// ── Component ───────────────────────────────────────────────────────

interface InsideTextHelperDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: number;
  /** The user's current draft. The rewriter transforms THIS into the
   *  chosen style — never works from scratch. */
  draft: string;
  /** Style the user picked when opening the drawer. Can be changed
   *  in-drawer via the "Try another vibe" affordance. */
  style: RewriteStyle | null;
  /** Called when the user picks a different vibe from inside the
   *  drawer. Parent updates its own `style` prop, which re-opens the
   *  drawer effect chain and fires a fresh rewrite. */
  onStyleChange: (next: RewriteStyle) => void;
  /** Called when the user accepts a rewrite. Replaces the textarea
   *  content and closes the drawer. */
  onAccept: (text: string) => void;
  /** Optional context shown in the header strip — purely visual
   *  "here's what we're grounding in" reassurance. Server uses the
   *  card's stored state for the actual grounding; this is just UI. */
  contextStrip?: {
    recipientName?: string;
    occasion?: string;
    sceneDescription?: string;
  };
}

export function InsideTextHelperDrawer({
  open,
  onOpenChange,
  cardId,
  draft,
  style,
  onStyleChange,
  onAccept,
  contextStrip,
}: InsideTextHelperDrawerProps) {
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Previous attempts in the CURRENT style — sent back to the server
   *  on "Try again" so the model is told to find a different angle. */
  const [previousAttempts, setPreviousAttempts] = useState<string[]>([]);
  /** When true, show the chip row inside the drawer so the user can
   *  switch vibes without closing. Triggered by "Try another vibe". */
  const [pickingNewStyle, setPickingNewStyle] = useState(false);

  // Track the last (open+style) tuple we fired against so opening +
  // closing the drawer at the same style doesn't refire automatically.
  const lastFiredKeyRef = useRef<string | null>(null);

  const generate = async (
    targetStyle: RewriteStyle,
    history: string[],
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest('POST', '/api/studio/inside-text/suggest', {
        cardId,
        style: targetStyle,
        draft,
        previousAttempts: history,
      });
      const data = (await res.json()) as RewriteResponse;
      setResult(data.result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fire on open when a style is set. The user already did the
  // work of writing the draft AND picked a vibe — making them click
  // another button to "go" would be friction for no reason.
  //
  // Re-fires when the style changes inside the drawer (Try another
  // vibe → pick a different chip). Resets the previousAttempts ledger
  // because the model only needs to dedupe within the active style.
  useEffect(() => {
    if (!open || !style) return;
    const key = `${cardId}::${style}`;
    if (lastFiredKeyRef.current === key) return;
    lastFiredKeyRef.current = key;
    setResult(null);
    setPreviousAttempts([]);
    setPickingNewStyle(false);
    void generate(style, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, style, cardId]);

  // Reset internal state when the drawer fully closes so the next
  // open starts clean. (lastFiredKeyRef stays so we don't re-fire the
  // same style if the user reopens to the same chip.)
  useEffect(() => {
    if (open) return;
    setError(null);
    setPickingNewStyle(false);
  }, [open]);

  const handleTryAgain = () => {
    if (!style) return;
    const nextHistory = result
      ? [...previousAttempts, result.text].slice(-5) // cap memory
      : previousAttempts;
    setPreviousAttempts(nextHistory);
    // Force a re-fire even though style key hasn't changed — bump the
    // ref to a sentinel so the auto-fire effect doesn't trip.
    lastFiredKeyRef.current = `${cardId}::${style}::${nextHistory.length}`;
    void generate(style, nextHistory);
  };

  const handlePickNewStyle = (next: RewriteStyle) => {
    if (next === style) {
      // Same chip clicked — treat as "Try {style} again"
      setPickingNewStyle(false);
      handleTryAgain();
      return;
    }
    setPickingNewStyle(false);
    onStyleChange(next); // parent flips style prop → effect refires
  };

  const handleAccept = () => {
    if (!result) return;
    onAccept(result.text);
    onOpenChange(false);
  };

  const headerLabel = style ? STYLE_HEADER_LABEL[style] : 'Pick a vibe';
  const loadingVerb = style ? STYLE_VERB[style] : 'Working';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-keeper-hair flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-muted flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-brand" strokeWidth={1.75} />
            </div>
            <SheetTitle className="text-lg">{headerLabel}</SheetTitle>
          </div>
          <SheetDescription className="text-sm text-ink-soft">
            Keeps your voice. Uses your card's scene + occasion to make it
            specific to you.
          </SheetDescription>

          {/* Context strip — the "we're grounding in this" visual cue.
              Quiet, single line, scene + occasion + recipient if known.
              Empty (or thin) scene context is acceptable — the receipt
              below the result will be lighter and the user will see why. */}
          {contextStrip && (
            <ContextStrip strip={contextStrip} />
          )}
        </SheetHeader>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* User's original draft — readonly preview so they can see
              what's being transformed and the rewrite reads as a
              variation of THEIR words, not a replacement. */}
          <DraftPreview draft={draft} />

          {/* Result area: loading skeleton, error block, or the rewrite
              card with grounding receipt. */}
          {isLoading && <ResultSkeleton verb={loadingVerb} />}

          {!isLoading && error && (
            <ErrorBlock
              message={error}
              onRetry={() => style && generate(style, previousAttempts)}
            />
          )}

          {!isLoading && !error && result && style && (
            <ResultCard
              style={style}
              text={result.text}
              grounding={result.grounding}
            />
          )}

          {/* In-drawer chip picker — revealed when user clicks
              "Try another vibe". Same chips as outside, but the click
              flips the active style inside this drawer instead of
              opening anything new. */}
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
                    data-testid={`drawer-chip-${c.value}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer actions ─────────────────────────────────────── */}
        {/* Sticky so the primary action is always reachable even on
            short viewports / long rewrites. */}
        {!isLoading && result && (
          <div className="border-t border-keeper-hair px-6 py-4 flex flex-col gap-2 flex-shrink-0 bg-white">
            <Button
              onClick={handleAccept}
              className="w-full bg-cta hover:bg-cta-hover text-white"
              data-testid="btn-rewrite-accept"
            >
              <Check className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
              Use this version
            </Button>
            <div className="flex gap-2">
              {style && (
                <Button
                  onClick={handleTryAgain}
                  variant="outline"
                  className="flex-1"
                  data-testid="btn-rewrite-try-again"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Try {STYLE_CHIPS.find((c) => c.value === style)?.label} again
                </Button>
              )}
              <Button
                onClick={() => setPickingNewStyle((v) => !v)}
                variant="outline"
                className="flex-1"
                data-testid="btn-rewrite-pick-vibe"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {pickingNewStyle ? 'Hide vibes' : 'Try another vibe'}
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
  strip: NonNullable<InsideTextHelperDrawerProps['contextStrip']>;
}) {
  const bits: string[] = [];
  if (strip.occasion) bits.push(strip.occasion);
  if (strip.recipientName) bits.push(`for ${strip.recipientName}`);
  if (strip.sceneDescription) {
    // Compress long scene descriptions to ~60 chars — the header is for
    // recognition, not reading. Full scene is used by the server.
    const scene = strip.sceneDescription.length > 60
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

function DraftPreview({ draft }: { draft: string }) {
  return (
    <div className="rounded-xl bg-stone-50 border border-keeper-hair px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-soft mb-1.5">
        Your draft
      </p>
      <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
        {draft}
      </p>
    </div>
  );
}

function ResultSkeleton({ verb }: { verb: string }) {
  return (
    <div
      className="rounded-xl border-2 border-brand/30 bg-brand-muted/20 px-4 py-6 text-center"
      data-testid="rewrite-loading"
    >
      <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin text-brand" />
      <p className="text-sm text-ink-soft">{verb}…</p>
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
        data-testid="btn-rewrite-error-retry"
      >
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Try again
      </Button>
    </div>
  );
}

function ResultCard({
  style,
  text,
  grounding,
}: {
  style: RewriteStyle;
  text: string;
  grounding: string[];
}) {
  const styleLabel = STYLE_CHIPS.find((c) => c.value === style)?.label ?? style;
  return (
    <div
      className="rounded-xl border-2 border-brand/40 bg-white px-4 py-4 shadow-sm"
      data-testid="rewrite-result"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Wand2 className="w-3.5 h-3.5 text-brand" strokeWidth={2} />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-brand-dark">
          {styleLabel}
        </p>
      </div>
      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
      {/* Grounding receipt — the antidote to "feels like AI". Shows
          the user which scene/photo/occasion elements were actually
          woven in. When the array is empty (model failed the
          grounding rule, or context was too thin to ground in), we
          hide the receipt rather than render an awkward "Used: " with
          nothing after it. */}
      {grounding.length > 0 && (
        <div
          className="mt-3 pt-3 border-t border-stone-100 flex items-start gap-1.5 text-[11px] text-ink-soft italic"
          data-testid="rewrite-grounding"
        >
          <Sparkles
            className="w-3 h-3 mt-0.5 shrink-0 text-brand/60"
            strokeWidth={2}
          />
          <span>
            Woven in: {grounding.join(' · ')}
          </span>
        </div>
      )}
    </div>
  );
}
