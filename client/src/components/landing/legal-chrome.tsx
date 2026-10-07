// client/src/components/landing/legal-chrome.tsx
//
// Header + footer for the pages that stay reachable while the site is
// locked (privacy, terms, contact). Unlocked — or an admin/password
// visitor — gets the normal KeeperHeader / MarketingFooter. Locked gets a
// wordmark and the legal links only: every other nav link dead-ends at
// the launching-soon page (launch audit 2026-10-06).

import { Link } from 'wouter';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { useSiteLocked } from '@/hooks/use-site-lock';
import celebraitLogo from '@/assets/celebrait.webp';

export function LegalHeader() {
  const locked = useSiteLocked();
  if (!locked) return <KeeperHeader />;
  // Same pill + geometry as KeeperHeader (pages pad `pt-32` for it), minus
  // the ticker and nav.
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[150]">
      <div className="px-4 pt-5">
        <header className="pointer-events-auto mx-auto flex h-14 w-full max-w-3xl items-center rounded-full border border-keeper-hair bg-white/75 px-4 shadow-[0_12px_40px_-18px_rgba(33,29,25,0.35)] backdrop-blur-md sm:px-5">
          <Link href="/" className="flex items-center" aria-label="Celebrait home">
            <img src={celebraitLogo} alt="Celebrait" className="h-8 w-auto sm:h-9" />
          </Link>
        </header>
      </div>
    </div>
  );
}

export function LegalFooter() {
  const locked = useSiteLocked();
  if (!locked) return <MarketingFooter />;
  // Mirrors the launching-soon page's own footer.
  return (
    <footer className="keeper-serif relative mx-auto w-full max-w-[1160px] px-6 sm:px-10">
      <div className="h-px w-full bg-keeper-hair" />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-5 text-[12px] text-keeper-meta">
        <span>© {new Date().getFullYear()} Celebrait</span>
        <span className="flex flex-wrap gap-x-4">
          <Link href="/privacy-policy" className="hover:text-keeper-ink">Privacy</Link>
          <Link href="/terms-of-service" className="hover:text-keeper-ink">Terms</Link>
          <Link href="/contact" className="hover:text-keeper-ink">Contact</Link>
        </span>
      </div>
    </footer>
  );
}
