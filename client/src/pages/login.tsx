// client/src/pages/login.tsx
//
// Branded centred sign-in — matched to the homepage (2026-06-25).
//
//   • Page background: the homepage's white→lilac wash + the floating
//     celebration icons (heart/ring/cake/present/celebrate/ribbon),
//     faint + drifting, so /login feels like the same world as `/`.
//   • A single centred sign-in box sits over the field. Primary button
//     is violet (brand), matching the homepage hero CTA.

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AuthForm, authHeadingCopy, type AuthStep } from '@/components/auth/auth-form';
import { toast } from '@/hooks/use-toast';
import logoSrc from '@/assets/logo-mark.webp';
import heartIcon from '@/assets/icons/heart.png';
import ringIcon from '@/assets/icons/ring.png';
import cakeIcon from '@/assets/icons/cake.png';
import presentIcon from '@/assets/icons/present.png';
import celebrateIcon from '@/assets/icons/celebrate.png';
import ribbonIcon from '@/assets/icons/ribbon.png';

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

// The floating celebration field — same icons as the homepage backdrop,
// here static (no scroll coupling) and spread around the centred box.
// Top icons sit smaller + fainter (depth), bottom icons larger + warmer.
const FLOAT_ICONS = [
  { src: heartIcon, pos: 'top-[10%] left-[8%]', size: 74, opacity: 0.5, tilt: -8, delay: 0 },
  { src: ringIcon, pos: 'top-[14%] right-[9%]', size: 68, opacity: 0.5, tilt: 7, delay: 1.4 },
  { src: celebrateIcon, pos: 'top-[46%] left-[6%]', size: 60, opacity: 0.4, tilt: -5, delay: 2.2, hideSm: true },
  { src: ribbonIcon, pos: 'top-[42%] right-[6%]', size: 60, opacity: 0.4, tilt: 6, delay: 0.8, hideSm: true },
  { src: cakeIcon, pos: 'bottom-[10%] left-[11%]', size: 112, opacity: 0.7, tilt: -9, delay: 0.6 },
  { src: presentIcon, pos: 'bottom-[13%] right-[10%]', size: 108, opacity: 0.68, tilt: 8, delay: 1.9 },
];

function FloatingField({ reduced }: { reduced: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {FLOAT_ICONS.map((ic, i) => (
        <motion.img
          key={i}
          src={ic.src}
          alt=""
          className={`absolute ${ic.pos} ${ic.hideSm ? 'hidden lg:block' : ''}`}
          style={{ width: ic.size, opacity: ic.opacity, rotate: ic.tilt }}
          initial={{ y: 0 }}
          animate={reduced ? undefined : { y: [0, -14, 0] }}
          transition={
            reduced ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: ic.delay }
          }
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const reduced = useReducedMotion() ?? false;
  // Mirror the AuthForm's step so the headline above the form swaps copy
  // in sync. The form owns the state machine; the page owns the typography.
  const [step, setStep] = useState<AuthStep>('email');
  const [email] = useState('');
  const { heading, subline } = authHeadingCopy(step, email);

  // Surface Google OAuth callback errors as a toast on first paint.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get('error');
    if (!errorCode) return;
    const copy = GOOGLE_ERROR_COPY[errorCode] ?? { title: 'Sign-in failed', description: errorCode };
    toast({ ...copy, variant: 'destructive' });
    params.delete('error');
    const newSearch = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`);
  }, []);

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f3f2fb 100%)' }}
    >
      {/* Homepage floating-icon field, behind the box. */}
      <FloatingField reduced={reduced} />

      {/* Single centred sign-in box. */}
      <div
        className="relative z-10 w-full max-w-[440px] rounded-2xl border border-stone-200 bg-surface-card p-8 sm:p-10 md:rounded-3xl"
        style={{
          boxShadow: '0 30px 80px -30px rgba(15,23,42,0.18), 0 12px 24px -12px rgba(15,23,42,0.08)',
        }}
      >
        <img src={logoSrc} alt="Celebrait" className="h-8" />

        <div className="mb-8 mt-10">
          <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight text-ink">
            {heading}
          </h1>
          <p className="mt-3 max-w-[36ch] text-sm text-ink-soft">{subline}</p>
        </div>

        {/* accent="brand" → the violet sign-in button (matches homepage). */}
        <AuthForm onStepChange={setStep} accent="brand" />

        <p className="mt-6 text-[11px] text-stone-400">
          By continuing you agree to our{' '}
          <a href="/terms-of-service" className="underline-offset-2 hover:text-stone-600 hover:underline">
            Terms
          </a>{' '}
          and{' '}
          <a href="/privacy-policy" className="underline-offset-2 hover:text-stone-600 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
