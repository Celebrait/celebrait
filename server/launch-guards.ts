// server/launch-guards.ts
//
// Boot-time configuration assertions (pre-launch audit 2026-07-27, P0-5).
//
// The payment and print providers are selected by two INDEPENDENT env vars
// that both default to "stub", and the Prodigi base URL defaults to the
// SANDBOX host. Nothing else in the system cross-checks them, and the stub
// print provider fakes a healthy "submitted" order — so the most dangerous
// misconfigurations (real money in, no real card out) are otherwise
// invisible on every dashboard.
//
// Policy:
//   FATAL (throw → Render deploy fails loudly, old version stays up):
//     • live Stripe + non-Prodigi print        → charged, nothing prints
//     • live Stripe + Prodigi on sandbox URL   → charged, order goes to sandbox
//     • SESSION_SECRET missing                 → cookies signed with the
//       repo-published dev fallback
//     • DEV_STUB_AI set                        → customers silently get their
//       uploaded photo back instead of a generated card
//   WARN (screaming log, boot continues):
//     • stub payment in production — the normal PRE-launch state; blocking it
//       would brick every deploy before launch day. The banner keeps it
//       impossible to forget.
//     • ALLOW_STUB_TOGGLE / DEV_AUTH_ACCEPT_ANY_CODE present (both are
//       NODE_ENV-guarded downstream, but have no business existing on prod).

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function assertLaunchSafeConfig(): void {
  if (!isProd()) return;

  const payment = process.env.STUDIO_PAYMENT_PROVIDER ?? 'stub';
  const print = process.env.STUDIO_PRINT_PROVIDER ?? 'stub';
  const prodigiBase =
    process.env.PRODIGI_BASE_URL ?? 'https://api.sandbox.prodigi.com/v4.0';

  const fatal: string[] = [];
  const warnings: string[] = [];

  if (payment === 'stripe' && print !== 'prodigi') {
    fatal.push(
      `STUDIO_PAYMENT_PROVIDER=stripe but STUDIO_PRINT_PROVIDER=${print} — ` +
        'customers would be CHARGED while the stub print provider fakes a healthy ' +
        '"submitted" order and nothing ever prints. Set STUDIO_PRINT_PROVIDER=prodigi.',
    );
  }

  if (payment === 'stripe' && print === 'prodigi' && /sandbox/i.test(prodigiBase)) {
    fatal.push(
      `STUDIO_PAYMENT_PROVIDER=stripe with PRODIGI_BASE_URL=${prodigiBase} — ` +
        'the code DEFAULTS to the Prodigi sandbox; real payments would create ' +
        'sandbox orders that never print. Set PRODIGI_BASE_URL=https://api.prodigi.com/v4.0.',
    );
  }

  if (!process.env.SESSION_SECRET) {
    fatal.push(
      'SESSION_SECRET is not set — session cookies would be signed with the ' +
        'dev fallback published in the repository. Set a strong SESSION_SECRET.',
    );
  }

  if (process.env.DEV_STUB_AI) {
    fatal.push(
      'DEV_STUB_AI is set on production — generation would silently return the ' +
        "customer's uploaded photo instead of a generated card. Unset it.",
    );
  }

  if (payment === 'stub') {
    warnings.push(
      'STUDIO_PAYMENT_PROVIDER is "stub" — orders can be marked paid for free via ' +
        'the dev-confirm route. Fine BEFORE launch; must be "stripe" the moment ' +
        'real customers can pay.',
    );
  }
  if (process.env.ALLOW_STUB_TOGGLE) {
    warnings.push('ALLOW_STUB_TOGGLE is set on production — unset it.');
  }
  if (process.env.DEV_AUTH_ACCEPT_ANY_CODE) {
    warnings.push('DEV_AUTH_ACCEPT_ANY_CODE is set on production — unset it.');
  }

  for (const w of warnings) {
    console.warn(
      `\n${'⚠'.repeat(30)}\n[LAUNCH-GUARD WARNING] ${w}\n${'⚠'.repeat(30)}\n`,
    );
  }

  if (fatal.length > 0) {
    const banner = '✖'.repeat(30);
    console.error(
      `\n${banner}\n[LAUNCH-GUARD FATAL] Refusing to boot with unsafe production config:\n\n` +
        fatal.map((f, i) => `  ${i + 1}. ${f}`).join('\n\n') +
        `\n${banner}\n`,
    );
    throw new Error(
      `Launch guard: ${fatal.length} fatal production misconfiguration(s) — see log above.`,
    );
  }
}
