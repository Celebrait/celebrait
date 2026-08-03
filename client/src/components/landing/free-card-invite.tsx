// client/src/components/landing/free-card-invite.tsx
//
// The free-first-card invitation — the landing page's capture play
// (Kevin 2026-08-03: "most ain't ready to buy and we need sign ups…
// captivate not distract… ack the fact they ain't ready").
//
// Behaviour, tuned to that brief:
//   • Auto-shows ONCE per visitor (localStorage), and only after they've
//     had a real look — 9s on page OR 45% scroll, whichever lands first.
//     An instant popup would cheapen the gallery; this one arrives like
//     a shop assistant who waited for you to browse.
//   • After dismissal a quiet bottom-left pill stays put, so the offer
//     is always one tap away without ever nagging again. (Bottom-right
//     belongs to the existing "make your own" FloatingPill.)
//   • Signed-in users never see any of it — they have the world band.
//   • The claim CTA opens the auth modal and lands them on /studio,
//     where the ring + quick-add continue the story.
//
// Copy leads with the honesty: "Not ready to send a card? Fair." —
// acknowledging the browse state IS the hook. Anchor stays protected:
// £8.99 struck through, gift framing, never a price.

import { useEffect, useRef, useState } from 'react';
import { X, Gift } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';

const SEEN_KEY = 'celebrait:free-card-invite:v1';

/** The three-segment ring, full — the earned shape, shown as the promise. */
function InviteRing() {
  const r = 30;
  const c = 2 * Math.PI * r;
  const seg = c / 3;
  const gap = 4;
  return (
    <div className="relative h-20 w-20">
      <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="36"
            cy="36"
            r={r}
            fill="none"
            stroke="var(--brand, #5c57d4)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${seg - gap} ${c - seg + gap}`}
            strokeDashoffset={-i * seg}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Gift className="h-7 w-7 text-brand" strokeWidth={1.75} />
      </div>
    </div>
  );
}

export function FreeCardInvite() {
  const { user, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const [open, setOpen] = useState(false);
  const [autoShown, setAutoShown] = useState(false);
  const timerRef = useRef<number | null>(null);

  const signedOut = !isLoading && !user;

  // Auto-show once: 9s dwell or 45% scroll, whichever first.
  useEffect(() => {
    if (!signedOut || autoShown) return;
    let done = false;
    try {
      if (localStorage.getItem(SEEN_KEY)) {
        setAutoShown(true);
        return;
      }
    } catch {
      /* private mode — just don't auto-show twice this session */
    }
    const fire = () => {
      if (done) return;
      done = true;
      setAutoShown(true);
      setOpen(true);
      try {
        localStorage.setItem(SEEN_KEY, String(Date.now()));
      } catch {
        /* non-fatal */
      }
    };
    timerRef.current = window.setTimeout(fire, 9000);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max > 0.45) fire();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener('scroll', onScroll);
    };
  }, [signedOut, autoShown]);

  // Scroll-lock + Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!signedOut) return null;

  const claim = () => {
    setOpen(false);
    // Land on the studio home — the world band + quick-add pick the
    // story up from here (add 3 dates, watch the ring fill).
    openAuth('/studio');
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Your first card is on us"
          data-testid="free-card-invite"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#211D19]/45 backdrop-blur-[2px]"
          />
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-[#FFFDF9] shadow-[0_30px_80px_-20px_rgba(33,29,25,.5)] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              data-testid="free-card-invite-close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="px-7 pb-7 pt-8 sm:px-9 sm:pb-9">
              <InviteRing />
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-dark">
                A gift to start
              </p>
              <h2 className="keeper-serif mt-2 font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.015em] text-[#211D19] sm:text-[30px]">
                Not ready to send a card? Fair.
              </h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-[#3A342E]">
                The right moment probably hasn't come round yet. So start the
                other way: tell us <b>three dates that matter</b> — a birthday,
                an anniversary, any day — and your first card is on us.{' '}
                <span className="text-stone-400 line-through">£8.99</span>{' '}
                <b>£0</b>, just the postage. It waits for the moment.
              </p>
              <p className="mt-2.5 text-[12px] leading-relaxed text-stone-500">
                We'll watch every date and nudge you in good time — and we
                never contact the people you add.
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={claim}
                  className="w-full rounded-full bg-go px-6 py-3.5 text-[15px] font-bold text-go-foreground transition-colors hover:bg-go-hover"
                  data-testid="free-card-invite-claim"
                >
                  Claim it — takes a minute
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-full px-6 py-2.5 text-[13.5px] font-medium text-stone-500 transition-colors hover:text-[#211D19]"
                  data-testid="free-card-invite-dismiss"
                >
                  I'll keep looking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* The quiet, permanent way back in — bottom-right, REPLACING the
          old "make your own" FloatingPill (Kevin 2026-08-03): capture
          beats commerce for the not-ready-to-buy majority. */}
      {!open && autoShown && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-stone-200 bg-white/95 py-2 pl-2.5 pr-4 text-[12.5px] font-semibold text-[#211D19] shadow-[0_10px_30px_-12px_rgba(33,29,25,.35)] backdrop-blur transition-transform hover:scale-[1.03]"
          data-testid="free-card-invite-pill"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-muted">
            <Gift className="h-4 w-4 text-brand" strokeWidth={2} />
          </span>
          First card on us
        </button>
      )}
    </>
  );
}
