// server/routes/admin-test-emails.ts
//
// Admin-only endpoint to fire any of the Studio's transactional emails
// against an admin's own inbox (or an arbitrary cardId), bypassing the
// real triggers. Used to:
//
//   1. QA copy + design changes without paying for real generations.
//   2. Test the print emails (sender-print-shipped, sender-print-delivered)
//      until Prodigi is wired with real webhooks. Today there's no
//      automatic trigger for those — this endpoint is the only way to
//      see them.
//
// Throwaway tool — once the real triggers are wired, this file can be
// deleted without touching anything else. The email functions in
// email-service.ts are the production surface; this just calls them.
//
// Endpoint:
//   POST /api/admin/test-email/:template
//
// Auth: requires session OTP user → users.is_admin = true (same
// pattern as admin-costs.ts and prompts.ts). Returns 403 otherwise.
//
// Body params (all optional):
//   cardId          → load real card+user data; falls back to dummy
//   to              → override recipient address (defaults to admin's
//                     own email so testing is one-click)
//   ...template-specific overrides per the switch below
//
// Curl one-liners (paste with your session cookie):
//
//   curl -X POST http://localhost:5050/api/admin/test-email/card-ready \
//     -H 'Content-Type: application/json' --cookie 'connect.sid=...' \
//     -d '{"cardId": 102}'
//
//   curl -X POST http://localhost:5050/api/admin/test-email/sender-print-shipped \
//     -H 'Content-Type: application/json' --cookie 'connect.sid=...' \
//     -d '{"cardId": 102, "courier": "Aramex", "trackingNumber": "ABC123", "trackingUrl": "https://example.com/track/ABC123", "etaWindow": "Fri 2 May"}'

import type { Express, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
  cards,
  users,
  type CardDraftState,
} from '@shared/schema';
import { publicImageUrl } from '../image-storage';
import {
  sendCardReadyEmail,
  sendGenerationFailedEmail,
  sendRecipientCardArrivedEmail,
  sendSenderOrderConfirmedEmail,
  sendSenderCardOpenedEmail,
  sendSenderPrintShippedEmail,
  sendSenderPrintDeliveredEmail,
  sendDropOffRecoveryEmail,
  sendDropOffTweakEmail,
  sendDropOffLastCallEmail,
  renderEmailForPreview,
  sendEmail,
} from '../email-service';

async function isAdmin(req: Request): Promise<boolean> {
  const otpUserId = (req as any).session?.otpUserId;
  if (typeof otpUserId !== 'string' || otpUserId.length === 0) return false;
  const row = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, otpUserId))
    .limit(1);
  return row[0]?.isAdmin === true;
}

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!(await isAdmin(req))) {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
}

/** Load the calling admin's email + name so we can default test sends
 *  to their own inbox (one-click testing). Returns null if not
 *  resolvable — callers should require explicit `to` in that case. */
async function loadAdminContact(
  req: Request,
): Promise<{ email: string; firstName: string | null } | null> {
  const otpUserId = (req as any).session?.otpUserId;
  if (typeof otpUserId !== 'string') return null;
  const rows = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, otpUserId))
    .limit(1);
  const row = rows[0];
  if (!row?.email) return null;
  return { email: row.email, firstName: row.firstName ?? null };
}

/** Optional card-context loader. When `cardId` is supplied, we look up
 *  the card + its owner and populate the template's recipient/sender
 *  vars from real data — gives a more realistic preview. Falls back
 *  to dummies when not supplied or not found. */
async function loadCardContext(cardId: number | undefined): Promise<{
  state: CardDraftState | null;
  ownerEmail: string | null;
  ownerFirstName: string | null;
  /** Absolute front-image URL for hero previews (null when no card art). */
  cardImageUrl: string | null;
} | null> {
  if (!cardId) return null;
  const rows = await db
    .select({
      conversationData: cards.conversationData,
      userId: cards.userId,
      frontImagePath: cards.frontImagePath,
      frontImageUrl: cards.frontImageUrl,
    })
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const state = (row.conversationData as CardDraftState | null) ?? null;
  const cardImageUrl = row.frontImagePath
    ? publicImageUrl(row.frontImagePath)
    : row.frontImageUrl ?? null;
  if (!row.userId) {
    return { state, ownerEmail: null, ownerFirstName: null, cardImageUrl };
  }
  const userRows = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  return {
    state,
    ownerEmail: userRows[0]?.email ?? null,
    ownerFirstName: userRows[0]?.firstName ?? null,
    cardImageUrl,
  };
}

