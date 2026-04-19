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
  // on blur. If the user hasn't typed anything yet, we seed the input
  // with the derived default so they can confirm-and-continue.
  const stored = state.front?.text;
  const seedValue = stored ?? defaultText;
  const [local, setLocal] = useState(seedValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // External change (recipient/occasion edited on an earlier step)
    // should refresh the default until the user has typed their own.
    if (stored === undefined && defaultText !== local) {
      setLocal(defaultText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultText]);

  const commit = () => {
    const trimmed = local.trim();
    // Treat "same as default" as "no override" — keep state.front.text
    // absent so future recipient/occasion edits flow through cleanly.
    if (!trimmed || trimmed === defaultText) {
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
          The headline printed on the front. A few words work best.
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
              : "Leave it blank if you'd rather no text on the front."}
          </p>
        </div>
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
