// client/src/components/studio/giving-moment.tsx
//
// The Giving Moment — the post-reveal screen where the sender decides
// HOW their card reaches the person. See next_delivery_destination_usp.md.
//
// Why this exists: a greetings card only becomes real when it's given.
// The "how" used to be a mis-titled tier-picker dialog plus a logistics
// form at checkout. This is the designed moment instead — shown right
// after the card reveal, with the 3D card still on screen above it
// (it's rendered inline by RevealView, NOT as a dialog — a dialog is
// dismissable and tonally wrong straight after the reveal ceremony).
//
// Two questions, in dependency order:
//   Q1 — Format:      Digital / Printed / Both
//   Q2 — Destination: straight to them, or to the sender first
//                     (copy adapts to the format chosen in Q1)
//
// Blank-inside special case: if the user left the inside blank (to
// handwrite it), there is no real choice to make — a blank card can't
// go digital and mustn't be posted to the recipient. So the screen
// collapses to a confirmation: printed, posted to the sender, ready to
// handwrite. The footgun (blank card on the recipient's doormat) is
// designed OUT — "straight to them" is simply never offered for a
// blank inside.
//
// On continue: the choice is saved to the draft (`state.delivery`) and
// the user is sent to /checkout/:id?product=<format>. Checkout reads
// the draft for the destination.

import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Sparkles,
  Package,
  Mail,
  HandHeart,
  PenLine,
  Check,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CardDraftState } from '@shared/schema';

// ── Pricing (pence) ──────────────────────────────────────────────────
// Mirrors the constants in review-step.tsx + checkout.tsx. Not yet
// sourced from shared/pricing.ts — consolidating all three is a
// separate tidy-up; keep them in sync by hand until then.
const PRINT_PRICE = 599;
const DIGITAL_PRICE = 99;
const UK_SHIPPING = 150;
const BUNDLE_DISCOUNT = 50;

type Format = 'digital' | 'print' | 'both';
type Destination = 'recipient' | 'sender';

function totalFor(format: Format): number {
  const print = format === 'digital' ? 0 : PRINT_PRICE;
  const digital = format === 'print' ? 0 : DIGITAL_PRICE;
  const shipping = format === 'digital' ? 0 : UK_SHIPPING;
  const discount = format === 'both' ? BUNDLE_DISCOUNT : 0;
  return print + digital + shipping - discount;
}