/** Build a [recipient name, occasion, sender name] tuple from card
 *  context + body overrides + dummy fallbacks. Used everywhere. */
function resolveTestVars(
  body: any,
  cardCtx: Awaited<ReturnType<typeof loadCardContext>>,
  adminContact: { email: string; firstName: string | null } | null,
) {
  const recipientName =
    body?.recipientName ??
    cardCtx?.state?.recipient?.name?.trim() ??
    'Mum';
  const occasion =
    body?.occasion ??
    cardCtx?.state?.recipient?.occasion?.trim() ??
    'birthday';
  const senderName =
    body?.senderName ??
    cardCtx?.ownerFirstName ??
    adminContact?.firstName ??
    'Aidan';
  return { recipientName, occasion, senderName };
}

// ── Template dispatcher ──────────────────────────────────────────────
// Shared by both the send and preview endpoints. Same switch, same
// param marshalling — preview just wraps the call in
// renderEmailForPreview() (from email-service.ts), which intercepts
// the inner sendEmail() call via AsyncLocalStorage and returns the
// rendered parts instead of firing SMTP.

const KNOWN_TEMPLATES = [
  'card-ready',
  'generation-failed',
  'recipient-card-arrived',
  'sender-order-confirmed',
  'sender-card-opened',
  'sender-print-shipped',
  'sender-print-delivered',
  'dropoff-recovery',
  'dropoff-tweak',
  'dropoff-last-call',
] as const;

type KnownTemplate = (typeof KNOWN_TEMPLATES)[number];

function isKnownTemplate(s: string): s is KnownTemplate {
  return (KNOWN_TEMPLATES as readonly string[]).includes(s);
}

