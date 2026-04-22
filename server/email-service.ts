// server/email-service.ts
//
// Email transport + all Studio-era templates.
//
// Phase 1 (Sprint 4) flow:
//   - Recipient: gets a "card has arrived" email when a sender's
//     digital order is marked paid.
//   - Sender: gets an order-confirmation email at the same moment.
//   - Sender: gets a "they've opened it" email the first time the
//     recipient opens the tokenised share link.
//
// Plus auth OTP + a generation-failed error notification.
// Everything else from the pre-Studio era (marketing list, signup
// welcome, card-preview, abandonment recovery, shipping updates) was
// wiped on 2026-04-21 when the Studio flow became the only path.

import * as brevo from '@getbrevo/brevo';
import nodemailer from 'nodemailer';

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

const brevoApiKey = process.env.BREVO_API_KEY;
if (!brevoApiKey) {
  throw new Error('BREVO_API_KEY environment variable must be set');
}

console.log('Brevo API Key configured:', brevoApiKey ? 'Present' : 'Missing');

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);

const FROM_EMAIL = 'greetings@celebrait.co.za';
const FROM_NAME = 'Celebrait';

interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{ name: string; content: string; type: string }>;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  const from = params.from ?? FROM_EMAIL;
  try {
    const transporter = createSmtpTransporter();
    if (!transporter) {
      return sendEmailViaBrevoApi({ ...params, from });
    }
    const mailOptions: any = {
      from: `"${FROM_NAME}" <${from}>`,
      to: params.to,
      subject: params.subject,
      text: params.text || 'Email content is available in HTML format.',
    };
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
  try {
    const msg = new brevo.SendSmtpEmail();
    msg.to = [{ email: params.to }];
    msg.sender = { email: params.from ?? FROM_EMAIL, name: FROM_NAME };
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

// ── OTP (auth) ───────────────────────────────────────────────────────
export async function sendOtpEmail(email: string, code: string): Promise<boolean> {
  const transporter = createSmtpTransporter();
  if (!transporter) {
    console.error('[OTP] SMTP not configured — OTP email cannot be sent');
    return false;
  }
  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: email,
      subject: `${code} is your Celebrait verification code`,
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
      html: otpHtml(code),
    });
    return true;
  } catch (err) {
    console.error('[OTP] send failed:', err);
    return false;
  }
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

