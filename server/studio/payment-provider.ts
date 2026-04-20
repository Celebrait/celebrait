// Payment provider abstraction. Gateway pick (Peach / Stitch / Yoco /
// Stripe-via-UK-entity) is deferred until the business structure call
// is made. Checkout UI wires to `createPayment()` regardless, and the
// stub provider lets us test the end-to-end flow with a "mark as paid"
// dev button.

export interface CreatePaymentRequest {
  studioOrderId: string;
  amount: number; // minor units (pence)
  currency: string; // "GBP"
  customerEmail: string;
  customerName: string;
  // Where to send the browser after the gateway does its thing.
  returnUrl: string;
  cancelUrl: string;
  description?: string;
}

export interface CreatePaymentResult {
  paymentReference: string; // gateway's ID — stored on studio_orders
  // Two payment models. Either the UI drops an inline widget (clientSecret
  // or similar) and the gateway resolves in-page, or we redirect to a
  // hosted page. Peach supports both; the stub uses the redirect model
  // with a no-op URL that the UI can simulate.
  mode: "redirect" | "embedded";
  redirectUrl?: string; // when mode === 'redirect'
  clientToken?: string; // when mode === 'embedded'
}

export interface PaymentStatus {
  paymentReference: string;
  status: "pending" | "paid" | "failed" | "refunded";
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult>;
  getStatus(paymentReference: string): Promise<PaymentStatus>;
  // Webhook verification lives inside the provider so callers can't
  // skip the signature check.
  parseWebhook(headers: Record<string, string>, body: unknown): Promise<PaymentStatus>;
}

// Stub — hands back a dev-only redirect URL that the checkout page
// can render as a "Mark as paid" button. No network, no secrets.
export const stubPaymentProvider: PaymentProvider = {
  name: "stub",
  async createPayment(req) {
    const ref = `stub_${req.studioOrderId.slice(0, 8)}_${Date.now().toString(36)}`;
    return {
      paymentReference: ref,
      mode: "redirect",
      redirectUrl: `/checkout/dev-confirm?ref=${encodeURIComponent(ref)}&return=${encodeURIComponent(req.returnUrl)}`,
    };
  },
  async getStatus(paymentReference) {
    return { paymentReference, status: "pending" };
  },
  async parseWebhook() {
    throw new Error("stub provider has no webhooks");
  },
};

export function getPaymentProvider(): PaymentProvider {
  const name = process.env.STUDIO_PAYMENT_PROVIDER ?? "stub";
  switch (name) {
    case "stub":
      return stubPaymentProvider;
    default:
      throw new Error(`Unknown STUDIO_PAYMENT_PROVIDER: ${name}`);
  }
}
