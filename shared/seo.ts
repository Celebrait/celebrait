// shared/seo.ts
//
// SINGLE SOURCE OF TRUTH for per-page SEO metadata. Consumed by:
//   • server/seo-inject.ts — rewrites <title>/description/canonical/OG
//     into the served HTML per request path, so crawlers get correct
//     metadata WITHOUT executing JS (fixes the everything-canonicals-
//     to-homepage bug that told Google /pricing was a duplicate of "/")
//   • client/src/lib/use-seo.ts — keeps the tab title + meta in sync on
//     SPA navigations
//   • the blog pages — BLOG_POSTS drives the index, the posts, and
//     their BlogPosting JSON-LD
//
// Keyword strategy (2026-07-29): long-tail intent phrases a NEW domain
// can actually win — "turn a photo into a greeting card", "personalised
// card from a photo", "AI greeting cards UK" — not the head terms
// Moonpig owns. Emotion in on-page copy, search phrasing in the meta
// layer. Titles ≤ ~60 chars (Google truncation), descriptions ≤ ~155.

import { cardPriceGBP } from './pricing';

export const SITE_ORIGIN = 'https://www.celebrait.co.uk';

// The "from" price follows the rack switch (Aidan 2026-10-09: the rack is
// parked until there is stock): £4.99 while stock cards sell, else the
// made-for-them price. Both the server injector and the client hook pass
// the live flag, so the tab title and the crawler agree.
const fromGBP = (rackEnabled: boolean) => `£${(cardPriceGBP(rackEnabled ? 'rack' : 'maker') / 100).toFixed(2)}`;

export type PageSeo = {
  /** Route path, no trailing slash (except '/'). */
  path: string;
  title: string;
  description: string;
  /** OG type override — 'article' for blog posts, default 'website'. */
  ogType?: 'website' | 'article';
};

const pageSeo = (rackEnabled: boolean): PageSeo[] => [
  {
    path: '/',
    title: 'Personalised Greetings Cards, Made For One Person | Celebrait',
    description:
      `Two ways to make a card that’s all about them: turn a photo into the artwork, or tell us one thing they love and pick from three originals. Printed on 280gsm card and posted anywhere in the UK from ${fromGBP(rackEnabled)}.`,
  },
  {
    path: '/photo/make',
    title: 'Make a card from a photo | Celebrait',
    description:
      'Upload one clear photo, set the scene, and we draw them into it. Free to start — sign up when you’re ready to generate.',
  },
  {
    path: '/photo',
    title: 'Personalised Greetings Cards — Put Them In The Picture | Celebrait',
    description:
      `Turn a photo into a personalised greetings card. They become the artwork — any scene you can describe — printed on 280gsm card and posted anywhere in the UK from ${fromGBP(rackEnabled)}.`,
  },
  {
    path: '/create',
    title: 'Why Settle For A Card That’s Anything But All About Them? | Celebrait',
    description:
      `Tell us who the card is for and we write and illustrate three originals in 3–5 minutes. Printed on 280gsm card and posted first class from ${fromGBP(rackEnabled)}.`,
  },
  {
    path: '/make',
    title: 'Making their card… | Celebrait',
    description: 'Three original cards, written and illustrated for one person. Pick your favourite, add your words, printed and posted first class.',
  },
  {
    path: '/pricing',
    title: `Pricing — Personalised Greetings Cards from ${fromGBP(rackEnabled)} | Celebrait`,
    description:
      `No subscriptions: printed cards from ${fromGBP(rackEnabled)} plus £2.95 postage — ${rackEnabled ? '£4.99 off the shelf, ' : ''}£5.99 made for them, £6.99 from your photo. Free to design, free digital version included. One-off prints: allow at least a week from order to arrival.`,
  },
  {
    path: '/contact',
    title: 'Contact Us | Celebrait',
    description:
      "Questions about your personalised card, an order, or anything else? Get in touch with the Celebrait team — we're a small UK business and a real human replies.",
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | Celebrait',
    description:
      'How Celebrait handles your data and photos: used only for your cards, never sold, never used to train models. Read the full privacy policy.',
  },
  {
    path: '/terms-of-service',
    title: 'Terms of Service | Celebrait',
    description:
      'The terms for using Celebrait to create, print and post personalised greetings cards in the UK.',
  },
  {
    path: '/blog',
    title: 'The Celebrait Blog — Card Ideas & Guides | Celebrait',
    description:
      'Ideas, guides and honest answers about personalised photo cards: how to turn a photo into a greeting card, AI card questions, and inspiration for every occasion.',
  },
];

