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
    body: "Every card is now printed to order on premium 280gsm gloss and posted in the UK — with a free digital link to share too. Allow up to 72 hours for production, then your chosen delivery on top.",
    href: "/pricing",
    linkLabel: "See pricing",
  },
  {
    id: "2026-07-03-delivery-speeds",
    tone: "update",
    category: "Delivery",
    date: "3 July 2026",
    title: "Three delivery speeds at checkout",
    body: "Pick Standard (Royal Mail 24), Express (Evri Next Day) or Overnight (DPD) when you check out. The faster options speed up the postage — printing still takes up to 72 hours, so order in good time.",
  },
  {
    id: "2026-06-01-reminders",
    tone: "tip",
    category: "Tip",
    date: "1 June 2026",
    title: "Never miss a date again",
    body: "Add the people who matter to your address book with their birthdays and occasions, and we'll nudge you 21, 7 and 3 days ahead — plenty of runway to make something lovely.",
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
