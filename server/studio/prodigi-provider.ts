// server/studio/prodigi-provider.ts
//
// Prodigi print-fulfilment provider — implements the PrintProvider
// interface (see print-provider.ts) against Prodigi's Print API v4.0.
// Supplier locked 2026-04-29; sandbox-first so we can exercise the full
// paid → submit → status loop with FREE test orders before real money.
//
// Selected via STUDIO_PRINT_PROVIDER=prodigi. Sandbox by default; point
// PRODIGI_BASE_URL at the live host to go live.
//
// Env:
//   PRODIGI_API_KEY        — required. Prodigi API key (header X-API-Key).
//   PRODIGI_BASE_URL       — default https://api.sandbox.prodigi.com/v4.0
//                            (live: https://api.prodigi.com/v4.0)
//   PRODIGI_CARD_SKU       — required. The 5.5" square folded-card product
//                            SKU (⚠️ TBD — confirm once the paper stock
//                            decision lands; samples were ordered).
//   PRODIGI_SHIPPING_METHOD — default "Standard" (Budget|Standard|Express|
//                            Overnight). Overnight upsell isn't plumbed to
//                            the order yet, so all orders use the default.
//
// Asset print areas: a Prodigi folded greeting card exposes named print
// areas. We send front → "front" and inside → "inside". ⚠️ These names
// MUST match the chosen SKU's print areas — verify against the sandbox
// product detail (GET /v4.0/products/{sku}) when the SKU is confirmed.
//
// Webhooks: Prodigi POSTs order status updates to a configured callback
// URL (CloudEvents-shaped, order under data). It has no signature scheme,
// so the callback URL itself must be unguessable — register it with a
// secret path segment. parseWebhook just maps the payload; the route is
// responsible for the URL secret.

import type {
  PrintProvider,
  PrintOrderRequest,
  PrintOrderResult,
  PrintProviderStatus,
} from "./print-provider";
import type { ShippingAddress } from "@shared/schema";

interface ProdigiConfig {
  apiKey: string;
  baseUrl: string;
  sku: string;
  shippingMethod: string;
}

function config(): ProdigiConfig {
  const apiKey = process.env.PRODIGI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PRODIGI_API_KEY is not set — cannot use the prodigi print provider. " +
        "Set it in the environment or switch STUDIO_PRINT_PROVIDER=stub.",
    );
  }
  const sku = process.env.PRODIGI_CARD_SKU;
  if (!sku) {
    throw new Error(
      "PRODIGI_CARD_SKU is not set — the 5.5in square card product SKU is required.",
    );
  }
  const baseUrl = (
    process.env.PRODIGI_BASE_URL ?? "https://api.sandbox.prodigi.com/v4.0"
  ).replace(/\/+$/, "");
  const shippingMethod = process.env.PRODIGI_SHIPPING_METHOD ?? "Standard";
  return { apiKey, baseUrl, sku, shippingMethod };
}

async function prodigiFetch(
  path: string,
  init?: { method?: string; body?: string },
): Promise<any> {
  const { apiKey, baseUrl } = config();
  const res = await fetch(`${baseUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: init?.body,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body — leave json null, surfaced in the error below */
  }
  if (!res.ok) {
    throw new Error(
      `Prodigi ${init?.method ?? "GET"} ${path} failed: ${res.status} ${text.slice(0, 400)}`,
    );
  }
  return json;
}

/** Map our stored shipping address to Prodigi's recipient.address shape. */
function toProdigiAddress(a: ShippingAddress) {
  return {
    line1: a.line1,
    line2: a.line2 || undefined,
    postalOrZipCode: a.postcode,
    countryCode: a.country || "GB",
    townOrCity: a.city,
  };
}

/** Extract tracking (if any) from a Prodigi order's first shipment. */
function trackingFrom(order: any): { trackingNumber?: string; trackingUrl?: string } {
  const t = order?.shipments?.[0]?.tracking;
  return {
    trackingNumber: t?.number || undefined,
    trackingUrl: t?.url || undefined,
  };
}

/** Map a Prodigi order object → our normalised PrintProviderStatus enum.
 *  Prodigi's order.status.stage is InProgress | Complete | Cancelled, with
 *  finer detail under status.details and a shipments[] array. We collapse
 *  to what our dashboard needs. Conservative: anything not clearly shipped
 *  or cancelled reads as "submitted" (accepted, in the pipeline). */
function mapProdigiStatus(order: any): PrintProviderStatus["status"] {
  const stage = order?.status?.stage;
  if (stage === "Cancelled") return "failed";
  const hasTracking = !!order?.shipments?.[0]?.tracking?.number;
  const shippingDetail = order?.status?.details?.shipping;
  if (stage === "Complete" || hasTracking) return "shipped";
  if (shippingDetail && shippingDetail !== "NotStarted") return "shipped";
  const productionDetail = order?.status?.details?.inProduction;
  if (productionDetail && productionDetail !== "NotStarted") return "printed";
  return "submitted";
}

export const prodigiPrintProvider: PrintProvider = {
  name: "prodigi",

  async submitOrder(req: PrintOrderRequest): Promise<PrintOrderResult> {
    const { sku, shippingMethod } = config();

    // Front is always present; inside only for written cards (a blank-
    // inside card still generates a decorative inside, so this is usually
    // set — but guard anyway).
    const assets: Array<{ printArea: string; url: string }> = [
      { printArea: "front", url: req.frontImageUrl },
    ];
    if (req.insideImageUrl) {
      assets.push({ printArea: "inside", url: req.insideImageUrl });
    }

    const body = {
      // Our order id → Prodigi merchantReference so their webhooks/support
      // can be traced back to us. (We key our own lookup off the returned
      // Prodigi order id, stored as providerOrderId.)
      merchantReference: req.studioOrderId,
      shippingMethod,
      recipient: {
        name: req.recipientName,
        address: toProdigiAddress(req.shippingAddress),
      },
      items: [
        {
          merchantReference: `card-${req.cardId}`,
          sku,
          copies: 1,
          sizing: "fillPrintArea",
          assets,
        },
      ],
    };

    const json = await prodigiFetch("/Orders", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const order = json?.order;
    const providerOrderId = order?.id;
    if (!providerOrderId) {
      throw new Error(
        `Prodigi order create returned no order id (outcome=${json?.outcome}): ${JSON.stringify(
          json,
        ).slice(0, 300)}`,
      );
    }
    const mapped = mapProdigiStatus(order);
    return {
      providerOrderId,
      status: mapped === "failed" ? "failed" : "submitted",
    };
  },

  async getStatus(providerOrderId: string): Promise<PrintProviderStatus> {
    const json = await prodigiFetch(`/Orders/${encodeURIComponent(providerOrderId)}`);
    const order = json?.order;
    return {
      providerOrderId,
      status: mapProdigiStatus(order),
      ...trackingFrom(order),
    };
  },

  async parseWebhook(
    _headers: Record<string, string>,
    body: unknown,
  ): Promise<PrintProviderStatus> {
    const payload =
      typeof body === "string" ? JSON.parse(body) : (body as any);
    // Prodigi callback is CloudEvents-shaped: the order lives under
    // data.order. Fall back to a bare order for robustness.
    const order = payload?.data?.order ?? payload?.order ?? payload;
    const providerOrderId = order?.id;
    if (!providerOrderId) {
      throw new Error("Prodigi webhook: no order id in payload");
    }
    return {
      providerOrderId,
      status: mapProdigiStatus(order),
      ...trackingFrom(order),
    };
  },
};
