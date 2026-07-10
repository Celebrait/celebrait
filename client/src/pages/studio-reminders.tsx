// client/src/pages/studio-reminders.tsx
//
// /studio/people/reminders — upcoming reminders for the user.
//
// Three states:
//   1. Zero address-book entries  → onboarding hint with link to address book
//   2. Address book has entries but no occasions have dates → CTA to add dates
//   3. Has upcoming reminders     → grouped list (this week / later this month / next month / beyond)
//
// Each row: recipient name + occasion + days-until + suppression state.
// Per-row "Skip this year" + "Edit" actions.

import { useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  AlertCircle,
  Bell,
  Cake,
  CalendarDays,
  ChevronRight,
  Pencil,
  Undo2,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getOccasionIcon } from '@/lib/occasion-icon';
import type { AddressBookEntry } from '@shared/schema';

interface UpcomingReminder {
  occasionId: number;
  entryId: number;
  recipientName: string;
  relationship: string | null;
  occasion: string;
  occurrenceDate: string;
  daysUntil: number;
  suppressed: boolean;
  suppressedUntil: string | null;
}

interface Bucket {
  label: string;
  items: UpcomingReminder[];
}

export default function StudioRemindersPage() {
  const { toast } = useToast();

  const { data: reminders, isLoading: remindersLoading, error: remindersError } = useQuery<UpcomingReminder[]>({
    queryKey: ['/api/user/reminders'],
  });

  const { data: addressBook, isLoading: addressBookLoading } = useQuery<AddressBookEntry[]>({
    queryKey: ['/api/user/address-book'],
  });

  // Group reminders into time-horizon buckets so the list reads at a
  // glance. Inactive (suppressed) ones bucket separately at the bottom
  // so they don't visually compete with active reminders.
  const buckets = useMemo<Bucket[]>(() => {
    if (!reminders) return [];
    const active = reminders.filter((r) => !r.suppressed);
    const suppressed = reminders.filter((r) => r.suppressed);

    const inThisWeek: UpcomingReminder[] = [];
    const laterThisMonth: UpcomingReminder[] = [];
    const nextMonth: UpcomingReminder[] = [];
    const beyond: UpcomingReminder[] = [];

    for (const r of active) {
      if (r.daysUntil <= 7) inThisWeek.push(r);
      else if (r.daysUntil <= 30) laterThisMonth.push(r);
      else if (r.daysUntil <= 60) nextMonth.push(r);
      else beyond.push(r);
    }

    const out: Bucket[] = [];
    if (inThisWeek.length) out.push({ label: 'This week', items: inThisWeek });
    if (laterThisMonth.length) out.push({ label: 'Later this month', items: laterThisMonth });
    if (nextMonth.length) out.push({ label: 'Next month', items: nextMonth });
    if (beyond.length) out.push({ label: 'Beyond', items: beyond });
    if (suppressed.length) out.push({ label: 'Skipped this year', items: suppressed });

    return out;
  }, [reminders]);

  const suppressMutation = useMutation({
    mutationFn: async (occId: number) => {
      const res = await apiRequest('POST', `/api/user/reminders/${occId}/suppress`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/reminders'] });
      toast({ title: 'Skipping this year — we\'ll be back next year.', variant: 'success' });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't skip",
        description: err?.message ?? 'Try again in a moment.',
        variant: 'destructive',
      });
    },
  });

  const unsuppressMutation = useMutation({
    mutationFn: async (occId: number) => {
      const res = await apiRequest('POST', `/api/user/reminders/${occId}/unsuppress`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/reminders'] });
      toast({ title: 'Reminders back on.', variant: 'success' });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't undo",
        description: err?.message ?? 'Try again in a moment.',
        variant: 'destructive',
      });
    },
  });

  const isLoading = remindersLoading || addressBookLoading;
  const reminderCount = reminders?.filter((r) => !r.suppressed).length ?? 0;
  const hasAnyEntries = (addressBook?.length ?? 0) > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-[-0.015em] text-keeper-ink">
          Reminders
        </h1>
        {!isLoading && reminderCount > 0 && (
          <p className="text-sm text-stone-500 mt-1">
            {reminderCount} {reminderCount === 1 ? 'date' : 'dates'} we're watching for you
          </p>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-keeper-hair p-5 animate-pulse"
            >
              <div className="h-5 w-40 bg-stone-200 rounded mb-3" />
              <div className="h-3 w-56 bg-stone-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {remindersError && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">
              Couldn't load your reminders
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              {remindersError instanceof Error
                ? remindersError.message
                : 'Give it a moment and try again.'}
            </p>
          </div>
        </div>
      )}

      {/* Empty state — no address book entries at all */}
      {!isLoading && !remindersError && !hasAnyEntries && <NoEntriesState />}

      {/* Empty state — has entries but no dates set */}
      {!isLoading && !remindersError && hasAnyEntries && reminders?.length === 0 && (
        <NoDatesState />
      )}

      {/* List */}
      {!isLoading && !remindersError && (reminders?.length ?? 0) > 0 && (
        <div className="space-y-8">
          {buckets.map((bucket) => (
            <div key={bucket.label}>
              <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-400 mb-3">
                {bucket.label}
              </h2>
              <div className="space-y-3">
                {bucket.items.map((r) => (
                  <ReminderRow
                    key={r.occasionId}
                    reminder={r}
                    onSuppress={() => suppressMutation.mutate(r.occasionId)}
                    onUnsuppress={() => unsuppressMutation.mutate(r.occasionId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Empty states
// ─────────────────────────────────────────────────────────────────────

function NoEntriesState() {
  return (
    <div className="bg-white border border-keeper-hair rounded-2xl px-6 py-12 sm:py-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-muted/60 text-brand mb-5">
        <Users className="w-6 h-6" strokeWidth={1.75} />
      </div>
      <h2 className="text-xl sm:text-2xl font-display font-bold tracking-[-0.01em] text-keeper-ink mb-2">
        Add someone to your address book first.
      </h2>
      <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-md mx-auto mb-7">
        Once Mum's there with a date saved, we'll quietly remind you in good time.
      </p>
      <Button
        asChild
        size="lg"
        className="bg-brand hover:bg-brand-dark text-white"
      >
        <Link href="/studio/people/address-book/new">
          <UserPlus className="w-4 h-4 mr-2" />
          Add your first person
        </Link>
      </Button>
    </div>
  );
}

function NoDatesState() {
  return (
    <div className="bg-white border border-keeper-hair rounded-2xl px-6 py-12 sm:py-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-muted/60 text-brand mb-5">
        <CalendarDays className="w-6 h-6" strokeWidth={1.75} />
      </div>
      <h2 className="text-xl sm:text-2xl font-display font-bold tracking-[-0.01em] text-keeper-ink mb-2">
        Add a date to someone — we'll remember.
      </h2>
      <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-md mx-auto mb-7">
        Open someone in your address book and pop in their birthday or anniversary. We'll nudge you 3 weeks, 1 week, and 3 days before — quietly, without being pushy.
      </p>
      <Button
        asChild
        size="lg"
        className="bg-brand hover:bg-brand-dark text-white"
      >
        <Link href="/studio/people/address-book">
          <ChevronRight className="w-4 h-4 mr-2" />
          Open address book
        </Link>
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ReminderRow — one card per upcoming reminder.
// ─────────────────────────────────────────────────────────────────────

function ReminderRow({
  reminder,
  onSuppress,
  onUnsuppress,
}: {
  reminder: UpcomingReminder;
  onSuppress: () => void;
  onUnsuppress: () => void;
}) {
  const Icon = getOccasionIcon(reminder.occasion) ?? Cake;
  const occurrenceLabel = formatOccurrenceDate(reminder.occurrenceDate);
  const distanceLabel = formatDistance(reminder.daysUntil);

  return (
    <div
      className={`bg-white rounded-2xl border transition-colors ${
        reminder.suppressed
          ? 'border-keeper-hair opacity-60'
          : 'border-keeper-hair hover:border-brand'
      }`}
      data-testid={`reminder-row-${reminder.occasionId}`}
    >
      <div className="flex items-start gap-3 p-5">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
            reminder.suppressed
              ? 'bg-stone-100 text-stone-400'
              : 'bg-brand-muted/50 text-brand-dark'
          }`}
        >
          <Icon className="w-4 h-4" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium text-ink">
            {reminder.recipientName}
            {reminder.relationship && (
              <span className="ml-1.5 text-xs text-stone-500 font-normal">
                · {reminder.relationship}
              </span>
            )}
          </p>
          <p className="text-sm text-stone-600 mt-0.5">
            <span className="capitalize">{humaniseOccasion(reminder.occasion)}</span>
            {' · '}
            <span>{occurrenceLabel}</span>
            {' · '}
            <span className={reminder.suppressed ? '' : 'text-brand-dark font-medium'}>
              {distanceLabel}
            </span>
          </p>
          {/* T-3 nudge surfaced inline so the user sees it before the
              email lands. Print is made-to-order (up to 72h) so this close
              it's tight — the honest fallback is the instant digital link.
              Only when not already suppressed. */}
          {!reminder.suppressed && reminder.daysUntil <= 3 && reminder.daysUntil >= 0 && (
            <p className="text-[11px] text-accent-red-dark bg-accent-red-light border border-accent-red/30 rounded-md px-2 py-1 mt-2 inline-block">
              Cutting it fine — pick the fastest delivery; the digital link lands instantly.
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="text-xs text-stone-500 hover:text-ink hover:bg-stone-50 rounded-full px-3 py-1.5 transition-colors shrink-0"
              aria-label={`Actions for ${reminder.recipientName}'s ${reminder.occasion}`}
              data-testid={`reminder-menu-${reminder.occasionId}`}
            >
              {reminder.suppressed ? 'Skipped' : 'Actions'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {reminder.suppressed ? (
              <DropdownMenuItem onClick={onUnsuppress}>
                <Undo2 className="w-4 h-4" />
                Reminders back on
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onSuppress}>
                <Bell className="w-4 h-4" />
                Skip this year
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link
                href={`/studio/people/address-book/${reminder.entryId}/edit`}
                className="flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Edit details
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────

/** "15 May" / "15 May 2027" — show year if it's not this year. */
function formatOccurrenceDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const today = new Date();
  const sameYear = date.getUTCFullYear() === today.getUTCFullYear();
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Human-readable distance: "in 3 days", "in 4 weeks", "today", "tomorrow". */
function formatDistance(daysUntil: number): string {
  if (daysUntil < 0) return 'past';
  if (daysUntil === 0) return 'today';
  if (daysUntil === 1) return 'tomorrow';
  if (daysUntil <= 13) return `in ${daysUntil} days`;
  const weeks = Math.round(daysUntil / 7);
  return `in ${weeks} weeks`;
}

/** Mirror of the server's humaniseOccasion. Kept lowercase except
 *  proper nouns; CSS will capitalize for display. */
function humaniseOccasion(occasion: string): string {
  const lower = occasion.toLowerCase().trim();
  switch (lower) {
    case 'mothers_day':
      return "Mother's Day";
    case 'fathers_day':
      return "Father's Day";
    case 'valentines':
      return "Valentine's Day";
    case 'thankyou':
      return 'thank you';
    case 'baby':
      return 'new baby';
    default:
      return lower;
  }
}
