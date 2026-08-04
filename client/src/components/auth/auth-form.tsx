// client/src/components/auth/auth-form.tsx
//
// The OTP + welcome state machine. Renders the inputs/buttons only —
// the parent surface owns the headline + trust line so each surface
// can size and place them per its own design (the boxed login card
// uses a larger 3xl/4xl headline; a future modal embed could go
// smaller).
//
// Auth + Landing sprint, Piece A1 (2026-05-01) — refactored from the
// monolithic version that owned headline + trust line + form, which
// boxed in the parent's typography. Now: parent owns chrome, this
// component owns the auth state machine and emits step changes so
// the parent can mirror them.
//
// Piece B (next) wires the "Continue with Google" button to the real
// /api/auth/google route — currently the button is rendered and
// clickable, but the server route is a 404 until OAuth lands.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

export type AuthStep = 'email' | 'code' | 'welcome';

interface AuthFormProps {
  /** Optional override for the default `/studio` post-auth redirect.
   *  Reads `?redirect=` from the URL by default. */
  defaultRedirect?: string;
  /** Fires whenever the form transitions between email/code/welcome.
   *  Lets the parent surface swap its headline + subline copy in sync. */
  onStepChange?: (step: AuthStep) => void;
  /** Show the "Continue with Google" button + divider. Default true.
   *  Pass false to hide if the surface only wants OTP. */
  showGoogle?: boolean;
  /** Primary-button accent. 'cta' (green) is the default brand action
   *  colour used in the auth modal; /login passes 'brand' so the sign-in
   *  button reads violet to match the homepage. */
  accent?: 'cta' | 'brand';
}

/** Step-aware heading copy. Exported so parent surfaces (e.g. /login)
 *  can render a synced headline above the form without duplicating
 *  the strings. Update copy here and every consumer follows. */
export function authHeadingCopy(step: AuthStep, email?: string) {
  if (step === 'email') {
    return {
      heading: "Make a card they'll keep.",
      subline: "We'll email you a 6-digit code. No passwords, ever.",
    };
  }
  if (step === 'code') {
    return {
      heading: 'Check your email.',
      subline: email ? `We sent a code to ${email}.` : 'We sent you a 6-digit code.',
    };
  }
  return {
    heading: 'One last thing.',
    subline: 'What should we call you?',
  };
}

