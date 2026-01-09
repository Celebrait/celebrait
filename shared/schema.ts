import { pgTable, text, serial, integer, boolean, timestamp, jsonb, json, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

import { users } from "./models/auth";

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
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
});

export const prospects = pgTable("prospects", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  cardId: integer("card_id").references(() => cards.id),
  recipientName: text("recipient_name"),
  celebrationType: text("celebration_type"),
  signupSource: text("signup_source").default("card_generation"),
  brevoContactId: text("brevo_contact_id"),
  marketingOptIn: boolean("marketing_opt_in").default(true),
  cardPreviewSent: boolean("card_preview_sent").default(false),
  convertedToCustomer: boolean("converted_to_customer").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
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

export const insertProspectSchema = createInsertSchema(prospects).pick({
  email: true,
  firstName: true,
  lastName: true,
  cardId: true,
  recipientName: true,
  celebrationType: true,
  signupSource: true,
  marketingOptIn: true,
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
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospects.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
