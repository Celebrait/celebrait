// client/src/components/studio/notification-bell.tsx
//
// Tier-2 notification surface: a bell in the studio header with an unread
// count, opening a small inbox panel. This is the CALM home for in-flight
// and ready cards — a returning user sees a quiet badge here instead of a
// pile of toasts on entry (toasts now fire only for real-time
// transitions; see use-card-ready-notifications.tsx).
//
// Each row leads with the card's own artwork (presence over metadata) and
// routes to the right place: completed → the reveal (marks it seen),
// front/inside-ready → back into the maker to sign off.

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Bell, Check, Pencil } from 'lucide-react';
import {
  useStudioNotifications,
  useMarkCardSeen,
  type StudioNotification,
} from '@/hooks/use-card-ready-notifications';

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function titleFor(n: StudioNotification): string {
  const who = n.recipientName?.trim();
  const owner = who ? `${who}'s` : 'Your';
  if (n.status === 'completed') return `${owner} card is ready`;
  if (n.status === 'front-ready') return `${owner} front is ready`;
  if (n.status === 'inside-ready') return `${owner} inside is ready`;
  return `${owner} card`;
}

function subtitleFor(n: StudioNotification): string {
  return n.status === 'completed'
    ? 'See the reveal'
    : 'Review and sign off';
}

export function NotificationBell() {
  const { items, unreadCount } = useStudioNotifications();
  const markSeen = useMarkCardSeen();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleOpen = (n: StudioNotification) => {
    setOpen(false);
    if (n.status === 'completed') {
      markSeen(n.cardId);
      navigate(`/studio/card/${n.cardId}`);
    } else {
      navigate(`/studio/card/${n.cardId}/edit`);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} new` : 'Notifications'
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink"
        data-testid="notification-bell"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-keeper-hair bg-white shadow-[0_20px_50px_-16px_rgba(15,23,42,0.3)]"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unreadCount > 0 && (
              <span className="text-[11px] text-stone-400">{unreadCount} new</span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Bell
                className="mx-auto h-6 w-6 text-stone-300"
                strokeWidth={1.5}
                aria-hidden
              />
              <p className="mt-2 text-sm text-stone-500">You’re all caught up</p>
              <p className="mt-0.5 text-[12px] text-stone-400">
                New cards and updates show up here.
              </p>
            </div>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto">
              {items.map((n) => {
                const isReveal = n.status === 'completed';
                return (
                  <li key={`${n.cardId}:${n.status}`}>
                    <button
                      type="button"
                      onClick={() => handleOpen(n)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50"
                      data-testid={`notification-row-${n.cardId}`}
                    >
                      {/* Card art leads — presence over metadata. */}
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-keeper-hair bg-stone-100">
                        {n.frontImageUrl ? (
                          <img
                            src={n.frontImageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                        <span
                          className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white ${
                            isReveal
                              ? 'bg-cta-light text-cta-hover'
                              : 'bg-brand-light text-brand-dark'
                          }`}
                          aria-hidden
                        >
                          {isReveal ? (
                            <Check className="h-3 w-3" strokeWidth={2.5} />
                          ) : (
                            <Pencil className="h-3 w-3" strokeWidth={2.5} />
                          )}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {titleFor(n)}
                        </p>
                        <p className="mt-0.5 text-[12px] text-stone-500">
                          {subtitleFor(n)}
                        </p>
                      </div>

                      <span className="shrink-0 self-start text-[11px] text-stone-400">
                        {relativeTime(n.createdAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
