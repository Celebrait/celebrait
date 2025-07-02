import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { users, cards, lovedOnes, orders, type User, type UpsertUser, type Card, type InsertCard, type LovedOne, type InsertLovedOne, type Order, type InsertOrder } from "@shared/schema";

// Database connection
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export interface IStorage {
  // User operations for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  createCard(card: InsertCard & { userId: string }): Promise<Card>;
  getCard(id: number): Promise<Card | undefined>;
  updateCard(id: number, updates: Partial<Card>): Promise<Card>;
  getUserCards(userId: string): Promise<Card[]>;

  createLovedOne(lovedOne: InsertLovedOne & { userId: string }): Promise<LovedOne>;
  getUserLovedOnes(userId: string): Promise<LovedOne[]>;

  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByReference(reference: string): Promise<Order | undefined>;
  updateOrder(id: number, updates: Partial<Order>): Promise<Order>;
  getOrdersByEmail(email: string): Promise<Order[]>;
  getUserOrders(userId: string): Promise<Order[]>; // New for user accounts
}

export class DatabaseStorage implements IStorage {
  // User operations for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createCard(cardData: InsertCard & { userId: string }): Promise<Card> {
    const [card] = await db
      .insert(cards)
      .values({
        ...cardData,
        frontImagePath: null,
        insideImagePath: null,
        printReadyPath: null,
      })
      .returning();
    return card;
  }

  async getCard(id: number): Promise<Card | undefined> {
    const [card] = await db
      .select()
      .from(cards)
      .where(eq(cards.id, id));
    return card;
  }

  async updateCard(id: number, updates: Partial<Card>): Promise<Card> {
    const [card] = await db
      .update(cards)
      .set(updates)
      .where(eq(cards.id, id))
      .returning();
    return card;
  }

  async getUserCards(userId: string): Promise<Card[]> {
    return await db
      .select()
      .from(cards)
      .where(eq(cards.userId, userId));
  }

  async createLovedOne(lovedOneData: InsertLovedOne & { userId: string }): Promise<LovedOne> {
    const [lovedOne] = await db
      .insert(lovedOnes)
      .values(lovedOneData)
      .returning();
    return lovedOne;
  }

  async getUserLovedOnes(userId: string): Promise<LovedOne[]> {
    return await db
      .select()
      .from(lovedOnes)
      .where(eq(lovedOnes.userId, userId));
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    const [order] = await db
      .insert(orders)
      .values(orderData)
      .returning();
    return order;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id));
    return order;
  }

  async getOrderByReference(reference: string): Promise<Order | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.paymentReference, reference));
    return order;
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order> {
    const [order] = await db
      .update(orders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async getOrdersByEmail(email: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.customerEmail, email));
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId));
  }
}

export const storage = new DatabaseStorage();