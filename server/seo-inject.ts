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

import { seoForPath, robotsForPath, isKnownRoutePath } from '@shared/seo';
import { marketBootScript, market, publicOrigin } from '@shared/market';
import { copyFor } from '@shared/market-copy';
import { cardPrice, marketizeShellPrices } from '@shared/pricing';
import { formatMoney } from '@shared/market';
import type { PageSeo } from '@shared/seo';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { cardTemplates } from '@shared/schema';
import { rackOpen } from './routes/site-lock';

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
  get image() { return `${publicOrigin()}/og-share-card.png?v=2`; },
  imageAlt:
    'Someone made you an Unbinnable Greetings Card — Celebrait',
};

function isShareLinkPath(p: string): boolean {
  return /^\/c\/[\w-]+/.test(p) || /^\/card\/\d+\/view/.test(p);
}

/** Product pages are the long-tail landing pages, and their money
 *  words (the interest) live in the DB — so /card/:id metadata is
 *  looked up per request. Anything else falls through to the sync
 *  registry. Never throws: a DB blip serves base metadata. */
export async function injectSeoAsync(templateHtml: string, requestPath: string): Promise<string> {
  const rack = await rackOpen();
  const html = marketizeShell(withRobotsMeta(await injectSeoInner(templateHtml, requestPath, rack), requestPath, rack));
  // The market (GB/ZA) the client reads synchronously on first paint, so
  // no frame ever renders in the wrong currency. See shared/market.ts.
  return html.replace('</head>', `${marketBootScript()}</head>`);
}

/** The shell (client/index.html) is static and written for GB: its
 *  absolute URLs say the co.uk origin and its JSON-LD says GBP / GB.
 *  Rewrite both to the active market so crawlers and social scrapers
 *  (which never run JS) see the right site. In GB with no
 *  PUBLIC_APP_ORIGIN override this is a no-op. JSON-LD PRICE values are
 *  left alone here (shared/pricing.ts owns them). */
const SHELL_ORIGIN = 'https://www.celebrait.co.uk';

/** The price quoted in a template card's meta description. ⚠️ GB still
 *  says the retired flat £8.99 (kept byte-identical during the market
 *  switch, 2026-10-15); it should become cardPrice('rack') like ZA. */
function templateCardPrice(): string {
  return market().id === 'GB' ? '£8.99' : formatMoney(cardPrice('rack'));
}
export function marketizeShell(html: string): string {
  const m = market();
  const origin = publicOrigin();
  let out = html.split(SHELL_ORIGIN).join(origin);
  out = out
    .replace(/("(?:priceCurrency|currency)":\s*")[A-Z]{3}(")/g, `$1${m.currency}$2`)
    .replace(/("(?:areaServed|addressCountry|applicableCountry)":\s*")[A-Z]{2}(")/g, `$1${m.isoCountry}$2`)
    .replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${m.locale.replace('-', '_')}$2`);
  if (m.id !== 'GB') out = out.split('posted anywhere in the UK').join(`posted ${copyFor(m).anywhere}`);
  // JSON-LD price values (photo card, postage): shared/pricing.ts.
  out = marketizeShellPrices(out);
  return out;
}

/** The X-Robots-Tag for the shell response — the rack flag read once. */
export async function robotsHeaderForPath(requestPath: string): Promise<string | null> {
  return robotsForPath(requestPath, await rackOpen());
}

/** HTTP status for the SPA shell: 404 for a path no route serves, so
 *  unknown URLs stop being soft-404s. Same index.html either way. */
export function htmlStatusForPath(requestPath: string): number {
  return isKnownRoutePath(requestPath) ? 200 : 404;
}

/** `<meta name="robots">` for private / unknown paths — crawlers that
 *  don't run JS still see it. Paired with the X-Robots-Tag header set
 *  where the shell is served (server/vite.ts). */
function withRobotsMeta(html: string, requestPath: string, rack: boolean): string {
  const robots = robotsForPath(requestPath, rack);
  if (!robots) return html;
  return html.replace(
    /(<meta name="description"[^>]*>)/,
    `$1\n    <meta name="robots" content="${robots}" />`,
  );
}

async function injectSeoInner(templateHtml: string, requestPath: string, rack: boolean): Promise<string> {
  const m = requestPath.match(/^\/card\/(\d+)$/);
  if (m) {
    try {
      const [t] = await db.select().from(cardTemplates).where(eq(cardTemplates.id, Number(m[1])));
      if (t && t.published) {
        const occ = t.occasion.replace(/\b\w/g, (c) => c.toUpperCase());
        const interest = (t.interest ?? '').trim();
        const intCap = interest.replace(/\b\w/g, (c) => c.toUpperCase());
        const seo: PageSeo = {
          path: requestPath,
          title: `${interest ? `${intCap} ` : ''}${occ} Card — “${t.front_text.slice(0, 60)}” | Celebrait`,
          description: `A one-of-a-kind ${t.occasion} card${interest ? ` for someone who loves ${interest}` : ''} — “${t.front_text.slice(0, 90)}”. Designed inside and out, printed on 300gsm and posted ${copyFor().anywhere}. ${templateCardPrice()} + postage.`,
        };
        return applySeo(templateHtml, seo);
      }
    } catch (err) {
      console.warn('[SEO] card lookup failed (non-fatal):', err);
    }
  }
  return injectSeo(templateHtml, requestPath, rack);
}

export function injectSeo(templateHtml: string, requestPath: string, rack = false): string {
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

  const seo = seoForPath(requestPath, rack);

  if (!seo) {
    // Unknown/private route: base metadata but NO canonical — better no
    // signal than a wrong one.
    return templateHtml.replace(/^\s*<link rel="canonical"[^>]*>\s*$/m, '');
  }

  return applySeo(templateHtml, seo);
}

function applySeo(templateHtml: string, seo: PageSeo): string {
  const title = escapeAttr(seo.title);
  const desc = escapeAttr(seo.description);
  const canonical =
    publicOrigin() + (seo.path === '/' ? '/' : seo.path);

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
