// client/src/components/landing/keeper-header.tsx
//
// THE KEEPER header — a floating pill nav (memorae-style, Kevin 2026-07-05)
// with the rotating banner pinned above it. Shared by every public page.
//
// The menu (Aidan 2026-09-09/10). Two groups, each a dropdown, plus
// Pricing:
//
//   Personalised cards ▾  → Made for them (/create) · From your photo (/photo)
//   Stock cards ▾         → one entry per occasion on the rack (OCCASIONS)
//   Pricing               → /pricing
//
// Desktop: Radix dropdowns (they animate in from the trigger). Phones: a
// hamburger opens a sheet where the two groups expand in place (a CSS
// grid-rows transition, so the list unfolds rather than jumps).
//
// z-index: the header sits at z-[150] so it floats over page content;
// anything that opens FROM it (dropdown, sheet) must sit higher, or it
// renders behind the very bar it came from — which is what happened
// (Aidan 2026-09-10: "dropping behind itself on desktop and mobile").

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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface MenuItem { label: string; href: string; sub?: string }
interface MenuGroup { label: string; items: readonly MenuItem[]; matches: (path: string) => boolean }

/** The two ways to make a card — each has its own landing page. */
const PERSONALISED: readonly MenuItem[] = [
  { label: 'Made for them', href: '/create', sub: 'Tell us who. We design three.' },
  { label: 'From your photo', href: '/photo', sub: 'Put them in the picture.' },
];

/** The rack, by occasion. One entry per occasion page that exists;
 *  extend as the catalogue grows. */
const STOCK: readonly MenuItem[] = [
  { label: 'Birthday', href: '/cards/birthday' },
  { label: 'Christmas', href: '/cards/christmas' },
];

const GROUPS: readonly MenuGroup[] = [
  { label: 'Personalised cards', items: PERSONALISED, matches: (p) => p === '/create' || p === '/photo' || p === '/keeper' },
  { label: 'Stock cards', items: STOCK, matches: (p) => p.startsWith('/cards') || p.startsWith('/card/') },
];

const navLink = 'inline-flex items-center gap-1 text-[13px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink data-[state=open]:text-keeper-ink';
const navActive = 'text-keeper-ink';
const ctaCls = 'h-10 rounded-full bg-keeper-ink px-4 text-[13px] font-semibold text-keeper-paper transition-colors hover:bg-black sm:px-5';

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

  const cta = hideCta ? null : onGate ? (
    /* On the gate the header must not answer the page's own question —
       it just brings the two doors into view. */
    <button type="button" onClick={() => document.getElementById('doors')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={ctaCls}>
      Make a card
    </button>
  ) : (
    /* Signed out on the photo page → the PUBLIC photo maker; anywhere
       else → the three-card builder. */
    <Link href={onPhotoLp ? '/photo/make' : '/make'}>
      <button type="button" className={ctaCls}>Make a card</button>
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
            {GROUPS.map((g) => (
              <DropdownMenu key={g.label} modal={false}>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={`${navLink} ${g.matches(location) ? navActive : ''}`} data-testid={`nav-${g.label.split(' ')[0].toLowerCase()}`}>
                    {g.label} <ChevronDown className="h-3.5 w-3.5 transition-transform data-[state=open]:rotate-180" />
                  </button>
                </DropdownMenuTrigger>
                {/* z-[200]: above the z-[150] header it opens from. */}
                <DropdownMenuContent align="start" sideOffset={24} className="z-[200] min-w-[220px] rounded-xl border-keeper-hair bg-white p-1.5 shadow-[0_18px_50px_-20px_rgba(33,29,25,0.35)]">
                  {g.items.map((it) => (
                    <DropdownMenuItem key={it.href} asChild className="cursor-pointer rounded-lg px-3 py-2 focus:bg-brand-muted">
                      <Link href={it.href} className="block">
                        <span className="block text-[13.5px] font-medium text-keeper-ink">{it.label}</span>
                        {it.sub && <span className="block text-[12px] text-keeper-meta">{it.sub}</span>}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
            <Link href="/pricing" className={`${navLink} ${location === '/pricing' ? navActive : ''}`}>Pricing</Link>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isLoading && isAuthenticated ? (
              <Link href="/studio">
                <button type="button" className={ctaCls}>
                  <span className="sm:hidden">My studio</span>
                  <span className="hidden sm:inline">Open my studio</span>
                </button>
              </Link>
            ) : (
              <>
                <button type="button" onClick={() => openAuth('/studio')} className="hidden px-2 text-[13px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink sm:block">
                  Sign in
                </button>
                {cta}
              </>
            )}

            {/* Phones: the same menu in a sheet, groups unfolding in place. */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button type="button" aria-label="Menu" className="flex h-10 w-10 items-center justify-center rounded-full text-keeper-ink md:hidden" data-testid="nav-menu">
                  <Menu className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] border-keeper-hair bg-keeper-paper p-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <nav className="flex flex-col px-5 pb-8 pt-14" aria-label="Main">
                  {GROUPS.map((g) => (
                    <MobileGroup key={g.label} group={g} defaultOpen={g.matches(location)} onNavigate={() => setOpen(false)} />
                  ))}
                  <div className="mt-2 border-t border-keeper-hair pt-4">
                    <Link href="/pricing" onClick={() => setOpen(false)} className="block py-2 text-[16px] font-semibold text-keeper-ink">Pricing</Link>
                    {!isLoading && !isAuthenticated && (
                      <button type="button" onClick={() => { setOpen(false); openAuth('/studio'); }} className="block py-2 text-[16px] font-semibold text-keeper-ink">Sign in</button>
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

/** A group that unfolds in place — grid-rows 0fr → 1fr so the list
 *  grows smoothly (respects reduced motion via the transition class). */
function MobileGroup({ group, defaultOpen, onNavigate }: { group: MenuGroup; defaultOpen: boolean; onNavigate: () => void }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-keeper-hair">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between py-3.5 text-left text-[16px] font-semibold text-keeper-ink">
        {group.label}
        <ChevronDown className={`h-4 w-4 text-keeper-meta transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <ul className="pb-3">
            {group.items.map((it) => (
              <li key={it.href}>
                <Link href={it.href} onClick={onNavigate} className="block rounded-lg px-3 py-2.5 hover:bg-brand-muted">
                  <span className="block text-[15px] font-medium text-keeper-ink">{it.label}</span>
                  {it.sub && <span className="block text-[12.5px] text-keeper-meta">{it.sub}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
