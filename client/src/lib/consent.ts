// client/src/lib/consent.ts — the advertising-cookie choice (2026-10-29).
//
// UK PECR / UK GDPR: the Meta Pixel is a non-essential tracker, so it may
// only load AFTER the visitor opts in, and saying no must be as easy as
// saying yes. This module is the single source of that choice; the
// banner (components/consent-banner.tsx) writes it and the pixel
// (lib/pixel.ts) reads it.
//
// Inert until the server injects a pixel id (env META_PIXEL_ID →
// window.__CELEBRAIT__.pixel, see shared/market.ts). No id = no banner,
// no script, no requests, and every helper here reports "not granted".

export const CONSENT_KEY = 'celebrait:consent:v1';
export type ConsentChoice = 'granted' | 'denied';
export interface ConsentRecord { choice: ConsentChoice; at: string }

const CHANGE_EVENT = 'celebrait:consent';
const OPEN_EVENT = 'celebrait:consent:open';

/** The configured Meta Pixel id, or undefined when ads tracking is off. */
export function pixelId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const v = window.__CELEBRAIT__?.pixel;
  return typeof v === 'string' && /^\d{5,20}$/.test(v) ? v : undefined;
}

export function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as Partial<ConsentRecord>;
    if (rec?.choice === 'granted' || rec?.choice === 'denied') {
      return { choice: rec.choice, at: typeof rec.at === 'string' ? rec.at : '' };
    }
  } catch {
    /* blocked storage or bad JSON: treat as no choice yet */
  }
  return null;
}

/** True only when a pixel is configured AND this visitor said yes. */
export function adConsentGranted(): boolean {
  return !!pixelId() && readConsent()?.choice === 'granted';
}

export function setConsent(choice: ConsentChoice): void {
  const rec: ConsentRecord = { choice, at: new Date().toISOString() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(rec));
  } catch {
    /* storage blocked: the choice holds for this page view only */
  }
  window.dispatchEvent(new CustomEvent<ConsentRecord>(CHANGE_EVENT, { detail: rec }));
}

export function onConsentChange(fn: (rec: ConsentRecord) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<ConsentRecord>).detail);
  window.addEventListener(CHANGE_EVENT, h);
  return () => window.removeEventListener(CHANGE_EVENT, h);
}

/** "Cookie settings": show the banner again so the choice can change. */
export function openConsentSettings(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onConsentSettingsOpen(fn: () => void): () => void {
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
}

function readCookie(name: string): string | undefined {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** What the checkout POST carries about ads: the consent state at the
 *  moment of paying, and (only when consented) Meta's own browser ids so
 *  the server-side Purchase can be matched and de-duplicated. Empty when
 *  no pixel is configured, so nothing is stored. */
export function adConsentPayload(): { adConsent?: boolean; fbp?: string; fbc?: string } {
  if (!pixelId()) return {};
  if (!adConsentGranted()) return { adConsent: false };
  const fbp = readCookie('_fbp');
  const fbc = readCookie('_fbc');
  return {
    adConsent: true,
    ...(fbp ? { fbp: fbp.slice(0, 200) } : {}),
    ...(fbc ? { fbc: fbc.slice(0, 500) } : {}),
  };
}
