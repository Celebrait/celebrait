// client/src/layouts/studio-layout.tsx
//
// Chrome for every customer-facing Studio page. Mirrors the Prompt Lab
// (admin-layout.tsx) structure — fixed sidebar + top header with avatar,
// main scroll area — so the app has consistent spatial mechanics between
// back office and customer studio.
//
// Differences from admin chrome:
//   - Warmer palette (no admin badge, no dark accents)
//   - Mobile collapses to a top bar + hamburger → Sheet drawer
//   - FAB floats bottom-right on the home view
//
// Sidebar IA (Week 1 dashboard rebuild, 2026-04-24):
//   - Pinned "+ New card" primary CTA at the top
//   - Cards section: Home / Drafts / Sent
//   - People section: greyed placeholder (Address book + Reminders land Week 2)
//   - Account section: Orders & delivery
//   - Previous single "My cards" item is replaced by Home+Drafts+Sent.
//
// The per-page greeting h1 previously rendered inline here — removed as
// part of the Week 1 rebuild so each page owns its own header.

import { Link, useLocation } from 'wouter';
import {
  CalendarHeart,
  LogOut,
  Menu,
  Home as HomeIcon,
  FileEdit,
  Send,
  Package,
  Users,
  Bell,
  Truck,
  Printer,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PRODUCTION_HOURS } from '@shared/pricing';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';
import logoSrc from '../assets/logo-mark.webp';
import { FabNewCard } from '@/components/studio/fab-new-card';
import { StudioHints } from '@/components/studio/studio-hints';
import { WelcomeMoment } from '@/components/studio/welcome-moment';
import { NotificationBell } from '@/components/studio/notification-bell';
import { DevTestFailurePanel } from '@/components/dev/dev-test-failure-panel';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** When true, rendered greyed-out and unclickable. Used for sections
   *  that are scaffolded but not yet populated (People → Week 2). */
  disabled?: boolean;
  /** First-run hint anchor id (see studio-hints.tsx). When set, the Link
   *  carries `data-hint` so a coachmark can point at it. */
  hint?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
  /** When true, the whole section is visible but its items are greyed
   *  placeholders. Used for People until the Week 2 items ship. */
  placeholder?: boolean;
}

// Primary sections. Order = visual top-to-bottom.
const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Cards',
    items: [
      { label: 'Home', href: '/studio', icon: HomeIcon },
      { label: 'Drafts', href: '/studio/drafts', icon: FileEdit, hint: 'drafts' },
      // Ready = generated but not purchased. Split out from Sent
      // 2026-04-24 so "Sent" means the card's actually on its way.
      { label: 'Ready', href: '/studio/ready', icon: Package },
      { label: 'Sent', href: '/studio/sent', icon: Send },
    ],
  },
  {
    label: 'People',
    items: [
      // Week 2 (2026-04-29): Address book + Reminders both live.
      // One roof (Kevin 2026-08-01): Moments replaces Address book +
      // Reminders in the nav. Both old pages stay routable — Moments
      // links to them for management — but the sidebar sells the idea,
      // not the furniture.
      { label: 'Moments', href: '/studio/moments', icon: CalendarHeart, hint: 'moments' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Orders & delivery', href: '/studio/orders', icon: Truck },
    ],
  },
];

