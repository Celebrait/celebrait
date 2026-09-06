import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

// Studio orders. Legacy `orders` table (shared/schema.ts) is dead —
// keep it around for historical records but do not reference it from
// new code. Every Sprint 4+ checkout goes here.
//
// A single order can include printed + digital + both. Digital is the
// £0.99 add-on unlocked via the tokenised share URL
// (/card/:id/view?t=TOKEN). Print is fulfilled by an abstracted
// PrintProvider (Gelato as the leading candidate; not committed).
export const studioOrders = pgTable(
  "studio_orders",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    cardId: integer("card_id").notNull(),
    userId: varchar("user_id").references(() => users.id),

    // Contact details for transactional comms. customerEmail is the
    // sender's account email; recipientEmail is optional — only set
    // when the user asks us to deliver the digital/print directly.
    customerEmail: text("customer_email").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    recipientEmail: text("recipient_email"),
    recipientPhone: text("recipient_phone"),

    // What was bought. Both flags may be true (the funnel default:
    // print + £0.99 digital add-on).
    includesPrint: boolean("includes_print").notNull().default(false),
    includesDigital: boolean("includes_digital").notNull().default(false),

    // Shipping. shipTo = 'sender' means we ship to customerName at
    // shippingAddress; 'recipient' means direct-to-recipient with
    // plain packaging + optional gift message. Null when digital-only.
    shipTo: text("ship_to"), // 'sender' | 'recipient' | null
    shippingAddress: jsonb("shipping_address"), // { line1, line2?, city, postcode, country }
    // Delivery speed the customer picked at checkout. Drives shippingAmount
    // AND the Prodigi shippingMethod at fulfilment. See SHIPPING_TIERS in
    // shared/pricing.ts. 'standard' | 'express' | 'overnight'.
    shippingTier: text("shipping_tier").notNull().default("standard"),
    giftMessage: text("gift_message"),
    // Legacy column: the welcome gate has no custom-message UI anymore,
    // but the column is kept so `drizzle-kit push` doesn't flag it for
    // deletion. Can be dropped later if we're sure no legacy data cares.
    welcomeMessage: text("welcome_message"),

    // Money — integers, minor units (pence).
    currency: text("currency").notNull().default("GBP"),
    printAmount: integer("print_amount").notNull().default(0),
    digitalAmount: integer("digital_amount").notNull().default(0),
    shippingAmount: integer("shipping_amount").notNull().default(0),
    // Optional wax-seal envelope sticker charge (£1.50 when chosen, else 0).
    // Opt-in add-on on direct-to-recipient sends (Kevin 2026-07-21). Itemised
    // so refunds/reporting see it apart from postage. See ENVELOPE_STICKER_GBP
    // in shared/pricing.ts. NB: the DB column is still `delivery_surcharge_amount`
    // (it began as the direct surcharge) — kept to avoid a migration; >0 means
    // "sticker chosen", which the fulfilment path reads.
    envelopeStickerAmount: integer("delivery_surcharge_amount")
      .notNull()
      .default(0),
    totalAmount: integer("total_amount").notNull(),
    // The amount ACTUALLY charged, captured from the gateway on the paid
    // flip (Stripe: session.amount_total). Differs from totalAmount when a
    // promotion code discounts the order — e.g. friends-&-family £7.99-off
    // makes a £12.94 order charge £4.95. NULL for pre-2026-07-22 orders and
    // any not-yet-paid order; reporting falls back to totalAmount when null.
    amountPaid: integer("amount_paid"),
    // The free-first-card credit was applied at create (printAmount forced
    // to 0, standard postage only). Explicit flag — don't infer from
    // printAmount=0 — so the paid webhook knows to consume the user's
    // credit and reporting can count redemptions. See server/studio/free-card.ts.
    freeCardApplied: boolean("free_card_applied").notNull().default(false),
    /** Comp code redeemed on this order, if any (see models/comp-codes.ts).
     *  Present = this was GIFTED, not sold — a marketing cost dressed as an
     *  order. Reporting must be able to exclude these, otherwise a creator
     *  campaign reads as a sales spike and corrupts the only pricing
     *  feedback loop we have. Null on every normal order.
     *  ⚠️ needs: ALTER TABLE studio_orders ADD COLUMN IF NOT EXISTS
     *  comp_code varchar(32); */
    compCode: varchar("comp_code", { length: 32 }),

    // Payment — provider-agnostic. paymentProvider records which
    // gateway processed it (stub|peach|stripe|…); paymentReference is
    // the gateway's ID for reconciliation.
    paymentProvider: text("payment_provider").notNull().default("stub"),
    paymentReference: text("payment_reference"),
    paymentStatus: text("payment_status").notNull().default("pending"), // pending|paid|failed|refunded

    // Fulfilment — also provider-agnostic. printProvider is the
    // supplier (stub|gelato|prodigi|…); providerOrderId is their ID.
    printProvider: text("print_provider"),
    providerOrderId: text("provider_order_id"),
    fulfillmentStatus: text("fulfillment_status").notNull().default("pending"), // pending|submitted|printed|shipped|delivered|failed
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    paidAt: timestamp("paid_at"),
    // First time the recipient actually opened the share link.
    // Nulls until the public view endpoint records a valid-token hit.
    // Used to (a) fire the "they've opened it" email to the sender
    // once, and (b) potential future analytics.
    firstOpenedAt: timestamp("first_opened_at"),
  },
  (table) => [
    index("studio_orders_card_id_idx").on(table.cardId),
    index("studio_orders_user_id_idx").on(table.userId),
    index("studio_orders_payment_status_idx").on(table.paymentStatus),
    index("studio_orders_fulfillment_status_idx").on(table.fulfillmentStatus),
    // Webhook hot paths (audit 2026-07-27): Stripe events look orders up
    // by payment_reference, Prodigi callbacks by provider_order_id —
    // both were unindexed sequential scans.
    index("studio_orders_payment_reference_idx").on(table.paymentReference),
    index("studio_orders_provider_order_id_idx").on(table.providerOrderId),
  ]
);

