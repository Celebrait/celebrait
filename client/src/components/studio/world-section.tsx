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
import { Plus, Gift } from 'lucide-react';
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
  const rest = upcoming.slice(1, 3);

  const keyDates = new Set((reminders ?? []).map((r) => r.occasionId)).size;
  const unlocked = keyDates >= 3;
  // Once the credit's spent the band retires — a redeemed account must
  // never be promised a second free card.
  const { data: freeCard } = useQuery<{ redeemed: boolean }>({
    queryKey: ['/api/user/free-card'],
  });
  const redeemed = freeCard?.redeemed === true;

  // One national invitation keeps the river alive; fewer shown here
  // than on /studio/moments — the home is a glance, not the archive.
  const nationals = nextNationalMoments(new Date());
  const tracked = new Set(upcoming.map((r) => r.occasion.toLowerCase()));
  const invite = nationals.find((n) => !tracked.has(n.label.toLowerCase()));

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

      {/* The free-card band — a gift being mentioned, not a banner.
          Retires for good once the credit is spent. */}
      {!redeemed && (
      <div
        className="mt-3.5 flex items-center gap-3 rounded-2xl bg-brand-muted/60 px-4 py-3"
        data-hint="free-card"
        data-testid="world-ring-band"
      >
        {unlocked ? (
          <Gift className="h-9 w-9 shrink-0 text-brand" strokeWidth={1.75} />
        ) : (
          <div className="relative h-12 w-12 shrink-0">
            {/* A slow soft pulse of light behind the ring — alive, not inert. */}
            <div
              aria-hidden
              className="animate-ring-glow absolute inset-[-6px] rounded-full bg-brand/20 blur-md"
            />
            <ProgressRing filled={keyDates} size={48} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-bold text-keeper-ink">
                {Math.min(3, keyDates)}
                <span className="font-semibold text-keeper-meta">/3</span>
              </span>
            </div>
          </div>
        )}
        <p className="text-[12.5px] leading-snug text-keeper-body">
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
              day that matters — and it’s free.{' '}
              <button
                type="button"
                onClick={() => openAdd()}
                className="font-bold text-brand hover:text-brand-dark"
              >
                Add one ›
              </button>
            </>
          )}
        </p>
      </div>
      )}

      {/* Condensed river — zero-card accounts only, see prop doc. */}
      {showRiver && (rest.length > 0 || invite) && (
        <>
          <p className="mt-6 mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-keeper-meta">
            Coming up in your world
          </p>
          <div className="space-y-2">
            {rest.map((r) => (
              <div
                key={r.occasionId}
                className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3.5 py-2.5"
              >
                <MomentIcon occasion={r.occasion} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-keeper-ink">
                    {r.recipientName}
                  </p>
                  <p className="text-[11.5px] text-keeper-meta">
                    {occasionLabel(r.occasion)} · {fmtMomentDate(r.occurrenceDate)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-keeper-body">
                  {countdownLabel(r.daysUntil)}
                </span>
              </div>
            ))}
            {invite && (
              <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-stone-300 bg-stone-50/60 px-3.5 py-2.5">
                <MomentIcon occasion={invite.label} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold text-keeper-ink">{invite.label}</p>
                  <p className="text-[11.5px] text-keeper-meta">{invite.prompt}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openAdd(invite.label)}
                  className="inline-flex shrink-0 items-center rounded-full border border-[#cfcaf0] px-3 py-1 text-[11.5px] font-semibold text-brand hover:border-brand"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add them
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="mt-3 text-center">
        <Link href="/studio/moments">
          <span className="text-[12.5px] font-semibold text-brand hover:text-brand-dark">
            See your whole year ›
          </span>
        </Link>
      </div>

      <QuickAddMoment open={addOpen} onOpenChange={setAddOpen} presetOccasion={preset} />
    </section>
  );
}
