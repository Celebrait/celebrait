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
import { eq, desc, and, ne, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  cards,
  users,
  studioOrders,
  shippingAddressSchema,
  type CardDraftState,
  type ShippingAddress,
} from '@shared/schema';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';
import { getPaymentProvider } from '../studio/payment-provider';
import { getPrintProvider } from '../studio/print-provider';
import { publicImageUrl, resolveStoredImageUrl } from '../image-storage';
import {
  sendRecipientCardArrivedEmail,
  sendSenderOrderConfirmedEmail,
  sendSenderPrintShippedEmail,
  sendSenderPrintDeliveredEmail,
} from '../email-service';
import type { PrintProviderStatus } from '../studio/print-provider';
import {
  tierPriceGBP,
  getShippingTier,
  deliverySurchargeGBP,
  DEFAULT_SHIPPING_TIER,
  type ShippingTierId,
} from '@shared/pricing';

// Pricing in pence — sourced from shared/pricing.ts. Client checkout
// imports the same constants, so client + server totals can't drift.
// Print-led V1 (2026-07-01): every order is a printed card with a FREE
// digital link — digital is always £0 and there is no bundle/"both"
// discount. See next_digital_card_strategy.md.
const PRINT_PRICE = tierPriceGBP('printed');

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
  // Print-led V1: every order is print + free digital, forced server-side.
  // Kept optional so older clients that still send these don't 400.
  includesPrint: z.boolean().optional(),
  includesDigital: z.boolean().optional(),
  shipTo: z.enum(['sender', 'recipient']).optional(),
  shippingTier: z.enum(['standard', 'express', 'overnight']).optional(),
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

      // Print-led V1: every order is a printed card with a free digital
      // link. Force the flags server-side regardless of what the client
      // sent — digital is always included at £0.
      const includesPrint = true;
      const includesDigital = true;

      if (!body.shipTo || !body.shippingAddress) {
        return res
          .status(400)
          .json({ message: 'Printed orders need shipTo + shippingAddress' });
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
        // Must be fully finished — front-first generation passes through
        // 'front-ready' (front image exists, inside not yet generated),
        // and only 'completed' guarantees the inside is done too (write
        // AND blank both generate an inside). Checking frontImageUrl alone
        // let a half-generated card be bought with no inside (audit
        // 2026-07-02).
        if (card.status !== 'completed' || !card.frontImageUrl) {
          return res.status(400).json({ message: 'Card is not finished generating yet' });
        }

        // Derive recipient name for the shipping label.
        const state = (card.conversationData as CardDraftState | null) ?? null;
        const recipientName =
          state?.recipient?.name?.trim() || body.customerName;

        // Every order: printed card + free digital link. Digital is £0.
        // Postage is a separate line, priced from the chosen delivery tier
        // (server is the source of truth — a crafted POST can't pick a
        // cheaper tier than it pays for).
        const shippingTier: ShippingTierId = body.shippingTier ?? DEFAULT_SHIPPING_TIER;
        const printAmount = PRINT_PRICE;
        const digitalAmount = 0;
        const shippingAmount = getShippingTier(shippingTier).price;
        // Direct-to-recipient premium (£1.50): sealed + addressed + posted
        // straight to them. Server-derived from shipTo so a crafted POST can't
        // pick 'recipient' delivery without paying the surcharge.
        const deliverySurcharge = deliverySurchargeGBP(body.shipTo);
        const totalAmount = printAmount + shippingAmount + deliverySurcharge;

        // Mint a share token up-front for digital orders. Payment
        // hasn't confirmed yet, but the token is meaningless without
        // a paid order — we only reveal it once paymentStatus flips
        // to 'paid'.
        if (includesDigital && !card.viewToken) {
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
            includesPrint,
            includesDigital,
            shipTo: body.shipTo,
            shippingTier,
            shippingAddress: body.shippingAddress,
            giftMessage: body.giftMessage,
            currency: 'GBP',
            printAmount,
            digitalAmount,
            shippingAmount,
            deliverySurchargeAmount: deliverySurcharge,
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

        let order = rows[0];
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.userId !== userId) {
          return res.status(403).json({ message: 'Not your order' });
        }

        // Reconcile against Stripe if still unpaid. The success page
        // polls this route after the gateway redirect; if the webhook
        // hasn't landed yet (or isn't being forwarded in local dev),
        // ask Stripe directly. markOrderPaidAndDispatch is idempotent,
        // so this never double-fires against the webhook.
        if (
          order.paymentStatus !== 'paid' &&
          order.paymentProvider === 'stripe' &&
          order.paymentReference
        ) {
          try {
            const provider = getPaymentProvider();
            if (provider.name === 'stripe') {
              const st = await provider.getStatus(order.paymentReference);
              if (st.status === 'paid') {
                await markOrderPaidAndDispatch(order.id);
                const refreshed = await db
                  .select()
                  .from(studioOrders)
                  .where(eq(studioOrders.id, order.id))
                  .limit(1);
                order = refreshed[0] ?? order;
              }
            }
          } catch (err: any) {
            console.error(
              '[STUDIO-CHECKOUT] stripe reconcile failed:',
              err?.message ?? err,
            );
          }
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

  // ── GET /api/studio/orders ───────────────────────────────────────
  // List all orders for the current user, newest first. Joined with
  // the card row so the dashboard can show recipient/occasion +
  // front image thumbnail without a second round-trip.
  //
  // Powers /studio/orders (the Week 1 Orders & delivery list page).
  // No pagination yet — a real user has tens of orders at most in
  // the medium term; add limit/offset if that changes.
  app.get(
    '/api/studio/orders',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      try {
        const rows = await db
          .select({
            id: studioOrders.id,
            cardId: studioOrders.cardId,
            createdAt: studioOrders.createdAt,
            paidAt: studioOrders.paidAt,
            includesPrint: studioOrders.includesPrint,
            includesDigital: studioOrders.includesDigital,
            totalAmount: studioOrders.totalAmount,
            currency: studioOrders.currency,
            paymentStatus: studioOrders.paymentStatus,
            fulfillmentStatus: studioOrders.fulfillmentStatus,
            trackingUrl: studioOrders.trackingUrl,
            trackingNumber: studioOrders.trackingNumber,
            printProvider: studioOrders.printProvider,
            shipTo: studioOrders.shipTo,
            // Card-side projection — no jsonb, no image bytes blown up
            // into the response. conversationData is the one jsonb column
            // we need, for recipient name + occasion derivation.
            cardFrontImageUrl: cards.frontImageUrl,
            cardFrontImagePath: cards.frontImagePath,
            cardConversationData: cards.conversationData,
            cardViewToken: cards.viewToken,
          })
          .from(studioOrders)
          .leftJoin(cards, eq(cards.id, studioOrders.cardId))
          .where(eq(studioOrders.userId, userId))
          .orderBy(desc(studioOrders.createdAt));

        // Shape into a dashboard-friendly payload. Recipient name +
        // occasion are derived server-side so the client doesn't need
        // to re-derive per row.
        const orders = rows.map((r) => {
          const state =
            (r.cardConversationData as CardDraftState | null) ?? null;
          return {
            id: r.id,
            cardId: r.cardId,
            createdAt: r.createdAt,
            paidAt: r.paidAt,
            includesPrint: r.includesPrint,
            includesDigital: r.includesDigital,
            totalAmount: r.totalAmount,
            currency: r.currency,
            paymentStatus: r.paymentStatus,
            fulfillmentStatus: r.fulfillmentStatus,
            trackingUrl: r.trackingUrl,
            trackingNumber: r.trackingNumber,
            printProvider: r.printProvider,
            shipTo: r.shipTo,
            recipientName: state?.recipient?.name?.trim() || null,
            occasion: state?.recipient?.occasion?.trim() || null,
            frontImageUrl: resolveStoredImageUrl(r.cardFrontImagePath, r.cardFrontImageUrl),
            // Share URL for paid digital orders. Null otherwise.
            shareUrl:
              r.includesDigital &&
              r.paymentStatus === 'paid' &&
              r.cardViewToken
                ? `/card/${r.cardId}/view?t=${encodeURIComponent(r.cardViewToken)}`
                : null,
          };
        });

        res.json(orders);
      } catch (err: any) {
        console.error('[STUDIO-CHECKOUT] list orders error:', err);
        res.status(500).json({ message: 'Could not load orders' });
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
        const result = await markOrderPaidAndDispatch(orderId);
        res.json(result);
      } catch (err: any) {
        console.error('[STUDIO-CHECKOUT] dev-confirm error:', err);
        res.status(500).json({ message: 'Could not confirm order' });
      }
    },
  );

  // ── POST /api/webhooks/stripe ────────────────────────────────────
  // Stripe's server-to-server callback. NOT auth-gated (Stripe has no
  // session); security comes from the signature check inside
  // parseWebhook. This is the SOURCE OF TRUTH for "paid" — a user can
  // close the tab before the success redirect, but the webhook lands.
  //
  // Local dev: Stripe can't reach localhost, so run
  //   stripe listen --forward-to localhost:5050/api/webhooks/stripe
  // and paste the printed `whsec_...` into STRIPE_WEBHOOK_SECRET. The
  // success page also reconciles via getStatus() (see GET order route),
  // so the loop still completes even without the CLI running.
  app.post('/api/webhooks/stripe', async (req: Request, res: Response) => {
    const provider = getPaymentProvider();
    if (provider.name !== 'stripe') {
      return res.status(404).json({ message: 'Stripe webhook not active' });
    }

    let status;
    try {
      status = await provider.parseWebhook(
        req.headers as Record<string, string>,
        (req as any).rawBody ?? req.body,
      );
    } catch (err: any) {
      // Bad signature or unverifiable payload — 400 so Stripe retries.
      console.error('[STRIPE-WEBHOOK] verification failed:', err?.message ?? err);
      return res.status(400).json({ message: 'Webhook verification failed' });
    }

    try {
      if (status.status === 'paid') {
        const rows = await db
          .select()
          .from(studioOrders)
          .where(eq(studioOrders.paymentReference, status.paymentReference))
          .limit(1);
        const order = rows[0];
        if (order) {
          await markOrderPaidAndDispatch(order.id);
        } else {
          console.warn(
            '[STRIPE-WEBHOOK] no order found for payment ref',
            status.paymentReference,
          );
        }
      }
      // refunded/failed handling is V1.5 — refund matching needs the
      // payment_intent→order link, which we don't store yet. Logged in
      // next_checkout_shipping_robust.md as a gap.
      res.json({ received: true });
    } catch (err: any) {
      console.error('[STRIPE-WEBHOOK] handler error:', err);
      res.status(500).json({ message: 'Webhook handler error' });
    }
  });

  // ── POST /api/webhooks/prodigi/:secret ───────────────────────────
  // Prodigi's order-status callback. Prodigi has NO signature scheme, so
  // security is the unguessable secret path segment — register the URL
  // with PRODIGI_WEBHOOK_SECRET in the segment. Wrong/absent secret → 404
  // (don't reveal the endpoint exists). Only active when the print
  // provider is prodigi. Idempotent: applyFulfillmentUpdate only advances
  // status forward + fires each lifecycle email exactly once.
  app.post('/api/webhooks/prodigi/:secret', async (req: Request, res: Response) => {
    const provider = getPrintProvider();
    if (provider.name !== 'prodigi') {
      return res.status(404).json({ message: 'Not found' });
    }
    const secret = process.env.PRODIGI_WEBHOOK_SECRET;
    if (!secret || req.params.secret !== secret) {
      return res.status(404).json({ message: 'Not found' });
    }

    let status: PrintProviderStatus;
    try {
      status = await provider.parseWebhook(
        req.headers as Record<string, string>,
        (req as any).rawBody ?? req.body,
      );
    } catch (err: any) {
      console.error('[PRODIGI-WEBHOOK] parse failed:', err?.message ?? err);
      return res.status(400).json({ message: 'Bad payload' });
    }

    try {
      const rows = await db
        .select()
        .from(studioOrders)
        .where(eq(studioOrders.providerOrderId, status.providerOrderId))
        .limit(1);
      const order = rows[0];
      if (!order) {
        console.warn(
          '[PRODIGI-WEBHOOK] no order for provider order id',
          status.providerOrderId,
        );
        // 200 so Prodigi doesn't retry forever for an order we don't have.
        return res.json({ received: true });
      }
      await applyFulfillmentUpdate(order, status);
      res.json({ received: true });
    } catch (err: any) {
      console.error('[PRODIGI-WEBHOOK] handler error:', err);
      res.status(500).json({ message: 'Webhook handler error' });
    }
  });

  // ── POST /api/studio/orders/:id/refresh-status ───────────────────
  // Pull the live fulfilment status straight from the print provider
  // (Prodigi getStatus) and apply it — the on-demand complement to the
  // push webhook, for orders a webhook missed (downtime, before the
  // callback URL was registered). No-ops politely on stub/unsubmitted
  // orders. Same idempotent transition path as the webhook, so double
  // emails can't happen.
  app.post(
    '/api/studio/orders/:id/refresh-status',
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
        if (!order.includesPrint || !order.providerOrderId) {
          return res.status(400).json({ message: 'Nothing to refresh for this order' });
        }

        const provider = getPrintProvider();
        // Only refresh against the provider that actually holds the order
        // (a stub order id means nothing to Prodigi and vice versa).
        if (provider.name === 'stub' || provider.name !== order.printProvider) {
          return res.json({
            ok: true,
            refreshed: false,
            fulfillmentStatus: order.fulfillmentStatus,
          });
        }

        const status = await provider.getStatus(order.providerOrderId);
        await applyFulfillmentUpdate(order, status);

        const after = await db
          .select({
            f: studioOrders.fulfillmentStatus,
            tn: studioOrders.trackingNumber,
            tu: studioOrders.trackingUrl,
          })
          .from(studioOrders)
          .where(eq(studioOrders.id, orderId))
          .limit(1);
        res.json({
          ok: true,
          refreshed: true,
          fulfillmentStatus: after[0]?.f ?? order.fulfillmentStatus,
          trackingNumber: after[0]?.tn ?? null,
          trackingUrl: after[0]?.tu ?? null,
        });
      } catch (err: any) {
        console.error('[STUDIO-CHECKOUT] refresh-status error:', err?.message ?? err);
        res.status(502).json({ message: 'Could not reach the print provider' });
      }
    },
  );

  // ── POST /api/studio/orders/:id/dev-fulfillment ──────────────────
  // DEV ONLY. Simulate a Prodigi status transition so the whole
  // fulfilment + email lifecycle (submitted → printed → shipped →
  // delivered) can be exercised without Prodigi being able to reach
  // localhost. Body: { status }. Gated to non-production + own order.
  if (process.env.NODE_ENV !== 'production') {
    app.post(
      '/api/studio/orders/:id/dev-fulfillment',
      isAuthenticated,
      async (req: Request, res: Response) => {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ message: 'Not authenticated' });

        const orderId = req.params.id;
        const next = String(req.body?.status ?? '');
        if (!['printed', 'shipped', 'delivered', 'failed'].includes(next)) {
          return res
            .status(400)
            .json({ message: 'status must be printed|shipped|delivered|failed' });
        }
        try {
          const rows = await db
            .select()
            .from(studioOrders)
            .where(eq(studioOrders.id, orderId))
            .limit(1);
          const order = rows[0];
          if (!order) return res.status(404).json({ message: 'Order not found' });
          if (order.userId !== userId) return res.status(403).json({ message: 'Not your order' });

          await applyFulfillmentUpdate(order, {
            status: next as PrintProviderStatus['status'],
            // Give the shipped email real-looking tracking to render.
            trackingNumber: next === 'shipped' ? 'DEV1234567890GB' : undefined,
            trackingUrl:
              next === 'shipped'
                ? 'https://www.royalmail.com/track-your-item'
                : undefined,
          });
          const after = await db
            .select({ f: studioOrders.fulfillmentStatus })
            .from(studioOrders)
            .where(eq(studioOrders.id, orderId))
            .limit(1);
          res.json({ ok: true, fulfillmentStatus: after[0]?.f ?? null });
        } catch (err: any) {
          console.error('[STUDIO-CHECKOUT] dev-fulfillment error:', err);
          res.status(500).json({ message: 'Could not update fulfilment' });
        }
      },
    );
  }
}

