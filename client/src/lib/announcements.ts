// client/src/lib/announcements.ts
//
// "What's new" product announcements — the feed rendered in the right-hand
// drawer (whats-new-drawer.tsx), modelled on Prodigi's "What's new" panel.
// Static + versioned in code (no admin UI for V1): when something ships, add
// a new entry to the TOP of the array with a fresh, never-reused id.
//
// Ordered NEWEST-FIRST. The unread badge counts entries newer than the last
// one the user opened (watermarked by id in localStorage), so adding a new
// top entry lights the badge for everyone exactly once.

export type AnnouncementTone = "new" | "update" | "important" | "tip";

export interface Announcement {
  /** Stable unique id — NEVER reuse or reorder. Drives the "seen" watermark. */
  id: string;
  tone: AnnouncementTone;
  /** Chip label, e.g. "New", "Delivery". */
  category: string;
  /** Human date string (static content — no runtime dates). */
  date: string;
  title: string;
  body: string;
  /** Optional CTA. Internal path ("/pricing") → SPA nav; absolute URL → new tab. */
  href?: string;
  linkLabel?: string;
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "2026-07-03-printed-cards",
    tone: "new",
    category: "New",
    date: "3 July 2026",
    title: "Printed cards, made just for you",
    body: "Every card is now printed to order on premium 280gsm gloss and posted in the UK — with a free digital link to share too. Our cards are one-off prints — please allow at least a week from order to arrival.",
    href: "/pricing",
    linkLabel: "See pricing",
  },
  {
    id: "2026-09-09-order-a-week-ahead",
    tone: "update",
    category: "Delivery",
    date: "9 September 2026",
    title: "One postage option, and honest dates",
    body: "Our cards are one-off prints — please allow at least a week from order to arrival. They're printed to order by a partner printer, then posted Royal Mail 24 (£2.95). At checkout, tell us the date and we'll say straight away whether it'll make it.",
  },
  {
    id: "2026-06-01-reminders",
    tone: "tip",
    category: "Tip",
    date: "1 June 2026",
    title: "Never miss a date again",
    body: "Add the people who matter to your address book with their birthdays and occasions, and we'll nudge you three weeks, ten days and a week ahead — the last one is the last safe day to order.",
    href: "/studio/people/reminders",
    linkLabel: "Set up reminders",
  },
];

export function latestAnnouncementId(): string | null {
  return ANNOUNCEMENTS[0]?.id ?? null;
}

/** How many announcements are newer than the one the user last saw. */
export function unreadAnnouncementCount(seenId: string | null): number {
  if (ANNOUNCEMENTS.length === 0) return 0;
  if (!seenId) return ANNOUNCEMENTS.length;
  const idx = ANNOUNCEMENTS.findIndex((a) => a.id === seenId);
  // Unknown watermark (entry removed) → treat everything as new.
  if (idx === -1) return ANNOUNCEMENTS.length;
  return idx; // entries before the seen one are newer
}
