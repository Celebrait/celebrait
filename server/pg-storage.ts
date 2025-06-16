
import { db } from "./db";
import { users, cards, lovedOnes, orders, type User, type InsertUser, type Card, type InsertCard, type LovedOne, type InsertLovedOne, type Order, type InsertOrder } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import type { IStorage } from "./storage";

export class PgStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async createCard(cardData: InsertCard & { userId: number }): Promise<Card> {
    const result = await db.insert(cards).values({
      ...cardData,
      printOption: cardData.printOption || null,
      conversationData: cardData.conversationData || {},
      frontImageUrl: null,
      insideImageUrl: null,
      status: 'generating'
    }).returning();
    return result[0];
  }

  async getCard(id: number): Promise<Card | undefined> {
    const result = await db.select().from(cards).where(eq(cards.id, id));
    return result[0];
  }

  async updateCard(id: number, updates: Partial<Card>): Promise<Card> {
    const result = await db.update(cards)
      .set(updates)
      .where(eq(cards.id, id))
      .returning();
    
    if (result.length === 0) {
      throw new Error('Card not found');
    }
    return result[0];
  }

  async getUserCards(userId: number): Promise<Card[]> {
    return await db.select().from(cards)
      .where(eq(cards.userId, userId))
      .orderBy(desc(cards.createdAt));
  }

  async createLovedOne(lovedOneData: InsertLovedOne & { userId: number }): Promise<LovedOne> {
    const result = await db.insert(lovedOnes).values(lovedOneData).returning();
    return result[0];
  }

  async getUserLovedOnes(userId: number): Promise<LovedOne[]> {
    return await db.select().from(lovedOnes)
      .where(eq(lovedOnes.userId, userId))
      .orderBy(desc(lovedOnes.createdAt));
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values({
      ...orderData,
      paymentStatus: 'pending',
      orderStatus: 'processing',
      trackingNumber: null,
      currency: orderData.currency || 'ZAR',
      shippingAddress: orderData.shippingAddress || null,
      baseAmount: orderData.baseAmount || orderData.amount,
      tipAmount: orderData.tipAmount || 0,
      orderType: orderData.orderType || 'regular'
    }).returning();
    
    console.log('Creating order with data:', result[0]);
    console.log('Order created successfully:', result[0].id, 'with reference:', result[0].paymentReference);
    return result[0];
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async getOrderByReference(reference: string): Promise<Order | undefined> {
    console.log('Searching for order with reference:', reference);
    
    const result = await db.select().from(orders)
      .where(eq(orders.paymentReference, reference));
    
    const order = result[0];
    console.log('Order found:', order ? `ID: ${order.id}` : 'Not found');
    return order;
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order> {
    const result = await db.update(orders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    
    if (result.length === 0) {
      throw new Error(`Order with id ${id} not found`);
    }
    return result[0];
  }

  async getOrdersByEmail(email: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(eq(orders.customerEmail, email))
      .orderBy(desc(orders.createdAt));
  }
}
