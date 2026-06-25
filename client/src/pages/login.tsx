// client/src/pages/login.tsx
//
// Branded split sign-in — matched to the homepage (2026-06-25 redesign).
//
//   • Page background: the homepage's white→lilac wash + the floating
//     celebration icons (heart/ring/cake/present/celebrate/ribbon),
//     faint + drifting, so /login feels like the same world as `/`.
//   • Left: the sign-in box. Primary button is violet (brand), matching
//     the homepage hero CTA (AuthForm accent="brand").
//   • Right: an engaging violet panel — the card poster + a violet
//     shimmer headline + a rotating line of real site taglines.
//
// Mobile: the right panel hides; the form box fills. The floating icons
// stay as a quiet backdrop.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AuthForm, authHeadingCopy, type AuthStep } from '@/components/auth/auth-form';
import { toast } from '@/hooks/use-toast';
import logoSrc from '@/assets/Logo2.png';
import fathersDayFront from '@/assets/fathers-day-front.png';
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
// here static (no scroll coupling) and confined behind the boxed card.
// Top icons sit smaller + fainter (depth), bottom icons larger + warmer.
const FLOAT_ICONS = [
  { src: heartIcon, pos: 'top-[9%] left-[5%]', size: 74, opacity: 0.5, tilt: -8, delay: 0 },
  { src: ringIcon, pos: 'top-[13%] right-[6%]', size: 68, opacity: 0.5, tilt: 7, delay: 1.4 },
  { src: celebrateIcon, pos: 'top-[44%] left-[2%]', size: 60, opacity: 0.4, tilt: -5, delay: 2.2, hideSm: true },
  { src: ribbonIcon, pos: 'top-[40%] right-[2%]', size: 60, opacity: 0.4, tilt: 6, delay: 0.8, hideSm: true },
  { src: cakeIcon, pos: 'bottom-[8%] left-[8%]', size: 116, opacity: 0.72, tilt: -9, delay: 0.6 },
  { src: presentIcon, pos: 'bottom-[11%] right-[7%]', size: 110, opacity: 0.7, tilt: 8, delay: 1.9 },
];

// Real lines from the site, cycled on the hero panel.
const TAGLINES = [
  '100% creative control.',
  'Impossible to forget.',
  'For the people who matter.',
  'In their hands by Friday.',
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

function RotatingTagline({ reduced }: { reduced: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % TAGLINES.length), 2800);
    return () => window.clearInterval(t);
  }, [reduced]);
  return (
    <div className="relative mt-7 h-6 w-full text-center">
      <AnimatePresence mode="wait">
        <motion.p
          key={i}
          className="absolute inset-x-0 text-[15px] font-medium text-brand-dark"
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {TAGLINES[i]}
        </motion.p>
      </AnimatePresence>
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
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f3f2fb 100%)' }}
    >
      {/* Homepage floating-icon field, behind the card. */}
      <FloatingField reduced={reduced} />

      {/* The boxed container card — 50/50 on desktop, form-only on mobile. */}
      <div
        className="relative z-10 mx-4 my-8 grid w-full max-w-[1040px] grid-cols-1 overflow-hidden rounded-2xl border border-stone-200 bg-surface-card md:mx-12 md:my-12 md:grid-cols-2 md:rounded-3xl"
        style={{
          boxShadow: '0 30px 80px -30px rgba(15,23,42,0.18), 0 12px 24px -12px rgba(15,23,42,0.08)',
          minHeight: '620px',
        }}
      >
        {/* ── Form pane ───────────────────────────────────────────── */}
        <div className="flex flex-col p-8 md:p-12 lg:p-14">
          <img src={logoSrc} alt="Celebrait" className="h-8 self-start" />

          <div className="mt-12 flex flex-1 flex-col justify-center md:mt-14">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight text-ink md:text-4xl">
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

        {/* ── Hero pane — violet, engaging, site copy ──────────────── */}
        <div
          className="relative hidden items-center justify-center overflow-hidden p-10 md:flex lg:p-14"
          style={{
            background:
              'radial-gradient(820px 620px at 50% 32%, #faf8ff 0%, #f1edfe 52%, #e7e1fb 100%)',
          }}
        >
          <div className="relative flex w-full max-w-[440px] flex-col items-center text-center">
            {/* Violet shimmer headline — the homepage's signature move. */}
            <h2 className="font-display text-[30px] font-bold leading-[1.05] tracking-[-0.02em] text-ink md:text-[36px]">
              Cards they'll{' '}
              <motion.span
                className="inline-block bg-clip-text px-0.5 text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, #5c57d4 0%, #7a76e8 35%, #a78bfa 50%, #7a76e8 65%, #5c57d4 100%)',
                  backgroundSize: '220% 100%',
                  backgroundRepeat: 'no-repeat',
                }}
                initial={{ backgroundPosition: '0% 0%' }}
                animate={reduced ? undefined : { backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }}
                transition={
                  reduced
                    ? undefined
                    : { duration: 5, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut', delay: 0.6 }
                }
              >
                keep.
              </motion.span>
            </h2>

            {/* Floating card poster. */}
            <motion.div
              className="relative mt-9 aspect-square w-[min(82%,320px)]"
              initial={{ y: 0 }}
              animate={reduced ? undefined : { y: [0, -10, 0] }}
              transition={reduced ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <img
                src={fathersDayFront}
                alt="A Celebrait greeting card"
                className="absolute inset-0 h-full w-full rounded-2xl object-cover"
                style={{
                  boxShadow: '0 30px 60px -20px rgba(92,87,212,0.40), 0 12px 24px -12px rgba(15,23,42,0.16)',
                }}
                // @ts-expect-error — fetchpriority is valid HTML, types lag
                fetchpriority="high"
              />
              <div
                aria-hidden
                className="absolute -bottom-5 left-1/2 h-5 w-[78%] -translate-x-1/2 rounded-[50%] opacity-50 blur-2xl"
                style={{ background: 'radial-gradient(closest-side, rgba(92,87,212,0.45), transparent 70%)' }}
              />
            </motion.div>

            {/* Rotating real-site taglines. */}
            <RotatingTagline reduced={reduced} />
          </div>
        </div>
      </div>
    </div>
  );
}
