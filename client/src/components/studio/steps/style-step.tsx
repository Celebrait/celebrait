// client/src/components/studio/steps/style-step.tsx
//
// Step 4: pick the visual style for the card. Three modes:
//   - animAIted  → warm Celebrait illustration house
//   - reAIlistic → photoreal / cinematic preset
//   - Custom     → free text (gated by a modal with examples)
//
// The "AI" wordplay stays in customer copy only — internally the enum
// is plain ('animated' | 'realistic' | 'custom') so code paths don't
// carry brand aesthetics.

import { useState } from 'react';
import { Sparkles, Camera, PenLine, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { CardDraftState, StyleMode } from '@shared/schema';

// Minimum characters for a custom style description. Blocks "cool" /
// "nice" at the form level — if the user types less than this the
// Save button stays disabled.
const CUSTOM_MIN_CHARS = 15;

interface ModeButton {
  mode: StyleMode;
  // Display label renders with AI-in-the-middle styling below. We store
  // the plain spelling so it's accessible and easy to read in code.
  label: string;
  blurb: string;
  icon: typeof Sparkles;
}

const MODE_BUTTONS: ModeButton[] = [
  {
    mode: 'animated',
    label: 'animated',
    blurb: 'Warm, illustrated, a little whimsical',
    icon: PenLine,
  },
  {
    mode: 'realistic',
    label: 'realistic',
    blurb: 'Photoreal, cinematic, true-to-life',
    icon: Camera,
  },
  {
    mode: 'custom',
    label: 'custom',
    blurb: 'Describe your own — we\'ll use it verbatim',
    icon: Sparkles,
  },
];

interface StyleStepProps {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
}

export function StyleStep({ state, onChange }: StyleStepProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const currentMode = state.style?.mode;

  const pickMode = (mode: StyleMode) => {
    if (mode === 'custom') {
      setCustomOpen(true);
      return;
    }
    // Clear any stale custom text when switching away from custom
    onChange({ style: { mode } });
  };

  const saveCustom = (text: string) => {
    onChange({ style: { mode: 'custom', custom: text.trim() } });
    setCustomOpen(false);
  };

  const primaryModes = MODE_BUTTONS.filter((b) => b.mode !== 'custom');
  const customMode = MODE_BUTTONS.find((b) => b.mode === 'custom')!;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-stone-600 mb-1">
          How should your card look?
        </p>
        <p className="text-xs text-stone-500">
          Pick one of our house styles, or describe your own.
        </p>
      </div>

      {/* Primary styles — big featured cards with gradient accents. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {primaryModes.map((btn) => {
          const Icon = btn.icon;
          const active = currentMode === btn.mode;
          // Each primary style gets a distinct accent band so they feel
          // like siblings but individual choices.
          const accent =
            btn.mode === 'animated'
              ? 'from-accent-coral-light via-brand-muted to-accent-amber-light'
              : 'from-ink/10 via-brand-muted to-accent-coral-light';
          return (
            <button
              key={btn.mode}
              type="button"
              onClick={() => pickMode(btn.mode)}
              className={`relative text-left rounded-2xl border-2 transition-all overflow-hidden ${
                active
                  ? 'border-brand shadow-md ring-2 ring-brand/20'
                  : 'border-stone-200 hover:border-brand/60 hover:shadow-sm bg-white'
              }`}
              data-testid={`style-${btn.mode}`}
            >
              {/* Decorative gradient band — subtle identity for each tile. */}
              <div
                className={`h-20 w-full bg-gradient-to-br ${accent} relative`}
                aria-hidden="true"
              >
                <Icon
                  className={`absolute bottom-3 left-4 w-6 h-6 ${
                    active ? 'text-brand-dark' : 'text-brand/70'
                  }`}
                  strokeWidth={1.75}
                />
                {active && (
                  <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-cta text-cta-foreground flex items-center justify-center shadow-sm">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="p-4">
                <div
                  className={`text-base font-semibold mb-1 ${
                    active ? 'text-brand-dark' : 'text-ink'
                  }`}
                >
                  <AILabel text={btn.label} />
                </div>
                <p
                  className={`text-xs ${active ? 'text-brand-dark/80' : 'text-stone-500'}`}
                >
                  {btn.blurb}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom — demoted, inline row. Present but not competing with
          the two featured house styles. If the user wants their own
          style, they reach here. */}
      <button
        type="button"
        onClick={() => pickMode(customMode.mode)}
        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
          currentMode === 'custom'
            ? 'border-brand bg-brand-muted'
            : 'border-dashed border-stone-300 hover:border-brand hover:bg-brand-muted/40 bg-white'
        }`}
        data-testid="style-custom"
      >
        <span
          className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
            currentMode === 'custom'
              ? 'bg-brand text-brand-foreground'
              : 'bg-accent-coral-light text-accent-coral-dark'
          }`}
        >
          <customMode.icon className="w-4.5 h-4.5" strokeWidth={1.75} />
        </span>
        <span className="flex-1 min-w-0">
          <span
            className={`block text-sm font-semibold ${
              currentMode === 'custom' ? 'text-brand-dark' : 'text-ink'
            }`}
          >
            Describe your own style
          </span>
          <span className="block text-xs text-stone-500 mt-0.5">
            Watercolour, 60s poster, vaporwave — your call.
          </span>
        </span>
        {currentMode === 'custom' && (
          <span className="w-5 h-5 rounded-full bg-cta text-cta-foreground flex items-center justify-center shrink-0 shadow-sm">
            <Check className="w-3 h-3" strokeWidth={3} />
          </span>
        )}
      </button>

      {currentMode === 'custom' && state.style?.custom && (
        <div className="bg-surface-cream border border-accent-coral-light rounded-xl p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-accent-coral-dark uppercase tracking-wider mb-1">
                Your custom style
              </p>
              <p className="text-sm text-ink break-words">
                {state.style.custom}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCustomOpen(true)}
              className="shrink-0 text-brand hover:text-brand-dark"
              data-testid="btn-edit-custom-style"
            >
              Edit
            </Button>
          </div>
        </div>
      )}

      <CustomStyleDialog
        open={customOpen}
        initialValue={state.style?.custom ?? ''}
        onClose={() => setCustomOpen(false)}
        onSave={saveCustom}
      />
    </div>
  );
}

