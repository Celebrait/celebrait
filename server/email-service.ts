// server/email-service.ts
//
// Email transport + all Studio-era templates.
//
// Studio comms PR1 (2026-04-28) — full sweep of every email the
// Studio sends. See memory note `next_studio_comms_plan.md` for the
// product reasoning behind each template's tone and trigger.
//
// Templates currently wired:
//   • sendOtpEmail                    — auth (login code)
//   • sendCardReadyEmail              — sender, card finished generating
//   • sendGenerationFailedEmail       — sender, gen errored
//   • sendRecipientCardArrivedEmail   — recipient, paid digital order
//   • sendSenderOrderConfirmedEmail   — sender, payment confirmed
//   • sendSenderCardOpenedEmail       — sender, recipient opened the card
//   • sendSenderPrintShippedEmail     — sender, printer dispatched
//   • sendSenderPrintDeliveredEmail   — sender, courier delivered
//
// Conventions across all sender/recipient templates:
//   • Subject lines name the recipient where we have it. No emojis.
//   • The recipient email is "delivery, not marketing" — short body,
//     one CTA. From-name is personalised ("{Sender} via Celebrait").
//     Reply-To is the SENDER'S email so a reply lands with them, not us.
//   • Sender emails feel warm but practical.
//   • Single chassis (logo header · body · CTA · footer). Hand-written
//     HTML kept inline so we don't fight Brevo's template editor —
//     transport is plain SMTP via Brevo relay.

import * as brevo from '@getbrevo/brevo';
import nodemailer from 'nodemailer';
import { AsyncLocalStorage } from 'node:async_hooks';
import { promises as fsp } from 'node:fs';
import path from 'node:path';

// ── Preview capture (admin email tester) ──────────────────────────────
// Lets `/admin/emails` render any template's HTML without sending it
// to Brevo. AsyncLocalStorage gives us a request-scoped capture cell —
// when a preview request runs a template inside renderEmailForPreview(),
// the inner sendEmail() call drops its parts into the cell instead of
// firing SMTP. No template signature changes needed; the existing
// send*Email() functions work unmodified for both real sends and
// previews.
//
// Race-safe: each request gets its own AsyncLocalStorage context, so
// concurrent previews don't see each other's captures.

interface PreviewCapture {
  subject: string;
  html: string;
  text: string;
  to: string;
}

interface PreviewCell {
  captured: PreviewCapture | null;
}

const previewStorage = new AsyncLocalStorage<PreviewCell>();

/** Run a template inside a preview context — sendEmail() will skip
 *  SMTP and stash the rendered parts in the cell instead. Returns
 *  whatever the template captured (or null if the template never
 *  reached sendEmail). */
export async function renderEmailForPreview(
  fn: () => Promise<unknown>,
): Promise<PreviewCapture | null> {
  const cell: PreviewCell = { captured: null };
  await previewStorage.run(cell, fn);
  return cell.captured;
}

// Transport — SMTP preferred (bypasses Brevo API IP restrictions on
// some hosts), falls back to the Brevo API.
function createSmtpTransporter() {
  const smtpUser = process.env.BREVO_SMTP_USER;
  const smtpKey = process.env.BREVO_SMTP_KEY;
  if (!smtpUser || !smtpKey) return null;
  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpKey },
  });
}

// Email is OPTIONAL at boot. If BREVO_API_KEY is absent the app still
// starts — outbound email is simply disabled (SMTP is used instead when
// its creds are present; otherwise sends become a logged no-op). This lets
// staging/preview servers run without email configured. Don't crash here.
const brevoApiKey = process.env.BREVO_API_KEY;
if (!brevoApiKey) {
  console.warn(
    '[EMAIL] BREVO_API_KEY not set — Brevo API email disabled. ' +
      'SMTP is used if BREVO_SMTP_USER/KEY are set; otherwise email sends are skipped.',
  );
} else {
  console.log('Brevo API Key configured: Present');
}

const apiInstance = new brevo.TransactionalEmailsApi();
if (brevoApiKey) {
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);
}

// Domain defaults are UK — Celebrait launches UK-only (V1, founder
// direction 2026-05-27). Both can be overridden via env for staging
// or future SA support. See next_checkout_shipping_robust.md.
const FROM_EMAIL = process.env.MAIL_FROM_EMAIL ?? 'greetings@celebrait.co.uk';
const FROM_NAME = process.env.MAIL_FROM_NAME ?? 'Celebrait';
const PUBLIC_ORIGIN = process.env.PUBLIC_APP_ORIGIN ?? 'https://celebrait.co.uk';

interface EmailParams {
  to: string;
  /** Override the From: address (rare — defaults to FROM_EMAIL). */
  from?: string;
  /** Override the From: display name. Used for the recipient email so
   *  the inbox shows "{Sender} via Celebrait" rather than just
   *  "Celebrait". Falls back to FROM_NAME. */
  fromName?: string;
  /** Override the Reply-To header. Used for the recipient email so
   *  Mum's reply lands in her son's inbox, not Celebrait support. */
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{ name: string; content: string; type: string }>;
}

// ── Dev email sink ────────────────────────────────────────────────────
// In non-production, every ACTUALLY-FIRED email is also written to disk
// as rendered HTML (dev-emails/<ts>_<subject>.html) so the full lifecycle
// can be inspected even when the dev Brevo key is disabled/absent (it
// 401s — emails trigger correctly but never deliver). Best-effort; never
// blocks or fails the send path. Preview renders (admin tester) don't
// hit this — they short-circuit above.
const DEV_EMAIL_SINK_DIR = path.join(process.cwd(), 'dev-emails');

