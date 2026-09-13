// client/src/lib/attribution.ts
//
// FIRST-TOUCH attribution: on the first ever page view, remember where
// this person came from (UTM params + referrer + landing path) in
// localStorage. At signup, the stored value rides along with the OTP
// verify call and is written to users.attribution — turning "40 visits
// from sophie's story" into "…and this signup was one of them".
//
// First-touch (not last-touch) is deliberate: for a product people
// discover socially and buy later, the interesting question is what
// INTRODUCED them, not what they clicked last. The value is written
// once and never overwritten.
//
// Not PII: it describes the visit, not the person. It only ever leaves
// the browser attached to an account the user is creating themselves.
import type { Attribution } from '@shared/schema';

const KEY = 'celebrait:first-touch:v1';

/** Capture on app boot. No-op if a first touch is already stored. */
export function captureFirstTouch(): void {
  try {
    if (localStorage.getItem(KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const ref = document.referrer;
    let referrerHost: string | undefined;
    if (ref) {
      try {
        const host = new URL(ref).hostname.replace(/^www\./, '');
        if (!host.endsWith('celebrait.co.uk') && host !== 'localhost') {
          referrerHost = host;
        }
      } catch {
        /* unparseable referrer */
      }
    }
    const attribution: Attribution = {
      utmSource: params.get('utm_source') ?? undefined,
      utmMedium: params.get('utm_medium') ?? undefined,
      utmCampaign: params.get('utm_campaign') ?? undefined,
      referrerHost,
      landingPath: window.location.pathname,
      firstTouchAt: new Date().toISOString(),
    };
    // Store even when everything's empty (direct visit): "direct" is
    // itself an answer, and storing marks first-touch as captured so a
    // later UTM'd visit can't overwrite the true origin.
    localStorage.setItem(KEY, JSON.stringify(attribution));
  } catch {
    /* storage unavailable (private mode etc.) — attribution is optional */
  }
}

export function getFirstTouch(): Attribution | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}
