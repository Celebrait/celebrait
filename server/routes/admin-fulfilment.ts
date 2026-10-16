// server/routes/admin-fulfilment.ts
//
// The print queue for orders a human fulfils (STUDIO_PRINT_PROVIDER=
// manual, the SA launch). Powers /admin/fulfilment:
//   GET  /api/admin/fulfilment            paid print orders still to do
//                                          (pending/submitted/printed,
//                                          plus failed) and the last few
//                                          shipped, with print files and
//                                          the envelope address as lines.
//   POST /api/admin/orders/:id/fulfilment  { status: 'printed' } or
//                                          { status: 'shipped', courier,
//                                          trackingNumber, trackingUrl? }
// Marking goes through applyFulfillmentUpdate, the same transition the
// Prodigi webhook uses, so the customer gets the existing "in the post"
// email and nothing about emails is duplicated here. Admin-only.

import type { Express, Request, Response } from 'express';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { cards, orderItems, studioOrders, type CardDraftState, type ShippingAddress } from '@shared/schema';
import { requireAdmin } from './admin-card-lab';
import { applyFulfillmentUpdate } from './studio-checkout';
import {
  absoluteImageUrl,
  formatNeedByDate,
  formatShippingAddressLines,
  printStripFilename,
} from '../studio/manual-print-provider';
import { resolveStoredImageUrl } from '../image-storage';

const OPEN_STATUSES = ['pending', 'submitted', 'printed', 'failed'];

type OrderRow = typeof studioOrders.$inferSelect;

async function shapeOrders(rows: OrderRow[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((o) => o.id);
  const items = await db
    .select({ orderId: orderItems.orderId, cardId: orderItems.cardId, position: orderItems.position })
    .from(orderItems)
    .where(inArray(orderItems.orderId, ids))
    .orderBy(orderItems.position);
  const cardIdsByOrder = new Map<string, number[]>();
  for (const it of items) {
    const list = cardIdsByOrder.get(it.orderId) ?? [];
    list.push(it.cardId);
    cardIdsByOrder.set(it.orderId, list);
  }
  const allCardIds = Array.from(
    new Set(rows.flatMap((o) => cardIdsByOrder.get(o.id) ?? [o.cardId])),
  );
  const cardRows = allCardIds.length
    ? await db
        .select({
          id: cards.id,
          imageKey: cards.imageKey,
          frontImagePath: cards.frontImagePath,
          frontImageUrl: cards.frontImageUrl,
          conversationData: cards.conversationData,
        })
        .from(cards)
        .where(inArray(cards.id, allCardIds))
    : [];
  const cardById = new Map(cardRows.map((c) => [c.id, c]));

  return rows.map((o) => {
    const cardIds = cardIdsByOrder.get(o.id) ?? [o.cardId];
    const first = cardById.get(cardIds[0]);
    const state = (first?.conversationData as CardDraftState | null) ?? null;
    const address = (o.shippingAddress as ShippingAddress | null) ?? null;
    // Same envelope-name rule as submitPrintOrder: typed name, then the
    // card's recipient on a direct send, then the buyer.
    const recipientName =
      address?.name?.trim() ||
      (o.shipTo === 'recipient' ? state?.recipient?.name?.trim() || o.customerName : o.customerName);
    // A strip exists once a real provider composed it (manual or
    // Prodigi); a stub "submission" never made one.
    const composed = !!o.providerOrderId && (o.printProvider === 'manual' || o.printProvider === 'prodigi');
    return {
      id: o.id,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      recipientName,
      shipTo: o.shipTo,
      addressLines: formatShippingAddressLines(address, recipientName),
      needByDate: o.needByDate ?? null,
      needByLabel: formatNeedByDate(o.needByDate),
      giftMessage: o.giftMessage ?? null,
      envelopeSticker: (o.envelopeStickerAmount ?? 0) > 0,
      shippingTier: o.shippingTier,
      fulfillmentStatus: o.fulfillmentStatus,
      printProvider: o.printProvider,
      providerOrderId: o.providerOrderId,
      trackingNumber: o.trackingNumber,
      trackingUrl: o.trackingUrl,
      paidAt: o.paidAt,
      updatedAt: o.updatedAt,
      cards: cardIds.map((id) => {
        const c = cardById.get(id);
        const front = c ? resolveStoredImageUrl(c.frontImagePath, c.frontImageUrl) : null;
        return {
          cardId: id,
          copies: 1,
          frontImageUrl: front,
          printFileUrl: composed && c ? absoluteImageUrl(printStripFilename(id, c.imageKey)) : null,
        };
      }),
    };
  });
}

const markSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('printed') }),
  z.object({
    status: z.literal('shipped'),
    courier: z.string().trim().min(1, 'Courier name is required').max(80),
    trackingNumber: z.string().trim().min(1, 'Tracking number is required').max(120),
    trackingUrl: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => !v || /^https?:\/\//i.test(v), 'Tracking link must start with http(s)://'),
  }),
]);

