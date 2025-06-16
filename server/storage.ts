import { users, cards, lovedOnes, orders, type User, type InsertUser, type Card, type InsertCard, type LovedOne, type InsertLovedOne, type Order, type InsertOrder } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createCard(card: InsertCard & { userId: number }): Promise<Card>;
  getCard(id: number): Promise<Card | undefined>;
  updateCard(id: number, updates: Partial<Card>): Promise<Card>;
  getUserCards(userId: number): Promise<Card[]>;

  createLovedOne(lovedOne: InsertLovedOne & { userId: number }): Promise<LovedOne>;
  getUserLovedOnes(userId: number): Promise<LovedOne[]>;

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
      ...insertUser, 
      id,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async createCard(cardData: InsertCard & { userId: number }): Promise<Card> {
    const id = this.currentCardId++;
    const card: Card = {
      ...cardData,
      printOption: cardData.printOption || null,
      conversationData: cardData.conversationData || {},
      id,
      frontImageUrl: null,
      insideImageUrl: null,
      status: 'generating',
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
      ...orderData,
      id, // Explicitly set the ID
      paymentStatus: 'pending',
      orderStatus: 'processing',
      trackingNumber: null,
      currency: orderData.currency || 'ZAR',
      shippingAddress: orderData.shippingAddress || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      baseAmount: orderData.baseAmount || orderData.amount,
      tipAmount: orderData.tipAmount || 0,
      orderType: orderData.orderType || 'regular'
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

// Database storage implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createCard(cardData: InsertCard & { userId: number }): Promise<Card> {
    const [card] = await db
      .insert(cards)
      .values(cardData)
      .returning();
    return card;
  }

  async getCard(id: number): Promise<Card | undefined> {
    const [card] = await db.select().from(cards).where(eq(cards.id, id));
    return card || undefined;
  }

  async updateCard(id: number, updates: Partial<Card>): Promise<Card> {
    const [card] = await db
      .update(cards)
      .set(updates)
      .where(eq(cards.id, id))
      .returning();
    return card;
  }

  async getUserCards(userId: number): Promise<Card[]> {
    return await db.select().from(cards).where(eq(cards.userId, userId));
  }

  async createLovedOne(lovedOneData: InsertLovedOne & { userId: number }): Promise<LovedOne> {
    const [lovedOne] = await db
      .insert(lovedOnes)
      .values(lovedOneData)
      .returning();
    return lovedOne;
  }

  async getUserLovedOnes(userId: number): Promise<LovedOne[]> {
    return await db.select().from(lovedOnes).where(eq(lovedOnes.userId, userId));
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    const [order] = await db
      .insert(orders)
      .values(orderData)
      .returning();
    return order;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderByReference(reference: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.reference, reference));
    return order || undefined;
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order> {
    const [order] = await db
      .update(orders)
      .set(updates)
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async getOrdersByEmail(email: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.email, email));
  }
}

export const storage = new MemStorage();