async function writeDevEmailSink(params: EmailParams): Promise<void> {
  try {
    await fsp.mkdir(DEV_EMAIL_SINK_DIR, { recursive: true });
    const slug =
      params.subject
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'email';
    const file = path.join(DEV_EMAIL_SINK_DIR, `${Date.now()}_${slug}.html`);
    const header = `<!-- to: ${params.to} | subject: ${params.subject} -->\n`;
    const body =
      params.html ?? `<pre>${params.text ?? '(no HTML or text body)'}</pre>`;
    await fsp.writeFile(file, header + body);
    console.log(
      `[EMAIL] dev sink → ${path.relative(process.cwd(), file)} (to: ${params.to})`,
    );
  } catch {
    /* best-effort — a sink failure must never affect the send */
  }
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  // Preview short-circuit — when running inside renderEmailForPreview(),
  // capture the rendered parts into the request-scoped cell and skip
  // SMTP entirely. Returns true so the caller's existing happy-path
  // logic still runs (e.g. column stamps, log lines).
  const cell = previewStorage.getStore();
  if (cell) {
    cell.captured = {
      subject: params.subject,
      html: params.html ?? '',
      text: params.text ?? '',
      to: params.to,
    };
    return true;
  }

  // Dev sink — record what fired regardless of whether transport works.
  if (process.env.NODE_ENV !== 'production') {
    void writeDevEmailSink(params);
  }

  const from = params.from ?? FROM_EMAIL;
  const fromName = params.fromName ?? FROM_NAME;

  // Prefer Brevo's HTTPS API (port 443). Many hosts block outbound SMTP
  // ports (Render does) — there transporter.sendMail() hangs until timeout,
  // which is what made OTP login spin forever. SMTP is only a fallback for
  // when no API key is configured.
  if (brevoApiKey) {
    return sendEmailViaBrevoApi({ ...params, from, fromName });
  }

  try {
    const transporter = createSmtpTransporter();
    if (!transporter) {
      console.warn(`[EMAIL] no transport configured — skipping send to ${params.to}`);
      return false;
    }
    const mailOptions: any = {
      from: `"${fromName}" <${from}>`,
      to: params.to,
      subject: params.subject,
      text: params.text || 'Email content is available in HTML format.',
    };
    if (params.replyTo) mailOptions.replyTo = params.replyTo;
    if (params.html) mailOptions.html = params.html;
    if (params.attachments?.length) {
      mailOptions.attachments = params.attachments.map((a) => ({
        filename: a.name,
        content: Buffer.from(a.content, 'base64'),
        contentType: a.type,
      }));
    }
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] sent via SMTP to ${params.to}: "${params.subject}"`);
    return true;
  } catch (error: any) {
    console.error('[EMAIL] SMTP error:', error?.message || error);
    return false;
  }
}

async function sendEmailViaBrevoApi(params: EmailParams): Promise<boolean> {
  // No Brevo API key + no SMTP fallback → email is disabled. No-op so the
  // app's happy paths (which call sendEmail and tolerate a false) keep working.
  if (!brevoApiKey) {
    console.warn(`[EMAIL] skipped (no Brevo API key) — would have sent to ${params.to}: "${params.subject}"`);
    return false;
  }
  try {
    const msg = new brevo.SendSmtpEmail();
    msg.to = [{ email: params.to }];
    msg.sender = {
      email: params.from ?? FROM_EMAIL,
      name: params.fromName ?? FROM_NAME,
    };
    if (params.replyTo) {
      msg.replyTo = { email: params.replyTo };
    }
    msg.subject = params.subject;
    msg.textContent = params.text || 'Email content is available in HTML format.';
    if (params.html) msg.htmlContent = params.html;
    if (params.attachments?.length) {
      msg.attachment = params.attachments.map((a) => ({
        name: a.name,
        content: a.content,
        type: a.type,
      }));
    }
    const result = await apiInstance.sendTransacEmail(msg);
    console.log(`[EMAIL] sent via Brevo API to ${params.to}:`, result.response?.statusCode);
    return true;
  } catch (error: any) {
    console.error('[EMAIL] Brevo API error:', error?.message || error);
    return false;
  }
}

// ── Shared chassis ──────────────────────────────────────────────────
// All sender/recipient templates use the same outer table layout so
// they read as one product. Pass the inner block via `bodyHtml`.
// Footer opt-out line for non-transactional email (recurring occasion
// reminders + drop-off nudges) — gives a clear way to stop receiving them
// (PECR; audit 2026-07-02). A full token-based one-click unsubscribe is a
// follow-up; this at least provides a manage link + an email opt-out.
function optOutFooter(): string {
  const manageUrl = `${PUBLIC_ORIGIN}/studio/people/reminders`;
  return (
    `You're receiving this because you use Celebrait. ` +
    `<a href="${manageUrl}" style="color:${EMAIL_BRAND};">Manage reminders</a> · ` +
    `<a href="mailto:${FROM_EMAIL}?subject=Unsubscribe" style="color:${EMAIL_BRAND};">Unsubscribe</a>`
  );
}

// Keeper palette (matches the studio + landing — warm paper/ink, hairline
// borders, brand violet). Hex only; email clients don't read CSS vars.
const EMAIL_PAPER = '#FAF8F4'; // warm paper ground
const EMAIL_INK = '#211D19'; // warm near-black — headings
const EMAIL_BODY = '#3a352f'; // warm ink, softened for running text
const EMAIL_STONE = '#7A7267'; // muted warm grey — footer / captions
const EMAIL_HAIR = '#E5DFD4'; // hairline border
const EMAIL_HAIR_SOFT = '#EFEAE1'; // faint inner divider
const EMAIL_BRAND = '#5c57d4'; // brand violet — CTA + links
// Serif stack — Fraunces where a client honours web fonts (rare in mail),
// otherwise a warm serif (Georgia) so headings still read editorial.
const EMAIL_SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
// Logo lives in client/public → served at the app origin. Absolute URL so
// mail clients can load it; falls back to the "Celebrait" alt when images
// are blocked. NB: relies on PUBLIC_APP_ORIGIN pointing at a live origin.
const EMAIL_LOGO_URL = `${PUBLIC_ORIGIN}/email-logo.png`;

