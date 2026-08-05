// client/src/components/landing/occasions-promo-section.tsx
//
// "Never miss another one" — the landing's Occasions + free-card
// promotion (Aidan 2026-08-04: "pad out the lander with the rotating
// statements… add the occasions stuff… visuals from the Home in
// studio"). Replaces the old OccasionCaptureSection email form — the
// free-card mechanic is the same capture play with a real account and
// three dates attached instead of a lone email address.
//
// The "visuals" are LIVE recreations of the studio home's band + Year
// Ahead card with demo data — the comet orbits, the next stone pings,
// the statements rotate, right here on the page. Never a stale
// screenshot; always the current design system.

import { Plus, Sparkles, Gift } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { ProgressRing } from '@/components/studio/moment-ring';
import { occasionFacts, daysToChristmas } from '@/lib/moments';
import { CLAIM_EVENT } from '@/components/landing/ticker-banner';

const DISPLAY = 'font-display font-bold tracking-[-0.015em] text-keeper-ink';

export function OccasionsPromoSection() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const facts = occasionFacts();

  const claim = () => {
    if (user) {
      setLocation('/studio');
    } else {
      window.dispatchEvent(new CustomEvent(CLAIM_EVENT));
    }
  };

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <section id="occasions" className="px-6 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* ── Copy column ── */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-brand-dark">
            The dates that matter
          </p>
          <h2
            className={`mt-3 text-[clamp(30px,4.4vw,44px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}
          >
            Never miss another one.
          </h2>
          <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.6] text-keeper-body">
            Tell us the days that matter — birthdays, anniversaries, the lot.
            We watch them all year and nudge you in good time, so the card's
            made in slippers, not in a panic. And for telling us three?{' '}
            <strong className="text-keeper-ink">
              Your first card's on us
            </strong>{' '}
            — <span className="line-through">£8.99</span> <b>£0</b>, just the
            postage.
          </p>

          {/* The rotating statements — the section's heartbeat. */}
          <div className="mt-7 flex min-h-[76px] items-start gap-3 sm:min-h-[56px]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-muted">
              <Sparkles className="h-4 w-4 text-brand" strokeWidth={2} />
            </span>
            <div className="ya-facts relative min-h-[72px] flex-1 pt-1 sm:min-h-[52px]">
              {facts.map((f, i) => (
                <span
                  key={i}
                  className="absolute inset-0 text-[15px] leading-snug text-keeper-body"
                  style={{ animationDelay: `${i * 6}s` }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={claim}
              className="rounded-full bg-go px-7 py-3.5 text-base font-semibold text-go-foreground shadow-sm transition-colors hover:bg-go-hover"
              data-testid="occasions-promo-claim"
            >
              Claim your free card
            </button>
            <p className="text-[12.5px] text-keeper-meta">
              One per account. Takes about a minute.
            </p>
          </div>
        </div>

        {/* ── Live demo column — the studio home, working. ── */}
        <div
          role="button"
          tabIndex={0}
          onClick={claim}
          onKeyDown={(e) => e.key === 'Enter' && claim()}
          className="cursor-pointer rounded-[28px] border border-keeper-hair bg-[#FAF8F4] p-4 shadow-[0_30px_70px_-30px_rgba(33,29,25,.35)] transition-transform hover:scale-[1.01] sm:p-5"
          aria-label="See your studio home — claim your free card"
          data-testid="occasions-promo-demo"
        >
          {/* The free-card band, live. */}
          <div className="rounded-2xl bg-gradient-to-r from-[#211D19] via-[#5c57d4] to-[#8B87E8] p-[1.5px] shadow-[0_16px_34px_-20px_rgba(92,87,212,0.55)]">
            <div className="flex flex-col gap-3 rounded-[14.5px] bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:gap-3.5">
              <div className="flex items-center gap-3.5 sm:contents">
                <div className="relative h-12 w-12 shrink-0">
                  <ProgressRing filled={2} size={48} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-keeper-ink">
                      2<span className="font-semibold text-keeper-meta">/3</span>
                    </span>
                  </div>
                </div>
                <p className="min-w-0 flex-1 text-[13px] leading-snug text-keeper-body">
                  <b className="text-keeper-ink">Your first card's on us.</b> 1
                  more date — any day that matters — and it's free.
                </p>
              </div>
              <span className="shrink-0 self-start rounded-full bg-go px-4 py-2 text-[12.5px] font-bold text-go-foreground sm:self-auto">
                Add a date
              </span>
            </div>
          </div>

          {/* The Year Ahead card, live. */}
          <div className="mt-4">
            <div className="flex items-baseline justify-between px-1">
              <p className="font-display text-[17px] font-semibold tracking-[-0.01em] text-keeper-ink">
                The year ahead
              </p>
              <span className="text-[12px] font-bold text-brand">Whole year ›</span>
            </div>
            <div className="mt-2 rounded-2xl border border-stone-200 bg-white px-2 pb-2 pt-1">
              <div className="ya-scroll overflow-x-auto">
              <div className="relative flex min-w-[340px] px-1 pb-3 pt-7">
                <div
                  aria-hidden
                  className="absolute left-3 right-3 top-[62px] h-[3px] rounded bg-[#E9E6F8]"
                />
                <div className="relative flex min-w-[84px] flex-1 flex-col items-center gap-1.5">
                  <span className="absolute top-1 text-[10px] font-bold tracking-[0.14em] text-keeper-meta">
                    {new Date()
                      .toLocaleDateString('en-GB', { month: 'short' })
                      .toUpperCase()}
                  </span>
                  <div className="z-[1] mt-[30px] h-3 w-3 rounded-full bg-keeper-ink" />
                  <span className="text-[13px] font-bold leading-tight text-keeper-ink">
                    Today
                  </span>
                  <span className="text-[11px] text-keeper-meta">{todayLabel}</span>
                </div>
                <div className="relative flex min-w-[84px] flex-1 flex-col items-center gap-1.5">
                  <div className="z-[1] mt-[27px] flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-brand bg-brand-muted">
                    <Plus className="h-2.5 w-2.5 text-brand" strokeWidth={4} />
                  </div>
                  <span className="text-[13px] font-bold leading-tight text-brand">
                    Add a day
                  </span>
                  <span className="text-[11px] text-keeper-meta">any day</span>
                </div>
                <div className="relative flex min-w-[84px] flex-1 flex-col items-center gap-1.5">
                  <span className="absolute top-1 text-[10px] font-bold tracking-[0.14em] text-keeper-meta">
                    NOV
                  </span>
                  <span className="z-[1] mt-[26px] block h-[18px] w-[18px] rounded-full border-2 border-white bg-brand shadow-[0_0_0_2px_#5c57d4]" />
                  <span className="max-w-[100px] truncate text-center text-[13px] font-bold leading-tight text-keeper-ink">
                    Mum's birthday
                  </span>
                  <span className="rounded-full bg-brand-muted px-2 py-0.5 text-[10.5px] font-bold text-brand-dark">
                    in 3 wks
                  </span>
                </div>
                <div className="relative flex min-w-[84px] flex-1 flex-col items-center gap-1.5">
                  <span className="absolute top-1 text-[10px] font-bold tracking-[0.14em] text-keeper-meta">
                    DEC
                  </span>
                  <span className="z-[1] mt-[26px] block h-[18px] w-[18px] rounded-full border-2 border-dashed border-[#B9B3E8] bg-white" />
                  <span className="text-center text-[13px] font-semibold leading-tight text-keeper-body">
                    Christmas
                  </span>
                  <span className="rounded-full border border-dashed border-[#C9C4EE] px-2 py-0.5 text-[10.5px] font-semibold text-keeper-meta">
                    in {daysToChristmas()} days
                  </span>
                </div>
              </div>
              </div>
            </div>
          </div>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-keeper-meta">
            <Gift className="h-3.5 w-3.5 text-brand" strokeWidth={2} />
            Your studio home, watching the year for you — live, not a mock-up.
          </p>
        </div>
      </div>
    </section>
  );
}
