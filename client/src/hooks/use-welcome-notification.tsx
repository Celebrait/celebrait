// client/src/hooks/use-welcome-notification.tsx
//
// One-time "welcome to your studio" greeting on a user's first arrival.
// Mounted once at the Studio layout level (alongside the card-ready
// notifications hook).
//
// First-arrival detection is a localStorage flag for V1 — per-device,
// matches the existing photo-consent pattern (PHOTO_CONSENT_KEY). It is
// NOT a durable record: a returning user on a new device / cleared cache
// sees it again. When we want it reliable across devices, promote to a
// server field (e.g. users.welcomedAt) + a tiny endpoint — mechanical.
//
// Fires ~1.2s after mount so it reads as a greeting settling in, not a
// flash on page load. Skips entirely if localStorage is unavailable
// (private mode) rather than risk greeting on every mount.

import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

const WELCOME_KEY = 'celebrait:welcome:v1';
const GREET_DELAY_MS = 1200;

export function useWelcomeNotification() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  // Guard so we only schedule the greeting once per mount.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    if (firedRef.current) return;

    let seen = false;
    try {
      seen = localStorage.getItem(WELCOME_KEY) === '1';
    } catch {
      // localStorage blocked (private mode) — don't greet rather than
      // greet on every mount with no way to remember we did.
      return;
    }
    if (seen) return;
    firedRef.current = true;

    const t = window.setTimeout(() => {
      // Stamp at fire time so an early unmount doesn't burn the greeting.
      try {
        localStorage.setItem(WELCOME_KEY, '1');
      } catch {
        /* ignore — best-effort */
      }
      toast({
        title: 'Welcome to your studio',
        description: 'Make a card they’ll keep — start whenever you’re ready.',
        variant: 'info',
        action: (
          <ToastAction
            altText="Make a card"
            onClick={() => navigate('/studio/new-card')}
          >
            Make a card
          </ToastAction>
        ),
      });
    }, GREET_DELAY_MS);

    return () => window.clearTimeout(t);
  }, [isAuthenticated, isLoading, toast, navigate]);
}
