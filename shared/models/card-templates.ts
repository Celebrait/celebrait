// shared/models/card-templates.ts
//
// The catalogue — templates Aidan saves from the Card Lab.
//
// WHY (SCOPE_OCCASION_FIRST, 2026-08-17): the occasion-first rebuild
// works by Aidan testing an occasion's dedicated prompt and KEEPING
// what he loves. Before this table, a great card lived only as a data
// URL in one browser tab and died on refresh — the testing loop threw
// away its own gold. A template is the full RECIPE plus the rendered
// front, so it can be re-rendered, re-priced, or sold as a fixed-front
// card with a personalised inside.
//
// Deliberately admin-curated only: rows are created from the Lab by
// the founder's taste, never by customers. When an occasion world goes
// live, its rack reads from here.

import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const cardTemplates = pgTable("card_templates", {
  id: serial("id").primaryKey(),
  /** Occasion world this belongs to — 'birthday' first. */
  occasion: text("occasion").notNull(),
  /** The angle/tone it was written as (wordplay/deadpan/proud/…). */
  angle: text("angle"),
  /** Who the test brief was for ("Dad", "my sister Kate") — a hint for
   *  rack filtering, not a hard constraint. */
  recipient: text("recipient"),
  /** The interest the card grew from — context for curation. */
  interest: text("interest"),
  front_text: text("front_text").notNull(),
  inside_text: text("inside_text"),
  palette: text("palette"),
  typeface: text("typeface"),
  format: text("format"),
  art_direction: text("art_direction"),
  /** Buyer-facing tone this was generated in (funny/warm/cheeky) —
   *  drives the coverage grid in the occasion studio. */
  tone: text("tone"),
  /** Stated age, when the brief carried a milestone. Null = ageless
   *  card, which is its own rack slot rather than missing data. */
  age: integer("age"),
  /** Stored image filename (R2 key / local stored_images name). */
  image_path: text("image_path").notNull(),
  created_at: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

export type CardTemplate = typeof cardTemplates.$inferSelect;
export type NewCardTemplate = typeof cardTemplates.$inferInsert;

// ── THE FEEDBACK LOOP ────────────────────────────────────────────────
// Aidan, 2026-08-17: "it's where we're trying to perfect the customer
// flow based on prompts, so how do we know what's working and to lock
// it in?"
//
// Nothing measured it. Keepers were saved with no record of WHICH
// prompt build produced them, and no denominator — so "did that change
// help?" was answerable only by memory, which is exactly the trap that
// caused the fatigue on the universal engine.
//
// Every card the studio generates lands here; keeping one flips kept.
// KEEP RATE PER BUILD is then the objective signal: 4 of 9 kept on one
// build against 1 of 9 on the next is a regression you can see rather
// than feel. The build stamp comes from RENDER_GIT_COMMIT, so it points
// at the exact prompt code that wrote the line.
export const cardGenerations = pgTable("card_generations", {
  id: serial("id").primaryKey(),
  /** Deploy that generated it — the prompt version, in practice. */
  build_commit: text("build_commit"),
  occasion: text("occasion").notNull(),
  tone: text("tone"),
  age: integer("age"),
  angle: text("angle"),
  recipient: text("recipient"),
  interest: text("interest"),
  front_text: text("front_text").notNull(),
  /** Did it earn a place in the rack? The whole point of the table. */
  kept: boolean("kept").notNull().default(false),
  created_at: timestamp("created_at").notNull().default(sql`now()`),
});

export type CardGeneration = typeof cardGenerations.$inferSelect;
