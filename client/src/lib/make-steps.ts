// client/src/lib/make-steps.ts — "how far did they get?" on the
// three-card route, counted for /admin/maker (server/make-insights.ts).
//
// A step is a bare count: the step, the occasion, the set it belongs to
// and where the visit came from. No id, no cookie, nothing that follows
// a person between pages. Each step is sent once per page load (a
// re-render or a second tap must not count twice). Fire-and-forget:
// sendBeacon survives the page navigating away mid-send.
import { getFirstTouch } from '@/lib/attribution';

export type MakeStep = 'landed' | 'started' | 'questions' | 'drawn' | 'picked' | 'buy';

const sent = new Set<string>();

export function makeStep(step: MakeStep, o: { occasion?: string | null; setId?: string | null; detail?: string | null } = {}): void {
  const key = `${step}|${o.setId ?? ''}|${o.detail ?? ''}`;
  if (sent.has(key)) return;
  sent.add(key);
  try {
    const ft = getFirstTouch();
    const body = JSON.stringify({
      step, occasion: o.occasion ?? null, setId: o.setId ?? null, detail: o.detail ?? null,
      source: ft?.utmSource || ft?.referrerHost || null,
    });
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/make/step', blob)) {
      void fetch('/api/make/step', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* counting is never worth an error */ }
}