async function dispatchTemplate(
  template: KnownTemplate,
  args: {
    targetTo: string;
    vars: ReturnType<typeof resolveTestVars>;
    cardId: number | undefined;
    /** Raw request body — read for per-template overrides (tracking
     *  number, order amounts, etc.). All keys optional; sensible
     *  defaults applied per template. */
    body: Record<string, any>;
    /** Admin's resolved contact — used as the default sender when a
     *  template needs both a recipient AND a sender (e.g. recipient-
     *  card-arrived). */
    adminContact: { email: string; firstName: string | null };
    /** Absolute front-image URL from the loaded card (null when dummy). */
    cardImageUrl: string | null;
  },
): Promise<boolean> {
  const { targetTo, vars, cardId, body, adminContact, cardImageUrl } = args;
  switch (template) {
    case 'card-ready': {
      // Real card art when a cardId is given; a sample front otherwise so
      // the hero still renders in a dummy preview.
      const origin = process.env.PUBLIC_APP_ORIGIN ?? 'https://celebrait.co.uk';
      return sendCardReadyEmail({
        senderEmail: targetTo,
        senderName: vars.senderName,
        recipientName: vars.recipientName,
        occasion: vars.occasion,
        cardId: cardId ?? 0,
        cardImageUrl: cardImageUrl ?? `${origin}/hero-card-front.webp`,
      });
    }
    case 'generation-failed': {
      await sendGenerationFailedEmail(targetTo, vars.senderName, cardId ?? 0);
      // Function returns void; assume success unless it threw.
      return true;
    }
    case 'recipient-card-arrived': {
      const shareUrl =
        body.shareUrl ??
        `${process.env.PUBLIC_APP_ORIGIN ?? 'https://celebrait.co.uk'}/card/${cardId ?? 0}/view?t=TEST_TOKEN`;
      return sendRecipientCardArrivedEmail({
        recipientEmail: targetTo,
        recipientName: vars.recipientName,
        senderName: vars.senderName,
        senderEmail: body.senderEmail ?? adminContact.email,
        occasion: vars.occasion,
        shareUrl,
      });
    }
    case 'sender-order-confirmed': {
      return sendSenderOrderConfirmedEmail({
        senderEmail: targetTo,
        senderName: vars.senderName,
        recipientName: vars.recipientName,
        occasion: vars.occasion,
        includesPrint: body.includesPrint ?? true,
        includesDigital: body.includesDigital ?? true,
        totalAmount: body.totalAmount ?? 899, // £8.99 printed card (shared/pricing.ts)
        currency: body.currency ?? 'GBP',
        orderId: body.orderId ?? `test_${cardId ?? 'X'}`,
        cardId: cardId ?? 1,
        scheduledSendAt: body.scheduledSendAt
          ? new Date(body.scheduledSendAt)
          : null,
      });
    }
    case 'sender-card-opened': {
      return sendSenderCardOpenedEmail({
        senderEmail: targetTo,
        senderName: vars.senderName,
        recipientName: vars.recipientName,
      });
    }
    case 'sender-print-shipped': {
      return sendSenderPrintShippedEmail({
        senderEmail: targetTo,
        senderName: vars.senderName,
        recipientName: vars.recipientName,
        trackingNumber: body.trackingNumber ?? 'TEST-TRK-1234',
        trackingUrl:
          body.trackingUrl ?? 'https://example.com/track/TEST-TRK-1234',
        courier: body.courier ?? 'Aramex',
        etaWindow: body.etaWindow ?? 'Tue–Thu next week',
      });
    }
    case 'sender-print-delivered': {
      return sendSenderPrintDeliveredEmail({
        senderEmail: targetTo,
        senderName: vars.senderName,
        recipientName: vars.recipientName,
      });
    }
    case 'dropoff-recovery': {
      return sendDropOffRecoveryEmail({
        senderEmail: targetTo,
        senderName: vars.senderName,
        recipientName: vars.recipientName,
        occasion: vars.occasion,
        cardId: cardId ?? 0,
      });
    }
    case 'dropoff-tweak': {
      return sendDropOffTweakEmail({
        senderEmail: targetTo,
        senderName: vars.senderName,
        recipientName: vars.recipientName,
        occasion: vars.occasion,
        cardId: cardId ?? 0,
      });
    }
    case 'dropoff-last-call': {
      return sendDropOffLastCallEmail({
        senderEmail: targetTo,
        senderName: vars.senderName,
        recipientName: vars.recipientName,
        occasion: vars.occasion,
        cardId: cardId ?? 0,
      });
    }
    default: {
      // Unreachable — callers gate via isKnownTemplate first.
      throw new Error(`Unknown template: ${template}`);
    }
  }
}

// ── Routes ───────────────────────────────────────────────────────────

