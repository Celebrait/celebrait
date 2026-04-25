// client/src/components/studio/steps/front-step.tsx
//
// Step 5: the short headline printed on the card front (e.g.
// "Happy Birthday Dad"). Server has always rendered this text from
// recipient + occasion; this step lets the user see + override the
// default instead of it silently happening.
//
// Empty value is valid — the server falls back to the same auto-
// derivation when `state.front.text` is absent, so the user can
// leave the default and advance with zero friction.

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CardDraftState } from '@shared/schema';
import { deriveDefaultFrontText } from '@shared/schema';

interface FrontStepProps {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
}

export function FrontStep({ state, onChange }: FrontStepProps) {
  const defaultText = deriveDefaultFrontText(state);

  // Local value so typing doesn't fire a save per keystroke. Commits
  // on blur. Input starts empty — the derived default (e.g. "Happy
  // Birthday Mum") lives in the placeholder only, not seeded into the
  // field. Kevin noted 2026-04-24 that seeding felt pushy; the user
  // should feel they're writing, not editing.
  const stored = state.front?.text;
  const [local, setLocal] = useState(stored ?? '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // External stored value (e.g. revisiting the step after a typed
    // override) should hydrate the field.
    if (stored !== undefined && stored !== local) {
      setLocal(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  const commit = () => {
    const trimmed = local.trim();
    // Empty field = use default downstream (server falls back to
    // deriveDefaultFrontText when state.front.text is absent), so we
    // deliberately keep state.front.text undefined for empty input.
    if (!trimmed) {
      if (state.front?.text !== undefined) {
        onChange({ front: { ...state.front, text: undefined } });
      }
      return;
    }
    if (trimmed !== stored) {
      onChange({ front: { ...state.front, text: trimmed } });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <Label htmlFor="front-text" className="sr-only">
          Front text
        </Label>
        <p className="text-sm text-stone-600 mb-2">
          A short line that sits with the scene — sometimes folded in,
          sometimes set above. Keep it brief; a few words read best.
        </p>
        <Input
          ref={inputRef}
          id="front-text"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          placeholder={defaultText || 'Happy Birthday'}
          className="text-base border-brand-light focus-visible:border-brand focus-visible:ring-brand/20"
          data-testid="input-front-text"
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-[11px] text-stone-400">
            {local.length > 0
              ? `${local.length} characters`
              : "Leave it blank if you'd rather the scene speak for itself."}
          </p>
        </div>
        <p className="text-[11px] text-stone-500 mt-2 italic">
          e.g. <span className="text-stone-700">"Happy 40th, Dad"</span>
        </p>
      </div>
    </div>
  );
}

/** Is the Front step complete enough to move on? Always yes — empty
 *  is valid (no text rendered) and a pre-filled default covers the
 *  common case. The user never gets blocked here. */
export function isFrontStepReady(_state: CardDraftState): boolean {
  return true;
}
