import { pgTable, text, serial, integer, boolean, timestamp, jsonb, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  cardType: text("card_type").notNull(), // 'printed' | 'digital'
  printOption: text("print_option"), // 'front-only' | 'front-and-inside'
  sceneType: text("scene_type").notNull(), // 'with-person' | 'scene-only'
  conversationData: jsonb("conversation_data"),
  frontImageUrl: text("front_image_url"), // File path or legacy base64
  insideImageUrl: text("inside_image_url"), // File path or legacy base64
  frontImagePath: text("front_image_path"), // NEW: File system path
  insideImagePath: text("inside_image_path"), // NEW: File system path
  printReadyPath: text("print_ready_path"), // NEW: PDF/print-ready file path
  status: text("status").default('generating'), // 'generating' | 'completed' | 'paid'
  price: integer("price").notNull(), // in cents
  createdAt: timestamp("created_at").defaultNow(),
});

export const lovedOnes = pgTable("loved_ones", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  birthday: text("birthday").notNull(),
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
  recipientInfo: text("recipient_info"), // JSON string containing recipient name and email for dual delivery
  trackingNumber: text("tracking_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
});

export const insertCardSchema = createInsertSchema(cards).pick({
  cardType: true,
  printOption: true,
  sceneType: true,
  conversationData: true,
  price: true,
});

export const insertLovedOneSchema = createInsertSchema(lovedOnes).pick({
  name: true,
  birthday: true,
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cards.$inferSelect;
export type InsertLovedOne = z.infer<typeof insertLovedOneSchema>;
export type LovedOne = typeof lovedOnes.$inferSelect;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospects.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;