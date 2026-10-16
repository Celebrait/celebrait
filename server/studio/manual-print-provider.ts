// server/studio/manual-print-provider.ts
//
// The "a human prints it" provider (STUDIO_PRINT_PROVIDER=manual).
// South Africa launches with no print API partner: at launch volumes
// Aidan prints and couriers orders himself (a local printer is being
// lined up). So on the paid flip this provider does what Prodigi's
// does up to the hand-off (compose the print-ready strip for every card
// and store it where Prodigi's flow stores it) and then, instead of an
// API call, emails the operator a print job: the files, the envelope
// address, the need-by date and one link to /admin/fulfilment, where
// the order is marked Printed and then Shipped. Shipped goes through
// applyFulfillmentUpdate, so the customer gets the same "in the post"
// email a Prodigi webhook would have triggered.
//
// No webhook: the status lives on our own order row, and getStatus
// just reads it back.

import { eq } from "drizzle-orm";
import { db } from "../db";
import { studioOrders } from "@shared/schema";
import type { ShippingAddress } from "@shared/schema";
import { getShippingTier, DEFAULT_SHIPPING_TIER, type ShippingTierId } from "@shared/pricing";
import { MARKETS, market, publicOrigin } from "@shared/market";
import type {
  PrintProvider,
  PrintOrderRequest,
  PrintOrderResult,
  PrintProviderStatus,
} from "./print-provider";
import { composeCardPrintStrip } from "./print-compositor";
import {
  cardImageBaseName,
  loadStoredFileBuffer,
  publicImageUrl,
  storeImageToCustomFilename,
} from "../image-storage";
import { sendAdminPrintJobEmail } from "../email-service";

const PROVIDER_PREFIX = "manual-";

/** Object name of a card's composed print strip. Same name Prodigi's
 *  flow writes, so a strip made under either provider is found by both
 *  the admin page and a resubmit. */
export function printStripFilename(cardId: number, imageKey?: string | null): string {
  return `${cardImageBaseName(cardId, imageKey)}_print_strip.png`;
}

/** Origin for links in operator mail and the admin page. Production uses
 *  the market's public origin; dev without PUBLIC_APP_ORIGIN points at
 *  the local server so the links actually open. */
export function fulfilmentLinkOrigin(): string {
  const configured = process.env.PUBLIC_APP_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") {
    return `http://localhost:${process.env.PORT || 5050}`;
  }
  return publicOrigin();
}

/** Absolute URL for a stored image (R2 URLs pass through; dev's local
 *  /images/... paths get the link origin in front). */
export function absoluteImageUrl(pathOrUrl: string): string {
  const u = publicImageUrl(pathOrUrl);
  return /^https?:/i.test(u) ? u : `${fulfilmentLinkOrigin()}${u.startsWith("/") ? "" : "/"}${u}`;
}

/** Read a card image into a buffer: R2/https via fetch, a local
 *  /images/<name> path straight off disk (with the R2 fallback). Unlike
 *  Prodigi, a manual job never needs the printer to fetch anything, so
 *  this works on a dev machine without R2. */
