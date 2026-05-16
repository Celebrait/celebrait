import { pgTable, serial, integer, text, jsonb, timestamp, varchar, date, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

// ─────────────────────────────────────────────────────────────────────────────
// Address book — the user's recipient roster.
//
// Backbone of the dashboard's PEOPLE section + the retention loop. When
// a user makes a card for "Mum", we store her here with whatever the
// card knew. Future cards offer Mum as a typeahead in the recipient
// step. Occasions tied to her live in the sibling `recipient_occasions`
// table — the reminder system (Week 2 deliverable) cron-scans those
// dates to fire "Mum's birthday is in 3 weeks" emails.
//
// Auto-save semantics:
//   • A card transitioning to status='completed' upserts the recipient
//     name into the user's address book. No-op if a match
//     (case-insensitive by name) already exists. If the card has an
//     occasion+name pair, an occasion row is also inserted (date may
//     be null until the user fills it in).
//   • A paid printed order's shipping address upserts the address
//     fields onto the matched entry — printed = we know an address.
//   • All fields except `name` are optional. The book is permissive
//     on purpose: a user who only ever sends digital still gets a
//     roster of recipient names.
//
// Why occasions live in their own table (decision 2026-04-29):
//   • The reminder cron query becomes a fast indexed lookup
//     ("any occasions falling in the next 21 days?") instead of a
//     jsonb_array_elements full scan.
//   • Stable per-occasion IDs let the future reminder_log table FK
//     to specific occasions ("we sent T-21 for Mum's birthday on 15
//     May"). With jsonb arrays, identity-by-index is fragile under
//     reorder/delete.
//   • Suppression ("don't remind me about Mum's Christmas this year")
//     lives where it belongs — on the occasion row, not in a side
//     table indexed by array position.
// ─────────────────────────────────────────────────────────────────────────────

/** Postal address — kept loose because the print provider's accepted
 *  address shapes vary by country. Validate at fulfilment time, not at
 *  storage time. Empty / partial addresses are valid (digital-only
 *  recipients). */
export interface PostalAddress {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;       // state / province / county
  postcode?: string;
  country?: string;      // ISO-2 ideally, but free-form ok pre-launch
}

export const addressBookEntries = pgTable(
  "address_book_entries",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    // Display name. Required. Case-insensitive match key for auto-save
    // dedup. Users typically write affectionate names ("Mum", "Dad",
    // "Auntie Sue"); the system never tries to canonicalise.
    name: text("name").notNull(),

    // Optional relationship label — separate from name for cases where
    // name = "Sarah" and relationship = "Sister". Display-only; UI uses
    // this to render a subtitle below the name in lists.
    relationship: text("relationship"),

    // Contact channels — both optional. Email enables digital sends;
    // address enables printed sends. A recipient with neither is fine
    // (e.g. user just adding a name they plan to gift via the share
    // link they'll forward themselves).
    email: text("email"),
    phone: text("phone"),

    // Postal address as a structured blob. See PostalAddress above.
    // jsonb so we can evolve the shape without migrations; null when
    // the user hasn't supplied one yet.
    address: jsonb("address").$type<PostalAddress>(),

    // Free-form notes — gift preferences, dietary restrictions, in-jokes,
    // anything the user wants to remember. Sender-facing only; never
    // shown to the recipient.
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("address_book_user_id_idx").on(t.userId),
    // (userId, lower(name)) is the natural dedup key but Drizzle's
    // index helpers don't expose lower() expressions cleanly. Enforce
    // case-insensitive uniqueness in app code (storage layer).
  ],
);

export type AddressBookEntry = typeof addressBookEntries.$inferSelect;
export type InsertAddressBookEntry = typeof addressBookEntries.$inferInsert;

