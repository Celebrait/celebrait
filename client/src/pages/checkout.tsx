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
import { Loader2, Package, Sparkles } from 'lucide-react';
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
  deliverySurchargeGBP,
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

function formatGBP(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

// Printed card (+ free digital link) + postage for the chosen delivery
// tier + the direct-to-recipient surcharge. The server re-derives every
// pence from shared/pricing.ts, so this must stay in lockstep.
function totalsFor(tier: ShippingTierId, shipTo: 'sender' | 'recipient') {
  const printAmount = PRINT_PRICE;
  const digitalAmount = 0;
  const shippingAmount = getShippingTier(tier).price;
  const deliverySurcharge = deliverySurchargeGBP(shipTo);
  return {
    printAmount,
    digitalAmount,
    shippingAmount,
    deliverySurcharge,
    discount: 0,
    total: printAmount + shippingAmount + deliverySurcharge,
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

  // One-shot init: when the card lands, sync the local form state to
  // the resolved giving choice — including the gift-message pre-fill
  // from the Giving Moment's "from…" line, if it set one. After this
  // fires, user changes stick (gift message editable here; product +
  // ship-to editable only in the fallback radio path).
  const initAppliedRef = useRef(false);
  useEffect(() => {
    if (initAppliedRef.current || !card) return;
    if (resolvedDestination) setShipTo(resolvedDestination);
    if (delivery?.fromLine) setGiftMessage(delivery.fromLine);
    initAppliedRef.current = true;
  }, [card, resolvedFormat, resolvedDestination, delivery?.fromLine]);

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
  const [shippingTier, setShippingTier] = useState<ShippingTierId>(DEFAULT_SHIPPING_TIER);
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const includesPrint = choice !== 'digital';
  // Print-led V1: every order is a printed card that INCLUDES a free
  // digital link — so digital is always part of the order. (The dead
  // `choice` machinery would compute false here; the model says true.)
  const includesDigital = true;
  const totals = useMemo(() => totalsFor(shippingTier, shipTo), [shippingTier, shipTo]);

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
  // Recipient email is OPTIONAL — a printed card reaches them by post
  // regardless; if they give it, the recipient also gets the digital
  // link by email. Valid = blank, or a well-formed address.
  const recipientEmailValid =
    recipientEmail.trim() === '' || /.+@.+\..+/.test(recipientEmail);
  const canPay =
    contactComplete &&
    recipientEmailValid &&
    (!includesPrint || addressComplete) &&
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
        recipientEmail: recipientEmail.trim() || undefined,
      };
      if (includesPrint) {
        payload.shipTo = shipTo;
        payload.shippingTier = shippingTier;
        payload.shippingAddress = {
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          postcode: postcode.trim().toUpperCase(),
          country: 'GB',
        };
        if (shipTo === 'recipient' && giftMessage.trim()) {
          payload.giftMessage = giftMessage.trim();
        }
      }

      const res = await apiRequest('POST', `/api/studio/cards/${cardId}/checkout`, payload);
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
        description: err?.message ?? 'Something went wrong.',
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
                <p className="text-lg font-semibold text-keeper-ink mt-3">
                  {formatGBP(totals.total)}{' '}
                  <span className="text-xs font-normal text-keeper-meta">
                    inc. postage
                  </span>
                </p>
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
                {/* Ship-to choice — radios only in fallback mode. When
                    isResolved, the destination is already shown in the
                    YourChoiceSummary above; the dependent gift-message
                    + recipient-email fields live in their own
                    "Send-with" section below for clarity. */}
                {!isResolved && (
                  <Section title="How should it reach them?">
                    <RadioGroup
                      value={shipTo}
                      onValueChange={(v) => setShipTo(v as 'sender' | 'recipient')}
                      className="grid grid-cols-1 md:grid-cols-2 gap-3"
                    >
                      <ShipToOption
                        value="sender"
                        title="Send it to me"
                        description={
                          insideIsBlank
                            ? "Blank inside — you'll handwrite your message, then give it yourself."
                            : 'The finished card comes to you, to give in person.'
                        }
                      />
                      <ShipToOption
                        value="recipient"
                        title={
                          recipientName ? `Straight to ${recipientName}` : 'Straight to them'
                        }
                        description={`Posted to their door, tracked, sealed with our keepsake sticker (+${formatGBP(deliverySurchargeGBP('recipient'))}). Add a gift message if you like.`}
                      />
                    </RadioGroup>

                    {/* Footgun guard — the user left the inside blank (to
                        handwrite it) but is about to post the card straight
                        to the recipient. It would land on their doormat
                        with nothing written inside. Loud, non-blocking
                        warning with a one-tap fix. (Only in fallback mode
                        — the Giving Moment + structural blank-skip
                        design out this combination upstream.) */}
                    {insideIsBlank && shipTo === 'recipient' && (
                      <div
                        className="mt-3 rounded-lg border border-accent-red/30 bg-accent-red-light px-4 py-3"
                        data-testid="checkout-blank-inside-warning"
                      >
                        <p className="text-sm font-semibold text-accent-red-dark">
                          Heads up — this card's inside is blank
                        </p>
                        <p className="text-xs text-accent-red-dark mt-1 leading-relaxed">
                          You chose to handwrite the message yourself. Posted
                          straight to {recipientName || 'them'}, it'll arrive
                          with nothing written inside.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShipTo('sender')}
                          className="mt-2 text-xs font-semibold text-accent-red-dark underline underline-offset-2 hover:text-accent-red-dark"
                          data-testid="btn-blank-inside-fix"
                        >
                          Send it to me instead, so I can write it
                        </button>
                      </div>
                    )}

                    {shipTo === 'recipient' && (
                      <div className="space-y-4 mt-4 pt-4 border-t border-keeper-hair">
                        <Field label="Gift message (printed inside the envelope)">
                          <Input
                            value={giftMessage}
                            onChange={(e) => setGiftMessage(e.target.value)}
                            placeholder="From…"
                            maxLength={120}
                          />
                        </Field>
                        {includesDigital && (
                          <Field label="Their email (optional — sends them the digital link)">
                            <Input
                              type="email"
                              value={recipientEmail}
                              onChange={(e) => setRecipientEmail(e.target.value)}
                              placeholder="them@example.com"
                            />
                          </Field>
                        )}
                      </div>
                    )}
                  </Section>
                )}

                <Section title={shipTo === 'sender' ? 'Your address' : 'Their address'}>
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
                </Section>

                {/* "Send-with" section — isResolved + recipient-bound
                    print orders. Holds the gift-message + (for Both)
                    recipient-email fields the fallback path nests
                    under its ship-to radios. */}
                {isResolved && shipTo === 'recipient' && (
                  <Section
                    title={`Send-with details for ${recipientName || 'them'}`}
                  >
                    <Field label="Gift message (printed inside the envelope)">
                      <Input
                        value={giftMessage}
                        onChange={(e) => setGiftMessage(e.target.value)}
                        placeholder="From…"
                        maxLength={120}
                      />
                    </Field>
                    {includesDigital && (
                      <Field label="Their email (for the digital share link)">
                        <Input
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="them@example.com"
                        />
                      </Field>
                    )}
                  </Section>
                )}
              </>
            )}

            {/* Digital-only recipient email. Two modes:
                 • Fallback (!isResolved): an OPTIONAL field — "leave
                   blank → goes to you" — same as the legacy UX.
                 • Resolved + sender: skipped — link goes to the
                   sender's account email automatically.
                 • Resolved + recipient: a REQUIRED field, no "leave
                   blank" copy, since they chose to send straight. */}
            {choice === 'digital' && !isResolved && (
              <Section title="Send it to them (optional)">
                <Field label="Their email">
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="them@example.com"
                  />
                </Field>
                <p className="text-xs text-keeper-meta">
                  Leave blank and we'll send the share link to you instead.
                </p>
              </Section>
            )}

            {isResolved && choice === 'digital' && shipTo === 'recipient' && (
              <Section title={`Send the link to ${recipientName || 'them'}`}>
                <Field label="Their email">
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="them@example.com"
                  />
                </Field>
              </Section>
            )}

          </div>

          {/* RIGHT — sticky summary */}
          <aside className="md:sticky md:top-8 md:self-start">
            <div className="bg-white rounded-2xl border border-keeper-hair p-5 space-y-4">
              <LineItem
                icon={<Package className="w-4 h-4" />}
                label="Printed card"
                sub="Square, 280gsm gloss art card"
                amount={totals.printAmount}
              />
              {/* Always included free with the printed card. */}
              <LineItem
                icon={<Sparkles className="w-4 h-4 text-brand" />}
                label="Digital link"
                sub="Instant 3D share link — free"
                amount={totals.digitalAmount}
              />
              <LineItem
                label={`Postage · ${getShippingTier(shippingTier).name}`}
                amount={totals.shippingAmount}
                muted
              />
              {totals.deliverySurcharge > 0 && (
                <LineItem
                  label="Direct delivery"
                  sub="Sealed & posted straight to them"
                  amount={totals.deliverySurcharge}
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
                  {deliveryEstimateCopy(shippingTier)}
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

function ShipToOption({
  value,
  title,
  description,
}: {
  value: string;
  title: string;
  description: string;
}) {
  return (
    <Label
      htmlFor={`ship-${value}`}
      className="flex items-start gap-3 border border-keeper-hair rounded-lg p-3 cursor-pointer hover:border-stone-400 has-[:checked]:border-brand has-[:checked]:bg-brand/5 transition-colors"
    >
      <RadioGroupItem value={value} id={`ship-${value}`} className="mt-1" />
      <div>
        <p className="text-sm font-medium text-keeper-ink">{title}</p>
        <p className="text-xs text-keeper-meta mt-0.5">{description}</p>
      </div>
    </Label>
  );
}

function LineItem({
  icon,
  label,
  sub,
  amount,
  muted,
}: {
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  amount: number;
  muted?: boolean;
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
