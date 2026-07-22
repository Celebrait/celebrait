// client/src/components/landing/keeper-header.tsx
//
// THE KEEPER header — a floating pill nav (memorae-style, Kevin 2026-07-05)
// with the 72h production-promise banner pinned above it. Extracted from
// landing-keeper.tsx (2026-07-22) so other public pages (Terms, Privacy)
// can share the exact same chrome.
//
// Warm glass (paper tint + blur) so the celebration backdrop reads through
// it, hairline border, ink CTA.

import { Link, useLocation } from 'wouter';
import { Send } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';
import celebraitLogo from '@/assets/celebrait.png';

const NAV_LINKS = [
  { label: 'The proof', id: 'proof' },
  { label: 'Examples', id: 'gallery' },
  { label: 'Pricing', id: 'price' },
] as const;

export function KeeperHeader() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const [location] = useLocation();

  // On the homepage the section anchors exist, so smooth-scroll in place.
  // From any other page (e.g. Terms/Privacy) go home and let the browser
  // land on the section.
  const onHome = location === '/' || location === '/keeper';
  const jump = (id: string) => {
    if (onHome) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.assign(`/#${id}`);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[150]">
      {/* Production-promise banner — ink black sweeping into brand violet. */}
      <div
        className="pointer-events-auto flex h-10 items-center justify-center px-4 text-center font-sans text-[11.5px] font-medium text-white sm:text-[12.5px]"
        style={{ background: 'linear-gradient(90deg, #211D19 0%, #5c57d4 100%)' }}
      >
        <span className="sm:hidden">
          Printed to order in 72 hrs — £8.99 + delivery.
        </span>
        <span className="hidden sm:inline">
          Every card is printed to order, just for them — allow up to 72 hrs,
          then posted. £8.99 + delivery.
        </span>
        <Send className="ml-2 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </div>
      <div className="px-4 pt-5">
        <header className="pointer-events-auto mx-auto flex h-14 w-full max-w-3xl items-center justify-between rounded-full border border-keeper-hair bg-white/75 pl-4 pr-1.5 shadow-[0_12px_40px_-18px_rgba(33,29,25,0.35)] backdrop-blur-md sm:pl-5 sm:pr-2">
          <Link href="/" className="flex items-center" aria-label="Celebrait home">
            <img src={celebraitLogo} alt="Celebrait" className="h-8 w-auto sm:h-9" />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => jump(l.id)}
                className="text-[13px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink"
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isLoading && isAuthenticated ? (
              <Link href="/studio">
                <button
                  type="button"
                  className="h-10 rounded-full bg-keeper-ink px-4 text-[13px] font-semibold text-keeper-paper transition-colors hover:bg-black sm:px-5"
                >
                  <span className="sm:hidden">My studio</span>
                  <span className="hidden sm:inline">Open my studio</span>
                </button>
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuth('/studio')}
                  className="hidden px-2 text-[13px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink sm:block"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('/studio/new-card')}
                  className="h-10 rounded-full bg-keeper-ink px-4 text-[13px] font-semibold text-keeper-paper transition-colors hover:bg-black sm:px-5"
                >
                  <span className="sm:hidden">Make a card</span>
                  <span className="hidden sm:inline">Make my first card</span>
                </button>
              </>
            )}
          </div>
        </header>
      </div>
    </div>
  );
}
