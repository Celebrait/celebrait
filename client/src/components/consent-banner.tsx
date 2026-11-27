// client/src/components/consent-banner.tsx — the advertising-cookie ask.
//
// A small bottom strip, shown only when a Meta Pixel id is configured and
// this visitor hasn't chosen yet (or opened "Cookie settings"). Accept and
// No thanks are the SAME button, size and style: under PECR saying no must
// be as easy as saying yes. Mounted from SiteGate, so it never sits on the
// locked launching-soon page; never on the back office, the recording and
// render routes, or a recipient opening their card.

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Cookie } from 'lucide-react';
import {
  onConsentSettingsOpen,
  openConsentSettings,
  pixelId,
  readConsent,
  setConsent,
} from '@/lib/consent';

const HIDDEN_ON = [/^\/admin/, /^\/demo/, /^\/og(\/|$)/, /^\/card-capture/, /^\/c\//, /^\/card\/[^/]+\/view/];

// Both buttons are the SAME violet fill (Aidan 2026-11-27: the white
// version blended into the page). Violet, not green: neither choice
// commits money, and equal weight keeps "no" as easy as "yes".
const BUTTON =
  'inline-flex min-h-[40px] flex-1 items-center justify-center rounded-full bg-brand-dark px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4b46c0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 sm:min-h-[44px] sm:flex-none sm:min-w-[120px]';

export function ConsentBanner() {
  const [location] = useLocation();
  const configured = !!pixelId();
  const [open, setOpen] = useState(() => configured && !readConsent());

  useEffect(() => {
    if (!configured) return;
    return onConsentSettingsOpen(() => setOpen(true));
  }, [configured]);

  if (!configured || !open) return null;
  if (HIDDEN_ON.some((re) => re.test(location))) return null;

  const choose = (choice: 'granted' | 'denied') => {
    setConsent(choice);
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie choice"
      className="fixed inset-x-0 bottom-0 z-[60] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      {/* Phones get a compact strip and a shorter sentence (Aidan 2026-11-27):
          the full-size banner covered the Christmas page's first card for
          every ad visitor. Same facts, same two equal buttons. */}
      <div className="mx-auto flex max-w-3xl flex-col gap-2.5 rounded-2xl border-2 border-brand bg-brand-light p-3 shadow-[0_14px_44px_-14px_rgba(92,87,212,0.55)] sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <p className="flex min-w-0 items-start gap-2.5 text-[13px] leading-snug text-keeper-ink sm:items-center sm:text-[14px] sm:leading-relaxed">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark sm:mt-0" aria-hidden />
          <span>
          <span className="sm:hidden">One ad cookie, to see which ads bring people here. Say no and nothing changes.</span>
          <span className="hidden sm:inline">We use one advertising cookie to see which of our ads bring people here. Accept it, or say no and nothing changes.</span>{' '}
          <Link href="/privacy-policy#cookies" className="whitespace-nowrap font-semibold text-keeper-ink underline decoration-brand-dark underline-offset-2">
            Privacy policy
          </Link>
          </span>
        </p>
        <div className="flex shrink-0 gap-2.5">
          <button type="button" className={BUTTON} onClick={() => choose('granted')}>
            Accept
          </button>
          <button type="button" className={BUTTON} onClick={() => choose('denied')}>
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Cookie settings": reopens the banner. Renders nothing when no pixel
 *  is configured (there is nothing to set). */
export function CookieSettingsLink({ className }: { className?: string }) {
  if (!pixelId()) return null;
  return (
    <button type="button" onClick={openConsentSettings} className={className}>
      Cookie settings
    </button>
  );
}