function chassis(opts: {
  preheader: string;
  bodyHtml: string;
  /** Optional serif headline rendered above the body (a Keeper moment). */
  heading?: string;
  /** Optional hero image(s) — the card art — rendered above the body,
   *  stacked with an optional caption over each ("Front" / "Inside").
   *  Callers must pass ABSOLUTE urls; mail clients can't resolve paths. */
  heroImages?: Array<{ src: string; alt: string; caption?: string }>;
  /** Optional raw HTML hero block above the body — used for the small
   *  print-ready spread (see printSpreadHero). Takes precedence over
   *  heroImages. */
  heroHtml?: string;
  /** Optional CTA button rendered after bodyHtml. */
  cta?: { label: string; href: string };
  /** Optional secondary line under the CTA (e.g. tracking ref). */
  postCtaHtml?: string;
  /** Optional opt-out line above the sign-off — for non-transactional
   *  email only (reminders / drop-off nudges). */
  footerNote?: string;
}): string {
  const headingHtml = opts.heading
    ? `
        <tr>
          <td style="padding: 30px 40px 0 40px;">
            <h1 style="margin: 0; font-family: ${EMAIL_SERIF}; font-size: 22px; font-weight: 700; color: ${EMAIL_INK}; letter-spacing: -0.015em; line-height: 1.3;">
              ${escape(opts.heading)}
            </h1>
          </td>
        </tr>`
    : '';
  const heroImages = opts.heroImages ?? [];
  const heroRow = opts.heroHtml
    ? `
        <tr>
          <td style="padding: 24px 40px 0 40px;" align="center">
            ${opts.heroHtml}
          </td>
        </tr>`
    : heroImages.length
    ? `
        <tr>
          <td style="padding: 24px 40px 0 40px;" align="center">
            ${heroImages
              .map(
                (img, i) => `
              ${
                img.caption
                  ? `<div style="margin: ${i === 0 ? '0' : '20'}px 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: ${EMAIL_STONE};">${escape(img.caption)}</div>`
                  : i > 0
                    ? '<div style="height: 18px; line-height: 18px; font-size: 0;">&nbsp;</div>'
                    : ''
              }
              <img src="${escape(img.src)}" alt="${escape(img.alt)}" width="360" style="display: block; margin: 0 auto; width: 100%; max-width: 360px; height: auto; border-radius: 14px; border: 1px solid ${EMAIL_HAIR};">`,
              )
              .join('')}
          </td>
        </tr>`
    : '';
  const ctaHtml = opts.cta
    ? `
        <tr>
          <td style="padding: 24px 40px 8px 40px;" align="center">
            <a href="${escape(opts.cta.href)}" style="display: inline-block; background: ${EMAIL_BRAND}; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 36px; border-radius: 10px;">
              ${escape(opts.cta.label)} &rarr;
            </a>
          </td>
        </tr>`
    : '';
  const postCtaBlock = opts.postCtaHtml
    ? `
        <tr>
          <td style="padding: 16px 40px 0 40px; color: ${EMAIL_STONE}; font-size: 14px; line-height: 1.6;">
            ${opts.postCtaHtml}
          </td>
        </tr>`
    : '';
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="margin: 0; padding: 0; background: ${EMAIL_PAPER}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
        <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; overflow: hidden;">${escape(opts.preheader)}</span>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: ${EMAIL_PAPER};">
          <tr>
            <td align="center" style="padding: 48px 24px;">
              <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background: #ffffff; border-radius: 16px; border: 1px solid ${EMAIL_HAIR};">
                <tr>
                  <td style="padding: 26px 40px 22px 40px; text-align: center; border-bottom: 1px solid ${EMAIL_HAIR_SOFT};">
                    <img src="${EMAIL_LOGO_URL}" alt="Celebrait" width="150" style="display: inline-block; width: 150px; max-width: 60%; height: auto;">
                  </td>
                </tr>
                ${headingHtml}
                ${heroRow}
                <tr>
                  <td style="padding: ${opts.heading || heroImages.length || opts.heroHtml ? '18' : '30'}px 40px 8px 40px; color: ${EMAIL_BODY}; font-size: 16px; line-height: 1.7;">
                    ${opts.bodyHtml}
                  </td>
                </tr>
                ${ctaHtml}
                ${postCtaBlock}
                <tr>
                  <td style="padding: 30px 40px 34px 40px; margin-top: 8px; color: ${EMAIL_STONE}; font-size: 13px; border-top: 1px solid ${EMAIL_HAIR_SOFT};">
                    ${opts.footerNote ? `<div style="margin-bottom: 14px; line-height: 1.6;">${opts.footerNote}</div>` : ''}&mdash; Celebrait
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

/** Absolutise an image url for email — mail clients can't resolve
 *  app-relative paths. R2 urls are already absolute and pass through. */
function absoluteEmailImage(u?: string | null): string | null {
  if (!u) return null;
  return u.startsWith('http') ? u : `${PUBLIC_ORIGIN}${u}`;
}

/** Build a SMALL print-ready hero: the folded-card spreads stacked —
 *  front (rear · front) on top, inside (blank · inside) below, split by a
 *  dashed fold. A compact reminder of the printed product, not a big
 *  image (Kevin 2026-07-11). Returns '' when there's no art. Email-safe
 *  tables + inline styles only. NOTE: not used on recipient email — the
 *  receiver shouldn't see the card before they open it. */
function printSpreadHero(frontUrl?: string | null, insideUrl?: string | null): string {
  const front = absoluteEmailImage(frontUrl);
  const inside = absoluteEmailImage(insideUrl);
  if (!front && !inside) return '';
  const P = 120; // panel size (px) — small on purpose
  const cap = (t: string) =>
    `<div style="margin: 0 0 6px; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: ${EMAIL_STONE};">${t}</div>`;
  const art = (src: string, alt: string) =>
    `<img src="${escape(src)}" alt="${escape(alt)}" width="${P}" style="display: block; width: ${P}px; max-width: 100%; height: auto;">`;
  // Blank panel — white, a faint panel label + the celebrait logo, mirroring
  // the studio print files. (Mail clients can't reliably overlay a watermark
  // ON an image — Gmail strips positioning, Outlook has none — so the art
  // panels stay clean; the logo-on-white branding carries the print look.)
  //
  // On the REAR (showLogo) side the label sits at the panel's vertical centre
  // and the logo drops to the foot — a real card-back look — via a full-height
  // two-row table (email-safe; the outer valign is overridden by this table
  // filling the P×P cell). The plain INSIDE side stays a simple centred label.
  const labelStyle = `font-family: ${EMAIL_SERIF}; font-size: 9px; letter-spacing: 0.12em; color: #c9c2b6;`;
  const blank = (label: string, showLogo: boolean) =>
    showLogo
      ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="height: ${P}px;">
      <tr><td height="${Math.round(P * 0.6)}" valign="bottom" align="center" style="${labelStyle}">${label}</td></tr>
      <tr><td valign="bottom" align="center" style="padding-bottom: 12px;"><img src="${EMAIL_LOGO_URL}" alt="Celebrait" width="54" style="display: inline-block; width: 54px; max-width: 70%; height: auto;"></td></tr>
    </table>`
      : `<div style="text-align: center; ${labelStyle}">${label}</div>`;
  const spread = (leftInner: string, right: string) => `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="border-collapse: separate; border: 1px solid ${EMAIL_HAIR}; border-radius: 8px; overflow: hidden;">
      <tr>
        <td valign="middle" align="center" width="${P}" height="${P}" style="width: ${P}px; height: ${P}px; background: #ffffff; border-right: 1px dashed ${EMAIL_HAIR};">${leftInner}</td>
        <td valign="middle" align="center" width="${P}" style="width: ${P}px;">${right}</td>
      </tr>
    </table>`;
  // Logo on the REAR panel only (the card's back cover); the inside-left
  // stays blank (Kevin 2026-07-11).
  const frontBlock = front ? `${cap('Front')}${spread(blank('REAR', true), art(front, 'Your card front'))}` : '';
  const insideBlock = inside ? `${cap('Inside')}${spread(blank('INSIDE', false), art(inside, 'Your card inside'))}` : '';
  const gap = front && inside ? '<div style="height: 16px; line-height: 16px; font-size: 0;">&nbsp;</div>' : '';
  return `${frontBlock}${gap}${insideBlock}`;
}

// ── Make-your-own link (lead capture from the digital card viewer) ──
// The recipient of a card said "not right now — email me the link".
// One warm email, sent immediately, so the intent survives the moment.
export async function sendMakeYourOwnLinkEmail(
  email: string,
  opts?: { recipientName?: string | null; occasionDate?: string | null },
): Promise<boolean> {
  const startUrl = `${PUBLIC_ORIGIN}/studio/new-card`;
  // Occasion-capture variant: acknowledge the nudge they set up. The
  // nudge email itself is a post-launch scheduled job — this line is
  // the promise, the stored occasion_date is the mechanism.
  const nudgeLine =
    opts?.occasionDate
      ? `<p style="margin: 0 0 16px;">We've saved ${
          opts.recipientName ? `${escape(opts.recipientName)}'s` : 'the'
        } date — we'll remind you in good time, with a card idea ready to go.</p>`
      : '';
  const body = `
    <p style="margin: 0 0 16px;">Hi,</p>
    <p style="margin: 0 0 16px;">
      You asked us to save the link — here it is. When you're ready, make
      someone a card: upload a photo, describe the scene, and we'll put
      them in it. Then we print it and post it for you.
    </p>
    ${nudgeLine}
    <p style="margin: 0 0 8px;">
      It's free to make. You only pay when you send one.
    </p>
  `;
  const html = chassis({
    preheader: "Your link to make a card — whenever you're ready.",
    bodyHtml: body,
    cta: { label: 'Make a card', href: startUrl },
  });
  const text =
    `Hi,\n\nYou asked us to save the link — here it is. When you're ready, make someone a card: upload a photo, describe the scene, and we'll put them in it. Then we print it and post it for you.\n\nMake a card: ${startUrl}\n\nIt's free to make. You only pay when you send one.\n\n— Celebrait`;
  return sendEmail({
    to: email,
    subject: 'Your link to make a card — whenever you\'re ready',
    html,
    text,
  });
}

// ── Welcome (fired once on signup) ───────────────────────────────────
// Warm hello + a nudge to make the first card. Fired from the OTP-verify
// and Google new-user branches (fire-and-forget). No card hero — they
// haven't made one yet. firstName may be absent (name is captured on the
// welcome step, just after account creation).
export async function sendWelcomeEmail(params: {
  email: string;
  firstName?: string | null;
}): Promise<boolean> {
  const { email, firstName } = params;
  const startUrl = `${PUBLIC_ORIGIN}/studio/new-card`;
  const greeting = firstName ? `Hi ${escape(firstName)},` : 'Hi,';
  const body = `
    <p style="margin: 0 0 16px;">${greeting}</p>
    <p style="margin: 0 0 16px;">
      Glad you're here. Celebrait turns a photo into a real card you can
      send. Upload someone you love, describe the scene, and we'll put them
      in it — then print it and post it for you.
    </p>
    <p style="margin: 0 0 8px;">
      It's free to make. You only pay when you send one, and your first
      card's ready when you are.
    </p>
  `;
  const html = chassis({
    preheader: "You're in — let's make your first card.",
    heading: 'Welcome to Celebrait',
    bodyHtml: body,
    cta: { label: 'Make your first card', href: startUrl },
  });
  const text =
    `${greeting.replace(/<[^>]+>/g, '')}\n\nGlad you're here. Celebrait turns a photo into a real card you can send. Upload someone you love, describe the scene, and we'll put them in it — then print it and post it for you.\n\nIt's free to make. You only pay when you send one.\n\nMake your first card: ${startUrl}\n\n— Celebrait`;
  return sendEmail({ to: email, subject: 'Welcome to Celebrait', html, text });
}

