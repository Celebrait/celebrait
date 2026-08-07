// client/src/pages/checkout.tsx
//
// Studio checkout. Print-led V1 (2026-07-01): one product — a printed
// card that includes a free digital link — so there's no format choice,
// just confirm details + pay. The interactive front/inside preview
// leads the page — it's what they're paying for.
//
// Prices come from `shared/pricing.ts` — the same numbers the public
// /pricing page renders, so checkout can't drift below what we
// advertised. UK shipping + bundle discount are in there too. See
// next_checkout_shipping_robust.md (audit 2026-05-27) — earlier this
// file hardcoded a lower price than /pricing showed (bait-and-switch
// risk), and bundle discount was client-only (server underpriced 50p).
//
// Builds against the stubbed PaymentProvider today; swapping to
// Stripe is a provider swap, not a rebuild (see next_payment_gateway.md).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, Package, Sparkles, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import CheckoutLayout from '@/layouts/checkout-layout';
import {
  tierPriceGBP,
  SHIPPING_TIERS,
  getShippingTier,
  envelopeStickerGBP,
  ENVELOPE_STICKER_GBP,
  DEFAULT_SHIPPING_TIER,
  deliveryEstimateCopy,
  PRODUCTION_NOTICE,
  type ShippingTierId,
} from '@shared/pricing';

interface CardSummary {
  id: number;
  status: string | null;
  frontImageUrl: string | null;
  insideImageUrl: string | null;
  state?: {
    recipient?: { name?: string | null };
    /** Inside mode — 'blank' means the user deliberately left the
     *  inside empty to handwrite it themselves. Drives the blank-
     *  inside fallback warning + the structural skip into a
     *  print/sender summary at the top. */
    inside?: { mode?: 'write' | 'blank' };
    /** The Giving Moment's resolved choice. Written by the give page
     *  (PATCH) when the user picks format + destination there. When
     *  present, checkout pre-resolves and shows the "Your choice"
     *  summary instead of the inline format/ship-to radios. See
     *  next_delivery_destination_usp.md. */
    delivery?: {
      format?: 'digital' | 'print' | 'both';
      destination?: 'recipient' | 'sender';
      fromLine?: string;
    };
  };
}

interface CheckoutResponse {
  orderId: string;
  payment: {
    paymentReference: string;
    mode: 'redirect' | 'embedded';
    redirectUrl?: string;
    clientToken?: string;
  };
}

type ProductChoice = 'digital' | 'print' | 'both';

// Prices in pence — sourced from shared/pricing.ts so the public
// /pricing page and checkout can't disagree. Print-led V1: the printed
// card is the only product and includes a free digital link, so digital
// is always £0 and there's no bundle discount. Postage is a separate line
// priced from the chosen delivery tier (SHIPPING_TIERS).
const PRINT_PRICE = tierPriceGBP('printed');

// Wax-seal sticker offer — OFF for soft launch. See the comment at the
// offer's render site (search STICKER_OFFER_ENABLED) for the two
// conditions required before flipping this back on.
const STICKER_OFFER_ENABLED = false;

