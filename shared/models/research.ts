// shared/models/research.ts
//
// F&F MARKET RESEARCH (Aidan, 2026-08-24): testers walk the real
// guided maker via a keyed link (no login), then answer six questions.
// One row per completed walk-through — the survey answers AND the
// behavioural record (brief, cards, pick, regen) together, because an
// answer next to the card it's about is the whole value of the tool.

import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const researchResponses = pgTable("research_responses", {
  id: serial("id").primaryKey(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  tester_name: text("tester_name"),
  /** What they typed: who/gender/age/vibe/interest/dislike/name. */
  brief: jsonb("brief"),
  /** The three concepts as shown: front_text, tone, angle. Texts only —
   *  the full images would bloat rows; the picked card's front is kept
   *  as a real stored image below. */
  cards: jsonb("cards"),
  picked_index: integer("picked_index"),
  regen_used: boolean("regen_used").notNull().default(false),
  picked_image_path: text("picked_image_path"),
  inside_image_path: text("inside_image_path"),
  /** The six survey answers, keyed by question id. */
  answers: jsonb("answers"),
});
