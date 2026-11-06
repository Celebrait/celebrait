// client/src/lib/rum.ts — one timing sample per page load (2026-09-08)
//
// Collects what the speed audit measured by hand — TTFB, DOM ready,
// load, LCP, CLS — and posts it once via sendBeacon when the page is
// hidden or unloaded (LCP is only final by then). Cookieless: a path and
// numbers. Skips admin + studio surfaces (they're not the shop floor).

const SKIP = /^\/(admin|studio|api)(\/|$)/;

export function startRum(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;
  if (SKIP.test(location.pathname)) return;
  const path = location.pathname;

  let lcp: number | null = null;
  let cls = 0;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) lcp = Math.round(e.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* unsupported */ }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceEntry[]) {
        const s = e as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!s.hadRecentInput && typeof s.value === 'number') cls += s.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* unsupported */ }

  let sent = false;
  const send = () => {
    if (sent) return;
    sent = true;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const r = (x: number | undefined) => (typeof x === 'number' && x > 0 ? Math.round(x) : null);
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? null;
    const body = JSON.stringify({
      path,
      ttfb: r(nav?.responseStart), dcl: r(nav?.domContentLoadedEventEnd), load: r(nav?.loadEventEnd),
      lcp, cls: Math.round(cls * 1000),
      device: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
      conn,
    });
    try {
      if (!navigator.sendBeacon || !navigator.sendBeacon('/api/rum', new Blob([body], { type: 'application/json' }))) {
        void fetch('/api/rum', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
      }
    } catch { /* never disturb the page */ }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(); });
  window.addEventListener('pagehide', send);
  // Long sessions on one page: don't wait forever for LCP to settle.
  window.setTimeout(send, 15_000);
}
