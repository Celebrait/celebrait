// server/routes/studio-checkout.ts
//
// Checkout endpoints for the Studio card maker. Creates a
// `studio_orders` row, mints a view token if the order includes
// digital, and delegates to the PaymentProvider for the money bit.
// The PrintProvider is *not* called here — that happens after
// payment confirms, from the payment webhook / dev-confirm handler.
//
// All prices are in minor units (pence). Keep pricing constants here
// until Sprint 4 pricing experiments kick off; then promote to a
// config or admin-tunable table.

import type { Express, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  cards,
  studioOrders,
  shippingAddressSchema,
  type CardDraftState,
} from '@shared/schema';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';
import { getPaymentProvider } from '../studio/payment-provider';

// Pricing (pence). Tweak here until we have something real to A/B.
const PRINT_PRICE = 599;
const DIGITAL_PRICE = 99;
const UK_SHIPPING = 150;

function getUserId(req: Request): string | null {
  const id = (req as any).session?.otpUserId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function generateShareToken(): string {
  return randomBytes(16).toString('base64url');
}

// Request body schema for POST /api/studio/cards/:id/checkout. The
// client owns address validation; the server re-validates so a crafted
// POST can't slip through with a bad postcode or missing country.
const checkoutSchema = z.object({
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  includesPrint: z.boolean(),
  includesDigital: z.boolean(),
  shipTo: z.enum(['sender', 'recipient']).optional(),
  shippingAddress: shippingAddressSchema.optional(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  giftMessage: z.string().max(500).optional(),
});

export function registerStudioCheckoutRoutes(app: Express): void {
  // ── POST /api/studio/cards/:id/checkout ──────────────────────────
  // Create an order + payment intent. Returns { orderId, payment }
  // where `payment` mirrors the PaymentProvider's CreatePaymentResult
  // shape. The client uses `payment.redirectUrl` (stub/hosted mode) or
  // `payment.clientToken` (embedded) to finish the transaction.
  app.post(
    '/api/studio/cards/:id/checkout',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const cardId = parseInt(req.params.id, 10);
      if (!Number.isFinite(cardId)) return res.status(400).json({ message: 'Invalid card id' });

      const parsed = checkoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Invalid checkout payload',
          issues: parsed.error.issues,
        });
      }
      const body = parsed.data;

      if (!body.includesPrint && !body.includesDigital) {
        return res.status(400).json({ message: 'Order must include print or digital' });
      }
      if (body.includesPrint && (!body.shipTo || !body.shippingAddress)) {
        return res
          .status(400)
          .json({ message: 'Print orders need shipTo + shippingAddress' });
      }
      if (body.shipTo === 'recipient' && body.includesPrint && !body.recipientEmail) {
        // Plain-packaging direct-ship still needs a way to notify them.
        // Tightened later once the recipient comms flow lands.
      }

      try {
        const cardRows = await db
          .select({
            id: cards.id,
            userId: cards.userId,
            status: cards.status,
            frontImageUrl: cards.frontImageUrl,
            insideImageUrl: cards.insideImageUrl,
            conversationData: cards.conversationData,
            viewToken: cards.viewToken,
          })
          .from(cards)
          .where(eq(cards.id, cardId))
          .limit(1);

        const card = cardRows[0];
        if (!card) return res.status(404).json({ message: 'Card not found' });
        if (card.userId !== userId) return res.status(403).json({ message: 'Not your card' });
        if (!card.frontImageUrl) {
          return res.status(400).json({ message: 'Card is not generated yet' });
        }

        // Derive recipient name for the shipping label.
        const state = (card.conversationData as CardDraftState | null) ?? null;
        const recipientName =
          state?.recipient?.name?.trim() || body.customerName;

        const printAmount = body.includesPrint ? PRINT_PRICE : 0;
        const digitalAmount = body.includesDigital ? DIGITAL_PRICE : 0;
        const shippingAmount = body.includesPrint ? UK_SHIPPING : 0;
        const totalAmount = printAmount + digitalAmount + shippingAmount;

        // Mint a share token up-front for digital orders. Payment
        // hasn't confirmed yet, but the token is meaningless without
        // a paid order — we only reveal it once paymentStatus flips
        // to 'paid'.
        if (body.includesDigital && !card.viewToken) {
          await db
            .update(cards)
            .set({ viewToken: generateShareToken() })
            .where(eq(cards.id, cardId));
        }

        const inserted = await db
          .insert(studioOrders)
          .values({
            cardId,
            userId,
            customerEmail: body.customerEmail,
            customerName: body.customerName,
            customerPhone: body.customerPhone,
            recipientEmail: body.recipientEmail,
            recipientPhone: body.recipientPhone,
            includesPrint: body.includesPrint,
            includesDigital: body.includesDigital,
            shipTo: body.shipTo,
            shippingAddress: body.shippingAddress,
            giftMessage: body.giftMessage,
            currency: 'GBP',
            printAmount,
            digitalAmount,
            shippingAmount,
            totalAmount,
          })
          .returning({ id: studioOrders.id });

        const order = inserted[0];
        if (!order) throw new Error('Failed to insert order');

        const provider = getPaymentProvider();
        const origin = `${req.protocol}://${req.get('host')}`;
        const payment = await provider.createPayment({
          studioOrderId: order.id,
          amount: totalAmount,
          currency: 'GBP',
          customerEmail: body.customerEmail,
          customerName: body.customerName,
          description: `Celebrait card #${cardId}`,
          returnUrl: `${origin}/checkout/success?orderId=${order.id}`,
          cancelUrl: `${origin}/checkout/cancelled?orderId=${order.id}`,
        });

        await db
          .update(studioOrders)
          .set({
            paymentProvider: provider.name,
            paymentReference: payment.paymentReference,
          })
          .where(eq(studioOrders.id, order.id));

        res.json({
          orderId: order.id,
          totals: { printAmount, digitalAmount, shippingAmount, totalAmount, currency: 'GBP' },
          payment,
        });
      } catch (err: any) {
        console.error('[STUDIO-CHECKOUT] error:', err);
        res.status(500).json({ message: 'Could not create order' });
      }
    },
  );

  // ── GET /api/studio/orders/:id ───────────────────────────────────
  // Fetch order status. Auth-gated; ownership enforced. The success
  // page polls this after returning from the payment gateway.
  app.get(
    '/api/studio/orders/:id',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const orderId = req.params.id;
      try {
        const rows = await db
          .select()
          .from(studioOrders)
          .where(eq(studioOrders.id, orderId))
          .limit(1);

        const order = rows[0];
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.userId !== userId) {
          return res.status(403).json({ message: 'Not your order' });
        }

        // Attach the share URL for digital orders that have confirmed.
        let shareUrl: string | null = null;
        if (order.includesDigital && order.paymentStatus === 'paid') {
          const cardRows = await db
            .select({ viewToken: cards.viewToken })
            .from(cards)
            .where(eq(cards.id, order.cardId))
            .limit(1);
          const token = cardRows[0]?.viewToken;
          if (token) {
            shareUrl = `/card/${order.cardId}/view?t=${encodeURIComponent(token)}`;
          }
        }

        res.json({ order, shareUrl });
      } catch (err: any) {
        console.error('[STUDIO-CHECKOUT] fetch order error:', err);
        res.status(500).json({ message: 'Could not load order' });
      }
    },
  );

  // ── POST /api/studio/orders/:id/dev-confirm ──────────────────────
  // Stub-only: mark the order paid without hitting a real gateway.
  // Guarded by the current payment_provider = 'stub'; once a real
  // provider is wired, this becomes a 404. The client hits this from
  // the /checkout/dev-confirm landing page.
  app.post(
    '/api/studio/orders/:id/dev-confirm',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const orderId = req.params.id;
      try {
        const rows = await db
          .select()
          .from(studioOrders)
          .where(eq(studioOrders.id, orderId))
          .limit(1);

        const order = rows[0];
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.userId !== userId) return res.status(403).json({ message: 'Not your order' });
        if (order.paymentProvider !== 'stub') {
          return res.status(404).json({ message: 'Dev-confirm only available for stub provider' });
        }
        if (order.paymentStatus === 'paid') {
          return res.json({ ok: true, alreadyPaid: true });
        }

        await db
          .update(studioOrders)
          .set({
            paymentStatus: 'paid',
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(studioOrders.id, orderId));

        res.json({ ok: true });
      } catch (err: any) {
        console.error('[STUDIO-CHECKOUT] dev-confirm error:', err);
        res.status(500).json({ message: 'Could not confirm order' });
      }
    },
  );
}
