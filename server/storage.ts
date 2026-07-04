import "dotenv/config";
import { randomBytes } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { and, desc, eq, sql } from "drizzle-orm";
import { cards, orders, photos, type Card, type CardGridItem, type InsertCard, type Order, type InsertOrder, type Photo, type InsertPhoto, type User } from "@shared/schema";
import { users } from "@shared/models/auth";
import { publicImageUrl, resolveStoredImageUrl } from "./image-storage";

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
      // Stable unguessable secret for this card's image object keys, so
      // they can't be enumerated from the sequential id (audit 2026-07-02).
      imageKey: randomBytes(16).toString('base64url'),
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
    // LEFT JOIN studio_orders so we can surface whether each card has
    // been paid for — drives the Ready vs Sent bucket split in the
    // dashboard. `cards.status` alone isn't enough: it stays at
    // 'completed' forever regardless of purchase; the money state
    // lives on studio_orders.payment_status. Cleaner to keep the
    // two domains separate and derive display state here.
    const result = await db.execute(sql`
      SELECT
        c.id,
        c.user_id        AS "userId",
        c.status,
        c.card_type      AS "cardType",
        c.created_at     AS "createdAt",
        c.front_image_path AS "frontImagePath",
        c.front_image_url  AS "frontImageUrl",
        COALESCE(
          c.conversation_data->'recipient'->>'name',
          c.conversation_data->>'name',
          c.conversation_data->>'recipientName'
        ) AS "recipientName",
        COALESCE(
          c.conversation_data->'recipient'->>'occasion',
          c.conversation_data->>'celebration',
          c.conversation_data->>'celebrationType',
          c.conversation_data->>'occasion'
        ) AS "occasion",
        -- Last step the user was on (0-indexed per CARD_MAKER_STEPS).
        -- Drives the "Step X of 6 · Photos" progress label on draft
        -- tiles in the dashboard activity column. Nullable on legacy
        -- rows that predate the step field.
        (c.conversation_data->>'step')::int AS "draftStep",
        -- Boolean: does this card have at least one paid Studio order?
        -- EXISTS keeps the grid one row per card even if a user has
        -- multiple orders against the same card (reorder, etc.).
        EXISTS (
          SELECT 1 FROM studio_orders so
          WHERE so.card_id = c.id
            AND so.payment_status = 'paid'
        ) AS "hasPaidOrder",
        -- "Just finished" — the card is completed but the sender
        -- hasn't yet been shown the in-app reveal notification.
        -- Drives the "Just finished" badge on the Ready dashboard.
        -- Composite signal so the grid query stays self-sufficient
        -- (no client-side derivation required).
        (c.status = 'completed' AND c.notified_at IS NULL) AS "isJustFinished"
      FROM cards c
      WHERE c.user_id = ${userId}
      ORDER BY c.created_at DESC
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
      // Prefer stored-file path when we have it (served under /images/
      // with 1-year cache); fall back to the direct URL column for
      // legacy rows. Some cards have only one populated; never assume
      // both — that's why the dashboard was showing empty thumbnails.
      frontImageUrl: resolveStoredImageUrl(r.frontImagePath, r.frontImageUrl),
      hasPaidOrder: Boolean(r.hasPaidOrder),
      draftStep:
        typeof r.draftStep === 'number' && Number.isFinite(r.draftStep)
          ? r.draftStep
          : null,
      isJustFinished: Boolean(r.isJustFinished),
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
