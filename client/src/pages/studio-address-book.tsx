// client/src/pages/studio-address-book.tsx
//
// /studio/people/address-book — list of the user's recipients.
//
// Three states:
//   1. Loading        → skeleton rows
//   2. Empty (zero)   → onboarding hero with "+ Add someone now"
//   3. Has entries    → list with row per recipient (name, relationship,
//                       occasions chips, address indicator), tap-to-edit,
//                       ⋯ menu with Delete confirm
//
// Auto-save lands recipients here automatically the first time you make
// a card for someone — so most users will arrive at the populated state
// without having explicitly added anyone. Manual add still works.

import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  AlertCircle,
  Cake,
  Loader2,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getOccasionIcon } from '@/lib/occasion-icon';
import type {
  AddressBookEntry,
  RecipientOccasionRow,
} from '@shared/schema';

interface EntryWithOccasions extends AddressBookEntry {
  occasions: RecipientOccasionRow[];
  /** The most recent completed card sent to this recipient. Drives
   *  the row thumbnail — when present, the row shows the card's front
   *  art instead of the letter avatar. See
   *  next_address_book_reminders_retention.md. Mirrors the server
   *  `EntryWithOccasions` shape in routes/address-book.ts. */
  lastCard: { frontImageUrl: string; sentAt: string } | null;
}

