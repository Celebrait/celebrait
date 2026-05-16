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

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { FileText, PenLine, Check, User, AlignLeft, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { InsideTextHelperDrawer } from '@/components/studio/inside-text-helper-drawer';
import type { CardDraftState } from '@shared/schema';

const MESSAGE_AUTOSAVE_MS = 1000;

interface InsideStepProps {
  /** Card ID — needed by the "Help me write this" drawer to fetch
   *  context-grounded suggestions from /api/studio/inside-text/suggest. */
  cardId: number;
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
  /** Hook-provided debounced save. Used only by the message textarea. */
  scheduleSave: (delayMs: number) => void;
  /** Hook-provided flush. Called on blur of keystroke-autosaved fields
   *  so the latest value is committed before the user moves on. */
  flushSave: () => Promise<void>;
}

export function InsideStep({ cardId, state, onChange, scheduleSave, flushSave }: InsideStepProps) {
  const mode = state.inside?.mode;
  // Write is the implicit default (~everyone types a message). Undefined
  // mode is treated as Write for display so the happy path is one click
  // shorter — tiles are visible for the decision, but the write form is
  // already there. Blank is an explicit opt-in.
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
    <div className="max-w-2xl mx-auto space-y-4">
      <p className="text-sm text-stone-600">
        We'll set it in a style that matches the card.
      </p>

      {isBlank ? (
        <BlankPanel onUndo={switchToWrite} />
      ) : (
        <>
          <WriteFields
            cardId={cardId}
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

// ── Leave-blank escape hatch ─────────────────────────────────────────
// Secondary path below the write form. Visually subordinate (dashed
// border, no fill) so Write reads as the default and Blank as the
// opt-out — matches the actual usage frequency.
function LeaveBlankCard({ onPick }: { onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="w-full text-left p-4 rounded-xl border border-dashed border-stone-300 hover:border-brand hover:bg-brand-muted/40 transition-colors flex items-start gap-3"
      data-testid="inside-leave-blank"
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-muted text-brand shrink-0">
        <FileText className="w-4 h-4" strokeWidth={1.75} />
      </span>
      <div>
        <div className="text-sm font-medium text-ink">
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
        <div className="w-8 h-8 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0 shadow-sm">
          <Check className="w-4 h-4" strokeWidth={3} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            We'll leave the inside blank
          </p>
          <p className="text-xs text-stone-600 mt-0.5">
            We'll design a decorative border that matches your card's
            style. The centre stays clean for you to handwrite your
            message after it arrives.
          </p>
          <p className="text-[11px] text-stone-500 mt-2 italic">
            Best for printed cards — there's no message for a digital
            recipient to read.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand-dark underline underline-offset-2"
        data-testid="inside-back-to-writing"
      >
        <PenLine className="w-3 h-3" />
        Actually, I'll write a message
      </button>
    </div>
  );
}

// ── Write-mode fields (default view) ─────────────────────────────────
function WriteFields({
  cardId,
  state,
  onChange,
  scheduleSave,
  flushSave,
}: {
  cardId: number;
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
  scheduleSave: (delayMs: number) => void;
  flushSave: () => Promise<void>;
}) {
  const write = state.inside?.write ?? {};
  // Name-weave into placeholders so the user sees "Dear Dad," not
  // "Dear Mum," when the recipient is Dad. Sign-off stays abstract
  // ("Love, your name") because we don't know the sender's name.
  const recipientName = state.recipient?.name?.trim();
  const salutationPlaceholder = recipientName
    ? `Dear ${recipientName},`
    : 'Dear …,';
  const messagePlaceholder = recipientName
    ? `Write what you'd like ${recipientName} to read…`
    : "Write what you'd like them to read…";

  // Local mirrors so typing doesn't round-trip through the parent on
  // every keystroke. The hook owns the canonical state; these just buffer.
  const [salutation, setSalutation] = useState(write.salutation ?? '');
  const [message, setMessage] = useState(write.message ?? '');
  const [signoff, setSignoff] = useState(write.signoff ?? '');

  // "Help me write this" drawer — context-grounded message suggestions.
  // Opens via the small CTA under the Message field.
  const [helperOpen, setHelperOpen] = useState(false);

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
    // Three co-equal cards (same treatment as Review summary rows).
    // Icons carry the role differentiation (User / AlignLeft / PenLine);
    // containers carry the visual separation. No hero field — with the
    // containers in place the Message no longer needs size emphasis.
    <div className="space-y-3" data-testid="inside-write-form">
      <FieldCard icon={User} label="Greeting" htmlFor="inside-salutation" optional>
        <Input
          id="inside-salutation"
          value={salutation}
          onChange={(e) => setSalutation(e.target.value)}
          onBlur={() => {
            if (salutation !== (write.salutation ?? '')) {
              commit({ salutation });
            }
          }}
          placeholder={salutationPlaceholder}
          className="bg-white border-brand-light focus-visible:border-brand focus-visible:ring-brand/20"
          data-testid="input-inside-salutation"
        />
      </FieldCard>

      <FieldCard icon={AlignLeft} label="Message" htmlFor="inside-message">
        <Textarea
          id="inside-message"
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onBlur={() => {
            // Flush any pending debounced save so the latest value is
            // on the server before the user navigates away.
            void flushSave();
          }}
          placeholder={messagePlaceholder}
          rows={6}
          className="bg-white leading-relaxed resize-none border-brand-light focus-visible:border-brand focus-visible:ring-brand/20"
          data-testid="input-inside-message"
        />
        {/* "Help me write this" — opens a drawer with three LLM
            suggestions grounded in the card's full context (recipient,
            occasion, scene, photo summaries, style). Sized as a quiet
            secondary action — the message field is the hero, this is
            the safety net for writer's block. */}
        <div className="mt-2.5 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setHelperOpen(true)}
            className="inline-flex items-center gap-1.5 text-brand hover:text-brand-dark transition-colors font-medium"
            data-testid="btn-inside-helper-open"
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            Help me write this
          </button>
          <span className="text-stone-400">
            We'll use your scene + occasion to ground the suggestions.
          </span>
        </div>
      </FieldCard>

      <FieldCard icon={PenLine} label="Sign-off" htmlFor="inside-signoff" optional>
        <Input
          id="inside-signoff"
          value={signoff}
          onChange={(e) => setSignoff(e.target.value)}
          onBlur={() => {
            if (signoff !== (write.signoff ?? '')) {
              commit({ signoff });
            }
          }}
          placeholder="Love, your name"
          className="bg-white border-brand-light focus-visible:border-brand focus-visible:ring-brand/20"
          data-testid="input-inside-signoff"
        />
      </FieldCard>

      {/* Help-me-write drawer. Stays mounted at the WriteFields level so
          its internal state (loaded suggestions, draft buffer, tone
          narrowing) persists across opens within one editing session.
          Picking a suggestion routes through the same onMessageChange
          path as a keystroke — autosaves the same way. */}
      <InsideTextHelperDrawer
        open={helperOpen}
        onOpenChange={setHelperOpen}
        cardId={cardId}
        currentText={message}
        onAccept={(text) => {
          onMessageChange(text);
          // Also flush immediately — the user just made an explicit
          // commit by picking the suggestion; no need to wait the
          // debounce timer out.
          void flushSave();
        }}
      />
    </div>
  );
}

// ── Field card wrapper ──────────────────────────────────────────────
// Same shell for Greeting / Message / Sign-off so they read as three
// co-equal beats. Icon + label up top, input below. Matches the Review
// summary-row container style so the Studio feels like a single family.
function FieldCard({
  icon: Icon,
  label,
  htmlFor,
  optional = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 shadow-sm">
      <Label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-sm text-ink mb-2"
      >
        <Icon className="w-4 h-4 text-brand" strokeWidth={1.75} aria-hidden="true" />
        {label}
        {optional && (
          <span className="ml-1 text-xs text-stone-400 font-normal">optional</span>
        )}
      </Label>
      {children}
    </div>
  );
}


/** Is the Inside step complete? Blank mode is ready immediately. Write
 *  mode (explicit or implicit — undefined is treated as write since the
 *  form is pre-revealed) is ready once the message textarea has content. */
export function isInsideStepReady(state: CardDraftState): boolean {
  if (state.inside?.mode === 'blank') return true;
  return (state.inside?.write?.message?.trim().length ?? 0) > 0;
}