export function AuthForm({
  defaultRedirect = '/studio',
  onStepChange,
  // Google sign-in is HIDDEN by default (Kevin 2026-07-24): OAuth isn't
  // configured on prod yet, so /api/auth/google 503s — a dead button for
  // testers. Flip back to true (or pass showGoogle) once GOOGLE_CLIENT_ID
  // / SECRET / REDIRECT_URI are set in Render. Email OTP is the only path
  // until then.
  showGoogle = false,
  accent = 'cta',
}: AuthFormProps) {
  const [, setLocation] = useLocation();
  // Primary-button accent classes. Purple (go) by default — matches the
  // brand violet on the LP's capture card and the studio's everyday
  // purple (Kevin 2026-07-11; was ink → green → purple). /login can still
  // opt into the lighter brand violet via accent='brand'.
  const accentBtn =
    accent === 'brand'
      ? 'bg-brand hover:bg-brand-dark text-brand-foreground'
      : 'bg-go hover:bg-go-hover text-go-foreground';
  const { user, isAuthenticated, isLoading, sendOtp, isSendingOtp, verifyOtp, isVerifyingOtp } = useAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStepState] = useState<AuthStep>('email');
  const [devBypassActive, setDevBypassActive] = useState(false);
  // True once a send/verify request has been in-flight a few seconds —
  // usually a cold free-tier server waking up. Drives a "hang on" hint so
  // a slow first request doesn't read as broken (and get abandoned).
  const [slowHint, setSlowHint] = useState(false);
  // Resend-code countdown (audit 2026-07-27): mirrors the server's 30s
  // per-email cooldown so the button unlocks exactly when a resend can
  // actually succeed — without it, a spam-foldered code was a dead end
  // (going back + resubmitting inside 30s just 429'd).
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [resendIn > 0]);

  // Welcome step state — name + marketing consent (unticked by default,
  // GDPR/PECR).
  const [firstName, setFirstName] = useState('');
  // Forced choice, no default (Aidan 2026-08-04): an unticked box is
  // skippable; a required Yes/No makes everyone actually decide. Still
  // valid consent — nothing pre-selected, both answers equal, either
  // proceeds. null = not yet answered (Continue stays disabled).
  const [marketingOptIn, setMarketingOptIn] = useState<boolean | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Wrapped setStep so onStepChange always fires in sync with the
  // internal transition. Parent uses this to swap headline copy.
  const setStep = (next: AuthStep) => {
    setStepState(next);
    onStepChange?.(next);
  };

  const redirect = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('redirect');
    if (!r) return defaultRedirect;
    if (r.startsWith('/') && !r.startsWith('//')) return r;
    return defaultRedirect;
  }, [defaultRedirect]);

  // Already-authenticated bounce. Captures initial auth on first
  // non-loading render — listening to live `isAuthenticated` would
  // race with verify-success and skip the welcome step.
  //
  // Dev escape hatch: `?preview=1` in the URL suppresses the bounce
  // so designers/founder can review the form chrome while signed in.
  // Gated to import.meta.env.DEV so a stray query param can't expose
  // the auth UI to authed prod users (harmless but noisy).
  const initialAuthRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (isLoading) return;
    if (initialAuthRef.current === null) {
      initialAuthRef.current = isAuthenticated;
      const previewMode =
        import.meta.env.DEV &&
        new URLSearchParams(window.location.search).get('preview') === '1';
      if (isAuthenticated && user && !previewMode) {
        setLocation(redirect);
      }
    }
  }, [isLoading, isAuthenticated, user, redirect, setLocation]);

  const handleGoogleSignIn = () => {
    // Piece B will implement /api/auth/google. Until then the click
    // takes the user to a 404 — fine for a dev preview, prevents the
    // button from looking decorative.
    const params = new URLSearchParams(window.location.search);
    const r = params.get('redirect');
    const next = r && r.startsWith('/') && !r.startsWith('//') ? r : redirect;
    window.location.assign(`/api/auth/google?redirect=${encodeURIComponent(next)}`);
  };

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      toast({ title: 'Enter a valid email', variant: 'destructive' });
      return;
    }
    const slowTimer = window.setTimeout(() => setSlowHint(true), 4000);
    try {
      const result = (await sendOtp(trimmed)) as any;
      setDevBypassActive(!!result?.devBypass);
      setStep('code');
      setResendIn(30);
      toast({
        title: 'Code sent',
        description: result?.devBypass
          ? 'Dev mode: use 000000 or 123456.'
          : `Check your inbox at ${trimmed}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Could not send code',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      window.clearTimeout(slowTimer);
      setSlowHint(false);
    }
  };

  const handleVerifyCode = async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      toast({ title: 'Enter the 6-digit code', variant: 'destructive' });
      return;
    }
    const slowTimer = window.setTimeout(() => setSlowHint(true), 4000);
    try {
      const result = (await verifyOtp({
        email: email.trim().toLowerCase(),
        code: trimmedCode,
      })) as any;
      if (result?.isNewUser) {
        setStep('welcome');
      } else {
        toast({ title: 'Welcome back' });
        setLocation(redirect);
      }
    } catch (err: any) {
      toast({
        title: 'Invalid code',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      window.clearTimeout(slowTimer);
      setSlowHint(false);
    }
  };

  const handleWelcomeSubmit = async () => {
    const trimmedName = firstName.trim();
    if (!trimmedName) {
      toast({ title: 'Pop in a name first.', variant: 'destructive' });
      return;
    }

    setIsSavingProfile(true);
    try {
      const profileRes = await apiRequest('PATCH', '/api/user/profile', {
        firstName: trimmedName,
        marketingOptIn: marketingOptIn === true,
      });
      if (!profileRes.ok) {
        const err = await profileRes.json().catch(() => ({}));
        throw new Error(err?.message || 'Could not save profile');
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });

      toast({ title: `Welcome to Celebrait, ${trimmedName}` });
      setLocation(redirect);
    } catch (err: any) {
      toast({
        title: "Couldn't finish setting up",
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="space-y-4">
      {step === 'email' && (
        <>
          {showGoogle && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                className="w-full h-11 border-stone-200 hover:bg-stone-50 text-ink font-medium"
                data-testid="btn-google-signin"
              >
                {/* Google "G" mark — kept inline so we don't ship an
                    SVG asset for one button. */}
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-[11px] uppercase tracking-[0.18em] text-stone-400">
                    or
                  </span>
                </div>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="email" className="text-xs text-ink">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
              placeholder="you@example.com"
              className="mt-1 h-11"
              data-testid="input-login-email"
            />
          </div>
          <Button
            onClick={handleSendCode}
            // Don't let the tap steal focus from the email input — on
            // mobile that first tap can just dismiss the keyboard instead
            // of firing the button. Keeping focus lets the click land first
            // time. (onClick still fires; input stays focused.)
            onMouseDown={(e) => e.preventDefault()}
            disabled={isSendingOtp}
            className={`w-full h-11 ${accentBtn} font-medium`}
            data-testid="btn-send-code"
          >
            {isSendingOtp ? 'Sending code…' : 'Send me a code'}
          </Button>
          {slowHint && isSendingOtp && (
            <p className="text-[11px] text-keeper-meta text-center">
              Waking things up — this can take a few seconds…
            </p>
          )}
        </>
      )}

      {step === 'code' && (
        <>
          <div>
            <Label htmlFor="code" className="text-xs text-ink">
              6-digit code
            </Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
              placeholder="123456"
              className="mt-1 h-12 font-mono text-center text-lg tracking-widest"
              data-testid="input-login-code"
            />
            {devBypassActive && (
              <p className="text-[11px] text-accent-amber-dark mt-1">
                Dev mode: enter <code className="font-mono">000000</code> or{' '}
                <code className="font-mono">123456</code>
              </p>
            )}
          </div>
          <Button
            onClick={handleVerifyCode}
            onMouseDown={(e) => e.preventDefault()}
            disabled={isVerifyingOtp}
            className={`w-full h-11 ${accentBtn} font-medium`}
            data-testid="btn-verify-code"
          >
            {isVerifyingOtp ? 'Verifying…' : 'Sign in'}
          </Button>
          {slowHint && isVerifyingOtp && (
            <p className="text-[11px] text-keeper-meta text-center">
              Hang on — this can take a few seconds…
            </p>
          )}
          <button
            onClick={() => !isSendingOtp && resendIn === 0 && handleSendCode()}
            onMouseDown={(e) => e.preventDefault()}
            disabled={isSendingOtp || resendIn > 0}
            className="w-full text-xs text-brand hover:text-brand-dark disabled:text-keeper-meta disabled:cursor-default"
            data-testid="btn-resend-code"
          >
            {resendIn > 0
              ? `Resend code in ${resendIn}s`
              : isSendingOtp
                ? 'Sending…'
                : "Didn't get it? Resend code"}
          </button>
          <button
            onClick={() => {
              setStep('email');
              setCode('');
            }}
            className="w-full text-xs text-brand hover:text-brand-dark"
          >
            ← Use a different email
          </button>
        </>
      )}

      {step === 'welcome' && (
        <>
          <div>
            <Label htmlFor="first-name" className="text-xs text-ink">
              First name
            </Label>
            <Input
              id="first-name"
              type="text"
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && !isSavingProfile && handleWelcomeSubmit()
              }
              placeholder="Aidan"
              maxLength={60}
              className="mt-1 h-11"
              data-testid="input-welcome-first-name"
            />
          </div>

          {/* Marketing consent — a REQUIRED Yes/No pair, nothing
              pre-selected (Aidan 2026-08-04: a skippable tickbox never
              gets an answer). Valid consent: affirmative act, equal
              buttons, "No" costs nothing, either answer proceeds. Gates
              PROMOTIONAL email only — reminders/orders are service. */}
          <div>
            <p className="text-xs font-medium text-keeper-body">
              Can we email you the occasional offer and Celebrait news?
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMarketingOptIn(true)}
                aria-pressed={marketingOptIn === true}
                className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${
                  marketingOptIn === true
                    ? 'border-brand bg-brand text-brand-foreground'
                    : 'border-keeper-hair bg-white text-keeper-body hover:border-stone-400'
                }`}
                data-testid="btn-marketing-yes"
              >
                Yes please
              </button>
              <button
                type="button"
                onClick={() => setMarketingOptIn(false)}
                aria-pressed={marketingOptIn === false}
                className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${
                  marketingOptIn === false
                    ? 'border-keeper-ink bg-keeper-ink text-white'
                    : 'border-keeper-hair bg-white text-keeper-body hover:border-stone-400'
                }`}
                data-testid="btn-marketing-no"
              >
                No thanks
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-keeper-meta/80">
              Either way, we'll email you about your orders and the dates you
              ask us to watch — that's the service. Unsubscribe from anything,
              anytime.
            </p>
          </div>

          <Button
            onClick={handleWelcomeSubmit}
            disabled={isSavingProfile || !firstName.trim() || marketingOptIn === null}
            className={`w-full h-11 ${accentBtn} font-medium`}
            data-testid="btn-welcome-continue"
          >
            {isSavingProfile ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </>
      )}
    </div>
  );
}
