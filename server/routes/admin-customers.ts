// server/routes/admin-customers.ts
//
// Admin CRM — the operational view of customers, their cards, and their
// orders. Powers /admin/customers. Distinct from /admin/costs (economics)
// and any product-analytics (behaviour): this is "who bought what, what's
// its status, how do I help them."
//
// Everything here is a READ layer over existing tables — users, cards,
// studio_orders, marketing_leads. No new schema. One write action:
// resend an order's confirmation email.
//
// Auth: admin-only, mirrors admin-costs (session OTP user → users.is_admin).
// This surface exposes all customer PII, so the gate is not optional.
//
// Spec: memory/next_admin_crm.md.

import type { Express, Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';

async function isAdmin(req: Request): Promise<boolean> {
  const otpUserId = (req as any).session?.otpUserId;
  if (typeof otpUserId !== 'string' || otpUserId.length === 0) return false;
  const row = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, otpUserId))
    .limit(1);
  return row[0]?.isAdmin === true;
}

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!(await isAdmin(req))) {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
}

export function registerAdminCustomersRoutes(app: Express): void {
  // ── GET /api/admin/customers?q= ─────────────────────────────────────
  // The customer list: one row per registered user with lifetime
  // aggregates (cards made, paid orders, total spent, last activity).
  // Optional `q` filters on email / first / last name (case-insensitive).
  app.get('/api/admin/customers', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const like = `%${q}%`;
      const search = q
        ? sql`where (u.email ilike ${like} or u.first_name ilike ${like} or u.last_name ilike ${like})`
        : sql``;

      // Aggregate cards and orders in SEPARATE subqueries, then join. A
      // single query that joins both tables fans out — a user with 3 cards
      // and 1 order produces 3 rows, so sum(order.total) counts the order
      // 3× (the £12.94 order that showed as £38.82). Pre-aggregating each
      // table to one row per user avoids the cartesian product.
      const rows = (
        await db.execute(sql`
          select
            u.id,
            u.email,
            u.first_name       as "firstName",
            u.last_name        as "lastName",
            u.created_at       as "createdAt",
            u.marketing_opt_in as "marketingOptIn",
            u.is_admin         as "isAdmin",
            coalesce(cc.card_count, 0)   as "cardCount",
            coalesce(oc.paid_orders, 0)  as "paidOrders",
            coalesce(oc.total_spent, 0)  as "totalSpent",
            greatest(u.created_at, cc.last_card, oc.last_order) as "lastActivity"
          from users u
          left join (
            select user_id, count(*) as card_count, max(created_at) as last_card
            from cards group by user_id
          ) cc on cc.user_id = u.id
          left join (
            select user_id,
              count(*) filter (where payment_status = 'paid')                    as paid_orders,
              coalesce(sum(total_amount) filter (where payment_status = 'paid'), 0) as total_spent,
              max(created_at) as last_order
            from studio_orders group by user_id
          ) oc on oc.user_id = u.id
          ${search}
          order by "lastActivity" desc nulls last
          limit 500
        `)
      ).rows as any[];

      res.json({
        customers: rows.map((r) => ({
          id: r.id,
          email: r.email,
          firstName: r.firstName,
          lastName: r.lastName,
          createdAt: r.createdAt,
          marketingOptIn: r.marketingOptIn === true,
          isAdmin: r.isAdmin === true,
          cardCount: Number(r.cardCount),
          paidOrders: Number(r.paidOrders),
          totalSpent: Number(r.totalSpent),
          lastActivity: r.lastActivity,
        })),
      });
    } catch (err) {
      console.error('[ADMIN_CUSTOMERS] list error:', err);
      res.status(500).json({ message: 'Failed to load customers' });
    }
  });

  // ── GET /api/admin/customers/:id ────────────────────────────────────
  // One customer in full: their profile, every card they've made, and
  // every order they've placed (with payment + fulfilment status).
  app.get('/api/admin/customers/:id', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const id = req.params.id;

      const userRows = (
        await db.execute(sql`
          select id, email, first_name as "firstName", last_name as "lastName",
                 marketing_opt_in as "marketingOptIn", is_admin as "isAdmin",
                 created_at as "createdAt"
          from users where id = ${id} limit 1
        `)
      ).rows as any[];
      const user = userRows[0];
      if (!user) {
        res.status(404).json({ message: 'Customer not found' });
        return;
      }

      const cards = (
        await db.execute(sql`
          select id, scene_type as "sceneType", card_type as "cardType",
                 status, front_image_url as "frontImageUrl",
                 inside_image_url as "insideImageUrl", price,
                 view_token as "viewToken", created_at as "createdAt"
          from cards where user_id = ${id}
          order by created_at desc limit 200
        `)
      ).rows as any[];

      // Generation log per card, split front vs inside and ok vs failed.
      // Joined through cards so we only see this user's generations. Lab
      // runs (card_id null) never match. front_scene/front_text = front;
      // inside_write/inside_blank = inside.
      const genRows = (
        await db.execute(sql`
          select g.card_id as "cardId",
                 case when g.slot like 'front%' then 'front' else 'inside' end as side,
                 g.success as "success",
                 count(*) as n,
                 coalesce(sum(g.cost_cents_x100), 0) as cost
          from generation_log g
          join cards c on c.id = g.card_id
          where c.user_id = ${id}
          group by g.card_id, side, g.success
        `)
      ).rows as any[];

      // Fold into per-card {front:{ok,fail}, inside:{ok,fail}} + a rollup.
      const genByCard = new Map<number, any>();
      let genOk = 0, genFail = 0, genCostX100 = 0;
      for (const r of genRows) {
        const cid = Number(r.cardId);
        const n = Number(r.n);
        const cost = Number(r.cost);
        const ok = r.success === true;
        if (ok) genOk += n; else genFail += n;
        genCostX100 += cost;
        const entry = genByCard.get(cid) ?? {
          front: { ok: 0, fail: 0 },
          inside: { ok: 0, fail: 0 },
        };
        const side = r.side === 'front' ? entry.front : entry.inside;
        if (ok) side.ok += n; else side.fail += n;
        genByCard.set(cid, entry);
      }

      const orders = (
        await db.execute(sql`
          select id, card_id as "cardId", customer_name as "customerName",
                 customer_email as "customerEmail", ship_to as "shipTo",
                 shipping_tier as "shippingTier", shipping_address as "shippingAddress",
                 total_amount as "totalAmount", print_amount as "printAmount",
                 shipping_amount as "shippingAmount",
                 delivery_surcharge_amount as "envelopeStickerAmount",
                 currency, payment_status as "paymentStatus",
                 fulfillment_status as "fulfillmentStatus",
                 provider_order_id as "providerOrderId",
                 tracking_number as "trackingNumber", tracking_url as "trackingUrl",
                 created_at as "createdAt", paid_at as "paidAt"
          from studio_orders where user_id = ${id}
          order by created_at desc limit 200
        `)
      ).rows as any[];

      const paidOrders = orders.filter((o) => o.paymentStatus === 'paid');
      const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

      res.json({
        customer: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          marketingOptIn: user.marketingOptIn === true,
          isAdmin: user.isAdmin === true,
          createdAt: user.createdAt,
          cardCount: cards.length,
          paidOrders: paidOrders.length,
          totalSpent,
          // Generation rollup (from generation_log — same source as the
          // Cost Ledger). Distinct from cards/orders: one card can take
          // several generations, some failed.
          gen: { ok: genOk, failed: genFail, total: genOk + genFail, costCentsX100: genCostX100 },
        },
        cards: cards.map((c) => ({
          id: c.id,
          sceneType: c.sceneType,
          cardType: c.cardType,
          status: c.status,
          frontImageUrl: c.frontImageUrl,
          insideImageUrl: c.insideImageUrl,
          price: Number(c.price),
          viewToken: c.viewToken,
          createdAt: c.createdAt,
          gen: genByCard.get(Number(c.id)) ?? { front: { ok: 0, fail: 0 }, inside: { ok: 0, fail: 0 } },
        })),
        orders: orders.map(normalizeOrder),
      });
    } catch (err) {
      console.error('[ADMIN_CUSTOMERS] detail error:', err);
      res.status(500).json({ message: 'Failed to load customer' });
    }
  });

  // ── GET /api/admin/orders?payment=&fulfillment= ─────────────────────
  // Every order across all customers, newest first. Optional filters on
  // payment status (pending|paid|failed|refunded) and fulfilment status
  // (pending|submitted|printed|shipped|delivered|failed).
  app.get('/api/admin/orders', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const payment = cleanStatus(req.query.payment);
      const fulfillment = cleanStatus(req.query.fulfillment);
      const conds = [];
      if (payment) conds.push(sql`o.payment_status = ${payment}`);
      if (fulfillment) conds.push(sql`o.fulfillment_status = ${fulfillment}`);
      const where = conds.length
        ? sql`where ${sql.join(conds, sql` and `)}`
        : sql``;

      const rows = (
        await db.execute(sql`
          select o.id, o.card_id as "cardId", o.user_id as "userId",
                 o.customer_name as "customerName", o.customer_email as "customerEmail",
                 o.ship_to as "shipTo", o.shipping_tier as "shippingTier",
                 o.shipping_address as "shippingAddress",
                 o.total_amount as "totalAmount", o.print_amount as "printAmount",
                 o.shipping_amount as "shippingAmount",
                 o.delivery_surcharge_amount as "envelopeStickerAmount",
                 o.currency, o.payment_status as "paymentStatus",
                 o.fulfillment_status as "fulfillmentStatus",
                 o.provider_order_id as "providerOrderId",
                 o.tracking_number as "trackingNumber", o.tracking_url as "trackingUrl",
                 o.created_at as "createdAt", o.paid_at as "paidAt"
          from studio_orders o
          ${where}
          order by o.created_at desc
          limit 500
        `)
      ).rows as any[];

      res.json({ orders: rows.map(normalizeOrder) });
    } catch (err) {
      console.error('[ADMIN_CUSTOMERS] orders error:', err);
      res.status(500).json({ message: 'Failed to load orders' });
    }
  });

  // ── GET /api/admin/leads ────────────────────────────────────────────
  // Marketing leads — recipients who captured an email but haven't
  // (yet) bought. The top of the pipeline.
  app.get('/api/admin/leads', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const rows = (
        await db.execute(sql`
          select id, email, source, card_id as "cardId",
                 recipient_name as "recipientName", occasion_date as "occasionDate",
                 marketing_opt_in as "marketingOptIn", created_at as "createdAt"
          from marketing_leads
          order by created_at desc
          limit 500
        `)
      ).rows as any[];

      res.json({
        leads: rows.map((r) => ({
          id: Number(r.id),
          email: r.email,
          source: r.source,
          cardId: r.cardId != null ? Number(r.cardId) : null,
          recipientName: r.recipientName,
          occasionDate: r.occasionDate,
          marketingOptIn: r.marketingOptIn === true,
          createdAt: r.createdAt,
        })),
      });
    } catch (err) {
      console.error('[ADMIN_CUSTOMERS] leads error:', err);
      res.status(500).json({ message: 'Failed to load leads' });
    }
  });
}

// Whitelist status filter values so a `?payment=` can't inject.
function cleanStatus(raw: unknown): string | null {
  const allowed = new Set([
    'pending', 'paid', 'failed', 'refunded',
    'submitted', 'printed', 'shipped', 'delivered',
  ]);
  return typeof raw === 'string' && allowed.has(raw) ? raw : null;
}

function normalizeOrder(o: any) {
  return {
    id: o.id,
    cardId: o.cardId != null ? Number(o.cardId) : null,
    userId: o.userId ?? null,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    shipTo: o.shipTo,
    shippingTier: o.shippingTier,
    shippingAddress: o.shippingAddress ?? null,
    totalAmount: Number(o.totalAmount),
    printAmount: Number(o.printAmount ?? 0),
    shippingAmount: Number(o.shippingAmount ?? 0),
    envelopeStickerAmount: Number(o.envelopeStickerAmount ?? 0),
    currency: o.currency ?? 'GBP',
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    providerOrderId: o.providerOrderId ?? null,
    trackingNumber: o.trackingNumber ?? null,
    trackingUrl: o.trackingUrl ?? null,
    createdAt: o.createdAt,
    paidAt: o.paidAt ?? null,
  };
}