// ── Generation failure (error notification to sender) ────────────────
export async function sendGenerationFailedEmail(
  userEmail: string,
  userName: string,
  cardId: number,
): Promise<void> {
  try {
    await sendEmail({
      to: userEmail,
      subject: 'We hit a snag with your Celebrait card',
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #fff;">
          <h2 style="color: #5c57d4; margin: 0 0 16px;">Hi ${escape(userName) || 'there'},</h2>
          <p style="color: #374151; line-height: 1.6;">
            We ran into a problem generating your card (#${cardId}). This sometimes
            happens when our AI provider's safety system is overly cautious about
            an uploaded photo.
          </p>
          <p style="color: #374151; line-height: 1.6;">
            <strong>What to do:</strong> head back to Celebrait and try again — a
            different photo usually clears it.
          </p>
          <a href="https://celebrait.co.za" style="display: inline-block; margin-top: 20px; padding: 12px 28px; background: #7a76e8; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600;">Try again</a>
          <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">You weren't charged.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[EMAIL] generation-failed notification failed:', err);
  }
}

// ── Recipient: "A card has arrived for you" ──────────────────────────
// Sent the moment a sender's digital order is marked paid. This is
// the recipient's FIRST contact with the Celebrait brand — the
// copy has to land emotionally, not read as a SaaS notification.
// See HERO_CARD.md for the brand positioning we're carrying through.
export async function sendRecipientCardArrivedEmail(params: {
  recipientEmail: string;
  recipientName: string | null;
  senderName: string;
  occasion: string | null;
  shareUrl: string;
}): Promise<boolean> {
  const { recipientEmail, recipientName, senderName, occasion, shareUrl } = params;

  const subject = `A card for you, from ${senderName}`;
  const preheader =
    `${senderName} made something by hand — well, by heart. It's waiting inside.`;

  const greeting = recipientName ? `Hi ${escape(recipientName)},` : 'Hello,';
  const occasionClause = occasion ? ` for your ${escape(occasion)}` : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escape(subject)}</title>
      </head>
      <body style="margin: 0; padding: 0; background: #fafaf9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
        <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; overflow: hidden;">${escape(preheader)}</span>
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
                  <td style="padding: 32px 40px 8px 40px; color: #0f172a; font-size: 16px; line-height: 1.7;">
                    <p style="margin: 0 0 16px;">${greeting}</p>
                    <p style="margin: 0 0 16px;">
                      <strong>${escape(senderName)}</strong> has sent you a card${occasionClause}.
                      Not a forwarded link or a last-minute text — an actual card,
                      designed around you, waiting to be opened.
                    </p>
                    <p style="margin: 0 0 28px;">
                      It lives here, whenever you're ready:
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 8px 40px;" align="center">
                    <a href="${escape(shareUrl)}" style="display: inline-block; background: #7a76e8; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 36px; border-radius: 10px;">
                      Open your card &rarr;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 40px 40px 40px; color: #475569; font-size: 15px; line-height: 1.7;">
                    <p style="margin: 0 0 8px;">
                      Take your time with it. It was made to be lingered over.
                    </p>
                    <p style="margin: 0; color: #94a3b8; font-size: 14px;">— Celebrait</p>
                  </td>
                </tr>
              </table>
              <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0; max-width: 480px;">
                If the button above doesn't work, copy and paste this link into your browser:<br>
                <span style="word-break: break-all;">${escape(shareUrl)}</span>
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text =
    `${recipientName ? `Hi ${recipientName},\n\n` : ''}` +
    `${senderName} has sent you a card${occasion ? ` for your ${occasion}` : ''}.\n\n` +
    `Open it here: ${shareUrl}\n\n` +
    `Take your time with it. It was made to be lingered over.\n\n` +
    `— Celebrait`;

  return sendEmail({ to: recipientEmail, subject, html, text });
}

// ── Sender: "Your card has been sent" (order confirmation) ───────────
export async function sendSenderOrderConfirmedEmail(params: {
  senderEmail: string;
  senderName: string;
  recipientName: string | null;
  occasion: string | null;
  includesPrint: boolean;
  includesDigital: boolean;
  totalAmount: number;
  currency: string;
  orderId: string;
}): Promise<boolean> {
  const {
    senderEmail,
    senderName,
    recipientName,
    occasion,
    includesPrint,
    includesDigital,
    totalAmount,
    currency,
    orderId,
  } = params;

  const forWhom = recipientName ? ` for ${escape(recipientName)}` : '';
  const occasionSuffix = occasion ? ` — ${escape(occasion)}` : '';
  const subject = `Your card is on its way${forWhom}`;

  const items: string[] = [];
  if (includesDigital) {
    items.push(
      `<li style="margin: 0 0 6px;">Digital — a 3D share link we've just sent to the recipient.</li>`,
    );
  }
  if (includesPrint) {
    items.push(
      `<li style="margin: 0 0 6px;">Printed — queued for print; we'll email again when it ships.</li>`,
    );
  }

  const amount = formatMoney(totalAmount, currency);

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 0; background: #fafaf9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding: 48px 24px;">
              <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background: #ffffff; border-radius: 20px;">
                <tr>
                  <td style="padding: 40px 40px 0 40px; text-align: center;">
                    <span style="font-size: 22px; font-weight: 700; color: #7a76e8;">Celebrait</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 40px 8px 40px; color: #0f172a; font-size: 16px; line-height: 1.7;">
                    <p style="margin: 0 0 16px;">Hi ${escape(senderName)},</p>
                    <p style="margin: 0 0 16px;">
                      Your card${forWhom}${occasionSuffix} is on its way. Here's what you picked:
                    </p>
                    <ul style="padding-left: 20px; color: #334155; margin: 0 0 24px;">
                      ${items.join('\n')}
                    </ul>
                    <p style="margin: 0 0 24px;">
                      Total: <strong>${amount}</strong><br>
                      Order reference: <span style="color: #64748b; font-family: monospace;">${escape(orderId)}</span>
                    </p>
                    <p style="margin: 0; color: #475569; font-size: 14px;">
                      We'll let you know the moment they open it.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 40px 40px 40px; color: #94a3b8; font-size: 13px;">
                    Thanks for choosing Celebrait.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return sendEmail({ to: senderEmail, subject, html });
}

// ── Sender: "They've opened it" (first-view notification) ────────────
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

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 0; background: #fafaf9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding: 48px 24px;">
              <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background: #ffffff; border-radius: 20px;">
                <tr>
                  <td style="padding: 40px 40px 0 40px; text-align: center;">
                    <span style="font-size: 22px; font-weight: 700; color: #7a76e8;">Celebrait</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 40px 40px 40px; color: #0f172a; font-size: 16px; line-height: 1.7;">
                    <p style="margin: 0 0 16px;">Hi ${escape(senderName)},</p>
                    <p style="margin: 0 0 16px;">
                      ${who} just opened the card you made.
                    </p>
                    <p style="margin: 0; color: #475569; font-size: 15px;">
                      Hope they love it.
                    </p>
                    <p style="margin: 24px 0 0; color: #94a3b8; font-size: 13px;">— Celebrait</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return sendEmail({ to: senderEmail, subject, html });
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
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '';
  return `${symbol}${major}`;
}
