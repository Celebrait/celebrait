// client/src/layouts/admin-layout.tsx
//
// Chrome for every back-office page. Provides:
//   - A top bar with Celebrait logo, "ADMIN" badge, current user chip,
//     and a logout button
//   - A left sidebar with nav links to admin sections (currently just
//     Prompt Lab; more land here as phases ship)
//   - A link back to the customer site
//
// Wrap any page that should live inside the back office:
//   <AdminLayout>
//     <YourPage />
//   </AdminLayout>
//
// Auth is enforced by <RequireAdmin> at the route level, NOT by this
// layout — layout just renders. Separation of concerns.

import { Link, useLocation } from 'wouter';
import { LogOut, ExternalLink, Sparkles, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import logoSrc from '../assets/Logo2.png';
import type { ReactNode } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Add new admin pages here. Keep the list short — if it grows past ~6
// items we'll want grouping.
const NAV_ITEMS: NavItem[] = [
  { label: 'Prompt Lab', href: '/admin/prompts', icon: Sparkles },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const initials = user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ─── Sidebar ─── */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center gap-2 px-4 border-b border-gray-200">
          <img src={logoSrc} alt="Celebrait" className="h-8 object-contain" />
          <Badge className="bg-purple-600 hover:bg-purple-600 text-white text-[10px] h-5">
            ADMIN
          </Badge>
        </div>
        <nav className="flex-1 py-4">
          <div className="px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Back office
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || location.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 mx-2 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-purple-50 text-purple-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                data-testid={`nav-${item.href}`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 p-3">
          <a
            href="/"
            className="flex items-center gap-2 px-2 py-2 text-xs text-gray-500 hover:text-gray-700 rounded hover:bg-gray-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Customer site
          </a>
        </div>
      </aside>

      {/* ─── Main content area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-end px-6 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 rounded-full pl-1 pr-3 py-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            <span className="text-xs text-gray-700 max-w-[180px] truncate">
              {user?.email}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="text-gray-500 hover:text-red-600 hover:bg-red-50"
            data-testid="btn-admin-logout"
          >
            <LogOut className="w-4 h-4 mr-1" />
            Log out
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
