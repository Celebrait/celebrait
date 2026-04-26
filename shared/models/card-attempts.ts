// shared/models/card-attempts.ts
//
// Per-side image attempts for a card. Every time a user regenerates
// the front or inside, a new row lands here. The `cards` table holds
// pointers to the *currently selected* attempt per side
// (cards.selectedFrontAttemptId / selectedInsideAttemptId), so the
// existing checkout / share / fulfilment paths read the right image
// without knowing this table exists.
//
// Why a separate table (rather than columns on cards):
//   • A card can have N attempts per side; cards-as-flat would force
//     us to either cap the count in the schema or pile JSON columns.
//   • Switching which version is "live" becomes a single FK update
//     rather than column shuffling.
//   • Generation logs (cost telemetry) are NOT user-facing history —
//     this table is the user-visible "your three tries on the front".
//
// Per-side numbering: attempt_number is per (card_id, side), so a
// card with 3 front regens + 1 inside regen has rows
//   (card=1, side='front', n=1..3), (card=1, side='inside', n=1).
//
// Status:
//   'generating' — kicked off, image not ready yet (rare to see in
//                  selected state — promotion happens on completion)
//   'completed'  — image_url populated, eligible for selection
//   'failed'     — generation errored; not surfaced in the versions
//                  strip but kept for cost/debug audit

import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const cardAttempts = pgTable(
  'card_attempts',
  {
    id: serial('id').primaryKey(),
    cardId: integer('card_id').notNull(),
    /** 'front' | 'inside'. Loose text on the DB so a future third
     *  side (envelope?) doesn't need a migration. */
    side: text('side').notNull(),
    /** Sequential per (card_id, side). attempt #1 is the original
     *  generation; #2+ are regens. */
    attemptNumber: integer('attempt_number').notNull(),
    /** Optional user tweak that drove this attempt (regen-with-edit).
     *  Null for the original generation and for pure regens. Stored
     *  for audit + future "restore my last tweak" UX. */
    tweak: text('tweak'),
    /** Final image URL the client renders. May be a /images/{path}
     *  URL or a direct provider-hosted URL on legacy/edge cases. */
    imageUrl: text('image_url'),
    /** Stored-file relative path. Mirrors cards.frontImagePath /
     *  insideImagePath conventions. The grid resolver prefers path
     *  → /images/{path} and falls back to imageUrl. */
    imagePath: text('image_path'),
    /** Print-ready file path (front only — printed cards are produced
     *  from this). Null for inside attempts and for digital-only. */
    printReadyPath: text('print_ready_path'),
    status: text('status').notNull().default('generating'),
    /** Structured error code on failure: 'safety' | 'server' |
     *  'timeout' | 'provider_unavailable' | other. Null on success. */
    errorCode: text('error_code'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    // One attempt-number per (card, side) — guards against double-
    // submit producing duplicate #2s.
    uniqueIndex('card_attempts_card_side_n_uniq').on(
      t.cardId,
      t.side,
      t.attemptNumber,
    ),
    index('card_attempts_card_id_idx').on(t.cardId),
  ],
);

export type CardAttempt = typeof cardAttempts.$inferSelect;
export type InsertCardAttempt = typeof cardAttempts.$inferInsert;

export type CardSide = 'front' | 'inside';

/** Slim projection sent to the client for the versions strip.
 *  Failed attempts are filtered out server-side before this shape
 *  reaches the wire. */
export interface CardAttemptListItem {
  id: number;
  side: CardSide;
  attemptNumber: number;
  imageUrl: string;
  /** True if this attempt is the one currently displayed on the card
   *  (cards.selectedFrontAttemptId / selectedInsideAttemptId). */
  isSelected: boolean;
  createdAt: Date;
}
