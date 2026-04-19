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
// Locked in Sprint 2:
//   - Sidebar nav (switched from top-nav mid-sprint)
//   - One item today: "My cards". Photos / Account / Help slots appear as built.
//   - FAB visible on /studio home, hidden in the card maker flows

import { Link, useLocation } from 'wouter';
import { LogOut, Menu, Sparkles, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';
import logoSrc from '../assets/Logo2.png';
import { FabNewCard } from '@/components/studio/fab-new-card';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Today's Studio has one section. Additional items (Photos library,
// Account, Help) drop in here as they're built — no layout churn.
const NAV_ITEMS: NavItem[] = [
  { label: 'My cards', href: '/studio', icon: Sparkles },
];

// Route patterns where the FAB would be noise. The card maker already IS
// the new-card flow; don't double up.
const HIDE_FAB_ON: RegExp[] = [/^\/studio\/new-card(?:\/|$)/, /^\/studio\/card\/[^/]+\/edit$/];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  return (
    <nav className="flex-1 py-4">
      <div className="px-3 text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
        Studio
      </div>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.href || location.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-2 px-3 py-2 mx-2 rounded text-sm transition-colors ${
              isActive
                ? 'bg-brand-muted text-brand-dark font-medium'
                : 'text-stone-700 hover:bg-stone-50'
            }`}
            data-testid={`nav-${item.href}`}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="h-16 flex items-center px-4 border-b border-stone-200">
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

  const initials = user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?';
  const displayName = user?.firstName || user?.email?.split('@')[0] || 'there';
  const showFab = !HIDE_FAB_ON.some((rx) => rx.test(location));
  const isOnHome = location === '/studio' || location === '/studio/';

  return (
    <div className="min-h-screen bg-surface flex">
      {/* ─── Sidebar (desktop, sm and up) ─── */}
      <aside className="hidden sm:flex w-56 bg-white border-r border-stone-200 flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* ─── Main column ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header — same 16px bar as admin layout, with mobile hamburger */}
        <header className="h-16 bg-white border-b border-stone-200 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0">
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
            <SheetContent side="left" className="w-56 p-0 bg-white">
              <SheetTitle className="sr-only">Studio navigation</SheetTitle>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Mobile-only logo so the empty sidebar on small screens isn't jarring */}
          <Link href="/studio" className="sm:hidden flex items-center">
            <img src={logoSrc} alt="Celebrait" className="h-8 object-contain" />
          </Link>

          {/* Spacer pushes avatar + logout to the right */}
          <div className="flex-1" />

          <div className="flex items-center gap-2 bg-stone-50 rounded-full pl-1 pr-3 py-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            <span className="text-xs text-stone-700 max-w-[140px] truncate hidden sm:block">
              {user?.email}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="text-stone-500 hover:text-red-600 hover:bg-red-50"
            data-testid="btn-studio-logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Log out</span>
          </Button>
        </header>

        {/* Main scroll area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
            {isOnHome && (
              <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-semibold text-ink">
                  Hi {displayName} <span className="text-accent-amber">✨</span>
                </h1>
                <p className="text-sm text-stone-600 mt-1">
                  Your studio — every card you've crafted, all in one place.
                </p>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      {/* ─── FAB (conditional, outside the column so it's always relative to the viewport) ─── */}
      {showFab && <FabNewCard />}
    </div>
  );
}
