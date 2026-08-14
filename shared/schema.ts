import { pgTable, text, serial, integer, boolean, timestamp, jsonb, json, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
export * from "./models/prompts";
export * from "./models/photos";
export * from "./models/card-draft";
export * from "./models/studio-orders";
export * from "./models/card-attempts";
export * from "./models/address-book";
export * from "./models/analytics";
export * from "./models/comp-codes";

import { users } from "./models/auth";

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  parentCardId: integer("parent_card_id"),
  cardType: text("card_type").notNull().default('printed'),
  printOption: text("print_option").default('front-and-inside'),
  sceneType: text("scene_type").notNull(),
  conversationData: jsonb("conversation_data"),
  frontImageUrl: text("front_image_url"),
  insideImageUrl: text("inside_image_url"),
  frontImagePath: text("front_image_path"),
  insideImagePath: text("inside_image_path"),
  printReadyPath: text("print_ready_path"),
  status: text("status").default('generating'),
  price: integer("price").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  /** Public share token. Lazily generated when an order is placed
   *  with the digital add-on, OR when the sender explicitly hits
   *  Share. Used by recipients to view the card via the public
   *  /api/card/:id/view?t=TOKEN endpoint without auth. Null = card
   *  has never been shared. */
  viewToken: text("view_token"),
  /** Stable random secret woven into this card's image object keys
   *  (card_<id>_<imageKey>_front.png). Makes the public-bucket keys
   *  UNGUESSABLE so the sequential card id can't be used to enumerate
   *  everyone's artwork (security audit 2026-07-02). Distinct from
   *  viewToken: minted once at card creation and NEVER rotated (rotating
   *  it would orphan the stored image URLs). Nullable for legacy rows —
   *  the filename helper falls back to the old card_<id>_ naming when
   *  absent. */
  imageKey: text("image_key"),
  /** Pointer to the currently-displayed attempt for each side.
   *  See models/card-attempts.ts. The frontImageUrl/insideImageUrl
   *  columns above are kept in sync with the selected attempt's image
   *  so that checkout / share / fulfilment continue to read from
   *  cards directly (unaware of attempts). Null until first
   *  generation completes; populated thereafter. */
  selectedFrontAttemptId: integer("selected_front_attempt_id"),
  selectedInsideAttemptId: integer("selected_inside_attempt_id"),
  /** Drop-off recovery email cadence (Comms PR2 → expanded 2026-05-10
   *  to 3-touch sequence). Each stamp gates its own email — once set,
   *  that email never fires again. Independent gates so the cron can
   *  catch up if it missed days.
   *
   *  Cadence (per `recovery/dispatcher.ts`):
   *    T+24h  → dropoffEmailSentAt    — gentle "still waiting" reminder
   *    T+4d   → tweakEmailSentAt      — "want to tweak it?" — invites
   *                                      iteration, takes pressure off
   *                                      the buy
   *    T+10d  → lastCallEmailSentAt   — soft urgency, "after this we'll
   *                                      stop emailing about it"
   *
   *  After the last-call email, silence — the card stays in the user's
   *  gallery but we don't keep nudging. Self-terminating cadence. */
  dropoffEmailSentAt: timestamp("dropoff_email_sent_at"),
  tweakEmailSentAt: timestamp("tweak_email_sent_at"),
  lastCallEmailSentAt: timestamp("last_call_email_sent_at"),

  /** Stamped the first time we surface a "your card is ready"
   *  in-app notification to the sender — toast on a non-Studio page,
   *  sidebar badge on dashboard, or the card-view mount itself.
   *  NULL = still unseen / unread.
   *
   *  Independent of `dropoffEmailSentAt` & co: the email cadence is
   *  about re-engaging a user who hasn't bought yet; this is about
   *  the one-shot "your generation finished, here's the reveal"
   *  moment. Both can fire for the same card.
   *
   *  Added 2026-05-13 alongside `/api/studio/notifications/*`. */
  notifiedAt: timestamp("notified_at"),

  // ── Failure metadata (Studio Safety UX, 2026-05-09) ──────────────
  // Populated when generateStudioCard catches a ProviderError. Lets
  // <GenerationErrorPanel> render kind-specific copy + suggestions
  // instead of the old generic "didn't land" view. All null when
  // status != 'failed'; cleared on retry (status → 'draft').
  // See server/providers/errors.ts for the kind/code semantics.
  failureKind: text("failure_kind"), // 'safety' | 'rate' | 'server' | 'auth' | 'unknown'
  failureMessage: text("failure_message"), // human-friendly summary
  failureModelExplanation: text("failure_model_explanation"), // raw from provider
  failureProvider: text("failure_provider"), // e.g. 'openai', 'gemini-flash-2-5'
  failureCode: text("failure_code"), // e.g. 'moderation_blocked'
  failureSuggestions: jsonb("failure_suggestions").$type<string[]>(), // static per kind
  failureAt: timestamp("failure_at"), // when the failure was persisted
}, (t) => [
  // Hot paths (audit 2026-07-27): the dashboard grid + the 30s
  // notifications poll both filter on user_id (+ created_at ordering),
  // and the drop-off cron + stale sweeper scan by status. The table had
  // ZERO indexes — every one of those was a sequential scan.
  index("cards_user_id_created_at_idx").on(t.userId, t.createdAt),
  index("cards_status_idx").on(t.status),
]);

