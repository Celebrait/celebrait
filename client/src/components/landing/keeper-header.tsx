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
// Branded, not a list of links (Aidan 2026-09-10: "a bit more colour,
// a bit of branding, icon? tagline? come on dude"): every item has an
// icon in the studio's violet well, an eyebrow names the group the way
// the gate does, the price sits on the group, and the phone sheet opens
// with the mark, the tagline and the offer. Palette stays locked —
// violet chrome, green for readiness, coral ONLY on the offer.
//
// z-index: the header sits at z-[150] so it floats over page content;
// anything that opens FROM it (dropdown, sheet) must sit higher, or it
// renders behind the very bar it came from (Aidan 2026-09-10).

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Cake, Camera, ChevronDown, Gift, Menu, Sparkles, Tag, TreePine, type LucideIcon } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';
import celebraitLogo from '@/assets/celebrait.webp';
import logoMark from '@/assets/logo-mark.webp';
import { TickerBanner, useClaimFreeCard } from '@/components/landing/ticker-banner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CARD_PRICES_GBP, CARD_PRICE_FROM_GBP } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

interface MenuItem { label: string; href: string; sub: string; icon: LucideIcon; price?: string }
interface MenuGroup {
  label: string;
  /** The eyebrow inside the open menu — the gate's language. */
  eyebrow: string;
  items: readonly MenuItem[];
  /** The line under the items: what the group costs, in one breath. */
  foot: { href: string; label: string };
  matches: (path: string) => boolean;
}

/** The two ways to make a card — each has its own landing page. */
const PERSONALISED: readonly MenuItem[] = [
  { label: 'Made for them', href: '/create', sub: 'Tell us who. We design three, you pick one.', icon: Sparkles, price: gbp(CARD_PRICES_GBP.maker) },
  { label: 'From your photo', href: '/photo', sub: 'Put them in a whole new world.', icon: Camera, price: gbp(CARD_PRICES_GBP.photo) },
];

/** The rack, by occasion. One entry per occasion page that exists;
 *  extend as the catalogue grows. */
const STOCK: readonly MenuItem[] = [
  { label: 'Birthday', href: '/cards/birthday', sub: 'For mums, dads, mates and the big numbers.', icon: Cake },
  { label: 'Christmas', href: '/cards/christmas', sub: 'The ones that stay on the mantelpiece.', icon: TreePine },
];

const GROUPS: readonly MenuGroup[] = [
  {
    label: 'Personalised cards',
    eyebrow: 'Made from scratch, for one person',
    items: PERSONALISED,
    foot: { href: '/', label: 'Not sure which? Answer one question' },
    matches: (p) => p === '/create' || p === '/photo' || p === '/keeper',
  },
  {
    label: 'Stock cards',
    eyebrow: `Off the shelf · from ${gbp(CARD_PRICE_FROM_GBP)}`,
    items: STOCK,
    foot: { href: '/cards/birthday', label: 'Browse the whole rack' },
    matches: (p) => p.startsWith('/cards') || p.startsWith('/card/'),
  },
];

const navLink = 'inline-flex items-center gap-1 text-[13px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink data-[state=open]:text-keeper-ink';
const navActive = 'text-keeper-ink';
const ctaCls = 'h-10 rounded-full bg-keeper-ink px-4 text-[13px] font-semibold text-keeper-paper transition-colors hover:bg-black sm:px-5';
const eyebrow = 'text-[10.5px] font-semibold uppercase tracking-[0.14em] text-keeper-gold';

/** One row: the studio's icon well, the label, the line, the price. */
function ItemRow({ item, compact = false }: { item: MenuItem; compact?: boolean }) {
  const Icon = item.icon;
  return (
    <span className="flex items-center gap-3">
      <span className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-muted text-keeper-gold ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] font-semibold text-keeper-ink">{item.label}</span>
          {item.price && <span className="shrink-0 text-[12px] font-semibold text-keeper-ink">{item.price}</span>}
        </span>
        <span className="block text-[12px] leading-snug text-keeper-meta">{item.sub}</span>
      </span>
    </span>
  );
}

