// shared/models/card-draft.ts
//
// Shared type for a Studio card maker draft. The state lives in
// cards.conversation_data (jsonb) — loose on the DB side so we can
// evolve the form without migrations, strict here so client + server
// agree on shape.
//
// The client autosaves this blob on step transitions + field blur +
// keystroke debouncing (inside message only). The server accepts it
// verbatim on PATCH — the shape is the contract.

export type StyleMode = 'animated' | 'realistic' | 'custom';
export type InsideMode = 'generate' | 'write' | 'blank';

export interface CardDraftState {
  /** Schema version. Bumps force-migrate older drafts on read. */
  version: 1;
  /** Last step the user was on (0-indexed). Used for resume. */
  step: number;
  recipient?: {
    name?: string;
    occasion?: string;
  };
  scene?: {
    description?: string;
  };
  style?: {
    mode?: StyleMode;
    /** The user-typed custom style description (only when mode='custom'). */
    custom?: string;
  };
  photos?: {
    /** IDs from the user's photos library (see shared/models/photos.ts). */
    photoIds?: number[];
  };
  inside?: {
    mode?: InsideMode;
    /** User-written inside message (only when mode='write'). */
    text?: string;
  };
}

export const EMPTY_CARD_DRAFT: CardDraftState = {
  version: 1,
  step: 0,
};

/** The six customer-facing steps, in order. */
export const CARD_MAKER_STEPS = [
  { id: 'recipient', label: 'Recipient' },
  { id: 'scene', label: 'Scene' },
  { id: 'style', label: 'Style' },
  { id: 'photo', label: 'Photo' },
  { id: 'inside', label: 'Inside' },
  { id: 'review', label: 'Review' },
] as const;

export type StepId = (typeof CARD_MAKER_STEPS)[number]['id'];
