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
    giftMessage: text("gift_message"),
    // `welcome_message` column still exists in the DB but is no
    // longer referenced from the app — the welcome gate has no
    // custom-message UI. Left as a no-op column to avoid a
    // destructive migration; can be dropped later if we're sure
    // no legacy data cares.

    // Money — integers, minor units (pence).
    currency: text("currency").notNull().default("GBP"),
    printAmount: integer("print_amount").notNull().default(0),
    digitalAmount: integer("digital_amount").notNull().default(0),
    shippingAmount: integer("shipping_amount").notNull().default(0),
    totalAmount: integer("total_amount").notNull(),

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
  giftMessage: true,
  currency: true,
  printAmount: true,
  digitalAmount: true,
  shippingAmount: true,
  totalAmount: true,
});

export type InsertStudioOrder = z.infer<typeof insertStudioOrderSchema>;
export type StudioOrder = typeof studioOrders.$inferSelect;

export const shippingAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  postcode: z.string().min(1),
  country: z.string().min(2).default("GB"),
});
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
