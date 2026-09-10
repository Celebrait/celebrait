// client/src/components/checkout/need-by.tsx — "When's the big day?"
//
// One postage option at launch (Aidan 2026-09-09), so the checkout's job
// is no longer "pick a speed" but "tell the truth about the date". Both
// checkouts (/buy and /checkout) render this: an optional date, and the
// moment it's set, a plain verdict — it'll be there with days to spare,
// it might make it but we can't promise, or the post won't make it (and
// the free digital link lands instantly either way). It never blocks.
//
// ONE date is ever quoted: "expect it by …", which is the promise
// ("allow at least a week") made concrete. No ranges, no earliest — a
// "Mon 14 – Thu 17" under "allow a week" contradicted itself (Aidan
// 2026-09-10). The maths lives in shared/pricing.ts so the order page,
// emails and admin say the same date.

import { CalendarDays, Check, AlertTriangle, Sparkles } from 'lucide-react';
import {
  arrivalVerdict,
  expectedBy,
  formatDayMonth,
  parseISODate,
  ORDER_AHEAD_DAYS,
  HONEST_LEAD_LINE,
} from '@shared/pricing';

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "Thu 17 Sept" — the date we promise for an order placed at `from`. */
export function expectedByCopy(from: Date = new Date()): string {
  return formatDayMonth(expectedBy(from));
}

export function NeedByField({
  value,
  onChange,
  recipientName,
  compact = false,
}: {
  value: string;
  onChange: (iso: string) => void;
  /** Woven into the copy when known. */
  recipientName?: string;
  /** Tighter spacing for the studio checkout's card sections. */
  compact?: boolean;
}) {
  const today = new Date();
  const needBy = parseISODate(value);
  const verdict = needBy ? arrivalVerdict(needBy, today) : null;
  const who = recipientName?.trim() || 'them';
  const by = formatDayMonth(expectedBy(today));

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label htmlFor="need-by" className="flex items-center gap-1.5 text-sm text-keeper-body">
          <CalendarDays className="h-4 w-4 text-keeper-meta" strokeWidth={1.75} />
          When's the big day?
          <span className="text-xs text-keeper-meta">optional</span>
        </label>
        <input
          id="need-by"
          type="date"
          value={value}
          min={toISO(today)}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-lg border border-keeper-hair bg-white px-3 text-sm text-keeper-ink outline-none focus:border-keeper-gold sm:ml-auto"
          data-testid="checkout-need-by"
        />
      </div>

      {!verdict ? (
        <p className="text-xs leading-relaxed text-keeper-meta">
          {HONEST_LEAD_LINE} Ordered today, expect it by{' '}
          <span className="font-medium text-keeper-ink">{by}</span>.
        </p>
      ) : verdict.tone === 'ok' ? (
        <p className="flex items-start gap-2 rounded-lg border border-cta/30 bg-cta-light px-3 py-2.5 text-xs leading-relaxed text-cta-dark" data-testid="need-by-verdict" data-tone="ok">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
          <span>
            <span className="font-semibold">It'll be there in time.</span> Ordered today, expect it by {by}
            {verdict.spareDays > 0 ? ` — ${verdict.spareDays} ${verdict.spareDays === 1 ? 'day' : 'days'} to spare` : ', the day itself'}.
          </span>
        </p>
      ) : verdict.tone === 'tight' ? (
        <p className="flex items-start gap-2 rounded-lg border border-brand-light bg-brand-muted px-3 py-2.5 text-xs leading-relaxed text-keeper-ink" data-testid="need-by-verdict" data-tone="tight">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>
            <span className="font-semibold">It might make it, but we can't promise it.</span> Our cards are one-off prints and we ask for at least {ORDER_AHEAD_DAYS} days — ordered today, expect it by {by}.
            It often lands sooner, but please have the free digital link ready as a backup on the day.
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-lg border border-accent-red/30 bg-accent-red-light px-3 py-2.5 text-xs leading-relaxed text-accent-red-dark" data-testid="need-by-verdict" data-tone="late">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>
            <span className="font-semibold">The post won't make it by then.</span> Ordered today, expect it by {by}.
            You can still order it — and send {who} the free digital link on the day, so they open something from you either way.
          </span>
        </p>
      )}
      {/* Too late this time → the reminders (Aidan 2026-09-09: "sign up,
          put some key dates in and we'll remind you in good time"). */}
      {verdict && verdict.tone !== 'ok' && (
        <p className="text-xs leading-relaxed text-keeper-meta">
          Next time, let us do the remembering: add {who === 'them' ? 'their' : `${who}'s`} dates in your studio and we email you three weeks, ten days and a week ahead.{' '}
          <a href="/studio/people/reminders" className="font-medium text-brand-dark underline underline-offset-2 hover:text-brand">Set up reminders</a>
        </p>
      )}
    </div>
  );
}
