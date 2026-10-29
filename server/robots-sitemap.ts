// server/robots-sitemap.ts: robots.txt and sitemap.xml, rendered for the
// market this process sells in.
//
// These used to be static files in client/public with the co.uk origin
// baked in. With the market switch (shared/market.ts) the origin moves
// with MARKET, so both are rendered here and served by an Express route
// registered BEFORE the static handler. The static copies were deleted
// so there is one source of truth.

import { publicOrigin } from '@shared/market';

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
# Public marketing pages are crawlable; everything operational, personal
# or internal is not. Note Disallow is a CRAWL instruction, not access
# control — the real protection on /studio, /admin and /checkout is the
# auth gate. This just keeps them out of search results.

User-agent: *

# Signed-in product surfaces (auth-gated; nothing to index)
Disallow: /studio
Disallow: /admin
Disallow: /checkout
Disallow: /login

# Recipient card links — these are private, token-gated moments between
# two people. They must never appear in a search result. (/c/ is the
# short share form; both also carry noindex.)
Disallow: /card/
Disallow: /c/

# Orders are private by uuid
Disallow: /order/

# Design reference only — an alias of /photo, noindexed as well
Disallow: /keeper

# Internal tooling + asset stages (unlisted, not for humans arriving cold)
# (/hero-poc and /door now 301 home / to /create, so they're not listed —
# a Disallow would stop crawlers from seeing the redirect.)
Disallow: /card-capture
Disallow: /og

# API surface
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
