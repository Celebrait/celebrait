// shared/guest.ts — guest accounts (Aidan 2026-11-27: "we'll open this
// up with no account"). The photo route draws in the studio, which needs
// a signed-in user, so a visitor who presses Generate signed out gets a
// throwaway account minted behind the scenes (server/routes/guest-session.ts),
// exactly as the beta door did. The address domain IS the marker: no
// mailbox exists there, so the mailer skips it, the UI says "Guest"
// rather than showing it, and checkout asks for a real email.
export const GUEST_EMAIL_DOMAIN = 'guests.celebrait.co.uk';
const GUEST_RE = /@guests\.celebrait\.co\.uk$/i;
export function isGuestEmail(email: string | null | undefined): boolean {
  return !!email && GUEST_RE.test(email);
}
