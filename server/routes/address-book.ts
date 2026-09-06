// server/routes/address-book.ts
//
// REST endpoints for the Studio's per-user address book. Backbone of the
// dashboard's PEOPLE section + the (upcoming) reminder system.
//
// Routes:
//   GET    /api/user/address-book           — list all entries
//   GET    /api/user/address-book/search    — typeahead (?q=mu, max 8)
//   GET    /api/user/address-book/:id       — one entry + its occasions
//   POST   /api/user/address-book           — create entry (+ optional occasions)
//   PATCH  /api/user/address-book/:id       — update entry fields
//   DELETE /api/user/address-book/:id       — hard delete (cascades occasions)
//
//   POST   /api/user/address-book/:id/occasions          — add occasion
//   PATCH  /api/user/address-book/:id/occasions/:occId   — edit occasion
//   DELETE /api/user/address-book/:id/occasions/:occId   — remove occasion
//
// Auto-save hooks (called from background-generator + checkout — see
// upsertAddressBookFromCard / backfillAddressFromOrder below) live in
// this module so the address-book write surface is one place.
//
// Auth: every endpoint requires a session.otpUserId AND scopes the
// query to that userId — security baked into storage layer; no
// trusting the URL.

import type { Express, Request, Response } from 'express';
import { and, desc, eq, ilike, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  addressBookEntries,
  recipientOccasions,
  insertAddressBookEntrySchema,
  insertRecipientOccasionSchema,
  type AddressBookEntry,
  type RecipientOccasionRow,
  type CardDraftState,
  studioOrders,
  cards,
} from '@shared/schema';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';
import { publicImageUrl } from '../image-storage';

function getUserId(req: Request): string | null {
  const id = (req as any).session?.otpUserId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Tiny shape returned alongside an address-book entry to give the
 *  list UI a visual anchor — the front art of the most recent card
 *  this person was sent. Null when nothing's been sent yet (the row
 *  falls back to a letter avatar). Just front for now; inside isn't
 *  needed for a list thumbnail and keeps the payload small. */
interface LastSentCard {
  frontImageUrl: string;
  /** ISO timestamp of when the card was completed. Renders as a soft
   *  "Last sent 14 Mar 2026" line on the address-book row — the memory
   *  shelf framing from next_address_book_reminders_retention.md.
   *  Client formats locally so we don't bake a locale on the server. */
  sentAt: string;
}

interface EntryWithOccasions extends AddressBookEntry {
  occasions: RecipientOccasionRow[];
  /** Most recent completed card sent to this recipient (matched by
   *  case-insensitive name on cards.conversationData.recipient.name).
   *  Drives the row thumbnail — turns the address book from a
   *  contacts list into a memory shelf. See
   *  next_address_book_reminders_retention.md. */
  lastCard: LastSentCard | null;
}

/** Look up the front image of the most recent completed card a user
 *  sent to a recipient (matched loosely by name). Returns null if
 *  nothing's been sent. Mirrors the dashboard's image-resolution
 *  pattern: prefer the on-disk `/images/<path>` when frontImagePath
 *  is set (1-year cache), fall back to the legacy frontImageUrl. */
