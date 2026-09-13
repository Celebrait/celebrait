// shared/models/order-items.ts
//
// ONE ORDER, MANY CARDS (UX_THREE_DOORS.md §8e).
//
// `studio_orders.cardId` was NOT NULL and 1:1 — fine while a card was
// always made one at a time in the photo studio, fatal the moment the
// rack invites "I'll do my whole Christmas list". Prodigi was never the
// constraint: its submission already takes an `items: []` array with a
// `copies` field. Our order row was.
//
// Line items carry the PRICE PAID PER CARD, not a lookup — the ladder
// (£4.99/£5.99/£6.99 by door) can change without rewriting history, and
// a mixed basket totals correctly by summing what was actually charged.
//
// `studio_orders.cardId` survives as the FIRST card of the order, kept
// for the many existing reads that expect it (and back-filled for every
// historic order). New code reads line items.

import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    /** studio_orders.id — a text uuid, not a serial. */
    orderId: text("order_id").notNull(),
    cardId: integer("card_id").notNull(),
    /** Pence charged for THIS card, at the time of sale. */
    unitPrice: integer("unit_price").notNull(),
    /** Which door made it, snapshotted for reporting. */
    source: text("source"),
    /** Display order in the basket. */
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_card_id_idx").on(table.cardId),
  ],
);

export type OrderItem = typeof orderItems.$inferSelect;