async function loadImageBuffer(url: string): Promise<Buffer> {
  const resolved = publicImageUrl(url);
  if (/^https?:/i.test(resolved)) {
    const res = await fetch(resolved);
    if (!res.ok) throw new Error(`Failed to fetch card image ${resolved}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const name = resolved.replace(/^\/?images\//, "").replace(/^\/+/, "");
  const buf = await loadStoredFileBuffer(name);
  if (!buf) throw new Error(`Card image "${url}" not found in local storage or R2`);
  return buf;
}

/** The envelope address as lines, in the order a courier label wants
 *  them. Market-aware by shape: SA addresses carry a suburb (and maybe a
 *  province) between the street and the city; UK ones don't. Whatever
 *  fields the address has are printed, in that order, nothing invented. */
export function formatShippingAddressLines(
  address: ShippingAddress | Record<string, unknown> | null | undefined,
  recipientName?: string | null,
): string[] {
  if (!address) return [];
  const a = address as Record<string, unknown>;
  const s = (k: string): string => (typeof a[k] === "string" ? (a[k] as string).trim() : "");
  const name = (recipientName ?? "").trim() || s("name");
  const iso = s("country").toUpperCase();
  const countryCfg = (Object.values(MARKETS).find((m) => m.isoCountry === iso) ?? market());
  const countryName = countryCfg.countryName.replace(/^the /i, "");
  return [
    name,
    s("line1"),
    s("line2"),
    s("suburb"),
    s("city"),
    s("province"),
    s("postcode"),
    countryName,
  ].filter((l) => l.length > 0);
}

/** "2026-10-24" → "Sat 24 October 2026" in the market's locale. */
export function formatNeedByDate(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || null;
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString(market().locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const manualPrintProvider: PrintProvider = {
  name: "manual",

  async submitOrder(req: PrintOrderRequest): Promise<PrintOrderResult> {
    if (!req.cards.length) throw new Error("Print order has no cards");

    // 1. The print-ready strip for every card, stored under the same
    //    name Prodigi's flow uses (R2 in prod, stored_images/ in dev).
    const files = await Promise.all(
      req.cards.map(async (card) => {
        const frontBuffer = await loadImageBuffer(card.frontImageUrl);
        const insideBuffer = card.insideImageUrl ? await loadImageBuffer(card.insideImageUrl) : null;
        const strip = await composeCardPrintStrip({
          frontBuffer,
          insideBuffer,
          senderFirstName: req.senderFirstName ?? null,
        });
        const stripName = printStripFilename(card.cardId, card.imageKey);
        await storeImageToCustomFilename(strip.toString("base64"), stripName);
        return {
          cardId: card.cardId,
          copies: 1,
          printFileUrl: absoluteImageUrl(stripName),
          frontImageUrl: absoluteImageUrl(card.frontImageUrl),
        };
      }),
    );

    // 2. What the request doesn't carry (need-by date, who paid) comes
    //    off the order row. Best-effort: a missing row still mails.
    const rows = await db
      .select({
        needByDate: studioOrders.needByDate,
        shippingTier: studioOrders.shippingTier,
        customerName: studioOrders.customerName,
        customerEmail: studioOrders.customerEmail,
      })
      .from(studioOrders)
      .where(eq(studioOrders.id, req.studioOrderId))
      .limit(1)
      .catch(() => []);
    const order = rows[0];
    let shippingLabel: string | null = null;
    try {
      shippingLabel = getShippingTier((order?.shippingTier as ShippingTierId) ?? DEFAULT_SHIPPING_TIER).name;
    } catch {
      shippingLabel = order?.shippingTier ?? null;
    }

    // 3. The print job, to the operator. A send failure is logged, not
    //    thrown: the order is real and paid, and /admin/fulfilment lists
    //    it whether or not the mail arrived.
    const sent = await sendAdminPrintJobEmail({
      orderId: req.studioOrderId,
      cards: files,
      recipientName: req.recipientName,
      addressLines: formatShippingAddressLines(req.shippingAddress, req.recipientName),
      shipTo: req.shipTo,
      needBy: formatNeedByDate(order?.needByDate ?? null),
      shippingLabel,
      giftMessage: req.giftMessage ?? null,
      envelopeSticker: req.shipTo !== "sender" && req.envelopeSticker === true,
      customerName: order?.customerName ?? null,
      customerEmail: order?.customerEmail ?? null,
      adminUrl: `${fulfilmentLinkOrigin()}/admin/fulfilment#order-${req.studioOrderId}`,
    });
    if (!sent) {
      console.warn(
        `[PRINT-MANUAL] print-job email for order ${req.studioOrderId} did not send; it is still listed on /admin/fulfilment`,
      );
    }
    console.log(
      `[PRINT-MANUAL] order ${req.studioOrderId}: ${files.length} print file(s) ready, job mailed=${sent}`,
    );

    return { providerOrderId: `${PROVIDER_PREFIX}${req.studioOrderId}`, status: "submitted" };
  },

  async getStatus(providerOrderId: string): Promise<PrintProviderStatus> {
    const rows = await db
      .select({
        fulfillmentStatus: studioOrders.fulfillmentStatus,
        trackingNumber: studioOrders.trackingNumber,
        trackingUrl: studioOrders.trackingUrl,
      })
      .from(studioOrders)
      .where(eq(studioOrders.providerOrderId, providerOrderId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error(`No order holds manual print id ${providerOrderId}`);
    const known: PrintProviderStatus["status"][] = [
      "pending", "submitted", "printed", "shipped", "delivered", "failed",
    ];
    const status = known.includes(row.fulfillmentStatus as PrintProviderStatus["status"])
      ? (row.fulfillmentStatus as PrintProviderStatus["status"])
      : "submitted";
    return {
      providerOrderId,
      status,
      trackingNumber: row.trackingNumber ?? undefined,
      trackingUrl: row.trackingUrl ?? undefined,
    };
  },

  async parseWebhook(): Promise<PrintProviderStatus> {
    throw new Error("manual print provider has no webhooks (mark orders on /admin/fulfilment)");
  },
};
