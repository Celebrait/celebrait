// client/src/components/studio/steps/inside-step.tsx
//
// Step 5: what goes inside the card.
//
// The step has THREE entry paths, chosen by the user via a pre-question
// at the top (added 2026-05-17 — see next_inside_text_helper_polish_rebuild.md
// + the pre-mortem conversation that led to this rebuild):
//
//   1. SELF    — "I'll write it" → reveals the 3-input form (greeting,
//                message, sign-off). Per-field vibe chips under the
//                message field offer scene-grounded rewrites for users
//                who want to polish what they wrote.
//
//   2. HELPED  — "Write it for me" → opens the macro composer drawer
//                which generates all THREE fields in one shot, grounded
//                in the card's scene + occasion + photos + optional
//                user brief. Result populates the same form, which is
//                then editable like SELF. A "Compose new version"
//                button stays visible at the top of the form so the
//                user can regenerate freely.
//
//   3. BLANK   — "Leave blank" → no inside text at all; the card
//                renders a decorative border only, for handwriting.
//
// The path choice persists into `state.inside.path` so re-entering the
// step doesn't re-ask. A small "Change approach" link in each path
// surfaces the pre-question again. Path is independent of `mode` —
// `mode` is 'write' vs 'blank' (which gates rendering), `path` is HOW
// the user got to write mode (which informs the UX surface).
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
import {
  FileText,
  PenLine,
  Check,
  User,
  AlignLeft,
  Wand2,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import {
  InsideTextHelperDrawer,
  STYLE_CHIPS,
  type RewriteStyle,
} from '@/components/studio/inside-text-helper-drawer';
import { InsideTextComposerDrawer } from '@/components/studio/inside-text-composer-drawer';
import type { CardDraftState } from '@shared/schema';

type InsidePath = NonNullable<CardDraftState['inside']>['path'];

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
  const path: InsidePath = state.inside?.path;
  const isBlank = mode === 'blank';

  const setPath = (next: InsidePath) => {
    onChange({
      inside: {
        ...state.inside,
        // Picking a path commits to write mode (the form will render).
        // Blank mode is reached via the separate Leave Blank affordance,
        // not via the pre-picker.
        mode: 'write',
        path: next,
      },
    });
  };

  const clearPath = () => {
    onChange({
      inside: {
        ...state.inside,
        path: undefined,
      },
    });
  };

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
      ) : path === undefined ? (
        // First-time entry to the step (or after Change-approach): user
        // hasn't told us how they want to handle the inside yet. Show
        // the pre-picker.
        <PrePicker
          onPickSelf={() => setPath('self')}
          onPickHelped={() => setPath('helped')}
          onPickBlank={switchToBlank}
        />
      ) : (
        // Path picked — show the form. WriteFields renders the same
        // three-input layout for both 'self' and 'helped'; only the
        // top-of-form affordances differ (a "Compose new version"
        // button appears when path === 'helped').
        <>
          <WriteFields
            cardId={cardId}
            state={state}
            onChange={onChange}
            scheduleSave={scheduleSave}
            flushSave={flushSave}
            path={path}
            onChangeApproach={clearPath}
          />
          <LeaveBlankCard onPick={switchToBlank} />
        </>
      )}
    </div>
  );
}

// ── Pre-picker (added 2026-05-17) ────────────────────────────────────
// Two cards side-by-side asking the user how they want to handle the
// inside. Both unselected by default — forcing a deliberate choice is
// the whole point. Cost: one extra click vs the previous form-first
// approach; benefit: the user is clear about the path they're on and
// the AI affordances make sense in that context.
//
// "Leave blank" appears below as a subordinate option so a printed-card-
// only buyer doesn't have to engage with the writing tooling at all.
function PrePicker({
  onPickSelf,
  onPickHelped,
  onPickBlank,
}: {
  onPickSelf: () => void;
  onPickHelped: () => void;
  onPickBlank: () => void;
}) {
  return (
    <div className="space-y-4" data-testid="inside-pre-picker">
      <h3 className="text-base font-semibold text-ink">
        How do you want to handle the inside?
      </h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <PrePickerCard
          icon={PenLine}
          title="I'll write it"
          body="I know what I want to say. Three boxes — greeting, message, sign-off."
          ctaLabel="Write myself"
          onClick={onPickSelf}
          testid="inside-pick-self"
        />
        <PrePickerCard
          icon={Sparkles}
          title="Write it for me"
          body="Use my card's scene + occasion as inspiration. I'll edit after."
          ctaLabel="Help me"
          highlighted
          onClick={onPickHelped}
          testid="inside-pick-helped"
        />
      </div>
      {/* Leave blank stays accessible but subordinate. Dashed border +
          no fill matches the existing escape-hatch treatment. */}
      <LeaveBlankCard onPick={onPickBlank} />
    </div>
  );
}

