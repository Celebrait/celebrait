// client/src/pages/checkout.tsx
//
// Studio checkout. One page, one form, one "Pay" button. Builds
// against the stubbed PaymentProvider today — swapping to Peach/Stitch/
// Stripe-via-UK is a provider-swap, not a UI rebuild.
//
// Order shape: print (£5.99) + optional digital add-on (£0.99) + UK
// shipping (£1.50). Ship-to choice: sender or direct-to-recipient
// with plain packaging + optional gift message.

import { useEffect, useMemo, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Package, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CardSummary {
  id: number;
  status: string | null;
  frontImageUrl: string | null;
  state?: { recipient?: { name?: string | null } };
}

interface CheckoutResponse {
  orderId: string;
  totals: {
    printAmount: number;
    digitalAmount: number;
    shippingAmount: number;
    totalAmount: number;
    currency: string;
  };
  payment: {
    paymentReference: string;
    mode: 'redirect' | 'embedded';
    redirectUrl?: string;
    clientToken?: string;
  };
}

const PRINT_PRICE = 599;
const DIGITAL_PRICE = 99;
const UK_SHIPPING = 150;

function formatGBP(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
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

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [includesDigital, setIncludesDigital] = useState(true);
  const [shipTo, setShipTo] = useState<'sender' | 'recipient'>('sender');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Postcode lookup via postcodes.io — free, no key, validates +
  // returns the admin area (usually the town/city). Fires on blur when
  // the postcode looks plausible. Doesn't return specific addresses,
  // so line1 still needs manual entry. Paid lookup (getAddress.io /
  // Loqate) can slot in later to autofill the full address.
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
      // Silent — postcode validation is nice-to-have.
    }
  };

  const totals = useMemo(() => {
    const printAmount = PRINT_PRICE;
    const digitalAmount = includesDigital ? DIGITAL_PRICE : 0;
    const shippingAmount = UK_SHIPPING;
    return {
      printAmount,
      digitalAmount,
      shippingAmount,
      totalAmount: printAmount + digitalAmount + shippingAmount,
    };
  }, [includesDigital]);

  const addressComplete =
    line1.trim().length > 0 && city.trim().length > 0 && postcode.trim().length >= 5;
  const contactComplete =
    customerName.trim().length > 0 && /.+@.+\..+/.test(customerEmail);
  const recipientEmailValid =
    shipTo !== 'recipient' || !includesDigital || /.+@.+\..+/.test(recipientEmail);
  const canPay = addressComplete && contactComplete && recipientEmailValid && !submitting;

  const handlePay = async () => {
    if (!canPay || !Number.isFinite(cardId)) return;
    setSubmitting(true);
    try {
      const res = await apiRequest('POST', `/api/studio/cards/${cardId}/checkout`, {
        customerEmail,
        customerName,
        includesPrint: true,
        includesDigital,
        shipTo,
        shippingAddress: {
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          postcode: postcode.trim().toUpperCase(),
          country: 'GB',
        },
        recipientEmail: recipientEmail.trim() || undefined,
        giftMessage: giftMessage.trim() || undefined,
      });
      const body: CheckoutResponse = await res.json();

      if (body.payment.mode === 'redirect' && body.payment.redirectUrl) {
        setLocation(body.payment.redirectUrl);
      } else {
        // Embedded mode — not implemented for stub. Surface clearly.
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

  if (!Number.isFinite(cardId)) {
    return <Centered>Invalid card id.</Centered>;
  }
  if (isLoading) {
    return (
      <Centered>
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </Centered>
    );
  }
  if (!card?.frontImageUrl) {
    return (
      <Centered>
        <p className="text-sm text-stone-600 mb-4">This card isn't ready to order yet.</p>
        <Button onClick={() => setLocation(`/studio/card/${cardId}/edit`)}>
          Back to editor
        </Button>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7f1]">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="grid md:grid-cols-[1fr_360px] gap-8">
          {/* LEFT — form */}
          <div className="space-y-8">
            <header>
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">
                Checkout
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold text-ink">
                {recipientName ? `Send ${recipientName}'s card` : 'Send your card'}
              </h1>
            </header>

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
                    <Field label="Their email (for the digital version)">
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
          </div>

          {/* RIGHT — summary */}
          <aside className="space-y-4 md:sticky md:top-8 md:self-start">
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="aspect-square bg-stone-100">
                <img
                  src={card.frontImageUrl}
                  alt=""
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-5 space-y-4">
                <LineItem
                  icon={<Package className="w-4 h-4" />}
                  label="Printed card"
                  sub="Square, posted in the UK"
                  amount={totals.printAmount}
                />

                <div className="flex items-start gap-3 py-3 border-t border-stone-100">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-brand" />
                      <p className="font-medium text-sm text-ink">Digital version</p>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Instant 3D share link they can open on their phone.
                    </p>
                    <p className="text-xs text-brand font-medium mt-1">
                      Add for {formatGBP(DIGITAL_PRICE)}
                    </p>
                  </div>
                  <Switch
                    checked={includesDigital}
                    onCheckedChange={setIncludesDigital}
                    data-testid="checkout-digital-toggle"
                  />
                </div>

                <LineItem label="UK shipping" amount={totals.shippingAmount} muted />

                <div className="border-t border-stone-200 pt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">Total</span>
                  <span className="text-xl font-semibold text-ink">
                    {formatGBP(totals.totalAmount)}
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
                    `Pay ${formatGBP(totals.totalAmount)}`
                  )}
                </Button>
                <p className="text-[11px] text-stone-400 text-center">
                  Payment is in dev stub mode.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-stone-200 p-5 md:p-6 space-y-4">
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
        {formatGBP(amount)}
      </span>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#faf7f1] text-center p-6">
      {children}
    </div>
  );
}
