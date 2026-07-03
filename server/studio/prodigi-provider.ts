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
//   PRODIGI_CARD_SKU         — Direct Delivery SKU (default
//                            GLOBAL-GRE-GLOS-6X6-DIR). Used when shipping to
//                            the recipient.
//   PRODIGI_CARD_SKU_SELFSEND — Self Send SKU (default
//                            GLOBAL-GRE-GLOS-6X6-BLA). Used when shipping to
//                            the sender/creator.
//   PRODIGI_SHIPPING_METHOD  — fallback when the order doesn't carry a
//                            method (Budget|Standard|Express|Overnight;
//                            default "Standard"). The order's chosen speed
//                            (req.shippingMethod) takes precedence.
//
// Print asset: GLOBAL-GRE-GLOS-6X6-DIR exposes a SINGLE print area named
// "default" sized 6732×1712 — a wide four-panel flat spread, NOT separate
// front/inside areas (verified against GET /v4.0/products/{sku} 2026-07-03).
// So at order time we compose the card's front + inside into one 6732×1713
// strip (compositor in print-compositor.ts: rear | front | inside-L | inside-R),
// upload it to R2, and send it as the lone "default" asset.
//
// Webhooks: Prodigi POSTs order status updates to a configured callback
// URL (CloudEvents-shaped, order under data). It has no signature scheme,
// so the callback URL itself must be unguessable — register it as
// /api/webhooks/prodigi/<PRODIGI_WEBHOOK_SECRET>. parseWebhook just maps the
// payload; the route (studio-checkout.ts) enforces the URL secret and drives
// the fulfilment transition + shipped/delivered emails.
//
//   PRODIGI_WEBHOOK_SECRET — required to activate the webhook route. The
//                            secret path segment; wrong/absent → 404.

import type {
  PrintProvider,
  PrintOrderRequest,
  PrintOrderResult,
  PrintProviderStatus,
} from "./print-provider";
import type { ShippingAddress } from "@shared/schema";
import { composeCardPrintStrip } from "./print-compositor";
import {
  cardImageBaseName,
  publicImageUrl,
  storeImageToCustomFilename,
} from "../image-storage";

interface ProdigiConfig {
  apiKey: string;
  baseUrl: string;
  /** Direct Delivery (-DIR): message printed, Kraft envelope, post it. */
  skuDirect: string;
  /** Self Send (-BLA): decorative inside, cellophane sleeve + spare
   *  envelopes, the creator handwrites/posts. */
  skuSelfSend: string;
  /** Fallback shipping method when the order doesn't specify one. */
  defaultShippingMethod: string;
}

function config(): ProdigiConfig {
  const apiKey = process.env.PRODIGI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PRODIGI_API_KEY is not set — cannot use the prodigi print provider. " +
        "Set it in the environment or switch STUDIO_PRINT_PROVIDER=stub.",
    );
  }
  // Confirmed products 2026-07-03: 5.5" square, 280gsm gloss-coated, HP
  // Indigo. Both share one "default" print area (6732×1712 flat spread) and
  // the same composed strip; only packaging/shipping-origin differ. The SKU
  // is chosen per-order from the delivery destination (see submitOrder).
  const skuDirect = process.env.PRODIGI_CARD_SKU ?? "GLOBAL-GRE-GLOS-6X6-DIR";
  const skuSelfSend =
    process.env.PRODIGI_CARD_SKU_SELFSEND ?? "GLOBAL-GRE-GLOS-6X6-BLA";
  const baseUrl = (
    process.env.PRODIGI_BASE_URL ?? "https://api.sandbox.prodigi.com/v4.0"
  ).replace(/\/+$/, "");
  const defaultShippingMethod = process.env.PRODIGI_SHIPPING_METHOD ?? "Standard";
  return { apiKey, baseUrl, skuDirect, skuSelfSend, defaultShippingMethod };
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

/** Fetch a stored card image (R2 public URL, or a relative /images path in
 *  local dev) into a buffer for the compositor. Relative paths are resolved
 *  through publicImageUrl → still relative in dev, so we only support http(s)
 *  here; a real Prodigi order requires R2 (Prodigi must be able to fetch the
 *  composed strip anyway). */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const abs = publicImageUrl(url);
  if (!/^https?:/i.test(abs)) {
    throw new Error(
      `Cannot fetch card image "${url}" — resolved to non-absolute "${abs}". ` +
        "The Prodigi provider needs R2 enabled (public image URLs) so both this " +
        "compositor and Prodigi itself can fetch card assets.",
    );
  }
  const res = await fetch(abs);
  if (!res.ok) {
    throw new Error(`Failed to fetch card image ${abs}: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
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
    const { skuDirect, skuSelfSend, defaultShippingMethod } = config();

    // SKU follows the delivery destination, not the inside content:
    //   recipient → -DIR (Kraft envelope, we post it)
    //   sender    → -BLA (cellophane + spare envelopes, creator posts it)
    const sku = req.shipTo === "sender" ? skuSelfSend : skuDirect;
    const shippingMethod = req.shippingMethod ?? defaultShippingMethod;

    // Compose the card's front + inside into the single 6732×1713 flat spread
    // this SKU's lone "default" print area expects, then upload it to R2 and
    // hand Prodigi its public URL. (front/inside are separate square images in
    // our system; Prodigi wants them stitched into one four-panel strip.) The
    // strip is identical for both SKUs — the inside image already carries the
    // message (or a clear centre for handwriting) from generation.
    const frontBuffer = await fetchImageBuffer(req.frontImageUrl);
    const insideBuffer = req.insideImageUrl
      ? await fetchImageBuffer(req.insideImageUrl)
      : null;
    const strip = await composeCardPrintStrip({
      frontBuffer,
      insideBuffer,
      senderFirstName: req.senderFirstName ?? null,
    });
    const stripName = `${cardImageBaseName(req.cardId, req.imageKey)}_print_strip.png`;
    await storeImageToCustomFilename(strip.toString("base64"), stripName);
    const stripUrl = publicImageUrl(stripName);
    if (!/^https?:/i.test(stripUrl)) {
      throw new Error(
        `Composed print strip URL is not absolute ("${stripUrl}") — Prodigi ` +
          "can't fetch it. R2 must be enabled for Prodigi orders.",
      );
    }
    const assets: Array<{ printArea: string; url: string }> = [
      { printArea: "default", url: stripUrl },
    ];

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
