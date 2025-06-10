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
    this.orders.set(id, order);
    return order;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrderByReference(reference: string): Promise<Order | undefined> {
    console.log('Looking for order with reference:', reference);
    return Array.from(this.orders.values()).find(
      (order) => order.paymentReference === reference
    );
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

export const storage = new MemStorage();