export function KeeperHeader() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const claimFreeCard = useClaimFreeCard();
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
                <DropdownMenuContent align="start" sideOffset={24} className="z-[200] w-[320px] overflow-hidden rounded-2xl border-keeper-hair bg-white p-0 shadow-[0_24px_60px_-24px_rgba(33,29,25,0.4)]">
                  <div className="px-4 pb-1 pt-3.5">
                    <p className={eyebrow}>{g.eyebrow}</p>
                  </div>
                  <div className="p-2">
                    {g.items.map((it) => (
                      <DropdownMenuItem key={it.href} asChild className="cursor-pointer rounded-xl px-2.5 py-2.5 focus:bg-brand-muted">
                        <Link href={it.href} className="block"><ItemRow item={it} /></Link>
                      </DropdownMenuItem>
                    ))}
                  </div>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-none border-t border-keeper-hair bg-keeper-paper px-4 py-3 focus:bg-brand-muted">
                    <Link href={g.foot.href} className="block text-[12.5px] font-medium text-keeper-gold">{g.foot.label} →</Link>
                  </DropdownMenuItem>
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
              <SheetContent side="right" className="flex w-[320px] flex-col border-keeper-hair bg-keeper-paper p-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                {/* The mark and the tagline — the gate's headline, so the
                    menu reads as the same place. */}
                <div className="border-b border-keeper-hair bg-white px-5 pb-5 pt-5">
                  <img src={logoMark} alt="" className="h-9 w-9" />
                  <p className={`mt-3 ${eyebrow}`}>Unbinnable greetings cards</p>
                  <p className="mt-1 font-display text-[20px] font-bold leading-[1.1] tracking-[-0.01em] text-keeper-ink">
                    Stop settling for<br /><span className="font-medium italic">“that one will do”</span>
                  </p>
                </div>
                <nav className="flex flex-1 flex-col overflow-y-auto px-4 pb-4 pt-2" aria-label="Main">
                  {GROUPS.map((g) => (
                    <MobileGroup key={g.label} group={g} defaultOpen={g.matches(location)} onNavigate={() => setOpen(false)} />
                  ))}
                  <div className="mt-1 flex flex-col">
                    <Link href="/pricing" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-1 py-3 text-[16px] font-semibold text-keeper-ink">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-muted text-keeper-gold"><Tag className="h-[18px] w-[18px]" strokeWidth={1.75} /></span>
                      Pricing
                    </Link>
                    {!isLoading && !isAuthenticated && (
                      <button type="button" onClick={() => { setOpen(false); openAuth('/studio'); }} className="px-1 py-2 text-left text-[14px] font-medium text-keeper-meta">Sign in</button>
                    )}
                  </div>
                </nav>
                {/* The offer, coral — the one warm accent, on the offer only. */}
                <button
                  type="button"
                  onClick={() => { setOpen(false); claimFreeCard(); }}
                  className="flex items-center gap-3 border-t border-keeper-hair px-5 py-4 text-left"
                  style={{ background: 'linear-gradient(90deg, #211D19 0%, #5c57d4 100%)' }}
                >
                  <Gift className="h-4 w-4 shrink-0 text-accent-coral" />
                  <span className="text-[12.5px] font-medium leading-snug text-white">
                    Add 3 dates that matter — <b className="text-accent-coral">50% off</b> your first card ›
                  </span>
                </button>
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
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-1 py-3.5 text-left">
        <span>
          <span className="block text-[16px] font-semibold text-keeper-ink">{group.label}</span>
          <span className={`block ${eyebrow}`}>{group.eyebrow}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-keeper-meta transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <ul className="pb-3">
            {group.items.map((it) => (
              <li key={it.href}>
                <Link href={it.href} onClick={onNavigate} className="block rounded-xl px-1.5 py-2 hover:bg-brand-muted">
                  <ItemRow item={it} compact />
                </Link>
              </li>
            ))}
            <li>
              <Link href={group.foot.href} onClick={onNavigate} className="mt-1 block px-1.5 py-1.5 text-[12.5px] font-medium text-keeper-gold">{group.foot.label} →</Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
