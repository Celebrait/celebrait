// client/src/pages/login.tsx
//
// Boxed split-pane sign-in. Auth + Landing sprint, Piece A1 (2026-05-01).
//
// Structure (per the design spec):
//
//   ┌─────────────────────────────────────────────────────────┐
//   │ ╔══════════════════════╤══════════════════════╗         │
//   │ ║  [Logo]              │                      ║         │
//   │ ║                      │   ┌──────────────┐   ║         │
//   │ ║  Pick up where       │   │  Static card │   ║         │
//   │ ║  you left off.       │   │   poster on  │   ║         │
//   │ ║                      │   │  cream wash  │   ║         │
//   │ ║  [Continue Google]   │   └──────────────┘   ║         │
//   │ ║  ─── or ───          │                      ║         │
//   │ ║  [Email]             │   "For the people    ║         │
//   │ ║  [Send code (cta)]   │    who matter…"      ║         │
//   │ ║                      │                      ║         │
//   │ ║  Trust line          │                      ║         │
//   │ ╚══════════════════════╧══════════════════════╝         │
//   └─────────────────────────────────────────────────────────┘
//   bg-surface canvas, centred container card.
//
// Mobile: hero pane hides; form pane fills the boxed card. The card
// stays visible (rounded-2xl) — even on mobile, the boxed treatment is
// the design language. Goes full-width with margin gutter.
//
// Login is an INFORMATION surface (per HERO_CARD.md), so the right
// pane gets a STATIC card poster, not a Three.js viewer. Saves ~250kB
// of JS, reads more dignified than an auto-rotating card on a sign-in
// screen.

import { useEffect, useState } from 'react';
import { AuthForm, authHeadingCopy, type AuthStep } from '@/components/auth/auth-form';
import { toast } from '@/hooks/use-toast';
import logoSrc from '@/assets/Logo2.png';
import fathersDayFront from '@/assets/fathers-day-front.png';

// Maps the ?error=… code that the Google OAuth callback bounces with
// onto a user-readable message. Keeps the failure path visible.
const GOOGLE_ERROR_COPY: Record<string, { title: string; description: string }> = {
  state_mismatch: {
    title: 'Sign-in interrupted',
    description: 'Your session expired before sign-in completed. Please try again.',
  },
  email_unverified: {
    title: 'Email not verified',
    description: 'Verify your email with Google first, then try again.',
  },
  no_email: {
    title: "Couldn't read your email",
    description: 'Google did not return an email address for this account.',
  },
  token_exchange: {
    title: 'Sign-in failed',
    description: 'Google rejected the sign-in. Please try again.',
  },
  userinfo: {
    title: 'Sign-in failed',
    description: "We couldn't fetch your Google profile. Please try again.",
  },
  callback: {
    title: 'Sign-in failed',
    description: 'Something went wrong on our end. Please try again.',
  },
  session: {
    title: 'Sign-in failed',
    description: "Your session couldn't be saved. Please try again.",
  },
  missing_code: {
    title: 'Sign-in cancelled',
    description: 'You cancelled before sign-in completed.',
  },
  access_denied: {
    title: 'Sign-in cancelled',
    description: 'You cancelled the Google permission prompt.',
  },
};

