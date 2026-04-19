import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { and, desc, eq, sql } from "drizzle-orm";
import { cards, orders, photos, type Card, type CardGridItem, type InsertCard, type Order, type InsertOrder, type Photo, type InsertPhoto, type User } from "@shared/schema";
import { users } from "@shared/models/auth";

const db = drizzle(neon(process.env.DATABASE_URL!));

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: { email: string; username?: string }): Promise<User>;

  createCard(card: InsertCard & { userId?: string | null }): Promise<Card>;
  getCard(id: number): Promise<Card | undefined>;
  updateCard(id: number, updates: Partial<Card>): Promise<Card>;
  getUserCards(userId: string): Promise<Card[]>;
  getUserCardsForGrid(userId: string): Promise<CardGridItem[]>;

  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByReference(reference: string): Promise<Order | undefined>;
  updateOrder(id: number, updates: Partial<Order>): Promise<Order>;
  getOrdersByEmail(email: string): Promise<Order[]>;
  getUserOrders(userId: string): Promise<Order[]>;

  createPhoto(photo: InsertPhoto): Promise<Photo>;
  getPhoto(id: number): Promise<Photo | undefined>;
  getUserPhotos(userId: string): Promise<Photo[]>;
  updatePhoto(id: number, updates: Partial<Photo>): Promise<Photo>;
  deletePhoto(id: number): Promise<void>;
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

  async createUser(data: { email: string; username?: string }): Promise<User> {
    const result = await db.insert(users).values({
      email: data.email,
      firstName: data.username || data.email,
    }).returning();
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

  // Lightweight projection for the Studio grid. The old customer flow
  // stored multi-MB base64 data URLs in frontImageUrl, insideImageUrl,
  // AND inside the conversationData jsonb (as `photo_upload` /
  // `frontImageUrl` keys). Selecting any of those in bulk blew past
  // Neon's 64MB response cap for users with many cards.
  //
  // Raw SQL so we can pluck specific jsonb keys via `->>` — that way
  // Postgres only returns short strings, never the full blob. The
  // typed query builder makes this awkward with jsonb operators so we
  // drop to execute() here; the result set is small and well-defined.
  async getUserCardsForGrid(userId: string): Promise<CardGridItem[]> {
    const result = await db.execute(sql`
      SELECT
        id,
        user_id        AS "userId",
        status,
        card_type      AS "cardType",
        created_at     AS "createdAt",
        front_image_path AS "frontImagePath",
        COALESCE(
          conversation_data->>'name',
          conversation_data->>'recipientName'
        ) AS "recipientName",
        COALESCE(
          conversation_data->>'celebration',
          conversation_data->>'celebrationType',
          conversation_data->>'occasion'
        ) AS "occasion"
      FROM cards
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 200
    `);

    // neon-http returns rows directly as an array; drizzle-orm's
    // execute() wraps it as { rows } on some drivers. Handle both.
    const rows: any[] = Array.isArray(result) ? result : (result as any).rows ?? [];

    return rows.map((r) => ({
      id: Number(r.id),
      userId: r.userId ?? null,
      status: r.status ?? null,
      cardType: r.cardType ?? null,
      createdAt: r.createdAt ? new Date(r.createdAt) : null,
      recipientName: r.recipientName ?? null,
      occasion: r.occasion ?? null,
      frontImageUrl: r.frontImagePath ? `/images/${r.frontImagePath}` : null,
    }));
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

  async createPhoto(photoData: InsertPhoto): Promise<Photo> {
    const result = await db.insert(photos).values(photoData).returning();
    return result[0];
  }

  async getPhoto(id: number): Promise<Photo | undefined> {
    const result = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
    return result[0];
  }

  async getUserPhotos(userId: string): Promise<Photo[]> {
    return await db
      .select()
      .from(photos)
      .where(eq(photos.userId, userId))
      .orderBy(desc(photos.createdAt));
  }

  async updatePhoto(id: number, updates: Partial<Photo>): Promise<Photo> {
    const result = await db.update(photos).set(updates).where(eq(photos.id, id)).returning();
    return result[0];
  }

  async deletePhoto(id: number): Promise<void> {
    await db.delete(photos).where(eq(photos.id, id));
  }
}

export const storage = new DatabaseStorage();
