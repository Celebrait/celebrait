// client/src/layouts/admin-layout.tsx
//
// Chrome for every back-office page. Uses the Celebrait brand palette:
// warm violet primary, stone neutrals, green CTAs.

import { Link, useLocation } from 'wouter';
import { LogOut, ExternalLink, Sparkles, BarChart3, Mail, Users, TrendingUp, Image as ImageIcon, type LucideIcon, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import logoSrc from '../assets/logo-mark.webp';
import type { ReactNode } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Customers', href: '/admin/customers', icon: Users },
  { label: 'Analytics', href: '/admin/analytics', icon: TrendingUp },
  { label: 'Prompt Lab', href: '/admin/prompts', icon: Sparkles },
  { label: 'Photo Lab', href: '/admin/photo-lab', icon: ImageIcon },
  { label: 'Card Lab', href: '/admin/card-lab', icon: ImageIcon },
  { label: 'Cost Ledger', href: '/admin/costs', icon: BarChart3 },
  { label: 'Emails', href: '/admin/emails', icon: Mail },
  { label: 'Social studio', href: '/admin/social', icon: Share2 },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const initials = user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="min-h-screen bg-surface flex">
      {/* ─── Sidebar ─── */}
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center gap-2 px-4 border-b border-stone-200">
          <img src={logoSrc} alt="Celebrait" className="h-8 object-contain" />
          <Badge className="bg-violet-600 hover:bg-violet-600 text-white text-[10px] h-5">
            ADMIN
          </Badge>
        </div>
        <nav className="flex-1 py-4">
          <div className="px-3 text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
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
                    ? 'bg-violet-50 text-violet-700 font-medium'
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
        <div className="border-t border-stone-200 p-3">
          <a
            href="/"
            className="flex items-center gap-2 px-2 py-2 text-xs text-stone-500 hover:text-stone-700 rounded hover:bg-stone-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Customer site
          </a>
        </div>
      </aside>

      {/* ─── Main content area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-end px-6 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 bg-stone-50 rounded-full pl-1 pr-3 py-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            <span className="text-xs text-stone-700 max-w-[180px] truncate">
              {user?.email}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="text-stone-500 hover:text-red-600 hover:bg-red-50"
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
