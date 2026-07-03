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
    `<a href="${manageUrl}" style="color:#7a76e8;">Manage reminders</a> · ` +
    `<a href="mailto:${FROM_EMAIL}?subject=Unsubscribe" style="color:#7a76e8;">Unsubscribe</a>`
  );
}

function chassis(opts: {
  preheader: string;
  bodyHtml: string;
  /** Optional CTA button rendered after bodyHtml. */
  cta?: { label: string; href: string };
  /** Optional secondary line under the CTA (e.g. tracking ref). */
  postCtaHtml?: string;
  /** Optional opt-out line above the sign-off — for non-transactional
   *  email only (reminders / drop-off nudges). */
  footerNote?: string;
}): string {
  const ctaHtml = opts.cta
    ? `
        <tr>
          <td style="padding: 8px 40px 8px 40px;" align="center">
            <a href="${escape(opts.cta.href)}" style="display: inline-block; background: #7a76e8; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 36px; border-radius: 10px;">
              ${escape(opts.cta.label)} &rarr;
            </a>
          </td>
        </tr>`
    : '';
  const postCtaBlock = opts.postCtaHtml
    ? `
        <tr>
          <td style="padding: 16px 40px 0 40px; color: #475569; font-size: 14px; line-height: 1.6;">
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
      <body style="margin: 0; padding: 0; background: #fafaf9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
        <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; overflow: hidden;">${escape(opts.preheader)}</span>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #fafaf9;">
          <tr>
            <td align="center" style="padding: 48px 24px;">
              <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background: #ffffff; border-radius: 20px; box-shadow: 0 2px 12px rgba(15, 23, 42, 0.04);">
                <tr>
                  <td style="padding: 40px 40px 0 40px; text-align: center;">
                    <span style="font-size: 22px; font-weight: 700; color: #7a76e8; letter-spacing: -0.01em;">Celebrait</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 40px 16px 40px; color: #0f172a; font-size: 16px; line-height: 1.7;">
                    ${opts.bodyHtml}
                  </td>
                </tr>
                ${ctaHtml}
                ${postCtaBlock}
                <tr>
                  <td style="padding: 32px 40px 40px 40px; color: #94a3b8; font-size: 13px;">
                    ${opts.footerNote ? `<div style="margin-bottom: 14px; line-height: 1.6;">${opts.footerNote}</div>` : ''}— Celebrait
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
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 28px; font-weight: 800; color: #7a76e8; margin: 0;">Celebrait</h1>
      </div>
      <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Your verification code</h2>
      <p style="color: #555; margin-bottom: 28px; font-size: 15px;">Enter this to keep going. It expires in 10 minutes.</p>
      <div style="background: #f2f1fb; border: 2px solid #e5e4f9; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 28px;">
        <span style="font-size: 42px; font-weight: 900; letter-spacing: 10px; color: #5c57d4;">${code}</span>
      </div>
      <p style="color: #888; font-size: 13px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
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
}): Promise<boolean> {
  const { senderEmail, senderName, recipientName, occasion, cardId } = params;

  const subjectSubject = recipientName
    ? `${recipientName}'s ${occasion ?? ''} card is ready`.replace(/\s+/g, ' ').trim()
    : 'Your card is ready';

  const greeting = senderName ? `Hi ${escape(senderName)},` : 'Hi there,';
  const recipientClause = recipientName
    ? `${escape(recipientName)}'s ${escape(occasion ?? '')} card`.replace(/\s+/g, ' ').trim()
    : 'Your card';

  const body = `
    <p style="margin: 0 0 16px;">${greeting}</p>
    <p style="margin: 0 0 16px;">
      ${recipientClause} just finished rendering. Have a look — if it's right, it's ready to send. If something's a touch off, you can tweak any part of it without starting over.
    </p>
    <p style="margin: 0 0 8px;">
      Take your time. Cards are kept in your gallery.
    </p>
  `;

  const cardUrl = `${PUBLIC_ORIGIN}/studio/card/${cardId}`;
  const html = chassis({
    preheader: 'Have a look — buy it as is, or tweak before you send.',
    bodyHtml: body,
    cta: { label: 'View your card', href: cardUrl },
  });

  const text =
    `${senderName ? `Hi ${senderName},\n\n` : ''}` +
    `${recipientClause} just finished rendering. Have a look — if it's right, it's ready to send. If something's a touch off, you can tweak any part of it without starting over.\n\n` +
    `View your card: ${cardUrl}\n\n` +
    `Take your time. Cards are kept in your gallery.\n\n— Celebrait`;

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
        Something tripped up the render mid-flow. It happens occasionally — usually a photo it wasn't sure how to read.
      </p>
      <p style="margin: 0 0 16px;">
        A different shot, or just retrying the same one, almost always clears it. You weren't charged.
      </p>
    `;
    const retryUrl = `${PUBLIC_ORIGIN}/studio/card/${cardId}/edit`;
    const html = chassis({
      preheader: "It happens. A different photo usually clears it.",
      bodyHtml: body,
      cta: { label: 'Try again', href: retryUrl },
    });
    await sendEmail({
      to: userEmail,
      subject: 'Your card hit a snag — your spot is held',
      html,
    });
  } catch (err) {
    console.error('[EMAIL] generation-failed notification failed:', err);
  }
}

// ── Recipient: "A card has arrived for you" ──────────────────────────
// Sent the moment a sender's digital order is marked paid. This is
// the recipient's FIRST contact with the Celebrait brand — copy lands
// emotionally, not as a SaaS notification.
//
// 2026-04-28 polish:
//   • From-name: "{Sender} via Celebrait" (was just "Celebrait")
//   • Reply-To: SENDER'S email (was greetings@celebrait.co.za) so a
//     reply lands with the sender, not us
//   • Body trimmed; the precious "made by hand — well, by heart" line
//     stays in the pre-header where it earns its keep
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
  const preheader = `${senderName} made something by hand — well, by heart. It's waiting inside.`;

  const greeting = recipientName ? `Hi ${escape(recipientName)},` : 'Hello,';
  const occasionClause = occasion ? ` for your ${escape(occasion)}` : '';

  const body = `
    <p style="margin: 0 0 16px;">${greeting}</p>
    <p style="margin: 0 0 16px;">
      <strong>${escape(senderName)}</strong> made you a card${occasionClause}. It's quietly waiting, ready when you are.
    </p>
    <p style="margin: 0 0 8px; color: #475569; font-size: 15px;">
      Take your time with it. It was made to be lingered over.
    </p>
  `;

  const html = chassis({
    preheader,
    bodyHtml: body,
    cta: { label: 'Open your card', href: shareUrl },
    postCtaHtml: `
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
        If the button doesn't work, paste this into your browser:<br>
        <span style="word-break: break-all;">${escape(shareUrl)}</span>
      </p>
    `,
  });

  const text =
    `${recipientName ? `Hi ${recipientName},\n\n` : ''}` +
    `${senderName} made you a card${occasion ? ` for your ${occasion}` : ''}. It's quietly waiting, ready when you are.\n\n` +
    `Open it here: ${shareUrl}\n\n` +
    `Take your time with it. It was made to be lingered over.\n\n— Celebrait`;

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
    scheduledSendAt,
  } = params;

  const forWhom = recipientName ? ` to ${escape(recipientName)}` : '';
  const occasionPart = occasion ? ` — ${escape(occasion)}` : '';
  const subject = recipientName
    ? `Your card's on its way to ${recipientName}`
    : `Your card's on its way`;

  const items: string[] = [];
  if (includesDigital) {
    if (scheduledSendAt) {
      const dateLabel = formatScheduledDate(scheduledSendAt);
      items.push(
        `<li style="margin: 0 0 6px;">Digital — we'll send it to ${escape(recipientName ?? 'them')} on <strong>${dateLabel}</strong> at 8am. We'll ping you the moment they open it.</li>`,
      );
    } else if (digitalSentToRecipient) {
      items.push(
        `<li style="margin: 0 0 6px;">Digital — sent to ${escape(recipientName ?? 'them')}'s inbox just now. We'll ping you the moment they open it.</li>`,
      );
    } else {
      items.push(
        `<li style="margin: 0 0 6px;">Digital — a private share link is ready on your card. Tap below to view it and share the link however you like.</li>`,
      );
    }
  }
  if (includesPrint) {
    items.push(
      `<li style="margin: 0 0 6px;">Printed — queued for print today. Typically arrives in <strong>3–5 working days</strong>. Tracking lands in your inbox the moment it ships.</li>`,
    );
  }

  const amount = formatMoney(totalAmount, currency);

  const preheader = digitalSentToRecipient && !scheduledSendAt
    ? "We've just emailed it to them. We'll let you know when they open it."
    : `Order #${orderId}.`;

  const body = `
    <p style="margin: 0 0 16px;">Hi ${escape(senderName)},</p>
    <p style="margin: 0 0 16px;">
      Your card${forWhom}${occasionPart} is sorted.
    </p>
    <p style="margin: 0 0 8px; font-weight: 600;">What you got:</p>
    <ul style="padding-left: 20px; color: #334155; margin: 0 0 24px;">
      ${items.join('\n')}
    </ul>
    <p style="margin: 0 0 4px;">
      Total: <strong>${amount}</strong>
    </p>
    <p style="margin: 0; color: #64748b; font-size: 14px;">
      Order: <span style="font-family: monospace;">${escape(orderId)}</span>
    </p>
  `;

  const ctaHref = includesDigital
    ? `${PUBLIC_ORIGIN}/studio/card/${cardId}`
    : `${PUBLIC_ORIGIN}/studio/orders`;
  const ctaLabel = includesDigital ? 'View your card & share link' : 'View your order';
  const html = chassis({
    preheader,
    bodyHtml: body,
    cta: { label: ctaLabel, href: ctaHref },
  });

  return sendEmail({ to: senderEmail, subject, html });
}

