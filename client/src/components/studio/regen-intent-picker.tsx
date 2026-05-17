// client/src/components/studio/regen-intent-picker.tsx
//
// First screen of the regen flow. Replaces the previous "everything on
// one screen" RegenEditMode entry — instead of dropping the user into
// a multi-control surface (photo pill + style pill + target selector +
// textareas), we ask one focused question:
//
//   "What would you like to change?"
//
// Three options. Each routes to a contextual surface that shows ONLY
// the relevant control. Plus a quiet "Start over" outbound link for
// users who want to abandon this card and make a different one
// (previously buried — required exiting regen, exiting card, hunting
// for the New card button).
//
// Re-roll (re-run with no inputs changed) was deliberately NOT
// included as an option (Kevin's call 2026-05-10): regens should be
// intentional, not dice rolls. If a user wants variety they can edit
// the scene with a small tweak.
//
// This is the picker. The contextual surfaces (Scene / Photo / Style)
// live as inline branches inside RegenEditMode (router pattern), each
// rendering one of the existing input controls + a Make new version
// button + a "← Change something else" affordance back to here.

import { Link } from 'wouter';
import { Pencil, Image as ImageIcon, ChevronRight, ArrowLeft } from 'lucide-react';

// 'style' was a third intent (Try a different style) — REMOVED 2026-05-17
// when the style picker was parked for Celebrait Premium. See
// next_celebrait_premium.md. Revive when Premium ships.
export type RegenIntent = 'scene' | 'photo';

interface RegenIntentPickerProps {
  /** Headline subject — typically "<Recipient>'s <occasion> card". */
  subjectLabel: string;
  /** User picked an intent — parent routes to the matching surface. */
  onPick: (intent: RegenIntent) => void;
  /** Exit regen entirely; back to the reveal layout (card view). */
  onExit: () => void;
}

interface IntentOption {
  intent: RegenIntent;
  icon: typeof Pencil;
  label: string;
  description: string;
}

const OPTIONS: IntentOption[] = [
  {
    intent: 'scene',
    icon: Pencil,
    label: 'Edit the scene',
    description: 'Tweak the front or inside — refine the moment, the vibe, the details.',
  },
  {
    intent: 'photo',
    icon: ImageIcon,
    label: 'Change the photo',
    description: 'Swap the reference image — fix likeness or try a different angle.',
  },
  // 'Try a different style' option REMOVED 2026-05-17 — style picker
  // parked for Premium. See next_celebrait_premium.md.
];

export function RegenIntentPicker({
  subjectLabel,
  onPick,
  onExit,
}: RegenIntentPickerProps) {
  return (
    <div data-testid="regen-intent-picker">
      {/* Header — same shape as RegenEditMode's so the entry feels
          like a continuation of the regen surface, not a different
          screen. */}
      <div className="flex items-start justify-between gap-3 py-4 mb-1">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-ink leading-tight">
            Tweak your card
          </h1>
          <p className="text-xs text-stone-500 truncate mt-0.5">
            {subjectLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-ink transition-colors shrink-0 pt-1"
          data-testid="btn-regen-exit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to your card</span>
          <span className="sm:hidden">Back</span>
        </button>
      </div>

      {/* The question */}
      <p className="text-sm text-ink-soft mb-5">
        What would you like to change?
      </p>

      {/* Intent cards — single-select. Each routes to a focused
          contextual surface in the parent. */}
      <div className="space-y-2.5">
        {OPTIONS.map(({ intent, icon: Icon, label, description }) => (
          <button
            key={intent}
            type="button"
            onClick={() => onPick(intent)}
            className="group w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white border border-stone-200 hover:border-brand/50 hover:bg-brand/5 transition-all"
            data-testid={`regen-intent-${intent}`}
          >
            <div className="w-11 h-11 rounded-lg bg-brand-muted/40 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-brand" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{label}</p>
              <p className="text-xs text-ink-soft mt-0.5 leading-snug">
                {description}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brand transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Start over outbound — quiet, intentional. For users who want
          to abandon this card and make a different one. Was previously
          buried in the navigation; surfacing it here as a recognised
          intent (not a regen action). */}
      <div className="mt-6 pt-4 border-t border-stone-200">
        <p className="text-xs text-ink-soft">
          Want a different card altogether?{' '}
          <Link
            href="/studio/new-card"
            className="text-brand hover:text-brand-dark font-medium"
            data-testid="regen-start-over"
          >
            Start over →
          </Link>
        </p>
      </div>
    </div>
  );
}
