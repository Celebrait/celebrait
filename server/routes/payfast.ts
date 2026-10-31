// server/routes/payfast.ts
//
// The two PayFast routes (see server/studio/payfast-provider.ts for the
// flow and the verification rules). Both 404 unless
// STUDIO_PAYMENT_PROVIDER=payfast.
//
//   GET  /api/payfast/redirect/:orderId?t=<hmac>
//        Checkout's redirectUrl. Renders a tiny auto-submitting form that
//        POSTs the signed fields to PayFast's /eng/process. Signed NOW,
//        from the order row, so the amount is the database's.
//
//   POST /api/webhooks/payfast      (PayFast's ITN, form-urlencoded)
//        Verified in provider.parseWebhook, then the SAME idempotent
//        markOrderPaidAndDispatch the Stripe webhook uses. Answers 200
//        once handled; 400 on a failed verification; 503 when PayFast's
//        validate endpoint couldn't be reached, so PayFast resends.

import express, { type Express, type Request, type Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { studioOrders } from '@shared/schema';
import { getPaymentProvider } from '../studio/payment-provider';
import {
  buildPayfastForm,
  payfastRedirectTokenOk,
  takePendingCheckout,
  PayfastItnError,
} from '../studio/payfast-provider';
import { markOrderPaidAndDispatch } from './studio-checkout';
import { sendAdminAlertEmail } from '../email-service';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function registerPayfastRoutes(app: Express): void {
  app.get('/api/payfast/redirect/:orderId', async (req: Request, res: Response) => {
    if (getPaymentProvider().name !== 'payfast') return res.status(404).send('Not found');
    const orderId = req.params.orderId;
    if (!payfastRedirectTokenOk(orderId, req.query.t)) return res.status(404).send('Not found');
    try {
      const [order] = await db.select().from(studioOrders).where(eq(studioOrders.id, orderId)).limit(1);
      if (!order || order.paymentProvider !== 'payfast') return res.status(404).send('Not found');

      const origin = `${req.protocol}://${req.get('host')}`;
      // Already settled, or superseded by a newer checkout in another tab:
      // never hand out a payable form for it (PayFast has no way to void
      // one later). Paid → the success page; anything else → back to buy.
      if (order.paymentStatus !== 'pending') {
        return res.redirect(
          303,
          order.paymentStatus === 'paid'
            ? order.userId
              ? `${origin}/checkout/success?orderId=${order.id}`
              : `${origin}/order/${order.id}?from=payment`
            : `${origin}/buy/${order.cardId}?cancelled=1`,
        );
      }

      // createPayment's line text + exact URLs when this process still has
      // them; otherwise the same URLs studio-checkout builds (keep in step
      // with the createPayment call there) and a generic line.
      const pending = takePendingCheckout(order.id);
      const form = buildPayfastForm({
        orderId: order.id,
        amountMinor: order.totalAmount,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        itemName: pending?.itemName ?? 'Celebrait card, printed & posted',
        itemDescription: pending?.itemDescription,
        returnUrl:
          pending?.returnUrl ??
          (order.userId
            ? `${origin}/checkout/success?orderId=${order.id}`
            : `${origin}/order/${order.id}?from=payment`),
        cancelUrl:
          pending?.cancelUrl ??
          (order.userId
            ? `${origin}/checkout/cancelled?orderId=${order.id}&cardId=${order.cardId}`
            : `${origin}/buy/${order.cardId}?cancelled=1`),
      });

      const inputs = form.fields
        .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
        .join('\n');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Taking you to PayFast</title>
<style>body{font-family:system-ui,sans-serif;background:#FAF8F4;color:#211D19;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;text-align:center}button{font:inherit;padding:12px 20px;border-radius:999px;border:0;background:#211D19;color:#FAF8F4;cursor:pointer}</style>
</head><body>
<form id="pf" action="${esc(form.action)}" method="post">
${inputs}
<p>Taking you to PayFast to pay securely…</p>
<noscript><button type="submit">Continue to PayFast</button></noscript>
</form>
<script>document.getElementById('pf').submit();</script>
</body></html>`);
    } catch (err: any) {
      console.error('[PAYFAST-REDIRECT] error:', err?.message ?? err);
      res.status(500).send('Could not start payment. Please go back and try again.');
    }
  });

  app.post(
    '/api/webhooks/payfast',
    // The global parser in server/index.ts already handles
    // x-www-form-urlencoded; this is belt and braces (a no-op when the
    // body was already parsed). Key order is preserved, which the ITN
    // signature depends on.
    express.urlencoded({ extended: false, limit: '64kb' }),
    async (req: Request, res: Response) => {
      const provider = getPaymentProvider();
      if (provider.name !== 'payfast') return res.status(404).send('Not found');

      let status;
      try {
        status = await provider.parseWebhook(
          // The socket peer is only a last-resort source IP (see
          // itnSourceIp); set here so a caller can't supply it.
          { ...(req.headers as Record<string, string>), 'x-celebrait-peer-ip': req.socket.remoteAddress ?? '' },
          (req as any).rawBody ?? req.body,
        );
      } catch (err: any) {
        const e = err instanceof PayfastItnError ? err : null;
        console.error('[PAYFAST-ITN] verification failed:', err?.message ?? err);
        if (e?.alert) {
          void sendAdminAlertEmail('PayFast ITN rejected', [
            String(err?.message ?? err),
            'If a customer really paid, settle the order by hand after checking the PayFast dashboard.',
          ]);
        }
        return res.status(e?.retryable ? 503 : 400).send(e?.retryable ? 'Retry' : 'Rejected');
      }

      try {
        const orderId = status.studioOrderId!;
        const [order] = await db
          .select({ id: studioOrders.id, paymentStatus: studioOrders.paymentStatus })
          .from(studioOrders)
          .where(eq(studioOrders.id, orderId))
          .limit(1);
        if (status.status === 'paid' && order) {
          // Keep PayFast's own id for reconciliation against their dashboard.
          await db
            .update(studioOrders)
            .set({ paymentReference: status.paymentReference, updatedAt: new Date() })
            .where(eq(studioOrders.id, orderId));
          if (order.paymentStatus !== 'pending' && order.paymentStatus !== 'paid') {
            // Paid from a stale tab after a newer checkout superseded it
            // (PayFast forms can't be voided). Money is in: settle it, and
            // tell a human there may be a duplicate to refund.
            void sendAdminAlertEmail(`PayFast paid a ${order.paymentStatus} order ${orderId}`, [
              `pf_payment_id ${status.paymentReference}. Settling it as paid.`,
              'Check for a duplicate order on the same card and refund one in the PayFast dashboard.',
            ]);
          }
          await markOrderPaidAndDispatch(orderId, status.amountPaid);
        } else if (status.status === 'failed' && order) {
          await db
            .update(studioOrders)
            .set({ paymentStatus: 'failed', updatedAt: new Date() })
            .where(and(eq(studioOrders.id, orderId), eq(studioOrders.paymentStatus, 'pending')));
        }
        res.status(200).send('OK');
      } catch (err: any) {
        console.error('[PAYFAST-ITN] handler error:', err);
        res.status(500).send('Error');
      }
    },
  );
}
