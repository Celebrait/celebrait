// client/src/lib/use-seo.ts
//
// Keeps document metadata in sync on SPA NAVIGATIONS. The server
// injects correct per-path metadata into the HTML for the first load
// (server/seo-inject.ts) — but once the SPA takes over, a client-side
// route change would otherwise leave the previous page's title/
// canonical in place. Same registry (shared/seo.ts) on both sides, so
// they can't drift.
import { useEffect } from 'react';
import { seoForPath, SITE_ORIGIN } from '@shared/seo';

export function useSeo(path: string) {
  useEffect(() => {
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