// ── Shared: mark an order paid + dispatch comms ──────────────────────
// Single funnel for every "this order is now paid" trigger — the dev
// stub button, the Stripe webhook, and the success-page reconciliation
// all call this. The conditional UPDATE (only flip when NOT already
// paid) + returning() makes it idempotent AND race-safe: whoever wins
// the flip fires the emails exactly once; everyone else sees
// alreadyPaid and no-ops. Without that guard a webhook + a reconcile
// landing together would double-send the receipt.
async function markOrderPaidAndDispatch(
  orderId: string,
): Promise<{ ok: true; alreadyPaid?: boolean }> {
  const updated = await db
    .update(studioOrders)
    .set({
      paymentStatus: 'paid',
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(studioOrders.id, orderId),
        ne(studioOrders.paymentStatus, 'paid'),
      ),
    )
    .returning();

  if (updated.length === 0) {
    // Either already paid (lost the race) or no such order — no email.
    return { ok: true, alreadyPaid: true };
  }

  // Fire comms async — don't block the caller (webhook/redirect) on the
  // email round-trip. Failures are logged inside the helper.
  fireOrderPaidEmails(updated[0]).catch((err) => {
    console.error('[STUDIO-CHECKOUT] paid-email dispatch failed:', err);
  });

  // Submit the printed card to the fulfilment provider (async, non-
  // blocking). Runs exactly once per order — this branch only executes
  // when THIS call won the paid-flip. Stub today; real Prodigi when
  // STUDIO_PRINT_PROVIDER=prodigi. Previously nothing ever called
  // submitOrder → money in, no card out (audit 2026-05-27).
  submitPrintOrder(updated[0]).catch((err) => {
    console.error('[STUDIO-CHECKOUT] print submission dispatch failed:', err);
  });

  return { ok: true };
}

