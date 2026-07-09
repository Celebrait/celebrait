// client/src/layouts/checkout-layout.tsx
//
// Minimal chrome for the three checkout pages. Same header bar as
// StudioLayout (h-16, bg-white, border-b border-stone-200) + the
// studio bg-surface page colour, but the sidebar is deliberately
// gone — a sidebar at a payment moment is a conversion killer.
//
// The single piece of chrome that matters: a "← Back" link. On the
// form page it points back to the card's review step; on the success
// / cancelled pages it points back to Studio home.

import { Link } from 'wouter';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import logoSrc from '../assets/Logo2.png';
import type { ReactNode } from 'react';

interface CheckoutLayoutProps {
  children: ReactNode;
  backHref: string;
  backLabel?: string;
}

export default function CheckoutLayout({
  children,
  backHref,
  backLabel = 'Back to your card',
}: CheckoutLayoutProps) {
  const { user, logout } = useAuth();
  const initials =
    (user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase() +
    (user?.lastName?.[0] ?? '').toUpperCase();

  return (
    <div className="min-h-screen bg-keeper-paper flex flex-col">
      <header className="h-16 bg-white/70 backdrop-blur-md border-b border-keeper-hair flex items-center px-4 sm:px-6 gap-3 flex-shrink-0">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-keeper-stone hover:text-keeper-ink transition-colors"
          data-testid="checkout-back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{backLabel}</span>
        </Link>

        <div className="flex-1 flex justify-center">
          <Link href="/studio" className="flex items-center">
            <img src={logoSrc} alt="Celebrait" className="h-8 object-contain" />
          </Link>
        </div>

        <div className="flex items-center gap-2 bg-white/70 border border-keeper-hair rounded-full pl-1 pr-3 py-1">
          <div className="w-7 h-7 rounded-full bg-keeper-gold flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          <span className="text-xs text-keeper-stone max-w-[140px] truncate hidden sm:block">
            {user?.email}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout()}
          className="text-keeper-stone hover:text-keeper-ink hover:bg-keeper-gold-wash"
          data-testid="checkout-logout"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Log out</span>
        </Button>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
