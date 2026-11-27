// client/src/hooks/use-first-card-offer.ts
//
// THE LAUNCH OFFER (Aidan 2026-11-06, matching the social ad: "your first
// card's on us, seriously"): the first PHOTO card is £0, postage paid by
// the customer. It is switched and capped at /admin/site; the server
// says whether it is open right now via the one /api/site-lock request
// every page already makes.
//
// ONE OFFER, ONE SWITCH (Aidan 2026-11-27): this is the ONLY offer. When
// it is off or the cap is hit there is no offer at all: every surface
// that reads this hook shows nothing about one, and the checkout charges
// the everyday price. There is no half-price fallback any more, so a new
// surface needs exactly two states: this offer, or no mention of one.
import { useLockState } from '@/hooks/use-beta';
import { useAuth } from '@/hooks/use-auth';
import { isGuestEmail } from '@shared/guest';

/** true = "your first card's on us" is live (switch on, under its caps). */
export function useFirstCardOnUs(): boolean {
  const { data } = useLockState();
  // A guest account (shared/guest.ts) can never hold the offer, so it
  // is never offered one: no promise the checkout would then break.
  const { user } = useAuth();
  return data?.freeFirstCard === true && !isGuestEmail(user?.email);
}