// ── OTP (auth) ───────────────────────────────────────────────────────
export async function sendOtpEmail(email: string, code: string): Promise<boolean> {
  // Route through sendEmail so it uses the same transport policy (HTTPS API
  // preferred). Previously this was SMTP-only with no fallback, so on hosts
  // that block SMTP the login code never sent and the UI hung.
  return sendEmail({
    to: email,
    subject: `${code} is your Celebrait verification code`,
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
    html: otpHtml(code),
  });
}

function otpHtml(code: string): string {
  // Routed through the same chassis as everything else so auth email
  // carries the Keeper frame (logo, paper, hairlines). The code block is
  // the body; violet numerals echo the brand.
  const body = `
    <p style="margin: 0 0 24px;">Enter this code to sign in. It expires in 10 minutes.</p>
    <div style="background: #f2f1fb; border: 1px solid #e5e4f9; border-radius: 14px; padding: 22px; text-align: center; margin: 0 0 8px;">
      <span style="font-size: 40px; font-weight: 800; letter-spacing: 10px; color: ${EMAIL_BRAND};">${escape(code)}</span>
    </div>
    <p style="margin: 20px 0 0; color: ${EMAIL_STONE}; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
  `;
  return chassis({
    preheader: 'Your Celebrait verification code (expires in 10 minutes).',
    heading: 'Your verification code',
    bodyHtml: body,
  });
}

// ── Card ready (sender) ─────────────────────────────────────────────
// Fired when generation completes successfully. Plugs the "user
// navigated away during the ~45s wait" gap — without this email, the
// success path was silent. Biggest single conversion lever in the
// Studio funnel.
export async function sendCardReadyEmail(params: {
  senderEmail: string;
  senderName: string | null;
  recipientName: string | null;
  occasion: string | null;
  cardId: number;
  /** Front image of the finished card — shown as the email hero so the
   *  sender SEES what they made (biggest conversion lever). Absolute or
   *  app-relative; absolutised here. Null → no hero (copy-only email). */
  cardImageUrl?: string | null;
  /** Inside image — shown beneath the front (labelled Front / Inside) so
   *  the email previews both sides of the card. */
  insideImageUrl?: string | null;
}): Promise<boolean> {
  const { senderEmail, senderName, recipientName, occasion, cardId, cardImageUrl, insideImageUrl } =
    params;

  const subjectSubject = recipientName
    ? `${recipientName}'s ${occasion ?? ''} card is ready`.replace(/\s+/g, ' ').trim()
    : 'Your card is ready';

  const greeting = senderName ? `Hi ${escape(senderName)},` : 'Hi there,';
  const recipientClause = recipientName
    ? `${escape(recipientName)}'s ${escape(occasion ?? '')} card`.replace(/\s+/g, ' ').trim()
    : 'Your card';
  // Raw (unescaped) variant for the heading + image alt — chassis escapes
  // those itself, so passing the pre-escaped `recipientClause` would
  // double-escape ("Father&#39;s"). Body HTML keeps the escaped one.
  const recipientClauseRaw = recipientName
    ? `${recipientName}'s ${occasion ?? ''} card`.replace(/\s+/g, ' ').trim()
    : 'Your card';

  const body = `
    <p style="margin: 0 0 16px;">${greeting}</p>
    <p style="margin: 0 0 16px;">
      Here's the card you made. Have a look — if it looks right, it's ready to send. If it's not quite right, start again with the same details: we keep your photo, scene and message, so you're never starting from scratch.
    </p>
    <p style="margin: 0 0 8px;">
      No rush — every version stays in your gallery.
    </p>
  `;

  const cardUrl = `${PUBLIC_ORIGIN}/studio/card/${cardId}`;
  const html = chassis({
    preheader: 'Have a look — send it, or start again with the same details.',
    heading: `${recipientClauseRaw} is ready`,
    heroHtml: printSpreadHero(cardImageUrl, insideImageUrl) || undefined,
    bodyHtml: body,
    cta: { label: 'View your card', href: cardUrl },
  });

  const text =
    `${senderName ? `Hi ${senderName},\n\n` : ''}` +
    `${recipientClause} is ready. Have a look — if it looks right, it's ready to send. If it's not quite right, start again with the same details: we keep your photo, scene and message, so you're never starting from scratch.\n\n` +
    `View your card: ${cardUrl}\n\n` +
    `No rush — every version stays in your gallery.\n\n— Celebrait`;

  return sendEmail({ to: senderEmail, subject: subjectSubject, html, text });
}

// ── Generation failure (error notification to sender) ────────────────
// Polished 2026-04-28 — was overly transparent ("AI provider's safety
// system"); reframed as a warmer, less technical "it happens".
export async function sendGenerationFailedEmail(
  userEmail: string,
  userName: string,
  cardId: number,
): Promise<void> {
  try {
    const greeting = userName ? `Hi ${escape(userName)},` : 'Hi there,';
    const body = `
      <p style="margin: 0 0 16px;">${greeting}</p>
      <p style="margin: 0 0 16px;">
        Something went wrong while we were making your card. It happens now and then — usually a photo we couldn't quite read.
      </p>
      <p style="margin: 0 0 16px;">
        Try again with the same photo, or a different one — that almost always fixes it. You haven't been charged.
      </p>
    `;
    const retryUrl = `${PUBLIC_ORIGIN}/studio/card/${cardId}/edit`;
    const html = chassis({
      preheader: "It happens now and then. A different photo usually fixes it.",
      bodyHtml: body,
      cta: { label: 'Try again', href: retryUrl },
    });
    const text = `${userName ? `Hi ${userName},` : 'Hi there,'}

Something went wrong while we were making your card. It happens now and then — usually a photo we couldn't quite read.

Try again with the same photo, or a different one — that almost always fixes it. You haven't been charged.

Try again: ${retryUrl}

— Celebrait`;
    await sendEmail({
      to: userEmail,
      subject: "Your card didn't finish — you haven't been charged",
      html,
      text,
    });
  } catch (err) {
    console.error('[EMAIL] generation-failed notification failed:', err);
  }
}