// Renders a label like "animated" as "anim" + "AI" + "ted" with the
// middle two letters capitalised. Purely presentational — the underlying
// mode value stays lowercase.
function AILabel({ text }: { text: string }) {
  const idx = text.toLowerCase().indexOf('ai');
  if (idx === -1) {
    return <span className="capitalize">{text}</span>;
  }
  return (
    <span>
      <span className="capitalize">{text.slice(0, idx)}</span>
      <span className="text-brand font-bold">AI</span>
      <span>{text.slice(idx + 2)}</span>
    </span>
  );
}

function CustomStyleDialog({
  open,
  initialValue,
  onClose,
  onSave,
}: {
  open: boolean;
  initialValue: string;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  // Local text buffer — only commits when Save is pressed. Means the
  // user can cancel without losing their previous custom style.
  const [text, setText] = useState(initialValue);

  // Reset the buffer whenever the dialog opens with a different value.
  // Using a key effect avoids needing a full useEffect.
  if (open && text === '' && initialValue !== '') {
    setText(initialValue);
  }

  const trimmed = text.trim();
  const valid = trimmed.length >= CUSTOM_MIN_CHARS;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-ink">Describe your style</DialogTitle>
          <DialogDescription>
            The more specific you are, the better the result. Mention the
            medium, era and feel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="custom-style-text" className="text-sm text-ink">
              Your style description
            </Label>
            <Textarea
              id="custom-style-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Watercolour painting, loose brushwork, warm pastel palette"
              rows={4}
              className="mt-1 text-base resize-none"
              data-testid="input-custom-style"
              autoFocus
            />
            <p
              className={`text-[11px] mt-1 ${
                trimmed.length === 0
                  ? 'text-stone-400'
                  : valid
                    ? 'text-stone-500'
                    : 'text-accent-coral-dark'
              }`}
            >
              {trimmed.length === 0
                ? `At least ${CUSTOM_MIN_CHARS} characters`
                : valid
                  ? `${trimmed.length} characters`
                  : `${CUSTOM_MIN_CHARS - trimmed.length} more needed`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-cta-light/40 rounded-lg p-3 border border-cta/30">
              <p className="font-semibold text-cta-hover mb-1">Good examples</p>
              <ul className="space-y-1 text-stone-700">
                <li>"Watercolour with soft pastel washes, warm beige"</li>
                <li>"1960s Saul Bass poster, flat shapes, mustard + teal"</li>
                <li>"Pixar 3D animation, warm cinematic lighting"</li>
              </ul>
            </div>
            <div className="bg-accent-amber-light/60 rounded-lg p-3 border border-accent-amber/40">
              <p className="font-semibold text-accent-amber-dark mb-1">Too vague</p>
              <ul className="space-y-1 text-stone-700">
                <li>"Cool", "Modern", "Nice"</li>
                <li>"Like that one Disney movie"</li>
                <li>"Something pretty"</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="btn-cancel-custom-style"
          >
            Cancel
          </Button>
          <Button
            onClick={() => valid && onSave(trimmed)}
            disabled={!valid}
            className="bg-brand hover:bg-brand-dark text-brand-foreground disabled:opacity-50"
            data-testid="btn-save-custom-style"
          >
            Use this style
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Is the Style step complete? A mode must be picked, and for Custom
 *  the text must clear the minimum length. */
export function isStyleStepReady(state: CardDraftState): boolean {
  const mode = state.style?.mode;
  if (mode === 'animated' || mode === 'realistic') return true;
  if (mode === 'custom') {
    return (state.style?.custom?.trim().length ?? 0) >= CUSTOM_MIN_CHARS;
  }
  return false;
}