// Lightweight lead capture — recipients of a digital card who aren't
// ready to make one on arrival ("email me a link for later", Kevin
// 2026-07-08). No auth, no account: just an email + where it came
// from. Nurture flows come later; today we send ONE immediate
// "here's your link" email at capture time.
export const marketingLeads = pgTable("marketing_leads", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  source: text("source").notNull(),
  cardId: integer("card_id"),
  /** Explicit tick for contact beyond the single link email —
   *  GDPR-clean opt-in, default false. */
  marketingOptIn: boolean("marketing_opt_in").default(false),
  /** Occasion capture (Keeper LP, 2026-07-08): who the next occasion
   *  is for + when. BOTH optional — the capture works as a plain
   *  email-only lead when skipped. A date makes the lead nudgeable:
   *  post-launch, a scheduled job emails a card idea ahead of it. */
  recipientName: text("recipient_name"),
  occasionDate: text("occasion_date"),
  /** Optional celebration type on a reminder lead (Birthday / Anniversary /
   *  …), captured 2026-07-22 so the post-launch nudge can lead with the
   *  right occasion. Nullable — plain leads and dateless reminders leave it
   *  null. ⚠️ needs: ALTER TABLE marketing_leads ADD COLUMN IF NOT EXISTS
   *  occasion_type text; */
  occasionType: text("occasion_type"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cards.id),
  userId: varchar("user_id").references(() => users.id),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  amount: integer("amount").notNull(),
  baseAmount: integer("base_amount").notNull().default(0),
  tipAmount: integer("tip_amount").notNull().default(0),
  currency: text("currency").notNull().default("ZAR"),
  paymentReference: text("payment_reference").notNull().unique(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  orderStatus: text("order_status").notNull().default("processing"),
  orderType: text("order_type").notNull().default("regular"),
  shippingAddress: json("shipping_address"),
  recipientInfo: text("recipient_info"),
  trackingNumber: text("tracking_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertCardSchema = createInsertSchema(cards).pick({
  cardType: true,
  printOption: true,
  sceneType: true,
  conversationData: true,
  price: true,
});

export const insertOrderSchema = createInsertSchema(orders).pick({
  cardId: true,
  userId: true,
  customerEmail: true,
  customerName: true,
  customerPhone: true,
  amount: true,
  baseAmount: true,
  tipAmount: true,
  currency: true,
  paymentReference: true,
  paymentStatus: true,
  orderStatus: true,
  orderType: true,
  shippingAddress: true,
  trackingNumber: true,
});

export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cards.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Slim projection used by the Studio grid. Historical cards stored
// multi-MB base64 blobs in frontImageUrl, insideImageUrl AND nested
// inside conversationData (as photo_upload / frontImageUrl keys).
// Pulling any of those for a full listing blew past Neon's 64MB
// response cap. The grid query plucks only the scalar fields the tile
// actually needs — no jsonb payloads, no image bytes.
export type CardGridItem = {
  id: number;
  userId: string | null;
  status: string | null;
  cardType: string | null;
  createdAt: Date | null;
  recipientName: string | null;
  occasion: string | null;
  frontImageUrl: string | null;
  /** Take-family id (the family's original card id) when this card
   *  was made via Start-again — null for standalone cards. Use
   *  familyKey() in studio-card-buckets, not this field directly. */
  rerollFamilyId: number | null;
  /** True if the card has at least one paid Studio order. Drives the
   *  Ready vs Sent bucket split in the dashboard — a completed card
   *  without a paid order is "ready to send"; one with is "sent". */
  hasPaidOrder: boolean;
  /** Last step the user was on in the card maker (0-indexed per
   *  CARD_MAKER_STEPS). Nullable on legacy rows. Used by the Home
   *  Drafts column to show a "Step X of 6 · Label" progress cue on
   *  draft rows. */
  draftStep: number | null;
  /** True when the card is completed and the sender hasn't yet
   *  acknowledged the "your card is ready" in-app notification.
   *  Drives the subtle "Just finished" treatment on the Ready
   *  dashboard tile. Flips to false once the user opens the card
   *  view or dismisses the toast. Always false on drafts, sent
   *  cards, or anything with a non-null notifiedAt. */
  isJustFinished: boolean;
};
