// server/routes/shop.ts
//
// DOOR 1 — BROWSE THE STORE (UX_THREE_DOORS.md §5).
//
// The rack's buy path. A stock template is a design in a library; this
// turns it into a CARD someone owns — a real `cards` row that the
// existing checkout, print and order machinery already understands.
//
// It is a COPY, not a generation: the template's front and pre-rendered
// inside already exist, so the common path costs nothing and is
// instant. Only "write your own" inside pays for a render.
//
// GUESTS ARE FIRST-CLASS HERE. `cards.userId` and `studio_orders.userId`
// are both nullable, so a card can exist with no account. Ownership of a
// guest card is proved by its `imageKey` — the same unguessable
// per-card secret used to name print assets — handed back once at
// creation and required to check out. Without it, an anonymous card is
// unreachable: nobody can enumerate ids and buy (or read) someone
// else's card.

import type { Express, Request, Response } from 'express';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { cards, cardTemplates, orderItems, studioOrders } from '@shared/schema';
import { cardPriceGBP } from '@shared/pricing';
import { publicImageUrl, storeImageToCustomFilename } from '../image-storage';
import { generateInsideImage } from './admin-card-lab';
import { markOrderPaidAndDispatch } from './studio-checkout';
import { getPaymentProvider } from '../studio/payment-provider';

/** The rack card's stored state — the `rack` variant of the draft
 *  shapes (UX_THREE_DOORS.md §4b). No resume, no steps: a rack card is
 *  finished the moment it exists. */
interface RackCardState {
  version: 1;
  source: 'rack';
  templateId: number;
  insideMode: 'ours' | 'own' | 'blank';
  recipient?: { name?: string | null; occasion?: string | null };
}