// ── Recipient: "A card has arrived for you" ──────────────────────────
// Sent the moment a sender's digital order is marked paid. This is
// the recipient's FIRST contact with the Celebrait brand — warm but
// plain, not a SaaS notification. The warmest email in the set, but the
// clarity pass (2026-07-19) still trimmed the doubled-up florals.
//
// 2026-04-28 polish:
//   • From-name: "{Sender} via Celebrait" (was just "Celebrait")
//   • Reply-To: SENDER'S email (was greetings@celebrait.co.za) so a
//     reply lands with the sender, not us
export async function sendRecipientCardArrivedEmail(params: {
  recipientEmail: string;
  recipientName: string | null;
  senderName: string;
  /** Sender's own email — used as Reply-To so a reply lands with them. */
  senderEmail: string;
  occasion: string | null;
  shareUrl: string;
}): Promise<boolean> {
  const {
    recipientEmail,
    recipientName,
    senderName,
    senderEmail,
    occasion,
    shareUrl,
  } = params;

  const subject = `${escape(senderName)} sent you a card`;
  const preheader = `${senderName} made you a card. It's waiting inside.`;

  const greeting = recipientName ? `Hi ${escape(recipientName)},` : 'Hello,';
  const occasionClause = occasion ? ` for your ${escape(occasion)}` : '';

  const body = `
    <p style="margin: 0 0 16px;">${greeting}</p>
    <p style="margin: 0 0 16px;">
      <strong>${escape(senderName)}</strong> made you a card${occasionClause}. It's ready whenever you are.
    </p>
    <p style="margin: 0 0 8px; color: ${EMAIL_BODY}; font-size: 15px;">
      Take your time with it.
    </p>
  `;

  // No card shown here — this is the RECEIVER's email; the surprise is
  // theirs to open (Kevin 2026-07-11).
  const html = chassis({
    preheader,
    heading: `${senderName} sent you a card`,
    bodyHtml: body,
    cta: { label: 'Open your card', href: shareUrl },
    postCtaHtml: `
      <p style="margin: 0; color: ${EMAIL_STONE}; font-size: 12px;">
        If the button doesn't work, paste this into your browser:<br>
        <span style="word-break: break-all;">${escape(shareUrl)}</span>
      </p>
    `,
  });

  const text =
    `${recipientName ? `Hi ${recipientName},\n\n` : ''}` +
    `${senderName} made you a card${occasion ? ` for your ${occasion}` : ''}. It's ready whenever you are.\n\n` +
    `Open it here: ${shareUrl}\n\n` +
    `Take your time with it.\n\n— Celebrait`;

  return sendEmail({
    to: recipientEmail,
    fromName: `${senderName} via Celebrait`,
    replyTo: senderEmail,
    subject,
    html,
    text,
  });
}

// ── Sender: "Your card is on its way" (order confirmation) ───────────
// 2026-04-28 polish: schedule-aware copy ready (the function takes
// `scheduledSendAt` even though PR3's actual scheduling UI ships later;
// today this is always null = immediate send). Adds expected-delivery
// window for the print bullet so we keep the promise the previous
// version made ("we'll email again when it ships").
export async function sendSenderOrderConfirmedEmail(params: {
  senderEmail: string;
  senderName: string;
  recipientName: string | null;
  occasion: string | null;
  includesPrint: boolean;
  includesDigital: boolean;
  /** Whether the recipient's "your card has arrived" email actually went
   *  out (true only when the sender supplied the recipient's email). When
   *  false, we must NOT tell the sender "sent to their inbox" — the link
   *  is theirs to share via the CTA below. (audit 2026-07-02) */
  digitalSentToRecipient?: boolean;
  totalAmount: number;
  currency: string;
  orderId: string;
  /** The card the order is for — the CTA links here so the sender can
   *  view the card + grab the share link. (Previously the CTA used
   *  orderId as if it were a card id → /studio/card/<uuid> → NaN →
   *  redirect home; audit 2026-07-02.) */
  cardId: number;
  /** Delivery destination — drives "on its way to YOU" (self-send) vs "to
   *  {recipient}" (direct) copy so the receipt matches what was chosen. */
  shipTo?: 'sender' | 'recipient' | null;
  /** Front + inside images — shown as the small print spread (like the other
   *  sender emails) so the receipt previews the card that's coming. */
  cardImageUrl?: string | null;
  insideImageUrl?: string | null;
  /** Null = immediate send (V1 default). Date = scheduled-delivery
   *  case (PR3). When non-null, the digital line says "will be sent
   *  on {date} at 8am" instead of "sent just now". */
  scheduledSendAt?: Date | null;
}): Promise<boolean> {
  const {
    senderEmail,
    senderName,
    recipientName,
    occasion,
    includesPrint,
    includesDigital,
    digitalSentToRecipient = false,
    totalAmount,
    currency,
    orderId,
    cardId,
    shipTo,
    cardImageUrl,
    insideImageUrl,
    scheduledSendAt,
  } = params;

  const forWhom = recipientName ? ` to ${escape(recipientName)}` : '';
  const occasionPart = occasion ? ` — ${escape(occasion)}` : '';
  // Self-send (shipTo='sender') = it's coming to YOU to hand over; otherwise
  // it's posted straight to the recipient.
  const toYou = includesPrint && shipTo === 'sender';
  const subject = toYou
    ? `Your card's on its way to you`
    : recipientName
      ? `Your card's on its way to ${recipientName}`
      : `Your card's on its way`;

  const items: string[] = [];
  if (includesDigital) {
    if (scheduledSendAt) {
      const dateLabel = formatScheduledDate(scheduledSendAt);
      items.push(
        `<li style="margin: 0 0 6px;">Digital — we'll send it to ${escape(recipientName ?? 'them')} on <strong>${dateLabel}</strong> at 8am, and email you as soon as they open it.</li>`,
      );
    } else if (digitalSentToRecipient) {
      items.push(
        `<li style="margin: 0 0 6px;">Digital — sent to ${escape(recipientName ?? 'them')}'s inbox just now. We'll email you as soon as they open it.</li>`,
      );
    } else {
      items.push(
        `<li style="margin: 0 0 6px;">Digital — your private share link is ready on the card. Tap below to view it and share the link however you like.</li>`,
      );
    }
  }
  if (includesPrint) {
    const deliveryLine = toYou
      ? 'posted <strong>to you</strong> to hand over yourself, tracked'
      : `posted <strong>straight to ${escape(recipientName ?? 'them')}</strong>, tracked`;
    items.push(
      `<li style="margin: 0 0 6px;">Printed — made to order (<strong>up to 72 hours</strong>), then ${deliveryLine}. We'll email your tracking as soon as it ships.</li>`,
    );
  }

  const amount = formatMoney(totalAmount, currency);

  const preheader = digitalSentToRecipient && !scheduledSendAt
    ? "We've just emailed it to them. We'll let you know when they open it."
    : `Order #${orderId}.`;

  const body = `
    <p style="margin: 0 0 16px;">Hi ${escape(senderName)},</p>
    <p style="margin: 0 0 16px;">
      Your order${forWhom ? ` for the card${forWhom}` : ''}${occasionPart} is confirmed.
    </p>
    <p style="margin: 0 0 8px; font-weight: 600;">What's included:</p>
    <ul style="padding-left: 20px; color: ${EMAIL_BODY}; margin: 0 0 24px;">
      ${items.join('\n')}
    </ul>
    <p style="margin: 0 0 4px;">
      Total: <strong>${amount}</strong>
    </p>
    <p style="margin: 0; color: ${EMAIL_STONE}; font-size: 14px;">
      Order: <span style="font-family: monospace;">${escape(orderId)}</span>
    </p>
  `;

  const ctaHref = includesDigital
    ? `${PUBLIC_ORIGIN}/studio/card/${cardId}`
    : `${PUBLIC_ORIGIN}/studio/orders`;
  const ctaLabel = includesDigital ? 'View your card & share link' : 'View your order';
  const html = chassis({
    preheader,
    heroHtml: printSpreadHero(cardImageUrl, insideImageUrl) || undefined,
    bodyHtml: body,
    cta: { label: ctaLabel, href: ctaHref },
  });

  const textItems: string[] = [];
  if (includesDigital) {
    if (scheduledSendAt) {
      textItems.push(`- Digital — we'll send it to ${recipientName ?? 'them'} on ${formatScheduledDate(scheduledSendAt)} at 8am, and email you as soon as they open it.`);
    } else if (digitalSentToRecipient) {
      textItems.push(`- Digital — sent to ${recipientName ?? 'them'}'s inbox just now. We'll email you as soon as they open it.`);
    } else {
      textItems.push(`- Digital — your private share link is ready on the card. Open it below to view and share.`);
    }
  }
  if (includesPrint) {
    const dl = toYou
      ? 'posted to you to hand over yourself, tracked'
      : `posted straight to ${recipientName ?? 'them'}, tracked`;
    textItems.push(`- Printed — made to order (up to 72 hours), then ${dl}. We'll email your tracking as soon as it ships.`);
  }
  const text = `Hi ${senderName},

Your order${recipientName ? ` for the card to ${recipientName}` : ''}${occasion ? ` — ${occasion}` : ''} is confirmed.

What's included:
${textItems.join('\n')}

Total: ${amount}
Order: ${orderId}

${ctaLabel}: ${ctaHref}

— Celebrait`;

  return sendEmail({ to: senderEmail, subject, html, text });
}

