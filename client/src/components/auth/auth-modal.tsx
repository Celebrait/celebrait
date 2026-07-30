// client/src/components/auth/auth-modal.tsx
//
// App-wide auth MODAL — renders the same <AuthForm> as /login, but as a
// blurred-backdrop dialog so landing/pricing CTAs keep the user inside
// the experience instead of bouncing to the full /login page.
//
// The /login route stays as the fallback (direct visits, protected-route
// redirects, email/OAuth returns). Both surfaces share <AuthForm> +
// authHeadingCopy(), so the copy + behaviour never drift.
//
// Usage: wrap the app in <AuthModalProvider> (see App.tsx), then any CTA
// calls const { openAuth } = useAuthModal(); openAuth('/studio/new-card').

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import logoSrc from '@/assets/logo-mark.webp';
import { AuthForm, authHeadingCopy, type AuthStep } from './auth-form';

const DEFAULT_REDIRECT = '/studio/new-card';

interface AuthModalContextValue {
  /** Open the auth modal. Pass the post-auth destination (defaults to the
   *  new-card studio flow). */
  openAuth: (redirect?: string) => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx)
    throw new Error('useAuthModal must be used within <AuthModalProvider>');
  return ctx;
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [redirect, setRedirect] = useState(DEFAULT_REDIRECT);
  const [location] = useLocation();

  const openAuth = useCallback((to: string = DEFAULT_REDIRECT) => {
    setRedirect(to);
    setOpen(true);
  }, []);

  // Close on navigation — a successful auth calls setLocation(redirect),
  // which would otherwise leave the modal open over the destination page.
  useEffect(() => {
    setOpen(false);
  }, [location]);

  return (
    <AuthModalContext.Provider value={{ openAuth }}>
      {children}
      <AuthDialog open={open} onOpenChange={setOpen} redirect={redirect} />
    </AuthModalContext.Provider>
  );
}

function AuthDialog({
  open,
  onOpenChange,
  redirect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirect: string;
}) {
  // Heading copy mirrors /login — driven by the form's step, synced via
  // onStepChange. Reset to the email step each time the modal opens.
  const [step, setStep] = useState<AuthStep>('email');
  useEffect(() => {
    if (open) setStep('email');
  }, [open]);

  const { heading, subline } = authHeadingCopy(step);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[200] bg-ink/25 backdrop-blur-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[200] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-3xl border border-stone-200 bg-surface-card p-8 md:p-10 shadow-2xl',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <img src={logoSrc} alt="Celebrait" className="h-8" />

          <div className="mt-8">
            <DialogPrimitive.Title className="text-2xl font-semibold text-ink tracking-tight leading-[1.1] md:text-3xl">
              {heading}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-3 max-w-[36ch] text-sm text-ink-soft">
              {subline}
            </DialogPrimitive.Description>
          </div>

          <div className="mt-7">
            <AuthForm defaultRedirect={redirect} onStepChange={setStep} />
          </div>

          <p className="mt-6 text-[11px] text-stone-400">
            By continuing you agree to our{' '}
            <a
              href="/terms-of-service"
              className="underline-offset-2 hover:text-stone-600 hover:underline"
            >
              Terms
            </a>{' '}
            and{' '}
            <a
              href="/privacy-policy"
              className="underline-offset-2 hover:text-stone-600 hover:underline"
            >
              Privacy Policy
            </a>
            .
          </p>

          <DialogPrimitive.Close
            className="absolute right-5 top-5 rounded-full p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
