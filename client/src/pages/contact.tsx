// client/src/pages/contact.tsx
//
// Public contact page — a simple form that POSTs to /api/contact, which
// emails the support inbox. Wears the same Keeper chrome as the legal
// pages (celebration backdrop + KeeperHeader + glass card + footer).

import { useState } from 'react';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { apiRequest } from '@/lib/queryClient';

// Must match the server enum in server/routes/contact.ts.
const REASONS = [
  'Order or delivery',
  'Refund or return',
  "Something's wrong with my card",
  'Account or login',
  'Business or press',
  'Something else',
];

// The public support address the form emails. Kept in sync with the
// server's CONTACT_EMAIL for the "or email us directly" fallback.
const CONTACT_EMAIL = 'greetings@celebrait.co.uk';

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    orderNumber: '',
    reason: '',
    message: '',
    company: '', // honeypot
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const canSubmit =
    form.name.trim() && form.email.trim() && form.reason && form.message.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || status === 'sending') return;
    setStatus('sending');
    setError('');
    try {
      const res = await apiRequest('POST', '/api/contact', form);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? 'Something went wrong.');
      }
      setStatus('sent');
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.');
      setStatus('error');
    }
  };

  const inputCls =
    'w-full rounded-xl border border-keeper-hair bg-white px-3.5 py-2.5 text-sm text-keeper-ink placeholder:text-keeper-meta focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop
        background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)"
        permanentFade
      />
      <KeeperHeader />
      <main className="relative pt-32">
        <div className="container mx-auto max-w-xl px-4 pb-24">
          <div className="rounded-3xl border border-keeper-hair bg-white/85 p-8 shadow-[0_20px_60px_-24px_rgba(33,29,25,0.22)] backdrop-blur-sm lg:p-10">
            {status === 'sent' ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-go" strokeWidth={1.5} />
                <h1 className="text-2xl font-bold text-keeper-ink">Thanks — message sent</h1>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-keeper-body">
                  We&rsquo;ve got it and will reply to{' '}
                  <span className="font-medium text-keeper-ink">{form.email}</span> as soon as we
                  can — usually within a day.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                    <Mail className="h-5 w-5" />
                  </span>
                  <h1 className="text-3xl font-bold text-keeper-ink">Get in touch</h1>
                  <p className="mt-1.5 text-sm text-keeper-body">
                    A question, an order, or something not quite right? Tell us below and
                    we&rsquo;ll come straight back to you.
                  </p>
                </div>

                <form onSubmit={submit} className="space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-keeper-body">Name</span>
                      <input
                        className={inputCls}
                        value={form.name}
                        onChange={set('name')}
                        placeholder="Your name"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-keeper-body">Email</span>
                      <input
                        type="email"
                        className={inputCls}
                        value={form.email}
                        onChange={set('email')}
                        placeholder="you@example.com"
                        required
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-keeper-body">
                        Order number <span className="text-keeper-meta">(if you have one)</span>
                      </span>
                      <input
                        className={inputCls}
                        value={form.orderNumber}
                        onChange={set('orderNumber')}
                        placeholder="e.g. 14303019"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-keeper-body">
                        Reason for contact
                      </span>
                      <select
                        className={inputCls}
                        value={form.reason}
                        onChange={set('reason')}
                        required
                      >
                        <option value="" disabled>
                          Choose one…
                        </option>
                        {REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-keeper-body">Message</span>
                    <textarea
                      className={`${inputCls} min-h-[140px] resize-y`}
                      value={form.message}
                      onChange={set('message')}
                      placeholder="How can we help?"
                      required
                    />
                  </label>

                  {/* Honeypot — hidden from real users. */}
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="hidden"
                    value={form.company}
                    onChange={set('company')}
                  />

                  {status === 'error' && (
                    <p className="text-sm text-accent-red-dark">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit || status === 'sending'}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-go px-6 py-3 text-sm font-semibold text-go-foreground transition-colors hover:bg-go-hover disabled:opacity-50"
                  >
                    {status === 'sending' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                      </>
                    ) : (
                      'Send message'
                    )}
                  </button>

                  <p className="text-center text-xs text-keeper-meta">
                    Prefer email? Reach us at{' '}
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      className="text-brand underline underline-offset-2 hover:text-brand-dark"
                    >
                      {CONTACT_EMAIL}
                    </a>
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