export type BlogPostMeta = {
  slug: string;
  title: string;
  /** The on-page H1 (usually punchier than the SEO title). */
  heading: string;
  description: string;
  /** ISO date. */
  published: string;
  readMinutes: number;
};

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: 'how-to-turn-a-photo-into-a-greeting-card',
    title: 'How to Turn a Photo Into a Greeting Card (UK Guide) | Celebrait',
    heading: 'How to turn a photo into a greeting card',
    description:
      'Turn any phone photo into a printed greeting card where they ARE the artwork — not a photo slapped on a template. Step-by-step guide, from snapshot to doormat.',
    published: '2026-07-29',
    readMinutes: 4,
  },
  {
    slug: 'ai-generated-greeting-cards',
    title: 'AI-Generated Greeting Cards: An Honest Guide | Celebrait',
    heading: 'AI-generated greeting cards: an honest guide',
    description:
      'What AI greeting cards actually are, how the good ones work, whether they feel lazy (short answer: depends who does the thinking), and what to look for in the UK.',
    published: '2026-07-29',
    readMinutes: 5,
  },
  {
    slug: 'personalised-birthday-card-ideas',
    title: '9 Personalised Birthday Card Ideas They Will Keep | Celebrait',
    heading: 'Nine personalised birthday card ideas better than another pun about wine',
    description:
      'Birthday card ideas where the person is the picture: nan on the moon, dad the gladiator, best mates abseiling off Big Ben. Personalised card inspiration for people who keep things.',
    published: '2026-07-29',
    readMinutes: 4,
  },
];

/** Full lookup for the server injector: static pages + blog posts. */
/** The catalogue's SEO, generated from the URL grammar so the server
 *  injector and the client hook can never disagree (single source).
 *  /cards/birthday → "Birthday Cards"; /cards/birthday/18th →
 *  "18th Birthday Cards"; /for-mum → "Birthday Cards for Mum". */
const CATALOGUE_OCCASIONS: Record<string, string> = { birthday: 'Birthday' };
export function catalogueSeoForPath(path: string): PageSeo | null {
  const m = path.match(/^\/cards\/([a-z-]+)(?:\/([a-z0-9-]+))?$/);
  if (!m) return null;
  const occ = CATALOGUE_OCCASIONS[m[1]];
  if (!occ) return null;
  const aisle = m[2] ?? null;
  const cap = (t: string) => t.replace(/\b\w/g, (c) => c.toUpperCase());
  const title = !aisle ? `${occ} Cards`
    : /^\d/.test(aisle) ? `${aisle} ${occ} Cards`
    : aisle.startsWith('for-') ? `${occ} Cards for ${cap(aisle.slice(4).replace(/-/g, ' '))}`
    : `${cap(aisle.replace(/-/g, ' '))} ${occ} Cards`;
  return {
    path,
    title: `${title} — Personalised & Made For Them | Celebrait`,
    description: `Real ${title.toLowerCase()} to send as-is or make theirs — or tell us one thing they love and we'll make three just for them. Printed and posted in the UK from £4.99.`,
  };
}

// ── Robots: what must never be indexed ──────────────────────────────
// Mounted and reachable, but private by design or a design reference —
// robots.txt only stops the CRAWL (a URL can still be listed from
// links); these get a real noindex (meta + X-Robots-Tag) too.
// (launch audit 2026-10-06, Phase 3)
const NOINDEX_PATHS: RegExp[] = [
  /^\/keeper$/, // design reference, duplicate of /photo
  /^\/c\//, // share links — a private moment between two people
  /^\/card\/\d+\/view(\/|$)/, // legacy long share form
  /^\/order\//, // private by uuid
];

// Mirror of the router (client/src/App.tsx): every prefix a real route
// serves. The server's HTML fallback 404s anything else so unknown URLs
// stop being soft-404s (200 + not-found UI). Dynamic ids are matched
// loosely — a missing card/blog post is the CLIENT's not-found, still
// 200. ADD HERE WHEN ADDING A ROUTE, or the new page 404s for crawlers.
const KNOWN_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/(photo|create|keeper|card-capture|login|research|pricing|privacy-policy|terms-of-service|contact|blog|og|make|demo|door|door2|hero-poc)(\/|$)/,
  /^\/(studio|admin|checkout)(\/|$)/,
  /^\/card\/[^/]+(\/|$)/,
  /^\/cards\/[^/]+(\/|$)/,
  /^\/c\/[^/]+\/?$/,
  /^\/buy\/[^/]+\/?$/,
  /^\/order\/[^/]+\/?$/,
];

export function isKnownRoutePath(path: string): boolean {
  return KNOWN_ROUTES.some((re) => re.test(path));
}

/** The robots directive for a path, or null when it may be indexed.
 *  Used by the server (meta + X-Robots-Tag) and the client hook.
 *  `rackEnabled` false (the default — parked) noindexes the catalogue,
 *  which the client redirects to /create meanwhile. */
export function robotsForPath(path: string, rackEnabled = false): string | null {
  if (NOINDEX_PATHS.some((re) => re.test(path))) return 'noindex,nofollow';
  if (!rackEnabled && /^\/cards(\/|$)/.test(path)) return 'noindex';
  if (!isKnownRoutePath(path)) return 'noindex';
  return null;
}

export function seoForPath(rawPath: string, rackEnabled = false): PageSeo | null {
  const path =
    rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  const page = pageSeo(rackEnabled).find((p) => p.path === path);
  if (page) return page;
  const cat = catalogueSeoForPath(path);
  if (cat) return cat;
  const m = path.match(/^\/blog\/([a-z0-9-]+)$/);
  if (m) {
    const post = BLOG_POSTS.find((p) => p.slug === m[1]);
    if (post) {
      return {
        path,
        title: post.title,
        description: post.description,
        ogType: 'article',
      };
    }
  }
  return null;
}