export function registerAdminTestEmailRoutes(app: Express): void {
  // Send for real — fires the SMTP / Brevo path.
  app.post(
    '/api/admin/test-email/:template',
    async (req: Request, res: Response) => {
      if (!(await requireAdmin(req, res))) return;

      const template = String(req.params.template ?? '');
      if (!isKnownTemplate(template)) {
        res.status(400).json({
          message: `Unknown template "${template}". Known: ${KNOWN_TEMPLATES.join(', ')}.`,
        });
        return;
      }

      const body = req.body ?? {};
      const cardId = typeof body.cardId === 'number' ? body.cardId : undefined;

      const adminContact = await loadAdminContact(req);
      if (!adminContact) {
        res.status(400).json({
          message:
            'Could not resolve admin contact. Pass `to` explicitly or sign in.',
        });
        return;
      }

      const cardCtx = await loadCardContext(cardId);
      const targetTo = String(body.to ?? adminContact.email);
      const vars = resolveTestVars(body, cardCtx, adminContact);

      try {
        const sent = await dispatchTemplate(template, {
          targetTo,
          vars,
          cardId,
          body,
          adminContact,
          cardImageUrl: cardCtx?.cardImageUrl ?? null,
        });
        res.json({ ok: sent, template, to: targetTo, vars });
      } catch (err: any) {
        console.error(
          `[ADMIN_TEST_EMAIL] failed for template "${template}":`,
          err?.message ?? err,
        );
        res.status(500).json({
          message: err?.message ?? 'Email send failed',
          template,
          to: targetTo,
        });
      }
    },
  );

  // Preview only — runs the template inside renderEmailForPreview()
  // so sendEmail() short-circuits and stashes the rendered parts in
  // an AsyncLocalStorage cell instead of firing SMTP. Returns the
  // rendered subject + html + text + intended `to` so the admin page
  // can show them in an iframe before any real send.
  app.post(
    '/api/admin/test-email/:template/preview',
    async (req: Request, res: Response) => {
      if (!(await requireAdmin(req, res))) return;

      const template = String(req.params.template ?? '');
      if (!isKnownTemplate(template)) {
        res.status(400).json({
          message: `Unknown template "${template}". Known: ${KNOWN_TEMPLATES.join(', ')}.`,
        });
        return;
      }

      const body = req.body ?? {};
      const cardId = typeof body.cardId === 'number' ? body.cardId : undefined;

      const adminContact = await loadAdminContact(req);
      if (!adminContact) {
        res.status(400).json({
          message:
            'Could not resolve admin contact. Pass `to` explicitly or sign in.',
        });
        return;
      }

      const cardCtx = await loadCardContext(cardId);
      const targetTo = String(body.to ?? adminContact.email);
      const vars = resolveTestVars(body, cardCtx, adminContact);

      try {
        const captured = await renderEmailForPreview(() =>
          dispatchTemplate(template, {
            targetTo,
            vars,
            cardId,
            body,
            adminContact,
            cardImageUrl: cardCtx?.cardImageUrl ?? null,
          }),
        );
        if (!captured) {
          res.status(500).json({
            message:
              'Template ran but never reached sendEmail — preview capture is empty.',
            template,
          });
          return;
        }
        res.json({
          ok: true,
          template,
          rendered: captured,
          vars,
        });
      } catch (err: any) {
        console.error(
          `[ADMIN_TEST_EMAIL_PREVIEW] failed for template "${template}":`,
          err?.message ?? err,
        );
        res.status(500).json({
          message: err?.message ?? 'Preview render failed',
          template,
        });
      }
    },
  );

  // Send raw — bypass the template renderer entirely. Body fields go
  // straight to sendEmail. Used by the admin email tester's "edited"
  // mode: render a template into the editable textareas, the user
  // tweaks, hits send → those edited values get sent instead of the
  // template's output.
  //
  // Doesn't persist anywhere. The next preview reverts to the
  // template's source-code output. (Persistent db-backed copy is
  // Option B from the planning convo — deliberately deferred.)
  app.post(
    '/api/admin/test-email/raw',
    async (req: Request, res: Response) => {
      if (!(await requireAdmin(req, res))) return;

      const adminContact = await loadAdminContact(req);
      if (!adminContact) {
        res.status(400).json({
          message:
            'Could not resolve admin contact. Pass `to` explicitly or sign in.',
        });
        return;
      }

      const body = req.body ?? {};
      const subject = typeof body.subject === 'string' ? body.subject : '';
      const html = typeof body.html === 'string' ? body.html : '';
      const text = typeof body.text === 'string' ? body.text : '';
      const targetTo = String(body.to ?? adminContact.email);

      if (!subject || (!html && !text)) {
        res.status(400).json({
          message: 'Need at least { to, subject } and one of { html, text }.',
        });
        return;
      }

      try {
        const sent = await sendEmail({
          to: targetTo,
          subject,
          html: html || undefined,
          text: text || undefined,
        });
        res.json({ ok: sent, to: targetTo });
      } catch (err: any) {
        console.error('[ADMIN_TEST_EMAIL_RAW] failed:', err?.message ?? err);
        res.status(500).json({
          message: err?.message ?? 'Raw email send failed',
        });
      }
    },
  );
}
