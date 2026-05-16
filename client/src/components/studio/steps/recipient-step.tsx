// client/src/components/studio/steps/recipient-step.tsx
//
// Step 1: who's the card for, and what's the occasion. Drives the
// tone of every subsequent step — scene presets are occasion-specific,
// inside-message generation uses the name, etc.
//
// Layout (3.7a rewrite):
//   - Name input up top — with address-book typeahead (2026-04-29).
//     Once the user has 1+ recipients in their address book, typing
//     2+ chars surfaces matches as a floating dropdown. Tap a match
//     to autofill the name (occasion stays the user's choice — they
//     might be making a different occasion's card for the same
//     person). New users (zero entries) see the original free-text
//     experience untouched.
//   - Occasions rendered as button cards (four primary + "More" + "Other")
//     rather than a dropdown. Mirrors the MVP's better-tested pattern —
//     big tappable targets, zero-click discovery of options.
//   - "Other" surfaces a free-text field so custom occasions ("Retirement",
//     "New home", "Divorce party") don't fall through a keyword gap.

import { useEffect, useRef, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AddressBookEntry, CardDraftState } from '@shared/schema';
import { OCCASION_OPTIONS, getOccasionLabel } from '../scene-presets';

// The four occasions shown by default. Rest are behind a "More" disclosure
// so the step doesn't feel like a dropdown pretending to be buttons.
// Order reflects expected popularity for UK at launch.
const PRIMARY_OCCASIONS: readonly string[] = [
  'birthday',
  'anniversary',
  'wedding',
  'graduation',
];

// Vector icon per occasion. Consistent visual language (lucide) reads
// as premium vs. emoji which skews casual/chat-bot. Each icon is the
// simplest recognisable glyph for that occasion.
// Exported so other steps (Scene, Style, Inside) can surface the
// occasion icon in their context strips without duplicating the
// mapping.
export const OCCASION_ICON: Record<string, LucideIcon> = {
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
  /** Called when the step transitions from not-ready → ready (i.e.
   *  both name + occasion are set for the first time this visit).
   *  Parent decides whether to actually advance (frontier guard etc.). */
  onAdvance?: () => void;
}

