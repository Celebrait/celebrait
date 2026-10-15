// server/routes/launch-check.ts — the launch-readiness panel on /admin/site.
//
// Aidan is hands-off on dev and does not read Render's env list, so the
// config that decides whether real customers can pay, print and get
// emails must be visible on ONE admin page as green/red rows. Reports
// presence/mode only — never a secret's value. Mirrors the fatal rules
// in server/launch-guards.ts (which refuses to BOOT on the worst ones)
// and adds the softer ones a boot guard can't judge.
import type { Express, Request, Response } from 'express';
import { requireAdmin } from './admin-card-lab';
import { CONTROLLER, legalValue } from '@shared/legal';
import { getSiteLock } from './site-lock';
import { market, publicOrigin } from '@shared/market';

export interface LaunchCheck {
  id: string;
  group: 'Payments' | 'Printing' | 'Safety' | 'Email' | 'Legal' | 'Site';
  label: string;
  /** true = ready, false = not ready, null = can't be checked by code (manual). */
  ok: boolean | null;
  detail: string;
}

const set = (v: string | undefined): boolean => !!v && v.trim().length > 0;

export async function runLaunchChecks(): Promise<LaunchCheck[]> {
  const env = process.env;
  const payment = env.STUDIO_PAYMENT_PROVIDER ?? 'stub';
  const print = env.STUDIO_PRINT_PROVIDER ?? 'stub';
  const prodigiBase = env.PRODIGI_BASE_URL ?? 'https://api.sandbox.prodigi.com/v4.0';
  const stripeKey = env.STRIPE_SECRET_KEY ?? '';
  const origin = env.PUBLIC_APP_ORIGIN ?? '';
  const lock = await getSiteLock();
  const m = market();
  const za = m.id === 'ZA';
  const expectedOrigin = m.origin;
  // Same rule as payfast-provider.ts: '1' or 'true' means sandbox.
  const payfastSandbox = ['1', 'true'].includes((env.PAYFAST_SANDBOX ?? '').trim().toLowerCase());
  const legal = {
    legalName: legalValue(env.LEGAL_ENTITY_NAME, CONTROLLER.legalName),
    address: legalValue(env.MAIL_POSTAL_ADDRESS, CONTROLLER.address),
    companyNumber: CONTROLLER.companyNumber,
    icoNumber: CONTROLLER.icoNumber,
  };
  return [
    // ── Payments ── (GB: Stripe; ZA: PayFast)
    ...(za ? [
      { id: 'pay-provider', group: 'Payments', ok: payment === 'payfast',
        label: 'Payments go through PayFast',
        detail: payment === 'payfast' ? 'STUDIO_PAYMENT_PROVIDER=payfast' : `STUDIO_PAYMENT_PROVIDER is "${payment}", so nobody can actually pay. Set it to payfast on Render.` },
      { id: 'pay-payfast-id', group: 'Payments', ok: set(env.PAYFAST_MERCHANT_ID),
        label: 'PayFast merchant ID is set',
        detail: set(env.PAYFAST_MERCHANT_ID) ? 'present' : 'PAYFAST_MERCHANT_ID is not set. PayFast dashboard → Settings → Developer settings.' },
      { id: 'pay-payfast-key', group: 'Payments', ok: set(env.PAYFAST_MERCHANT_KEY),
        label: 'PayFast merchant key is set',
        detail: set(env.PAYFAST_MERCHANT_KEY) ? 'present' : 'PAYFAST_MERCHANT_KEY is not set. PayFast dashboard → Settings → Developer settings.' },
      { id: 'pay-payfast-passphrase', group: 'Payments', ok: set(env.PAYFAST_PASSPHRASE),
        label: 'PayFast passphrase is set',
        detail: set(env.PAYFAST_PASSPHRASE) ? 'present' : 'PAYFAST_PASSPHRASE is not set. Set the same passphrase in PayFast → Settings → Developer settings and on Render, or every payment signature fails.' },
      { id: 'pay-payfast-live', group: 'Payments', ok: !payfastSandbox,
        label: 'PayFast is live, not the sandbox',
        detail: payfastSandbox ? "PayFast is in sandbox, so real payments won't go through. Remove PAYFAST_SANDBOX from Render." : set(env.PAYFAST_SANDBOX) ? `PAYFAST_SANDBOX=${(env.PAYFAST_SANDBOX ?? '').trim()} (reads as live)` : 'PAYFAST_SANDBOX unset' },
      { id: 'pay-payfast-itn', group: 'Payments', ok: null,
        label: 'PayFast notify (ITN) URL is set in the PayFast dashboard',
        detail: `PayFast → Settings → Developer settings → Notify URL must be ${publicOrigin()}/api/webhooks/payfast. Without it, paid orders are never marked paid. Code cannot see this.` },
    ] satisfies LaunchCheck[] : [
      { id: 'pay-provider', group: 'Payments', ok: payment === 'stripe',
        label: 'Payments go through Stripe',
        detail: payment === 'stripe' ? 'STUDIO_PAYMENT_PROVIDER=stripe' : `STUDIO_PAYMENT_PROVIDER is "${payment}" — nobody can actually pay. Set it to stripe on Render.` },
      { id: 'pay-live-key', group: 'Payments', ok: stripeKey.startsWith('sk_live_'),
        label: 'Stripe key is a LIVE key',
        detail: !stripeKey ? 'STRIPE_SECRET_KEY is not set.' : stripeKey.startsWith('sk_live_') ? 'sk_live_… present' : 'A TEST key (sk_test_…) is set — real cards will be declined. Paste the live secret key from Stripe → Developers → API keys.' },
      { id: 'pay-webhook', group: 'Payments', ok: set(env.STRIPE_WEBHOOK_SECRET),
        label: 'Stripe webhook secret is set',
        detail: set(env.STRIPE_WEBHOOK_SECRET) ? 'whsec_… present' : `Not set. In Stripe → Developers → Webhooks add an endpoint for ${origin || market().origin}/api/webhooks/stripe (events: checkout.session.completed, checkout.session.expired, charge.refunded), then paste its signing secret into Render as STRIPE_WEBHOOK_SECRET. Until then the ten-minute reconcile sweep is the only thing marking orders paid.` },
    ] satisfies LaunchCheck[]),
    // ── Printing ── (GB: Prodigi; ZA: manual, Aidan prints and couriers)
    ...(za ? [
      { id: 'print-provider', group: 'Printing', ok: print === 'manual',
        label: 'Printing is manual (you print and courier)',
        detail: print === 'manual' ? 'STUDIO_PRINT_PROVIDER=manual. Each paid order emails you a print job; mark it shipped on /admin/fulfilment.' : `STUDIO_PRINT_PROVIDER is "${print}". Set it to manual on Render, or paid orders won't reach you.` },
      { id: 'print-printer', group: 'Printing', ok: null,
        label: 'A printer is lined up and a test print has been checked',
        detail: 'Print one card from /admin/fulfilment: check the fold, colour and paper before the first customer order. Code cannot see this.' },
    ] satisfies LaunchCheck[] : [
      { id: 'print-provider', group: 'Printing', ok: print === 'prodigi',
        label: 'Printing goes through Prodigi',
        detail: print === 'prodigi' ? 'STUDIO_PRINT_PROVIDER=prodigi' : `STUDIO_PRINT_PROVIDER is "${print}" — paid orders would be faked as "submitted" and never print. Set it to prodigi on Render.` },
      { id: 'print-key', group: 'Printing', ok: set(env.PRODIGI_API_KEY),
        label: 'Prodigi API key is set',
        detail: set(env.PRODIGI_API_KEY) ? 'present' : 'PRODIGI_API_KEY is not set. Prodigi dashboard → Settings → API keys (the LIVE key, not sandbox).' },
      { id: 'print-live', group: 'Printing', ok: !/sandbox/i.test(prodigiBase),
        label: 'Prodigi is pointed at the live API, not the sandbox',
        detail: /sandbox/i.test(prodigiBase) ? `PRODIGI_BASE_URL is the sandbox (${prodigiBase}). Set PRODIGI_BASE_URL=https://api.prodigi.com/v4.0 on Render.` : prodigiBase },
    ] satisfies LaunchCheck[]),
    // ── Safety ──
    { id: 'safe-stub-ai', group: 'Safety', ok: !set(env.DEV_STUB_AI),
      label: 'Generation is real (DEV_STUB_AI unset)',
      detail: set(env.DEV_STUB_AI) ? 'DEV_STUB_AI is SET — customers would get their own photo back as the "card". Remove it from Render.' : 'unset' },
    { id: 'safe-otp', group: 'Safety', ok: !set(env.DEV_AUTH_ACCEPT_ANY_CODE),
      label: 'Sign-in codes are real (DEV_AUTH_ACCEPT_ANY_CODE unset)',
      detail: set(env.DEV_AUTH_ACCEPT_ANY_CODE) ? 'SET — anyone can sign in as anyone with code 000000. Remove it from Render NOW.' : 'unset' },
    { id: 'safe-session', group: 'Safety', ok: set(env.SESSION_SECRET),
      label: 'Session secret is set',
      detail: set(env.SESSION_SECRET) ? 'present' : 'SESSION_SECRET is not set (the boot guard should have refused to start).' },
    { id: 'safe-origin', group: 'Safety', ok: origin === expectedOrigin,
      label: `Public origin is ${expectedOrigin}`,
      detail: origin ? `PUBLIC_APP_ORIGIN=${origin}` : 'PUBLIC_APP_ORIGIN is not set — email links and share links would point at the default.' },
    // ── Email ──
    { id: 'mail-key', group: 'Email', ok: set(env.BREVO_API_KEY),
      label: 'Email sending is configured (Brevo)',
      detail: set(env.BREVO_API_KEY) ? `present · from ${env.MAIL_FROM_EMAIL ?? market().supportEmail}` : 'BREVO_API_KEY is not set — no email leaves the site (codes, receipts, shipping).' },
    { id: 'mail-domain', group: 'Email', ok: null,
      label: 'Sender domain authenticated in Brevo (SPF + DKIM)',
      detail: `Brevo → Senders & IPs → Domains: ${m.canonicalHost.replace(/^www\./, '')} must show Authenticated, or receipts land in spam. Code cannot see this.` },
    { id: 'mail-alerts', group: 'Email', ok: null,
      label: `Alert inbox is read daily (${env.ADMIN_ALERT_EMAIL ?? market().supportEmail})`,
      detail: 'Print failures and payment mismatches go here. Set ADMIN_ALERT_EMAIL on Render to change it.' },
    // ── Legal ──
    { id: 'legal-entity', group: 'Legal', ok: !!legal.legalName && !!legal.address,
      label: 'Trader identity on Terms, Privacy and emails',
      detail: legal.legalName && legal.address ? `${legal.legalName} · ${legal.address}` : 'Legal name and postal address are placeholders. Send them to Claude (or set LEGAL_ENTITY_NAME + MAIL_POSTAL_ADDRESS on Render). Required before taking money (Consumer Contracts Regs, UK GDPR Art 13).' },
    { id: 'legal-ico', group: 'Legal', ok: !!legal.icoNumber,
      label: 'ICO registration number',
      detail: legal.icoNumber ? legal.icoNumber : 'Not set. Register at ico.org.uk (data-protection fee), then send the number.' },
    ...(za ? [] : [
      { id: 'legal-tracked', group: 'Legal', ok: null,
        label: 'Confirm "Royal Mail 24, tracked" with Prodigi',
        detail: 'The site says tracked. If Prodigi\'s card service isn\'t, say so and the word gets dropped.' },
    ] satisfies LaunchCheck[]),
    // ── Site ──
    { id: 'site-market', group: 'Site', ok: true,
      label: `Selling in ${m.countryName.replace(/^the /, '')} (MARKET=${m.id})`,
      detail: `${set(env.MARKET) ? `MARKET=${(env.MARKET ?? '').trim()}` : 'MARKET unset, so GB by default'} · expected domain ${m.canonicalHost} · prices in ${m.currency}` },
    { id: 'site-lock', group: 'Site', ok: !lock.locked,
      label: 'Site is open to the public',
      detail: lock.locked ? 'Locked — the launching-soon page is showing. Flip it on this page on launch day, last.' : 'Open.' },
    { id: 'site-test-order', group: 'Site', ok: null,
      label: 'One real order placed and received',
      detail: za
        ? 'Launch day: make a card to yourself, pay with a real card through PayFast, watch the confirmation email and the print-job email arrive, then mark it shipped on /admin/fulfilment and check the "in the post" email.'
        : 'Launch day: make a card to yourself, pay with a real card, watch the confirmation email arrive and the order appear in Prodigi. Refund it in Stripe afterwards if you like — the refund email is wired too.' },
  ];
}

export function registerLaunchCheck(app: Express): void {
  app.get('/api/admin/launch-check', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const checks = await runLaunchChecks();
      const blocking = checks.filter((c) => c.ok === false).length;
      const manual = checks.filter((c) => c.ok === null).length;
      res.json({ checks, blocking, manual, env: process.env.NODE_ENV ?? 'development' });
    } catch (err) {
      console.error('[LAUNCH-CHECK] failed:', err);
      res.status(500).json({ message: 'Could not run the checks' });
    }
  });
}
