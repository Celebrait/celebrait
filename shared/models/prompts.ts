import {
  pgTable,
  serial,
  bigserial,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
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
//
// `inside` was split into `inside_write` (text-bearing v1 template) and
// `inside_blank` (decorative-border v2 template for customers who'll
// handwrite) in Phase 4c. They're now genuinely different products — each
// can pick its own provider/quality — so the pointer rows are separate.
export const PROMPT_SLOTS = {
  FRONT_SCENE: 'front_scene',       // photo-based front (primary flow)
  FRONT_TEXT: 'front_text',         // text-only front (no photo)
  INSIDE_WRITE: 'inside_write',     // inside card — AI renders typed message
  INSIDE_BLANK: 'inside_blank',     // inside card — blank centre, decorated border only
} as const;

export type PromptSlot = typeof PROMPT_SLOTS[keyof typeof PROMPT_SLOTS];

// Variant identifiers. A variant is a per-slot sub-category that needs a
// genuinely different prompt (not just a conditional branch). Used for
// front_scene's photo modes today; can be extended to other slots later.
//
// null variant = the default template for the slot — applies whenever no
// variant-specific row exists (backwards compat with pre-split slots).
export const PROMPT_VARIANTS = {
  ONE_PERSON: 'one_person',
  MULTI_INDIVIDUAL: 'multi_individual',
  GROUP: 'group',
} as const;

export type PromptVariant = typeof PROMPT_VARIANTS[keyof typeof PROMPT_VARIANTS];

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
    // null = default template for this slot regardless of variant. Specific
    // values (front_scene only today): 'one_person' | 'multi_individual' |
    // 'group' — each is a genuinely different prompt, not a conditional
    // branch. See PROMPT_VARIANTS.
    variant: text("variant").$type<PromptVariant | null>(),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    templateText: text("template_text").notNull(),
    variables: jsonb("variables").$type<PromptVariable[]>().notNull().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by"),
  },
  (t) => [
    uniqueIndex("prompt_templates_slot_cardtype_variant_version_uniq").on(
      t.slot,
      t.cardType,
      t.variant,
      t.version,
    ),
  ],
);

// Provider + quality tier identifiers. Kept loose in the DB so we can add
// new providers without a migration; these TS unions are the canonical
// values — matches server/providers/registry.ts.
export type PromptProvider =
  | 'openai'
  | 'gemini'
  | 'gemini-flash'
  | 'gemini-flash-2-5'
  | 'flux';
export type PromptQuality = 'low' | 'medium' | 'high';

// Pointer table: at most one active template per (slot, cardType).
// We deliberately model this as a separate table rather than an `is_active`
// column so that "activate version N" is a single UPSERT rather than a
// two-step (deactivate old, activate new) that can race.
//
// The active row now carries the full production config, not just a template
// pointer. `provider` / `quality` / `vars` are nullable — null means "use
// the runtime fallback" (OpenAI + medium + empty vars). This keeps pre-Phase-4
// activations running unchanged until an admin deliberately sets them via
// the Production View (see admin-prompts.tsx).
export const promptActive = pgTable(
  "prompt_active",
  {
    slot: text("slot").notNull(),
    cardType: text("card_type").notNull().default(""), // "" sentinel = default; PKs can't be null
    // "" sentinel = default variant (applies whenever no variant-specific
    // row exists); specific values mirror PROMPT_VARIANTS. Separate pointer
    // per variant so activating `multi_individual` doesn't touch `one_person`.
    variant: text("variant").notNull().default(""),
    activeTemplateId: integer("active_template_id")
      .notNull()
      .references(() => promptTemplates.id),
    // Which image provider to route production generations through.
    // Null = runtime fallback. See server/providers/registry.ts for the
    // accepted identifiers.
    provider: text("provider").$type<PromptProvider>(),
    // Quality tier passed to the provider. Null = runtime fallback.
    // Providers that don't differentiate (Gemini/FLUX) accept only 'high'.
    quality: text("quality").$type<PromptQuality>(),
    // Slot-specific variable overrides that aren't the prompt text itself.
    // e.g. { textLayout: 'scene_integrated' } for front_scene. Merged into
    // the derived vars at render time; the template decides what to do with
    // them via {{#if ...}} conditionals.
    vars: jsonb("vars").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: text("updated_by"),
  },
  (t) => [
    uniqueIndex("prompt_active_slot_cardtype_variant_uniq").on(
      t.slot,
      t.cardType,
      t.variant,
    ),
  ],
);

// Per-generation audit log. Every call to a provider — production or lab —
// writes one row here. Minimal v1: enough to answer "which template
// generated card X?" and "what did we spend today?". Richer columns
// (safety category, token counts, rubric scores) can be added later per
// PROMPT_LAB_PLAN.md Phase 4 without breaking existing rows.
export const generationLog = pgTable(
  "generation_log",
  {
    id: bigserial("id", { mode: 'number' }).primaryKey(),
    // Null for lab-only test runs (no card). Populated for Studio/production
    // generations so we can trace "which run produced this card".
    cardId: integer("card_id"),
    slot: text("slot").notNull(),
    // Null if we fell back to the hardcoded shared/prompts.ts function
    // (no DB template active yet).
    templateId: integer("template_id"),
    templateVersion: integer("template_version"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    quality: text("quality"),
    // Cost in US cents, scaled ×100 to preserve sub-cent precision
    // (Gemini Pro: 13.4c → stored as 1340). Divide by 100 for display.
    costCentsX100: integer("cost_cents_x100").notNull(),
    durationMs: integer("duration_ms").notNull(),
    success: boolean("success").notNull(),
    // Structured error kind on failure: 'safety' | 'server' | 'timeout' |
    // 'provider_unavailable' | other. Null on success.
    errorCode: text("error_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("generation_log_card_id_idx").on(t.cardId),
    index("generation_log_created_at_idx").on(t.createdAt),
  ],
);

export const insertPromptTemplateSchema = createInsertSchema(promptTemplates).pick({
  slot: true,
  cardType: true,
  variant: true,
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
export type GenerationLog = typeof generationLog.$inferSelect;
export type InsertGenerationLog = typeof generationLog.$inferInsert;
