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

export function Stepper({ currentStep, furthestStep, onStepClick }: StepperProps) {
  return (
    <div
      className="flex items-center gap-1 sm:gap-2 w-full"
      role="tablist"
      aria-label="Card maker steps"
    >
      {CARD_MAKER_STEPS.map((s, i) => {
        const isCurrent = i === currentStep;
        const isDone = i < furthestStep;
        const canJump = i <= furthestStep;
        return (
          <div key={s.id} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => canJump && onStepClick(i)}
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
                      : 'bg-stone-100 text-stone-400 shadow-none'
                }`}
              >
                {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`hidden md:inline text-xs sm:text-sm truncate transition-colors ${
                  isCurrent
                    ? 'text-ink font-semibold'
                    : isDone
                      ? 'text-cta-hover'
                      : 'text-stone-400'
                }`}
              >
                {s.label}
              </span>
            </button>
            {/* Connector line — not after the last step */}
            {i < CARD_MAKER_STEPS.length - 1 && (
              <span
                className={`flex-1 h-px rounded-full transition-colors ${
                  isDone ? 'bg-cta' : 'bg-stone-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