// ── Post-paid fulfilment: submit the printed card to the provider ────
// Fires once when an order transitions to paid. Digital-only orders are
// skipped. Records providerOrderId + fulfillmentStatus so the dashboard
// reflects reality instead of "processing" forever. Best-effort — a
// submission failure is logged + marked 'failed', never thrown back into
// the paid-flip.
async function submitPrintOrder(
  order: typeof studioOrders.$inferSelect,
): Promise<void> {
  if (!order.includesPrint) return; // nothing to print

  const shipTo = order.shipTo;
  const shippingAddress = order.shippingAddress;
  if (!shipTo || !shippingAddress) {
    console.warn('[STUDIO-CHECKOUT] print submit: no shipping address on order', order.id);
    return;
  }

  const cardRows = await db
    .select({
      userId: cards.userId,
      imageKey: cards.imageKey,
      frontImageUrl: cards.frontImageUrl,
      frontImagePath: cards.frontImagePath,
      insideImageUrl: cards.insideImageUrl,
      insideImagePath: cards.insideImagePath,
      conversationData: cards.conversationData,
    })
    .from(cards)
    .where(eq(cards.id, order.cardId))
    .limit(1);
  const card = cardRows[0];
  if (!card || !card.frontImageUrl) {
    console.warn('[STUDIO-CHECKOUT] print submit: card/front image missing for order', order.id);
    return;
  }

  const state = (card.conversationData as CardDraftState | null) ?? null;
  const recipientName =
    shipTo === 'recipient'
      ? state?.recipient?.name?.trim() || order.customerName
      : order.customerName;

  // Sender's first name (captured at signup) → back-of-card signed credit.
  // Best-effort: a missing name just falls back to the wordmark.
  let senderFirstName: string | null = null;
  if (card.userId) {
    const userRows = await db
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.id, card.userId))
      .limit(1);
    senderFirstName = userRows[0]?.firstName?.trim() || null;
  }

  const frontImageUrl = resolveStoredImageUrl(card.frontImagePath, card.frontImageUrl);
  const insideImageUrl = resolveStoredImageUrl(card.insideImagePath, card.insideImageUrl);
  if (!frontImageUrl) {
    // Guarded above via card.frontImageUrl, but keep the narrow check so
    // the provider contract (non-null front) holds by construction.
    console.warn('[STUDIO-CHECKOUT] print submit: no resolvable front image for order', order.id);
    return;
  }

  try {
    const provider = getPrintProvider();
    const result = await provider.submitOrder({
      studioOrderId: order.id,
      cardId: order.cardId,
      frontImageUrl,
      insideImageUrl,
      shipTo: shipTo as 'sender' | 'recipient',
      shippingAddress: shippingAddress as ShippingAddress,
      recipientName,
      giftMessage: order.giftMessage ?? undefined,
      imageKey: card.imageKey,
      senderFirstName,
      shippingMethod: getShippingTier(
        (order.shippingTier as ShippingTierId) ?? DEFAULT_SHIPPING_TIER,
      ).prodigiMethod,
    });
    await db
      .update(studioOrders)
      .set({
        printProvider: provider.name,
        providerOrderId: result.providerOrderId,
        fulfillmentStatus: result.status,
        updatedAt: new Date(),
      })
      .where(eq(studioOrders.id, order.id));
    console.log(
      `[STUDIO-CHECKOUT] print submitted for order ${order.id} → ${provider.name}:${result.providerOrderId} (${result.status})`,
    );
  } catch (err: any) {
    console.error(
      '[STUDIO-CHECKOUT] print submission failed for order',
      order.id,
      err?.message ?? err,
    );
    await db
      .update(studioOrders)
      .set({ fulfillmentStatus: 'failed', updatedAt: new Date() })
      .where(eq(studioOrders.id, order.id))
      .catch(() => {});
  }
}

