// client/src/lib/pixel.ts — the Meta Pixel, consent-first (2026-10-29).
//
// Meta's ad optimisation needs conversion events; UK PECR says the pixel
// may only load after opt-in. So fbevents.js is fetched ONLY once the
// visitor has granted consent (lib/consent.ts), immediately on grant,
// never before. Without a configured pixel id this whole module is a
// no-op: no script, no cookie, no request.
//
// Events:
//   PageView        first load + every SPA navigation (path change)
//   ViewContent     landing on /photo or /photo/make
//   Lead            an account was created (auth-form, Google callback)
//   InitiateCheckout  the pay button hands the customer to the gateway
//   Purchase        the order page sees the order paid; eventID
//                   'order-<id>' matches the server-side Conversions API
//                   event (server/meta-capi.ts) so Meta counts it once.

import {
  adConsentGranted,
  onConsentChange,
  pixelId,
} from '@/lib/consent';

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
const VIEW_CONTENT_PATHS = new Set(['/photo', '/photo/make']);

let started = false;
let loaded = false;
let revoked = false;
let lastPath = '';
// fbclid from the ad click, held IN MEMORY only (never stored before
// consent). fbevents.js reads it from the URL when it loads; if the
// visitor accepts after navigating away, we set _fbc from this instead.
let bootFbclid: string | null = null;

function fbq(...args: unknown[]): void {
  window.fbq?.(...args);
}

function hasCookie(name: string): boolean {
  return new RegExp(`(?:^|; )${name}=`).test(document.cookie);
}

/** Meta's base snippet, unminified: a queueing stub, then the script. */
function injectScript(): void {
  if (!window.fbq) {
    const n = function (this: unknown, ...args: unknown[]) {
      if (n.callMethod) n.callMethod(...args);
      else n.queue.push(args);
    } as unknown as Fbq;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    window.fbq = n;
    if (!window._fbq) window._fbq = n;
  }
  const s = document.createElement('script');
  s.async = true;
  s.src = SCRIPT_SRC;
  // An ad blocker refusing the script is fine: the stub swallows calls.
  s.onerror = () => console.info('[pixel] fbevents.js did not load');
  document.head.appendChild(s);
}

function pageView(): void {
  const path = window.location.pathname;
  if (path === lastPath) return;
  lastPath = path;
  fbq('track', 'PageView');
  if (VIEW_CONTENT_PATHS.has(path.replace(/\/+$/, '') || '/')) {
    fbq('track', 'ViewContent', { content_name: path === '/photo' ? 'photo card page' : 'photo card maker' });
  }
}

function load(): void {
  const id = pixelId();
  if (!id) return;
  if (loaded) {
    if (revoked) { fbq('consent', 'grant'); revoked = false; }
    return;
  }
  loaded = true;
  injectScript();
  if (bootFbclid && !hasCookie('_fbc') && !new URLSearchParams(window.location.search).has('fbclid')) {
    const v = `fb.1.${Date.now()}.${bootFbclid}`;
    document.cookie = `_fbc=${encodeURIComponent(v)}; path=/; max-age=${90 * 86400}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }
  fbq('init', id);
  pageView();
  // wouter patches pushState/replaceState to fire these events.
  const onNav = () => { if (!revoked) pageView(); };
  for (const ev of ['popstate', 'pushState', 'replaceState']) window.addEventListener(ev, onNav);
}

function clearMetaCookies(): void {
  const host = window.location.hostname;
  const parts = host.split('.');
  const domains = [''];
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; domain=.${parts.slice(i).join('.')}`);
  for (const name of ['_fbp', '_fbc']) {
    for (const d of domains) document.cookie = `${name}=; path=/; max-age=0${d}`;
  }
}

function revoke(): void {
  if (loaded && !revoked) fbq('consent', 'revoke');
  revoked = true;
  clearMetaCookies();
}

/** Called once from main.tsx. Inert without a pixel id. */
export function initPixel(): void {
  if (started || !pixelId()) return;
  started = true;
  try {
    bootFbclid = new URLSearchParams(window.location.search).get('fbclid');
  } catch { /* ignore */ }
  if (adConsentGranted()) load();
  onConsentChange((rec) => {
    if (rec.choice === 'granted') load();
    else revoke();
  });
  // Google sign-up lands back with ?new_account=1 (server/replit_
  // integrations/auth/google-oauth.ts). Count it, then tidy the URL.
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('new_account') === '1') {
      track('Lead', { content_name: 'account' });
      url.searchParams.delete('new_account');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  } catch { /* ignore */ }
}

/** Fire a standard event. No-ops without a pixel or without consent. */
export function track(event: string, params?: Record<string, unknown>, eventId?: string): void {
  if (!adConsentGranted() || revoked) return;
  if (!loaded) load();
  if (eventId) fbq('track', event, params ?? {}, { eventID: eventId });
  else fbq('track', event, params ?? {});
}

/** A beat for a just-fired event to leave before a full-page navigation
 *  (the gateway redirect). Instant when the pixel isn't running. */
export function pixelFlush(ms = 300): Promise<void> {
  if (!loaded || revoked || !adConsentGranted()) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

/** Purchase, once per order per browser. Value in major units. Zero-value
 *  (fully comped) orders are gifts, not sales, so they are not reported. */
export function trackPurchase(orderId: string, minor: number, currency: string): void {
  if (!adConsentGranted() || !orderId || !(minor > 0)) return;
  const key = `celebrait:pixel:purchase:${orderId}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch { /* storage blocked: Meta still de-duplicates on eventID */ }
  track('Purchase', { value: Math.round(minor) / 100, currency }, `order-${orderId}`);
}
