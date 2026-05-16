// client/src/components/studio/steps/front-step.tsx
//
// Step 5: the short headline printed on the card front (e.g.
// "Happy Birthday Dad"). Server has always rendered this text from
// recipient + occasion; this step lets the user see + override the
// default — OR explicitly opt out so the scene stands alone.
//
// UX mirrors the inside-text step: write-mode is the default view
// because most users want a headline. A subordinate "Skip the front
// text" card sits below the input as the explicit opt-out (mode='none').
// Picking it swaps the input for a confirmed-blank panel, the same
// shape inside-step uses, so the two steps feel like siblings.
//
// Empty-write is still a valid "use the default" path — the server
// falls back to deriveDefaultFrontText when state.front.text is blank
// AND mode !== 'none'. Only mode='none' skips the headline entirely.

import { useEffect, useRef, useState } from 'react';
import { Check, FileText, PenLine, Type } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CardDraftState } from '@shared/schema';
import { deriveDefaultFrontText } from '@shared/schema';

interface FrontStepProps {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
}

export function FrontStep({ state, onChange }: FrontStepProps) {
  // 'none' is the explicit opt-out. Absent / 'write' both render the
  // input form (write is the implicit default — same convention as
  // inside-step.tsx).
  const isNone = state.front?.mode === 'none';

  const switchToNone = () => {
    onChange({
      front: {
        ...state.front,
        mode: 'none',
      },
    });
  };

  const switchToWrite = () => {
    onChange({
      front: {
        ...state.front,
        mode: 'write',
      },
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <p className="text-sm text-stone-600">
        A short line that sits with the scene — sometimes folded in,
        sometimes set above. Keep it brief; a few words read best.
      </p>

      {isNone ? (
        <NoTextPanel onUndo={switchToWrite} />
      ) : (
        <>
          <WriteField state={state} onChange={onChange} />
          <SkipFrontTextCard onPick={switchToNone} />
        </>
      )}
    </div>
  );
}

// ── Skip-text escape hatch ───────────────────────────────────────────
// Subordinate card below the input. Same dashed-border treatment as
// inside-step's LeaveBlankCard so the two steps feel paired.
function SkipFrontTextCard({ onPick }: { onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="w-full text-left p-4 rounded-xl border border-dashed border-stone-300 hover:border-brand hover:bg-brand-muted/40 transition-colors flex items-start gap-3"
      data-testid="front-skip-text"
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-muted text-brand shrink-0">
        <FileText className="w-4 h-4" strokeWidth={1.75} />
      </span>
      <div>
        <div className="text-sm font-medium text-ink">
          Skip the front text
        </div>
        <p className="text-xs text-stone-500 mt-0.5">
          No headline — the scene speaks for itself.
        </p>
      </div>
    </button>
  );
}

// ── No-text-mode panel (replaces the form when picked) ───────────────
function NoTextPanel({ onUndo }: { onUndo: () => void }) {
  return (
    <div
      className="bg-brand-muted border-2 border-brand rounded-2xl p-6"
      data-testid="front-no-text-panel"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0 shadow-sm">
          <Check className="w-4 h-4" strokeWidth={3} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            We'll leave the front text-free
          </p>
          <p className="text-xs text-stone-600 mt-0.5">
            The scene stands alone — no headline, no greeting overlaid
            on the image.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand-dark underline underline-offset-2"
        data-testid="front-back-to-writing"
      >
        <PenLine className="w-3 h-3" />
        Actually, I'll add a headline
      </button>
    </div>
  );
}

// ── Write-mode field (default view) ──────────────────────────────────
function WriteField({
  state,
  onChange,
}: {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
}) {
  const defaultText = deriveDefaultFrontText(state);

  // Local value so typing doesn't fire a save per keystroke. Commits
  // on blur. Input starts empty — the derived default lives in the
  // placeholder only, not seeded into the field. Kevin noted 2026-04-24
  // that seeding felt pushy; the user should feel they're writing, not
  // editing.
  const stored = state.front?.text;
  const [local, setLocal] = useState(stored ?? '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (stored !== undefined && stored !== local) {
      setLocal(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  // Commit a partial front update. Also promotes mode to 'write' —
  // typing is the implicit opt-in (same pattern as inside-step).
  const commit = () => {
    const trimmed = local.trim();
    if (!trimmed) {
      // Empty field = use default downstream (server falls back to
      // deriveDefaultFrontText when state.front.text is absent), so we
      // deliberately keep state.front.text undefined for empty input.
      if (state.front?.text !== undefined) {
        onChange({
          front: { ...state.front, mode: 'write', text: undefined },
        });
      } else if (state.front?.mode !== 'write') {
        // Make the implicit-write default explicit on first interaction
        // so subsequent reads see a stable mode.
        onChange({ front: { ...state.front, mode: 'write' } });
      }
      return;
    }
    if (trimmed !== stored) {
      onChange({
        front: { ...state.front, mode: 'write', text: trimmed },
      });
    }
  };

  return (
    <div
      className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 shadow-sm"
      data-testid="front-write-field"
    >
      <Label
        htmlFor="front-text"
        className="flex items-center gap-1.5 text-sm text-ink mb-2"
      >
        <Type className="w-4 h-4 text-brand" strokeWidth={1.75} aria-hidden="true" />
        Front headline
        <span className="ml-1 text-xs text-stone-400 font-normal">optional</span>
      </Label>
      <Input
        ref={inputRef}
        id="front-text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        placeholder={defaultText || 'Happy Birthday'}
        className="bg-white border-brand-light focus-visible:border-brand focus-visible:ring-brand/20"
        data-testid="input-front-text"
      />
      <div className="flex items-center justify-between mt-1">
        <p className="text-[11px] text-stone-400">
          {local.length > 0
            ? `${local.length} characters`
            : defaultText
              ? `Leave blank to use "${defaultText}".`
              : 'Type a short headline, or skip below.'}
        </p>
      </div>
    </div>
  );
}

/** Is the Front step complete enough to move on? Always yes:
 *  - mode='none': explicit opt-out, ready immediately.
 *  - mode='write' or absent: empty is valid (server falls back to default
 *    or — if no default can be formed — renders no text). User never
 *    gets blocked here. */
export function isFrontStepReady(_state: CardDraftState): boolean {
  return true;
}
