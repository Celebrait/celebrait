// client/src/components/studio/giving-moment.tsx
//
// The Giving Moment — the questions component for the giving screen
// (rendered by pages/studio-give.tsx). See next_delivery_destination_usp.md.
//
// Why this exists: a greetings card only becomes real when it's given.
// The "how" used to be a mis-titled tier-picker dialog plus a logistics
// form at checkout. This is the designed moment instead — its own
// screen after the card reveal, the finished card shown flat above.
//
// Print-led V1 (2026-07-01): there's one product — a printed card that
// includes a free digital link — so the old format step (Digital /
// Printed / Both) is gone. The only question left is the DESTINATION:
// straight to the recipient, or to the sender first to give in person.
//
// WRITTEN-INSIDE ONLY. A blank inside has no giving choice — it's
// printed and posted to the sender, always — so a blank inside skips
// this screen entirely and goes straight to checkout (branch in
// review-step.tsx, guard in studio-give.tsx). That's the blank-card
// footgun designed out — the choice simply never exists.
//
// On continue: the choice is saved to the draft (`state.delivery`,
// format always 'print') and the user is sent to /checkout/:id.

import { useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Mail,
  HandHeart,
  Check,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tierPriceGBP, UK_SHIPPING_STANDARD_GBP } from '@shared/pricing';
import type { CardDraftState } from '@shared/schema';

// ── Pricing (pence) ──────────────────────────────────────────────────
// Print-led V1: one product — a printed card (+ free digital link) plus
// standard postage. Sourced from shared/pricing.ts so this can't drift from
// checkout. Both destinations cost the same; the optional wax-seal sticker
// is a checkout add-on, not a destination surcharge (Kevin 2026-07-21).
const CARD_BASE = tierPriceGBP('printed') + UK_SHIPPING_STANDARD_GBP;

type Destination = 'recipient' | 'sender';