function formatGBP(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

// ── Props ────────────────────────────────────────────────────────────

interface GivingMomentProps {
  cardId: number;
  /** Recipient's name — woven into the copy. Empty string is fine. */
  recipientName: string;
  /** Inside mode of the card. 'blank' collapses the screen to the
   *  handwrite-confirmation path. null is treated as 'write'.
   *
   *  Note: there is deliberately NO "go back and add a message" path
   *  from here. The write/blank choice is a clear, deliberate fork on
   *  the Inside step; once the card is generated it's committed.
   *  Offering an undo here would mean a regeneration and would
   *  undermine that commitment. */
  insideMode: 'write' | 'blank' | null;
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
  insideMode,
  saveDelivery,
}: GivingMomentProps) {
  const [, setLocation] = useLocation();
  const isBlank = insideMode === 'blank';

  const them = recipientName || 'them';

  const [format, setFormat] = useState<Format | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [fromLine, setFromLine] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Picking a different format can invalidate a digital-only destination
  // wording, but the destination *values* ('recipient'/'sender') stay
  // valid across formats — so we keep the destination selection when
  // format changes. Only the copy below re-renders.

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

  // ── Blank-inside path — a confirmation, not a choice ───────────────
  if (isBlank) {
    return (
      <div className="text-left space-y-5" data-testid="giving-moment-blank">
        <Header />
        <div className="rounded-2xl border-2 border-brand/40 bg-brand-muted/30 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand text-white shrink-0">
              <PenLine className="w-4 h-4" strokeWidth={1.75} />
            </span>
            <p className="text-sm font-semibold text-ink">
              Your card has a blank inside
            </p>
          </div>
          <p className="text-sm text-stone-600 leading-relaxed">
            We'll post your printed card to you — ready for your own
            handwriting. Write your message by hand when it arrives, then
            give it to {them} yourself.
          </p>
          <p className="text-[13px] text-stone-500">
            {formatGBP(totalFor('print'))} · printed card, posted in the UK.
          </p>
        </div>

        <Button
          onClick={() =>
            commitAndGo({ format: 'print', destination: 'sender' })
          }
          disabled={submitting}
          className="w-full bg-cta hover:bg-cta-hover text-white"
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
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    );
  }

  // ── Written-inside path — the full two-question flow ───────────────
  const includesPrint = format === 'print' || format === 'both';
  const canContinue = !!format && !!destination && !submitting;

  return (
    <div className="text-left space-y-6" data-testid="giving-moment">
      <Header />

      {/* ── Q1 — Format ─────────────────────────────────────────── */}
      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold text-ink">
          1 · What would you like?
        </h3>
        <div className="space-y-2.5">
          <FormatCard
            value="digital"
            icon={<Sparkles className="w-5 h-5 text-brand" />}
            title="Digital"
            body="An instant share link — it opens with the same 3D card you're looking at now."
            price={totalFor('digital')}
            selected={format === 'digital'}
            onSelect={() => setFormat('digital')}
          />
          <FormatCard
            value="print"
            icon={<Package className="w-5 h-5 text-stone-700" />}
            title="Printed"
            body="A premium square card, posted in a kraft envelope."
            price={totalFor('print')}
            selected={format === 'print'}
            onSelect={() => setFormat('print')}
          />
          <FormatCard
            value="both"
            icon={
              <span className="flex gap-0.5">
                <Package className="w-4 h-4 text-stone-700" />
                <Sparkles className="w-4 h-4 text-brand" />
              </span>
            }
            title="Printed + digital"
            body="The real card in the post, plus the instant share link."
            price={totalFor('both')}
            badge="Most popular"
            selected={format === 'both'}
            onSelect={() => setFormat('both')}
          />
        </div>
      </section>

      {/* ── Q2 — Destination ────────────────────────────────────── */}
      {format && (
        <section className="space-y-2.5" data-testid="giving-moment-destination">
          <h3 className="text-sm font-semibold text-ink">
            2 · Where should it go?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <DestinationCard
              icon={<Mail className="w-5 h-5" />}
              title={recipientName ? `Straight to ${recipientName}` : 'Straight to them'}
              body={
                includesPrint
                  ? `We post it to ${them}, tracked.${
                      format === 'both' ? ' The link goes to them too.' : ''
                    }`
                  : `We email the link straight to ${them}.`
              }
              selected={destination === 'recipient'}
              onSelect={() => setDestination('recipient')}
              testId="giving-dest-recipient"
            />
            <DestinationCard
              icon={<HandHeart className="w-5 h-5" />}
              title="To you first"
              body={
                includesPrint
                  ? `We post the finished card to you — to give to ${them} in person.`
                  : `We send you the link to pass on to ${them} yourself.`
              }
              selected={destination === 'sender'}
              onSelect={() => setDestination('sender')}
              testId="giving-dest-sender"
            />
          </div>

          {/* Optional "from…" line — only for direct-to-recipient. */}
          {destination === 'recipient' && (
            <div className="pt-1">
              <label
                htmlFor="giving-from-line"
                className="text-xs font-medium text-stone-600"
              >
                A short note for the envelope{' '}
                <span className="text-stone-400">(optional)</span>
              </label>
              <Input
                id="giving-from-line"
                value={fromLine}
                onChange={(e) => setFromLine(e.target.value)}
                placeholder="e.g. With love, Sarah"
                maxLength={120}
                className="mt-1 border-brand-light focus-visible:border-brand focus-visible:ring-brand/20"
                data-testid="giving-from-line"
              />
            </div>
          )}
        </section>
      )}

      {/* ── Continue ─────────────────────────────────────────────── */}
      <Button
        onClick={() =>
          format &&
          destination &&
          commitAndGo({
            format,
            destination,
            fromLine:
              destination === 'recipient' && fromLine.trim()
                ? fromLine.trim()
                : undefined,
          })
        }
        disabled={!canContinue}
        className="w-full bg-cta hover:bg-cta-hover text-white"
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
            {format && (
              <span className="ml-2 font-normal opacity-90">
                · {formatGBP(totalFor(format))}
              </span>
            )}
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
      {!canContinue && !submitting && (
        <p className="text-[11px] text-stone-400 text-center -mt-3">
          {!format
            ? 'Pick what you’d like, above.'
            : 'Choose where it should go.'}
        </p>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function Header() {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-ink">
        How would you like to give it?
      </h2>
      <p className="text-sm text-stone-500 leading-relaxed">
        The card's the easy part — this is the bit that matters.
      </p>
    </div>
  );
}

function FormatCard({
  value,
  icon,
  title,
  body,
  price,
  badge,
  selected,
  onSelect,
}: {
  value: Format;
  icon: React.ReactNode;
  title: string;
  body: string;
  price: number;
  badge?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full text-left rounded-xl border-2 p-4 transition-all ${
        selected
          ? 'border-brand bg-brand-muted/40 shadow-sm'
          : 'border-stone-200 bg-white hover:border-brand/50 hover:shadow-sm'
      }`}
      data-testid={`giving-format-${value}`}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-muted shrink-0">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="text-sm font-semibold text-ink whitespace-nowrap">
              {formatGBP(price)}
            </p>
          </div>
          <p className="text-xs text-stone-600 mt-1 leading-relaxed">{body}</p>
          {badge && (
            <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-medium text-brand">
              {badge}
            </span>
          )}
        </div>
        <span
          className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            selected ? 'bg-brand text-white' : 'border-2 border-stone-300'
          }`}
        >
          {selected && <Check className="w-3 h-3" strokeWidth={3} />}
        </span>
      </div>
    </button>
  );
}

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
          : 'border-stone-200 bg-white hover:border-brand/50 hover:shadow-sm'
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
      <span className="text-sm font-semibold text-ink leading-tight">
        {title}
      </span>
      <span className="text-xs text-stone-600 leading-relaxed">{body}</span>
      {selected && (
        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center">
          <Check className="w-3 h-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
