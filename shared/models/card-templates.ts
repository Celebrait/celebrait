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
  /** Optional upper bound making `age` a RANGE (Aidan, 2026-08-22, on
   *  a YES/NO-list card: "could be anyone over 30 tbh"). age=30 +
   *  age_max=80 shelves the card in every milestone aisle from 30 to
   *  80 and matches any typed age between. Null = exact age as ever. */
  age_max: integer("age_max"),
  /** 'him' | 'her' | null. THE ONE CATALOGUE AXIS WE CANNOT DERIVE.
   *
   *  Milestone and audience band both fall out of `age`, so they need
   *  no columns. Gender does not — the brief carries it, the writer now
   *  obeys it, and this row was throwing it away. "For Her" and "For
   *  Him" are two of the market's top-level birthday aisles (Moonpig
   *  lists them first, ahead of Mum and Dad), so without this the shop
   *  cannot shelve its own stock the way every competitor does.
   *  Null means the brief said nothing, which is a real state and NOT a
   *  gap: those cards work for anyone and belong in every aisle. */
  gender: text("gender"),
  /** May the customer replace the front words?
   *
   *  Aidan, 2026-08-20: "every card doesn't need to have the capability
   *  to have someone else's words on… others just simply stock."
   *
   *  This corrects a real curation error. The Keep test told him to
   *  discard anything that wouldn't survive a stranger's words, which
   *  quietly threw away a whole product: the card that IS one perfect
   *  line. Those are the funniest things the engine makes and the rack's
   *  best sellers — they just sell FIXED, exactly as written, the way
   *  every card on a real shop's wall does.
   *
   *  So editability is a property of the card, not a gate on keeping it.
   *  True = artwork carries it, words are a slot the customer fills.
   *  False = the words ARE the card; the shop offers the inside only.
   *  Defaults true, which is right for the 46 kept before this existed:
   *  they were all curated under the survives-other-words bar. */
  editable: boolean("editable").notNull().default(true),
  /** On the public shelf? Keep = on the rack; this is the pull-it-off
   *  switch (Aidan, 2026-08-22: the builder→live-stock path needs
   *  curation control). Defaults TRUE — the rack has always meant "what
   *  this occasion's world will sell", and the existing stock was
   *  curated under that meaning; hiding is the exception, per card. */
  published: boolean("published").notNull().default(true),
  /** EXTRA aisles, beyond what age/tone/recipient derive — slugs like
   *  'for-mum', 'for-nan'. A card can overlap categories (his ask);
   *  tags UNION with the derived slicing, never replace it. */
  aisle_tags: text("aisle_tags").array().notNull().default(sql`'{}'::text[]`),
  /** Stored image filename (R2 key / local stored_images name). */
  image_path: text("image_path").notNull(),
  /** The PRE-MADE INSIDE (Aidan, 2026-08-22: "we can have all the
   *  cards on the front end catalogue pre-made, no generation
   *  required, and they can open like 3d cards do"). The card's own
   *  message rendered as designed typography, no Dear/From — the
   *  display asset and the no-personalisation order asset. Orders
   *  that add Dear/From re-render once at purchase. Null = not yet
   *  prepared; the product page falls back to the flat ajar view. */
  inside_image_path: text("inside_image_path"),
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
  /** ⚠️ THE MOTIF, logged so it can be AVOIDED next time. The exclusion
   *  list only ever held front_text, so words never repeated but PICTURES
   *  repeated freely — four poodle sets produced two prize rosettes and
   *  nobody could have known, because a set only ever sees itself
   *  (Aidan's dog run, 2026-08-19). On a rack that is the difference
   *  between a range and the same card twice, and it is invisible one
   *  set at a time, which is exactly the class of failure this table
   *  exists to catch. */
  art_direction: text("art_direction"),
  /** ⚠️ THE PALETTE, logged so it can be AVOIDED next time — the exact
   *  sibling of art_direction above, and added for the same reason one
   *  step later. Once the archetype started choosing colour from the
   *  subject, an identical brief produced an identical colour world:
   *  three separate blank warm-30 runs came back navy-and-oat, navy-and-
   *  oat, navy-and-oat (Aidan, spotting it before it reached his rack:
   *  "Does this now mean that every 30 warm card is gonna be paper-white
   *  · deep smoky-blue · mid olive?"). Words had memory, motifs had
   *  memory, colour had none. */
  palette: text("palette"),
  /** 'dealt' | 'free' — which composition mode made it (Aidan,
   *  2026-08-21: "I like both... so can we bed this in so it alternates
   *  between the 2"). The alternation is a STANDING A/B: without this
   *  column, keep-rate can never say which mode earns its keeps. */
  comp_mode: text("comp_mode"),
  /** Did it earn a place in the rack? The whole point of the table. */
  kept: boolean("kept").notNull().default(false),
  created_at: timestamp("created_at").notNull().default(sql`now()`),
});

export type CardGeneration = typeof cardGenerations.$inferSelect;
