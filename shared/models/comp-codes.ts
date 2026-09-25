// shared/models/comp-codes.ts
//
// Comp codes — the "this one's on us" lever.
//
// WHY: the influencer campaign promises creators a card AND free postage,
// but the free-first-card credit only zeroes the CARD (£8.99 → £0) and
// still charges £3.95 standard postage. Before this, honouring the offer
// meant letting the creator pay and refunding them by hand in Stripe:
// clumsy for them, forgettable for us, and it silently books £3.95 of
// revenue that was never really revenue.
//
// A comp code is issued by an admin, handed to one named person, and
// zeroes whichever lines it covers. Orders carry the code they were
// redeemed with (studio_orders.comp_code) so gifted cards can be told
// apart from real sales in the Cost Ledger and CRM — a gifted card is a
// marketing cost, not income, and mixing them corrupts the one feedback
// loop we have on pricing.
//
// Deliberately NOT a general discount system. No percentages, no
// site-wide sales, no stacking. One code, one named recipient, covers
// what it says it covers. If a real promo mechanic is ever needed it
// should be built separately rather than by growing this.

import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const compCodes = pgTable("comp_codes", {
  id: serial("id").primaryKey(),
  /** The code the recipient types. Stored and compared UPPERCASE — see
   *  normaliseCompCode. Short and unambiguous by construction (no O/0,
   *  no I/1) because these get read off a phone screen and retyped. */
  code: varchar("code", { length: 32 }).notNull().unique(),
  /** Who it went to, in plain words: "Laura Dove @fivelittledoves".
   *  This is the whole audit trail — without it a used code is a
   *  mystery six weeks later. */
  label: text("label").notNull(),
  /** Which lines this code zeroes. Shipping-only is the common case:
   *  the free-first-card credit already handles the card itself, so a
   *  creator with both ends up paying nothing. */
  coversShipping: boolean("covers_shipping").notNull().default(true),
  coversCard: boolean("covers_card").notNull().default(false),
  /** Redemption budget. Defaults to single-use — a code that leaks
   *  should cost us one card, not a run on the print account. */
  maxUses: integer("max_uses").notNull().default(1),
  /** Consumed on the PAID flip only, never at checkout-create, so an
   *  abandoned session can't burn someone's code. Mirrors how the
   *  free-card credit behaves (server/studio/free-card.ts). */
  uses: integer("uses").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export type CompCode = typeof compCodes.$inferSelect;

/** Codes are case- and space-insensitive at the door. People retype
 *  these off a screenshot; "laura-xmas" and "LAURA-XMAS " are the same
 *  code and rejecting one of them is a support ticket we don't need. */
export function normaliseCompCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toUpperCase();
  if (!v || v.length > 32) return null;
  return v;
}
