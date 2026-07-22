// server/routes/contact.ts
//
// Public contact form → POST /api/contact. Validates the submission and
// emails it to the support inbox (CONTACT_EMAIL) via Brevo, with the
// sender's address as reply-to so a reply goes straight back to them.
//
// ⚠️ CONTACT_EMAIL is greetings@celebrait.co.za per Kevin's instruction —
// note the .co.za (the rest of the site uses .co.uk). Change the constant
// if that was a typo. Override at runtime with CONTACT_EMAIL env.

import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { sendEmail } from '../email-service';

const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? 'greetings@celebrait.co.za';

const REASONS = [
  'Order or delivery',
  'Refund or return',
  "Something's wrong with my card",
  'Account or login',
  'Business or press',
  'Something else',
] as const;

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  orderNumber: z.string().trim().max(120).optional().default(''),
  reason: z.enum(REASONS),
  message: z.string().trim().min(1).max(5000),
  // Honeypot — real users never fill a hidden field. Bots do.
  company: z.string().max(0).optional(),
});

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function registerContactRoutes(app: Express): void {
  app.post('/api/contact', async (req: Request, res: Response) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Please check the form and try again.' });
    }
    const { name, email, orderNumber, reason, message, company } = parsed.data;

    // Silently accept honeypot hits so bots don't learn they were caught.
    if (company && company.length > 0) {
      return res.json({ ok: true });
    }

    const rows: [string, string][] = [
      ['Name', name],
      ['Email', email],
      ['Order number', orderNumber || '—'],
      ['Reason', reason],
    ];
    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#211D19;line-height:1.5">
        <h2 style="margin:0 0 12px">New contact form message</h2>
        <table style="border-collapse:collapse;font-size:14px">
          ${rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:4px 12px 4px 0;color:#7A7267">${k}</td><td style="padding:4px 0"><strong>${esc(v)}</strong></td></tr>`,
            )
            .join('')}
        </table>
        <p style="margin:16px 0 4px;color:#7A7267;font-size:13px">Message</p>
        <div style="white-space:pre-wrap;font-size:14px;background:#FAF8F4;border:1px solid #E7E5E4;border-radius:8px;padding:12px">${esc(message)}</div>
      </div>`;

    try {
      const sent = await sendEmail({
        to: CONTACT_EMAIL,
        replyTo: email,
        subject: `Contact: ${reason} — ${name}`,
        html,
      });
      if (!sent) {
        // Email transport disabled/failed. Log the payload so nothing is
        // lost while we chase it, and tell the user honestly.
        console.error('[CONTACT] sendEmail returned false — message NOT delivered:', {
          name,
          email,
          orderNumber,
          reason,
        });
        return res
          .status(502)
          .json({ message: "Sorry — we couldn't send that just now. Please email us directly." });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error('[CONTACT] error:', err);
      return res
        .status(500)
        .json({ message: "Sorry — something went wrong. Please email us directly." });
    }
  });
}
