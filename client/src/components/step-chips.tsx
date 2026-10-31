// client/src/components/step-chips.tsx — the public makers' progress
//
// The same chip row on /photo/make and /make (Aidan 2026-09-06: "3 photo
// route should have similar progress as photo upload"). Done steps are
// tappable to go back; the last step is the locked finale.

import { Lock } from 'lucide-react';

export interface StepChip {
  id: string;
  label: string;
  /** The finale — drawn with a lock instead of a number, never tappable. */
  locked?: boolean;
}

export function StepChips({ steps, current, furthest, onJump }: {
  steps: StepChip[];
  current: number;
  furthest: number;
  onJump: (i: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Steps">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= furthest && !s.locked;
        return (
          <li key={s.id}>
            <button
              type="button"
              disabled={!reachable}
              aria-current={active ? 'step' : undefined}
              aria-label={s.label}
              onClick={() => reachable && onJump(i)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                active ? 'border-brand bg-brand text-white'
                : done ? 'border-brand-light bg-brand-muted text-keeper-ink hover:border-brand'
                : 'border-keeper-hair bg-white text-keeper-meta'
              } disabled:cursor-default`}
            >
              {s.locked ? <Lock className="h-3 w-3" /> : <span className="text-[11px] opacity-70">{i + 1}</span>}
              {/* On phones only the active chip and the finale carry a
                  word; the rest are numbers so the row stays a row. */}
              <span className={active || s.locked ? '' : 'hidden sm:inline'}>{s.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
