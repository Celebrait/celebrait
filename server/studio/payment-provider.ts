// Payment provider abstraction. Gateway: **Stripe** (test mode wired
// 2026-05-27, see next_payment_gateway.md). Checkout UI wires to
// `createPayment()` regardless of provider; the stub provider keeps the
// "mark as paid" dev button available by flipping
// STUDIO_PAYMENT_PROVIDER=stub.
//
// Note: stripe-provider.ts imports only TYPES from this file (erased at
// runtime), so the value-import of stripePaymentProvider below is not a
// runtime circular dependency.

import { stripePaymentProvider } from "./stripe-provider";

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
    case "stripe":
      // The stripe provider constructs its SDK client lazily, so the
      // import is inert until createPayment/getStatus is actually called.
      return stripePaymentProvider;
    default:
      throw new Error(`Unknown STUDIO_PAYMENT_PROVIDER: ${name}`);
  }
}
