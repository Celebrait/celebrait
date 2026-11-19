// client/src/lib/made-cards.ts — THE CARDS THIS BROWSER HAS MADE
//
// Aidan 2026-11-19: "if a user creates a card but wants to maybe try
// create another one, front end it needs to save the one they did in case
// they wanna retrieve it."
//
// Until now a finished three-card card lived only in the page's memory
// until the maker pressed Buy or Keep. "Make another", a closed tab or the
// back button threw it away. Now /make saves every finished card the
// moment it is finished (POST /api/make/cards, the same row Buy and Keep
// mint) and remembers it HERE, in this browser, so it can be opened again
// from /make or /create without an account.
//
// What is kept is small on purpose: the card's id, the token that proves
// a guest owns it, and the two PUBLIC image addresses the save returned.
// Never the drawings themselves (they are megabytes each and would blow
// localStorage) and never the photo.
//
// Signed-in makers also get the card in their studio, because the saved
// row is theirs. This list is what a guest has instead, and it is only as
// durable as the browser: private windows and cleared site data lose it.

export interface MadeCard {
  cardId: number;
  /** Proves a guest owns the card (the rack's token pattern). */
  cardToken: string;
  /** Public image addresses returned by the save. */
  front: string;
  inside: string | null;
  /** The front's words, for alt text. */
  frontText: string;
  /** "Dad", "Linda", "your partner": who it was made for, as shown. */
  who: string;
  occasion: string;
  /** The brief as the URL carried it, so the questions can be restored. */
  search: string;
  /** When it was saved (ms). */
  at: number;
}

const KEY = 'celebrait:made-cards:v1';
/** A dozen is plenty for one browser; older ones are in the studio or gone. */
const MAX = 12;

export function readMadeCards(): MadeCard[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list.filter((c): c is MadeCard =>
      !!c && typeof c === 'object' && Number.isInteger((c as MadeCard).cardId)
      && typeof (c as MadeCard).cardToken === 'string' && typeof (c as MadeCard).front === 'string');
  } catch {
    return []; // storage blocked or unreadable: no list, the page still works
  }
}

function write(list: MadeCard[]): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* storage full or blocked */ }
  // Same-tab listeners (the 'storage' event only fires in OTHER tabs).
  try { window.dispatchEvent(new Event(MADE_CARDS_EVENT)); } catch { /* no window */ }
}

export const MADE_CARDS_EVENT = 'celebrait:made-cards';

/** Newest first; saving the same card again replaces its entry. */
export function rememberMadeCard(card: MadeCard): void {
  write([card, ...readMadeCards().filter((c) => c.cardId !== card.cardId)]);
}

export function forgetMadeCard(cardId: number): void {
  write(readMadeCards().filter((c) => c.cardId !== cardId));
}

/** The card a link asked for (`/make?card=<id>`), if this browser made it. */
export function madeCardFromSearch(search: string): MadeCard | null {
  const id = Number(new URLSearchParams(search).get('card'));
  if (!Number.isInteger(id) || id <= 0) return null;
  return readMadeCards().find((c) => c.cardId === id) ?? null;
}
