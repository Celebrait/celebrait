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
// Two questions, on SEPARATE screens (one beat per screen, the way
// they're decided in real life — pick what, then pick who):
//   Step 1 — Format:      Digital / Printed / Both
//   Step 2 — Destination: straight to them, or to the sender first
//                         (copy adapts to the format chosen in step 1)
//
// WRITTEN-INSIDE ONLY. A blank inside has no giving choice — it can
// only be printed and posted to the sender (a blank card can't go
// digital, and mustn't land on the recipient's doormat). So a blank
// inside skips this screen entirely and goes straight to checkout
// (branch in review-step.tsx, guard in studio-give.tsx). That's the
// blank-card footgun designed out — the choice simply never exists.
//
// On continue: the choice is saved to the draft (`state.delivery`) and
// the user is sent to /checkout/:id?product=<format>.

import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Sparkles,
  Package,
  Mail,
  HandHeart,
  Check,
  ArrowLeft,
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

  // Two-screen flow: pick the format, then pick the destination. The
  // user clicks Next on screen 1 to advance (no auto-advance — gives
  // them a beat to read the chosen card). Back from screen 2 keeps
  // both selections so changing your mind doesn't lose your place.
  const [step, setStep] = useState<'format' | 'destination'>('format');
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

  // Written-inside path — the two-screen flow. (Blank inside never
  // reaches this component; it skips straight to checkout.)
  const includesPrint = format === 'print' || format === 'both';
  const canAdvance = !!format;
  const canContinue = !!format && !!destination && !submitting;
  const formatLabel =
    format === 'both'
      ? 'printed card + digital link'
      : format === 'print'
        ? 'printed card'
        : format === 'digital'
          ? 'digital share link'
          : '';

  return (
    <div className="text-left space-y-6" data-testid="giving-moment">
      {step === 'format' ? (
        <>
          {/* ── Step 1 — Format ───────────────────────────────────── */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-400 font-semibold">
              Step 1 of 2
            </p>
            <h2 className="text-lg font-semibold text-ink">
              How would you like to give it?
            </h2>
            <p className="text-sm text-stone-500 leading-relaxed">
              The card's the easy part — this is the bit that matters.
            </p>
          </div>

          <section className="space-y-2.5">
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
          </section>

          <Button
            onClick={() => format && setStep('destination')}
            disabled={!canAdvance}
            className="w-full bg-brand hover:bg-brand-dark text-white"
            size="lg"
            data-testid="giving-moment-next"
          >
            Next — where should it go?
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          {!canAdvance && (
            <p className="text-[11px] text-stone-400 text-center -mt-3">
              Pick what you'd like, above.
            </p>
          )}
        </>
      ) : (
        <>
          {/* ── Step 2 — Destination ──────────────────────────────── */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.18em] text-stone-400 font-semibold">
                Step 2 of 2
              </p>
              <button
                type="button"
                onClick={() => setStep('format')}
                className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-ink"
                data-testid="giving-moment-back"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
            </div>
            <h2 className="text-lg font-semibold text-ink">
              Where should it go?
            </h2>
            <p className="text-sm text-stone-500 leading-relaxed">
              For your {formatLabel}
              {format && (
                <span className="text-stone-400">
                  {' '}
                  · {formatGBP(totalFor(format))}
                </span>
              )}
            </p>
          </div>

          <section className="space-y-2.5" data-testid="giving-moment-destination">
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
              Choose where it should go.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────
// (Header component removed 2026-05-20 — each step has its own inline
// header now that the flow is split across two screens.)

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