export default function StudioAddressBookPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<EntryWithOccasions[]>({
    queryKey: ['/api/user/address-book'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/user/address-book/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/address-book'] });
      toast({ title: 'Gone — you can always add them back.', variant: 'success' });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't remove",
        description: err?.message ?? 'Try again in a moment.',
        variant: 'destructive',
      });
    },
  });

  const entries = data ?? [];
  const occasionCount = useMemo(
    () => entries.reduce((sum, e) => sum + e.occasions.length, 0),
    [entries],
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink">
            Address book
          </h1>
          {entries.length > 0 && (
            <p className="text-sm text-stone-500 mt-1">
              {entries.length} {entries.length === 1 ? 'person' : 'people'}
              {occasionCount > 0 && (
                <>
                  {' · '}
                  {occasionCount} {occasionCount === 1 ? 'date' : 'dates'} we'll remember
                </>
              )}
            </p>
          )}
        </div>
        {entries.length > 0 && (
          <Link
            href="/studio/people/address-book/new"
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-colors shrink-0"
            data-testid="btn-add-person"
          >
            <Plus className="w-4 h-4" />
            Add someone
          </Link>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-stone-200 p-5 animate-pulse"
            >
              <div className="h-5 w-32 bg-stone-200 rounded mb-3" />
              <div className="h-3 w-48 bg-stone-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">
              Couldn't load your address book
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              {error instanceof Error ? error.message : 'Give it a moment and try again.'}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && entries.length === 0 && (
        <EmptyState onAdd={() => setLocation('/studio/people/address-book/new')} />
      )}

      {/* List */}
      {!isLoading && !error && entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onDelete={() => setConfirmDeleteId(entry.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this person?</AlertDialogTitle>
            <AlertDialogDescription>
              They'll come out of your address book. Cards you've already
              made stay in your gallery — this just stops the reminders
              and the typeahead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteId !== null) {
                  deleteMutation.mutate(confirmDeleteId);
                  setConfirmDeleteId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// EmptyState — shown when the user has zero entries.
//
// Tone: warm "this is where Mum will live" framing. Doesn't apologise
// for being empty; sells the future state. Per the dashboard scope
// memory note (next_studio_dashboard_scope.md): empty surfaces always
// invite action.
// ─────────────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl px-6 py-12 sm:py-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-muted/60 text-brand mb-5">
        <Users className="w-6 h-6" strokeWidth={1.75} />
      </div>
      <h2 className="text-xl sm:text-2xl font-semibold text-ink mb-2">
        This is where the people you send cards to live.
      </h2>
      <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-md mx-auto mb-7">
        Make a card and they'll land here automatically. Or add someone
        now — handy when a birthday's creeping up.
      </p>
      <Button
        type="button"
        size="lg"
        onClick={onAdd}
        className="bg-brand hover:bg-brand-dark text-white"
        data-testid="btn-empty-add-person"
      >
        <UserPlus className="w-4 h-4 mr-2" />
        Add your first person
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// EntryRow — one card per recipient.
//
// Layout: name + relationship subtitle + occasion chips + address
// indicator. Whole row clicks through to edit; ⋯ menu has explicit
// Edit + Remove actions.
// ─────────────────────────────────────────────────────────────────────

/** Format the lastCard.sentAt timestamp for the "Last sent" line.
 *  - Same calendar day → "today"
 *  - Yesterday → "yesterday"
 *  - This calendar year → "14 Mar"
 *  - Older → "14 Mar 2025"
 *  Keeps the line short — it's the quietest signal on the row, not
 *  a headline. en-GB locale to match the rest of the product. */
function formatLastSentDate(iso: string): string {
  const sent = new Date(iso);
  if (Number.isNaN(sent.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfSent = new Date(sent.getFullYear(), sent.getMonth(), sent.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfSent.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (dayDiff === 0) return 'today';
  if (dayDiff === 1) return 'yesterday';
  const sameYear = sent.getFullYear() === now.getFullYear();
  return sent.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function EntryRow({
  entry,
  onDelete,
}: {
  entry: EntryWithOccasions;
  onDelete: () => void;
}) {
  const hasAddress = !!entry.address;
  const subtitleParts: string[] = [];
  if (entry.relationship) subtitleParts.push(entry.relationship);
  if (hasAddress) subtitleParts.push('address on file');
  const subtitle = subtitleParts.join(' · ');

  return (
    <div
      className="bg-white rounded-2xl border border-stone-200 hover:border-brand transition-colors group"
      data-testid={`address-book-row-${entry.id}`}
    >
      <div className="flex items-start gap-3 p-5">
        <Link
          href={`/studio/people/address-book/${entry.id}/edit`}
          className="flex-1 min-w-0 flex items-start gap-3"
          data-testid={`address-book-edit-${entry.id}`}
        >
          {/* Avatar — last card sent if we have one (turns the row
              into a memory anchor), otherwise the letter fallback.
              Slightly larger than the letter version (12×12 ≈ 48px)
              so the card art is readable; rounded-md not rounded-full
              because it's a card, not a person photo. See
              next_address_book_reminders_retention.md. */}
          <div className="w-12 h-12 rounded-md overflow-hidden border border-stone-200 shrink-0 bg-brand-muted/50 text-brand-dark flex items-center justify-center">
            {entry.lastCard?.frontImageUrl ? (
              <img
                src={entry.lastCard.frontImageUrl}
                alt=""
                aria-hidden
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-base font-semibold">
                {entry.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-base font-medium text-ink truncate">
              {entry.name}
            </p>
            {subtitle && (
              <p className="text-xs text-stone-500 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
            {entry.occasions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {entry.occasions.map((o) => (
                  <OccasionChip key={o.id} occasion={o} />
                ))}
              </div>
            )}
            {/* Last sent — the quietest signal on the row, historical
                rather than actionable, so it sits below the chips.
                Memory-shelf framing: this is a person you've sent
                something to before. See
                next_address_book_reminders_retention.md. */}
            {entry.lastCard && (
              <p className="text-xs text-stone-400 mt-2.5">
                Last sent {formatLastSentDate(entry.lastCard.sentAt)}
              </p>
            )}
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-8 h-8 rounded-full text-stone-400 hover:text-ink hover:bg-stone-50 flex items-center justify-center shrink-0 transition-colors"
              aria-label={`Actions for ${entry.name}`}
              data-testid={`address-book-menu-${entry.id}`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link
                href={`/studio/people/address-book/${entry.id}/edit`}
                className="flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-red-600 focus:text-red-700 focus:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// OccasionChip — small pill showing an occasion + its date status.
//
// "Mum's birthday — May 15"     ← has a date, will trigger reminders
// "Mum's birthday — add date"   ← no date, prompt-state copy
// ─────────────────────────────────────────────────────────────────────

function OccasionChip({ occasion }: { occasion: RecipientOccasionRow }) {
  const Icon = getOccasionIcon(occasion.occasion) ?? Cake;
  const dateLabel = occasion.date
    ? formatOccasionDate(occasion.date, occasion.yearSpecific)
    : null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
        dateLabel
          ? 'bg-brand-muted/60 text-brand-dark'
          : 'bg-amber-50 text-amber-800 border border-amber-200'
      }`}
      data-testid={`occasion-chip-${occasion.id}`}
    >
      <Icon className="w-3 h-3" strokeWidth={1.75} />
      <span className="capitalize">{occasion.occasion}</span>
      {dateLabel && <span className="text-stone-500">· {dateLabel}</span>}
      {!dateLabel && <span className="text-amber-700">· add the date</span>}
    </span>
  );
}

/** Format a date for occasion display.
 *  Recurring (year ignored): "May 15"
 *  One-off (year matters):   "May 15, 2026" */
function formatOccasionDate(iso: string, yearSpecific: boolean): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions = yearSpecific
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' };
  return date.toLocaleDateString('en-GB', opts);
}

// MapPin used to be the address indicator icon — kept import to
// keep the addressed-saved metadata visible if we surface it more
// elsewhere later. Suppress lint.
void MapPin;
void Loader2;
