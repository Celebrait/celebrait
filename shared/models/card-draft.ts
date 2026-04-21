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
export type InsideMode = 'write' | 'blank';

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
  front?: {
    /** The short headline printed on the card front (e.g. "Happy Birthday Dad").
     *  When empty/absent, the server falls back to an auto-derived phrase from
     *  recipient name + occasion. Absence of the field is valid — the user
     *  can leave the default. */
    text?: string;
  };
  inside?: {
    mode?: InsideMode;
    /** Only present when mode='write'. All three fields are optional —
     *  only `message` gates readiness (salutation + signoff are decoration).
     *  Concatenated into the v1 `insideText` prompt variable at generate time. */
    write?: {
      salutation?: string;
      message?: string;
      signoff?: string;
    };
  };
}

export const EMPTY_CARD_DRAFT: CardDraftState = {
  version: 1,
  step: 0,
};

/** The seven customer-facing steps, in order. Photo moved to step 2 (was
 *  step 4) so users see their photo acknowledged early in the flow —
 *  the emotional click of "we've got Mum" happens before the blank
 *  scene description, not after. Analysis of the photo is deferred to
 *  a later sprint; this sprint just does upload + crop + confirmation.
 *
 *  Front text step (added 2026-04-19) sits between Style and Inside so
 *  the two sides of the card — front headline and interior message —
 *  are decided in order. Server has always supported cardText; the
 *  Studio now lets the user see and override the auto-derived default
 *  instead of it silently rendering. */
export const CARD_MAKER_STEPS = [
  { id: 'recipient', label: 'Recipient' },
  { id: 'photo', label: 'Photo' },
  { id: 'scene', label: 'Scene' },
  { id: 'style', label: 'Style' },
  { id: 'front', label: 'Front text' },
  { id: 'inside', label: 'Inside text' },
  { id: 'review', label: 'Review & Purchase' },
] as const;

export type StepId = (typeof CARD_MAKER_STEPS)[number]['id'];

/** The fallback phrase printed on the card front when the user hasn't
 *  typed their own. Client-side FrontStep pre-fills with this so the
 *  user can confirm-and-continue; server uses the same helper as the
 *  final fallback when state.front.text is absent.
 *  e.g. "Happy Birthday Sarah". Returns '' if we can't form a reasonable
 *  phrase — the front-scene prompt's `includeText` flag gates rendering
 *  on non-empty output. */
export function deriveDefaultFrontText(state: CardDraftState): string {
  const name = state.recipient?.name?.trim();
  const occasion = state.recipient?.occasion?.trim();
  if (!name || !occasion) return '';
  if (occasion === 'other') return name;
  const occasionTitle = occasion.charAt(0).toUpperCase() + occasion.slice(1);
  return `Happy ${occasionTitle} ${name}`;
}
