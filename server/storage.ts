import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { cards, orders, prospects, type Card, type InsertCard, type Order, type InsertOrder, type Prospect, type InsertProspect, type User } from "@shared/schema";
import { users } from "@shared/models/auth";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;

  createCard(card: InsertCard & { userId?: string | null }): Promise<Card>;
  getCard(id: number): Promise<Card | undefined>;
  updateCard(id: number, updates: Partial<Card>): Promise<Card>;
  getUserCards(userId: string): Promise<Card[]>;

  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByReference(reference: string): Promise<Order | undefined>;
  updateOrder(id: number, updates: Partial<Order>): Promise<Order>;
  getOrdersByEmail(email: string): Promise<Order[]>;
  getUserOrders(userId: string): Promise<Order[]>;

  createProspect(prospect: InsertProspect): Promise<Prospect>;
  getProspect(id: number): Promise<Prospect | undefined>;
  getProspectByEmail(email: string): Promise<Prospect | undefined>;
  updateProspect(id: number, updates: Partial<Prospect>): Promise<Prospect>;
  markProspectConverted(email: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createCard(cardData: InsertCard & { userId?: string | null }): Promise<Card> {
    const result = await db.insert(cards).values({
      ...cardData,
      userId: cardData.userId || null,
      cardType: cardData.cardType || 'printed',
      printOption: cardData.printOption || 'front-and-inside',
    }).returning();
    return result[0];
  }

  async getCard(id: number): Promise<Card | undefined> {
    const result = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
    return result[0];
  }

  async updateCard(id: number, updates: Partial<Card>): Promise<Card> {
    const result = await db.update(cards).set(updates).where(eq(cards.id, id)).returning();
    return result[0];
  }

  async getUserCards(userId: string): Promise<Card[]> {
    return await db.select().from(cards).where(eq(cards.userId, userId));
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(orderData).returning();
    return result[0];
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  }

  async getOrderByReference(reference: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.paymentReference, reference)).limit(1);
    return result[0];
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order> {
    const result = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    return result[0];
  }

  async getOrdersByEmail(email: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.customerEmail, email));
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.userId, userId));
  }

  async createProspect(prospectData: InsertProspect): Promise<Prospect> {
    const result = await db.insert(prospects).values(prospectData).returning();
    return result[0];
  }

  async getProspect(id: number): Promise<Prospect | undefined> {
    const result = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
    return result[0];
  }

  async getProspectByEmail(email: string): Promise<Prospect | undefined> {
    const result = await db.select().from(prospects).where(eq(prospects.email, email)).limit(1);
    return result[0];
  }

  async updateProspect(id: number, updates: Partial<Prospect>): Promise<Prospect> {
    const result = await db.update(prospects).set(updates).where(eq(prospects.id, id)).returning();
    return result[0];
  }

  async markProspectConverted(email: string): Promise<void> {
    await db.update(prospects)
      .set({ convertedToCustomer: true, updatedAt: new Date() })
      .where(eq(prospects.email, email));
  }
}

export const storage = new DatabaseStorage();
