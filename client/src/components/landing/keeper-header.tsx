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

import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';
import { useClaimFreeCard } from '@/components/landing/ticker-banner';
import celebraitLogo from '@/assets/celebrait.webp';
import { TickerBanner } from '@/components/landing/ticker-banner';

const NAV_LINKS = [
  { label: 'The proof', id: 'proof' },
  { label: 'Examples', id: 'gallery' },
  { label: 'Pricing', id: 'price' },
] as const;

export function KeeperHeader() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  // Signed out, starting a card leads with the free-card offer
  // rather than a bare sign-in prompt. Same gate either way.
  const claimFreeCard = useClaimFreeCard();
  const [location] = useLocation();

  // On the homepage the section anchors exist, so smooth-scroll in place.
  // From any other page (e.g. Terms/Privacy) go home and let the browser
  // land on the section.
  // The section anchors (proof, gallery, price) live on the PHOTO landing
  // page, which moved from / to /photo when the gate arrived (2026-09-03).
  const onPhotoLp = location === '/photo' || location === '/keeper';
  const onGate = location === '/';
  // On the public photo maker the visitor is already making a card —
  // the header verb would only pull them out of it.
  const onPhotoMaker = location === '/photo/make';
  const jump = (id: string) => {
    if (onPhotoLp) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.assign(`/photo#${id}`);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[150]">
      {/* Rolling banner — free-card offer + production promise
          (Kevin 2026-08-03, news-ticker style). */}
      <TickerBanner />
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
                {/* Visible on mobile too (2026-08-10). This was
                    `hidden … sm:block`, so under 640px the header offered
                    "Make a card" and nothing else — a returning customer on
                    a phone had no way back into their account from the
                    landing page. It fits: both controls are compact and the
                    CTA already shortens to "Make a card" at this width. */}
                <button
                  type="button"
                  onClick={() => openAuth('/studio')}
                  className="px-2 text-[13px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink"
                >
                  Sign in
                </button>
                {/* The header verb follows the page: on the photo landing
                    page it starts the photo route (sign in → studio); anywhere
                    else it goes to the three-card builder. */}
                {onPhotoMaker ? null : onGate ? (
                  /* On the gate the header must not answer the page's own
                     question — it just brings the two doors into view. */
                  <button
                    type="button"
                    onClick={() => document.getElementById('doors')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="h-10 rounded-full bg-keeper-ink px-4 text-[13px] font-semibold text-keeper-paper transition-colors hover:bg-black sm:px-5"
                  >
                    Make a card
                  </button>
                ) : onPhotoLp ? (
                  /* Signed out on the photo page → the PUBLIC photo maker
                     (2026-09-04): start without an account, sign up at
                     Generate. */
                  <Link href="/photo/make">
                    <button
                      type="button"
                      className="h-10 rounded-full bg-keeper-ink px-4 text-[13px] font-semibold text-keeper-paper transition-colors hover:bg-black sm:px-5"
                    >
                      Make a card
                    </button>
                  </Link>
                ) : (
                  <Link href="/make">
                    <button
                      type="button"
                      className="h-10 rounded-full bg-keeper-ink px-4 text-[13px] font-semibold text-keeper-paper transition-colors hover:bg-black sm:px-5"
                    >
                      Make a card
                    </button>
                  </Link>
                )}
              </>
            )}
          </div>
        </header>
      </div>
    </div>
  );
}
