// client/src/components/studio/narration-copy.ts
//
// Personalised beat builder for the Studio reveal narration.
//
// Each beat is a sequence of typed parts — plain text, the recipient's
// name, or a quoted user-supplied fragment — so the UI can style each
// part distinctly (name = brand violet italic, quotes = italic with
// curly punctuation, etc.). The alternative of passing a flat string
// with markup tokens got unwieldy fast.
//
// State-driven on purpose. "Reading every detail of Mum's face" beats
// "Reading every detail of the face" — and "Sketching '{scene}'" beats
// a generic "Sketching the scene" when we already have the user's
// scene description in hand.

import { getOccasionLabel } from './scene-presets';
import type { CardDraftState } from '@shared/schema';

export type BeatPart =
  | { kind: 'plain'; text: string }
  /** Recipient's name. Rendered in brand violet italic. */
  | { kind: 'name'; text: string }
  /** A user-supplied fragment rendered in italic with curly quotes. */
  | { kind: 'quote'; text: string }
  /** Subtle emphasis on a non-name word (e.g. occasion). */
  | { kind: 'em'; text: string };

export interface NarrationBeat {
  /** Stable id for keying + test selectors. */
  id: string;
  /** Human-readable label — not rendered; dev-only. */
  label: string;
  parts: BeatPart[];
}

const plain = (text: string): BeatPart => ({ kind: 'plain', text });
const name = (text: string): BeatPart => ({ kind: 'name', text });
const quote = (text: string): BeatPart => ({ kind: 'quote', text });
const em = (text: string): BeatPart => ({ kind: 'em', text });

/** Truncate a user quote so it doesn't swallow the typography. Tries
 *  to break at a comma or space near the limit so the tail doesn't feel
 *  chopped mid-word. */
function trimQuote(raw: string, max = 70): string {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastComma = cut.lastIndexOf(',');
  const lastSpace = cut.lastIndexOf(' ');
  const breakAt =
    lastComma > max - 20 ? lastComma : lastSpace > max - 15 ? lastSpace : max;
  return cut.slice(0, breakAt).trim() + '…';
}

function styleAdjective(state: CardDraftState): string | null {
  const mode = state.style?.mode;
  const custom = state.style?.custom?.trim();
  if (mode === 'animated') return 'warm, illustrated';
  if (mode === 'realistic') return 'cinematic';
  if (mode === 'custom' && custom) return custom.toLowerCase();
  return null;
}

/**
 * Build the six narration beats from the user's actual draft state.
 * Each beat references at least one real choice the user made — name
 * on every beat, occasion + scene + style + front text + inside treatment
 * in their respective beats.
 */
export function buildPersonalBeats(state: CardDraftState): NarrationBeat[] {
  const rawName = state.recipient?.name?.trim() || '';
  const theName = rawName || 'them';
  const hasName = rawName.length > 0;

  const occasionKey = state.recipient?.occasion?.trim();
  const occasionLabel =
    occasionKey && occasionKey !== 'other'
      ? getOccasionLabel(occasionKey).toLowerCase()
      : '';

  const photoMode = state.photos?.mode ?? 'one_person';
  const photoCount = state.photos?.photoIds?.length ?? 0;

  const sceneRaw = state.scene?.description?.trim() || '';
  const styleAdj = styleAdjective(state);
  const frontText = state.front?.text?.trim() || '';
  const insideMode = state.inside?.mode;
  const insideMessage = state.inside?.write?.message?.trim() || '';

  // ── Beat 1: opening — name + occasion ─────────────────────────────
  const opening: NarrationBeat = {
    id: 'opening',
    label: 'Opening',
    parts: occasionLabel
      ? hasName
        ? [plain('A '), em(occasionLabel), plain(' card for '), name(theName), plain('.')]
        : [plain('A '), em(occasionLabel), plain(' card, in the works.')]
      : hasName
        ? [plain('Making '), name(theName), plain("'s card.")]
        : [plain('Making your card.')],
  };

  // ── Beat 2: photo — mode-aware ────────────────────────────────────
  let photoParts: BeatPart[];
  if (photoMode === 'group') {
    photoParts = hasName
      ? [plain('Capturing everyone around '), name(theName), plain('.')]
      : [plain('Holding the whole group in frame.')];
  } else if (photoCount > 1) {
    photoParts = hasName
      ? [plain('Studying '), name(theName), plain(' from every angle.')]
      : [plain('Studying every angle of the photo.')];
  } else if (photoCount === 1) {
    photoParts = hasName
      ? [plain('Reading every detail of '), name(theName), plain("'s photograph.")]
      : [plain('Reading every detail of the photograph.')];
  } else {
    // No photo on the draft (rare today — step is required — but
    // future photo-skip path lands here).
    photoParts = [plain('Setting the stage.')];
  }
  const photo: NarrationBeat = { id: 'photo', label: 'Photo', parts: photoParts };

  // ── Beat 3: scene — quote the user's own words when we have them ─
  const scene: NarrationBeat = {
    id: 'scene',
    label: 'Scene',
    parts: sceneRaw
      ? [plain('Sketching '), quote(trimQuote(sceneRaw)), plain('.')]
      : hasName
        ? [plain('Composing the world around '), name(theName), plain('.')]
        : [plain('Composing the scene.')],
  };

  // ── Beat 4: style — adjective from mode or custom text ────────────
  const style: NarrationBeat = {
    id: 'style',
    label: 'Style',
    parts: styleAdj
      ? [plain('Bringing it to life — '), em(styleAdj), plain('.')]
      : [plain('Tuning palette and texture.')],
  };

  // ── Beat 5: front text — quote the user's override when set ──────
  const front: NarrationBeat = {
    id: 'frontText',
    label: 'Front text',
    parts: frontText
      ? [plain('Setting '), quote(trimQuote(frontText, 40)), plain(' into the scene.')]
      : hasName
        ? [plain('Shaping the words for '), name(theName), plain("'s front.")]
        : [plain('Shaping the words for the front.')],
  };

  // ── Beat 6: inside — mode + message aware ─────────────────────────
  let insideParts: BeatPart[];
  if (insideMode === 'blank') {
    insideParts = [plain('Leaving the inside blank — for your own pen.')];
  } else if (insideMessage) {
    insideParts = hasName
      ? [plain('Writing your words for '), name(theName), plain(' to read.')]
      : [plain('Writing your words on the inside.')];
  } else {
    insideParts = hasName
      ? [plain('Composing the inside for '), name(theName), plain('.')]
      : [plain('Composing the inside.')];
  }
  const inside: NarrationBeat = { id: 'inside', label: 'Inside', parts: insideParts };

  return [opening, photo, scene, style, front, inside];
}

/** The "ready" line, shown once generation completes and held while the
 *  card crossfades in. Personalised with the recipient's name when set. */
export function buildReadyBeat(state: CardDraftState): NarrationBeat {
  const rawName = state.recipient?.name?.trim() || '';
  return {
    id: 'ready',
    label: 'Ready',
    parts: rawName
      ? [name(rawName), plain("'s card has arrived.")]
      : [plain('Your card has arrived.')],
  };
}