// Route patterns where the FAB would be noise. Either the page IS the
// new-card flow (maker), or the page is actively pushing the user
// toward another CTA (Buy on the card viewer — we don't want the
// green "New card" competing for attention there).
const HIDE_FAB_ON: RegExp[] = [
  /^\/studio\/new-card(?:\/|$)/,
  /^\/studio\/card\/[^/]+\/edit$/,
  /^\/studio\/card\/[^/]+$/, // viewer — Buy is the primary action
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  return (
    <nav className="flex-1 py-4 overflow-y-auto">
      {/* Pinned primary CTA. Links to the new-card flow — same target as
          the FAB. Green (cta) — "New card" is a decided super-important
          moment (start of the value loop), matching the grid tile; reads
          as the primary action regardless of which page the user is on. */}
      <div className="px-3 mb-4">
        <Link
          href="/studio/new-card"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 w-full bg-cta hover:bg-cta-hover text-cta-foreground rounded-full py-2.5 text-sm font-semibold transition-colors shadow-sm"
          data-testid="nav-new-card-cta"
          data-hint="new-card"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          New card
        </Link>
      </div>

      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-4">
          <div
            className={`px-4 text-[10px] font-semibold uppercase tracking-wider mb-1 ${
              section.placeholder ? 'text-keeper-meta/50' : 'text-keeper-meta'
            }`}
          >
            {section.label}
          </div>
          {section.items.map((item) => {
            const Icon = item.icon;
            const isActive =
              !item.disabled &&
              (location === item.href ||
                (item.href !== '/studio' && location.startsWith(item.href + '/')));

            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-2 px-3 py-2 mx-2 rounded-lg text-sm text-keeper-meta/50 cursor-not-allowed select-none"
                  data-testid={`nav-disabled-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-2 px-3 py-2 mx-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-keeper-gold-wash text-keeper-gold-deep font-medium'
                    : 'text-keeper-ink hover:bg-keeper-gold-wash/50'
                }`}
                data-testid={`nav-${item.href}`}
                data-hint={item.hint}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="h-16 flex items-center px-4 border-b border-keeper-hair">
        <Link
          href="/studio"
          onClick={onNavigate}
          className="flex items-center"
          data-testid="studio-logo"
        >
          <img src={logoSrc} alt="Celebrait" className="h-8 object-contain" />
        </Link>
      </div>
      <NavList onNavigate={onNavigate} />
    </>
  );
}

export default function StudioLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // The notification polling + toasts now live inside <NotificationBell />
  // (mounted in the header below), so the bell and its driver share one
  // query and one mount point across every Studio surface.

  const initials = user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?';
  const showFab = !HIDE_FAB_ON.some((rx) => rx.test(location));

  return (
    <div className="min-h-screen bg-keeper-paper flex">
      {/* ─── Sidebar (desktop, sm and up) ─── */}
      <aside className="relative z-40 hidden sm:flex w-56 bg-white/70 backdrop-blur-md border-r border-keeper-hair flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* ─── Main column ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header — same 16px bar as admin layout, with mobile hamburger.
            `relative z-40` gives the header (and its z-50 notification /
            what's-new dropdowns) a stacking context ABOVE <main> — otherwise
            a 3D card's bleeding canvas in the content area paints over the
            open dropdowns (they're absolute-in-header, not portaled). */}
        <header className="relative z-40 h-16 bg-white/70 backdrop-blur-md border-b border-keeper-hair flex items-center px-4 sm:px-6 gap-3 flex-shrink-0">
          {/* Hamburger (mobile only) */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="sm:hidden -ml-2"
                data-testid="btn-studio-menu"
                aria-label="Open navigation"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-56 p-0 bg-keeper-paper">
              <SheetTitle className="sr-only">Studio navigation</SheetTitle>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Mobile-only logo so the empty sidebar on small screens isn't jarring */}
          <Link href="/studio" className="sm:hidden flex items-center">
            <img src={logoSrc} alt="Celebrait" className="h-8 object-contain" />
          </Link>

          {/* Spacer pushes the bell + avatar + logout to the right */}
          <div className="flex-1" />

          {/* What's New drawer hidden site-wide (Kevin 2026-07-22 — not
              needed atm). Component + <WhatsNewDrawer/> import kept for an
              easy re-enable. */}
          <NotificationBell />

          <div className="flex items-center gap-2 bg-white/70 border border-keeper-hair rounded-full pl-1 pr-3 py-1">
            <div className="w-7 h-7 rounded-full bg-keeper-gold flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            <span className="text-xs text-keeper-meta max-w-[140px] truncate hidden sm:block">
              {user?.email}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            aria-label="Log out"
            className="text-keeper-meta hover:text-keeper-ink hover:bg-keeper-gold-wash"
            data-testid="btn-studio-logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Log out</span>
          </Button>
        </header>

        {/* Production-time notice — every card is printed to order (up to
            72h before dispatch). Kept honest + visible across the whole app
            so the expectation is set well before checkout. */}
        {/* Production-time notice as a quiet lavender pill floating on the
            paper (Kevin 2026-07-11 — the dark gradient bar read as "too
            much"). Still sits right under the header so the 72h expectation
            is set before checkout, just whisper-weight now. Printer icon
            (it's about printing, not shipping). */}
        <div className="relative z-30 flex-shrink-0 flex justify-center px-4 pt-3 sm:pt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-muted border border-brand-light px-3.5 py-1.5 max-w-[560px]">
            <Printer className="w-3.5 h-3.5 flex-shrink-0 text-brand-dark" strokeWidth={2} />
            <span className="text-[11px] sm:text-xs text-brand-dark leading-snug">
              Printed to order — up to {PRODUCTION_HOURS} hrs production, then your chosen delivery on top.
            </span>
          </span>
        </div>

        {/* Main scroll area. Per-page headers live inside `children`
            (Week 1 dashboard rebuild) — the layout no longer owns the
            greeting h1, so each surface can tune its own copy. */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
            {children}
          </div>
        </main>
      </div>

      {/* ─── FAB (conditional, outside the column so it's always relative to the viewport) ─── */}
      {showFab && <FabNewCard />}

      {/* First-arrival focal greeting (centred + soft backdrop). Shows
          once, then the hints walkthrough takes over. */}
      <WelcomeMoment />

      {/* First-run coachmarks pointing at the key studio touchpoints.
          Self-suppresses on the maker/viewer/checkout surfaces and once
          each hint has been seen. */}
      <StudioHints />

      {/* ─── Dev-only test failure panel ─────────────────────────────
          Lets Kevin inject synthetic ProviderErrors into the next
          stub-mode gen for iterating on the GenerationErrorPanel UI.
          Tree-shaken from prod bundles via import.meta.env.DEV check
          inside the component. */}
      <DevTestFailurePanel />
    </div>
  );
}
