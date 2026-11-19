// shared/models/demo.ts
//
// DEMO RUNS (Aidan 2026-09-15): every /demo run that reaches "It's on
// the way" saves what it made — the brief, the hook line, the three
// concepts and fronts, the photo and the cameo, the inside, and the
// timestamped beats — so a run can be turned into a produced social
// video (marketing/hyperframes/demo-run) instead of a screen recording.
// Created at boot by ensureLaunchColumns (CREATE TABLE IF NOT EXISTS),
// so prod needs no manual push.

import { pgTable, serial, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const demoRuns = pgTable("demo_runs", {
  id: serial("id").primaryKey(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** "Mum, 70 · Birthday" — what the list shows. */
  label: text("label"),
  /** APPROVED FOR RE-USE (Aidan 2026-09-25: "only use what we generate
   *  in there and approve as re-usable"). A run saves itself the moment
   *  it finishes, which makes the table a record of everything — takes
   *  that went wrong included. The replay pickers only offer runs that
   *  have been looked at and ticked on /admin/demo-runs. */
  approved: boolean("approved").notNull().default(false),
  /** Which door made it: 'cards' (three options) or 'photo' (photo
   *  first). Each replay picker only offers its own. Null on the four
   *  runs saved before the column existed. */
  route: text("route"),
  /** Historic: 'auto' (the director) or 'manual'. The director was
   *  removed on 2026-09-24, so every new run is hand-driven. */
  mode: text("mode"),
  /** The Brief as answered: who/gender/occasion/age/vibe/thing/cant/name/front. */
  brief: jsonb("brief"),
  hook_line: text("hook_line"),
  /** The three concepts as written (front_text, inside_text, palette…). */
  concepts: jsonb("concepts"),
  /** Stored image names, in order, for the three fronts. */
  front_paths: jsonb("front_paths"),
  picked_index: integer("picked_index"),
  /** The photo that went in (a real person — admin eyes only) and the cameo it produced. */
  photo_path: text("photo_path"),
  cameo_path: text("cameo_path"),
  inside_path: text("inside_path"),
  /** Dear / message / From as typed. */
  words: jsonb("words"),
  /** [{ name, t }] — ms from the start of the run. */
  beats: jsonb("beats"),
});
