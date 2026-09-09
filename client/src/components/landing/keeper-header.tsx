// client/src/components/landing/keeper-header.tsx
//
// THE KEEPER header — a floating pill nav (memorae-style, Kevin 2026-07-05)
// with the rotating banner pinned above it. Shared by every public page.
//
// The menu (Aidan 2026-09-09: "currently not working, need our 2 route
// LPs on there, plus the catalogue page, with dropdowns for bday and
// xmas"). Real destinations, not scroll anchors:
//
//   Made for them   → /create   (the three-card route's landing page)
//   From your photo → /photo    (the director's landing page)
//   Cards ▾         → /cards/birthday, /cards/christmas — one entry per
//                     occasion; add to OCCASIONS as the rack grows
//   Pricing         → /pricing
//
// Desktop shows the row; phones get a hamburger opening the same list
// in a sheet. Warm glass (paper tint + blur), hairline border, ink CTA.

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronDown, Menu } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';
import celebraitLogo from '@/assets/celebrait.webp';
import { TickerBanner } from '@/components/landing/ticker-banner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

/** The two ways to make a card — each has its own landing page. */
const ROUTES = [
  { label: 'Made for them', href: '/create', sub: 'Tell us who. We design three.' },
  { label: 'From your photo', href: '/photo', sub: 'Put them in the picture.' },
] as const;

/** The rack, by occasion. One entry per occasion page that exists;
 *  extend as the catalogue grows. */
const OCCASIONS = [
  { label: 'Birthday', href: '/cards/birthday' },
  { label: 'Christmas', href: '/cards/christmas' },
] as const;

const navLink = 'text-[13px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink';
const navActive = 'text-keeper-ink';

export function KeeperHeader() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const onGate = location === '/';
  // On the makers and at checkout the visitor is already doing the thing —
  // the header verb would only pull them out of it (audit 2026-09-09).
  const hideCta = location === '/photo/make' || location.startsWith('/buy/') || location.startsWith('/order/');
  const onPhotoLp = location === '/photo' || location === '/keeper';
  const onCards = location.startsWith('/cards');
  const is = (href: string) => location === href || (href === '/photo' && onPhotoLp);

  const cta = hideCta ? null : onGate ? (
    /* On the gate the header must not answer the page's own question —
       it just brings the two doors into view. */
    <button
      type="button"
      onClick={() => document.getElementById('doors')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      className="h-10 rounded-full bg-keeper-ink px-4 text-[13px] font-semibold text-keeper-paper transition-colors hover:bg-black sm:px-5"
    >
      Make a card
    </button>
  ) : (
    /* Signed out on the photo page → the PUBLIC photo maker; anywhere
       else → the three-card builder. */
    <Link href={onPhotoLp ? '/photo/make' : '/make'}>
      <button
        type="button"
        className="h-10 rounded-full bg-keeper-ink px-4 text-[13px] font-semibold text-keeper-paper transition-colors hover:bg-black sm:px-5"
      >
        Make a card
      </button>
    </Link>
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[150]">
      <TickerBanner />
      <div className="px-4 pt-5">
        <header className="pointer-events-auto mx-auto flex h-14 w-full max-w-3xl items-center justify-between rounded-full border border-keeper-hair bg-white/75 pl-4 pr-1.5 shadow-[0_12px_40px_-18px_rgba(33,29,25,0.35)] backdrop-blur-md sm:pl-5 sm:pr-2">
          <Link href="/" className="flex items-center" aria-label="Celebrait home">
            <img src={celebraitLogo} alt="Celebrait" className="h-8 w-auto sm:h-9" />
          </Link>

          {/* Desktop row */}
          <nav className="hidden items-center gap-5 md:flex" aria-label="Main">
            {ROUTES.map((r) => (
              <Link key={r.href} href={r.href} className={`${navLink} ${is(r.href) ? navActive : ''}`}>
                {r.label}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={`inline-flex items-center gap-1 ${navLink} ${onCards ? navActive : ''}`} data-testid="nav-cards">
                  Cards <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px] rounded-xl border-keeper-hair bg-white p-1.5">
                <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-meta">Off the shelf · from £4.99</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-keeper-hair" />
                {OCCASIONS.map((o) => (
                  <DropdownMenuItem key={o.href} asChild className="rounded-lg text-[13.5px] text-keeper-ink focus:bg-brand-muted">
                    <Link href={o.href}>{o.label} cards</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href="/pricing" className={`${navLink} ${is('/pricing') ? navActive : ''}`}>Pricing</Link>
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
                {cta}
              </>
            )}

            {/* Phones: the same menu in a sheet. */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button type="button" aria-label="Menu" className="flex h-10 w-10 items-center justify-center rounded-full text-keeper-ink md:hidden" data-testid="nav-menu">
                  <Menu className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] border-keeper-hair bg-keeper-paper p-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <nav className="flex flex-col px-5 pb-8 pt-16" aria-label="Main" onClick={() => setOpen(false)}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-meta">Make a card</p>
                  {ROUTES.map((r) => (
                    <Link key={r.href} href={r.href} className="mt-3 block">
                      <span className="block text-[16px] font-semibold text-keeper-ink">{r.label}</span>
                      <span className="block text-[12.5px] text-keeper-meta">{r.sub}</span>
                    </Link>
                  ))}
                  <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-meta">Cards off the shelf</p>
                  {OCCASIONS.map((o) => (
                    <Link key={o.href} href={o.href} className="mt-3 block text-[16px] font-semibold text-keeper-ink">{o.label} cards</Link>
                  ))}
                  <div className="mt-7 border-t border-keeper-hair pt-5">
                    <Link href="/pricing" className="block text-[16px] font-semibold text-keeper-ink">Pricing</Link>
                    {!isLoading && !isAuthenticated && (
                      <button type="button" onClick={() => openAuth('/studio')} className="mt-3 block text-[16px] font-semibold text-keeper-ink">Sign in</button>
                    )}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </header>
      </div>
    </div>
  );
}
