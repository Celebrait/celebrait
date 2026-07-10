// client/src/components/studio/welcome-moment.tsx
//
// The first-arrival "welcome to your studio" greeting — a FOCAL moment:
// a centred card over a soft backdrop blur, so the one notification that
// earns the spotlight gets it. Routine toasts stay ambient; this is the
// deliberate "stop and look" beat.
//
// One-shot, remembered via localStorage `celebrait:welcome:v1`. Per-device
// V1 — server `users.welcomedAt` is the durable upgrade.
//
// Sequencing: the studio hints walkthrough waits for this to be dismissed
// (StudioHints gates on the same flag), so greeting first, then hints.
//
// Note: no AnimatePresence — we render nothing once `open` is false so
// dismiss unmounts instantly (an earlier AnimatePresence-toggle version
// could leave the modal stuck on screen). Entrance is still animated.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import celebraitIcon from '@/assets/celebrait-icon.png';

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
  // Once dismissed, never reopen this mount — guards against any effect
  // re-run racing the localStorage write.
  const dismissedRef = useRef(false);

  const suppressed = HIDE_ON.some((rx) => rx.test(location));
  const enabled = isAuthenticated && !isLoading && !suppressed;

  useEffect(() => {
    if (!enabled || dismissedRef.current) return;
    let seen = false;
    try {
      seen = localStorage.getItem(WELCOME_KEY) === '1';
    } catch {
      return; // localStorage blocked — skip rather than greet every load
    }
    if (seen) {
      dismissedRef.current = true;
      return;
    }
    const t = window.setTimeout(() => {
      if (!dismissedRef.current) setOpen(true);
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [enabled]);

  const dismiss = () => {
    dismissedRef.current = true;
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

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      data-testid="welcome-moment"
    >
      {/* Soft backdrop — dim + blur the studio behind so the greeting is
          the focus. Click anywhere outside to dismiss. */}
      <div
        className="absolute inset-0 bg-keeper-ink/30 backdrop-blur-[3px]"
        onClick={dismiss}
        aria-hidden
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to your studio"
        className="relative w-full max-w-sm rounded-3xl border border-keeper-hair bg-white p-7 text-center shadow-[0_30px_80px_-24px_rgba(33,29,25,0.45)]"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1 text-stone-400 transition-colors hover:text-keeper-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted">
          <img src={celebraitIcon} alt="" className="h-10 w-10 object-contain" />
        </span>

        <h2 className="text-xl font-semibold text-keeper-ink">
          Welcome to your studio
        </h2>
        <p className="mx-auto mt-2 max-w-[19rem] text-sm leading-relaxed text-keeper-stone">
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
            className="w-full rounded-full bg-go px-6 py-3 text-sm font-semibold text-go-foreground transition-colors hover:bg-go-hover"
          >
            Make my first card
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-[13px] text-stone-400 transition-colors hover:text-keeper-stone"
          >
            Have a look around first
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