function formatGBP(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

// Printed card (+ free digital link) + postage for the chosen delivery tier
// + the optional wax-seal sticker (direct sends only). The server re-derives
// every pence from shared/pricing.ts, so this must stay in lockstep.
function totalsFor(
  tier: ShippingTierId,
  shipTo: 'sender' | 'recipient',
  addSticker: boolean,
  /** Free-first-card credit applies — card £0, standard postage only. */
  freeCard: boolean,
) {
  const printAmount = freeCard ? 0 : PRINT_PRICE;
  const digitalAmount = 0;
  const shippingAmount = getShippingTier(tier).price;
  const stickerAmount = envelopeStickerGBP(addSticker, shipTo);
  return {
    printAmount,
    digitalAmount,
    shippingAmount,
    stickerAmount,
    discount: 0,
    total: printAmount + shippingAmount + stickerAmount,
  };
}

export default function CheckoutPage() {
  const [, params] = useRoute<{ cardId: string }>('/checkout/:cardId');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const cardId = params ? parseInt(params.cardId, 10) : NaN;

  const { data: card, isLoading } = useQuery<CardSummary>({
    queryKey: [`/api/studio/drafts/${cardId}`],
    enabled: Number.isFinite(cardId),
    // Always refetch on mount: the Giving Moment saves the delivery choice
    // to the draft immediately before navigating here, so a stale cached
    // card (without delivery) would drop us into the fallback radio and
    // silently default to self-send. Read fresh so the choice resolves.
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const recipientName = card?.state?.recipient?.name?.trim() || '';
  // The user deliberately left the inside blank (to handwrite it).
  // Posting a blank card straight to the recipient is the one
  // delivery combo that's almost never intended — see the warning
  // rendered in the ship-to section below.
  const insideIsBlank = card?.state?.inside?.mode === 'blank';

  // Resolved giving choice — populated when the user came through the
  // Giving Moment (delivery.format + delivery.destination on the
  // draft) OR when the card's inside is blank (structural: blank →
  // print + sender, the only valid path). `isResolved` drives the
  // calm "summary + pay" shape of the page; when null, the page
  // falls back to the inline format + ship-to radios (deep-link /
  // pre-Giving-Moment drafts). See next_delivery_destination_usp.md.
  const delivery = card?.state?.delivery;
  const resolvedFormat: ProductChoice | null =
    (delivery?.format as ProductChoice | undefined) ??
    (insideIsBlank ? 'print' : null);
  const resolvedDestination: 'sender' | 'recipient' | null =
    delivery?.destination ?? (insideIsBlank ? 'sender' : null);
  const isResolved = !!resolvedFormat && !!resolvedDestination;

  // One-shot init: when the card lands, sync the local ship-to state to
  // the resolved Giving Moment choice. The destination is decided upstream
  // (in the Giving Moment) and shown read-only here — not re-asked.
  const initAppliedRef = useRef(false);
  useEffect(() => {
    if (initAppliedRef.current || !card) return;
    if (resolvedDestination) setShipTo(resolvedDestination);
    initAppliedRef.current = true;
  }, [card, resolvedFormat, resolvedDestination]);

  // Print-led V1: the printed card is the only product (it includes a
  // free digital link). There is no format choice — `choice` is always
  // 'print'. Kept as state typed as the union so the legacy summary +
  // ship-to branches below still type-check unchanged.
  const [choice] = useState<ProductChoice>('print');
  const [previewSide, setPreviewSide] = useState<'front' | 'inside'>('front');

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  // Prefill "your details" from the signed-in account. Checkout is only
  // reachable when authenticated, so the account email is always known —
  // asking for it again (blank field) both adds friction AND lets the two
  // emails diverge: card-ready resolves from the ACCOUNT, but order-
  // confirmed / shipped / delivered all use THIS field. If they differ, the
  // customer's lifecycle splits across two inboxes (Kevin's E2E, 2026-07-17:
  // signed in as one address, typed another here, receipts went to the
  // typed one). Prefill once when the user loads and the field is still
  // untouched — still editable if someone genuinely wants receipts elsewhere.
  const { user } = useAuth();
  const prefilledFromAccount = useRef(false);
  useEffect(() => {
    if (prefilledFromAccount.current || !user) return;
    prefilledFromAccount.current = true;
    setCustomerEmail((cur) => cur || user.email || '');
    setCustomerName((cur) => cur || user.firstName || '');
  }, [user]);
  const [shipTo, setShipTo] = useState<'sender' | 'recipient'>('sender');
  // Opt-in wax-seal envelope sticker (direct sends only).
  const [addSticker, setAddSticker] = useState(false);
  const [shippingTier, setShippingTier] = useState<ShippingTierId>(DEFAULT_SHIPPING_TIER);
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Free-first-card credit (Moments rewards): earned by adding 3 key
  // dates, spent here. Display-only truth — the server re-derives
  // eligibility at order create and forces the same pricing, so a stale
  // cache can't change what's charged.
  const { data: freeCard } = useQuery<{
    keyDates: number;
    redeemed: boolean;
    eligible: boolean;
  }>({
    queryKey: ['/api/user/free-card'],
    // Always fresh: a 5-min-stale "eligible" here would show £3.95 while
    // the server (rightly) charges full price at create.
    refetchOnMount: 'always',
    staleTime: 0,
  });
  const freeCardApplied = freeCard?.eligible === true;
  // The free card always travels Standard post (fixed, known exposure);
  // the faster tiers stay a paid-order thing.
  const effectiveTier: ShippingTierId = freeCardApplied ? 'standard' : shippingTier;

  const includesPrint = choice !== 'digital';
  // Print-led V1: every order is a printed card that INCLUDES a free
  // digital link — so digital is always part of the order. (The dead
  // `choice` machinery would compute false here; the model says true.)
  const includesDigital = true;
  const totals = useMemo(
    () => totalsFor(effectiveTier, shipTo, addSticker, freeCardApplied),
    [effectiveTier, shipTo, addSticker, freeCardApplied],
  );

  // Postcode lookup via postcodes.io — free, no key, fills city on
  // blur. Full address autofill (getAddress.io / Loqate / Ideal
  // Postcodes) is a paid upgrade for a future pass.
  const handlePostcodeLookup = async () => {
    const pc = postcode.trim();
    if (pc.length < 5) return;
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
      if (!res.ok) return;
      const body = await res.json();
      const town = body?.result?.admin_district || body?.result?.parish;
      if (town && !city) setCity(town);
    } catch {
      // Silent — validation is nice-to-have.
    }
  };

  const addressComplete =
    line1.trim().length > 0 && city.trim().length > 0 && postcode.trim().length >= 5;
  const contactComplete =
    customerName.trim().length > 0 && /.+@.+\..+/.test(customerEmail);
  // Print orders must have a resolved delivery destination (chosen in the
  // Giving Moment) before pay — no silent self-send default. A deep-link
  // that skipped the choice is sent back to pick (see the section below).
  const canPay =
    contactComplete &&
    (!includesPrint || (addressComplete && isResolved)) &&
    !submitting;

  const handlePay = async () => {
    if (!canPay || !Number.isFinite(cardId)) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        customerEmail,
        customerName,
        includesPrint,
        includesDigital,
      };
      if (includesPrint) {
        payload.shipTo = shipTo;
        payload.envelopeSticker = addSticker && shipTo === 'recipient';
        payload.shippingTier = effectiveTier;
        payload.shippingAddress = {
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          postcode: postcode.trim().toUpperCase(),
          country: 'GB',
        };
      }

      // Abort rather than hang: on a slow mobile connection a stalled
      // request left the button on "Starting…" indefinitely — a frozen
      // page as far as the customer is concerned (SA buyer, 2026-08-07).
      const abort = new AbortController();
      const timer = window.setTimeout(() => abort.abort(), 25_000);
      let res: Response;
      try {
        res = await fetch(`/api/studio/cards/${cardId}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
          signal: abort.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }
      if (!res.ok) {
        const text = await res.text();
        let msg = `${res.status}: ${text || res.statusText}`;
        try {
          msg = JSON.parse(text).message ?? msg;
        } catch {
          /* plain text */
        }
        throw new Error(msg);
      }
      const body: CheckoutResponse = await res.json();

      if (body.payment.mode === 'redirect' && body.payment.redirectUrl) {
        const url = body.payment.redirectUrl;
        // Stripe returns an absolute URL (https://checkout.stripe.com/…)
        // which needs a real navigation; the stub returns a relative
        // in-app path which wouter handles. Branch on protocol.
        if (/^https?:\/\//i.test(url)) {
          window.location.href = url;
        } else {
          setLocation(url);
        }
      } else {
        toast({
          title: 'Payment provider not configured',
          description: 'Embedded mode needs a real provider.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: "Couldn't start checkout",
        description:
          err?.name === 'AbortError'
            ? 'That took too long — check your connection and try again. You have not been charged.'
            : err?.message ?? 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const backHref = Number.isFinite(cardId) ? `/studio/card/${cardId}/edit` : '/studio';

  if (!Number.isFinite(cardId)) {
    return (
      <CheckoutLayout backHref="/studio" backLabel="Back to Studio">
        <Centered>Invalid card id.</Centered>
      </CheckoutLayout>
    );
  }
  if (isLoading) {
    return (
      <CheckoutLayout backHref={backHref}>
        <Centered>
          <Loader2 className="w-6 h-6 animate-spin text-brand" />
        </Centered>
      </CheckoutLayout>
    );
  }
  // Must be fully generated — a front-first card at 'front-ready' has a
  // front image but no inside yet; mirror the server gate (audit
  // 2026-07-02) so a half-generated card can't be deep-linked to pay.
  if (!card?.frontImageUrl || card.status !== 'completed') {
    return (
      <CheckoutLayout backHref={backHref}>
        <Centered>
          <p className="text-sm text-keeper-body mb-4">This card isn't ready to order yet.</p>
          <Button onClick={() => setLocation(`/studio/card/${cardId}/edit`)}>
            Back to editor
          </Button>
        </Centered>
      </CheckoutLayout>
    );
  }

  const activeImage =
    previewSide === 'inside' && card.insideImageUrl ? card.insideImageUrl : card.frontImageUrl;

  return (
    <CheckoutLayout backHref={backHref}>
      <header className="mb-6 sm:mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-keeper-meta mb-2">Checkout</p>
        <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-[-0.015em] text-keeper-ink">
          {recipientName ? `Send ${recipientName}'s card` : 'Send your card'}
        </h1>
      </header>

      <div className="grid md:grid-cols-[1fr_360px] gap-8">
          {/* LEFT — hero (preview + selector side-by-side), then form */}
          <div className="space-y-6">
            {/* Hero row: preview beside product choice. Both above the
                fold on desktop; stacks on mobile (preview first). */}
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Preview — capped on mobile so it doesn't dominate the
                  viewport; fills its 2-col grid cell on desktop. */}
              <div className="bg-white rounded-2xl border border-keeper-hair overflow-hidden max-w-[220px] mx-auto w-full sm:max-w-none">
                <div className="aspect-square bg-stone-50 relative">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={activeImage}
                      src={activeImage ?? ''}
                      alt=""
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  </AnimatePresence>
                </div>
                {card.insideImageUrl && (
                  <div className="px-4 py-2.5 border-t border-stone-100 flex items-center justify-center">
                    <div className="inline-flex bg-stone-100 rounded-full p-1">
                      <PreviewTab
                        active={previewSide === 'front'}
                        onClick={() => setPreviewSide('front')}
                      >
                        Front
                      </PreviewTab>
                      <PreviewTab
                        active={previewSide === 'inside'}
                        onClick={() => setPreviewSide('inside')}
                      >
                        Inside
                      </PreviewTab>
                    </div>
                  </div>
                )}
              </div>

              {/* Hero second cell — either the Giving Moment SUMMARY
                  (the common path: choice came in from /give or it's
                  a blank-inside card whose path is structural), or
                  the inline product radios (fallback for deep-links
                  to /checkout without a delivery choice on the
                  draft). See isResolved above. */}
              {/* Print-led V1: one product — a printed card that includes
                  a free digital link. No format picker. */}
              <div className="bg-white rounded-2xl border border-keeper-hair p-5 md:p-6">
                <h2 className="text-sm font-semibold text-keeper-ink mb-1">
                  Printed &amp; posted
                </h2>
                <p className="text-sm text-keeper-body leading-relaxed">
                  A premium 280gsm gloss card, posted in the UK — with a free
                  digital link to share too.
                </p>
                {freeCardApplied ? (
                  <p className="text-lg font-semibold text-keeper-ink mt-3">
                    <span className="mr-1.5 font-normal text-keeper-meta line-through">
                      {formatGBP(PRINT_PRICE)}
                    </span>
                    Free{' '}
                    <span className="text-xs font-normal text-keeper-meta">
                      — your first card's on us, just the postage
                    </span>
                  </p>
                ) : (
                  <p className="text-lg font-semibold text-keeper-ink mt-3">
                    {formatGBP(totals.total)}{' '}
                    <span className="text-xs font-normal text-keeper-meta">
                      inc. postage
                    </span>
                  </p>
                )}
              </div>
            </div>

            <Section title="Your details">
              <Field label="Your name">
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="First + last"
                  data-testid="checkout-name"
                />
              </Field>
              <Field label="Email for order receipt">
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  data-testid="checkout-email"
                />
              </Field>
            </Section>

            {includesPrint && (
              <>
                {/* Delivery destination is decided ONCE, upstream, in the
                    Giving Moment — never re-asked here (a second mutable
                    radio silently defaulted to self-send; Kevin 2026-07-20).
                    When resolved: a read-only confirmation + "Change" link.
                    When a deep-link skipped the choice: send them back to
                    pick, rather than defaulting. Pay is gated on isResolved. */}
                {isResolved ? (
                  <Section title="How it's being sent">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-keeper-ink">
                          {shipTo === 'recipient'
                            ? `Straight to ${recipientName || 'them'}`
                            : 'To you first'}
                        </p>
                        <p className="text-xs text-keeper-meta mt-0.5 leading-relaxed max-w-[42ch]">
                          {shipTo === 'recipient'
                            ? 'Addressed and posted straight to them, tracked — no extra charge.'
                            : 'Posted to you, ready to hand over in person.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLocation(`/studio/card/${cardId}/give`)}
                        className="shrink-0 text-xs font-semibold text-brand underline underline-offset-2 hover:text-brand-dark"
                        data-testid="checkout-change-delivery"
                      >
                        Change
                      </button>
                    </div>
                  </Section>
                ) : (
                  <Section title="How would you like to send it?">
                    <p className="text-sm text-keeper-body leading-relaxed">
                      Choose whether we post it straight to them, or send it to
                      you to hand over — it only takes a second.
                    </p>
                    <Button
                      onClick={() => setLocation(`/studio/card/${cardId}/give`)}
                      className="mt-3 bg-go hover:bg-go-hover text-go-foreground"
                      data-testid="checkout-choose-delivery"
                    >
                      Choose how to send it
                    </Button>
                  </Section>
                )}

                {/* Optional wax-seal sticker — direct-to-recipient only (it
                    goes on the envelope WE post). Opt-in add-on (Kevin
                    2026-07-21).

                    HIDDEN for soft launch (2026-07-27): the per-order
                    branding attachment is UNVERIFIED — the stickers seen on
                    July's live orders came from the Prodigi ACCOUNT-level
                    default insert, not our API — and the checkout charges
                    the £1.50 regardless of the PRODIGI_ENVELOPE_STICKER env
                    gate, so offering it now risks charging for a sticker
                    that never ships. Flip STICKER_OFFER_ENABLED back to
                    true ONLY after: (a) Kevin removes the account-level
                    default insert (Prodigi Settings → Branding), (b) one
                    DIR test order with the env var on shows OUR per-order
                    seal correctly placed. */}
                {STICKER_OFFER_ENABLED && isResolved && shipTo === 'recipient' && (
                  <Section title="Add a keepsake seal?">
                    <button
                      type="button"
                      onClick={() => setAddSticker((v) => !v)}
                      aria-pressed={addSticker}
                      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                        addSticker
                          ? 'border-brand bg-brand/5'
                          : 'border-keeper-hair hover:border-stone-400'
                      }`}
                      data-testid="checkout-add-sticker"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          addSticker
                            ? 'border-brand bg-brand text-white'
                            : 'border-stone-300'
                        }`}
                      >
                        {addSticker && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-keeper-ink">
                          Wax-seal envelope sticker · +{formatGBP(ENVELOPE_STICKER_GBP)}
                        </span>
                        <span className="mt-0.5 block text-xs text-keeper-meta leading-relaxed">
                          A round “only open on your special day” seal on the
                          outside of the envelope — a little moment before they
                          even open it.
                        </span>
                      </span>
                    </button>
                  </Section>
                )}

                <Section title={shipTo === 'sender' ? 'Your address' : 'Their address'}>
                  {/* Said out loud because an SA family member hit a dead
                      Pay button with no clue why (2026-08-07): we print
                      and post within the UK only, and a non-UK postcode
                      fails the form silently otherwise. International
                      buyers CAN pay — the card just has to land at a UK
                      address, so route them to "straight to them". */}
                  <p className="rounded-md bg-stone-50 px-3 py-2 text-[11.5px] leading-relaxed text-keeper-meta">
                    We deliver to <b>UK addresses only</b> for now. Buying
                    from abroad is fine — just have the card sent straight
                    to them at their UK address.
                  </p>
                  <Field label="Address line 1">
                    <Input value={line1} onChange={(e) => setLine1(e.target.value)} />
                  </Field>
                  <Field label="Address line 2 (optional)">
                    <Input value={line2} onChange={(e) => setLine2(e.target.value)} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Town / city">
                      <Input value={city} onChange={(e) => setCity(e.target.value)} />
                    </Field>
                    <Field label="Postcode">
                      <Input
                        value={postcode}
                        onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                        onBlur={handlePostcodeLookup}
                        placeholder="SW1A 1AA"
                      />
                    </Field>
                  </div>
                </Section>

                {/* Delivery speed. Production time is the headline — every
                    card is printed to order, so the tiers below buy a faster
                    SHIPPING leg, NOT faster production. We never imply
                    next-day-from-order. */}
                <Section title="Delivery speed">
                  <div className="rounded-lg border border-accent-red/30 bg-accent-red-light px-4 py-3">
                    <p className="text-xs text-accent-red-dark leading-relaxed">
                      <span className="font-semibold">Printed to order.</span>{' '}
                      {PRODUCTION_NOTICE}
                    </p>
                  </div>
                  {freeCardApplied ? (
                    /* The free card ships Standard — no tier picker. */
                    <div
                      className="rounded-xl border border-keeper-hair p-4"
                      data-testid="ship-tier-free-standard"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-keeper-ink">
                          {getShippingTier('standard').name}
                        </span>
                        <span className="text-sm font-semibold text-keeper-ink">
                          {formatGBP(getShippingTier('standard').price)}
                        </span>
                      </div>
                      <p className="text-xs text-keeper-body mt-0.5">
                        {getShippingTier('standard').carrier}
                      </p>
                      <p className="text-xs text-keeper-meta mt-1 leading-relaxed">
                        Ships {getShippingTier('standard').shippingEstimate} once
                        printed. Your free card travels Standard post.
                      </p>
                    </div>
                  ) : (
                  <RadioGroup
                    value={shippingTier}
                    onValueChange={(v) => setShippingTier(v as ShippingTierId)}
                    className="grid grid-cols-1 gap-3"
                  >
                    {SHIPPING_TIERS.map((t) => (
                      <label
                        key={t.id}
                        htmlFor={`ship-${t.id}`}
                        className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                          shippingTier === t.id
                            ? 'border-brand bg-brand-muted/40'
                            : 'border-keeper-hair hover:border-stone-300'
                        }`}
                        data-testid={`ship-tier-${t.id}`}
                      >
                        <RadioGroupItem id={`ship-${t.id}`} value={t.id} className="mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-keeper-ink">{t.name}</span>
                            <span className="text-sm font-semibold text-keeper-ink">
                              {formatGBP(t.price)}
                            </span>
                          </div>
                          <p className="text-xs text-keeper-body mt-0.5">{t.carrier}</p>
                          <p className="text-xs text-keeper-meta mt-1 leading-relaxed">
                            Ships {t.shippingEstimate} once printed.
                          </p>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                  )}
                </Section>

                {/* No gift-message or recipient-email fields — the digital
                    link goes to the CREATOR to forward if they wish (Kevin
                    2026-07-20: avoids the recipient seeing the link before
                    the card lands on the day). */}
              </>
            )}

          </div>

          {/* RIGHT — sticky summary */}
          <aside className="md:sticky md:top-8 md:self-start">
            <div className="bg-white rounded-2xl border border-keeper-hair p-5 space-y-4">
              <LineItem
                icon={<Package className="w-4 h-4" />}
                label="Printed card"
                sub={
                  freeCardApplied
                    ? 'Your first card — on us'
                    : 'Square, 280gsm gloss art card'
                }
                amount={totals.printAmount}
                original={freeCardApplied ? PRINT_PRICE : undefined}
              />
              {/* Always included free with the printed card. */}
              <LineItem
                icon={<Sparkles className="w-4 h-4 text-brand" />}
                label="Digital link"
                sub="Instant 3D share link — free"
                amount={totals.digitalAmount}
              />
              <LineItem
                label={`Postage · ${getShippingTier(effectiveTier).name}`}
                amount={totals.shippingAmount}
                muted
              />
              {totals.stickerAmount > 0 && (
                <LineItem
                  label="Envelope sticker"
                  sub="Wax-seal on the envelope"
                  amount={totals.stickerAmount}
                  muted
                />
              )}
              {totals.discount > 0 && (
                <LineItem label="Bundle discount" amount={-totals.discount} muted />
              )}

              <div className="border-t border-keeper-hair pt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-keeper-ink">Total</span>
                <span className="text-xl font-semibold text-keeper-ink">
                  {formatGBP(totals.total)}
                </span>
              </div>

              {/* Honest delivery estimate — production + carrier. */}
              {includesPrint && (
                <p className="text-[11px] text-keeper-meta leading-relaxed">
                  {deliveryEstimateCopy(effectiveTier)}
                </p>
              )}

              {!canPay && !submitting && (
                <p
                  className="text-center text-[11.5px] text-amber-700"
                  data-testid="checkout-blocked-reason"
                >
                  {!contactComplete
                    ? 'Add your name and a valid email to continue.'
                    : includesPrint && !isResolved
                      ? 'Choose where the card should be delivered first.'
                      : includesPrint && !addressComplete
                        ? postcode.trim().length > 0 && postcode.trim().length < 5
                          ? 'That postcode looks too short — we can only deliver to UK addresses.'
                          : 'Complete the delivery address to continue.'
                        : 'Almost there — check the details above.'}
                </p>
              )}
              <Button
                onClick={handlePay}
                disabled={!canPay}
                className="w-full bg-cta hover:bg-cta-hover text-cta-foreground"
                size="lg"
                data-testid="checkout-pay"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting…
                  </>
                ) : (
                  `Pay ${formatGBP(totals.total)}`
                )}
              </Button>
              {/* Promo codes are entered on Stripe's hosted payment page
                  (allow_promotion_codes), not here — signpost it so a
                  code-holder doesn't hunt for the field on this screen. */}
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-keeper-meta">
                <Tag className="h-3 w-3 shrink-0" aria-hidden />
                Got a discount code? Add it on the next page (secure payment).
              </p>
              {/* Pre-contract information (audit 2026-07-27): the ToS's
                  CCR 2013 personalised-goods exemption existed but the
                  buyer never saw it before paying — a consumer must see
                  the terms + the no-cancellation rule pre-contract. */}
              <p className="text-center text-[11px] text-keeper-meta">
                By paying you agree to our{' '}
                <a
                  href="/terms-of-service"
                  target="_blank"
                  rel="noopener"
                  className="underline underline-offset-2 hover:text-keeper-ink"
                  data-testid="checkout-terms-link"
                >
                  Terms
                </a>
                {' '}— personalised cards can't be cancelled once printing
                begins.
              </p>
              {/* Dev-only notice — never ships to the deployed site
                  (audit 2026-07-02). Remove once a real gateway is live. */}
              {import.meta.env.DEV && (
                <p className="text-[11px] text-keeper-meta text-center">
                  Payment is in dev stub mode.
                </p>
              )}
            </div>
          </aside>
      </div>
    </CheckoutLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-keeper-hair p-5 md:p-6 space-y-4">
      <h2 className="text-sm font-semibold text-keeper-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-keeper-body">{label}</Label>
      {children}
    </div>
  );
}

function PreviewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1 text-xs font-medium rounded-full transition-colors ${
        active ? 'bg-white text-keeper-ink shadow-sm' : 'text-keeper-meta hover:text-keeper-ink'
      }`}
    >
      {children}
    </button>
  );
}

function LineItem({
  icon,
  label,
  sub,
  amount,
  muted,
  original,
}: {
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  amount: number;
  muted?: boolean;
  /** Pre-discount price, shown struck through (the free-card £8.99). */
  original?: number;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <p className={`text-sm ${muted ? 'text-keeper-meta' : 'font-medium text-keeper-ink'}`}>
            {label}
          </p>
          {sub && <p className="text-xs text-keeper-meta mt-0.5">{sub}</p>}
        </div>
      </div>
      <span className={`text-sm ${muted ? 'text-keeper-meta' : 'font-medium text-keeper-ink'}`}>
        {original != null && (
          <span className="mr-1.5 font-normal text-keeper-meta line-through">
            {formatGBP(original)}
          </span>
        )}
        {amount === 0 ? 'Free' : amount < 0 ? `−${formatGBP(-amount)}` : formatGBP(amount)}
      </span>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      {children}
    </div>
  );
}
