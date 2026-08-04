// client/src/components/studio/quick-add-moment.tsx
//
// The 15-second add — the crown jewel of the Moments capture loop
// (spec: memory/next_moments_hub_rewards.md). Who → what → when, one
// compact sheet, one POST. Deliberately NEVER asks for email, address
// or notes: this is a moment being remembered, not a contact being
// filed. The card flow collects logistics later, when there's a card.
//
// The reward for finishing is visible elsewhere on the page: the query
// invalidation makes the free-card ring fill LIVE as the sheet closes.

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { isFixedDateOccasion } from '@shared/fixed-occasions';

// Occasion chips carry the STORED slug alongside the display label —
// the fixed-date ones (Christmas, Mother's/Father's Day, Valentine's)
// must land in the DB as their canonical slugs ('mothers_day' etc.) so
// the reminder feed + free-card key-date count resolve their dates from
// the calendar. Storing the pretty label broke that (and wrongly asked
// for a date the calendar already knows) — Kevin 2026-08-03.
const OCCASIONS: Array<{ label: string; slug: string }> = [
  { label: 'Birthday', slug: 'birthday' },
  { label: 'Anniversary', slug: 'anniversary' },
  { label: 'Christmas', slug: 'christmas' },
  { label: "Mother's Day", slug: 'mothers_day' },
  { label: "Father's Day", slug: 'fathers_day' },
  { label: "Valentine's Day", slug: 'valentines' },
];

function slugFor(label: string): string {
  return OCCASIONS.find((o) => o.label === label)?.slug ?? label.toLowerCase();
}

