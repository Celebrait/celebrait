// client/src/components/studio/steps/inside-step.tsx
//
// Step 5: what goes inside the card.
//
// UX is form-first: the write-your-own fields are the default view of
// the step, because ~everyone types a message. "Leave blank" is an
// escape hatch surfaced beneath the form, not a co-equal toggle at
// the top. There is no "let AI write your message" path — the
// emotional core of a greeting card is the personal message, and
// we'd rather the card be blank for a handwritten note than have
// the AI fake one.
//
// Data model keeps two explicit modes ('write' | 'blank'). On this
// step mode defaults to 'write' lazily — i.e. typing into the form
// commits mode='write' to the draft. Clicking the Leave blank card
// switches to mode='blank' and hides the form. The typed message is
// preserved across the detour so the user doesn't lose work.
//
// Inputs are plain sans — NOT a handwriting font. The AI renders the
// inside message as typography that matches the card's visual style;
// styling the input boxes as handwriting would mis-set that expectation.
//
// The message textarea is the only field in the whole maker with
// keystroke-level autosave (1s debounced via the hook's scheduleSave).
// Salutation + sign-off save on blur like every other field.

import { useEffect, useRef, useState } from 'react';
import { FileText, Pencil, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CardDraftState } from '@shared/schema';

const MESSAGE_AUTOSAVE_MS = 1000;

interface InsideStepProps {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
  /** Hook-provided debounced save. Used only by the message textarea. */
  scheduleSave: (delayMs: number) => void;
  /** Hook-provided flush. Called on blur of keystroke-autosaved fields
   *  so the latest value is committed before the user moves on. */
  flushSave: () => Promise<void>;
}

