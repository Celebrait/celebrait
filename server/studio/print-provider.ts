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
import { prodigiPrintProvider } from "./prodigi-provider";

export interface PrintOrderRequest {
  studioOrderId: string;
  cardId: number;
  frontImageUrl: string;
  insideImageUrl: string | null;
  // Delivery destination. Drives the Prodigi SKU: 'recipient' → Direct
  // Delivery (-DIR, Kraft envelope, we post it); 'sender' → Self Send
  // (-BLA, cellophane sleeve + spare envelopes, the creator posts it).
  shipTo: "sender" | "recipient";
  // Customer opted into the wax-seal envelope sticker (direct sends only).
  // Only then does the provider attach the branding sticker.
  envelopeSticker?: boolean;
  shippingAddress: ShippingAddress;
  recipientName: string;
  giftMessage?: string;
  // Prodigi shippingMethod for the chosen delivery speed
  // (Standard|Express|Overnight). Defaults to Standard when absent.
  shippingMethod?: string;
  // Card's stable per-card secret — used to name the composed print-strip
  // object so it can't be enumerated from the sequential card id (matches
  // the front/inside key scheme). Optional: legacy cards fall back to the
  // bare card id.
  imageKey?: string | null;
  // Sender's first name (captured at signup) for the back-of-card signed
  // credit. Absent → the compositor falls back to a "Made with Celebrait"
  // wordmark.
  senderFirstName?: string | null;
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
    case "prodigi":
      // The Prodigi module's config() (API key + SKU check) only runs when
      // submitOrder/getStatus is actually called, so importing it here in
      // stub mode is harmless.
      return prodigiPrintProvider;
    default:
      throw new Error(`Unknown STUDIO_PRINT_PROVIDER: ${name}`);
  }
}
