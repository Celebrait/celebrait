// shared/models/analytics.ts
//
// First-party, cookieless traffic analytics (2026-07-29). Design goals,
// in order: no consent banner needed (nothing identifies a person — no
// cookie, no IP stored, no fingerprint), answers "which source produced
// buyers", zero third parties.
//
// One row per HTML page view. Bots are filtered BEFORE insert (cleaner
// data beats bot visibility). Attribution flows separately: the client
// keeps first-touch UTM/referrer in localStorage and hands it to the
// server at SIGNUP, where it's stored on users.attribution — that's the
// join that turns "40 visits from instagram" into "…and 2 of them paid".
import {
  pgTable,
  bigserial,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const siteVisits = pgTable(
  'site_visits',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** Path only, no query string (UTMs are split into their own
     *  columns; anything else in the query is noise or PII risk). */
    path: text('path').notNull(),
    /** document.referrer's host, e.g. "instagram.com". Null = direct. */
    referrerHost: text('referrer_host'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    /** 'mobile' | 'desktop' — coarse, from the UA, for feel not truth. */
    device: text('device'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    // The dashboard's two scans: time-window rollups and per-source
    // splits within a window.
    index('site_visits_created_at_idx').on(t.createdAt),
    index('site_visits_source_idx').on(t.utmSource, t.createdAt),
  ],
);

export type SiteVisit = typeof siteVisits.$inferSelect;

/** First-touch attribution, captured client-side on the first page view
 *  and persisted onto users.attribution at signup. */
export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrerHost?: string;
  landingPath?: string;
  /** ISO timestamp of the first touch. */
  firstTouchAt?: string;
};
