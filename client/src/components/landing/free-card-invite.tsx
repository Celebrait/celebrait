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
import { AuthForm, type AuthStep } from '@/components/auth/auth-form';
import { ProgressRing } from '@/components/studio/moment-ring';

const SEEN_KEY = 'celebrait:free-card-invite:v1';

/** The shared ring, shown full — the earned shape as the promise. */
function InviteRing() {
  return (
    <div className="relative h-20 w-20">
      <ProgressRing filled={3} size={80} />
      <div className="absolute inset-0 flex items-center justify-center">
        <Gift className="h-7 w-7 text-brand" strokeWidth={1.75} />
      </div>
    </div>
  );
}

export function FreeCardInvite() {
  const { user, isLoading } = useAuth();
  const { authOpen } = useAuthModal();
  const [open, setOpen] = useState(false);
  const [autoShown, setAutoShown] = useState(false);
  // Claim happens INSIDE this modal (Kevin 2026-08-03: the generic
  // sign-in dialog dropped the gift context at the commitment moment) —
  // same surface, ring still visible, the real <AuthForm> embedded.
  const [claiming, setClaiming] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>('email');
  const timerRef = useRef<number | null>(null);

  const signedOut = !isLoading && !user;

  // Never coexist with the sign-in dialog — someone mid-OTP must not get
  // a second overlay stacking behind/over it (Kevin 2026-08-03). If they
  // close auth without signing in, the auto-show effect re-arms below.
  useEffect(() => {
    if (authOpen) setOpen(false);
  }, [authOpen]);

  // Auto-show once: 9s dwell or 45% scroll, whichever first. Paused
  // entirely while the auth dialog is up.
  useEffect(() => {
    if (!signedOut || autoShown || authOpen) return;
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
    // Scroll trigger measures MOVEMENT from where the page loaded, not
    // absolute position — browser scroll restoration replays the old
    // position as a scroll event on load, which used to fire the modal
    // instantly on refresh.
    const startY = window.scrollY;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const travelled = window.scrollY - startY > window.innerHeight * 0.6;
      if (max > 0 && travelled && window.scrollY / max > 0.45) fire();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener('scroll', onScroll);
    };
  }, [signedOut, autoShown, authOpen]);

  // Scroll-lock + Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Stay mounted while a claim is mid-flight even though verify has
  // signed the user in — unmounting here killed AuthForm's welcome step
  // (first-name capture) and its /studio redirect, stranding the new
  // account on the landing page.
  if (!signedOut && !claiming) return null;

  const close = () => {
    setOpen(false);
    setClaiming(false);
    setAuthStep('email');
  };

  // Step-aware copy for the embedded claim flow. The email step keeps
  // the gift front and centre; code/welcome mirror the standard auth
  // copy so the mechanics feel familiar.
  const claimCopy =
    authStep === 'email'
      ? {
          heading: 'Claim your free card.',
          sub: "Pop your email in — we'll send a 6-digit code. No passwords, ever.",
        }
      : authStep === 'code'
        ? { heading: 'Check your email.', sub: 'We sent you a 6-digit code.' }
        : {
            heading: 'One last thing.',
            sub: 'What should we call you? Your three dates are next.',
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
            onClick={close}
            className="absolute inset-0 bg-[#211D19]/45 backdrop-blur-[2px]"
          />
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-[#FFFDF9] shadow-[0_30px_80px_-20px_rgba(33,29,25,.5)] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              data-testid="free-card-invite-close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="px-7 pb-7 pt-8 sm:px-9 sm:pb-9">
              <InviteRing />
              {claiming ? (
                <>
                  <h2 className="keeper-serif mt-4 font-display text-[24px] font-semibold leading-[1.15] tracking-[-0.015em] text-[#211D19] sm:text-[27px]">
                    {claimCopy.heading}
                  </h2>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[#3A342E]">
                    {claimCopy.sub}
                  </p>
                  {authStep === 'email' && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-stone-500">
                      Then three dates that matter, and your first card is{' '}
                      <span className="line-through">£8.99</span> <b>£0</b> —
                      just the postage.
                    </p>
                  )}
                  <div className="mt-5" data-testid="free-card-invite-authform">
                    <AuthForm defaultRedirect="/studio" onStepChange={setAuthStep} />
                  </div>
                  <p className="mt-4 text-[11px] text-stone-400">
                    By continuing you agree to our{' '}
                    <a
                      href="/terms-of-service"
                      className="underline-offset-2 hover:text-stone-600 hover:underline"
                    >
                      Terms
                    </a>{' '}
                    and{' '}
                    <a
                      href="/privacy-policy"
                      className="underline-offset-2 hover:text-stone-600 hover:underline"
                    >
                      Privacy Policy
                    </a>
                    .
                  </p>
                  {authStep === 'email' && (
                    <button
                      type="button"
                      onClick={() => setClaiming(false)}
                      className="mt-3 text-[12.5px] font-medium text-stone-500 transition-colors hover:text-[#211D19]"
                      data-testid="free-card-invite-back"
                    >
                      ‹ Back
                    </button>
                  )}
                </>
              ) : (
                <>
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
                      onClick={() => setClaiming(true)}
                      className="w-full rounded-full bg-go px-6 py-3.5 text-[15px] font-bold text-go-foreground transition-colors hover:bg-go-hover"
                      data-testid="free-card-invite-claim"
                    >
                      Claim it — takes a minute
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="w-full rounded-full px-6 py-2.5 text-[13.5px] font-medium text-stone-500 transition-colors hover:text-[#211D19]"
                      data-testid="free-card-invite-dismiss"
                    >
                      I'll keep looking
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* The quiet, permanent way back in — bottom-right, REPLACING the
          old "make your own" FloatingPill (Kevin 2026-08-03): capture
          beats commerce for the not-ready-to-buy majority. */}
      {!open && autoShown && !authOpen && (
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
