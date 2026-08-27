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
import { eq, desc, and, ne, or, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { orderItems,
  cards,
  users,
  studioOrders,
  shippingAddressSchema,
  type CardDraftState,
  type ShippingAddress,
} from '@shared/schema';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';
import { getPaymentProvider } from '../studio/payment-provider';
import {
  getFreeCardStatus,
  consumeFreeCardCredit,
} from '../studio/free-card';
import { validateCompCode, consumeCompCode } from '../studio/comp-code';
import { getPrintProvider, type PrintOrderCard } from '../studio/print-provider';
import { publicImageUrl, resolveStoredImageUrl } from '../image-storage';
import {
  sendRecipientCardArrivedEmail,
  sendSenderOrderConfirmedEmail,
  sendRefundEmail,
  sendSenderPrintShippedEmail,
  sendSenderPrintDeliveredEmail,
  sendAdminAlertEmail,
} from '../email-service';
import type { PrintProviderStatus } from '../studio/print-provider';
import {
  tierPriceGBP,
  cardPriceGBP,
  getShippingTier,
  envelopeStickerGBP,
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
  /** Proves ownership of an ANONYMOUS card (guest rack buys). Ignored
   *  when signed in. */
  cardToken: z.string().max(64).optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  // Print-led V1: every order is print + free digital, forced server-side.
  // Kept optional so older clients that still send these don't 400.
  includesPrint: z.boolean().optional(),
  includesDigital: z.boolean().optional(),
  shipTo: z.enum(['sender', 'recipient']).optional(),
  // Opt-in wax-seal envelope sticker (direct-to-recipient only).
  envelopeSticker: z.boolean().optional(),
  shippingTier: z.enum(['standard', 'express', 'overnight']).optional(),
  shippingAddress: shippingAddressSchema.optional(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  giftMessage: z.string().max(500).optional(),
  /** Comp code ("this one's on us"). Only the string comes from the
   *  client — what it's worth is read from the DB server-side. */
  compCode: z.string().max(32).optional(),
});

export function registerStudioCheckoutRoutes(app: Express): void {
  // ── POST /api/admin/orders/:id/resubmit-print ────────────────────
  // Manual re-drive for a paid order whose Prodigi submission failed or
  // never ran (audit 2026-07-27, P0-4). Safe to hammer: submitPrintOrder
  // re-reads providerOrderId and no-ops if the order already submitted.
  // Same per-request DB admin gate as /admin/customers.
  app.post(
    '/api/admin/orders/:id/resubmit-print',
    async (req: Request, res: Response) => {
      const otpUserId = (req as any).session?.otpUserId;
      if (typeof otpUserId !== 'string' || otpUserId.length === 0) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const adminRow = await db
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, otpUserId))
        .limit(1);
      if (adminRow[0]?.isAdmin !== true) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // studio_orders.id is a UUID varchar, not an integer.
      const orderId = String(req.params.id ?? '').trim();
      if (!orderId) {
        return res.status(400).json({ message: 'Invalid order id' });
      }
      const rows = await db
        .select()
        .from(studioOrders)
        .where(eq(studioOrders.id, orderId))
        .limit(1);
      const order = rows[0];
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.paymentStatus !== 'paid') {
        return res.status(400).json({ message: `Order is ${order.paymentStatus}, not paid` });
      }
      if (order.providerOrderId) {
        return res.status(409).json({
          message: `Already submitted (${order.printProvider}:${order.providerOrderId})`,
        });
      }

      await submitPrintOrder(order);
      const after = await db
        .select({
          providerOrderId: studioOrders.providerOrderId,
          fulfillmentStatus: studioOrders.fulfillmentStatus,
        })
        .from(studioOrders)
        .where(eq(studioOrders.id, orderId))
        .limit(1);
      return res.json({
        ok: !!after[0]?.providerOrderId,
        providerOrderId: after[0]?.providerOrderId ?? null,
        fulfillmentStatus: after[0]?.fulfillmentStatus ?? null,
      });
    },
  );

  // ── GET /api/user/free-card ──────────────────────────────────────
  // The free-first-card credit status for the signed-in user — the
  // checkout page reads this to show the £8.99-struck-to-£0 line and
  // lock postage to Standard. Server-derived at order create regardless,
  // so this is display-only truth, not authorisation.
  app.get(
    '/api/user/free-card',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });
      try {
        res.json(await getFreeCardStatus(userId));
      } catch (err: any) {
        console.error('[FREE-CARD] status error:', err?.message ?? err);
        res.status(500).json({ message: 'Could not load free-card status' });
      }
    },
  );

  // ── POST /api/studio/cards/:id/checkout ──────────────────────────
  // Create an order + payment intent. Returns { orderId, payment }
  // where `payment` mirrors the PaymentProvider's CreatePaymentResult
  // shape. The client uses `payment.redirectUrl` (stub/hosted mode) or
  // `payment.clientToken` (embedded) to finish the transaction.
  app.post(
    '/api/studio/cards/:id/checkout',
    // ⚠️ NOT isAuthenticated — the rack sells to GUESTS (Door 1,
    // UX_THREE_DOORS.md §6). Identity is resolved below: a signed-in
    // user must own the card; an anonymous buyer must present the
    // card's unguessable token. Both paths are checked before a single
    // pence is quoted.
    async (req: Request, res: Response) => {
      const userId = getUserId(req) ?? null;

      const cardId = parseInt(req.params.id, 10);
      if (!Number.isFinite(cardId)) return res.status(400).json({ message: 'Invalid card id' });

      const parsed = checkoutSchema.safeParse(req.body);
      if (!parsed.success) {
        // Lead with the first field message (e.g. the UK-postcode hint)
        // so the client toast is actionable, not "Invalid checkout
        // payload" (audit 2026-07-27).
        const first = parsed.error.issues[0];
        return res.status(400).json({
          message: first?.message
            ? first.message
            : 'Invalid checkout payload',
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
            // Which door made it — decides the price (§8a).
            source: cards.source,
            // Guest ownership proof + the rack's stored front.
            imageKey: cards.imageKey,
            frontImagePath: cards.frontImagePath,
          })
          .from(cards)
          .where(eq(cards.id, cardId))
          .limit(1);

        const card = cardRows[0];
        if (!card) return res.status(404).json({ message: 'Card not found' });
        // OWNERSHIP, two ways. Signed in: the card must be yours.
        // Anonymous: the card must belong to nobody AND you must hold
        // its token (returned once when the card was created) — so ids
        // can't be enumerated to buy or read someone else's card.
        if (userId) {
          if (card.userId !== userId) return res.status(403).json({ message: 'Not your card' });
        } else {
          const token = typeof body.cardToken === 'string' ? body.cardToken : '';
          if (card.userId !== null || !card.imageKey || token !== card.imageKey) {
            return res.status(403).json({ message: 'Not your card' });
          }
        }
        // Must be fully finished — front-first generation passes through
        // 'front-ready' (front image exists, inside not yet generated),
        // and only 'completed' guarantees the inside is done too (write
        // AND blank both generate an inside). Checking frontImageUrl alone
        // let a half-generated card be bought with no inside (audit
        // 2026-07-02).
        // Rack cards store frontImagePath and never had a legacy
        // frontImageUrl, so accept either — the print path already
        // resolves path-first (resolveStoredImageUrl).
        if (card.status !== 'completed' || !(card.frontImageUrl || card.frontImagePath)) {
          return res.status(400).json({ message: 'Card is not finished generating yet' });
        }

        // Derive recipient name for the shipping label.
        const state = (card.conversationData as CardDraftState | null) ?? null;
        const recipientName =
          state?.recipient?.name?.trim() || body.customerName;

        // Blank-inside footgun — server backstop. A blank inside can ONLY
        // be sent to the sender to hand over; we never post someone an
        // empty card. The UI enforces this (blank skips the giving choice
        // and goes straight to sender), but a crafted/edge request could
        // send blank + recipient — reject it so the invariant holds
        // server-side too.
        if (state?.inside?.mode === 'blank' && body.shipTo === 'recipient') {
          return res.status(400).json({
            message: 'A blank card can only be sent to you to hand over.',
          });
        }

        // Free-first-card credit (Moments rewards): derived fresh at every
        // checkout-create — ≥3 key dates and not yet redeemed. When it
        // applies, the card is £0 and postage is forced to Standard (the
        // free card never rides the £8.95/£13.95 tiers). The credit is
        // NOT consumed here — only when this order actually pays (see
        // consumeFreeCardCredit in markOrderPaidAndDispatch), so an
        // abandoned session never burns it. See server/studio/free-card.ts.
        // Account-only by nature (one per account) and photo-only by
        // decision (§8b) — a guest rack buyer is never eligible.
        const freeCardApplied = userId
          ? (await getFreeCardStatus(userId)).eligible && card.source === 'photo'
          : false;

        // Every order: printed card + free digital link. Digital is £0.
        // Postage is a separate line, priced from the chosen delivery tier
        // (server is the source of truth — a crafted POST can't pick a
        // cheaper tier than it pays for).
        const shippingTier: ShippingTierId = freeCardApplied
          ? 'standard'
          : (body.shippingTier ?? DEFAULT_SHIPPING_TIER);
        // ⚠️ PRICED BY DOOR, not by a flat tier (UX_THREE_DOORS.md §8a):
        // £4.99 off the shelf, £5.99 made for them, £6.99 from a photo.
        // The SERVER decides from the stored card.source — a crafted POST
        // can't buy a photo card at rack price.
        const printAmount0 = freeCardApplied ? 0 : cardPriceGBP(card.source);
        const digitalAmount = 0;
        const shippingAmount0 = getShippingTier(shippingTier).price;

        // Comp code ("this one's on us"). Validated here, CONSUMED only
        // on the paid flip — same discipline as the free-card credit, so
        // an abandoned session can't burn a creator's code. Refused codes
        // fail the request outright rather than silently charging full
        // price: someone typing a code is expecting not to pay, and
        // quietly taking their money is the worst outcome available.
        let compCode: string | null = null;
        let printAmount = printAmount0;
        let shippingAmount = shippingAmount0;
        if (body.compCode) {
          const comp = await validateCompCode(body.compCode);
          if (!comp.ok || !comp.code) {
            return res.status(400).json({ message: comp.reason ?? "That code isn't valid." });
          }
          compCode = comp.code.code;
          if (comp.code.coversCard) printAmount = 0;
          if (comp.code.coversShipping) shippingAmount = 0;
          console.log(
            `[COMP-CODE] ${compCode} applied at checkout for card ${cardId} (${comp.code.label})`,
          );
        }
        // Optional wax-seal envelope sticker (£1.50) — an add-on the customer
        // opts into, and only valid on direct-to-recipient sends (the seal goes
        // on the kraft envelope WE post). Server-derived so a crafted POST can't
        // add the sticker without paying, or attach it on a self-send. Direct
        // delivery itself is free now.
        const envelopeStickerAmount = envelopeStickerGBP(
          body.envelopeSticker === true,
          body.shipTo,
        );
        const totalAmount = printAmount + shippingAmount + envelopeStickerAmount;

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

        // Supersede any still-payable order for this card BEFORE minting a
        // new one (audit 2026-07-27): two tabs used to mean two live Stripe
        // sessions — the user could genuinely pay twice. Expire the old
        // session at the gateway (best-effort; Stripe treats
        // completed/expired as no-ops) and fail the stale row so exactly
        // one payable order exists per card.
        const stalePending = await db
          .select({
            id: studioOrders.id,
            paymentReference: studioOrders.paymentReference,
          })
          .from(studioOrders)
          .where(
            freeCardApplied && userId
              ? // Free-card checkouts also expire pending FREE orders on the
                // user's OTHER cards — two tabs on two different cards could
                // otherwise mint two live £3.95 sessions that each ship a
                // free card (the credit only consumes once; the second would
                // slip through the conditional-update guard as a warning).
                and(
                  eq(studioOrders.paymentStatus, 'pending'),
                  or(
                    eq(studioOrders.cardId, cardId),
                    and(
                      eq(studioOrders.userId, userId),
                      eq(studioOrders.freeCardApplied, true),
                    ),
                  ),
                )
              : and(
                  eq(studioOrders.cardId, cardId),
                  eq(studioOrders.paymentStatus, 'pending'),
                ),
          );
        for (const stale of stalePending) {
          if (stale.paymentReference) {
            try {
              await getPaymentProvider().cancelPayment?.(stale.paymentReference);
            } catch (err: any) {
              console.warn(
                `[STUDIO-CHECKOUT] could not expire stale session for order ${stale.id}:`,
                err?.message ?? err,
              );
            }
          }
          await db
            .update(studioOrders)
            .set({ paymentStatus: 'failed', updatedAt: new Date() })
            .where(
              and(
                eq(studioOrders.id, stale.id),
                // Never clobber a payment that landed between our SELECT
                // and now.
                eq(studioOrders.paymentStatus, 'pending'),
              ),
            );
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
            envelopeStickerAmount,
            totalAmount,
            freeCardApplied,
            compCode,
          })
          .returning({ id: studioOrders.id });

        const order = inserted[0];
        if (!order) throw new Error('Failed to insert order');

        // ONE ORDER, MANY CARDS (UX_THREE_DOORS.md §8e). Today every
        // order holds exactly one card, so this writes a single line —
        // but the print path and the totals already read from HERE, so
        // opening the basket is a matter of pushing more rows in, not
        // re-plumbing checkout. studio_orders.cardId stays as the first
        // card for the legacy reads.
        await db.insert(orderItems).values({
          orderId: order.id,
          cardId,
          unitPrice: printAmount,
          source: card.source ?? null,
          position: 0,
        });

        const origin = `${req.protocol}://${req.get('host')}`;

        // NOTHING TO CHARGE. A comp code covering both lines (or covering
        // postage on top of the free-first-card credit) lands the total on
        // zero, and no gateway will take a £0 payment — Stripe rejects the
        // session outright. So skip the gateway entirely: mark it paid and
        // dispatch, which is the same call the webhook makes, and is
        // idempotent.
        //
        // Safe because totalAmount is derived server-side from a validated
        // code — a client cannot talk its own way to zero. amountPaid is
        // recorded as 0 so reporting shows a £0 order rather than falling
        // back to totalAmount and inventing revenue.
        if (totalAmount === 0) {
          await markOrderPaidAndDispatch(order.id, 0);
          console.log(
            `[STUDIO-CHECKOUT] order ${order.id} fully comped (${compCode}) — no payment taken`,
          );
          return res.json({
            orderId: order.id,
            totals: {
              printAmount, digitalAmount, shippingAmount,
              totalAmount, currency: 'GBP', freeCardApplied, compCode,
            },
            // The client redirects on mode:'redirect'; send it straight to
            // the success page, which polls the order and finds it paid.
            payment: {
              paymentReference: `comp_${order.id}`,
              mode: 'redirect' as const,
              redirectUrl: `${origin}/checkout/success?orderId=${order.id}`,
            },
          });
        }

        const provider = getPaymentProvider();
        const payment = await provider.createPayment({
          studioOrderId: order.id,
          amount: totalAmount,
          currency: 'GBP',
          customerEmail: body.customerEmail,
          customerName: body.customerName,
          description: freeCardApplied
            ? `Celebrait card #${cardId} — first card free, postage only`
            : `Celebrait card #${cardId}`,
          returnUrl: `${origin}/checkout/success?orderId=${order.id}`,
          cancelUrl: `${origin}/checkout/cancelled?orderId=${order.id}&cardId=${cardId}`,
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
          totals: {
            printAmount,
            digitalAmount,
            shippingAmount,
            totalAmount,
            currency: 'GBP',
            freeCardApplied,
          },
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
                // Pass the REAL charged amount — when this reconcile wins
                // the race against the webhook, a discounted order used to
                // record amount_paid=NULL and admin revenue reported full
                // list price (audit 2026-07-27).
                await markOrderPaidAndDispatch(order.id, st.amountPaid);
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
            shareUrl = `/c/${encodeURIComponent(token)}`;
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
                ? `/c/${encodeURIComponent(r.cardViewToken)}`
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
        let order = rows[0];
        // Fallback matcher (audit 2026-07-27): if the post-create DB
        // update ever failed, the reference lookup misses — but the
        // session metadata still carries OUR order id. Without this the
        // webhook 200'd on the miss, Stripe stopped retrying, and a real
        // payment sat "pending" forever.
        if (!order && status.studioOrderId) {
          const byId = await db
            .select()
            .from(studioOrders)
            .where(eq(studioOrders.id, status.studioOrderId))
            .limit(1);
          order = byId[0];
          if (order) {
            console.warn(
              `[STRIPE-WEBHOOK] ref lookup missed (${status.paymentReference}) — matched order ${order.id} via session metadata; repairing reference`,
            );
            await db
              .update(studioOrders)
              .set({ paymentReference: status.paymentReference, updatedAt: new Date() })
              .where(eq(studioOrders.id, order.id));
          }
        }
        if (order) {
          await markOrderPaidAndDispatch(order.id, status.amountPaid);
        } else {
          console.error(
            '[STRIPE-WEBHOOK] PAID EVENT WITH NO MATCHING ORDER — money taken, nothing recorded:',
            status.paymentReference,
          );
          void sendAdminAlertEmail('Stripe paid event matched NO order', [
            `paymentReference: ${status.paymentReference}`,
            `metadata order id: ${status.studioOrderId ?? '(none)'}`,
            'Investigate in the Stripe dashboard — a customer has paid.',
          ]);
        }
      } else if (status.status === 'refunded') {
        // The provider resolves the refund's PaymentIntent back to the
        // Checkout Session id, so we match the order the same way as paid.
        const rows = await db
          .select()
          .from(studioOrders)
          .where(eq(studioOrders.paymentReference, status.paymentReference))
          .limit(1);
        const order = rows[0];
        if (!order) {
          console.warn(
            '[STRIPE-WEBHOOK] refund: no order for payment ref',
            status.paymentReference,
          );
        } else if (order.paymentStatus === 'refunded') {
          // Idempotent — a re-delivered webhook must not double-email.
        } else {
          await db
            .update(studioOrders)
            .set({ paymentStatus: 'refunded', updatedAt: new Date() })
            .where(eq(studioOrders.id, order.id));
          const sent = await sendRefundEmail({
            customerEmail: order.customerEmail,
            customerName: order.customerName,
            amount: order.totalAmount,
            currency: order.currency,
            orderId: order.id,
          });
          console.log(
            `[STRIPE-WEBHOOK] refunded order ${order.id} → refund email ${sent ? 'sent' : 'failed'}`,
          );
        }
      }
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
      // Rich diagnostics: if this still fails after the content-type fix,
      // the next Prodigi retry shows exactly what's arriving (header +
      // raw bytes) instead of an opaque "no order id".
      const rb = (req as any).rawBody;
      const rawInfo = Buffer.isBuffer(rb)
        ? `buffer:${rb.length}b`
        : typeof rb;
      const sample = Buffer.isBuffer(rb)
        ? rb.toString('utf8').slice(0, 300)
        : (() => {
            try {
              return JSON.stringify(req.body).slice(0, 300);
            } catch {
              return String(req.body).slice(0, 300);
            }
          })();
      console.error(
        '[PRODIGI-WEBHOOK] parse failed:',
        err?.message ?? err,
        '| content-type:',
        req.headers['content-type'],
        '| rawBody:',
        rawInfo,
        '| sample:',
        sample,
      );
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
  amountPaid?: number,
): Promise<{ ok: true; alreadyPaid?: boolean }> {
  const updated = await db
    .update(studioOrders)
    .set({
      paymentStatus: 'paid',
      paidAt: new Date(),
      updatedAt: new Date(),
      // Real charged amount (post-discount) when the gateway reported it.
      // Omitted → column stays as-is (null), and reporting falls back to
      // totalAmount.
      ...(typeof amountPaid === 'number' ? { amountPaid } : {}),
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

  // Free-first-card credit: consume it now that the order has actually
  // paid (never at session create — abandonment must not burn it). Runs
  // once, guarded by the same won-the-flip branch as the emails.
  consumeFreeCardCredit(updated[0]).catch((err) => {
    console.error('[STUDIO-CHECKOUT] free-card consume failed:', err);
  });

  // Comp code: same timing, same reasoning — burn the use only now that
  // the order is real. Never allowed to fail the flip; the card ships
  // either way and an over-redemption is a logged warning, not an error.
  consumeCompCode(updated[0]).catch((err) => {
    console.error('[STUDIO-CHECKOUT] comp-code consume failed:', err);
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
export async function submitPrintOrder(
  order: typeof studioOrders.$inferSelect,
): Promise<void> {
  if (!order.includesPrint) return; // nothing to print

  // Double-submit guard: re-read the CURRENT provider id — this function
  // is now reachable from three places (the paid-flip, the stranded-order
  // sweeper, and the admin resubmit endpoint; audit 2026-07-27 P0-4), and
  // a stale `order` snapshot must never create a second Prodigi order.
  const fresh = await db
    .select({ providerOrderId: studioOrders.providerOrderId })
    .from(studioOrders)
    .where(eq(studioOrders.id, order.id))
    .limit(1);
  if (fresh[0]?.providerOrderId) {
    console.log(
      `[STUDIO-CHECKOUT] print submit skipped for order ${order.id} — already submitted (${fresh[0].providerOrderId})`,
    );
    return;
  }

  const shipTo = order.shipTo;
  const shippingAddress = order.shippingAddress;
  if (!shipTo || !shippingAddress) {
    console.warn('[STUDIO-CHECKOUT] print submit: no shipping address on order', order.id);
    return;
  }

  // EVERY card in the order, in basket order (UX_THREE_DOORS.md §8e).
  // Line items are the source of truth; order.cardId is the legacy
  // first-card mirror and only backs us up if the items are somehow
  // missing (pre-backfill rows).
  const itemRows = await db
    .select({ cardId: orderItems.cardId, position: orderItems.position })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(orderItems.position);
  const orderedCardIds = itemRows.length
    ? itemRows.map((r) => r.cardId)
    : [order.cardId];

  const cardRows = await db
    .select({
      id: cards.id,
      userId: cards.userId,
      imageKey: cards.imageKey,
      frontImageUrl: cards.frontImageUrl,
      frontImagePath: cards.frontImagePath,
      insideImageUrl: cards.insideImageUrl,
      insideImagePath: cards.insideImagePath,
      conversationData: cards.conversationData,
    })
    .from(cards)
    .where(inArray(cards.id, orderedCardIds));
  // Preserve basket order — the DB returns whatever order it likes.
  const byId = new Map(cardRows.map((c) => [c.id, c]));
  const orderedCards = orderedCardIds.map((id) => byId.get(id)).filter(Boolean) as typeof cardRows;
  // The first card carries the order-level context (recipient, sender).
  const card = orderedCards[0];
  if (!card || !card.frontImageUrl) {
    console.warn('[STUDIO-CHECKOUT] print submit: card/front image missing for order', order.id);
    return;
  }
  if (orderedCards.length !== orderedCardIds.length) {
    // Never print a partial basket: the customer paid for all of them.
    console.error(
      `[STUDIO-CHECKOUT] print submit ABORTED for order ${order.id} — ${orderedCardIds.length} cards ordered, ${orderedCards.length} resolvable`,
    );
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

  // One print card per basket line. A single unresolvable front aborts
  // the whole submission rather than silently posting a short order.
  const printCards: PrintOrderCard[] = [];
  for (const c of orderedCards) {
    const front = resolveStoredImageUrl(c.frontImagePath, c.frontImageUrl);
    if (!front) {
      console.warn('[STUDIO-CHECKOUT] print submit: no resolvable front image for card', c.id, 'order', order.id);
      return;
    }
    printCards.push({
      cardId: c.id,
      frontImageUrl: front,
      insideImageUrl: resolveStoredImageUrl(c.insideImagePath, c.insideImageUrl),
      imageKey: c.imageKey,
    });
  }

  try {
    const provider = getPrintProvider();
    const result = await provider.submitOrder({
      studioOrderId: order.id,
      cards: printCards,
      shipTo: shipTo as 'sender' | 'recipient',
      // The customer opted into the wax-seal sticker (charge > 0 = chosen).
      envelopeSticker: (order.envelopeStickerAmount ?? 0) > 0,
      shippingAddress: shippingAddress as ShippingAddress,
      recipientName,
      giftMessage: order.giftMessage ?? undefined,
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
    // A paid order with no print MUST reach a human, not just the logs
    // (audit 2026-07-27 P0-4). The sweeper retries transient failures;
    // this alert covers the ones that need eyes.
    void sendAdminAlertEmail(`Print submission FAILED — order ${order.id}`, [
      `Order: ${order.id} (card ${order.cardId})`,
      `Customer: ${order.customerName ?? '?'} <${order.customerEmail ?? '?'}>`,
      `Payment status: ${order.paymentStatus}`,
      `Error: ${err?.message ?? String(err)}`,
      '',
      'The stranded-order sweeper retries every 10 minutes. If it keeps',
      'failing, use POST /api/admin/orders/:id/resubmit-print after fixing',
      'the cause, or refund in Stripe.',
    ]);
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
      const shareUrl = `${publicAppOrigin()}/c/${encodeURIComponent(card.viewToken)}`;
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
