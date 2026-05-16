import { pgTable, serial, integer, text, jsonb, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

// ─────────────────────────────────────────────────────────────────────────────
// User-owned photo library.
//
// When a customer uploads a reference photo in the Studio card maker, we
// keep it in their account so they can reuse it across future cards.
// Each upload stores the original plus an optional cropped derivative
// (cropping is forced in the UI — it materially improves likeness by
// giving the image model more face pixels after downscaling).
//
// Files live on disk under stored_images/photos/{userId}/. Paths in this
// table are relative to that root so storage can be remapped later
// (e.g. to cloud storage) without a schema change.
// ─────────────────────────────────────────────────────────────────────────────

export interface CropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const photos = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    // Filename as uploaded by the user. Display-only — never trust it for
    // filesystem paths.
    originalFilename: text("original_filename").notNull(),

    // Path to the original, full-resolution upload (relative to stored_images/).
    storagePath: text("storage_path").notNull(),

    // Path to the cropped derivative used at generation time. Null if the
    // user hasn't cropped yet. When non-null, providers receive this file
    // rather than the original.
    croppedStoragePath: text("cropped_storage_path"),

    // The crop rectangle relative to the original, so re-crops don't need
    // a re-upload and the UI can show an overlay.
    cropBounds: jsonb("crop_bounds").$type<CropBounds>(),

    // Small library thumbnail (square, ~400px) used in the photo picker UI.
    thumbnailPath: text("thumbnail_path").notNull(),

    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),

    // Optional user-provided label ("Mum", "Dad", "Grandma"). Makes the
    // library browsable when a user has many photos.
    label: text("label"),

    // ── Vision analysis (added 2026-05-14) ─────────────────────────────
    // A minimal LLM-derived summary of what's in the photo. Captured in
    // the background after upload so the inside-text helper can ground
    // its message suggestions in what the photos actually show (rather
    // than relying on the recipient name alone).
    //
    // Deliberately narrow: ONE downstream consumer today (the inside-
    // text helper). Brainstorm + scene flows do not read these fields
    // pre-launch — they use the photoMode hint we already pass through.
    //
    // Privacy note: descriptions are generic visual ("two adults
    // smiling in a kitchen"), never identifying ("Sarah Smith and
    // her husband"). The prompt for analyzePhoto enforces this.
    //
    /** How many people the vision model counted (0 = no people,
     *  1 = solo, 2+ = group). Null = analysis pending or failed. */
    personCount: integer("person_count"),
    /** Short visual summary (~25–60 words). Composition + mood + setting.
     *  Generic only, no identifying language. */
    visualSummary: text("visual_summary"),
    /** When the analysis ran (null = pending; non-null = done, whether
     *  successful or not — we don't retry to avoid LLM cost loops). */
    analyzedAt: timestamp("analyzed_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("photos_user_id_idx").on(t.userId),
  ],
);

export const insertPhotoSchema = createInsertSchema(photos).pick({
  userId: true,
  originalFilename: true,
  storagePath: true,
  croppedStoragePath: true,
  cropBounds: true,
  thumbnailPath: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  label: true,
});

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
