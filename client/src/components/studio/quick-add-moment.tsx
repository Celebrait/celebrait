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

import { useState } from 'react';
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

const RELATIONSHIPS = ['Mum', 'Dad', 'Partner', 'Friend', 'Nan', 'Grandad', 'Sister', 'Brother'];
const OCCASIONS = ['Birthday', 'Anniversary', 'Christmas'];

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
  const [relationship, setRelationship] = useState<string | null>(null);
  const [occasion, setOccasion] = useState<string>(presetOccasion ?? 'Birthday');
  const [customOccasion, setCustomOccasion] = useState('');
  const [date, setDate] = useState('');
  const [saved, setSaved] = useState(false);

  const finalOccasion = (occasion === 'other' ? customOccasion : occasion).trim();
  // Christmas needs no date picked — it knows its own.
  const isChristmas = finalOccasion.toLowerCase() === 'christmas';
  const ready = name.trim().length > 0 && finalOccasion.length > 0 && (isChristmas || date);

  const reset = () => {
    setName('');
    setRelationship(null);
    setOccasion(presetOccasion ?? 'Birthday');
    setCustomOccasion('');
    setDate('');
    setSaved(false);
  };

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/user/address-book', {
        name: name.trim(),
        relationship,
        occasions: [
          {
            occasion: finalOccasion.toLowerCase(),
            date: isChristmas ? null : date,
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
              {name.trim()}’s {finalOccasion.toLowerCase()} — watched.
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
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {RELATIONSHIPS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRelationship(relationship === r ? null : r)}
                      className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                        relationship === r
                          ? 'bg-brand text-brand-foreground'
                          : 'bg-stone-100 text-keeper-body hover:bg-stone-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-keeper-meta">
                  Their day
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {OCCASIONS.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setOccasion(o)}
                      className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                        occasion === o
                          ? 'bg-brand text-brand-foreground'
                          : 'bg-stone-100 text-keeper-body hover:bg-stone-200'
                      }`}
                    >
                      {o}
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

              {!isChristmas && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-keeper-meta">
                    When
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-brand"
                    data-testid="quick-add-date"
                  />
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
