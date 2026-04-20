import { pgTable, text, serial, integer, boolean, timestamp, jsonb, json, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
export * from "./models/prompts";
export * from "./models/photos";
export * from "./models/card-draft";
export * from "./models/studio-orders";

import { users } from "./models/auth";

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  parentCardId: integer("parent_card_id"),
  cardType: text("card_type").notNull().default('printed'),
  printOption: text("print_option").default('front-and-inside'),
  sceneType: text("scene_type").notNull(),
  conversationData: jsonb("conversation_data"),
  frontImageUrl: text("front_image_url"),
  insideImageUrl: text("inside_image_url"),
  frontImagePath: text("front_image_path"),
  insideImagePath: text("inside_image_path"),
  printReadyPath: text("print_ready_path"),
  status: text("status").default('generating'),
  price: integer("price").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  /** Public share token. Lazily generated when an order is placed
   *  with the digital add-on, OR when the sender explicitly hits
   *  Share. Used by recipients to view the card via the public
   *  /api/card/:id/view?t=TOKEN endpoint without auth. Null = card
   *  has never been shared. */
  viewToken: text("view_token"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cards.id),
  userId: varchar("user_id").references(() => users.id),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  amount: integer("amount").notNull(),
  baseAmount: integer("base_amount").notNull().default(0),
  tipAmount: integer("tip_amount").notNull().default(0),
  currency: text("currency").notNull().default("ZAR"),
  paymentReference: text("payment_reference").notNull().unique(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  orderStatus: text("order_status").notNull().default("processing"),
  orderType: text("order_type").notNull().default("regular"),
  shippingAddress: json("shipping_address"),
  recipientInfo: text("recipient_info"),
  trackingNumber: text("tracking_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertCardSchema = createInsertSchema(cards).pick({
  cardType: true,
  printOption: true,
  sceneType: true,
  conversationData: true,
  price: true,
});

export const insertOrderSchema = createInsertSchema(orders).pick({
  cardId: true,
  userId: true,
  customerEmail: true,
  customerName: true,
  customerPhone: true,
  amount: true,
  baseAmount: true,
  tipAmount: true,
  currency: true,
  paymentReference: true,
  paymentStatus: true,
  orderStatus: true,
  orderType: true,
  shippingAddress: true,
  trackingNumber: true,
});

export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cards.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Slim projection used by the Studio grid. Historical cards stored
// multi-MB base64 blobs in frontImageUrl, insideImageUrl AND nested
// inside conversationData (as photo_upload / frontImageUrl keys).
// Pulling any of those for a full listing blew past Neon's 64MB
// response cap. The grid query plucks only the scalar fields the tile
// actually needs — no jsonb payloads, no image bytes.
export type CardGridItem = {
  id: number;
  userId: string | null;
  status: string | null;
  cardType: string | null;
  createdAt: Date | null;
  recipientName: string | null;
  occasion: string | null;
  frontImageUrl: string | null;
};
