import { users, cards, lovedOnes, type User, type InsertUser, type Card, type InsertCard, type LovedOne, type InsertLovedOne } from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private cards: Map<number, Card>;
  private lovedOnes: Map<number, LovedOne>;
  private currentUserId: number;
  private currentCardId: number;
  private currentLovedOneId: number;

  constructor() {
    this.users = new Map();
    this.cards = new Map();
    this.lovedOnes = new Map();
    this.currentUserId = 1;
    this.currentCardId = 1;
    this.currentLovedOneId = 1;
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
}

export const storage = new MemStorage();