export default function LoginPage() {
  // Mirror the AuthForm's step so the headline above the form swaps
  // copy in sync. The form owns the state machine; the page owns the
  // typography. AuthForm fires onStepChange whenever it transitions.
  const [step, setStep] = useState<AuthStep>('email');
  const [email] = useState(''); // for "We sent a code to …" — not currently used; subline is generic until we hoist email up too. Keeping the slot for the future.
  const { heading, subline } = authHeadingCopy(step, email);

  // Surface Google OAuth callback errors as a toast on first paint.
  // Strips the `?error=` from the URL so a refresh doesn't re-toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get('error');
    if (!errorCode) return;
    const copy = GOOGLE_ERROR_COPY[errorCode] ?? {
      title: 'Sign-in failed',
      description: errorCode,
    };
    toast({ ...copy, variant: 'destructive' });
    params.delete('error');
    const newSearch = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`,
    );
  }, []);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center relative overflow-hidden">
      {/* Whisper-quiet ambient blobs — coral top-left, amber bottom-
          right. Brand warmth without competing with the boxed card. */}
      <div
        aria-hidden
        className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, #ffe4ef, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, #fef3c7, transparent 70%)' }}
      />

      {/* The boxed container card — 50/50 split on desktop, form-only
          on mobile. Big soft shadow, generous rounded corners. */}
      <div
        className="relative w-full max-w-[1040px] mx-4 my-8 md:mx-12 md:my-12 bg-surface-card rounded-2xl md:rounded-3xl border border-stone-200 overflow-hidden grid grid-cols-1 md:grid-cols-2"
        style={{
          boxShadow:
            '0 30px 80px -30px rgba(15,23,42,0.18), 0 12px 24px -12px rgba(15,23,42,0.08)',
          minHeight: '620px',
        }}
      >
        {/* ── Form pane ───────────────────────────────────────────── */}
        <div className="flex flex-col p-8 md:p-12 lg:p-14">
          {/* Logo top-left */}
          <img src={logoSrc} alt="Celebrait" className="h-8 self-start" />

          {/* 64px gap → headline. Centred vertically within the
              remaining height so the form sits comfortably regardless
              of how tall the card ends up. */}
          <div className="flex-1 flex flex-col justify-center mt-12 md:mt-14">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-semibold text-ink tracking-tight leading-[1.1]">
                {heading}
              </h1>
              <p className="text-sm text-ink-soft mt-3 max-w-[36ch]">{subline}</p>
            </div>

            <AuthForm onStepChange={setStep} />

            <p className="text-[11px] text-stone-400 mt-6">
              By continuing you agree to our{' '}
              <a
                href="/terms-of-service"
                className="underline-offset-2 hover:underline hover:text-stone-600"
              >
                Terms
              </a>{' '}
              and{' '}
              <a
                href="/privacy-policy"
                className="underline-offset-2 hover:underline hover:text-stone-600"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>

        {/* ── Hero pane ───────────────────────────────────────────── */}
        {/* Hidden on mobile per spec — the static card adds nothing
            for a user who's already at /login on a phone. */}
        <div
          className="hidden md:flex relative items-center justify-center p-10 lg:p-14"
          style={{
            background:
              'radial-gradient(900px 680px at 50% 40%, #fff8ec 0%, #fef7ed 50%, #fbeed5 100%)',
          }}
        >
          {/* Card poster — framed, drop-shadowed, with a manufactured
              contact shadow underneath so it feels grounded on the
              cream surface. */}
          <div className="relative flex flex-col items-center max-w-[440px] w-full">
            <div className="relative w-[min(90%,360px)] aspect-square">
              <img
                src={fathersDayFront}
                alt="A Celebrait greeting card"
                className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                style={{
                  boxShadow:
                    '0 30px 60px -20px rgba(15,23,42,0.32), 0 12px 24px -12px rgba(15,23,42,0.16)',
                }}
                // @ts-expect-error — fetchpriority is valid HTML, types lag
                fetchpriority="high"
              />
              <div
                aria-hidden
                className="absolute left-1/2 -translate-x-1/2 -bottom-5 h-5 w-[78%] rounded-[50%] blur-2xl opacity-50"
                style={{
                  background:
                    'radial-gradient(closest-side, rgba(15,23,42,0.45), transparent 70%)',
                }}
              />
            </div>

            {/* Pull-quote — the only typographic moment on this side.
                Italic body, ink-soft, kept narrow. */}
            <p className="text-base md:text-lg text-ink-soft italic text-center mt-12 max-w-[28ch] leading-relaxed">
              For the people who matter — in their hands by Friday.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
