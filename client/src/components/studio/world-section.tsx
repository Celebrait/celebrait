// client/src/components/studio/world-section.tsx
//
// "Your world" — the top of the studio home (redesign step B, built to
// the approved mock; spec: memory/next_moments_hub_rewards.md).
//
// Order is the argument: the next moment in THEIR life leads the page,
// the free-card ring is woven in as a quiet band beneath it, then a
// two-item river with one national invitation. Cards and commerce come
// after — this page greets a person, not a customer.

import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Plus, Gift, Sparkles } from 'lucide-react';
import {
  type UpcomingReminder,
  nextNationalMoments,
  fmtMomentDate,
  countdownLabel,
  occasionLabel,
} from '@/lib/moments';
import { QuickAddMoment } from '@/components/studio/quick-add-moment';
import { MomentIcon } from '@/components/studio/moment-icon';
import { ProgressRing } from '@/components/studio/moment-ring';

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

interface TimelineStop {
  kind: 'mine' | 'national';
  id: string;
  date: string;
  month: string;
  label: string;
  chip: string;
}

/** Short invitation chips for the unclaimed national stops. */
/** Countdown chip that never duplicates the month tick above it. */
function chipLabel(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 21) return `in ${days} days`;
  if (days < 70) return `in ${Math.round(days / 7)} wks`;
  return `in ${Math.round(days / 30.4)} mths`;
}

const CLAIM_CHIP: Record<string, string> = {
  Christmas: 'whose card?',
  "Valentine's Day": 'someone in mind?',
  "Mother's Day": 'whose card?',
  "Father's Day": 'whose card?',
};

/** The rotating line — first one is date-aware, the rest are warmth.
 *  Copy voice: "we", never "the AI". */
function daysToChristmas(): number {
  const now = new Date();
  let xmas = new Date(now.getFullYear(), 11, 25);
  if (xmas < now) xmas = new Date(now.getFullYear() + 1, 11, 25);
  return Math.ceil((xmas.getTime() - now.getTime()) / 86_400_000);
}
const FACTS: string[] = [
  `Christmas is in ${daysToChristmas()} days. The best cards get made in slippers, not in a panic.`,
  'Mothering Sunday moves with Easter every year — we track it so you never have to.',
  'The average Brit forgets three birthdays a year. Not you. Not any more.',
  "A kept card outlives a text by years — mantelpieces don't have notification settings.",
];

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

