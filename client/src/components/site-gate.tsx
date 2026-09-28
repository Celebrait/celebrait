// client/src/components/site-gate.tsx
//
// The pre-launch lock, client side (server/routes/site-lock.ts is the
// real gate on the APIs). While the site is locked, every page except the
// ones below shows the launching-soon page; the share password or an
// admin session lets a visitor through.

import { lazy, Suspense, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

const ComingSoonPage = lazy(() => import('@/pages/coming-soon'));

// Always open: signing in, the back office, legal pages, and links that
// already went out to real people (a recipient's card, an order).
const OPEN: RegExp[] = [
  /^\/login/, /^\/admin/, /^\/demo/, /^\/privacy-policy/, /^\/terms-of-service/, /^\/contact/,
  /^\/c\//, /^\/card\/[^/]+\/view/, /^\/order\//, /^\/checkout\/(success|cancelled)/,
  /^\/card-capture/, /^\/og(\/|$)/,
];

interface LockState { locked: boolean; allowed: boolean; hasPassword: boolean }

export function SiteGate({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data, isError, refetch } = useQuery<LockState>({
    queryKey: ['/api/site-lock', (user as { id?: string } | null | undefined)?.id ?? 'guest'],
    queryFn: async () => {
      const r = await fetch('/api/site-lock', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  if (OPEN.some((re) => re.test(location))) return <>{children}</>;
  if (!data && !isError) return <div className="min-h-screen bg-keeper-paper" />;
  // If the check itself fails, stay closed: the lock is the point.
  if (isError || (data && data.locked && !data.allowed)) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-keeper-paper" />}>
        <ComingSoonPage hasPassword={data?.hasPassword ?? true} onUnlocked={() => { void refetch(); }} />
      </Suspense>
    );
  }
  return <>{children}</>;
}
