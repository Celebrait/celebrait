import { pgTable, text, serial, integer, boolean, timestamp, jsonb, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  cardType: text("card_type").notNull(), // 'printed' | 'digital'
  printOption: text("print_option"), // 'front-only' | 'front-and-inside'
  sceneType: text("scene_type").notNull(), // 'with-person' | 'scene-only'
  conversationData: jsonb("conversation_data"),
  frontImageUrl: text("front_image_url"),
  insideImageUrl: text("inside_image_url"),
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
  trackingNumber: text("tracking_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
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
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;