async function findLastSentCardForName(
  userId: string,
  name: string,
): Promise<LastSentCard | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const rows = await db
    .select({
      frontImagePath: cards.frontImagePath,
      frontImageUrl: cards.frontImageUrl,
      createdAt: cards.createdAt,
    })
    .from(cards)
    .where(
      and(
        eq(cards.userId, userId),
        eq(cards.status, 'completed'),
        sql`lower(${cards.conversationData}->'recipient'->>'name') = lower(${trimmed})`,
      ),
    )
    .orderBy(desc(cards.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const url = row.frontImagePath
    ? publicImageUrl(row.frontImagePath)
    : row.frontImageUrl;
  if (!url) return null;
  // createdAt is non-null in the schema (defaultNow().notNull()) but
  // Drizzle's inferred type allows null because the column is
  // technically nullable at the DB layer until a row is inserted.
  // Fall back to "now" defensively — never null in practice for a
  // completed card row.
  return {
    frontImageUrl: url,
    sentAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

/** Hydrate an entry with its occasions AND its most recent sent card
 *  (the row thumbnail anchor). Two extra queries per entry; runs them
 *  in parallel so it's still effectively one round-trip per entry.
 *  Pre-launch list sizes are small enough that the N+1 doesn't matter;
 *  if the address book grows large we batch this with a left-join. */
async function hydrateEntry(entry: AddressBookEntry): Promise<EntryWithOccasions> {
  const [occs, lastCard] = await Promise.all([
    db
      .select()
      .from(recipientOccasions)
      .where(eq(recipientOccasions.addressBookEntryId, entry.id))
      .orderBy(recipientOccasions.date),
    findLastSentCardForName(entry.userId, entry.name),
  ]);
  return { ...entry, occasions: occs, lastCard };
}

/** Find an entry by case-insensitive name match within a user's
 *  scope. Used by auto-save to dedup — *"Mum" === "mum" === "MUM"*. */
async function findEntryByNameCI(
  userId: string,
  name: string,
): Promise<AddressBookEntry | null> {
  const normalized = name.trim();
  if (!normalized) return null;
  const rows = await db
    .select()
    .from(addressBookEntries)
    .where(
      and(
        eq(addressBookEntries.userId, userId),
        sql`lower(${addressBookEntries.name}) = lower(${normalized})`,
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// ── Auto-save hooks ──────────────────────────────────────────────────
//
// Called from background-generator's success branch + checkout's
// post-payment handler. Both are best-effort — failing to upsert the
// address book row should never abort the parent flow.

/** Card has finished generating successfully. Upsert the recipient
 *  name into the user's address book (no-op if a case-insensitive
 *  match exists). If the card has an occasion in its draft state,
 *  also insert/upsert an occasion row.
 *
 *  Called fire-and-forget from `generateStudioCard` after card status
 *  flips to 'completed'. */
export async function upsertAddressBookFromCard(cardId: number): Promise<void> {
  try {
    const cardRows = await db
      .select({
        userId: cards.userId,
        conversationData: cards.conversationData,
      })
      .from(cards)
      .where(eq(cards.id, cardId))
      .limit(1);
    const card = cardRows[0];
    if (!card?.userId) return;

    const state = (card.conversationData as CardDraftState | null) ?? null;
    const recipientName = state?.recipient?.name?.trim();
    if (!recipientName) return; // nothing to save

    const userId = card.userId;

    // Step 1: find or create the entry
    let entry = await findEntryByNameCI(userId, recipientName);
    if (!entry) {
      const [created] = await db
        .insert(addressBookEntries)
        .values({ userId, name: recipientName })
        .returning();
      entry = created;
    }

    // Step 2: ensure there's an occasion row matching the card's
    // occasion (if any). Dedup by (entryId, occasion) to avoid
    // multiplying Mum's "birthday" rows on every birthday card.
    const occasion = state?.recipient?.occasion?.trim();
    if (occasion && entry) {
      const existing = await db
        .select({ id: recipientOccasions.id })
        .from(recipientOccasions)
        .where(
          and(
            eq(recipientOccasions.addressBookEntryId, entry.id),
            eq(recipientOccasions.occasion, occasion),
          ),
        )
        .limit(1);
      if (existing.length === 0) {
        await db.insert(recipientOccasions).values({
          addressBookEntryId: entry.id,
          userId,
          occasion,
          // Date intentionally null on auto-save — the user told us
          // the occasion exists but we don't know the date yet.
          // Reminders page will prompt them to add it.
          date: null,
          yearSpecific: false,
        });
      }
    }
  } catch (err: any) {
    console.error(
      '[ADDRESS_BOOK] upsertAddressBookFromCard failed:',
      err?.message ?? err,
    );
  }
}

/** Paid order with a shipping address — backfill the address fields
 *  onto the matched address book entry. Looks up the recipient by
 *  name from the order's card. */
export async function backfillAddressFromOrder(orderId: string): Promise<void> {
  try {
    const orderRows = await db
      .select()
      .from(studioOrders)
      .where(eq(studioOrders.id, orderId))
      .limit(1);
    const order = orderRows[0];
    if (!order?.userId || !order.shippingAddress) return;

    const cardRows = await db
      .select({ conversationData: cards.conversationData })
      .from(cards)
      .where(eq(cards.id, order.cardId))
      .limit(1);
    const card = cardRows[0];
    if (!card) return;

    const state = (card.conversationData as CardDraftState | null) ?? null;
    const recipientName = state?.recipient?.name?.trim();
    if (!recipientName) return;

    const entry = await findEntryByNameCI(order.userId, recipientName);
    if (!entry) return; // upsertAddressBookFromCard should have created this

    // Only backfill when the entry doesn't already have an address —
    // don't overwrite a user-edited address with a stale checkout one.
    if (entry.address) return;

    await db
      .update(addressBookEntries)
      .set({
        address: order.shippingAddress as any,
        updatedAt: new Date(),
      })
      .where(eq(addressBookEntries.id, entry.id));
  } catch (err: any) {
    console.error(
      '[ADDRESS_BOOK] backfillAddressFromOrder failed:',
      err?.message ?? err,
    );
  }
}

// ── REST routes ──────────────────────────────────────────────────────

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const occIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  occId: z.coerce.number().int().positive(),
});

const updateEntrySchema = insertAddressBookEntrySchema.partial();

const createWithOccasionsSchema = insertAddressBookEntrySchema.extend({
  occasions: z.array(insertRecipientOccasionSchema.omit({ addressBookEntryId: true })).optional(),
});

export function registerAddressBookRoutes(app: Express): void {
  // GET /api/user/address-book — list all entries with their occasions
  app.get('/api/user/address-book', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
      const entries = await db
        .select()
        .from(addressBookEntries)
        .where(eq(addressBookEntries.userId, userId))
        .orderBy(desc(addressBookEntries.updatedAt));

      const hydrated = await Promise.all(entries.map(hydrateEntry));
      res.json(hydrated);
    } catch (err: any) {
      console.error('[ADDRESS_BOOK] list failed:', err);
      res.status(500).json({ message: 'Could not load address book' });
    }
  });

  // GET /api/user/address-book/search?q=mu — typeahead support
  // Case-insensitive prefix match on name. Max 8 results. Returns
  // entries WITHOUT occasions (typeahead doesn't need them — autofill
  // happens after the user picks an entry).
  app.get('/api/user/address-book/search', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    const q = String(req.query.q ?? '').trim();
    if (q.length < 1) return res.json([]);

    try {
      const entries = await db
        .select()
        .from(addressBookEntries)
        .where(
          and(
            eq(addressBookEntries.userId, userId),
            ilike(addressBookEntries.name, `${q}%`),
          ),
        )
        .orderBy(desc(addressBookEntries.updatedAt))
        .limit(8);
      res.json(entries);
    } catch (err: any) {
      console.error('[ADDRESS_BOOK] search failed:', err);
      res.status(500).json({ message: 'Search failed' });
    }
  });

  // GET /api/user/address-book/:id — single entry + occasions
  app.get(
    '/api/user/address-book/:id',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const parsed = idParamSchema.safeParse(req.params);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid id' });

      try {
        const rows = await db
          .select()
          .from(addressBookEntries)
          .where(
            and(
              eq(addressBookEntries.id, parsed.data.id),
              eq(addressBookEntries.userId, userId),
            ),
          )
          .limit(1);
        const entry = rows[0];
        if (!entry) return res.status(404).json({ message: 'Not found' });
        res.json(await hydrateEntry(entry));
      } catch (err: any) {
        console.error('[ADDRESS_BOOK] get failed:', err);
        res.status(500).json({ message: 'Could not load entry' });
      }
    },
  );

  // POST /api/user/address-book — manual create (with optional occasions)
  // ── POST /api/studio/cards/:id/save-for-later ───────────────────
  // Carina's feedback (2026-08-07): she'd made a card months before the
  // occasion and couldn't see how NOT to buy it immediately. The moment
  // someone defers is also the one moment they'll happily tell us WHEN
  // the occasion is -- so this sets the date on the occasion row that
  // card completion already auto-created (date null until now). A draft
  // with a date is a reminder with the card already made.
  app.post(
    '/api/studio/cards/:id/save-for-later',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });
      const cardId = parseInt(req.params.id, 10);
      if (!Number.isFinite(cardId)) {
        return res.status(400).json({ message: 'Invalid id' });
      }
      const rawDate = typeof req.body?.date === 'string' ? req.body.date.trim() : '';
      const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;

      try {
        const cardRows = await db
          .select({ userId: cards.userId, conversationData: cards.conversationData })
          .from(cards)
          .where(eq(cards.id, cardId))
          .limit(1);
        const card = cardRows[0];
        if (!card) return res.status(404).json({ message: 'Card not found' });
        if (card.userId !== userId) {
          return res.status(403).json({ message: 'Not your card' });
        }

        // No date given -> nothing to record; the save itself is implicit
        // (drafts always persist). Still a 200 so the client copy can say
        // "saved" honestly.
        if (!date) return res.json({ saved: true, dateSet: false });

        const state = (card.conversationData as CardDraftState | null) ?? null;
        const recipientName = state?.recipient?.name?.trim();
        const occasion = state?.recipient?.occasion?.trim() || 'other';
        if (!recipientName) return res.json({ saved: true, dateSet: false });

        let entry = await findEntryByNameCI(userId, recipientName);
        if (!entry) {
          const [created] = await db
            .insert(addressBookEntries)
            .values({ userId, name: recipientName })
            .returning();
          entry = created;
        }
        const existing = await db
          .select({ id: recipientOccasions.id, date: recipientOccasions.date })
          .from(recipientOccasions)
          .where(
            and(
              eq(recipientOccasions.addressBookEntryId, entry.id),
              eq(recipientOccasions.occasion, occasion),
            ),
          )
          .limit(1);
        if (existing.length === 0) {
          await db.insert(recipientOccasions).values({
            addressBookEntryId: entry.id,
            userId,
            occasion,
            date,
            yearSpecific: false,
          });
        } else {
          // They just told us the date -- newest information wins.
          await db
            .update(recipientOccasions)
            .set({ date })
            .where(eq(recipientOccasions.id, existing[0].id));
        }
        res.json({ saved: true, dateSet: true });
      } catch (err: any) {
        console.error('[ADDRESS_BOOK] save-for-later failed:', err?.message ?? err);
        res.status(500).json({ message: 'Could not save the date' });
      }
    },
  );

  app.post('/api/user/address-book', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    const parsed = createWithOccasionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid input',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const { occasions, ...entryData } = parsed.data;

      // Soft-block: case-insensitive name dedup. Return 409 with the
      // existing entry's id so the client can route to its edit page.
      const existing = await findEntryByNameCI(userId, entryData.name);
      if (existing) {
        return res.status(409).json({
          message: `You already have someone named ${entryData.name}.`,
          existingId: existing.id,
        });
      }

      const [created] = await db
        .insert(addressBookEntries)
        .values({ userId, ...entryData } as any)
        .returning();

      // Insert any occasions atomically-ish (best-effort; partial
      // failure here just leaves the entry without those occasions —
      // user can re-add).
      if (occasions && occasions.length > 0) {
        await db.insert(recipientOccasions).values(
          occasions.map((o) => ({
            addressBookEntryId: created.id,
            userId,
            occasion: o.occasion,
            date: o.date ?? null,
            yearSpecific: o.yearSpecific ?? false,
            notes: o.notes ?? null,
          })),
        );
      }

      res.status(201).json(await hydrateEntry(created));
    } catch (err: any) {
      console.error('[ADDRESS_BOOK] create failed:', err);
      res.status(500).json({ message: 'Could not create entry' });
    }
  });

  // PATCH /api/user/address-book/:id — update entry-level fields
  app.patch(
    '/api/user/address-book/:id',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const idParse = idParamSchema.safeParse(req.params);
      if (!idParse.success) return res.status(400).json({ message: 'Invalid id' });

      const bodyParse = updateEntrySchema.safeParse(req.body);
      if (!bodyParse.success) {
        return res.status(400).json({
          message: 'Invalid input',
          errors: bodyParse.error.flatten().fieldErrors,
        });
      }

      try {
        // If renaming, dedup-check against other entries.
        const updates = bodyParse.data;
        if (updates.name) {
          const existing = await findEntryByNameCI(userId, updates.name);
          if (existing && existing.id !== idParse.data.id) {
            return res.status(409).json({
              message: `You already have someone named ${updates.name}.`,
              existingId: existing.id,
            });
          }
        }

        const [updated] = await db
          .update(addressBookEntries)
          .set({ ...updates, updatedAt: new Date() } as any)
          .where(
            and(
              eq(addressBookEntries.id, idParse.data.id),
              eq(addressBookEntries.userId, userId),
            ),
          )
          .returning();

        if (!updated) return res.status(404).json({ message: 'Not found' });
        res.json(await hydrateEntry(updated));
      } catch (err: any) {
        console.error('[ADDRESS_BOOK] update failed:', err);
        res.status(500).json({ message: 'Could not update entry' });
      }
    },
  );

  // DELETE /api/user/address-book/:id — hard delete (cascade kills occasions)
  app.delete(
    '/api/user/address-book/:id',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const parsed = idParamSchema.safeParse(req.params);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid id' });

      try {
        const result = await db
          .delete(addressBookEntries)
          .where(
            and(
              eq(addressBookEntries.id, parsed.data.id),
              eq(addressBookEntries.userId, userId),
            ),
          )
          .returning({ id: addressBookEntries.id });

        if (result.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json({ ok: true });
      } catch (err: any) {
        console.error('[ADDRESS_BOOK] delete failed:', err);
        res.status(500).json({ message: 'Could not delete entry' });
      }
    },
  );

  // POST /api/user/address-book/:id/occasions — add an occasion
  app.post(
    '/api/user/address-book/:id/occasions',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const idParse = idParamSchema.safeParse(req.params);
      if (!idParse.success) return res.status(400).json({ message: 'Invalid id' });

      const bodyParse = insertRecipientOccasionSchema.safeParse(req.body);
      if (!bodyParse.success) {
        return res.status(400).json({
          message: 'Invalid input',
          errors: bodyParse.error.flatten().fieldErrors,
        });
      }

      try {
        // Verify the entry belongs to the caller before attaching.
        const entryRows = await db
          .select({ id: addressBookEntries.id })
          .from(addressBookEntries)
          .where(
            and(
              eq(addressBookEntries.id, idParse.data.id),
              eq(addressBookEntries.userId, userId),
            ),
          )
          .limit(1);
        if (entryRows.length === 0) return res.status(404).json({ message: 'Not found' });

        const [created] = await db
          .insert(recipientOccasions)
          .values({
            addressBookEntryId: idParse.data.id,
            userId,
            occasion: bodyParse.data.occasion,
            date: bodyParse.data.date ?? null,
            yearSpecific: bodyParse.data.yearSpecific ?? false,
            notes: bodyParse.data.notes ?? null,
            suppressedUntil: bodyParse.data.suppressedUntil ?? null,
          })
          .returning();

        res.status(201).json(created);
      } catch (err: any) {
        console.error('[ADDRESS_BOOK] add-occasion failed:', err);
        res.status(500).json({ message: 'Could not add occasion' });
      }
    },
  );

  // PATCH /api/user/address-book/:id/occasions/:occId — edit an occasion
  app.patch(
    '/api/user/address-book/:id/occasions/:occId',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const parsed = occIdParamSchema.safeParse(req.params);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid ids' });

      const bodyParse = insertRecipientOccasionSchema.partial().safeParse(req.body);
      if (!bodyParse.success) {
        return res.status(400).json({
          message: 'Invalid input',
          errors: bodyParse.error.flatten().fieldErrors,
        });
      }

      try {
        const updates: Record<string, any> = {
          updatedAt: new Date(),
        };
        if (bodyParse.data.occasion !== undefined) updates.occasion = bodyParse.data.occasion;
        if (bodyParse.data.date !== undefined) updates.date = bodyParse.data.date;
        if (bodyParse.data.yearSpecific !== undefined) updates.yearSpecific = bodyParse.data.yearSpecific;
        if (bodyParse.data.notes !== undefined) updates.notes = bodyParse.data.notes;
        if (bodyParse.data.suppressedUntil !== undefined) updates.suppressedUntil = bodyParse.data.suppressedUntil;

        const [updated] = await db
          .update(recipientOccasions)
          .set(updates)
          .where(
            and(
              eq(recipientOccasions.id, parsed.data.occId),
              eq(recipientOccasions.addressBookEntryId, parsed.data.id),
              eq(recipientOccasions.userId, userId),
            ),
          )
          .returning();

        if (!updated) return res.status(404).json({ message: 'Occasion not found' });
        res.json(updated);
      } catch (err: any) {
        console.error('[ADDRESS_BOOK] update-occasion failed:', err);
        res.status(500).json({ message: 'Could not update occasion' });
      }
    },
  );

  // DELETE /api/user/address-book/:id/occasions/:occId — remove an occasion
  app.delete(
    '/api/user/address-book/:id/occasions/:occId',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const parsed = occIdParamSchema.safeParse(req.params);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid ids' });

      try {
        const result = await db
          .delete(recipientOccasions)
          .where(
            and(
              eq(recipientOccasions.id, parsed.data.occId),
              eq(recipientOccasions.addressBookEntryId, parsed.data.id),
              eq(recipientOccasions.userId, userId),
            ),
          )
          .returning({ id: recipientOccasions.id });

        if (result.length === 0) return res.status(404).json({ message: 'Occasion not found' });
        res.json({ ok: true });
      } catch (err: any) {
        console.error('[ADDRESS_BOOK] delete-occasion failed:', err);
        res.status(500).json({ message: 'Could not delete occasion' });
      }
    },
  );
}

// Suppress unused-import warning — these are imported only for the
// type/helper side effects and tsc may not see them as "used" until
// consumers exist.
void isNotNull;
