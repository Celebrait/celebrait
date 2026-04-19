// client/src/components/studio/steps/recipient-step.tsx
//
// Step 1: who's the card for, and what's the occasion. Drives the
// tone of every subsequent step — scene presets are occasion-specific,
// inside-message generation uses the name, etc.
//
// Layout (3.7a rewrite):
//   - Name input up top
//   - Occasions rendered as button cards (four primary + "More" + "Other")
//     rather than a dropdown. Mirrors the MVP's better-tested pattern —
//     big tappable targets, zero-click discovery of options.
//   - "Other" surfaces a free-text field so custom occasions ("Retirement",
//     "New home", "Divorce party") don't fall through a keyword gap.

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Check,
  ChevronDown,
  Cake,
  HeartHandshake,
  Gem,
  GraduationCap,
  Baby,
  TreePine,
  Heart,
  Flower2,
  Leaf,
  PenLine,
  Diamond,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CardDraftState } from '@shared/schema';
import { OCCASION_OPTIONS, getOccasionLabel } from '../scene-presets';

// The four occasions shown by default. Rest are behind a "More" disclosure
// so the step doesn't feel like a dropdown pretending to be buttons.
// Order reflects expected popularity for UK/ZAR at launch.
const PRIMARY_OCCASIONS: readonly string[] = [
  'birthday',
  'anniversary',
  'wedding',
  'graduation',
];

// Vector icon per occasion. Consistent visual language (lucide) reads
// as premium vs. emoji which skews casual/chat-bot. Each icon is the
// simplest recognisable glyph for that occasion.
const OCCASION_ICON: Record<string, LucideIcon> = {
  birthday: Cake,
  anniversary: HeartHandshake,
  wedding: Gem,
  graduation: GraduationCap,
  engagement: Diamond,
  baby: Baby,
  christmas: TreePine,
  valentines: Heart,
  thankyou: Flower2,
  sympathy: Leaf,
  other: PenLine,
};

interface RecipientStepProps {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
}

export function RecipientStep({ state, onChange }: RecipientStepProps) {
  // Local copy for the name field so typing doesn't fire a save per
  // keystroke. Commits on blur.
  const [localName, setLocalName] = useState(state.recipient?.name ?? '');

  const selectedOccasion = state.recipient?.occasion ?? '';

  // Show more options if the user has already picked a non-primary
  // occasion (so they don't have to re-click "More" to see why their
  // pick is highlighted).
  const [showMore, setShowMore] = useState(
    !!selectedOccasion &&
      !PRIMARY_OCCASIONS.includes(selectedOccasion) &&
      selectedOccasion !== 'other',
  );

  // "Other" free-text — separate field so switching to Other and back
  // doesn't lose what the user typed.
  const [otherText, setOtherText] = useState(
    selectedOccasion && !(OCCASION_OPTIONS as readonly string[]).includes(selectedOccasion)
      ? selectedOccasion
      : '',
  );

  const commitName = () => {
    const trimmed = localName.trim();
    if (trimmed !== (state.recipient?.name ?? '')) {
      onChange({ recipient: { ...state.recipient, name: trimmed } });
    }
  };

  const pickOccasion = (occasion: string) => {
    onChange({ recipient: { ...state.recipient, occasion } });
  };

  const commitOther = () => {
    const trimmed = otherText.trim();
    // Only persist non-empty custom occasions. Empty → fall back to
    // the 'other' sentinel so readiness gate still passes.
    const final = trimmed.length > 0 ? trimmed : 'other';
    if (final !== selectedOccasion) {
      onChange({ recipient: { ...state.recipient, occasion: final } });
    }
  };

  const moreOccasions = OCCASION_OPTIONS.filter(
    (o) => !PRIMARY_OCCASIONS.includes(o) && o !== 'other',
  );
  const isOtherPicked =
    selectedOccasion === 'other' ||
    (!!selectedOccasion && !(OCCASION_OPTIONS as readonly string[]).includes(selectedOccasion));

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <p className="text-sm text-stone-600">
        Who's this card for, and what are you celebrating?
      </p>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="recipient-name" className="text-sm text-ink">
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

      {/* Occasion */}
      <div className="space-y-2">
        <Label className="text-sm text-ink">The occasion</Label>
        <div className="grid grid-cols-2 gap-2.5">
          {PRIMARY_OCCASIONS.map((o) => (
            <OccasionButton
              key={o}
              occasion={o}
              Icon={OCCASION_ICON[o]}
              label={getOccasionLabel(o)}
              selected={selectedOccasion === o}
              onPick={() => pickOccasion(o)}
            />
          ))}
        </div>

        {/* More disclosure */}
        {!showMore && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-dark mt-1 underline underline-offset-2"
            data-testid="btn-more-occasions"
          >
            <ChevronDown className="w-3 h-3" />
            More occasions
          </button>
        )}
        {showMore && (
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {moreOccasions.map((o) => (
              <OccasionButton
                key={o}
                occasion={o}
                Icon={OCCASION_ICON[o]}
                label={getOccasionLabel(o)}
                selected={selectedOccasion === o}
                onPick={() => pickOccasion(o)}
              />
            ))}
          </div>
        )}

        {/* "Other" card — always visible once More is expanded, or if
            the user has an Other value already. Separate row so it
            stands apart from the canonical list. */}
        {(showMore || isOtherPicked) && (
          <div className="pt-2">
            <OccasionButton
              occasion="other"
              Icon={OCCASION_ICON.other}
              label={isOtherPicked && otherText ? `Custom: ${otherText}` : 'Something else'}
              selected={isOtherPicked}
              onPick={() => pickOccasion('other')}
              wide
            />
            {isOtherPicked && (
              <div className="mt-2">
                <Input
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  onBlur={commitOther}
                  placeholder="Type the occasion… e.g. Retirement, New home"
                  className="text-sm"
                  data-testid="input-other-occasion"
                  autoFocus
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Tappable occasion card. Visual feedback is the whole point — big
// target, obvious selected state, vector icon for warmth.
function OccasionButton({
  occasion,
  Icon,
  label,
  selected,
  onPick,
  wide = false,
}: {
  occasion: string;
  Icon?: LucideIcon;
  label: string;
  selected: boolean;
  onPick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`relative flex items-center gap-3 text-left p-3 rounded-xl border-2 transition-all ${
        selected
          ? 'border-brand bg-brand-muted shadow-sm'
          : 'border-stone-200 hover:border-brand hover:bg-brand-muted/40 bg-white'
      } ${wide ? 'w-full' : ''}`}
      data-testid={`btn-occasion-${occasion}`}
    >
      {Icon && (
        <span
          className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${
            selected
              ? 'bg-brand text-brand-foreground'
              : 'bg-accent-coral-light text-accent-coral-dark'
          }`}
        >
          <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
        </span>
      )}
      <span
        className={`text-sm font-medium truncate ${
          selected ? 'text-brand-dark' : 'text-stone-800'
        }`}
      >
        {label}
      </span>
      {selected && (
        <span className="ml-auto w-5 h-5 rounded-full bg-cta text-cta-foreground flex items-center justify-center shrink-0 shadow-sm">
          <Check className="w-3 h-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** Is the Recipient step complete enough to move on? */
export function isRecipientStepReady(state: CardDraftState): boolean {
  const name = state.recipient?.name?.trim();
  const occasion = state.recipient?.occasion?.trim();
  return !!name && !!occasion && occasion !== 'other';
  // ^ 'other' on its own isn't ready — user must either type their
  //   custom occasion or pick a real one. Prevents ambiguous drafts.
}
