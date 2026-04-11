import { pgTable, serial, integer, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Lab — source of truth for image-generation prompts.
//
// Every prompt sent to an image model is rendered from a row in
// `prompt_templates`. Exactly one row per (slot, card_type) is considered
// "active" at any moment, via the `prompt_active` pointer table.
//
// This replaces hard-coding prompts in `shared/prompts.ts` and gives us:
//   - full version history per slot
//   - atomic rollback (flip the pointer row)
//   - auditability ("which prompt generated card X?")
//
// Phase 1 of the Prompt Lab. See PROMPT_LAB_PLAN.md §4 Phase 1.
// ─────────────────────────────────────────────────────────────────────────────

// Slot identifiers. Kept as loose strings in the DB so new slots can be added
// without a migration, but these constants are the canonical values.
export const PROMPT_SLOTS = {
  FRONT_SCENE: 'front_scene',   // photo-based front (primary flow)
  FRONT_TEXT: 'front_text',     // text-only front (no photo)
  INSIDE: 'inside',             // inside card
} as const;

export type PromptSlot = typeof PROMPT_SLOTS[keyof typeof PROMPT_SLOTS];

// A single variable declaration on a template, used by the admin UI to
// auto-generate test input forms and by the resolver for substitution.
export interface PromptVariable {
  name: string;                 // e.g. "scenePrompt"
  type: 'string' | 'boolean';   // kept narrow for v1; extend later
  required: boolean;
  default?: string | boolean;
  description?: string;
}

export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: serial("id").primaryKey(),
    slot: text("slot").notNull(),
    // null = default template for this slot (applies to every card type
    // unless an explicit override exists). Specific values: 'birthday',
    // 'anniversary', 'sympathy', etc. See PROMPT_LAB_PLAN.md §3.4.
    cardType: text("card_type"),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    templateText: text("template_text").notNull(),
    variables: jsonb("variables").$type<PromptVariable[]>().notNull().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by"),
  },
  (t) => [
    uniqueIndex("prompt_templates_slot_cardtype_version_uniq").on(
      t.slot,
      t.cardType,
      t.version,
    ),
  ],
);

// Pointer table: at most one active template per (slot, cardType).
// We deliberately model this as a separate table rather than an `is_active`
// column so that "activate version N" is a single UPSERT rather than a
// two-step (deactivate old, activate new) that can race.
export const promptActive = pgTable(
  "prompt_active",
  {
    slot: text("slot").notNull(),
    cardType: text("card_type").notNull().default(""), // "" sentinel = default; PKs can't be null
    activeTemplateId: integer("active_template_id")
      .notNull()
      .references(() => promptTemplates.id),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: text("updated_by"),
  },
  (t) => [
    uniqueIndex("prompt_active_slot_cardtype_uniq").on(t.slot, t.cardType),
  ],
);

export const insertPromptTemplateSchema = createInsertSchema(promptTemplates).pick({
  slot: true,
  cardType: true,
  name: true,
  version: true,
  templateText: true,
  variables: true,
  notes: true,
  createdBy: true,
});

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;
export type PromptActive = typeof promptActive.$inferSelect;
