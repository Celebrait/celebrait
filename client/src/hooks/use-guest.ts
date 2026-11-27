// client/src/hooks/use-guest.ts — is this browser on a guest account?
// (shared/guest.ts). Guests never see the studio (Aidan 2026-11-27:
// "just don't direct them into the studio"): the card editor and the
// giving screen wear the shop's chrome, and every "back to the studio"
// exit goes to the photo page instead.
import { useAuth } from '@/hooks/use-auth';
import { isGuestEmail } from '@shared/guest';

export function useIsGuest(): boolean {
  const { user } = useAuth();
  return isGuestEmail(user?.email);
}

/** Where "home" is for this visitor: the studio, or the shop for a guest. */
export function useStudioHome(): string {
  return useIsGuest() ? '/photo' : '/studio';
}