export const insertStudioOrderSchema = createInsertSchema(studioOrders).pick({
  cardId: true,
  userId: true,
  customerEmail: true,
  customerName: true,
  customerPhone: true,
  recipientEmail: true,
  recipientPhone: true,
  includesPrint: true,
  includesDigital: true,
  shipTo: true,
  shippingAddress: true,
  shippingTier: true,
  giftMessage: true,
  currency: true,
  printAmount: true,
  digitalAmount: true,
  shippingAmount: true,
  envelopeStickerAmount: true,
  totalAmount: true,
  freeCardApplied: true,
});

export type InsertStudioOrder = z.infer<typeof insertStudioOrderSchema>;
export type StudioOrder = typeof studioOrders.$inferSelect;

// Dashboard list projection. Joined with cards + recipient/occasion
// derived from conversationData. Returned by GET /api/studio/orders.
// Keep the shape in sync with the handler in server/routes/studio-checkout.ts.
export type StudioOrderListItem = {
  id: string;
  cardId: number;
  createdAt: Date | null;
  paidAt: Date | null;
  includesPrint: boolean;
  includesDigital: boolean;
  totalAmount: number;
  currency: string;
  paymentStatus: string;       // 'pending' | 'paid' | 'failed' | 'refunded'
  fulfillmentStatus: string;   // 'pending' | 'submitted' | 'printed' | 'shipped' | 'delivered' | 'failed'
  trackingUrl: string | null;
  trackingNumber: string | null;
  printProvider: string | null; // 'stub' | 'prodigi' | null (not yet submitted)
  shipTo: string | null;
  recipientName: string | null;
  occasion: string | null;
  frontImageUrl: string | null;
  /** Tokenised share URL for paid digital orders. Null otherwise. */
  shareUrl: string | null;
};

export const shippingAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  // Real UK postcode shape (audit 2026-07-27): a typo used to surface
  // only when Prodigi rejected the order — AFTER payment. Permissive on
  // spacing/case; the regex covers all live UK formats (A9 9AA…AA9A 9AA).
  postcode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/, {
      message: "Enter a valid UK postcode (e.g. SW1A 1AA)",
    }),
  // UK-only product — a crafted POST could previously ship anywhere at
  // UK shipping prices.
  country: z.literal("GB").default("GB"),
});
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
