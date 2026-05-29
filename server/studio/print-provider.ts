// Print provider abstraction. **Supplier locked: Prodigi** (decision
// 2026-04-29, confirmed 2026-05-27). API key in Kevin's possession.
// Sandbox-first via `api.sandbox.prodigi.com/v4.0` — test orders are
// free, so the integration can be wired and exercised end-to-end
// before any real money or real prints. Real implementation lives in
// `prodigi-provider.ts` (TBD); pick it via `STUDIO_PRINT_PROVIDER=prodigi`.
//
// See next_prodigi_and_print_modes.md for SKU map (5.5×5.5 squares,
// Direct vs Self-Send modes maps onto Giving Moment destinations) and
// the open paper-stock decision (Mohawk vs Gloss). Samples ordered
// 2026-05-27 — paper choice lands when they arrive.

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