function formatGBP(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

// ── Props ────────────────────────────────────────────────────────────

// This component is for WRITTEN-inside cards only. A blank inside has
// no giving choice to make (printed + posted to the sender, always),
// so it skips the Giving Moment screen entirely and goes straight to
// checkout — the routing branch lives in review-step.tsx + the guard
// in studio-give.tsx. See next_delivery_destination_usp.md.
interface GivingMomentProps {
  cardId: number;
  /** Recipient's name — woven into the copy. Empty string is fine. */
  recipientName: string;
  /** Persist the delivery choice to the draft (patch + flush). Awaited
   *  before navigating to checkout so the choice can't be lost to a
   *  refresh. */
  saveDelivery: (
    delivery: NonNullable<CardDraftState['delivery']>,
  ) => Promise<void>;
}

// ── Component ────────────────────────────────────────────────────────

export function GivingMoment({
  cardId,
  recipientName,
  saveDelivery,
}: GivingMomentProps) {
  const [, setLocation] = useLocation();

  const them = recipientName || 'them';

  // Print-led V1: one product (a printed card + free digital link), so
  // there's no format step — the only question is where it should go.
  const [destination, setDestination] = useState<Destination | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Save-for-later (Carina 2026-08-07: made a card months early and
  // couldn't see how NOT to buy it now). The deferral moment is also the
  // one moment someone will happily give the occasion date — asked here,
  // optionally, framed as service; never earlier in the maker.
  const [laterOpen, setLaterOpen] = useState(false);
  const [laterDate, setLaterDate] = useState('');
  const [laterBusy, setLaterBusy] = useState(false);
  const { toast } = useToast();

  const saveForLater = async () => {
    if (laterBusy) return;
    setLaterBusy(true);
    try {
      const res = await apiRequest(
        'POST',
        `/api/studio/cards/${cardId}/save-for-later`,
        { date: laterDate || undefined },
      );
      const body = (await res.json()) as { dateSet?: boolean };
      toast({
        title: 'Saved in your Drafts',
        description: body.dateSet
          ? "We'll nudge you in good time to print and post it."
          : "It'll be right there when you're ready.",
      });
    } catch {
      // The draft is persisted regardless — never block the exit on the
      // date write.
      toast({ title: 'Saved in your Drafts' });
    } finally {
      setLaterBusy(false);
    }
    setLocation('/studio');
  };

  // Step-1 "Back to card" — leaves the giving flow back to wherever the
  // user came from. /give has two entry points (the maker reveal and the
  // gallery card view), so history-back returns them to the right one
  // rather than a hardcoded route. Falls back to the card's own view page
  // for a deep-link with no history to pop.
  const goBackToCard = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      setLocation(`/studio/card/${cardId}`);
    }
  };

  const commitAndGo = async (resolved: NonNullable<CardDraftState['delivery']>) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Save to the draft first (awaited) — the choice must survive the
      // navigation + a possible refresh on the checkout page.
      await saveDelivery(resolved);
    } catch (err) {
      // Non-fatal: the ?product= param below still carries the format,
      // and checkout has its own destination fallback. Log + proceed.
      console.warn('[giving-moment] saveDelivery failed', err);
    } finally {
      setSubmitting(false);
    }
    setLocation(`/checkout/${cardId}?product=${resolved.format}`);
  };

  const canContinue = !!destination && !submitting;

  return (
    <div className="text-left space-y-6" data-testid="giving-moment">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.18em] text-keeper-meta font-semibold">
            The giving moment
          </p>
          <button
            type="button"
            onClick={goBackToCard}
            className="inline-flex items-center gap-1 text-xs text-keeper-meta hover:text-keeper-ink"
            data-testid="giving-moment-back-to-card"
          >
            <ArrowLeft className="w-3 h-3" /> Back to card
          </button>
        </div>
        <h2 className="text-lg font-display font-bold tracking-[-0.015em] text-keeper-ink">
          How would you like to give it?
        </h2>
        <p className="text-sm text-keeper-meta leading-relaxed">
          Your printed card{recipientName ? ` for ${recipientName}` : ''} — from{' '}
          {formatGBP(CARD_BASE)} inc. postage, with a free digital link to
          share.
        </p>
      </div>

      <section className="space-y-2.5" data-testid="giving-moment-destination">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <DestinationCard
            icon={<Mail className="w-5 h-5" />}
            title={recipientName ? `Straight to ${recipientName}` : 'Straight to them'}
            body="Posted tracked in a kraft envelope, your message printed inside."
            selected={destination === 'recipient'}
            onSelect={() => setDestination('recipient')}
            testId="giving-dest-recipient"
          />
          <DestinationCard
            icon={<HandHeart className="w-5 h-5" />}
            title="To you first"
            body={`Posted to you with a spare envelope, ready to hand over to ${them} in person.`}
            selected={destination === 'sender'}
            onSelect={() => setDestination('sender')}
            testId="giving-dest-sender"
          />
        </div>
      </section>

      <Button
        onClick={() =>
          destination &&
          commitAndGo({
            format: 'print',
            destination,
          })
        }
        disabled={!canContinue}
        className="w-full bg-go hover:bg-go-hover text-white"
        size="lg"
        data-testid="giving-moment-continue"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            One moment…
          </>
        ) : (
          <>
            Continue to payment
            <span className="ml-2 font-normal opacity-90">
              · {formatGBP(CARD_BASE)}
            </span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
      {!canContinue && !submitting && (
        <p className="text-[11px] text-keeper-meta text-center -mt-3">
          Choose where it should go.
        </p>
      )}

      {/* The explicit exit. Cards auto-save, but nothing SAID so — and a
          buy-or-back-button screen reads as buy-or-lose-it. */}
      <div className="border-t border-keeper-hair pt-4 text-center" data-testid="giving-save-later">
        {!laterOpen ? (
          <button
            type="button"
            onClick={() => setLaterOpen(true)}
            className="text-[13px] font-medium text-keeper-meta underline-offset-2 hover:text-keeper-ink hover:underline"
            data-testid="giving-save-later-open"
          >
            Not sending it yet? Save it for later
          </button>
        ) : (
          <div className="space-y-2.5">
            <p className="text-sm text-keeper-ink font-medium">
              No rush — it stays safe in your Drafts.
            </p>
            <p className="text-[12px] text-keeper-meta leading-relaxed">
              When's the big day{recipientName ? ` for ${recipientName}` : ''}?
              We'll nudge you in good time to print and post it. (Optional.)
            </p>
            <div className="flex items-center justify-center gap-2">
              <input
                type="date"
                value={laterDate}
                onChange={(e) => setLaterDate(e.target.value)}
                className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-keeper-ink"
                data-testid="giving-save-later-date"
              />
              <Button
                onClick={saveForLater}
                disabled={laterBusy}
                variant="outline"
                data-testid="giving-save-later-confirm"
              >
                {laterBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : laterDate ? (
                  'Save date & close'
                ) : (
                  'Just save for later'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────
// (Header component removed 2026-05-20 — each step has its own inline
// header now that the flow is split across two screens.)

function DestinationCard({
  icon,
  title,
  body,
  selected,
  onSelect,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  selected: boolean;
  onSelect: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative text-left rounded-xl border-2 p-4 transition-all flex flex-col gap-2 ${
        selected
          ? 'border-brand bg-brand-muted/40 shadow-sm'
          : 'border-keeper-hair bg-white hover:border-brand/50 hover:shadow-sm'
      }`}
      data-testid={testId}
    >
      <span
        className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
          selected ? 'bg-brand text-white' : 'bg-brand-muted text-brand-dark'
        }`}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold text-keeper-ink leading-tight">
        {title}
      </span>
      <span className="text-xs text-keeper-body leading-relaxed">{body}</span>
      {selected && (
        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center">
          <Check className="w-3 h-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
