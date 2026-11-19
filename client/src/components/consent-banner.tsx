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
import {
  onConsentSettingsOpen,
  openConsentSettings,
  pixelId,
  readConsent,
  setConsent,
} from '@/lib/consent';

const HIDDEN_ON = [/^\/admin/, /^\/demo/, /^\/og(\/|$)/, /^\/card-capture/, /^\/c\//, /^\/card\/[^/]+\/view/];

const BUTTON =
  'inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-keeper-ink/70 bg-white px-5 text-sm font-medium text-keeper-ink transition-colors hover:bg-keeper-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:flex-none sm:min-w-[120px]';

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
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-keeper-hair bg-white/95 p-4 shadow-[0_12px_40px_-16px_rgba(33,29,25,0.35)] backdrop-blur-sm sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <p className="min-w-0 text-[14px] leading-relaxed text-keeper-body">
          We use one advertising cookie to see which of our ads bring people here. Accept it, or say no and nothing changes.{' '}
          <Link href="/privacy-policy#cookies" className="whitespace-nowrap font-medium text-keeper-gold underline underline-offset-2">
            Privacy policy
          </Link>
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