export function RecipientStep({ state, onChange, onAdvance }: RecipientStepProps) {
  // Local copy for the name field so typing doesn't fire a save per
  // keystroke. Commits on blur.
  const [localName, setLocalName] = useState(state.recipient?.name ?? '');

  const selectedOccasion = state.recipient?.occasion ?? '';

  // ── Address-book typeahead ─────────────────────────────────────────
  //
  // The dropdown gates on having ≥1 saved entry total — a brand-new
  // user sees the original free-text flow with zero typeahead chrome.
  // For users with entries, typing 2+ chars in the name field triggers
  // a debounced search and shows matches.
  //
  // Debounce: 200ms. Tighter than feels natural but the search query
  // is a hot path (one tap = three keystrokes typically) and the
  // server is a single ilike index lookup, so cheap. Faster feedback
  // beats data-saver.
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Debounce the input → searchTerm pipe.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(localName.trim());
    }, 200);
    return () => clearTimeout(t);
  }, [localName]);

  // Has-entries check — fetch the full address book once on mount with
  // a long stale time. We use this to gate whether the typeahead
  // dropdown EVER renders. Empty book = no typeahead noise. Cheap
  // because the result is shared across all callers via react-query.
  const { data: allEntries } = useQuery<AddressBookEntry[]>({
    queryKey: ['/api/user/address-book'],
    staleTime: 1000 * 60, // 1 minute — plenty for a step the user
                          // typically spends 10-30s on
  });
  const hasAnyEntries = (allEntries?.length ?? 0) > 0;

  // The typeahead query itself. Only enabled when:
  //   • User has entries (hasAnyEntries)
  //   • Search term is 2+ chars
  //   • The current name doesn't already match an entry exactly
  //     (avoids dangling the dropdown after they've picked one)
  const shouldSearch =
    hasAnyEntries && searchTerm.length >= 2 && !valueExactlyMatchesEntry(searchTerm, allEntries);
  const { data: searchResults } = useQuery<AddressBookEntry[]>({
    queryKey: [`/api/user/address-book/search?q=${encodeURIComponent(searchTerm)}`],
    enabled: shouldSearch,
    // 30s stale — the user typing "Mu" then "Mum" reuses the cached
    // "Mu" prefix result; fresh enough.
    staleTime: 30_000,
  });

  const visibleSuggestions = (searchResults ?? []).slice(0, 5);
  const showDropdown =
    dropdownOpen && shouldSearch && visibleSuggestions.length > 0;

  // Close dropdown on outside click.
  useEffect(() => {
    if (!showDropdown) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [showDropdown]);

  // Reset highlight when results change.
  useEffect(() => {
    setActiveIndex(-1);
  }, [searchResults]);

  /** Apply a suggestion: autofill the name. Occasion is left alone —
   *  the user might be making a Christmas card for someone whose
   *  birthday they previously saved. */
  const pickSuggestion = (entry: AddressBookEntry) => {
    setLocalName(entry.name);
    onChange({ recipient: { ...state.recipient, name: entry.name } });
    setDropdownOpen(false);
    setActiveIndex(-1);
  };

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

  // No auto-advance. Users pick an occasion and then click Next themselves
  // — prevents accidental jump-forward when tapping an occasion tile to
  // compare options. (Removed 2026-04-24 after Kevin noted it was
  // surprising; `onAdvance` prop retained for back-compat but is no
  // longer invoked from here.)

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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Leading sub-copy — rhythm parity with the other steps (Scene,
          Style, Front, Review all open with a one-line framing note). */}
      <p className="text-sm text-stone-600">
        A name and a reason — that's all we need to start.
      </p>

      {/* Name */}
      <div className="space-y-2" ref={wrapperRef}>
        <Label htmlFor="recipient-name" className="text-sm text-ink">
          Name
        </Label>
        <div className="relative">
          <Input
            ref={inputRef}
            id="recipient-name"
            value={localName}
            onChange={(e) => {
              setLocalName(e.target.value);
              if (!dropdownOpen) setDropdownOpen(true);
            }}
            onFocus={() => {
              // Re-open the dropdown on focus so users coming back to
              // the field after editing further down get the typeahead
              // again. No-op when there's no usable search term.
              setDropdownOpen(true);
            }}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (!showDropdown) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) =>
                  Math.min(i + 1, visibleSuggestions.length - 1),
                );
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, -1));
              } else if (e.key === 'Enter' && activeIndex >= 0) {
                e.preventDefault();
                pickSuggestion(visibleSuggestions[activeIndex]);
              } else if (e.key === 'Escape') {
                setDropdownOpen(false);
              }
            }}
            placeholder="e.g. Mum, Sarah, Dad"
            className="text-base border-brand-light focus-visible:border-brand focus-visible:ring-brand/20"
            data-testid="input-recipient-name"
            autoComplete="off"
            autoFocus
            // ARIA wiring for the listbox-pattern typeahead. Screen
            // reader announces the dropdown opening + active option
            // shifts via the activeIndex.
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="recipient-name-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={
              showDropdown && activeIndex >= 0
                ? `recipient-suggestion-${visibleSuggestions[activeIndex]?.id}`
                : undefined
            }
          />
          {/* Typeahead dropdown — absolute under the input, only renders
              when there's something to show. Mobile: full-width, taps
              are large enough for thumbs. Desktop: same width as input. */}
          {showDropdown && (
            <ul
              id="recipient-name-suggestions"
              role="listbox"
              className="absolute z-30 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden"
              data-testid="recipient-typeahead"
            >
              {visibleSuggestions.map((entry, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={entry.id}
                    id={`recipient-suggestion-${entry.id}`}
                    role="option"
                    aria-selected={isActive}
                    // Use onPointerDown so the click fires BEFORE the
                    // input's onBlur (which commits the typed name +
                    // closes the dropdown via outside-click handler).
                    onPointerDown={(e) => {
                      e.preventDefault();
                      pickSuggestion(entry);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-brand-muted/60'
                        : 'hover:bg-stone-50'
                    }`}
                    data-testid={`recipient-suggestion-${entry.id}`}
                  >
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-muted/50 text-brand-dark text-xs font-semibold shrink-0">
                      {entry.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {entry.name}
                      </p>
                      {entry.relationship && (
                        <p className="text-[11px] text-stone-500 truncate">
                          {entry.relationship}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
              <li className="border-t border-stone-100 px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-stone-400">
                From your address book
              </li>
            </ul>
          )}
        </div>
      </div>

      {/* Occasion */}
      <div className="space-y-2">
        <Label className="text-sm text-ink">What's the celebration?</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
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
                  className="text-sm border-brand-light focus-visible:border-brand focus-visible:ring-brand/20"
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
      <span className="text-sm font-medium text-ink truncate">
        {label}
      </span>
      {selected && (
        <span className="ml-auto w-5 h-5 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0 shadow-sm">
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

/** Has the user typed a name that exactly matches an existing address
 *  book entry (case-insensitive)? Used to suppress the typeahead
 *  dropdown after a pick — no point dangling suggestions when they've
 *  clearly committed to one of the existing names. */
function valueExactlyMatchesEntry(
  value: string,
  entries: AddressBookEntry[] | undefined,
): boolean {
  if (!entries || entries.length === 0) return false;
  const normalized = value.toLowerCase().trim();
  if (!normalized) return false;
  return entries.some((e) => e.name.toLowerCase().trim() === normalized);
}
