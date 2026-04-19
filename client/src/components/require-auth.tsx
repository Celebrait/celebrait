// client/src/components/require-auth.tsx
//
// Client-side route guards. Wrap a page component in <RequireAuth> to
// force a redirect to /login if the user isn't signed in, or in
// <RequireAdmin> to additionally enforce users.is_admin=true.
//
// The server is the source of truth — these client-side guards just make
// the UX sensible (redirect to /login with a ?redirect= pointer) and hide
// back-office screens from non-admin users quickly. The server still
// rejects unauthorised requests with 401/403 regardless.

import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

interface RequireAuthProps {
  children: ReactNode;
  /** Where to send non-authed users. Defaults to /login?redirect=<current>. */
  fallback?: string;
}

export function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const target =
        fallback ??
        `/login?redirect=${encodeURIComponent(
          window.location.pathname + window.location.search,
        )}`;
      setLocation(target);
    }
  }, [isAuthenticated, isLoading, fallback, setLocation]);

  if (isLoading) {
    return <FullPageSpinner label="Loading…" />;
  }
  if (!isAuthenticated) {
    return null; // redirect fires in the effect
  }
  return <>{children}</>;
}

interface RequireAdminProps {
  children: ReactNode;
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLocation(
        `/login?redirect=${encodeURIComponent(
          window.location.pathname + window.location.search,
        )}`,
      );
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return <FullPageSpinner label="Loading…" />;
  }
  if (!isAuthenticated) {
    return null;
  }
  if (!(user as any)?.isAdmin) {
    return <NotAdminScreen email={(user as any)?.email ?? null} />;
  }
  return <>{children}</>;
}

// ─── Helper screens ──────────────────────────────────────────────────────────

function FullPageSpinner({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <div className="inline-block h-10 w-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        <p className="text-sm text-stone-500 mt-3">{label}</p>
      </div>
    </div>
  );
}

function NotAdminScreen({ email }: { email: string | null }) {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="max-w-md w-full bg-white rounded-xl border border-stone-200 shadow-sm p-8 text-center">
        <div className="text-5xl mb-3">🔒</div>
        <h1 className="text-xl font-bold text-stone-900 mb-2">Admin area</h1>
        <p className="text-sm text-stone-600 mb-1">
          You're signed in as{' '}
          <strong className="text-stone-900">{email ?? 'unknown'}</strong>, but
          this account doesn't have admin access.
        </p>
        <p className="text-xs text-stone-500 mb-6">
          If you need access, grant it via:
          <br />
          <code className="bg-stone-100 px-2 py-0.5 rounded text-[11px]">
            npx tsx server/scripts/make-admin.ts {email ?? '<email>'}
          </code>
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setLocation('/')}
            className="px-4 py-2 text-sm rounded border border-stone-200 hover:bg-stone-50"
          >
            Back to Celebrait
          </button>
          <button
            onClick={() => {
              window.location.href = '/login';
            }}
            className="px-4 py-2 text-sm rounded bg-violet-600 text-white hover:bg-violet-700"
          >
            Use another account
          </button>
        </div>
      </div>
    </div>
  );
}