export const insertAddressBookEntrySchema = createInsertSchema(addressBookEntries, {
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
  relationship: z.string().trim().max(40).optional().nullable(),
  email: z.string().email('Enter a valid email').optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Recipient occasions — date-tied events attached to an address book entry.
//
// One row per (entry, occasion) pair. Multiple occasions per recipient is
// the common case (Mum has a birthday + Christmas + Mother's Day). Single
// occasions per row keeps the schema clean for indexing and reminder
// cron queries.
//
// `date` may be NULL — the user added "Mum's birthday" but hasn't told us
// when yet. The reminders page surfaces these as "add a date to enable
// reminders". Reminder cron skips nulls. Rows with date set are eligible
// for the cadence ladder (T-21 → T-7 → T-3 digital pivot → T+1).
//
// `year_specific` distinguishes recurring occasions (birthdays — year
// ignored, reminder fires on month/day) from one-off events (a specific
// wedding date — year matters, reminder fires once and the row becomes
// historical).
//
// `suppressed_until` lets the user say "don't remind me about Mum's
// Christmas this year" — set the date to "next-Jan-1" and the cron skips
// this occasion until then.
// ─────────────────────────────────────────────────────────────────────────────

export const recipientOccasions = pgTable(
  "recipient_occasions",
  {
    id: serial("id").primaryKey(),
    addressBookEntryId: integer("address_book_entry_id")
      .notNull()
      .references(() => addressBookEntries.id, { onDelete: "cascade" }),
    // Denormalised userId so the reminder cron can scope by user
    // without a join. Always equals addressBookEntries.userId.
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // The occasion type — 'birthday', 'anniversary', 'christmas',
    // 'mothers_day', 'valentines', 'thankyou', 'other'. Free-form;
    // canonical icons via getOccasionIcon().
    occasion: text("occasion").notNull(),

    // The date this occasion falls on. NULL when the user knows the
    // occasion exists but hasn't supplied a date yet — surfaced in
    // the reminders page as "add a date to enable reminders".
    date: date("date"),

    // True for one-off events where year matters (a specific wedding
    // date — reminder fires once, row becomes historical). False for
    // recurring (birthdays — reminder fires on month/day every year).
    yearSpecific: boolean("year_specific").default(false).notNull(),

    // Per-occasion suppression. When set, reminder cron skips this
    // occasion until this date passes. UX: "Skip Mum's Christmas
    // this year" → set to next-Jan-1, then the row goes live again.
    suppressedUntil: date("suppressed_until"),

    // Optional note — "her 60th — go big".
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("recipient_occasions_entry_id_idx").on(t.addressBookEntryId),
    // The cron's hot path: "find occasions falling in [now, now+N days]
    // for this user". Composite index on (userId, date) keeps it
    // index-only.
    index("recipient_occasions_user_date_idx").on(t.userId, t.date),
  ],
);

export type RecipientOccasionRow = typeof recipientOccasions.$inferSelect;
export type InsertRecipientOccasion = typeof recipientOccasions.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// Reminder log — tracks every reminder we've fired, so the daily cron
// never double-sends the same tier for the same occasion in the same year.
//
// One row per (occasion, tier, year) firing. The unique constraint on that
// triple is the dedup key — the cron uses INSERT ... ON CONFLICT DO NOTHING
// semantics in app code; if the row exists, the email doesn't fire.
//
// `emailSent` is a soft signal: even if the email transport failed, we
// still log the row so we don't retry the same tier indefinitely. The
// next tier (T-7 after T-21 fails) takes over naturally.
//
// `tier` enum is a free-text column with three valid values today; if we
// add T+1 follow-up later (V1.5), it slots in without migration.
// ─────────────────────────────────────────────────────────────────────────────

export const reminderLog = pgTable(
  "reminder_log",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    occasionId: integer("occasion_id")
      .notNull()
      .references(() => recipientOccasions.id, { onDelete: "cascade" }),
    /** 't_21' | 't_7' | 't_3' (V1). Future: 't_plus_1'. Free-text so
     *  new tiers don't require migration. */
    tier: text("tier").notNull(),
    /** Which year of the recurring occasion this fired for. Lets the
     *  cron fire fresh reminders next year without conflicting with
     *  the previous year's log entries. */
    year: integer("year").notNull(),
    emailSent: boolean("email_sent").notNull().default(false),
    /** Free-text reason when emailSent=false — Brevo error, etc.
     *  Nullable. Used for debugging deliverability issues. */
    failureReason: text("failure_reason"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (t) => [
    // Hot-path query: "have we already fired tier X for occasion Y in
    // year Z?" — supported by this composite index. Functions as the
    // dedup key in app code.
    index("reminder_log_dedup_idx").on(t.occasionId, t.tier, t.year),
    // Per-user listing for an admin debug page or future user-facing
    // "reminders I've sent" surface.
    index("reminder_log_user_idx").on(t.userId),
  ],
);

export type ReminderLogRow = typeof reminderLog.$inferSelect;
export type InsertReminderLog = typeof reminderLog.$inferInsert;

export const insertRecipientOccasionSchema = createInsertSchema(recipientOccasions, {
  occasion: z.string().trim().min(1, 'Occasion is required').max(40),
  // date arrives as 'YYYY-MM-DD' string; Drizzle's date column accepts
  // string. Allow null for "I don't know the date yet".
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').nullable().optional(),
  notes: z.string().trim().max(200).optional().nullable(),
  suppressedUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').nullable().optional(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
