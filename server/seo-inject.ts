// server/seo-inject.ts
//
// Per-request SEO rewriting of the SPA's HTML shell.
//
// WHY: this is a client-rendered SPA — one index.html for every route.
// Before this, EVERY path served the homepage's <title>, description and
// (worst) <link rel="canonical" href=".../"> — which told Google that
// /pricing, /contact and every blog post were duplicates of the
// homepage and shouldn't be indexed. Crawlers that don't execute JS
// (and social scrapers, which never do) saw homepage metadata
// everywhere.
//
// This transforms the served HTML per path using shared/seo.ts (the
// same registry the client hook uses, so first-load and SPA-navigation
// metadata can't drift). Known public paths get their own title/
// description/canonical/OG; unknown paths (studio, checkout, etc. —
// all robots-disallowed anyway) get the base metadata with the
// canonical REMOVED, because a wrong canonical is worse than none.
//
// String-replacement over a template is deliberate: the shell is built
// by Vite and stable in shape; a full HTML parser here would be weight
// without benefit. Every replacement is anchored on an attribute
// (name=/property=/rel=) so reordering lines in index.html can't break
// it silently.

import { seoForPath, SITE_ORIGIN } from '@shared/seo';

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Meta for shared card links (/c/<token> and the legacy long form).
 *  A branded TEASE on purpose — never the card art: the viewer's
 *  TAP-TO-OPEN reveal is the product, and OG images are fetched and
 *  cached by platform crawlers unauthenticated, so customer faces
 *  stay off WhatsApp/Meta CDNs. One static image for every card. */
const SHARE_OG = {
  title: 'Someone made you a card',
  description:
    "A personalised card, made just for you — you're in the picture. Tap to open it.",
  image: `${SITE_ORIGIN}/og-share-card.png?v=2`,
  imageAlt:
    'Someone made you an Unbinnable Greetings Card — Celebrait',
};

function isShareLinkPath(p: string): boolean {
  return /^\/c\/[\w-]+/.test(p) || /^\/card\/\d+\/view/.test(p);
}

export function injectSeo(templateHtml: string, requestPath: string): string {
  if (isShareLinkPath(requestPath)) {
    const t = escapeAttr(SHARE_OG.title);
    const d = escapeAttr(SHARE_OG.description);
    return (
      templateHtml
        // No canonical: every share link is unique and none should be
        // indexed (robots already disallow it) — a canonical would be
        // actively wrong here.
        .replace(/^\s*<link rel="canonical"[^>]*>\s*$/m, '')
        .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
        .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
        .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
        .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`)
        .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${SHARE_OG.image}$2`)
        .replace(/(<meta property="og:image:secure_url" content=")[^"]*(")/, `$1${SHARE_OG.image}$2`)
        .replace(/(<meta property="og:image:type" content=")[^"]*(")/, `$1image/png$2`)
        .replace(/(<meta property="og:image:alt" content=")[^"]*(")/, `$1${escapeAttr(SHARE_OG.imageAlt)}$2`)
        .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`)
        .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`)
        .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${SHARE_OG.image}$2`)
    );
  }

  const seo = seoForPath(requestPath);

  if (!seo) {
    // Unknown/private route: base metadata but NO canonical — better no
    // signal than a wrong one.
    return templateHtml.replace(/^\s*<link rel="canonical"[^>]*>\s*$/m, '');
  }

  const title = escapeAttr(seo.title);
  const desc = escapeAttr(seo.description);
  const canonical =
    SITE_ORIGIN + (seo.path === '/' ? '/' : seo.path);

  return (
    templateHtml
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(
        /(<meta name="description" content=")[^"]*(")/,
        `$1${desc}$2`,
      )
      .replace(
        /(<link rel="canonical" href=")[^"]*(")/,
        `$1${canonical}$2`,
      )
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
      .replace(
        /(<meta property="og:description" content=")[^"]*(")/,
        `$1${desc}$2`,
      )
      .replace(
        /(<meta property="og:type" content=")[^"]*(")/,
        `$1${seo.ogType ?? 'website'}$2`,
      )
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
      .replace(
        /(<meta name="twitter:description" content=")[^"]*(")/,
        `$1${desc}$2`,
      )
  );
}
