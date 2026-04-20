// Print provider abstraction. The supplier choice (Gelato leading
// candidate, Prodigi as fallback) is deliberately deferred — we build
// checkout + order flow against this interface and slot in the real
// provider once physical samples land.
//
// Implementations live alongside this file (e.g. `gelato-provider.ts`).
// Pick the active one via the `STUDIO_PRINT_PROVIDER` env var, resolved
// through `getPrintProvider()`.

import type { ShippingAddress } from "@shared/schema";

export interface PrintOrderRequest {
  studioOrderId: string;
  cardId: number;
  frontImageUrl: string;
  insideImageUrl: string | null;
  shipTo: "sender" | "recipient";
  shippingAddress: ShippingAddress;
  recipientName: string;
  giftMessage?: string;
}

export interface PrintOrderResult {
  providerOrderId: string;
  // Status at submission time. Real providers go pending→printed→shipped
  // via webhooks; the stub jumps straight to "submitted".
  status: "submitted" | "failed";
  estimatedShipDate?: string;
}

export interface PrintProviderStatus {
  providerOrderId: string;
  status: "pending" | "submitted" | "printed" | "shipped" | "delivered" | "failed";
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface PrintProvider {
  readonly name: string;
  submitOrder(req: PrintOrderRequest): Promise<PrintOrderResult>;
  getStatus(providerOrderId: string): Promise<PrintProviderStatus>;
  // Each provider parses its own webhook payload and returns a
  // normalised status update. Webhook verification (signature check)
  // lives inside the provider so callers can't forget it.
  parseWebhook(headers: Record<string, string>, body: unknown): Promise<PrintProviderStatus>;
}

// Stub — pretends to accept orders so the rest of the flow can be
// built and exercised end-to-end. Returns fake provider IDs; never
// leaves the process.
export const stubPrintProvider: PrintProvider = {
  name: "stub",
  async submitOrder(req) {
    const id = `stub_${req.studioOrderId.slice(0, 8)}_${Date.now().toString(36)}`;
    return { providerOrderId: id, status: "submitted" };
  },
  async getStatus(providerOrderId) {
    return { providerOrderId, status: "submitted" };
  },
  async parseWebhook() {
    throw new Error("stub provider has no webhooks");
  },
};

export function getPrintProvider(): PrintProvider {
  const name = process.env.STUDIO_PRINT_PROVIDER ?? "stub";
  switch (name) {
    case "stub":
      return stubPrintProvider;
    default:
      throw new Error(`Unknown STUDIO_PRINT_PROVIDER: ${name}`);
  }
}
