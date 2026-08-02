// client/src/pages/studio-moments.tsx
//
// MOMENTS — the one roof over people + dates (Kevin 2026-07-31/08-01,
// spec: memory/next_moments_hub_rewards.md). Replaces Address book +
// Reminders in the nav (both old pages stay routable — this is the
// front door, not a rewrite of their guts).
//
// Three ideas, in order of appearance:
//
//   1. THE RING — "your first card's on us". Three segments, one per
//      key date added. Fills as dated occasions land in the address
//      book; at 3 it ignites into the free-card credit. This is the
//      remarkable-without-a-sale mechanic: the reward for telling us
//      who matters is the product itself.
//
//   2. THE RIVER — upcoming moments, nearest first, each carrying the
//      PERSON (presence-of-person > metadata, 2026-05 principle). NOT
//      a month grid: grids read as 28 empty boxes. A river is always
//      full because…
//
//   3. …NATIONAL MOMENTS are seeded in (Christmas, Mother's Day,
//      Father's Day, Valentine's). A brand-new account sees a living
//      year with gaps that invite filling — "Who's your Mother's Day
//      card for?" — instead of an empty state.
//
// Data: entirely the EXISTING endpoints (/api/user/reminders for dated
// occasions, /api/user/address-book for people-count states). National
// dates are a client-side table — they're public facts, not user data.

import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarHeart,
  Gift,
  Plus,
  Sparkles,
  ChevronRight,
  Bell,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

// ── National moments ─────────────────────────────────────────────────
// Public-fact dates, resolved client-side. Movable feasts are a lookup
// table (Mothering Sunday tracks Easter; Father's Day is the third
// Sunday of June) — a table is auditable at a glance, a computation of
// Easter is not. Extend before 2030.
const NATIONAL_TABLE: Record<string, string[]> = {
  "Mother's Day": ['2026-03-15', '2027-03-07', '2028-03-26', '2029-03-11', '2030-03-31'],
  "Father's Day": ['2026-06-21', '2027-06-20', '2028-06-18', '2029-06-17', '2030-06-16'],
};

interface NationalMoment {
  label: string;
  occurrenceDate: string;
  daysUntil: number;
  prompt: string;
}