export function QuickAddMoment({
  open,
  onOpenChange,
  /** Pre-fill the occasion (the national tiles pass theirs). */
  presetOccasion,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetOccasion?: string;
}) {
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState<string>(presetOccasion ?? 'Birthday');
  const [customOccasion, setCustomOccasion] = useState('');
  // UK-shaped date entry (day / month / optional year) — the native
  // date input renders yyyy/mm/dd on many setups (Aidan 2026-08-04) and
  // can't express "year optional". Year blank → we store the NEXT
  // occurrence's year (recurring anyway; yearSpecific stays false).
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [saved, setSaved] = useState(false);

  // Apply the preset each time the sheet opens — useState's initial
  // value only runs once per mount, so a national tile's preset was
  // silently ignored on the first open.
  useEffect(() => {
    if (open) setOccasion(presetOccasion ?? 'Birthday');
  }, [open, presetOccasion]);

  // What we show ("Mother's Day") vs what we store ('mothers_day').
  const displayOccasion = (occasion === 'other' ? customOccasion : occasion).trim();
  const storedOccasion =
    occasion === 'other' ? customOccasion.trim().toLowerCase() : slugFor(occasion);
  // Fixed-date occasions need no date picked — the calendar knows them.
  const isFixed = isFixedDateOccasion(storedOccasion);

  // Compose an ISO date from the UK fields. Blank year → the next time
  // this day/month comes around. Invalid combos (31 Feb) reject.
  const composedDate = (() => {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    if (!Number.isFinite(d) || !Number.isFinite(m)) return null;
    let y = parseInt(year, 10);
    if (!Number.isFinite(y)) {
      const now = new Date();
      y = now.getFullYear();
      const thisYear = new Date(y, m - 1, d);
      if (thisYear < new Date(now.getFullYear(), now.getMonth(), now.getDate())) y += 1;
    }
    if (y < 1900 || y > 2100) return null;
    const candidate = new Date(y, m - 1, d);
    if (candidate.getMonth() !== m - 1 || candidate.getDate() !== d) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  })();
  const ready = name.trim().length > 0 && displayOccasion.length > 0 && (isFixed || !!composedDate);

  const reset = () => {
    setName('');
    setOccasion(presetOccasion ?? 'Birthday');
    setCustomOccasion('');
    setDay('');
    setMonth('');
    setYear('');
    setSaved(false);
  };

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/user/address-book', {
        name: name.trim(),
        occasions: [
          {
            occasion: storedOccasion,
            date: isFixed ? null : composedDate,
            yearSpecific: false,
          },
        ],
      });
      return res.json();
    },
    onSuccess: () => {
      // The page's ring + river refresh themselves — that's the
      // celebration: the world visibly grows the moment this closes.
      queryClient.invalidateQueries({ queryKey: ['/api/user/reminders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/address-book'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/free-card'] });
      setSaved(true);
      window.setTimeout(() => {
        onOpenChange(false);
        reset();
      }, 900);
    },
    onError: (err: any) => {
      const msg = String(err?.message ?? '');
      toast({
        title: msg.includes('already have someone')
          ? 'They’re already in your world'
          : 'That didn’t save',
        description: msg.includes('already have someone')
          ? 'Add this date to them from “Everyone you’ve added”.'
          : 'Give it another go.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        {saved ? (
          <div className="flex flex-col items-center gap-2 py-8" data-testid="quick-add-saved">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-go/15">
              <Check className="h-6 w-6 text-go" strokeWidth={3} />
            </div>
            <p className="font-display text-lg font-semibold text-keeper-ink">
              {name.trim()}’s {displayOccasion} — watched.
            </p>
            <p className="text-[13px] text-keeper-meta">We’ll never let you miss it.</p>
          </div>
        ) : (
          <>
            <DialogTitle className="font-display">Add someone’s day</DialogTitle>
            <DialogDescription className="text-[13px]">
              Fifteen seconds now — never a missed moment again.
            </DialogDescription>

            <div className="space-y-4 pt-1">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-keeper-meta">
                  Who
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Their name"
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] text-keeper-ink outline-none focus:border-brand"
                  data-testid="quick-add-name"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-keeper-meta">
                  Their day
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {OCCASIONS.map((o) => (
                    <button
                      key={o.slug}
                      type="button"
                      onClick={() => setOccasion(o.label)}
                      className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                        occasion === o.label
                          ? 'bg-brand text-brand-foreground'
                          : 'bg-stone-100 text-keeper-body hover:bg-stone-200'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOccasion('other')}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium ${
                      occasion === 'other'
                        ? 'bg-brand text-brand-foreground'
                        : 'bg-stone-100 text-keeper-body hover:bg-stone-200'
                    }`}
                  >
                    Something else…
                  </button>
                </div>
                {occasion === 'other' && (
                  <input
                    value={customOccasion}
                    onChange={(e) => setCustomOccasion(e.target.value)}
                    placeholder="Graduation, new home, retirement…"
                    className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-brand"
                  />
                )}
              </div>

              {isFixed ? (
                /* Fixed-date occasions need nothing — say so, warmly. */
                <p className="text-[12px] text-keeper-meta">
                  No date needed — the calendar knows when{' '}
                  {displayOccasion || 'it'} is. We'll watch it every year.
                </p>
              ) : (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-keeper-meta">
                    {storedOccasion === 'birthday'
                      ? 'Their birthday'
                      : storedOccasion === 'anniversary'
                        ? 'Their anniversary'
                        : 'When is it?'}
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      inputMode="numeric"
                      value={day}
                      onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      placeholder="DD"
                      className="w-16 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-center text-[15px] outline-none focus:border-brand"
                      data-testid="quick-add-day"
                    />
                    <select
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className={`flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-brand ${month ? 'text-keeper-ink' : 'text-stone-400'}`}
                      data-testid="quick-add-month"
                    >
                      <option value="" disabled>
                        Month
                      </option>
                      {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <input
                      inputMode="numeric"
                      value={year}
                      onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder={storedOccasion === 'birthday' ? 'Year?' : 'YYYY'}
                      className="w-20 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-center text-[15px] outline-none focus:border-brand"
                      data-testid="quick-add-year"
                    />
                  </div>
                  {storedOccasion === 'birthday' && (
                    <p className="mt-1.5 text-[11.5px] text-keeper-meta">
                      Year's optional — the real one helps us spot the
                      milestone birthdays.
                    </p>
                  )}
                </div>
              )}

              <Button
                disabled={!ready || create.isPending}
                onClick={() => create.mutate()}
                className="w-full rounded-full bg-go py-5 text-[15px] font-bold text-go-foreground hover:bg-go-hover disabled:opacity-50"
                data-testid="quick-add-save"
              >
                {create.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Watch this day'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