// ── Post-paid comms dispatch ─────────────────────────────────────────
// Fires two emails when a Studio order transitions to paid:
//   - Recipient (only if digital): "A card has arrived for you"
//     with the tokenised share link.
//   - Sender: order-confirmed receipt.
// The sender "they've opened it" email is NOT fired here — that
// fires on first valid token-view in studio-drafts.ts.
async function fireOrderPaidEmails(
  order: typeof studioOrders.$inferSelect,
): Promise<void> {
  // Need the card row for recipient name + occasion (from state)
  // and the share token for the digital link.
  const cardRows = await db
    .select()
    .from(cards)
    .where(eq(cards.id, order.cardId))
    .limit(1);
  const card = cardRows[0];
  if (!card) {
    console.warn('[STUDIO-CHECKOUT] paid-email: card not found for order', order.id);
    return;
  }

  const state = (card.conversationData as CardDraftState | null) ?? null;
  const recipientNameOnCard = state?.recipient?.name?.trim() || null;
  const occasion = state?.recipient?.occasion?.trim() || null;
  const senderName = order.customerName?.split(' ')[0] || 'Someone';

  // Digital → recipient email with the share link, ONLY when we actually
  // have the recipient's address. No fall-back to the sender: sending the
  // "Hi {recipient}, {sender} sent you a card" template to the SENDER
  // mis-addresses it and, worse, the sender clicking that token link
  // fires a false "they opened your card!" notification (audit
  // 2026-07-02). The sender gets the share link via their own order
  // confirmation instead (View your card & share link).
  let digitalSentToRecipient = false;
  if (order.includesDigital && card.viewToken) {
    const recipientEmail = order.recipientEmail?.trim();
    if (recipientEmail) {
      const shareUrl = `${publicAppOrigin()}/card/${order.cardId}/view?t=${encodeURIComponent(card.viewToken)}`;
      const sent = await sendRecipientCardArrivedEmail({
        recipientEmail,
        recipientName: recipientNameOnCard,
        senderName,
        // Sender's own email passes through as Reply-To so a recipient's
        // reply lands with the sender, not Celebrait support. Audit-fix
        // 2026-04-28 — was always greetings@celebrait.co.za.
        senderEmail: order.customerEmail,
        occasion,
        shareUrl,
      });
      console.log(
        `[STUDIO-CHECKOUT] recipient email ${sent ? 'sent' : 'failed'} → ${recipientEmail} (order ${order.id})`,
      );
      digitalSentToRecipient = !!sent;
    }
  }

  // Sender → order confirmation / "it's on its way" receipt.
  const sent = await sendSenderOrderConfirmedEmail({
    senderEmail: order.customerEmail,
    senderName,
    recipientName: recipientNameOnCard,
    occasion,
    includesPrint: order.includesPrint,
    includesDigital: order.includesDigital,
    digitalSentToRecipient,
    totalAmount: order.totalAmount,
    currency: order.currency,
    orderId: order.id,
    cardId: order.cardId,
    // Delivery destination drives the "to you" vs "to {recipient}" copy.
    shipTo: order.shipTo as 'sender' | 'recipient' | null,
    // Show the printed card (front + inside) as the small spread, like the
    // card-ready / shipped / delivered emails.
    cardImageUrl: resolveStoredImageUrl(card.frontImagePath, card.frontImageUrl),
    insideImageUrl: resolveStoredImageUrl(card.insideImagePath, card.insideImageUrl),
  });
  console.log(
    `[STUDIO-CHECKOUT] sender confirmation ${sent ? 'sent' : 'failed'} → ${order.customerEmail} (order ${order.id})`,
  );

  // ── Backfill the shipping address onto the recipient's address-book
  // entry (printed orders only; digital has no postal address). The
  // upsert from generation already created the entry; this fills in
  // the address fields when we learn them at checkout. Non-blocking —
  // on failure the receipt has gone out, the order is paid, only the
  // book quality-of-life suffers. See routes/address-book.ts.
  try {
    if (order.includesPrint && order.shippingAddress) {
      const { backfillAddressFromOrder } = await import('./address-book');
      await backfillAddressFromOrder(order.id);
    }
  } catch (abErr) {
    console.error(
      `[STUDIO-CHECKOUT] address-book backfill failed for order ${order.id}:`,
      abErr,
    );
  }
}

