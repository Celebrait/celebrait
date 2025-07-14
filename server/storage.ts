import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc } from "drizzle-orm";
import { users, cards, lovedOnes, orders, type User, type InsertUser, type Card, type InsertCard, type LovedOne, type InsertLovedOne, type Order, type InsertOrder } from "@shared/schema";

// Database connection
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export interface IStorage {
  getUser(id: number | string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createCard(card: InsertCard & { userId: number | string }): Promise<Card>;
  getCard(id: number): Promise<Card | undefined>;
  updateCard(id: number, updates: Partial<Card>): Promise<Card>;
  getUserCards(userId: number | string): Promise<Card[]>;
  getUserCardsForDashboard(userId: number | string): Promise<any[]>;

  createLovedOne(lovedOne: InsertLovedOne & { userId: number | string }): Promise<LovedOne>;
  getUserLovedOnes(userId: number | string): Promise<LovedOne[]>;

  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByReference(reference: string): Promise<Order | undefined>;
  updateOrder(id: number, updates: Partial<Order>): Promise<Order>;
  getOrdersByEmail(email: string): Promise<Order[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private cards: Map<number, Card>;
  private lovedOnes: Map<number, LovedOne>;
  private orders: Map<number, Order>;
  private currentUserId: number;
  private currentCardId: number;
  private currentLovedOneId: number;
  private currentOrderId: number;

  constructor() {
    this.users = new Map();
    this.cards = new Map();
    this.lovedOnes = new Map();
    this.orders = new Map();
    this.currentUserId = 1;
    this.currentCardId = 1;
    this.currentLovedOneId = 1;
    this.currentOrderId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      id,
      email: insertUser.email,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async createCard(cardData: InsertCard & { userId: number }): Promise<Card> {
    const id = this.currentCardId++;
    const card: Card = {
      id,
      userId: cardData.userId,
      cardType: cardData.cardType,
      printOption: cardData.printOption || null,
      sceneType: cardData.sceneType,
      conversationData: cardData.conversationData || {},
      frontImageUrl: null,
      insideImageUrl: null,
      frontImagePath: null,
      insideImagePath: null,
      printReadyPath: null,
      status: 'generating',
      price: cardData.price,
      createdAt: new Date()
    };
    this.cards.set(id, card);
    return card;
  }

  async getCard(id: number): Promise<Card | undefined> {
    return this.cards.get(id);
  }

  async updateCard(id: number, updates: Partial<Card>): Promise<Card> {
    const card = this.cards.get(id);
    if (!card) {
      throw new Error('Card not found');
    }
    const updatedCard = { ...card, ...updates };
    this.cards.set(id, updatedCard);
    return updatedCard;
  }

  async getUserCards(userId: number): Promise<Card[]> {
    return Array.from(this.cards.values()).filter(
      (card) => card.userId === userId,
    );
  }

  async getUserCardsForDashboard(userId: number | string): Promise<any[]> {
    const numericId = typeof userId === 'string' ? parseInt(userId) : userId;
    return Array.from(this.cards.values())
      .filter((card) => card.userId === numericId)
      .slice(0, 50); // Limit to 50 cards
  }

  async createLovedOne(lovedOneData: InsertLovedOne & { userId: number }): Promise<LovedOne> {
    const id = this.currentLovedOneId++;
    const lovedOne: LovedOne = {
      ...lovedOneData,
      id,
      createdAt: new Date()
    };
    this.lovedOnes.set(id, lovedOne);
    return lovedOne;
  }

  async getUserLovedOnes(userId: number): Promise<LovedOne[]> {
    return Array.from(this.lovedOnes.values()).filter(
      (lovedOne) => lovedOne.userId === userId,
    );
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    const id = this.currentOrderId++;
    const order: Order = {
      id,
      cardId: orderData.cardId,
      customerEmail: orderData.customerEmail,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone || null,
      amount: orderData.amount,
      baseAmount: orderData.baseAmount || orderData.amount,
      tipAmount: orderData.tipAmount || 0,
      currency: orderData.currency || 'ZAR',
      paymentReference: orderData.paymentReference,
      paymentStatus: 'pending',
      orderStatus: 'processing',
      orderType: orderData.orderType || 'regular',
      shippingAddress: orderData.shippingAddress || null,
      recipientInfo: orderData.recipientInfo || null,
      trackingNumber: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('Creating order with data:', order); // Added logging
    this.orders.set(id, order);
    console.log('Order created successfully:', id, 'with reference:', order.paymentReference); // Added logging
    return order;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrderByReference(reference: string): Promise<Order | undefined> {
    console.log('Searching for order with reference:', reference);

    const order = Array.from(this.orders.values()).find(
      (order) => order.paymentReference === reference
    );

    console.log('Order found:', order ? `ID: ${order.id}` : 'Not found');
    return order;
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) {
      throw new Error(`Order with id ${id} not found`);
    }

    const updatedOrder = { 
      ...order, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async getOrdersByEmail(email: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.customerEmail === email
    );
  }
}

// PostgreSQL-based storage implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number | string): Promise<User | undefined> {
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    if (isNaN(numericId)) return undefined;
    const result = await db.select().from(users).where(eq(users.id, numericId)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createCard(cardData: InsertCard & { userId: number | string }): Promise<Card> {
    const numericUserId = typeof cardData.userId === 'string' ? parseInt(cardData.userId) : cardData.userId;
    const cardWithNumericUserId = { ...cardData, userId: numericUserId };
    const result = await db.insert(cards).values(cardWithNumericUserId).returning();
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

  async getUserCards(userId: number | string): Promise<Card[]> {
    const numericId = typeof userId === 'string' ? parseInt(userId) : userId;
    if (isNaN(numericId)) return [];
    return await db.select().from(cards).where(eq(cards.userId, numericId));
  }

  async getUserCardsForDashboard(userId: number | string): Promise<any[]> {
    const userIdStr = typeof userId === 'number' ? userId.toString() : userId;
    
    // Use raw SQL to avoid any issues with large data processing
    try {
      const result = await sql`
        SELECT id, card_type, status, price, created_at 
        FROM cards 
        WHERE user_id = ${userIdStr} 
        ORDER BY created_at DESC 
        LIMIT 5
      `;
      return result;
    } catch (error) {
      console.error('Dashboard cards query error:', error);
      return [];
    }
  }

  async createLovedOne(lovedOneData: InsertLovedOne & { userId: number | string }): Promise<LovedOne> {
    const numericUserId = typeof lovedOneData.userId === 'string' ? parseInt(lovedOneData.userId) : lovedOneData.userId;
    const lovedOneWithNumericUserId = { ...lovedOneData, userId: numericUserId };
    const result = await db.insert(lovedOnes).values(lovedOneWithNumericUserId).returning();
    return result[0];
  }

  async getUserLovedOnes(userId: number | string): Promise<LovedOne[]> {
    const numericId = typeof userId === 'string' ? parseInt(userId) : userId;
    if (isNaN(numericId)) return [];
    return await db.select().from(lovedOnes).where(eq(lovedOnes.userId, numericId));
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
}

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();