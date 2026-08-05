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
// Front-text mode mirrors InsideMode: either the user wants a headline
// rendered on the front of the card ('write' — the default and ~99% of
// cases) or they explicitly want NO text at all so the scene speaks for
// itself ('none'). Absence of `mode` is treated as 'write' for back-compat
// with drafts created before this field existed (2026-04-27).
export type FrontMode = 'write' | 'none';

// Photo-mode on the Studio photo step. Only two modes are exposed to
// users today — `multi_individual` (N separate photos, one per person)
// stays behind in the Prompt Lab until we're confident the output is
// reliable. See front_scene variant templates for the prompt differences.
export type PhotoMode = 'one_person' | 'group';

export interface CardDraftState {
  /** Schema version. Bumps force-migrate older drafts on read. */
  version: 1;
  /** Last step the user was on (0-indexed). Used for resume. */
  step: number;
  /** Set when this draft was created by "Start again with these
   *  details" (POST /drafts/:id/duplicate, 2026-07-08) — the id of the
   *  card it was cloned from. Drives the Review step's "take two"
   *  framing + the reference link back to the first take. Absent on
   *  organically-created drafts. */
  rerollOfCardId?: number;
  /** The take-FAMILY this card belongs to: the id of the family's
   *  original card, propagated through every Start-again clone (a
   *  clone of a clone keeps the same family id). Groups takes in the
   *  dashboard + powers the takes rail on the card view. Absent =
   *  the card is its own family. */
  rerollFamilyId?: number;
  recipient?: {
    name?: string;
    occasion?: string;
  };
  scene?: {
    description?: string;
    /** How this description was produced (analytics — Aidan 2026-08-04:
     *  "would be great to see how scenes are described, manual or using
     *  scene suggestion / brainstorm"). '*_edited' means they adopted a
     *  helper's text and then changed it, which is the most interesting
     *  signal of all: the helper started them off but didn't finish. */
    source?:
      | 'manual'
      | 'suggestion'
      | 'suggestion_edited'
      | 'brainstorm'
      | 'brainstorm_edited';
  };
  style?: {
    mode?: StyleMode;
    /** The user-typed custom style description (only when mode='custom'). */
    custom?: string;
  };
  photos?: {
    /** Which photo-mode the user picked on the Studio photo step.
     *  `one_person` = 1–5 photos of the same individual (different angles
     *    for better likeness anchoring).
     *  `group` = exactly 1 photo that already contains multiple people.
     *  Absent/undefined = legacy draft that predates the toggle; callers
     *  should default to `one_person`. */
    mode?: PhotoMode;
    /** IDs from the user's photos library (see shared/models/photos.ts).
     *  `one_person` may hold up to 5; `group` exactly 1. */
    photoIds?: number[];
    /** Set when client-side face detection disagrees with the chosen
     *  mode — e.g. "Just them" selected but the uploaded photo has 2+
     *  faces, or "Group photo" selected but only 1 face detected.
     *  Cleared when the user either switches mode or explicitly keeps
     *  the current mode. Gates advancing to the next step until the
     *  user resolves it, so we never silently render a mismatched card. */
    pendingModeReview?: 'too-many' | 'too-few';
    /** User explicitly chose to continue past a BLOCKING photo-quality
     *  verdict (heavy blur — see lib/photo-likeness). Deliberate act,
     *  not a default: the red state holds Next until they either swap
     *  the photo or set this. Dropped automatically whenever the photos
     *  patch is rebuilt without it (i.e. any photo change re-arms the
     *  block), which is the behaviour we want. */
    qualityOverride?: boolean;
  };
  front?: {
    /** Whether the user wants a front headline at all.
     *  - 'write' (or absent): render either the user's text, or — if blank —
     *    the auto-derived default (e.g. "Happy Birthday Dad").
     *  - 'none': explicit opt-out. Server skips text rendering entirely so
     *    the scene image stands alone. Mirrors `inside.mode = 'blank'`. */
    mode?: FrontMode;
    /** The short headline printed on the card front (e.g. "Happy Birthday Dad").
     *  When empty/absent (and mode !== 'none'), the server falls back to an
     *  auto-derived phrase from recipient name + occasion. Ignored when
     *  mode === 'none'. */
    text?: string;
  };
  /** The Giving Moment choice — format + destination — captured on the
   *  dedicated post-reveal screen (see next_delivery_destination_usp.md).
   *  Written by the Giving Moment, read by checkout. Absent until the
   *  user reaches and completes that screen.
   *
   *  (An earlier `intent` sub-field, from a reverted 2026-05-18 Step-1
   *  experiment, has been replaced by this shape.) */
  delivery?: {
    /** Product format. Values mirror checkout's ?product= param
     *  ('print' not 'printed') so the handoff needs no mapping. */
    format?: 'digital' | 'print' | 'both';
    /** Where it goes:
     *   'recipient' → posted / emailed straight to the recipient.
     *   'sender'    → posted / sent to the sender — to hand over in
     *                 person, or (when inside.mode is 'blank') to
     *                 handwrite first then give.
     *  The hand-over vs handwrite nuance is derivable from inside.mode,
     *  so it is NOT stored separately here. */
    destination?: 'recipient' | 'sender';
    /** Optional short "from…" note printed on the envelope insert for
     *  direct-to-recipient orders. */
    fromLine?: string;
  };
  inside?: {
    mode?: InsideMode;
    /** UX path declaration — added 2026-05-17 with the macro composer.
     *  Independent of `mode` (which is write vs blank).
     *    - 'self'    → user chose to write themselves. The 3-input form
     *                  is shown directly with per-field rewriter chips.
     *    - 'helped'  → user chose AI composition. A composer drawer is
     *                  the entry point; once a result is accepted the
     *                  same 3-input form is shown pre-filled, fully
     *                  editable. Re-opening "Try another version" stays
     *                  on the helped path.
     *    - undefined → pre-question is shown so the user picks. Default
     *                  state for any draft created before this field
     *                  existed OR any fresh draft.
     *  Persisting the choice avoids re-asking on every step revisit.
     *  Cleared by a small "Change approach" link on either path that
     *  surfaces the pre-question again. */
    path?: 'self' | 'helped';
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

/** The six customer-facing steps, in order. Photo moved to step 2 (was
 *  step 4) so users see their photo acknowledged early in the flow —
 *  the emotional click of "we've got Mum" happens before the blank
 *  scene description, not after.
 *
 *  Front text step (added 2026-04-19) sits between Scene and Inside so
 *  the two sides of the card — front headline and interior message —
 *  are decided in order.
 *
 *  Style step REMOVED 2026-05-17 — V1 locks to the "warm illustrated"
 *  default which lands consistently and is what Kevin signed off as
 *  the launch render. Choose-your-style (realistic / custom freeform)
 *  is parked under Celebrait Premium — see next_celebrait_premium.md.
 *  The style-step.tsx file is preserved in the repo for revival.
 *  Schema fields state.style.mode / state.style.custom also stay in
 *  card-draft.ts so server defaults + future Premium revival are
 *  unchanged. */
export const CARD_MAKER_STEPS = [
  { id: 'recipient', label: 'Recipient' },
  { id: 'photo', label: 'Photo' },
  { id: 'scene', label: 'Scene' },
  { id: 'front', label: 'Front text' },
  { id: 'inside', label: 'Inside text' },
  // 'send', not 'purchase' — the chip is visible from step 1 and framed
  // the whole creative flow as a transaction (audit 2026-07-27); it also
  // clashed with the reveal CTA "Send this card".
  { id: 'review', label: 'Review & send' },
] as const;

export type StepId = (typeof CARD_MAKER_STEPS)[number]['id'];

/** The fallback phrase printed on the card front when the user hasn't
 *  typed their own. Client-side FrontStep pre-fills with this so the
 *  user can confirm-and-continue; server uses the same helper as the
 *  final fallback when state.front.text is absent.
 *
 *  Occasion-aware: blindly prefixing "Happy " to every occasion produced
 *  "Happy baby Kayla" (Kevin's test 2026-04-26). Each occasion gets a
 *  phrase that reads like an actual card. Returns '' if we can't form
 *  anything reasonable — the front-scene prompt's `includeText` flag
 *  gates rendering on non-empty output.
 *
 *  Users can always edit on the Front step; this is just a sensible
 *  default so the card isn't blank by default. */
export function deriveDefaultFrontText(state: CardDraftState): string {
  const name = state.recipient?.name?.trim();
  const occasion = state.recipient?.occasion?.trim();
  if (!name || !occasion) return '';

  switch (occasion) {
    case 'birthday':
      return `Happy Birthday, ${name}`;
    case 'anniversary':
      return `Happy Anniversary, ${name}`;
    case 'wedding':
    case 'graduation':
    case 'engagement':
      return `Congratulations, ${name}`;
    case 'baby':
      return `Welcome, ${name}`;
    case 'christmas':
      return `Merry Christmas, ${name}`;
    case 'valentines':
      return `Happy Valentine's Day, ${name}`;
    case 'thankyou':
      return `Thank you, ${name}`;
    case 'sympathy':
      return `Thinking of you, ${name}`;
    case 'other':
      return name;
    default:
      // Future occasion that wasn't added here — fall back to just
      // the name rather than risk producing "Happy ${unknown} ${name}"
      // nonsense.
      return name;
  }
}
