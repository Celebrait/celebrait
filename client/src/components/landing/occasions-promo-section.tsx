// client/src/components/landing/occasions-promo-section.tsx
//
// "Never miss another one" — the landing's Occasions + free-card
// promotion (Aidan 2026-08-04). Replaces the old OccasionCaptureSection
// email form — the free-card mechanic is the same capture play with a
// real account and three dates attached instead of a lone email.
//
// The "visuals" are LIVE recreations of the studio home's band + Year
// Ahead card with demo data — the comet orbits, the next stone pings,
// right here on the page. Never a stale screenshot; always the current
// design system. Framed as an EXAMPLE so the second-person UI copy
// doesn't read as the visitor's own account.
//
// NOTE: the rotating statements deliberately live ONLY in the studio's
// Year Ahead now — tried on the landing (a dedicated ink band, then
// this section's inline line) and cut both: "too much for too little,
// not needed anywhere on the lander" (Aidan 2026-08-04).

import { Plus, Gift } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { ProgressRing } from '@/components/studio/moment-ring';
import { countdownLabel, daysToChristmas } from '@/lib/moments';
import { MomentIcon } from '@/components/studio/moment-icon';
import { CLAIM_EVENT, CLAIM_PARAM } from '@/components/landing/ticker-banner';
import { cardPrice, firstOrderPrice, shippingPrice } from '@shared/pricing';
import { useFirstCardOnUs } from '@/hooks/use-first-card-offer';
import { formatMoney } from '@shared/market';
import { market } from '@shared/market';

const DISPLAY = 'font-display font-bold tracking-[-0.015em] text-keeper-ink';
/** How far off the two example dates sit: one near enough to light up
 *  (the studio highlights anything within 30 days), one comfortably not. */
const MUM_IN_DAYS = 18;
const ANNIV_IN_DAYS = 96;

/** `door` picks the price the offer quotes (the ticker does the same):
 *  the number must be the number THIS door will charge — the line was
 *  hardcoded to the three-card price, so on /photo it promised
 *  £5.99→£2.99 for a card that is £6.99→£3.49 at checkout. Mounted on
 *  /photo (default) and, since 2026-10-09, on /create as `maker`. */