export function InsideStep({ state, onChange, scheduleSave, flushSave }: InsideStepProps) {
  const mode = state.inside?.mode;
  const isBlank = mode === 'blank';

  const switchToBlank = () => {
    onChange({
      inside: {
        ...state.inside,
        mode: 'blank',
      },
    });
  };

  const switchToWrite = () => {
    onChange({
      inside: {
        ...state.inside,
        mode: 'write',
      },
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-stone-600 mb-1">
          Your message
        </p>
        <p className="text-xs text-stone-500">
          We'll render this in a style that matches your card.
        </p>
      </div>

      {isBlank ? (
        <BlankPanel onUndo={switchToWrite} />
      ) : (
        <>
          <WriteFields
            state={state}
            onChange={onChange}
            scheduleSave={scheduleSave}
            flushSave={flushSave}
          />
          <LeaveBlankCard onPick={switchToBlank} />
        </>
      )}
    </div>
  );
}

// ── Write-mode fields (default view) ─────────────────────────────────
function WriteFields({
  state,
  onChange,
  scheduleSave,
  flushSave,
}: {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
  scheduleSave: (delayMs: number) => void;
  flushSave: () => Promise<void>;
}) {
  const write = state.inside?.write ?? {};

  // Local mirrors so typing doesn't round-trip through the parent on
  // every keystroke. The hook owns the canonical state; these just buffer.
  const [salutation, setSalutation] = useState(write.salutation ?? '');
  const [message, setMessage] = useState(write.message ?? '');
  const [signoff, setSignoff] = useState(write.signoff ?? '');

  // Keep the latest values in a ref so the debounced save can read them
  // without re-subscribing to state. (stateRef-style fresh-closure trick.)
  const writeRef = useRef({ salutation, message, signoff });
  useEffect(() => {
    writeRef.current = { salutation, message, signoff };
  }, [salutation, message, signoff]);

  // Commit a partial write update into the parent's inside.write object,
  // preserving any fields that aren't changing here. Also promotes mode
  // to 'write' — typing is the implicit opt-in to write mode.
  const commit = (next: Partial<NonNullable<CardDraftState['inside']>['write']>) => {
    onChange({
      inside: {
        ...state.inside,
        mode: 'write',
        write: {
          ...write,
          ...next,
        },
      },
    });
  };

  // Message keystroke-autosave. Every keystroke restarts a 1s timer;
  // the last value wins. We update local state + parent state at the
  // same time so the parent's stateRef has the fresh value when the
  // debounced save fires (otherwise scheduleSave would persist stale).
  const onMessageChange = (next: string) => {
    setMessage(next);
    onChange({
      inside: {
        ...state.inside,
        mode: 'write',
        write: {
          ...write,
          message: next,
        },
      },
    });
    scheduleSave(MESSAGE_AUTOSAVE_MS);
  };

  return (
    <div className="space-y-5" data-testid="inside-write-form">
      {/* Salutation */}
      <div className="space-y-1.5">
        <Label htmlFor="inside-salutation" className="text-xs text-stone-500">
          Greeting
          <span className="ml-2 text-stone-400 font-normal">optional</span>
        </Label>
        <Input
          id="inside-salutation"
          value={salutation}
          onChange={(e) => setSalutation(e.target.value)}
          onBlur={() => {
            if (salutation !== (write.salutation ?? '')) {
              commit({ salutation });
            }
          }}
          placeholder="Dear Mum,"
          className="bg-white"
          data-testid="input-inside-salutation"
        />
      </div>

      {/* Main message — the only field with keystroke autosave */}
      <div className="space-y-1.5">
        <Label htmlFor="inside-message" className="text-xs text-stone-500">
          Message
        </Label>
        <Textarea
          id="inside-message"
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onBlur={() => {
            // Flush any pending debounced save so the latest value is
            // on the server before the user navigates away.
            void flushSave();
          }}
          placeholder="Write whatever you'd like them to read…"
          rows={6}
          className="bg-white leading-relaxed resize-none"
          data-testid="input-inside-message"
        />
      </div>

      {/* Sign-off */}
      <div className="space-y-1.5">
        <Label htmlFor="inside-signoff" className="text-xs text-stone-500">
          Sign-off
          <span className="ml-2 text-stone-400 font-normal">optional</span>
        </Label>
        <Input
          id="inside-signoff"
          value={signoff}
          onChange={(e) => setSignoff(e.target.value)}
          onBlur={() => {
            if (signoff !== (write.signoff ?? '')) {
              commit({ signoff });
            }
          }}
          placeholder="Love, Sarah"
          className="bg-white"
          data-testid="input-inside-signoff"
        />
      </div>
    </div>
  );
}

// ── Leave-blank escape hatch ─────────────────────────────────────────
// A single low-emphasis card below the form. Visually subordinate to
// the write fields but still discoverable for customers who want the
// handwritten moment.
function LeaveBlankCard({ onPick }: { onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="w-full text-left p-4 rounded-xl border border-dashed border-stone-300 hover:border-stone-400 hover:bg-stone-50 transition-colors flex items-start gap-3"
      data-testid="inside-leave-blank"
    >
      <FileText className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
      <div>
        <div className="text-sm font-medium text-stone-800">
          Leave blank instead
        </div>
        <p className="text-xs text-stone-500 mt-0.5">
          We'll design a decorative border only — you handwrite the
          message after it arrives.
        </p>
      </div>
    </button>
  );
}

// ── Blank-mode panel (replaces the form when picked) ─────────────────
function BlankPanel({ onUndo }: { onUndo: () => void }) {
  return (
    <div
      className="bg-brand-muted border-2 border-brand rounded-2xl p-6"
      data-testid="inside-blank-panel"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0">
          <Check className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-dark">
            The inside will be blank
          </p>
          <p className="text-xs text-brand-dark/80 mt-0.5">
            We'll design a decorative border that matches your card's
            style. The centre stays clean for you to handwrite your
            message after it arrives.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex items-center gap-1.5 text-xs text-brand-dark hover:text-brand underline underline-offset-2"
        data-testid="inside-back-to-writing"
      >
        <Pencil className="w-3 h-3" />
        Actually, I'll write a message
      </button>
    </div>
  );
}

/** Is the Inside step complete? Ready if the user has explicitly chosen
 *  blank, or has typed a non-empty message (implicit write mode). */
export function isInsideStepReady(state: CardDraftState): boolean {
  if (state.inside?.mode === 'blank') return true;
  return (state.inside?.write?.message?.trim().length ?? 0) > 0;
}
