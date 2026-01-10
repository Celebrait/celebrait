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
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  getUserGenerationCredits(id: string): Promise<{ freeRemaining: number; paidCredits: number; canGenerate: boolean }>;
  useGenerationCredit(id: string): Promise<{ success: boolean; creditType: 'free' | 'paid' | 'none'; remaining: { freeRemaining: number; paidCredits: number } }>;
  addPaidCredits(id: string, amount: number): Promise<User>;

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

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const result = await db.update(users).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(users.id, id)).returning();
    return result[0];
  }

  async getUserGenerationCredits(id: string): Promise<{ freeRemaining: number; paidCredits: number; canGenerate: boolean }> {
    const user = await this.getUser(id);
    if (!user) {
      return { freeRemaining: 0, paidCredits: 0, canGenerate: false };
    }
    
    const FREE_GENERATION_LIMIT = 2;
    const freeRemaining = Math.max(0, FREE_GENERATION_LIMIT - (user.freeGenerationsUsed || 0));
    const paidCredits = user.paidCredits || 0;
    const canGenerate = freeRemaining > 0 || paidCredits > 0;
    
    return { freeRemaining, paidCredits, canGenerate };
  }

  async useGenerationCredit(id: string): Promise<{ success: boolean; creditType: 'free' | 'paid' | 'none'; remaining: { freeRemaining: number; paidCredits: number } }> {
    const user = await this.getUser(id);
    if (!user) {
      return { success: false, creditType: 'none', remaining: { freeRemaining: 0, paidCredits: 0 } };
    }
    
    const FREE_GENERATION_LIMIT = 2;
    const freeRemaining = Math.max(0, FREE_GENERATION_LIMIT - (user.freeGenerationsUsed || 0));
    const paidCredits = user.paidCredits || 0;
    
    if (freeRemaining > 0) {
      await this.updateUser(id, { freeGenerationsUsed: (user.freeGenerationsUsed || 0) + 1 });
      return { 
        success: true, 
        creditType: 'free', 
        remaining: { freeRemaining: freeRemaining - 1, paidCredits } 
      };
    } else if (paidCredits > 0) {
      await this.updateUser(id, { paidCredits: paidCredits - 1 });
      return { 
        success: true, 
        creditType: 'paid', 
        remaining: { freeRemaining: 0, paidCredits: paidCredits - 1 } 
      };
    }
    
    return { success: false, creditType: 'none', remaining: { freeRemaining: 0, paidCredits: 0 } };
  }

  async addPaidCredits(id: string, amount: number): Promise<User> {
    const user = await this.getUser(id);
    const currentCredits = user?.paidCredits || 0;
    return await this.updateUser(id, { paidCredits: currentCredits + amount });
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