function PrePickerCard({
  icon: Icon,
  title,
  body,
  ctaLabel,
  highlighted = false,
  onClick,
  testid,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  ctaLabel: string;
  highlighted?: boolean;
  onClick: () => void;
  testid: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-5 rounded-2xl border-2 transition-all flex flex-col gap-2 ${
        highlighted
          ? 'border-brand/60 bg-brand-muted/30 hover:border-brand hover:bg-brand-muted/50 hover:shadow-sm'
          : 'border-stone-200 bg-white hover:border-brand/40 hover:bg-stone-50 hover:shadow-sm'
      }`}
      data-testid={testid}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
            highlighted
              ? 'bg-brand text-white'
              : 'bg-brand-muted text-brand-dark'
          }`}
        >
          <Icon className="w-4 h-4" strokeWidth={1.75} />
        </span>
        <div className="text-sm font-semibold text-ink">{title}</div>
      </div>
      <p className="text-xs text-stone-600 leading-relaxed">{body}</p>
      <div
        className={`mt-1 text-xs font-medium ${
          highlighted ? 'text-brand-dark' : 'text-stone-700'
        }`}
      >
        {ctaLabel} →
      </div>
    </button>
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

// ── Write-mode fields ────────────────────────────────────────────────
// Renders the three-input form. Same layout for both 'self' and
// 'helped' paths — only the top-of-form affordances differ. The
// macro composer drawer is mounted here (same scope as the field
// state-setters so accept can fill all three fields).
function WriteFields({
  cardId,
  state,
  onChange,
  scheduleSave,
  flushSave,
  path,
  onChangeApproach,
}: {
  cardId: number;
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
  scheduleSave: (delayMs: number) => void;
  flushSave: () => Promise<void>;
  /** Which pre-question path we got here via. Drives the top-of-form
   *  "Compose new version" button visibility. */
  path: NonNullable<NonNullable<CardDraftState['inside']>['path']>;
  /** Called when the user wants to re-open the pre-question. Clears
   *  state.inside.path; the parent's switch falls back to PrePicker. */
  onChangeApproach: () => void;
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

  // Style-transform rewriter drawer.
  //
  // Mental model: under the Message textarea sits a row of small "vibe"
  // chips (funny / a poem / heartfelt / brief / sweet). Clicking one
  // opens the drawer in that style and immediately fires a rewrite of
  // the user's draft, grounded in the card's scene + occasion + photos.
  // The drawer's job is one rewrite at a time — accept it, try the
  // same style again for a different angle, or pick another vibe.
  //
  // `activeStyle` doubles as the open/closed flag: non-null = drawer
  // open with that style; null = drawer closed.
  const [activeStyle, setActiveStyle] = useState<RewriteStyle | null>(null);
  /** Macro composer drawer open flag. Local state — not persisted.
   *  Auto-opens once on first mount when the user just picked the
   *  'helped' path and there's nothing in any of the three fields. */
  const [composerOpen, setComposerOpen] = useState(false);
  const { toast } = useToast();
  const messageHasContent = message.trim().length >= 3;
  const allFieldsEmpty =
    !salutation.trim() && !message.trim() && !signoff.trim();

  // Auto-open composer the first time the user enters the 'helped'
  // path with no content yet. Only fires once per mount; if they close
  // without writing they get the empty form + the persistent "Compose
  // new version" button to re-open the drawer on demand.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (
      path === 'helped' &&
      allFieldsEmpty &&
      !autoOpenedRef.current
    ) {
      autoOpenedRef.current = true;
      setComposerOpen(true);
    }
  }, [path, allFieldsEmpty]);

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
      {/* Top-of-form bar — varies by path.
          • 'helped' path: a "Compose new version" CTA that re-opens
            the macro composer drawer. Always visible so the user can
            iterate freely. Pre-question link sits below as a quiet
            "actually let me write it myself" escape.
          • 'self' path: just the quiet "Change approach" link — no
            macro CTA (the per-field vibe chips below the message
            textarea are the AI affordance for this path).
          Both paths show the link in the same visual position so it
          stays predictable. */}
      <div className="flex items-center justify-between gap-3">
        {path === 'helped' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setComposerOpen(true)}
            className="text-xs border-brand/40 text-brand-dark hover:bg-brand-muted/40"
            data-testid="btn-inside-compose-open"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            {allFieldsEmpty ? 'Open the composer' : 'Compose a new version'}
          </Button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onChangeApproach}
          className="text-[11px] text-stone-500 hover:text-ink underline underline-offset-2 inline-flex items-center gap-1"
          data-testid="btn-inside-change-approach"
        >
          <ArrowLeft className="w-3 h-3" />
          Change approach
        </button>
      </div>

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
        {/* Style-transform chip row — the rewriter's entry point.
            Quiet, low-prominence row of vibes under the textarea.
            Disabled (greyed) when the message is empty, with a hint
            line that explains why. The product position: writing a
            card isn't hard, but if you want to try a different vibe
            we're here. The chips literally tell you what each click
            will do, no drawer needed to see the menu. */}
        <div className="mt-3" data-testid="inside-vibe-chip-row">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-soft font-medium mr-0.5">
              <Wand2 className="w-3 h-3 text-brand/70" strokeWidth={2} />
              Make it
            </span>
            {STYLE_CHIPS.map((c) => (
              <button
                key={c.value}
                type="button"
                disabled={!messageHasContent}
                onClick={() => setActiveStyle(c.value)}
                title={
                  messageHasContent
                    ? `Rewrite your draft as ${c.label}`
                    : 'Write a message first, then try a vibe.'
                }
                className={
                  messageHasContent
                    ? 'px-2.5 py-1 rounded-full text-[11px] font-medium bg-brand-muted/60 text-brand-dark hover:bg-brand hover:text-white transition-colors'
                    : 'px-2.5 py-1 rounded-full text-[11px] font-medium bg-stone-100 text-stone-400 cursor-not-allowed'
                }
                data-testid={`btn-inside-vibe-${c.value}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {!messageHasContent && (
            <p className="text-[11px] text-stone-400 mt-1.5">
              Write a few words first — the rewriter needs your draft to
              transform.
            </p>
          )}
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

      {/* Style-transform rewriter drawer. Opens when the user picks
          a vibe chip; `activeStyle` doubles as the open flag. The
          drawer auto-fires the rewrite on open + when the active
          style changes from within the drawer ("Try another vibe").
          Picking a result routes through onMessageChange + flushSave
          so the autosave story is identical to typing. */}
      <InsideTextHelperDrawer
        open={activeStyle !== null}
        onOpenChange={(o) => {
          if (!o) setActiveStyle(null);
        }}
        cardId={cardId}
        draft={message}
        style={activeStyle}
        onStyleChange={(next) => setActiveStyle(next)}
        contextStrip={{
          recipientName: state.recipient?.name?.trim() || undefined,
          occasion: state.recipient?.occasion?.trim() || undefined,
          sceneDescription: state.scene?.description?.trim() || undefined,
        }}
        onAccept={(text) => {
          // Capture the original BEFORE we overwrite — the toast's
          // "Restore my original" action puts it back. Cheap safety
          // net so accepting a rewrite never feels like erasure.
          const originalBeforeAccept = message;
          onMessageChange(text);
          void flushSave();
          toast({
            title: 'Rewrite applied',
            description: 'Edit freely from here. Or undo if it missed.',
            action: (
              <ToastAction
                altText="Restore my original"
                onClick={() => {
                  onMessageChange(originalBeforeAccept);
                  void flushSave();
                }}
              >
                Restore my original
              </ToastAction>
            ),
          });
        }}
      />

      {/* Macro composer drawer (the "Write it for me" path). Mounted
          here so accept can fill ALL THREE fields and the
          restore-original toast can put all three back. Auto-opens
          once on first 'helped'-path mount with empty fields. Re-opens
          via the persistent "Compose new version" button above. */}
      <InsideTextComposerDrawer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        cardId={cardId}
        contextStrip={{
          recipientName: state.recipient?.name?.trim() || undefined,
          occasion: state.recipient?.occasion?.trim() || undefined,
          sceneDescription: state.scene?.description?.trim() || undefined,
        }}
        onAccept={(composed) => {
          // Snapshot all three current values BEFORE we overwrite so
          // the toast's "Restore my original" can put them back as a
          // single atomic undo. Use the local mirrors (salutation /
          // message / signoff) since they're the freshest values the
          // user has seen on screen.
          const snapshot = {
            salutation,
            message,
            signoff,
          };
          // Apply new values: update local mirrors AND parent state in
          // one commit so the autosave story stays consistent.
          setSalutation(composed.greeting);
          setMessage(composed.message);
          setSignoff(composed.signoff);
          onChange({
            inside: {
              ...state.inside,
              mode: 'write',
              write: {
                ...write,
                salutation: composed.greeting,
                message: composed.message,
                signoff: composed.signoff,
              },
            },
          });
          void flushSave();
          toast({
            title: 'Inside written',
            description:
              'All three boxes are filled. Edit any of them freely from here.',
            action: (
              <ToastAction
                altText="Restore my original"
                onClick={() => {
                  setSalutation(snapshot.salutation);
                  setMessage(snapshot.message);
                  setSignoff(snapshot.signoff);
                  onChange({
                    inside: {
                      ...state.inside,
                      mode: 'write',
                      write: {
                        ...write,
                        ...snapshot,
                      },
                    },
                  });
                  void flushSave();
                }}
              >
                Restore my original
              </ToastAction>
            ),
          });
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