export function WorldSection({
  name,
  showRiver = true,
}: {
  name: string;
  /** The river earns its place only when there's nothing else on the
   *  page (zero-card accounts — the data-capture audience). For anyone
   *  with cards in play it pushed Ready-to-send below the fold on
   *  mobile (Kevin 2026-08-01), and the hero + "See your whole year"
   *  already cover the moments. */
  showRiver?: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [preset, setPreset] = useState<string | undefined>(undefined);
  const openAdd = (occasion?: string) => {
    setPreset(occasion);
    setAddOpen(true);
  };

  const { data: reminders } = useQuery<UpcomingReminder[]>({
    queryKey: ['/api/user/reminders'],
  });

  const upcoming = (reminders ?? [])
    .filter((r) => !r.suppressed)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const next = upcoming[0];

  const keyDates = new Set((reminders ?? []).map((r) => r.occasionId)).size;
  const unlocked = keyDates >= 3;
  // Once the credit's spent the band retires — a redeemed account must
  // never be promised a second free card.
  const { data: freeCard } = useQuery<{ redeemed: boolean }>({
    queryKey: ['/api/user/free-card'],
  });
  const redeemed = freeCard?.redeemed === true;

  // Timeline stops: ALL the user's dates (including the hero's — a
  // year-line missing your only date reads as broken; Aidan 2026-08-04)
  // plus unclaimed nationals, merged and date-ordered. Capped at 3 date
  // stops (visual audit 2026-08-04: fewer, bigger — the whole line then
  // fits a phone without scrolling). Occasions is the archive.
  const nationals = nextNationalMoments(new Date());
  const tracked = new Set(upcoming.map((r) => r.occasion.toLowerCase()));
  const timeline: TimelineStop[] = [
    ...upcoming.map((r) => ({
      kind: 'mine' as const,
      id: String(r.occasionId),
      date: r.occurrenceDate,
      month: MONTH_ABBR[new Date(r.occurrenceDate).getMonth()],
      label: `${r.recipientName}'s ${occasionLabel(r.occasion).toLowerCase()}`,
      chip: chipLabel(r.daysUntil),
    })),
    ...nationals
      .filter((n) => !tracked.has(n.label.toLowerCase()))
      .map((n) => ({
        kind: 'national' as const,
        id: n.label,
        date: n.occurrenceDate,
        month: MONTH_ABBR[new Date(n.occurrenceDate).getMonth()],
        label: n.label,
        chip: CLAIM_CHIP[n.label] ?? 'whose card?',
      })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  return (
    <section className="mb-12" data-testid="world-section">
      {/* Greeting + the single most relevant fact in their world. */}
      <p className="text-[15px] text-keeper-meta">
        {timeGreeting()}, {name}
      </p>
      <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold tracking-[-0.015em] text-keeper-ink text-balance">
        {next ? (
          <>
            {next.recipientName}’s {occasionLabel(next.occasion)} is{' '}
            <span className="text-brand">
              {next.daysUntil === 0
                ? 'today'
                : next.daysUntil === 1
                  ? 'tomorrow'
                  : `in ${next.daysUntil} days`}
            </span>
            .
          </>
        ) : (
          <>Let’s make someone’s day.</>
        )}
      </h1>

      {/* Hero — the nearest moment as a physical thing with a door in. */}
      {next && (
        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_10px_24px_-18px_rgba(33,29,25,.4)]">
          <MomentIcon occasion={next.occasion} size="lg" />
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-keeper-ink">
              {next.recipientName} · {occasionLabel(next.occasion)}
            </p>
            <p className="text-[12.5px] text-keeper-meta">
              {fmtMomentDate(next.occurrenceDate)}
            </p>
            <Link href="/studio/new-card">
              <span
                className="mt-2 inline-block rounded-full bg-go px-4 py-2 text-[13px] font-bold text-go-foreground hover:bg-go-hover"
                data-testid="btn-start-next-card"
              >
                Start the card
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* The free-card band — the offer deserves presence (Aidan
          2026-08-04): gradient-edged card in the banner's ink→violet
          identity, white interior, soft violet lift, and a real button.
          Retires for good once the credit is spent. */}
      {!redeemed && (
      <div
        className="mt-3.5 rounded-2xl bg-gradient-to-r from-[#211D19] via-[#5c57d4] to-[#8B87E8] p-[1.5px] shadow-[0_16px_34px_-20px_rgba(92,87,212,0.55)]"
        data-hint="free-card"
        data-testid="world-ring-band"
      >
      <div className="flex items-center gap-3.5 rounded-[14.5px] bg-white px-4 py-3.5">
        {unlocked ? (
          <Gift className="h-9 w-9 shrink-0 text-brand" strokeWidth={1.75} />
        ) : (
          <div className="relative h-12 w-12 shrink-0">
            <ProgressRing filled={keyDates} size={48} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-bold text-keeper-ink">
                {Math.min(3, keyDates)}
                <span className="font-semibold text-keeper-meta">/3</span>
              </span>
            </div>
          </div>
        )}
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-keeper-body">
          {unlocked ? (
            <>
              <b className="text-keeper-ink">Your first card’s free</b> —{' '}
              <span className="line-through">£8.99</span> £0, just the postage.
              It’s waiting whenever a moment comes round.
            </>
          ) : (
            <>
              <b className="text-keeper-ink">Your first card’s on us.</b>{' '}
              {3 - keyDates} more {3 - keyDates === 1 ? 'date' : 'dates'} — any
              day that matters — and it’s free.
            </>
          )}
        </p>
        {unlocked ? (
          <Link href="/studio/new-card">
            <span className="shrink-0 rounded-full bg-go px-4 py-2 text-[12.5px] font-bold text-go-foreground hover:bg-go-hover">
              Make it free
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => openAdd()}
            className="shrink-0 rounded-full bg-go px-4 py-2 text-[12.5px] font-bold text-go-foreground hover:bg-go-hover"
            data-testid="band-add-date"
          >
            Add a date
          </button>
        )}
      </div>
      </div>
      )}

      {/* ── The year ahead — zero-card accounts only (see prop doc). ──
          Replaces the "Coming up in your world" rows (Aidan 2026-08-03:
          "simpler language… a snapshot timeline… feels ALIVE"). A
          swipeable timeline anchored at Today: the user's own dates as
          solid stops, unclaimed national days as dashed invitations, a
          "+" stop into the quick-add. One rotating line beneath keeps
          it warm; built to the approved year-ahead mock. */}
      {showRiver && (
        <div className="mt-7">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-[19px] font-semibold tracking-[-0.01em] text-keeper-ink">
              The year ahead
            </p>
            <Link href="/studio/moments">
              <span className="text-[12px] font-bold text-brand hover:text-brand-dark">
                Whole year ›
              </span>
            </Link>
          </div>
          <p className="mt-0.5 max-w-[46ch] text-[13px] text-keeper-meta">
            The days worth a card, from today. Add yours — we'll nudge you
            in good time.
          </p>

          <div className="mt-3 rounded-2xl border border-stone-200 bg-white px-2 pb-2 pt-1 shadow-[0_10px_24px_-18px_rgba(33,29,25,.4)]">
          <div className="ya-scroll overflow-x-auto">
            <div className="relative flex min-w-[340px] px-1 pb-3 pt-7">
              {/* the track */}
              <div
                aria-hidden
                className="absolute left-3 right-3 top-[62px] h-[3px] rounded bg-[#E9E6F8]"
              />
              {/* Today */}
              <div className="relative flex min-w-[64px] flex-1 flex-col items-center gap-1.5">
                <span className="absolute top-1 text-[10px] font-bold tracking-[0.14em] text-keeper-meta">
                  {MONTH_ABBR[new Date().getMonth()]}
                </span>
                <div className="z-[1] mt-[30px] h-3 w-3 rounded-full bg-keeper-ink" />
                <span className="text-[13px] font-bold leading-tight text-keeper-ink">Today</span>
                <span className="text-[11px] text-keeper-meta">
                  {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              {/* + Add a day */}
              <button
                type="button"
                onClick={() => openAdd()}
                className="relative flex min-w-[72px] flex-1 flex-col items-center gap-1.5"
                data-testid="ya-add-stop"
              >
                <div className="z-[1] mt-[27px] flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-brand bg-brand-muted">
                  <Plus className="h-2.5 w-2.5 text-brand" strokeWidth={4} />
                </div>
                <span className="text-[13px] font-bold leading-tight text-brand">Add a day</span>
                <span className="text-[11px] text-keeper-meta">any day</span>
              </button>
              {/* the user's own dates + unclaimed nationals, by date */}
              {timeline.map((t) =>
                t.kind === 'mine' ? (
                  <Link key={`m-${t.id}`} href="/studio/moments">
                    <span className="relative flex min-w-[92px] flex-1 cursor-pointer flex-col items-center gap-1.5">
                      <span className="absolute top-1 text-[10px] font-bold tracking-[0.14em] text-keeper-meta">
                        {t.month}
                      </span>
                      <span className="z-[1] mt-[26px] block h-[18px] w-[18px] rounded-full border-2 border-white bg-brand shadow-[0_0_0_2px_#5c57d4]" />
                      <span className="max-w-[100px] truncate text-center text-[13px] font-bold leading-tight text-keeper-ink">
                        {t.label}
                      </span>
                      <span className="rounded-full bg-brand-muted px-2 py-0.5 text-[10.5px] font-bold text-brand-dark">
                        {t.chip}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <button
                    key={`n-${t.id}`}
                    type="button"
                    onClick={() => openAdd(t.id)}
                    className="relative flex min-w-[92px] flex-1 flex-col items-center gap-1.5"
                    data-testid={`ya-claim-${t.id}`}
                  >
                    <span className="absolute top-1 text-[10px] font-bold tracking-[0.14em] text-keeper-meta">
                      {t.month}
                    </span>
                    <span className="z-[1] mt-[26px] block h-[18px] w-[18px] rounded-full border-2 border-dashed border-[#B9B3E8] bg-white" />
                    <span className="text-center text-[13px] font-semibold leading-tight text-keeper-body">
                      {t.label}
                    </span>
                    <span className="rounded-full border border-dashed border-[#C9C4EE] px-2 py-0.5 text-[10.5px] font-semibold text-keeper-meta">
                      {t.chip}
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>

          {/* One rotating line — date-aware nudges + warm facts. */}
          <div className="mx-2 flex min-h-[44px] items-start gap-2.5 border-t border-stone-100 px-1 pt-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-muted">
              <Sparkles className="h-3.5 w-3.5 text-brand" strokeWidth={2} />
            </span>
            <div className="ya-facts relative flex-1 pt-0.5">
              {FACTS.map((f, i) => (
                <span
                  key={i}
                  className="absolute inset-0 text-[13px] leading-snug text-keeper-body"
                  style={{ animationDelay: `${i * 6}s` }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
          </div>
        </div>
      )}

      {!showRiver && (
        <div className="mt-3 text-center">
          <Link href="/studio/moments">
            <span className="text-[12.5px] font-semibold text-brand hover:text-brand-dark">
              See your whole year ›
            </span>
          </Link>
        </div>
      )}

      <QuickAddMoment open={addOpen} onOpenChange={setAddOpen} presetOccasion={preset} />
    </section>
  );
}