// ── Sender: "They've opened it" (first-view notification) ────────────
// 2026-04-28 polish: added a soft cross-sell line + secondary CTA.
// Not pushy — just acknowledges the moment and offers a re-entry path
// for the highest-LTV user (the one who just sent a card someone opened).
export async function sendSenderCardOpenedEmail(params: {
  senderEmail: string;
  senderName: string;
  recipientName: string | null;
  cardImageUrl?: string | null;
  insideImageUrl?: string | null;
}): Promise<boolean> {
  const { senderEmail, senderName, recipientName, cardImageUrl, insideImageUrl } = params;

  const who = recipientName ? escape(recipientName) : 'They';
  const subject = recipientName
    ? `${recipientName} just opened your card`
    : `They just opened your card`;
  const heading = recipientName ? `${recipientName} opened your card` : 'They opened your card';

  const body = `
    <p style="margin: 0 0 16px;">Hi ${escape(senderName)},</p>
    <p style="margin: 0 0 16px;">
      ${who} just opened the card you made${recipientName ? ' for them' : ''}.
    </p>
    <p style="margin: 0 0 24px; color: ${EMAIL_BODY}; font-size: 15px;">
      Hope they loved it.
    </p>
    <p style="margin: 0 0 8px; color: ${EMAIL_STONE}; font-size: 14px;">
      Someone else coming up? Your cards stay in your gallery — copy one to get a head start.
    </p>
  `;

  const html = chassis({
    preheader: 'Hope they loved it.',
    heading,
    heroHtml: printSpreadHero(cardImageUrl, insideImageUrl) || undefined,
    bodyHtml: body,
    cta: { label: 'Make another', href: `${PUBLIC_ORIGIN}/studio` },
  });

  const text = `Hi ${senderName},

${recipientName ?? 'They'} just opened the card you made${recipientName ? ' for them' : ''}.

Hope they loved it.

Someone else coming up? Your cards stay in your gallery — copy one to get a head start.

Make another: ${PUBLIC_ORIGIN}/studio

— Celebrait`;

  return sendEmail({ to: senderEmail, subject, html, text });
}

// ── Sender: "Your printed card just shipped" ─────────────────────────
// NEW 2026-04-28. Fired from the printer/courier webhook (Prodigi) —
// or the manual admin endpoint until that webhook is wired. Closes
// the loop the order-confirmed email opens ("tracking lands in your
// inbox the moment it ships").
export async function sendSenderPrintShippedEmail(params: {
  senderEmail: string;
  senderName: string;
  recipientName: string | null;
  trackingNumber: string;
  trackingUrl: string;
  courier: string;
  /** Free-form ETA window, e.g. "Tue–Thu" or "by Friday". */
  etaWindow: string;
  cardImageUrl?: string | null;
  insideImageUrl?: string | null;
}): Promise<boolean> {
  const {
    senderEmail,
    senderName,
    recipientName,
    trackingNumber,
    trackingUrl,
    courier,
    etaWindow,
    cardImageUrl,
    insideImageUrl,
  } = params;

  const who = recipientName ? `${escape(recipientName)}'s` : 'Your';
  const subject = recipientName
    ? `${recipientName}'s card is in the post`
    : `Your printed card is in the post`;
  const heading = recipientName
    ? `${recipientName}'s card is in the post`
    : 'Your card is in the post';

  const body = `
    <p style="margin: 0 0 16px;">Hi ${escape(senderName)},</p>
    <p style="margin: 0 0 16px;">
      ${who} card just shipped. <strong>${escape(courier)}</strong> have it now — should be with ${recipientName ? escape(recipientName) : 'them'} <strong>${escape(etaWindow)}</strong>.
    </p>
  `;

  const html = chassis({
    preheader: `${courier} · expected ${etaWindow}`,
    heading,
    heroHtml: printSpreadHero(cardImageUrl, insideImageUrl) || undefined,
    bodyHtml: body,
    cta: { label: 'Track delivery', href: trackingUrl },
    postCtaHtml: `
      <p style="margin: 0; color: ${EMAIL_STONE}; font-size: 13px;">
        Tracking ref: <span style="font-family: monospace;">${escape(trackingNumber)}</span>
      </p>
    `,
  });

  const text = `Hi ${senderName},

${recipientName ? `${recipientName}'s` : 'Your'} card just shipped. ${courier} have it now — should be with ${recipientName ?? 'them'} ${etaWindow}.

Track delivery: ${trackingUrl}
Tracking ref: ${trackingNumber}

— Celebrait`;

  return sendEmail({ to: senderEmail, subject, html, text });
}

// ── Sender: "Your printed card was delivered" ────────────────────────
// NEW 2026-04-28. The emotional beat email — courier usually emails
// delivery confirmation themselves, but we send our own to own the
// brand moment. Intentionally short. No CTA by default; soft cross-sell
// optional via secondary link, mirroring sendSenderCardOpenedEmail.
export async function sendSenderPrintDeliveredEmail(params: {
  senderEmail: string;
  senderName: string;
  recipientName: string | null;
  cardImageUrl?: string | null;
  insideImageUrl?: string | null;
}): Promise<boolean> {
  const { senderEmail, senderName, recipientName, cardImageUrl, insideImageUrl } = params;

  const who = recipientName ? escape(recipientName) : 'Your recipient';
  const subject = recipientName
    ? `${recipientName}'s card just arrived`
    : `Your printed card just arrived`;
  const heading = recipientName ? `${recipientName}'s card arrived` : 'Your card arrived';

  const body = `
    <p style="margin: 0 0 16px;">Hi ${escape(senderName)},</p>
    <p style="margin: 0 0 16px;">
      ${who}${recipientName ? "'s" : ''} card was delivered today.
    </p>
    <p style="margin: 0 0 24px; color: ${EMAIL_BODY}; font-size: 15px;">
      The best part is when they open it.
    </p>
    <p style="margin: 0; color: ${EMAIL_STONE}; font-size: 14px;">
      Someone else coming up? Your cards stay in your gallery — copy one to get a head start.
    </p>
  `;

  const html = chassis({
    preheader: 'The best part is when they open it.',
    heading,
    heroHtml: printSpreadHero(cardImageUrl, insideImageUrl) || undefined,
    bodyHtml: body,
    cta: { label: 'Make another', href: `${PUBLIC_ORIGIN}/studio` },
  });

  const text = `Hi ${senderName},

${recipientName ? `${recipientName}'s` : 'Your recipient'} card was delivered today.

The best part is when they open it.

Someone else coming up? Your cards stay in your gallery — copy one to get a head start.

Make another: ${PUBLIC_ORIGIN}/studio

— Celebrait`;

  return sendEmail({ to: senderEmail, subject, html, text });
}

// ── Drop-off recovery (sender) — card finished, never bought ─────────
// Comms PR2 (2026-04-30). Fires once per card, ~24h after generation
// completes if the sender hasn't placed a paid order. Industry recovery
// rate for "you forgot something" emails is 5-10% — small but real
// revenue lever, especially in a category where the moment can pass
// (you generated for Mum's birthday, then it slipped your mind).
//
// Tone: gentle. Never "you abandoned your cart" e-commerce-y. The card
// IS theirs already — we're just nudging them back to it.

export async function sendDropOffRecoveryEmail(params: {
  senderEmail: string;
  senderName: string | null;
  recipientName: string | null;
  occasion: string | null;
  cardId: number;
}): Promise<boolean> {
  const { senderEmail, senderName, recipientName, occasion, cardId } = params;

  const subject = recipientName
    ? `${recipientName}'s card is still waiting`
    : `Your card is still waiting`;

  const greeting = senderName ? `Hi ${escape(senderName)},` : 'Hi there,';
  const recipientClause = recipientName
    ? `${escape(recipientName)}'s ${escape(occasion ?? '')} card`.replace(/\s+/g, ' ').trim()
    : 'Your card';

  const body = `
    <p style="margin: 0 0 16px;">${greeting}</p>
    <p style="margin: 0 0 16px;">
      ${recipientClause} is still in your gallery. We didn't want you to forget about it.
    </p>
    <p style="margin: 0 0 16px;">
      Have another look — send it as it is, or change something first.
    </p>
    <p style="margin: 0; color: ${EMAIL_BODY}; font-size: 15px;">
      No rush — it stays in your gallery.
    </p>
  `;

  const cardUrl = `${PUBLIC_ORIGIN}/studio/card/${cardId}`;
  const html = chassis({
    preheader: 'Ready when you are — no rush.',
    bodyHtml: body,
    cta: { label: 'View your card', href: cardUrl },
    footerNote: optOutFooter(),
  });

  const text =
    `${senderName ? `Hi ${senderName},\n\n` : ''}` +
    `${recipientClause} is still in your gallery. We didn't want you to forget about it.\n\n` +
    `Have another look: ${cardUrl}\n\n` +
    `No rush — it stays in your gallery.\n\n— Celebrait`;

  return sendEmail({ to: senderEmail, subject, html, text });
}

