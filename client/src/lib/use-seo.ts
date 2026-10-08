// client/src/lib/use-seo.ts
//
// Keeps document metadata in sync on SPA NAVIGATIONS. The server
// injects correct per-path metadata into the HTML for the first load
// (server/seo-inject.ts) — but once the SPA takes over, a client-side
// route change would otherwise leave the previous page's title/
// canonical in place. Same registry (shared/seo.ts) on both sides, so
// they can't drift.
import { useEffect } from 'react';
import { seoForPath, robotsForPath, SITE_ORIGIN } from '@shared/seo';

/** Reconcile `<meta name="robots">` with the path: set it for private /
 *  unknown pages, remove it otherwise. Exported so the not-found page
 *  can assert noindex for a bad id under a known prefix. */
export function setRobotsMeta(value: string | null) {
  let meta = document.querySelector('meta[name="robots"]');
  if (!value) { meta?.remove(); return; }
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'robots');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', value);
}

export function useSeo(path: string) {
  useEffect(() => {
    setRobotsMeta(robotsForPath(path));
    const seo = seoForPath(path);
    if (!seo) return;
    document.title = seo.title;

    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', seo.description);

    const canonical = document.querySelector('link[rel="canonical"]');
    const href = SITE_ORIGIN + (seo.path === '/' ? '/' : seo.path);
    if (canonical) canonical.setAttribute('href', href);
    else {
      const l = document.createElement('link');
      l.rel = 'canonical';
      l.href = href;
      document.head.appendChild(l);
    }
  }, [path]);
}