// ── Sender: "They've opened it" (first-view notification) ────────────
// 2026-04-28 polish: added a soft cross-sell line + secondary CTA.
// Not pushy — just acknowledges the moment and offers a re-entry path
// for the highest-LTV user (the one who just sent a card someone opened).
export async function sendSenderCardOpenedEmail(params: {
  senderEmail: string;
  senderName: string;
  recipientName: string | null;
}): Promise<boolean> {
  const { senderEmail, senderName, recipientName } = params;

  const who = recipientName ? escape(recipientName) : 'They';
  const subject = recipientName
    ? `${recipientName} just opened your card`
    : `They just opened your card`;

  const body = `
    <p style="margin: 0 0 16px;">Hi ${escape(senderName)},</p>
    <p style="margin: 0 0 16px;">
      ${who} just opened the card you made${recipientName ? ' for them' : ''}.
    </p>
    <p style="margin: 0 0 24px; color: #475569; font-size: 15px;">
      Hope it landed.
    </p>
    <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">
      Got someone else coming up? Cards stay in your gallery — duplicate one as a starting point any time.
    </p>
  `;

  const html = chassis({
    preheader: 'Hope they love it.',
    bodyHtml: body,
    cta: { label: 'Make another', href: `${PUBLIC_ORIGIN}/studio` },
  });

  return sendEmail({ to: senderEmail, subject, html });
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
}): Promise<boolean> {
  const {
    senderEmail,
    senderName,
    recipientName,
    trackingNumber,
    trackingUrl,
    courier,
    etaWindow,
  } = params;

  const who = recipientName ? `${escape(recipientName)}'s` : 'Your';
  const subject = recipientName
    ? `${recipientName}'s card is in the post`
    : `Your printed card is in the post`;

  const body = `
    <p style="margin: 0 0 16px;">Hi ${escape(senderName)},</p>
    <p style="margin: 0 0 16px;">
      ${who} card just shipped. <strong>${escape(courier)}</strong> have it now — should be with ${recipientName ? escape(recipientName) : 'them'} <strong>${escape(etaWindow)}</strong>.
    </p>
  `;

  const html = chassis({
    preheader: `${courier} · expected ${etaWindow}`,
    bodyHtml: body,
    cta: { label: 'Track delivery', href: trackingUrl },
    postCtaHtml: `
      <p style="margin: 0; color: #64748b; font-size: 13px;">
        Tracking ref: <span style="font-family: monospace;">${escape(trackingNumber)}</span>
      </p>
    `,
  });

  return sendEmail({ to: senderEmail, subject, html });
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
}): Promise<boolean> {
  const { senderEmail, senderName, recipientName } = params;

  const who = recipientName ? escape(recipientName) : 'Your recipient';
  const subject = recipientName
    ? `${recipientName}'s card just arrived`
    : `Your printed card just arrived`;

  const body = `
    <p style="margin: 0 0 16px;">Hi ${escape(senderName)},</p>
    <p style="margin: 0 0 16px;">
      ${who}${recipientName ? "'s" : ''} card was delivered today.
    </p>
    <p style="margin: 0 0 24px; color: #475569; font-size: 15px;">
      The good bit's coming.
    </p>
    <p style="margin: 0; color: #64748b; font-size: 14px;">
      Got someone else coming up? Cards stay in your gallery — duplicate one as a starting point any time.
    </p>
  `;

  const html = chassis({
    preheader: 'Hope it lands well.',
    bodyHtml: body,
    cta: { label: 'Make another', href: `${PUBLIC_ORIGIN}/studio` },
  });

  return sendEmail({ to: senderEmail, subject, html });
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
      ${recipientClause} is still in your gallery. We didn't want it to slip your mind.
    </p>
    <p style="margin: 0 0 16px;">
      Take another look — buy it as is, or tweak something before you send.
    </p>
    <p style="margin: 0; color: #475569; font-size: 15px;">
      No rush. Cards stay in your gallery.
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
    `${recipientClause} is still in your gallery. We didn't want it to slip your mind.\n\n` +
    `Take another look: ${cardUrl}\n\n` +
    `No rush. Cards stay in your gallery.\n\n— Celebrait`;

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
    ? `Want to tweak ${recipientName}'s card?`
    : `Want to tweak your card?`;

  const greeting = senderName ? `Hi ${escape(senderName)},` : 'Hi there,';
  const recipientClause = recipientName
    ? `${escape(recipientName)}'s ${escape(occasion ?? '')} card`.replace(/\s+/g, ' ').trim()
    : 'Your card';

  const body = `
    <p style="margin: 0 0 16px;">${greeting}</p>
    <p style="margin: 0 0 16px;">
      Just checking — if ${recipientClause} didn't quite land, you can
      tweak it without losing what we made.
    </p>
    <p style="margin: 0 0 16px;">
      Try a different scene description, swap the reference photo, or
      pick a new style. Each tweak makes a fresh version — your originals
      stay in your gallery.
    </p>
    <p style="margin: 0; color: #475569; font-size: 15px;">
      Or if it's already exactly right, you know where the buy button is.
    </p>
  `;

  const cardUrl = `${PUBLIC_ORIGIN}/studio/card/${cardId}`;
  const html = chassis({
    preheader: "Tweak the scene, swap the photo, try a different style.",
    bodyHtml: body,
    cta: { label: 'Tweak your card', href: cardUrl },
    footerNote: optOutFooter(),
  });

  const text =
    `${senderName ? `Hi ${senderName},\n\n` : ''}` +
    `Just checking — if ${recipientClause} didn't quite land, you can tweak it without losing what we made.\n\n` +
    `Try a different scene description, swap the reference photo, or pick a new style. Each tweak makes a fresh version — your originals stay in your gallery.\n\n` +
    `Tweak it: ${cardUrl}\n\n` +
    `Or if it's already exactly right, you know where the buy button is.\n\n— Celebrait`;

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
    <p style="margin: 0; color: #475569; font-size: 15px;">
      Buy it, tweak it, or leave it for later. Up to you.
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
    `Buy it, tweak it, or leave it for later. Up to you.\n\n— Celebrait`;

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
  } = params;

  const greeting = senderName ? `Hi ${escape(senderName)},` : 'Hi there,';
  const occasionLabel = humaniseOccasion(occasion);

  // Absolutise the card image URL — email clients can't resolve
  // relative paths. Falls through unchanged if already absolute.
  const absoluteCardImage = lastCardImageUrl
    ? lastCardImageUrl.startsWith('http')
      ? lastCardImageUrl
      : `${PUBLIC_ORIGIN}${lastCardImageUrl}`
    : null;

  // The memory block — rendered before the body when we have art to
  // show. Soft caption framing ("last time you sent this") sets up the
  // body's *"want to do something for this one?"* without being explicit
  // about the strategic intent. Inline styles only — email clients
  // strip <style> tags.
  const memoryBlock = absoluteCardImage
    ? `
      <p style="margin: 0 0 12px; color: #475569; font-size: 14px;">
        Last time you sent ${escape(recipientName)} this&nbsp;&mdash;
      </p>
      <div style="margin: 0 0 24px; text-align: center;">
        <img src="${escape(absoluteCardImage)}" alt="The card you sent ${escape(recipientName)}" width="320" style="display: inline-block; max-width: 320px; width: 100%; height: auto; border-radius: 14px; box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08); border: 1px solid rgba(15, 23, 42, 0.04);">
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
  const hasMemory = !!absoluteCardImage;

  if (tier === 't_21') {
    subject = `${recipientName}'s ${occasionLabel} is in 3 weeks`;
    preheader = hasMemory
      ? `Time to make this year's.`
      : `Plenty of time to make them something lovely.`;
    body = `
      <p style="margin: 0 0 16px;">${greeting}</p>
      ${memoryBlock}
      <p style="margin: 0 0 16px;">
        ${escape(recipientName)}'s ${escape(occasionLabel)} is in <strong>3 weeks</strong>.${hasMemory ? ` Plenty of time to make this year's.` : ` Plenty of time to make them something lovely.`}
      </p>
      <p style="margin: 0 0 8px; color: #475569;">
        Start now and there's room to tweak the scene, the message, the lot.
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
        ${escape(recipientName)}'s ${escape(occasionLabel)} is <strong>a week away</strong>.${hasMemory ? ` Time to make this year's.` : ''} If you start now, there's comfortable runway to print and post in time for the day.
      </p>
      <p style="margin: 0 0 8px; color: #475569;">
        Every card's printed to order (allow up to 72 hrs) then posted — a week gives it room to arrive with time to spare.
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
    preheader = `Cutting it fine — the digital link sends instantly.`;
    body = `
      <p style="margin: 0 0 16px;">${greeting}</p>
      ${memoryBlock}
      <p style="margin: 0 0 16px;">
        ${escape(recipientName)}'s ${escape(occasionLabel)} is <strong>in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}</strong>. Cards are printed to order (up to 72 hrs) then posted, so this close it's tight — pick the fastest delivery at checkout to give the printed card its best shot.
      </p>
      <p style="margin: 0 0 8px; color: #475569;">
        About 5 minutes to make — and every card comes with a free share link that lands the instant it's ready, so you've always got something to send on the day.
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
      ? `${recipientName}'s ${occasionLabel} is in 3 weeks — plenty of time to make them something lovely.`
      : tier === 't_7'
        ? `${recipientName}'s ${occasionLabel} is a week away. If you start now there's time to print and post.`
        : `${recipientName}'s ${occasionLabel} is in ${daysUntil} days. Cards are printed to order (up to 72h) then posted, so it's tight — pick the fastest delivery, and the free digital link lands instantly either way.`) +
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
