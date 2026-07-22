// Stripe payment provider — implements the PaymentProvider interface
// using Stripe Checkout Sessions (hosted payment page, redirect model).
//
// Why hosted Checkout rather than embedded Elements:
//   • Stripe hosts the card form, so we never touch raw PAN data — keeps
//     us out of the heavy PCI-DSS scope (SAQ A, the lightest tier).
//   • 3D Secure, Apple Pay, Google Pay, Link all come for free.
//   • The redirect model maps cleanly onto the existing PaymentProvider
//     contract (mode: 'redirect', redirectUrl: session.url).
//
// Source of truth for "paid" is the WEBHOOK (checkout.session.completed),
// not the success redirect — a user can close the tab before the
// redirect fires, but the webhook still lands. The success page also
// reconciles via getStatus() as a belt-and-braces fallback (and so local
// dev works without the Stripe CLI forwarding webhooks).

import Stripe from "stripe";
import type {
  PaymentProvider,
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentStatus,
} from "./payment-provider";

let _client: Stripe | null = null;

/** Lazy singleton — only constructed when the stripe provider is
 *  actually selected, so a stub-mode dev process never needs the key. */
function client(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — cannot use the stripe payment provider. " +
        "Set it in .env or switch STUDIO_PAYMENT_PROVIDER=stub.",
    );
  }
  // No explicit apiVersion — pin to the account's default. Stripe's SDK
  // is backwards-compatible within a major; we upgrade deliberately.
  _client = new Stripe(key);
  return _client;
}

/** Map Stripe's session payment_status into our normalised enum. */
function mapSessionStatus(
  s: Stripe.Checkout.Session.PaymentStatus | null | undefined,
): PaymentStatus["status"] {
  switch (s) {
    case "paid":
    case "no_payment_required":
      return "paid";
    case "unpaid":
    default:
      return "pending";
  }
}

export const stripePaymentProvider: PaymentProvider = {
  name: "stripe",

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const session = await client().checkout.sessions.create({
      mode: "payment",
      // Single dynamic line item — we don't pre-create Stripe Prices
      // because the total is computed per-order (tier + shipping +
      // bundle discount). price_data lets us pass the exact pence.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: req.currency.toLowerCase(),
            unit_amount: req.amount,
            product_data: {
              name: req.description ?? "Celebrait card",
            },
          },
        },
      ],
      customer_email: req.customerEmail,
      // Show the "Add promotion code" field on Stripe's hosted checkout so
      // discount codes work (friends & family testing: a fixed £7.99-off
      // coupon drops the £8.99 card to £1.00 while shipping + any sticker
      // stay fully paid, since it's a flat subtraction off the total).
      // Codes/limits/expiry are all managed in the Stripe dashboard — no
      // redeploy to add, change, or disable one.
      allow_promotion_codes: true,
      success_url: req.returnUrl,
      cancel_url: req.cancelUrl,
      // studioOrderId travels on the session AND the resulting
      // PaymentIntent so the webhook can find the order regardless of
      // which event we key off.
      metadata: { studioOrderId: req.studioOrderId },
      payment_intent_data: {
        metadata: { studioOrderId: req.studioOrderId },
      },
    });

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout Session URL");
    }

    return {
      paymentReference: session.id,
      mode: "redirect",
      redirectUrl: session.url,
    };
  },

  async getStatus(paymentReference: string): Promise<PaymentStatus> {
    const session = await client().checkout.sessions.retrieve(paymentReference);
    return {
      paymentReference,
      status: mapSessionStatus(session.payment_status),
    };
  },

  async parseWebhook(
    headers: Record<string, string>,
    body: unknown,
  ): Promise<PaymentStatus> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error(
        "STRIPE_WEBHOOK_SECRET is not set — cannot verify Stripe webhook signature.",
      );
    }
    const sig = headers["stripe-signature"];
    if (!sig) {
      throw new Error("Missing stripe-signature header on webhook request");
    }
    // body must be the RAW request buffer/string — signature verification
    // fails against re-serialised JSON. The route hands us req.rawBody.
    const raw =
      typeof body === "string" || Buffer.isBuffer(body)
        ? body
        : JSON.stringify(body);

    const event = client().webhooks.constructEvent(raw as any, sig, secret);

    // We only care about the terminal payment events. Everything else
    // returns a pending status the caller can ignore.
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          paymentReference: session.id,
          status: mapSessionStatus(session.payment_status),
        };
      }
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        return { paymentReference: session.id, status: "failed" };
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        // Orders store the Checkout Session id as paymentReference, but a
        // refund only carries the PaymentIntent. Resolve the session from the
        // PI so the caller can match the order the same way the paid path
        // does. Falls back to the PI/charge id if the lookup fails.
        const pi =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        let ref = String(charge.id);
        if (pi) {
          ref = pi;
          try {
            const sessions = await client().checkout.sessions.list({
              payment_intent: pi,
              limit: 1,
            });
            if (sessions.data[0]?.id) ref = sessions.data[0].id;
          } catch {
            /* session lookup best-effort — fall back to the PI */
          }
        }
        return { paymentReference: ref, status: "refunded" };
      }
      default:
        // Unhandled event — report pending against the event id so the
        // caller no-ops without throwing.
        return { paymentReference: event.id, status: "pending" };
    }
  },
};
