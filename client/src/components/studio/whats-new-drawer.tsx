// client/src/components/studio/whats-new-drawer.tsx
//
// "What's new" announcements drawer — a right-hand slide-in feed of product
// updates, modelled on Prodigi's "What's new" panel. Trigger lives in the
// studio header (next to the notification bell); an unread badge shows how
// many entries are newer than the last time the user opened it, and clears
// on open (watermark persisted in localStorage).
//
// Content is static + versioned in code — see lib/announcements.ts.

import { useState } from 'react';
import { Link } from 'wouter';
import { Megaphone, ChevronRight } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import {
  ANNOUNCEMENTS,
  latestAnnouncementId,
  unreadAnnouncementCount,
  type AnnouncementTone,
} from '@/lib/announcements';

const SEEN_KEY = 'celebrait:whatsnew:seen:v1';

// Chip colour per tone. Keep these readable on white.
// Keeper palette only: green=new/positive, violet=brand update,
// ember=important/attention, stone=neutral tip. No rainbow.
const TONE_CHIP: Record<AnnouncementTone, string> = {
  new: 'bg-cta-light text-green-800',
  update: 'bg-brand-muted text-brand-dark',
  important: 'bg-accent-red-light text-accent-red-dark',
  tip: 'bg-stone-100 text-stone-600',
};

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function WhatsNewDrawer() {
  const [open, setOpen] = useState(false);
  const [seenId, setSeenId] = useState<string | null>(readSeen);
  const unread = unreadAnnouncementCount(seenId);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Opening marks everything up to the newest as seen → clears the badge.
    if (next) {
      const top = latestAnnouncementId();
      setSeenId(top);
      try {
        if (top) localStorage.setItem(SEEN_KEY, top);
      } catch {
        /* private mode / storage disabled — badge just won't persist */
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="relative flex items-center justify-center w-9 h-9 rounded-full text-stone-500 hover:text-brand hover:bg-stone-50 transition-colors"
          aria-label={unread > 0 ? `What's new (${unread} new)` : "What's new"}
          data-testid="whats-new-trigger"
        >
          <Megaphone className="w-[18px] h-[18px]" strokeWidth={1.9} />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-keeper-gold text-white text-[10px] font-semibold flex items-center justify-center"
              data-testid="whats-new-badge"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        // p-0 to own the layout; recolour + reposition the built-in close X
        // so it reads white against the gradient header.
        className="w-full sm:max-w-md p-0 overflow-y-auto [&>button]:text-white/85 [&>button:hover]:text-white [&>button]:top-5 [&>button]:right-5"
        data-testid="whats-new-drawer"
      >
        {/* Warm ink header (sticky so it anchors the feed as it scrolls).
            Replaced the old purple gradient 2026-07-11 (Kevin) — the last
            gradient in the studio — with the Keeper dark tone. Fraunces on
            the title (an earned headline moment). The built-in close X is
            already white-styled above, so it reads on the ink. */}
        <div className="sticky top-0 z-10 bg-keeper-ink px-6 pt-5 pb-5">
          <SheetTitle className="text-keeper-paper font-display font-bold tracking-[-0.015em] text-xl">
            What&apos;s new
          </SheetTitle>
          <p className="text-keeper-paper/60 text-xs mt-1">
            Fresh from the Celebrait workshop
          </p>
        </div>

        {/* Feed */}
        <div className="divide-y divide-stone-100">
          {ANNOUNCEMENTS.map((a) => (
            <article key={a.id} className="px-6 py-5">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${TONE_CHIP[a.tone]}`}
                >
                  {a.category}
                </span>
                <span className="text-xs text-stone-400">{a.date}</span>
              </div>
              <h3 className="text-[15px] font-semibold text-keeper-ink leading-snug mb-1.5">
                {a.title}
              </h3>
              <p className="text-sm text-keeper-stone leading-relaxed">{a.body}</p>
              {a.href &&
                (a.href.startsWith('/') ? (
                  <Link
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-0.5 text-sm font-medium text-brand hover:text-brand-dark mt-2.5"
                  >
                    {a.linkLabel ?? 'Learn more'}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <a
                    href={a.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-sm font-medium text-brand hover:text-brand-dark mt-2.5"
                  >
                    {a.linkLabel ?? 'Learn more'}
                    <ChevronRight className="w-4 h-4" />
                  </a>
                ))}
            </article>
          ))}
          {ANNOUNCEMENTS.length === 0 && (
            <p className="px-6 py-10 text-center text-sm text-stone-400">
              Nothing new right now.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
