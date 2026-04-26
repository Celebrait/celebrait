// client/src/pages/login.tsx
//
// Unified login page. Used by both customers and admins — there is no
// separate admin login flow.
//
// Flow:
//   1. User lands on /login?redirect=/some/path (redirect is optional)
//   2. Enters email → POST /api/auth/otp/send → Brevo sends a 6-digit code
//      (or, in dev with DEV_AUTH_ACCEPT_ANY_CODE=1, the server skips Brevo
//      and accepts hardcoded codes 000000 / 123456)
//   3. Enters code → POST /api/auth/otp/verify → session cookie set
//   4. Redirected to the `redirect` query param, or to '/studio' if none —
//      authenticated users belong in the Studio, not on the marketing
//      landing page they've already moved past.
//
// If the user was already logged in when they landed here, they are
// immediately bounced to their redirect destination.

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import logoSrc from '../assets/Logo2.png';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading, sendOtp, isSendingOtp, verifyOtp, isVerifyingOtp } = useAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [devBypassActive, setDevBypassActive] = useState(false);

  const redirect = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('redirect');
    // Default to /studio for authenticated users — landing on the
    // public marketing page after login feels backwards. Pages that
    // bounce unauth'd users to /login still pass an explicit
    // ?redirect=, so this default only kicks in for direct /login
    // visits + already-authenticated users.
    if (!r) return '/studio';
    // Only allow same-origin redirects; strip anything with a protocol.
    if (r.startsWith('/') && !r.startsWith('//')) return r;
    return '/studio';
  }, []);

  // Already logged in → bounce to redirect target
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      setLocation(redirect);
    }
  }, [isLoading, isAuthenticated, user, redirect, setLocation]);

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      toast({ title: 'Enter a valid email', variant: 'destructive' });
      return;
    }
    try {
      const result = (await sendOtp(trimmed)) as any;
      setDevBypassActive(!!result?.devBypass);
      setStep('code');
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
    }
  };

  const handleVerifyCode = async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      toast({ title: 'Enter the 6-digit code', variant: 'destructive' });
      return;
    }
    try {
      await verifyOtp({ email: email.trim().toLowerCase(), code: trimmedCode });
      toast({ title: 'Logged in' });
      setLocation(redirect);
    } catch (err: any) {
      toast({
        title: 'Invalid code',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logoSrc} alt="Celebrait" className="h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-stone-900">
            {step === 'email' ? 'Sign in to Celebrait' : 'Check your email'}
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            {step === 'email'
              ? "We'll email you a 6-digit code. No passwords, ever."
              : `We sent a code to ${email}.`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-4">
          {step === 'email' ? (
            <>
              <div>
                <Label htmlFor="email" className="text-xs">
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
                  className="mt-1"
                  data-testid="input-login-email"
                />
              </div>
              <Button
                onClick={handleSendCode}
                disabled={isSendingOtp}
                className="w-full bg-green-600 hover:bg-green-700"
                data-testid="btn-send-code"
              >
                {isSendingOtp ? 'Sending code…' : 'Send me a code'}
              </Button>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="code" className="text-xs">
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
                  className="mt-1 font-mono text-center text-lg tracking-widest"
                  data-testid="input-login-code"
                />
                {devBypassActive && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    Dev mode: enter <code className="font-mono">000000</code> or{' '}
                    <code className="font-mono">123456</code>
                  </p>
                )}
              </div>
              <Button
                onClick={handleVerifyCode}
                disabled={isVerifyingOtp}
                className="w-full bg-green-600 hover:bg-green-700"
                data-testid="btn-verify-code"
              >
                {isVerifyingOtp ? 'Verifying…' : 'Sign in'}
              </Button>
              <button
                onClick={() => {
                  setStep('email');
                  setCode('');
                }}
                className="w-full text-xs text-stone-500 hover:text-gray-700"
              >
                ← Use a different email
              </button>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-stone-400 mt-6">
          By signing in you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
