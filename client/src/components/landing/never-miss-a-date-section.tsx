// client/src/components/landing/never-miss-a-date-section.tsx
//
// Sells the platform value (vs one-shot card-makers): address book +
// reminders. The thing competitors can't match because they don't have
// the persistent user model. This is the section that justifies signup
// for repeat use.
//
// Visual: a faux timeline with "T-21 / T-7 / T-3" pings sliding along
// it on a loop. Address-book mock on the right showing 3 entries with
// next-occasion chips.

import { motion } from 'framer-motion';
import { Bell, BookHeart, Calendar } from 'lucide-react';

interface BookEntry {
  initial: string;
  name: string;
  relationship: string;
  occasion: string;
  daysUntil: number;
  bgClass: string;
}

const BOOK: BookEntry[] = [
  {
    initial: 'M',
    name: 'Mum',
    relationship: 'Mother',
    occasion: '70th birthday',
    daysUntil: 18,
    bgClass: 'bg-accent-coral-light text-accent-coral-dark',
  },
  {
    initial: 'A',
    name: 'Alex',
    relationship: 'Sister',
    occasion: 'Anniversary',
    daysUntil: 6,
    bgClass: 'bg-brand-muted text-brand',
  },
  {
    initial: 'S',
    name: 'Sam',
    relationship: 'Best friend',
    occasion: 'Birthday',
    daysUntil: 32,
    bgClass: 'bg-accent-amber-light text-accent-amber-dark',
  },
];

function ReminderTimeline() {
  return (
    <div className="bg-surface-card border border-stone-200 rounded-2xl p-8 md:p-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-brand-muted rounded-lg w-9 h-9 flex items-center justify-center">
          <Bell className="w-4 h-4 text-brand" strokeWidth={1.75} />
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400 font-medium">
          Reminder ladder
        </p>
      </div>

      <div className="relative pb-2">
        {/* Timeline rail */}
        <div className="absolute left-3 top-2 bottom-2 w-px bg-stone-200" aria-hidden />

        {[
          {
            tier: 'T-21',
            title: 'Three weeks ahead',
            body: 'Warm prompt — plenty of time to make and post.',
            delay: 0,
          },
          {
            tier: 'T-7',
            title: 'One week ahead',
            body: 'Nudge — last shipping window for standard delivery.',
            delay: 0.15,
          },
          {
            tier: 'T-3',
            title: 'Three days ahead',
            body: 'Pivot to digital — still time to land in their inbox.',
            delay: 0.3,
          },
        ].map((row) => (
          <motion.div
            key={row.tier}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.4, delay: row.delay, ease: 'easeOut' }}
            className="relative pl-10 pb-6 last:pb-0"
          >
            <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-cta-light border-2 border-cta flex items-center justify-center">
              <span className="text-[9px] font-bold text-cta-hover">
                {row.tier}
              </span>
            </div>
            <p className="text-sm font-semibold text-ink">{row.title}</p>
            <p className="text-sm text-ink-soft mt-1 leading-relaxed">{row.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AddressBookMock() {
  return (
    <div className="bg-surface-card border border-stone-200 rounded-2xl p-8 md:p-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-accent-coral-light rounded-lg w-9 h-9 flex items-center justify-center">
          <BookHeart
            className="w-4 h-4 text-accent-coral-dark"
            strokeWidth={1.75}
          />
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400 font-medium">
          Your people
        </p>
      </div>

      <div className="space-y-4">
        {BOOK.map((entry, i) => (
          <motion.div
            key={entry.name}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
            className="flex items-center gap-4 p-3 -mx-3 rounded-xl hover:bg-stone-50 transition-colors"
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold ${entry.bgClass}`}
            >
              {entry.initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">{entry.name}</p>
              <p className="text-xs text-ink-soft">{entry.relationship}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-xs text-ink-soft">
                <Calendar className="w-3 h-3" strokeWidth={2} />
                <span>{entry.daysUntil}d</span>
              </div>
              <p className="text-[11px] text-ink-soft/70 mt-0.5">
                {entry.occasion}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function NeverMissADateSection() {
  return (
    <section className="relative bg-surface-card py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="max-w-3xl mb-16 md:mb-20">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-coral-dark font-semibold mb-4">
            Never miss a date
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-tight leading-[1.05]">
            Saved in your address book.
            <br />
            Reminded in good time.
          </h2>
          <p className="text-lg text-ink-soft mt-6 leading-relaxed max-w-[52ch]">
            Add the people who matter once. We'll nudge you when their birthdays,
            anniversaries and other moments come round again.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10">
          <AddressBookMock />
          <ReminderTimeline />
        </div>
      </div>
    </section>
  );
}