function nextNationalMoments(today: Date): NationalMoment[] {
  const out: NationalMoment[] = [];
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = (iso: string) =>
    Math.round((new Date(iso + 'T00:00:00').getTime() - midnight.getTime()) / 86_400_000);

  for (const [label, dates] of Object.entries(NATIONAL_TABLE)) {
    const next = dates.find((d) => days(d) >= 0);
    if (next) {
      out.push({
        label,
        occurrenceDate: next,
        daysUntil: days(next),
        prompt:
          label === "Mother's Day"
            ? 'Who’s your Mother’s Day card for?'
            : 'Who’s your Father’s Day card for?',
      });
    }
  }
  // Fixed-date pair: next occurrence this year or roll to next.
  for (const [label, mmdd, prompt] of [
    ["Valentine's Day", '02-14', 'Someone in mind?'],
    ['Christmas', '12-25', 'Who gets the first card of Christmas?'],
  ] as const) {
    const thisYear = `${today.getFullYear()}-${mmdd}`;
    const iso = days(thisYear) >= 0 ? thisYear : `${today.getFullYear() + 1}-${mmdd}`;
    out.push({ label, occurrenceDate: iso, daysUntil: days(iso), prompt });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ── The ring ─────────────────────────────────────────────────────────
function ProgressRing({ filled }: { filled: number }) {
  // Three arcs on a circle, gapped, filled clockwise as dates land.
  const R = 44;
  const C = 2 * Math.PI * R;
  const seg = C / 3;
  const gap = 8;
  return (
    <svg viewBox="0 0 110 110" className="h-28 w-28 -rotate-90">
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx="55"
          cy="55"
          r={R}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${seg - gap} ${C - seg + gap}`}
          strokeDashoffset={-i * seg}
          className={
            i < filled
              ? 'stroke-go transition-all duration-700'
              : 'stroke-stone-200'
          }
        />
      ))}
    </svg>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
}

function countdownLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 30) return `${days} days`;
  if (days < 60) return 'Next month';
  return new Date(Date.now() + days * 86_400_000).toLocaleDateString('en-GB', {
    month: 'long',
  });
}

export default function StudioMomentsPage() {
  const { data: reminders, isLoading: remindersLoading } = useQuery<UpcomingReminder[]>({
    queryKey: ['/api/user/reminders'],
  });
  const { data: people, isLoading: peopleLoading } = useQuery<AddressBookEntry[]>({
    queryKey: ['/api/user/address-book'],
  });

  const loading = remindersLoading || peopleLoading;
  const upcoming = (reminders ?? [])
    .filter((r) => !r.suppressed)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // A "key date" = a distinct dated occasion. The ring counts these.
  const keyDates = new Set((reminders ?? []).map((r) => r.occasionId)).size;
  const ringFilled = Math.min(3, keyDates);
  const unlocked = keyDates >= 3;

  const nationals = nextNationalMoments(new Date());
  // Hide a national when the user already tracks a same-named occasion
  // for someone (their "Mother's Day" for Mum outranks the generic one).
  const trackedLabels = new Set(upcoming.map((r) => r.occasion.toLowerCase()));
  const visibleNationals = nationals.filter(
    (n) => !trackedLabels.has(n.label.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24">
      <div className="flex items-start justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-[-0.015em] text-keeper-ink">
            Moments
          </h1>
          <p className="mt-1 text-sm text-keeper-body">
            The dates that matter, watched for you.
          </p>
        </div>
        <Link href="/studio/people/address-book/new">
          <Button
            className="bg-go hover:bg-go-hover text-go-foreground rounded-full"
            data-testid="btn-add-moment"
          >
            <Plus className="mr-1.5 h-4 w-4" strokeWidth={2.5} />
            Add a date
          </Button>
        </Link>
      </div>

      {/* ── The free-card ring ─────────────────────────────────── */}
      <div
        className={`mt-6 rounded-2xl border p-5 ${
          unlocked
            ? 'border-go/40 bg-gradient-to-br from-emerald-50 to-white'
            : 'border-stone-200 bg-white'
        }`}
        data-testid="free-card-ring"
      >
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <ProgressRing filled={ringFilled} />
            <div className="absolute inset-0 flex items-center justify-center">
              {unlocked ? (
                <Gift className="h-8 w-8 text-go" strokeWidth={2} />
              ) : (
                <span className="text-lg font-bold text-keeper-ink">
                  {ringFilled}
                  <span className="text-keeper-meta">/3</span>
                </span>
              )}
            </div>
          </div>
          <div className="min-w-0">
            {unlocked ? (
              <>
                <p className="text-[15px] font-bold text-keeper-ink">
                  Unlocked — your first card’s on us
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-keeper-body">
                  <span className="line-through text-keeper-meta">£8.99</span>{' '}
                  <span className="font-semibold text-go">Free</span> — just
                  cover the postage. It’s waiting whenever a moment comes round.
                </p>
                <Link href="/studio/new-card">
                  <Button
                    size="sm"
                    className="mt-2 rounded-full bg-go hover:bg-go-hover text-go-foreground"
                    data-testid="btn-make-free-card"
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Make your free card
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <p className="text-[15px] font-bold text-keeper-ink">
                  Your first card’s on us
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-keeper-body">
                  Add {3 - ringFilled} more key{' '}
                  {3 - ringFilled === 1 ? 'date' : 'dates'} — a birthday, an
                  anniversary, any day that matters — and your first card is
                  free. We’ll watch every date you add, forever.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── The river ──────────────────────────────────────────── */}
      <div className="mt-8 space-y-3">
        {loading && (
          <p className="text-sm text-keeper-meta animate-pulse">
            Gathering your moments…
          </p>
        )}

        {!loading && upcoming.length === 0 && (people?.length ?? 0) === 0 && (
          <p className="text-sm leading-relaxed text-keeper-body">
            No dates of your own yet — the ones below are on every calendar.
            Add the people they belong to and this page starts working for
            you.
          </p>
        )}

        {upcoming.map((r) => {
          const near = r.daysUntil <= 30;
          return (
            <div
              key={r.occasionId}
              className={`flex items-center gap-4 rounded-2xl border bg-white p-4 ${
                near ? 'border-brand/40 shadow-sm' : 'border-stone-200'
              }`}
              data-testid={`moment-${r.occasionId}`}
            >
              {/* The person, present — initial-avatar until photos land. */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-muted text-lg font-bold text-brand-dark">
                {r.recipientName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-keeper-ink">
                  {r.recipientName}
                  <span className="font-normal text-keeper-body">
                    {' '}
                    · {r.occasion}
                  </span>
                </p>
                <p className="text-[12.5px] text-keeper-meta">
                  {fmtDate(r.occurrenceDate)}
                  {!near && ' — we’ll nudge you in plenty of time'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    near
                      ? 'bg-brand text-brand-foreground'
                      : 'bg-stone-100 text-keeper-body'
                  }`}
                >
                  {countdownLabel(r.daysUntil)}
                </span>
                {near && (
                  <Link href="/studio/new-card">
                    <span className="inline-flex items-center text-[12px] font-medium text-brand hover:text-brand-dark">
                      Make the card <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {/* Seeded national moments — lighter treatment, each an invitation. */}
        {visibleNationals.map((n) => (
          <div
            key={n.label}
            className="flex items-center gap-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 p-4"
            data-testid={`national-${n.label}`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white border border-stone-200">
              <CalendarHeart className="h-5 w-5 text-keeper-meta" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-keeper-ink">{n.label}</p>
              <p className="text-[12.5px] text-keeper-meta">
                {fmtDate(n.occurrenceDate)} · {n.prompt}
              </p>
            </div>
            <Link href="/studio/people/address-book/new">
              <span className="inline-flex shrink-0 items-center rounded-full border border-stone-300 px-3 py-1 text-[12px] font-medium text-keeper-body hover:border-brand hover:text-brand">
                <Plus className="mr-1 h-3.5 w-3.5" /> Add them
              </span>
            </Link>
          </div>
        ))}
      </div>

      {/* Quiet doors to the old management surfaces — nothing is lost. */}
      <div className="mt-10 flex items-center justify-center gap-6 text-[12.5px] text-keeper-meta">
        <Link href="/studio/people/address-book">
          <span className="inline-flex items-center gap-1.5 hover:text-keeper-body">
            <Users className="h-3.5 w-3.5" /> Everyone you’ve added
          </span>
        </Link>
        <Link href="/studio/people/reminders">
          <span className="inline-flex items-center gap-1.5 hover:text-keeper-body">
            <Bell className="h-3.5 w-3.5" /> Reminder settings
          </span>
        </Link>
      </div>
    </div>
  );
}
