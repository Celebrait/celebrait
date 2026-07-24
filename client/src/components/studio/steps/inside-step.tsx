// client/src/components/studio/steps/inside-step.tsx
//
// Step: what goes inside the card. V1 = pure write-it-yourself.
//
// History: between 2026-05-15 and 2026-05-17 this step grew an
// AI inside-text rewriter (per-field "make it funny / heartfelt /
// ..." chips) and a macro composer drawer that generated the whole
// inside from a brief. Both shipped, both worked, both were pulled
// from the V1 surface on 2026-05-17 to land under the upcoming
// Celebrait Premium subscription tier — see
// `next_celebrait_premium.md`. The implementation is preserved in
// git (composer drawer + endpoint files still in the repo, route
// registration unmounted) so reviving for Premium is a small
// surgery, not a rebuild.
//
// What ships in V1:
//   • Three input boxes — Greeting (optional), Message, Sign-off
//     (optional). All persist into state.inside.write.{salutation,
//     message, signoff}.
//   • "Leave blank instead" escape hatch — for buyers who'll
//     handwrite the message after the card arrives. Mode = 'blank'.
//
// What's intentionally absent in V1:
//   • Per-field vibe chips (rewriter)
//   • Pre-question "self vs helped" path picker
//   • Macro composer drawer
//   • Any AI affordances at all on this step.
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
import { FileText, PenLine, Check, User, AlignLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StepExample, ExampleCardDialog } from '@/components/studio/step-example';
import type { CardDraftState } from '@shared/schema';

const MESSAGE_AUTOSAVE_MS = 1000;

interface InsideStepProps {
  /** Card ID — kept for API consistency with other steps that need it
   *  for autosave / generation calls. V1 inside step doesn't itself
   *  use it (no AI affordances), but the wizard passes it uniformly. */
  cardId: number;
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
  /** Hook-provided debounced save. Used only by the message textarea. */
  scheduleSave: (delayMs: number) => void;
  /** Hook-provided flush. Called on blur of keystroke-autosaved fields
   *  so the latest value is committed before the user moves on. */
  flushSave: () => Promise<void>;
}

export function InsideStep({ cardId: _cardId, state, onChange, scheduleSave, flushSave }: InsideStepProps) {
  // Three display states, driven by inside.mode:
  //   undefined → the fork picker (write your message / leave it blank).
  //               This is the deliberate opening choice — blank is no
  //               longer a footnote escape hatch, it's a first-class
  //               path the Giving Moment celebrates (handwrite it
  //               yourself). See next_delivery_destination_usp.md.
  //   'write'   → the three-input form.
  //   'blank'   → the blank-confirmation panel.
  // Once a fork is picked, each panel carries its own switch-back
  // affordance so the user can change their mind without hunting.
  const mode = state.inside?.mode;

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
      {mode === 'write' && (
        <div>
          {/* House-style example — one tap to see how a finished inside
              reads. Same open-card thumbnail used across the steps. */}
          <StepExample
            eyebrow="Inside Text Example"
            assist="Not sure what to write?"
            modalTitle="Inside text example"
            modalDescription="Your greeting, message and sign-off are set in type chosen to match the front, so the whole card feels like one piece. A line or two is plenty — warmth lands harder than length."
            show="inside"
          />
        </div>
      )}

      {mode === 'blank' ? (
        <BlankPanel onUndo={switchToWrite} />
      ) : mode === 'write' ? (
        <>
          <WriteFields
            state={state}
            onChange={onChange}
            scheduleSave={scheduleSave}
            flushSave={flushSave}
          />
          <LeaveBlankCard onPick={switchToBlank} />
        </>
      ) : (
        <InsideForkPicker onWrite={switchToWrite} onBlank={switchToBlank} />
      )}
    </div>
  );
}