// ── Drop-off tweak (sender) — Day 4, iteration framing ──────────────
// Second touch in the 3-email drop-off cadence (added 2026-05-10).
// Different audience than the Day 1 dropoff: people who DID see the
// card and weren't quite sure about it — wrong vibe, slightly off
// likeness, want a different style. The Day 1 email assumes "you
// forgot" — this one assumes "you weren't sure." Different framing,
// different copy, different CTA.
//
// Tone: invites engagement, doesn't push the buy. The whole point is
// to lower the threshold for users who'd iterate but feel locked in.
// Explicitly mentions photo / scene / style swaps as concrete options.

export async function sendDropOffTweakEmail(params: {
  senderEmail: string;
  senderName: string | null;
  recipientName: string | null;
  occasion: string | null;
  cardId: number;
}): Promise<boolean> {
  const { senderEmail, senderName, recipientName, occasion, cardId } = params;

  const subject = recipientName
    ? `Want to change ${recipientName}'s card?`
    : `Want to change your card?`;

  const greeting = senderName ? `Hi ${escape(senderName)},` : 'Hi there,';
  const recipientClause = recipientName
    ? `${escape(recipientName)}'s ${escape(occasion ?? '')} card`.replace(/\s+/g, ' ').trim()
    : 'Your card';

  const body = `
    <p style="margin: 0 0 16px;">${greeting}</p>
    <p style="margin: 0 0 16px;">
      Just checking in — if ${recipientClause} isn't quite right, you can
      change it without losing the version we made.
    </p>
    <p style="margin: 0 0 16px;">
      Try a different scene, swap the photo, or pick a new style. Each
      change makes a new version, and your originals stay in your gallery.
    </p>
    <p style="margin: 0; color: ${EMAIL_BODY}; font-size: 15px;">
      Or if it's already right, it's ready to send.
    </p>
  `;

  const cardUrl = `${PUBLIC_ORIGIN}/studio/card/${cardId}`;
  const html = chassis({
    preheader: "Change the scene, swap the photo, or try a new style.",
    bodyHtml: body,
    cta: { label: 'Change your card', href: cardUrl },
    footerNote: optOutFooter(),
  });

  const text =
    `${senderName ? `Hi ${senderName},\n\n` : ''}` +
    `Just checking in — if ${recipientClause} isn't quite right, you can change it without losing the version we made.\n\n` +
    `Try a different scene, swap the photo, or pick a new style. Each change makes a new version, and your originals stay in your gallery.\n\n` +
    `Change it: ${cardUrl}\n\n` +
    `Or if it's already right, it's ready to send.\n\n— Celebrait`;

  return sendEmail({ to: senderEmail, subject, html, text });
}

// ── Drop-off last call (sender) — Day 10, soft urgency ──────────────
// Third and final touch in the drop-off cadence (added 2026-05-10).
// Polite stop signal — for both the user (we'll stop emailing about
// this card) AND for our own ToS/sender-rep hygiene. The card stays
// in their gallery; we just stop pushing.
//
// Tone: low-pressure, terminal. "After this we'll stop emailing about
// it" is the explicit promise — both a signal and a self-imposed
// constraint. Better the user knows we're not going to chase forever.

export async function sendDropOffLastCallEmail(params: {
  senderEmail: string;
  senderName: string | null;
  recipientName: string | null;
  occasion: string | null;
  cardId: number;
}): Promise<boolean> {
  const { senderEmail, senderName, recipientName, occasion, cardId } = params;

  const subject = recipientName
    ? `Last note about ${recipientName}'s card`
    : `Last note about your card`;

  const greeting = senderName ? `Hi ${escape(senderName)},` : 'Hi there,';
  const recipientClause = recipientName
    ? `${escape(recipientName)}'s ${escape(occasion ?? '')} card`.replace(/\s+/g, ' ').trim()
    : 'Your card';

  const body = `
    <p style="margin: 0 0 16px;">${greeting}</p>
    <p style="margin: 0 0 16px;">
      ${recipientClause} is still in your gallery, ready when you are.
    </p>
    <p style="margin: 0 0 16px;">
      This is the last we'll email you about this one — we don't want to
      keep nudging if it's not the right time. You can always come back
      to it from your gallery, no email needed.
    </p>
    <p style="margin: 0; color: ${EMAIL_BODY}; font-size: 15px;">
      Send it, change it, or leave it for later — up to you.
    </p>
  `;

  const cardUrl = `${PUBLIC_ORIGIN}/studio/card/${cardId}`;
  const html = chassis({
    preheader: "We'll stop emailing about this card after today.",
    bodyHtml: body,
    cta: { label: 'View your card', href: cardUrl },
    footerNote: optOutFooter(),
  });

  const text =
    `${senderName ? `Hi ${senderName},\n\n` : ''}` +
    `${recipientClause} is still in your gallery, ready when you are.\n\n` +
    `This is the last we'll email you about this one — we don't want to keep nudging if it's not the right time. You can always come back to it from your gallery, no email needed.\n\n` +
    `View your card: ${cardUrl}\n\n` +
    `Send it, change it, or leave it for later — up to you.\n\n— Celebrait`;

  return sendEmail({ to: senderEmail, subject, html, text });
}

// ── Reminder (sender) — occasion is approaching ──────────────────────
// Three-tier cadence (Reminders V1, 2026-04-29):
//   T-21 (warm prompt) — "in 3 weeks. Want to get started?"
//   T-7  (nudge)       — "one week to go. Time to start."
//   T-3  (digital pivot) — "cutting it fine for print. Send digital
//                          today and they'll have it on the day."
//
// Smart-skip happens upstream in the cron — this function just renders
// the right copy for the requested tier. Subject lines name the
// recipient + occasion; pre-headers give the time horizon.
//
// CTA deep-links to the new-card maker with recipient + occasion
// pre-filled where possible (server passes these as query params on
// the URL). If the user has the recipient saved with a portrait /
// other context, that all loads in via the address-book typeahead.

export type ReminderTier = 't_21' | 't_7' | 't_3';

