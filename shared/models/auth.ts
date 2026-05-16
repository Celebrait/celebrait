import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// Historically this lived behind Replit Auth; since 2026-04 the only
// supported login path is the OTP (email code) flow in
// server/replit_integrations/auth/routes.ts. The `is_admin` column drives
// back-office access — flip it via scripts/make-admin.ts.
//
// `portraitPhotoId` (added 2026-04-28) points at the user's portrait
// photo in the photos library. Captured at first Studio visit alongside
// firstName per `next_sender_photo_on_signup.md`. Used in:
//   • the From: line + signed credit on the back of every card the
//     user makes
//   • the "From me to you" photo mode (sender-in-photo) once that ships
// Nullable: legacy users + users who skip the capture flow fall back to
// the plain "Made with Celebrait" wordmark on card backs.
//
// NB: deliberately a plain integer column (not a Drizzle .references())
// to avoid a circular import with photos.ts — photos already references
// users, so the inverse FK has to be plain. Application-level integrity
// check is sufficient since this column is set/cleared only via the
// capture flow.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  portraitPhotoId: integer("portrait_photo_id"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// OTP codes table for email-based authentication
export const otpCodes = pgTable("otp_codes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: varchar("email").notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: text("used").default("false"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type OtpCode = typeof otpCodes.$inferSelect;