// ── Fork picker (the opening state of the step) ──────────────────────
// Two co-equal choices. Deliberately NOT defaulting into the form —
// "leave it blank to handwrite yourself" is a real, dignified path now
// that the Giving Moment treats it as a USP, so the user makes a clear
// choice rather than discovering blank as a footnote under the form.
function InsideForkPicker({
  onWrite,
  onBlank,
}: {
  onWrite: () => void;
  onBlank: () => void;
}) {
  // 3D example dialogs — one per fork card ("see an example" links).
  const [exampleOpen, setExampleOpen] = useState(false);
  const [blankExampleOpen, setBlankExampleOpen] = useState(false);
  return (
    <div className="space-y-3" data-testid="inside-fork-picker">
      {/* One framing line only — the wrapper above ("Now, the inside")
          already sets context; the two cards carry the choice. Kevin
          2026-07-09: the fork screen was overwhelming on mobile (three
          restatements of "we match the front" + a second heading). */}
      <p className="text-sm text-keeper-body">
        A soppy essay, a heartfelt message, a snappy one-liner. Tell them how
        you feel and we'll design the inside to match the front of the card.
        Rather write it yourself? All good — it'll still look the part.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ForkCard
          icon={PenLine}
          title="We print your message"
          body="Type it now and we set your words into the design, matched to the front."
          hint="Best if it's posting straight to them — arrives ready to read."
          onClick={onWrite}
          testid="inside-fork-write"
          highlighted
          exampleSlot={
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExampleOpen(true);
              }}
              className="mt-1 self-start text-xs font-medium text-brand underline underline-offset-2 hover:text-brand-dark"
              data-testid="inside-fork-write-example"
            >
              See an example →
            </button>
          }
        />
        <ForkCard
          icon={FileText}
          title="You handwrite it later"
          body="We print a decorative border and leave the centre clear for your own hand."
          hint="Best if the card's coming to you first."
          onClick={onBlank}
          testid="inside-fork-blank"
          exampleSlot={
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setBlankExampleOpen(true);
              }}
              className="mt-1 self-start text-xs font-medium text-brand underline underline-offset-2 hover:text-brand-dark"
              data-testid="inside-fork-blank-example"
            >
              See an example →
            </button>
          }
        />
      </div>
      <ExampleCardDialog
        open={exampleOpen}
        onOpenChange={setExampleOpen}
        eyebrow="Printed Message Example"
        modalTitle="Inside message example"
        modalDescription="Your greeting, message and sign-off are set in type chosen to match the front, so the whole card feels like one piece."
        show="inside"
      />
      {/* Blank/handwrite example. TODO(asset): swap to a dedicated
          blank-inside render (decorative border, clear centre) once one
          exists — for now it reuses the inside example and the copy makes
          clear the handwrite version keeps the middle open. */}
      <ExampleCardDialog
        open={blankExampleOpen}
        onOpenChange={setBlankExampleOpen}
        eyebrow="Handwrite Example"
        modalTitle="Blank inside example"
        modalDescription="We design a decorative border to match your front and leave the centre clear — you fill it in your own hand when the card arrives. (The styling echoes the house look shown here.)"
        show="inside"
      />
    </div>
  );
}

function ForkCard({
  icon: Icon,
  title,
  body,
  hint,
  onClick,
  testid,
  highlighted = false,
  exampleSlot,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  /** "Best for…" delivery-mode nudge (Kevin 2026-07-07): printed
   *  message pairs with posting direct; blank pairs with
   *  receive-write-hand-over. */
  hint?: string;
  onClick: () => void;
  testid: string;
  highlighted?: boolean;
  /** Optional extra control (e.g. a "see an example" link). Rendered
   *  INSIDE the card, so the card itself is a div-with-role rather
   *  than a <button> — nested buttons are invalid HTML. */
  exampleSlot?: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`cursor-pointer text-left p-4 rounded-2xl border transition-all flex flex-col gap-1.5 ${
        highlighted
          ? 'border-brand bg-brand-muted/40 hover:bg-brand-muted/60 hover:shadow-sm'
          : 'border-keeper-hair bg-white hover:border-brand/40 hover:bg-stone-50 hover:shadow-sm'
      }`}
      data-testid={testid}
    >
      <span
        className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
          highlighted ? 'bg-brand text-white' : 'bg-brand-muted text-brand-dark'
        }`}
      >
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </span>
      <div className="text-sm font-semibold text-keeper-ink">{title}</div>
      <p className="text-xs text-keeper-body leading-relaxed">{body}</p>
      {hint && (
        <p className="text-[11px] leading-relaxed text-keeper-meta border-t border-keeper-hair/70 pt-2 mt-0.5">
          {hint}
        </p>
      )}
      {exampleSlot}
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
        <div className="text-sm font-medium text-keeper-ink">
          Leave blank instead
        </div>
        <p className="text-xs text-keeper-meta mt-0.5">
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
          <p className="text-sm font-semibold text-keeper-ink">
            We'll leave the inside blank
          </p>
          <p className="text-xs text-keeper-body mt-0.5">
            We'll design a decorative border that matches your card's
            style. The centre stays clean for you to handwrite your
            message after it arrives.
          </p>
          <p className="text-[11px] text-keeper-meta mt-2 italic">
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
// Pure form: three input boxes, no AI affordances. Greeting + sign-off
// are optional; only the Message field gates step readiness.
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
    <div className="bg-white border border-keeper-hair rounded-xl p-4 sm:p-5 shadow-sm">
      <Label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-sm text-keeper-ink mb-2"
      >
        <Icon className="w-4 h-4 text-brand" strokeWidth={1.75} aria-hidden="true" />
        {label}
        {optional && (
          <span className="ml-1 text-xs text-keeper-meta font-normal">optional</span>
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