export async function sendReminderEmail(params: {
  senderEmail: string;
  senderName: string | null;
  recipientName: string;
  occasion: string;
  /** Days until the occasion. Fed into the copy explicitly. */
  daysUntil: number;
  tier: ReminderTier;
  /** Deep link to start the card. Should pre-fill recipient + occasion
   *  via query string. Generated upstream by the cron. */
  startCardUrl: string;
  /** Front image of the most recent card this user sent to this
   *  recipient, if any. Rendered above the body as *"last time you
   *  sent this"* — the retention-paradox fix from
   *  next_address_book_reminders_retention.md. Without this, the email
   *  trains users to remember the date (they go wherever's cheapest);
   *  with it, the email anchors the act to Celebrait specifically.
   *  May be an absolute URL or a `/images/...` path (we absolutise). */
  lastCardImageUrl?: string | null;
  /** Inside of that last card — so the memory shows the same small print
   *  spread as every other card email (Kevin 2026-07-11). */
  lastInsideImageUrl?: string | null;
}): Promise<boolean> {
  const {
    senderEmail,
    senderName,
    recipientName,
    occasion,
    daysUntil,
    tier,
    startCardUrl,
    lastCardImageUrl,
    lastInsideImageUrl,
  } = params;

  const greeting = senderName ? `Hi ${escape(senderName)},` : 'Hi there,';
  const occasionLabel = humaniseOccasion(occasion);

  // The memory block — the small print-ready spread of the LAST card they
  // sent this person, framed "last time you sent this" (the retention hook
  // from next_address_book_reminders_retention.md). Same spread as every
  // other card email, kept in the body so the framing sits with it.
  const memorySpread = printSpreadHero(lastCardImageUrl, lastInsideImageUrl);
  const memoryBlock = memorySpread
    ? `
      <p style="margin: 0 0 14px; color: ${EMAIL_STONE}; font-size: 14px;">
        Last time you sent ${escape(recipientName)} this&nbsp;&mdash;
      </p>
      <div style="margin: 0 0 24px;">
        ${memorySpread}
      </div>
    `
    : '';

  // Tier-specific copy. Subject + pre-header + body each adapt.
  let subject: string;
  let preheader: string;
  let body: string;
  let ctaLabel: string;

  // When we have last-card art, the body opens with the memory block
  // and uses *"make this year's"* framing — anchors the act to the
  // previous Celebrait card the user made. Without art, copy stays
  // generic. Memory block is rendered first so the image is the first
  // thing visible after the greeting.
  const hasMemory = !!memorySpread;

  if (tier === 't_21') {
    subject = `${recipientName}'s ${occasionLabel} is in 3 weeks`;
    preheader = hasMemory
      ? `Time to make this year's.`
      : `Plenty of time to make them something special.`;
    body = `
      <p style="margin: 0 0 16px;">${greeting}</p>
      ${memoryBlock}
      <p style="margin: 0 0 16px;">
        ${escape(recipientName)}'s ${escape(occasionLabel)} is in <strong>3 weeks</strong>.${hasMemory ? ` Plenty of time to make this year's.` : ` Plenty of time to make them something special.`}
      </p>
      <p style="margin: 0 0 8px; color: ${EMAIL_BODY};">
        Start now and you've time to change the scene, the message — anything you like.
      </p>
    `;
    ctaLabel = hasMemory
      ? `Make this year's card`
      : `Start ${recipientName}'s card`;
  } else if (tier === 't_7') {
    subject = `One week to ${recipientName}'s ${occasionLabel}`;
    preheader = hasMemory
      ? `Time to make this year's card.`
      : `Time to start their card.`;
    body = `
      <p style="margin: 0 0 16px;">${greeting}</p>
      ${memoryBlock}
      <p style="margin: 0 0 16px;">
        ${escape(recipientName)}'s ${escape(occasionLabel)} is <strong>a week away</strong>.${hasMemory ? ` Time to make this year's.` : ''} Start now and there's time to print and post it before the day.
      </p>
      <p style="margin: 0 0 8px; color: ${EMAIL_BODY};">
        Every card is printed to order (up to 72 hours) then posted — a week gives it room to arrive in good time.
      </p>
    `;
    ctaLabel = hasMemory
      ? `Make this year's card`
      : `Start ${recipientName}'s card`;
  } else {
    // t_3 — cutting it fine. Print is made-to-order (up to 72h) so this
    // close it's tight; the honest safety net is the free digital link,
    // which lands instantly. Print-led: there's no standalone digital card
    // to "pivot" to — every card already includes the share link (see
    // next_digital_card_strategy.md).
    subject = `${recipientName}'s ${occasionLabel} is in ${daysUntil} days`;
    preheader = `It's tight for print — but the digital link sends instantly.`;
    body = `
      <p style="margin: 0 0 16px;">${greeting}</p>
      ${memoryBlock}
      <p style="margin: 0 0 16px;">
        ${escape(recipientName)}'s ${escape(occasionLabel)} is <strong>in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}</strong>. Cards are printed to order (up to 72 hours) then posted, so it's tight this close — choose the fastest delivery at checkout to give it the best chance.
      </p>
      <p style="margin: 0 0 8px; color: ${EMAIL_BODY};">
        It takes about 5 minutes to make, and every card comes with a free share link that arrives instantly — so you'll always have something to send on the day.
      </p>
    `;
    ctaLabel = hasMemory
      ? `Make this year's card`
      : `Start ${recipientName}'s card`;
  }

  const html = chassis({
    preheader,
    bodyHtml: body,
    cta: { label: ctaLabel, href: startCardUrl },
    footerNote: optOutFooter(),
  });

  const text =
    `${senderName ? `Hi ${senderName},\n\n` : ''}` +
    (tier === 't_21'
      ? `${recipientName}'s ${occasionLabel} is in 3 weeks — plenty of time to make them something special.`
      : tier === 't_7'
        ? `${recipientName}'s ${occasionLabel} is a week away. Start now and there's time to print and post it before the day.`
        : `${recipientName}'s ${occasionLabel} is in ${daysUntil} days. Cards are printed to order (up to 72 hours) then posted, so it's tight — choose the fastest delivery, and the free digital link arrives instantly either way.`) +
    `\n\nStart here: ${startCardUrl}\n\n— Celebrait`;

  return sendEmail({ to: senderEmail, subject, html, text });
}

/** Convert an occasion key (e.g. "birthday", "valentines") into the
 *  human label used in subjects + body. Mirrors the OCCASION_OPTIONS
 *  list in studio-address-book-form.tsx; kept in sync manually. */
function humaniseOccasion(occasion: string): string {
  const lower = occasion.toLowerCase().trim();
  switch (lower) {
    case 'birthday':
      return 'birthday';
    case 'anniversary':
      return 'anniversary';
    case 'wedding':
      return 'wedding';
    case 'engagement':
      return 'engagement';
    case 'baby':
      return 'new baby';
    case 'graduation':
      return 'graduation';
    case 'christmas':
      return 'Christmas';
    case 'valentines':
      return "Valentine's Day";
    case 'mothers_day':
      return "Mother's Day";
    case 'fathers_day':
      return "Father's Day";
    case 'thankyou':
      return 'thank you';
    case 'sympathy':
      return 'sympathy';
    default:
      // Custom / unknown — pass through with first letter lowered so
      // it slots into "their X" naturally
      return lower;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────
function escape(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(minor: number, currency: string): string {
  const major = (minor / 100).toFixed(2);
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'ZAR' ? 'R' : '';
  return `${symbol}${major}`;
}

/** Format a scheduled-delivery date for the order-confirmed email's
 *  digital line. Default locale = en-GB ("15 May 2026"); can be
 *  parameterised later if we localise. */
function formatScheduledDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