export function registerAdminFulfilmentRoutes(app: Express): void {
  app.get('/api/admin/fulfilment', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const open = await db
        .select()
        .from(studioOrders)
        .where(
          and(
            eq(studioOrders.paymentStatus, 'paid'),
            eq(studioOrders.includesPrint, true),
            inArray(studioOrders.fulfillmentStatus, OPEN_STATUSES),
          ),
        )
        // Soonest need-by first; undated orders after, oldest paid first.
        .orderBy(sql`${studioOrders.needByDate} asc nulls last`, studioOrders.paidAt)
        .limit(200);
      const shipped = await db
        .select()
        .from(studioOrders)
        .where(
          and(
            eq(studioOrders.paymentStatus, 'paid'),
            eq(studioOrders.includesPrint, true),
            inArray(studioOrders.fulfillmentStatus, ['shipped', 'delivered']),
            gte(studioOrders.updatedAt, sql`now() - interval '14 days'`),
          ),
        )
        .orderBy(desc(studioOrders.updatedAt))
        .limit(20);
      res.json({
        provider: process.env.STUDIO_PRINT_PROVIDER ?? 'stub',
        queue: await shapeOrders(open),
        recentlyShipped: await shapeOrders(shipped),
      });
    } catch (err) {
      console.error('[ADMIN_FULFILMENT] list error:', err);
      res.status(500).json({ message: 'Failed to load the print queue' });
    }
  });

  app.post('/api/admin/orders/:id/fulfilment', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const parsed = markSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid request' });
    }
    const orderId = String(req.params.id ?? '').trim();
    try {
      const rows = await db.select().from(studioOrders).where(eq(studioOrders.id, orderId)).limit(1);
      const order = rows[0];
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.paymentStatus !== 'paid') {
        return res.status(400).json({ message: `Order is ${order.paymentStatus}, not paid` });
      }
      if (!order.includesPrint) {
        return res.status(400).json({ message: 'This order has nothing to print' });
      }
      const body = parsed.data;
      await applyFulfillmentUpdate(
        order,
        body.status === 'shipped'
          ? {
              status: 'shipped',
              courier: body.courier,
              trackingNumber: body.trackingNumber,
              trackingUrl: body.trackingUrl,
            }
          : { status: 'printed' },
      );
      const after = await db
        .select({
          fulfillmentStatus: studioOrders.fulfillmentStatus,
          trackingNumber: studioOrders.trackingNumber,
          trackingUrl: studioOrders.trackingUrl,
        })
        .from(studioOrders)
        .where(eq(studioOrders.id, orderId))
        .limit(1);
      const now = after[0]?.fulfillmentStatus ?? order.fulfillmentStatus;
      // applyFulfillmentUpdate only moves forward; say so when it didn't.
      if (now !== body.status) {
        return res.status(409).json({
          message: `Order is already ${now}; it can't go back to ${body.status}.`,
          fulfillmentStatus: now,
        });
      }
      console.log(`[ADMIN_FULFILMENT] order ${orderId} marked ${body.status}`);
      res.json({ ok: true, ...after[0] });
    } catch (err) {
      console.error('[ADMIN_FULFILMENT] mark error:', err);
      res.status(500).json({ message: 'Could not update the order' });
    }
  });
}
