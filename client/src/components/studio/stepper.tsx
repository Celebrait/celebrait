// client/src/components/studio/stepper.tsx
//
// Progress stepper for the Studio card maker. Visualises the six
// steps, shows which is current, and lets the user click any earlier
// step to jump back. Earlier = any step they've already passed.

import { Check } from 'lucide-react';
import { CARD_MAKER_STEPS } from '@shared/schema';

interface StepperProps {
  currentStep: number;
  /** Highest step index the user has reached — earlier ones can be clicked. */
  furthestStep: number;
  onStepClick: (step: number) => void;
}

// The Inside step left the linear walk 2026-07-07 (the message is now
// written AFTER the front reveal — see the front-first re-sequence in
// review-step.tsx). Its chip is hidden and the displayed numbers are
// renumbered, but TRUE step indexes are preserved for clicks/highlights
// so nothing else re-indexes (re-indexing has caused two prod bugs).
const VISIBLE_STEPS = CARD_MAKER_STEPS.map((s, index) => ({ ...s, index })).filter(
  (s) => s.id !== 'inside',
);

export function Stepper({ currentStep, furthestStep, onStepClick }: StepperProps) {
  return (
    <div
      className="flex items-center gap-1 sm:gap-2 w-full"
      role="tablist"
      aria-label="Card maker steps"
    >
      {VISIBLE_STEPS.map((s, pos) => {
        const isCurrent = s.index === currentStep;
        const isDone = s.index < furthestStep;
        const canJump = s.index <= furthestStep;
        return (
          <div key={s.id} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => canJump && onStepClick(s.index)}
              disabled={!canJump}
              aria-current={isCurrent ? 'step' : undefined}
              className={`group flex items-center gap-2 min-w-0 text-left ${
                canJump ? 'cursor-pointer' : 'cursor-default'
              }`}
              data-testid={`step-${s.id}`}
            >
              <span
                className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs font-semibold shrink-0 transition-colors shadow-sm ${
                  isCurrent
                    ? 'bg-brand text-brand-foreground ring-2 ring-brand-light'
                    : isDone
                      ? 'bg-cta text-cta-foreground'
                      : 'bg-stone-100 text-keeper-meta shadow-none'
                }`}
              >
                {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : pos + 1}
              </span>
              <span
                className={`hidden md:inline text-xs sm:text-sm truncate transition-colors ${
                  isCurrent
                    ? 'text-keeper-ink font-semibold'
                    : isDone
                      ? 'text-cta-hover'
                      : 'text-keeper-meta'
                }`}
              >
                {s.label}
              </span>
            </button>
            {/* Connector line — not after the last step */}
            {pos < VISIBLE_STEPS.length - 1 && (
              <span
                className={`flex-1 h-px rounded-full transition-colors ${
                  isDone ? 'bg-cta' : 'bg-keeper-hair'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
