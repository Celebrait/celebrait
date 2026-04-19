// client/src/components/studio/steps/recipient-step.tsx
//
// Step 1: who's the card for, and what's the occasion. Drives the
// tone of every subsequent step — scene presets are occasion-specific,
// inside-message generation uses the name, etc.

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CardDraftState } from '@shared/schema';
import { OCCASION_OPTIONS, getOccasionLabel } from '../scene-presets';

interface RecipientStepProps {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
}

export function RecipientStep({ state, onChange }: RecipientStepProps) {
  // Local copy for the name field so typing doesn't fire a save per
  // keystroke. Commits on blur.
  const [localName, setLocalName] = useState(state.recipient?.name ?? '');

  const commitName = () => {
    const trimmed = localName.trim();
    if (trimmed !== (state.recipient?.name ?? '')) {
      onChange({ recipient: { ...state.recipient, name: trimmed } });
    }
  };

  const setOccasion = (occasion: string) => {
    onChange({ recipient: { ...state.recipient, occasion } });
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <p className="text-sm text-stone-600">
        Who's this card for, and what are you celebrating?
      </p>

      <div className="space-y-2">
        <Label htmlFor="recipient-name" className="text-sm">
          Their name
        </Label>
        <Input
          id="recipient-name"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={commitName}
          placeholder="e.g. Mum, Sarah, Dad"
          className="text-base"
          data-testid="input-recipient-name"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipient-occasion" className="text-sm">
          Occasion
        </Label>
        <Select value={state.recipient?.occasion ?? ''} onValueChange={setOccasion}>
          <SelectTrigger id="recipient-occasion" data-testid="select-recipient-occasion">
            <SelectValue placeholder="Choose an occasion" />
          </SelectTrigger>
          <SelectContent>
            {OCCASION_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {getOccasionLabel(o)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Is the Recipient step complete enough to move on? */
export function isRecipientStepReady(state: CardDraftState): boolean {
  const name = state.recipient?.name?.trim();
  const occasion = state.recipient?.occasion;
  return !!name && !!occasion;
}
