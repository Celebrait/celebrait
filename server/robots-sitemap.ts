// server/robots-sitemap.ts: robots.txt and sitemap.xml, rendered for the
// market this process sells in.
//
// These used to be static files in client/public with the co.uk origin
// baked in. With the market switch (shared/market.ts) the origin moves
// with MARKET, so both are rendered here and served by an Express route
// registered BEFORE the static handler. The static copies were deleted
// so there is one source of truth.

import { publicOrigin } from '@shared/market';
import { GALLERY_STORY_SEO } from '@shared/seo';

/** Public marketing pages only. Deliberately excluded: /studio + /admin +
 *  /checkout (auth-gated), /card/* and /c/* (private recipient links),
 *  /order/* (private by uuid), /login, and the internal stages
 *  (/card-capture, /og). /keeper is omitted as well: it's a design
 *  reference that duplicates /photo (noindexed, robots-disallowed).
 *  /door and /hero-poc were retired (301s). */
const SITEMAP_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/photo', changefreq: 'weekly', priority: '0.9' },
  { path: '/create', changefreq: 'weekly', priority: '0.9' },
  { path: '/gallery', changefreq: 'weekly', priority: '0.8' },
  { path: '/stories', changefreq: 'weekly', priority: '0.8' },
  ...GALLERY_STORY_SEO.map((st) => ({ path: `/stories/${st.slug}`, changefreq: 'monthly', priority: '0.7' })),
  { path: '/pricing', changefreq: 'monthly', priority: '0.8' },
  { path: '/contact', changefreq: 'yearly', priority: '0.5' },
  { path: '/blog', changefreq: 'weekly', priority: '0.7' },
  { path: '/blog/how-to-turn-a-photo-into-a-greeting-card', changefreq: 'monthly', priority: '0.6' },
  { path: '/blog/ai-generated-greeting-cards', changefreq: 'monthly', priority: '0.6' },
  { path: '/blog/personalised-birthday-card-ideas', changefreq: 'monthly', priority: '0.6' },
  { path: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms-of-service', changefreq: 'yearly', priority: '0.3' },
];

const hostOf = (origin: string) => origin.replace(/^https?:\/\//, '').replace(/^www\./, '');

export function renderRobotsTxt(origin: string = publicOrigin()): string {
  return `# ${hostOf(origin)}
# Everything except the API may be crawled. Private and internal pages
# (/studio, /admin, /checkout, /login, /c/ share links, /order/, /keeper,
# /card-capture, /og …) are kept out of search results by a real
# noindex — meta tag + X-Robots-Tag header, shared/seo.ts — NOT by a
# Disallow here. A Disallow stops Google fetching the page, so it never
# sees the noindex and lists the bare URL anyway ("Indexed, though
# blocked by robots.txt", Search Console 2026-11-09). Access control on
# the private pages is the auth gate and the share token, never this file.

User-agent: *

# API surface — JSON, nothing to index
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
`;
}

/** `makerEnabled` false (the three-card route parked, 2026-10-29) drops
 *  /create (noindexed, redirects to /photo) and /photo (then a duplicate
 *  of `/`, which renders it and is its canonical). */
export function renderSitemapXml(origin: string = publicOrigin(), makerEnabled = true): string {
  const pages = makerEnabled ? SITEMAP_PAGES : SITEMAP_PAGES.filter((p) => p.path !== '/create' && p.path !== '/photo');
  const urls = pages.map(
    (p) => `  <url>
    <loc>${origin}${p.path}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  ${hostOf(origin)} sitemap. Rendered by server/robots-sitemap.ts.
  Canonical host is www (the apex 301s to it), so every URL here is www.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