// ── Fulfilment status transitions + lifecycle emails ────────────────
// Applies a print-provider status update (Prodigi webhook or the dev
// simulator) to an order. Advances fulfillmentStatus FORWARD only — never
// downgrades on a late/duplicate webhook — and fires the sender's shipped /
// delivered email exactly once, on the transition into that state.
// Best-effort emails: a send failure never rolls back the status.
const FULFILLMENT_RANK: Record<string, number> = {
  pending: 0,
  submitted: 1,
  printed: 2,
  shipped: 3,
  delivered: 4,
};

export async function applyFulfillmentUpdate(
  order: typeof studioOrders.$inferSelect,
  update: Pick<PrintProviderStatus, 'status' | 'trackingNumber' | 'trackingUrl'>,
): Promise<void> {
  const next = update.status;

  // Failure is terminal — record it unless we've already delivered.
  if (next === 'failed') {
    await db
      .update(studioOrders)
      .set({ fulfillmentStatus: 'failed', updatedAt: new Date() })
      .where(
        and(
          eq(studioOrders.id, order.id),
          ne(studioOrders.fulfillmentStatus, 'delivered'),
        ),
      );
    console.log(`[FULFILMENT] order ${order.id} → failed`);
    return;
  }

  const nextRank = FULFILLMENT_RANK[next];
  if (nextRank === undefined) {
    console.warn(`[FULFILMENT] unknown status "${next}" for order ${order.id}`);
    return;
  }

  // Advance only from a strictly-earlier state. Doing the guard in the
  // WHERE clause (not from the possibly-stale passed-in row) makes this
  // race-safe AND downgrade-proof: exactly one caller wins the transition
  // into `next`, and a late "shipped" after "delivered" matches no rows.
  const earlierStatuses = Object.entries(FULFILLMENT_RANK)
    .filter(([, r]) => r < nextRank)
    .map(([s]) => s);

  const advanced = await db
    .update(studioOrders)
    .set({
      fulfillmentStatus: next,
      trackingNumber: update.trackingNumber ?? order.trackingNumber,
      trackingUrl: update.trackingUrl ?? order.trackingUrl,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(studioOrders.id, order.id),
        inArray(studioOrders.fulfillmentStatus, earlierStatuses),
      ),
    )
    .returning();

  if (advanced.length === 0) {
    // Already at/past `next` — duplicate or out-of-order webhook. Still
    // stash tracking if it's newly present.
    if (
      (update.trackingNumber && update.trackingNumber !== order.trackingNumber) ||
      (update.trackingUrl && update.trackingUrl !== order.trackingUrl)
    ) {
      await db
        .update(studioOrders)
        .set({
          trackingNumber: update.trackingNumber ?? order.trackingNumber,
          trackingUrl: update.trackingUrl ?? order.trackingUrl,
          updatedAt: new Date(),
        })
        .where(eq(studioOrders.id, order.id));
    }
    return;
  }

  const fresh = advanced[0];
  console.log(`[FULFILMENT] order ${order.id} → ${next}`);

  // Only print orders have a physical lifecycle + these emails, and only
  // shipped/delivered have a sender email.
  if (!order.includesPrint) return;
  if (next !== 'shipped' && next !== 'delivered') return;

  // Recipient name from the card draft (for the "X's card" copy).
  let recipientName: string | null = null;
  let cardImageUrl: string | null = null;
  let insideImageUrl: string | null = null;
  try {
    const cardRows = await db
      .select({
        conversationData: cards.conversationData,
        frontImagePath: cards.frontImagePath,
        frontImageUrl: cards.frontImageUrl,
        insideImagePath: cards.insideImagePath,
        insideImageUrl: cards.insideImageUrl,
      })
      .from(cards)
      .where(eq(cards.id, order.cardId))
      .limit(1);
    const state = (cardRows[0]?.conversationData as CardDraftState | null) ?? null;
    recipientName = state?.recipient?.name?.trim() || null;
    cardImageUrl = resolveStoredImageUrl(
      cardRows[0]?.frontImagePath ?? null,
      cardRows[0]?.frontImageUrl ?? null,
    );
    insideImageUrl = resolveStoredImageUrl(
      cardRows[0]?.insideImagePath ?? null,
      cardRows[0]?.insideImageUrl ?? null,
    );
  } catch {
    /* non-fatal — email falls back to generic "Your card" copy */
  }
  const senderName = order.customerName?.split(' ')[0] || 'there';

  try {
    if (next === 'shipped') {
      // Courier + ETA come from what they paid for (the shipping tier);
      // Prodigi's status doesn't carry a courier name or window.
      const tier = getShippingTier(
        (order.shippingTier as ShippingTierId) ?? DEFAULT_SHIPPING_TIER,
      );
      const sent = await sendSenderPrintShippedEmail({
        senderEmail: order.customerEmail,
        senderName,
        recipientName,
        trackingNumber: fresh.trackingNumber || 'Pending',
        trackingUrl: fresh.trackingUrl || `${publicAppOrigin()}/studio/orders`,
        courier: tier.carrier,
        etaWindow: tier.shippingEstimate,
        cardImageUrl,
        insideImageUrl,
      });
      console.log(
        `[FULFILMENT] shipped email ${sent ? 'sent' : 'failed'} → ${order.customerEmail} (order ${order.id})`,
      );
    } else {
      const sent = await sendSenderPrintDeliveredEmail({
        senderEmail: order.customerEmail,
        senderName,
        recipientName,
        cardImageUrl,
        insideImageUrl,
      });
      console.log(
        `[FULFILMENT] delivered email ${sent ? 'sent' : 'failed'} → ${order.customerEmail} (order ${order.id})`,
      );
    }
  } catch (err: any) {
    console.error(
      `[FULFILMENT] lifecycle email failed for order ${order.id}:`,
      err?.message ?? err,
    );
  }
}

// Best-effort public origin for share URLs. In production, set
// PUBLIC_APP_ORIGIN to the canonical https://celebrait.co.za URL.
// Locally, we fall back to localhost at the current dev port.
function publicAppOrigin(): string {
  const configured = process.env.PUBLIC_APP_ORIGIN?.replace(/\/$/, '');
  if (configured) return configured;
  const port = process.env.PORT || 5050;
  return `http://localhost:${port}`;
}