export function registerShopRoutes(app: Express): void {
  // ── POST /api/shop/templates/:id/card ──────────────────────────────
  // Turn a stock template into a card this person owns. Public: the
  // rack's promise is no friction, so no account is required.
  app.post('/api/shop/templates/:id/card', async (req: Request, res: Response) => {
    const templateId = Number(req.params.id);
    if (!Number.isInteger(templateId)) return res.status(400).json({ message: 'Bad template id' });

    const schema = z.object({
      insideMode: z.enum(['ours', 'own', 'blank']).default('ours'),
      /** Only used when insideMode === 'own'. */
      message: z.string().max(600).optional(),
      /** Printed exactly as typed — no auto "Dear"/"From" wrapping. */
      dear: z.string().max(120).optional(),
      from: z.string().max(120).optional(),
    });
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(req.body ?? {});
    } catch (err) {
      const issue = err instanceof z.ZodError ? err.issues[0] : null;
      return res.status(400).json({ message: issue ? `Invalid request — ${issue.path.join('.')}: ${issue.message}` : 'Invalid request' });
    }

    try {
      const [tpl] = await db.select().from(cardTemplates).where(eq(cardTemplates.id, templateId));
      if (!tpl || !tpl.published) return res.status(404).json({ message: 'No such card' });
      if (!tpl.image_path) return res.status(409).json({ message: "That card's artwork is missing — try another" });

      // THE INSIDE, three ways:
      //  · ours  — the message written for this card, already rendered.
      //            Free and instant. The default, and the common case.
      //  · blank — no inside image at all. The print compositor renders
      //            clean panels for handwriting (composeCardPrintStrip
      //            takes insideBuffer: null), so this is free too.
      //  · own   — their words, set in the card's own style. The only
      //            branch that pays for a render.
      let insideImagePath: string | null = null;
      if (body.insideMode === 'ours') {
        insideImagePath = tpl.inside_image_path ?? null;
      } else if (body.insideMode === 'own') {
        const written = (body.message ?? '').trim();
        if (!written) return res.status(400).json({ message: 'Write your message, or choose one of the other options' });
        const result = await generateInsideImage({
          mode: 'own',
          message: written,
          dear: body.dear,
          from: body.from,
          palette: tpl.palette,
          typeface: tpl.typeface,
          art_direction: tpl.art_direction,
          freeStyle: true,
        });
        const filename = `rack_inside_${randomUUID()}.png`;
        await storeImageToCustomFilename(result.imageUrl, filename);
        insideImagePath = filename;
      }

      // The card. `status: 'completed'` is this codebase's word for
      // "finished but unpaid" — the state checkout expects and the one
      // the recovery ladder targets for signed-in users.
      const imageKey = randomUUID().replace(/-/g, '');
      const state: RackCardState = {
        version: 1,
        source: 'rack',
        templateId,
        insideMode: body.insideMode,
        recipient: { name: body.dear?.trim() || null, occasion: tpl.occasion },
      };
      const userId = (req as any).session?.otpUserId ?? null;
      const [card] = await db
        .insert(cards)
        .values({
          userId,
          source: 'rack',
          sceneType: 'rack',
          cardType: 'printed',
          status: 'completed',
          price: cardPriceGBP('rack'),
          frontImagePath: tpl.image_path,
          insideImagePath,
          conversationData: state as unknown as Record<string, unknown>,
          imageKey,
          viewToken: randomUUID().replace(/-/g, ''),
        })
        .returning({ id: cards.id });

      res.json({
        cardId: card.id,
        // Proves ownership of an anonymous card at checkout. The client
        // holds it for the session; it is never guessable from the id.
        cardToken: imageKey,
        frontImageUrl: publicImageUrl(tpl.image_path),
        insideImageUrl: insideImagePath ? publicImageUrl(insideImagePath) : null,
        price: cardPriceGBP('rack'),
      });
    } catch (err) {
      console.error('[SHOP] template→card failed:', err);
      res.status(500).json({ message: "We couldn't set that card up — try again" });
    }
  });

  // ── GET /api/shop/cards/:id ────────────────────────────────────────
  // The buy page's card summary, token-gated for guests. A signed-in
  // owner may read their own card without the token.
  app.get('/api/shop/cards/:id', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Bad card id' });
    try {
      const [card] = await db
        .select({
          id: cards.id, userId: cards.userId, source: cards.source, status: cards.status,
          imageKey: cards.imageKey, frontImagePath: cards.frontImagePath,
          insideImagePath: cards.insideImagePath, conversationData: cards.conversationData,
        })
        .from(cards).where(eq(cards.id, id));
      if (!card) return res.status(404).json({ message: 'No such card' });
      const sessionUser = (req as any).session?.otpUserId ?? null;
      const token = String(req.query.token ?? '');
      const owns = sessionUser && card.userId === sessionUser;
      const holdsToken = card.userId === null && card.imageKey && token === card.imageKey;
      if (!owns && !holdsToken) return res.status(403).json({ message: 'Not your card' });
      res.json({
        card: {
          id: card.id,
          source: card.source,
          status: card.status,
          frontImageUrl: card.frontImagePath ? publicImageUrl(card.frontImagePath) : null,
          insideImageUrl: card.insideImagePath ? publicImageUrl(card.insideImagePath) : null,
          price: cardPriceGBP(card.source),
          insideMode: (card.conversationData as RackCardState | null)?.insideMode ?? null,
        },
      });
    } catch (err) {
      console.error('[SHOP] card summary failed:', err);
      res.status(500).json({ message: 'Could not load that card' });
    }
  });

  // ── GET /api/shop/orders/:id ───────────────────────────────────────
  // A guest's order status. The order id IS the token: it's a v4 uuid
  // (gen_random_uuid), so it can't be enumerated, and it arrives in the
  // confirmation email. No account, no session — /studio/* is
  // auth-gated and a guest has no home there.
  app.get('/api/shop/orders/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ message: 'Bad order reference' });
    try {
      const [order] = await db
        .select({
          id: studioOrders.id,
          paymentStatus: studioOrders.paymentStatus,
          paymentReference: studioOrders.paymentReference,
          fulfillmentStatus: studioOrders.fulfillmentStatus,
          trackingNumber: studioOrders.trackingNumber,
          customerEmail: studioOrders.customerEmail,
          shipTo: studioOrders.shipTo,
          shippingTier: studioOrders.shippingTier,
          totalAmount: studioOrders.totalAmount,
          printAmount: studioOrders.printAmount,
          shippingAmount: studioOrders.shippingAmount,
          createdAt: studioOrders.createdAt,
          trackingUrl: studioOrders.trackingUrl,
        })
        .from(studioOrders)
        .where(eq(studioOrders.id, id));
      if (!order) return res.status(404).json({ message: 'No such order' });

      // Reconcile against Stripe if still unpaid — the guest lands here
      // straight from the gateway, often before the webhook. Mirrors the
      // studio order route; markOrderPaidAndDispatch is idempotent so
      // this never double-fires against the webhook.
      if (order.paymentStatus !== 'paid' && order.paymentReference) {
        try {
          const provider = getPaymentProvider();
          if (provider.name === 'stripe') {
            const st = await provider.getStatus(order.paymentReference);
            if (st.status === 'paid') {
              await markOrderPaidAndDispatch(order.id, st.amountPaid);
              const [fresh] = await db
                .select({
                  id: studioOrders.id,
                  paymentStatus: studioOrders.paymentStatus,
                  fulfillmentStatus: studioOrders.fulfillmentStatus,
                  trackingNumber: studioOrders.trackingNumber,
                  customerEmail: studioOrders.customerEmail,
                  shipTo: studioOrders.shipTo,
                  shippingTier: studioOrders.shippingTier,
                  totalAmount: studioOrders.totalAmount,
                  printAmount: studioOrders.printAmount,
                  shippingAmount: studioOrders.shippingAmount,
                  createdAt: studioOrders.createdAt,
                  trackingUrl: studioOrders.trackingUrl,
                })
                .from(studioOrders).where(eq(studioOrders.id, id));
              if (fresh) Object.assign(order, fresh);
            }
          }
        } catch (err) {
          console.warn('[SHOP] stripe reconcile failed (non-fatal):', err);
        }
      }

      const items = await db
        .select({ cardId: orderItems.cardId, unitPrice: orderItems.unitPrice, position: orderItems.position })
        .from(orderItems)
        .where(eq(orderItems.orderId, id))
        .orderBy(orderItems.position);

      const cardRows = items.length
        ? await db
            .select({ id: cards.id, frontImagePath: cards.frontImagePath })
            .from(cards)
            .where(inArray(cards.id, items.map((i) => i.cardId)))
        : [];
      const frontById = new Map(cardRows.map((c) => [c.id, c.frontImagePath]));

      res.json({
        order: {
          ...order,
          // Internal references stay internal.
          paymentReference: undefined,
          // Never leak the buyer's full email to a link-holder.
          customerEmail: order.customerEmail ? order.customerEmail.replace(/^(.).*(@.*)$/, '$1•••$2') : null,
        },
        items: items.map((i) => {
          const path = frontById.get(i.cardId);
          return { ...i, imageUrl: path ? publicImageUrl(path) : null };
        }),
      });
    } catch (err) {
      console.error('[SHOP] order status failed:', err);
      res.status(500).json({ message: 'Could not load that order' });
    }
  });
}