export function OccasionsPromoSection({ door = 'photo' }: { door?: 'photo' | 'maker' } = {}) {
  const onUs = useFirstCardOnUs();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const claim = () => {
    if (user) {
      setLocation('/studio');
    } else if (door === 'photo') {
      // The invite modal is mounted on the photo landing page.
      window.dispatchEvent(new CustomEvent(CLAIM_EVENT));
    } else {
      // No modal on /create — same trip the ticker makes from anywhere else.
      setLocation(`/photo?${CLAIM_PARAM}=1`);
    }
  };

  // The example rows' dates, always in the future relative to today.
  const inDays = (n: number) =>
    new Date(Date.now() + n * 86_400_000).toLocaleDateString(market().locale, { day: 'numeric', month: 'long' });
  const mumDate = inDays(MUM_IN_DAYS);
  const annivDate = inDays(ANNIV_IN_DAYS);

  return (
    <section id="dates" className="scroll-mt-32 px-6 py-16 md:pb-16 md:pt-32">
      {/* grid-cols-1 = minmax(0,1fr): without it the implicit column sizes
          to the year-ahead strip's min-width (340px+) and the whole section
          ran off the right edge on phones (Aidan's iPhone, 2026-11-11). The
          strip scrolls inside its own box instead. */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
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
            Tell us the days that matter: birthdays, anniversaries, the lot.
            We watch them all year and nudge you in good time, so the card's
            made in slippers, not in a panic. And for telling us three?{' '}
            {onUs ? (
              <>
                <strong className="text-keeper-ink">Your first card’s on us.</strong> Seriously. Just {formatMoney(shippingPrice())} postage.
              </>
            ) : (
              <>
                <strong className="text-keeper-ink">
                  50% off your first card
                </strong>:{' '}
                <span className="line-through">{formatMoney(cardPrice(door))}</span> <b>{formatMoney(firstOrderPrice(door))}</b>, plus
                postage.
              </>
            )}
          </p>

          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={claim}
              className="rounded-full bg-go px-7 py-3.5 text-base font-semibold text-go-foreground shadow-sm transition-colors hover:bg-go-hover"
              data-testid="occasions-promo-claim"
            >
              {onUs ? 'Claim my free card' : 'Claim 50% off'}
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
          aria-label="See your studio home and claim your free card"
          data-testid="occasions-promo-demo"
        >
          {/* Framing label — logged out, the UI's second-person copy
              ("Your first card's on us", "Mum's birthday") otherwise reads
              as if it's the visitor's own account (Aidan 2026-08-04). */}
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-keeper-meta">
              A look inside
            </p>
            <span className="rounded-full border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-keeper-meta">
              Example
            </span>
          </div>

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
                  <b className="text-keeper-ink">{onUs ? 'Your first card’s on us.' : '50% off your first card.'}</b> 1
                  more date, any day that matters, and it's {onUs ? 'yours' : 'half price'}.
                </p>
              </div>
              <span className="shrink-0 self-start rounded-full bg-go px-4 py-2 text-[12.5px] font-bold text-go-foreground sm:self-auto">
                Add a date
              </span>
            </div>
          </div>

          {/* THE OCCASIONS PAGE'S OWN ROWS (studio review, 2026-11-12).
              This used to be a one-off "year ahead" timeline drawn only
              here; the rows below are the exact design a signed-in
              customer sees on /studio/moments — same icon tile, same
              "name · occasion", same countdown pill, same dashed
              invitation row — so the example is the product, not a
              drawing of it. Dates are computed, so it never goes stale.
              (It was also the min-width strip that pushed this section
              off the side of phones.) */}
          <div className="mt-4">
            <div className="flex items-baseline justify-between px-1">
              <p className="font-display text-[17px] font-semibold tracking-[-0.01em] text-keeper-ink">
                Your occasions
              </p>
              <span className="text-[12px] font-bold text-brand">Whole year ›</span>
            </div>
            <div className="mt-2 space-y-2">
              {/* Near: the highlighted row, with its nudge to make the card. */}
              <div className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-white p-3 shadow-sm sm:gap-4 sm:p-3.5">
                <MomentIcon occasion="birthday" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-keeper-ink">
                    Mum<span className="font-normal text-keeper-body"> · Birthday</span>
                  </p>
                  <p className="text-[12px] text-keeper-meta">{mumDate}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-brand-foreground">
                    {countdownLabel(MUM_IN_DAYS)}
                  </span>
                  <span className="text-[11.5px] font-medium text-brand">Make the card ›</span>
                </div>
              </div>
              {/* Further off: quiet, with the promise. */}
              <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:gap-4 sm:p-3.5">
                <MomentIcon occasion="anniversary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-keeper-ink">
                    Sam & Jo<span className="font-normal text-keeper-body"> · Anniversary</span>
                  </p>
                  <p className="text-[12px] text-keeper-meta">{annivDate}. We’ll nudge you in plenty of time</p>
                </div>
                <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-keeper-body">
                  {countdownLabel(ANNIV_IN_DAYS)}
                </span>
              </div>
              {/* On every calendar: the dashed invitation. */}
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 p-3 sm:gap-4 sm:p-3.5">
                <MomentIcon occasion="christmas" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold text-keeper-ink">Christmas</p>
                  <p className="text-[12px] text-keeper-meta">25 December · in {daysToChristmas()} days</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11.5px] font-medium text-keeper-ink">
                  <Plus className="h-3 w-3" strokeWidth={2.5} /> Add them
                </span>
              </div>
            </div>
          </div>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-keeper-meta">
            <Gift className="h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={2} />
            This is the home you get, with your people on it.
          </p>
        </div>
      </div>
    </section>
  );
}
