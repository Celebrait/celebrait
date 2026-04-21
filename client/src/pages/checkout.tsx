// client/src/pages/checkout.tsx
//
// Studio checkout. Product-first: pick Print / Digital / Both, then
// fill in only the fields that product needs. The interactive front/
// inside preview leads the page — it's what they're paying for.
//
// Pricing (pence): print 599, digital 99, UK shipping 150. Both-tier
// carries a 50p bundle discount as psychology — shown as a line item
// so there's no hidden maths.
//
// Builds against the stubbed PaymentProvider today; swapping to
// Peach / Stitch / Stripe-via-UK is a provider swap, not a rebuild.

import { useMemo, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Package, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import CheckoutLayout from '@/layouts/checkout-layout';

interface CardSummary {
  id: number;
  status: string | null;
  frontImageUrl: string | null;
  insideImageUrl: string | null;
  state?: { recipient?: { name?: string | null } };
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

const PRINT_PRICE = 599;
const DIGITAL_PRICE = 99;
const UK_SHIPPING = 150;
const BUNDLE_DISCOUNT = 50;

function formatGBP(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function totalsFor(choice: ProductChoice) {
  const printAmount = choice === 'digital' ? 0 : PRINT_PRICE;
  const digitalAmount = choice === 'print' ? 0 : DIGITAL_PRICE;
  const shippingAmount = choice === 'digital' ? 0 : UK_SHIPPING;
  const discount = choice === 'both' ? BUNDLE_DISCOUNT : 0;
  return {
    printAmount,
    digitalAmount,
    shippingAmount,
    discount,
    total: printAmount + digitalAmount + shippingAmount - discount,
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

  const [choice, setChoice] = useState<ProductChoice>('both');
  const [previewSide, setPreviewSide] = useState<'front' | 'inside'>('front');

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [shipTo, setShipTo] = useState<'sender' | 'recipient'>('sender');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const includesPrint = choice !== 'digital';
  const includesDigital = choice !== 'print';
  const totals = useMemo(() => totalsFor(choice), [choice]);

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
  const recipientEmailValid =
    !(shipTo === 'recipient' && includesDigital) || /.+@.+\..+/.test(recipientEmail);
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
      if (includesDigital && welcomeMessage.trim()) {
        payload.welcomeMessage = welcomeMessage.trim();
      }
      if (includesPrint) {
        payload.shipTo = shipTo;
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
        setLocation(body.payment.redirectUrl);
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
  if (!card?.frontImageUrl) {
    return (
      <CheckoutLayout backHref={backHref}>
        <Centered>
          <p className="text-sm text-stone-600 mb-4">This card isn't ready to order yet.</p>
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
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">Checkout</p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-ink">
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
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden max-w-[220px] mx-auto w-full sm:max-w-none">
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

              {/* Product choice — stacked so each option reads cleanly */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 md:p-6 space-y-3">
                <h2 className="text-sm font-semibold text-ink mb-1">
                  How would you like to send it?
                </h2>
                <RadioGroup
                  value={choice}
                  onValueChange={(v) => setChoice(v as ProductChoice)}
                  className="space-y-2.5"
                >
                  <ProductOption
                    value="digital"
                    title="Digital"
                    description="3D share link, sent instantly."
                    price={totalsFor('digital').total}
                  />
                  <ProductOption
                    value="print"
                    title="Printed"
                    description="Square card, posted in the UK."
                    price={totalsFor('print').total}
                  />
                  <ProductOption
                    value="both"
                    title="Printed + digital"
                    description="Instant share + the real thing in the post."
                    price={totalsFor('both').total}
                  />
                </RadioGroup>
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
                <Section title="Who gets the card in the post?">
                  <RadioGroup
                    value={shipTo}
                    onValueChange={(v) => setShipTo(v as 'sender' | 'recipient')}
                    className="grid grid-cols-1 md:grid-cols-2 gap-3"
                  >
                    <ShipToOption
                      value="sender"
                      title="Send it to me"
                      description="I'll give it to them in person."
                    />
                    <ShipToOption
                      value="recipient"
                      title="Ship direct to them"
                      description="Plain packaging. Optional gift message."
                    />
                  </RadioGroup>

                  {shipTo === 'recipient' && (
                    <div className="space-y-4 mt-4 pt-4 border-t border-stone-200">
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
                    </div>
                  )}
                </Section>

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
              </>
            )}

            {choice === 'digital' && (
              <Section title="Send it to them (optional)">
                <Field label="Their email">
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="them@example.com"
                  />
                </Field>
                <p className="text-xs text-stone-500">
                  Leave blank and we'll send the share link to you instead.
                </p>
              </Section>
            )}

            {includesDigital && (
              <Section title="Welcome message (optional)">
                <Field label="A little note they'll see when they open the link">
                  <textarea
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value.slice(0, 240))}
                    placeholder={
                      recipientName
                        ? `A little something for you, ${recipientName} ✨`
                        : "A little something for you ✨"
                    }
                    rows={3}
                    maxLength={240}
                    className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:border-brand resize-none"
                    data-testid="checkout-welcome-message"
                  />
                </Field>
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>Shown above "For {recipientName || 'them'}" on the opening screen.</span>
                  <span>{welcomeMessage.length}/240</span>
                </div>
              </Section>
            )}
          </div>

          {/* RIGHT — sticky summary */}
          <aside className="md:sticky md:top-8 md:self-start">
            <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
              {includesPrint && (
                <LineItem
                  icon={<Package className="w-4 h-4" />}
                  label="Printed card"
                  sub="Square, Mohawk / premium stock"
                  amount={totals.printAmount}
                />
              )}
              {includesDigital && (
                <LineItem
                  icon={<Sparkles className="w-4 h-4 text-brand" />}
                  label="Digital version"
                  sub="Instant 3D share link"
                  amount={totals.digitalAmount}
                />
              )}
              {includesPrint && (
                <LineItem label="UK shipping" amount={totals.shippingAmount} muted />
              )}
              {totals.discount > 0 && (
                <LineItem label="Bundle discount" amount={-totals.discount} muted />
              )}

              <div className="border-t border-stone-200 pt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-ink">Total</span>
                <span className="text-xl font-semibold text-ink">
                  {formatGBP(totals.total)}
                </span>
              </div>

              <Button
                onClick={handlePay}
                disabled={!canPay}
                className="w-full"
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
              <p className="text-[11px] text-stone-400 text-center">
                Payment is in dev stub mode.
              </p>
            </div>
          </aside>
      </div>
    </CheckoutLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-stone-200 p-5 md:p-6 space-y-4">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-stone-600">{label}</Label>
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
        active ? 'bg-white text-ink shadow-sm' : 'text-stone-500 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function ProductOption({
  value,
  title,
  description,
  price,
}: {
  value: string;
  title: string;
  description: string;
  price: number;
}) {
  return (
    <Label
      htmlFor={`product-${value}`}
      className="relative flex items-start gap-3 border border-stone-200 rounded-xl p-3.5 cursor-pointer hover:border-stone-400 has-[:checked]:border-brand has-[:checked]:bg-brand/5 transition-colors"
    >
      <RadioGroupItem value={value} id={`product-${value}`} className="mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-ink">{title}</p>
          <p className="text-sm font-semibold text-ink">{formatGBP(price)}</p>
        </div>
        <p className="text-xs text-stone-500 mt-0.5">{description}</p>
      </div>
    </Label>
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
      className="flex items-start gap-3 border border-stone-200 rounded-lg p-3 cursor-pointer hover:border-stone-400 has-[:checked]:border-brand has-[:checked]:bg-brand/5 transition-colors"
    >
      <RadioGroupItem value={value} id={`ship-${value}`} className="mt-1" />
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-stone-500 mt-0.5">{description}</p>
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
          <p className={`text-sm ${muted ? 'text-stone-500' : 'font-medium text-ink'}`}>
            {label}
          </p>
          {sub && <p className="text-xs text-stone-500 mt-0.5">{sub}</p>}
        </div>
      </div>
      <span className={`text-sm ${muted ? 'text-stone-500' : 'font-medium text-ink'}`}>
        {amount < 0 ? `−${formatGBP(-amount)}` : formatGBP(amount)}
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
