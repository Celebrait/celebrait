// server/meta-capi.ts — Meta Conversions API: the server-side Purchase.
//
// Browsers lose events (ad blockers, Safari ITP, the tab closed on the
// gateway page), so the paid flip also tells Meta directly. It uses the
// SAME event_id as the browser pixel ('order-<orderId>', see
// client/src/lib/pixel.ts) so Meta de-duplicates the pair into one sale.
//
// Consent first: an order is reported ONLY when the customer accepted the
// advertising cookie at checkout (studio_orders.ad_consent = true). No
// consent, no pixel id, no token, or a £0 comped order → nothing is sent.
//
// Env:
//   META_PIXEL_ID          the dataset / pixel id (also gates the client)
//   META_CAPI_TOKEN        Events Manager → Settings → Conversions API token
//   META_TEST_EVENT_CODE   optional; events show under Test events only
//   META_GRAPH_VERSION     optional; default below
//   META_GRAPH_BASE        optional; default https://graph.facebook.com
//                          (tests point it at a local stub)
//
// Fire-and-forget: never throws, never blocks the paid flip.

import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { studioOrders } from '@shared/schema';
import { publicOrigin, serverPixelId } from '@shared/market';

const DEFAULT_GRAPH_VERSION = 'v25.0';

type Order = typeof studioOrders.$inferSelect;
interface AdMatch { fbp?: string; fbc?: string; ua?: string; ip?: string }

export function metaCapiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!serverPixelId(env) && !!(env.META_CAPI_TOKEN ?? '').trim();
}

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

/** The event Meta receives (exported for tests; secrets never in it). */
export function buildPurchaseEvent(order: Order, nowSec = Math.floor(Date.now() / 1000)) {
  const m = (order.adMatch ?? {}) as AdMatch;
  const minor = order.amountPaid ?? order.totalAmount;
  const successPath = order.userId
    ? `/checkout/success?orderId=${order.id}`
    : `/order/${order.id}?from=payment`;
  const paidSec = order.paidAt ? Math.floor(new Date(order.paidAt).getTime() / 1000) : nowSec;
  return {
    event_name: 'Purchase',
    event_time: Math.min(paidSec, nowSec),
    event_id: `order-${order.id}`,
    action_source: 'website' as const,
    event_source_url: `${publicOrigin()}${successPath}`,
    user_data: {
      em: [sha256(order.customerEmail.trim().toLowerCase())],
      ...(m.fbp ? { fbp: m.fbp } : {}),
      ...(m.fbc ? { fbc: m.fbc } : {}),
      ...(m.ua ? { client_user_agent: m.ua } : {}),
      ...(m.ip ? { client_ip_address: m.ip } : {}),
    },
    custom_data: {
      value: Math.round(minor) / 100,
      currency: order.currency,
      order_id: order.id,
      num_items: 1,
    },
  };
}

/** Report a paid order to Meta. Safe to call for every paid flip: it
 *  decides for itself whether it may send. */
export async function sendMetaPurchase(order: Order): Promise<void> {
  try {
    const env = process.env;
    const pixel = serverPixelId(env);
    const token = (env.META_CAPI_TOKEN ?? '').trim();
    if (!pixel || !token) return;
    if (order.adConsent !== true) return;
    const minor = order.amountPaid ?? order.totalAmount;
    if (!(minor > 0)) return; // comped = a gift, not a sale

    const version = (env.META_GRAPH_VERSION ?? '').trim() || DEFAULT_GRAPH_VERSION;
    const base = ((env.META_GRAPH_BASE ?? '').trim() || 'https://graph.facebook.com').replace(/\/+$/, '');
    const testCode = (env.META_TEST_EVENT_CODE ?? '').trim();
    const body = {
      data: [buildPurchaseEvent(order)],
      ...(testCode ? { test_event_code: testCode } : {}),
    };
    const url = `${base}/${version}/${pixel}/events?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[META-CAPI] Purchase for order ${order.id} refused: ${res.status} ${text.slice(0, 300)}`);
      return;
    }
    console.log(`[META-CAPI] Purchase sent for order ${order.id}${testCode ? ' (test event)' : ''}`);
    // Data minimisation: the matching signals have done their job.
    await db.update(studioOrders).set({ adMatch: null }).where(eq(studioOrders.id, order.id));
  } catch (err) {
    console.warn('[META-CAPI] Purchase send failed (ignored):', (err as Error)?.message ?? err);
  }
}
