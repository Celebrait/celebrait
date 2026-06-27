// client/src/components/studio/welcome-moment.tsx
//
// The first-arrival "welcome to your studio" greeting — promoted from a
// corner toast to a FOCAL moment: a centred card over a soft backdrop
// blur, so the one notification that earns the spotlight gets it (Kevin
// 2026-06-27). Routine toasts stay ambient; this is the deliberate
// "stop and look" beat.
//
// One-shot, remembered via localStorage `celebrait:welcome:v1` (same key
// the old toast used, so already-welcomed users don't see it again).
// Per-device V1 — server `users.welcomedAt` is the durable upgrade.
//
// Sequencing: the studio hints walkthrough waits for this to be
// dismissed (StudioHints gates on the same flag), so the user gets the
// greeting first, then the contextual hints.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const WELCOME_KEY = 'celebrait:welcome:v1';
const SHOW_DELAY_MS = 700;
// Don't pop the greeting over a focused task surface.
const HIDE_ON: RegExp[] = [
  /^\/studio\/new-card(?:\/|$)/,
  /^\/studio\/card\//,
  /^\/checkout\//,
];

export function WelcomeMoment() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  const suppressed = HIDE_ON.some((rx) => rx.test(location));
  const enabled = isAuthenticated && !isLoading && !suppressed;

  useEffect(() => {
    if (!enabled) return;
    let seen = false;
    try {
      seen = localStorage.getItem(WELCOME_KEY) === '1';
    } catch {
      return; // localStorage blocked — skip rather than greet every load
    }
    if (seen) return;
    const t = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [enabled]);

  const dismiss = () => {
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      /* best-effort */
    }
    setOpen(false);
  };

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          data-testid="welcome-moment"
        >
          {/* Soft backdrop — dim + blur the studio behind so the greeting
              is the focus. Click anywhere outside to dismiss. */}
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-[3px]"
            onClick={dismiss}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Welcome to your studio"
            className="relative w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-7 text-center shadow-[0_30px_80px_-24px_rgba(15,23,42,0.45)]"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-md p-1 text-stone-400 transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>

            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light text-brand-dark">
              <Sparkles className="h-6 w-6" strokeWidth={2} />
            </span>

            <h2 className="text-xl font-semibold text-ink">
              Welcome to your studio
            </h2>
            <p className="mx-auto mt-2 max-w-[19rem] text-sm leading-relaxed text-ink-soft">
              Make a card they’ll keep — pick a moment, add a photo, and we’ll
              bring it to life. Start whenever you’re ready.
            </p>

            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  dismiss();
                  navigate('/studio/new-card');
                }}
                className="w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
              >
                Make my first card
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="text-[13px] text-stone-400 transition-colors hover:text-ink-soft"
              >
                Have a look around first
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
