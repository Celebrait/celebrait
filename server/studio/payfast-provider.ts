// PayFast payment provider (South Africa). Implements PaymentProvider
// with PayFast's documented REDIRECT integration ("custom integration"):
//
//   1. createPayment() does NOT call PayFast. PayFast is a signed HTML
//      form POST to https://<host>/eng/process, not an API that hands back
//      a URL. So we return a redirect to OUR OWN route,
//      /api/payfast/redirect/:orderId?t=<hmac>, which renders a tiny
//      auto-submitting form (server/routes/payfast.ts). The fields are
//      built and signed at that moment from the order row, so the amount
//      is always the one in the database.
//   2. The buyer pays on PayFast's page; PayFast sends the browser back to
//      return_url (our usual success page) and, separately, POSTs an ITN
//      (Instant Transaction Notification) to notify_url,
//      ${publicOrigin()}/api/webhooks/payfast.
//   3. parseWebhook() verifies the ITN four ways, as PayFast specifies:
//      signature, source IP, amount against our order, and a
//      server-to-server POST to /eng/query/validate that must answer
//      VALID. Only then is the order flipped paid, through the same
//      idempotent markOrderPaidAndDispatch the Stripe webhook uses.
//
// THE ITN IS THE SOURCE OF TRUTH. PayFast has no session-status endpoint
// for once-off payments, so getStatus() just reports what our own row
// says, and the stale sweeper's payment reconcile skips PayFast (it only
// re-asks Stripe). If an ITN never lands, the order stays pending and
// shows in admin; check it against the PayFast dashboard by m_payment_id
// (= our order id).
//
// REFUNDS are done by hand in the PayFast dashboard. PayFast sends no
// refund ITN for once-off payments that we handle, so a refunded PayFast
// order must be marked refunded in admin by hand. Nothing here for now.
//
// Env (names fixed; the launch-readiness panel checks them):
//   PAYFAST_MERCHANT_ID   required
//   PAYFAST_MERCHANT_KEY  required
//   PAYFAST_PASSPHRASE    optional but strongly recommended. Must match the
//                         "Salt Passphrase" set in the PayFast dashboard,
//                         or every signature fails.
//   PAYFAST_SANDBOX       '1' (or 'true') → sandbox.payfast.co.za,
//                         anything else → www.payfast.co.za (live).
//
// Signature rules (verified against the official payfast-php-sdk,
// lib/Auth.php + lib/PaymentIntegrations/Notification.php, and its ITN
// test vector, see the unit test notes in the hand-off):
//   • checkout form: fields in the documented order, BLANK VALUES SKIPPED,
//     each value trimmed then PHP-urlencode'd (uppercase hex, space → '+',
//     only A-Z a-z 0-9 - _ . left bare), joined with '&', then
//     '&passphrase=<urlencoded>' when one is set; md5, lowercase hex.
//   • ITN: the POSTed fields IN THE ORDER RECEIVED, up to (not including)
//     'signature', BLANK VALUES INCLUDED, not trimmed; same encoding and
//     passphrase rule.

import crypto from "crypto";
import dns from "dns/promises";
import { eq, or } from "drizzle-orm";
import { db } from "../db";
import { studioOrders } from "@shared/schema";
import { publicOrigin } from "@shared/market";
import type {
  PaymentProvider,
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentStatus,
} from "./payment-provider";

// ── Config ────────────────────────────────────────────────────────────

export function payfastIsSandbox(): boolean {
  const v = (process.env.PAYFAST_SANDBOX ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

export function payfastHost(): string {
  return payfastIsSandbox() ? "sandbox.payfast.co.za" : "www.payfast.co.za";
}

export function payfastProcessUrl(): string {
  return `https://${payfastHost()}/eng/process`;
}

interface PayfastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
}

function config(): PayfastConfig {
  const merchantId = (process.env.PAYFAST_MERCHANT_ID ?? "").trim();
  const merchantKey = (process.env.PAYFAST_MERCHANT_KEY ?? "").trim();
  if (!merchantId || !merchantKey) {
    throw new Error(
      "PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY are not set, so the payfast " +
        "payment provider cannot be used. Set them, or switch STUDIO_PAYMENT_PROVIDER.",
    );
  }
  return {
    merchantId,
    merchantKey,
    passphrase: (process.env.PAYFAST_PASSPHRASE ?? "").trim(),
    sandbox: payfastIsSandbox(),
  };
}

// ── Signature ─────────────────────────────────────────────────────────

/** PHP urlencode(), which is what PayFast signs with: encodeURIComponent
 *  leaves ! ' ( ) * ~ bare where PHP encodes them, and PHP writes a
 *  space as '+'. Checked 2026-10-15 against the live sandbox engine: an
 *  item_name with ' ! ( ) * ~ is ACCEPTED signed this way and REJECTED
 *  signed with plain encodeURIComponent. */
export function pfEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
}

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

/** Checkout-form signature. `fields` must already be in PayFast's
 *  documented order; blank values are skipped, values trimmed. */
export function payfastCheckoutSignature(
  fields: Array<[string, string]>,
  passphrase: string,
): string {
  const parts = fields
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}=${pfEncode(String(v).trim())}`);
  if (passphrase) parts.push(`passphrase=${pfEncode(passphrase.trim())}`);
  return md5(parts.join("&"));
}

/** The ITN param string: fields in received order up to 'signature',
 *  blanks included, untrimmed. Also the body for /eng/query/validate. */
export function payfastItnParamString(
  entries: Array<[string, string]>,
  encode: (v: string) => string = pfEncode,
): string {
  const parts: string[] = [];
  for (const [k, v] of entries) {
    if (k === "signature") break;
    parts.push(`${k}=${encode(v ?? "")}`);
  }
  return parts.join("&");
}

export function payfastItnSignature(
  entries: Array<[string, string]>,
  passphrase: string,
  encode: (v: string) => string = pfEncode,
): string {
  const base = payfastItnParamString(entries, encode);
  return md5(passphrase ? `${base}&passphrase=${encode(passphrase.trim())}` : base);
}

// ── Checkout form fields ──────────────────────────────────────────────

/** Free text for PayFast's page: one line, within PayFast's field limit. */
function pfText(s: string, max: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Minor units → "149.00". PayFast wants rands with two decimals. */
export function randAmount(minor: number): string {
  return (Math.round(minor) / 100).toFixed(2);
}

export interface PayfastFormInput {
  orderId: string;
  amountMinor: number;
  customerName?: string | null;
  customerEmail?: string | null;
  itemName: string;
  itemDescription?: string;
  returnUrl: string;
  cancelUrl: string;
}

/** The signed field list, in documented order, ready to render as hidden
 *  inputs. Blank optional fields are dropped from the form as well as
 *  the signature so the two always agree. */
export function buildPayfastForm(input: PayfastFormInput): {
  action: string;
  fields: Array<[string, string]>;
} {
  const cfg = config();
  const name = pfText(input.customerName ?? "", 200);
  const [first, ...rest] = name.split(" ");
  const ordered: Array<[string, string]> = [
    ["merchant_id", cfg.merchantId],
    ["merchant_key", cfg.merchantKey],
    ["return_url", input.returnUrl],
    ["cancel_url", input.cancelUrl],
    ["notify_url", `${publicOrigin()}/api/webhooks/payfast`],
    ["name_first", (first ?? "").slice(0, 100)],
    ["name_last", rest.join(" ").slice(0, 100)],
    ["email_address", (input.customerEmail ?? "").trim().slice(0, 100)],
    ["m_payment_id", input.orderId],
    ["amount", randAmount(input.amountMinor)],
    ["item_name", pfText(input.itemName, 100) || "Celebrait card"],
    ["item_description", pfText(input.itemDescription ?? "", 255)],
  ];
  const fields = ordered.filter(([, v]) => v.trim() !== "");
  const signature = payfastCheckoutSignature(fields, cfg.passphrase);
  return { action: payfastProcessUrl(), fields: [...fields, ["signature", signature]] };
}

// ── Redirect hand-off (createPayment → our redirect route) ────────────

/** HMAC on the order id so only the browser that created the order can
 *  load its PayFast form (the form carries the buyer's name and email).
 *  Keyed on SESSION_SECRET (fatal-if-missing on prod via launch-guards). */
function redirectSecret(): string {
  return process.env.SESSION_SECRET || "celebrait-dev-payfast-redirect";
}
export function payfastRedirectToken(orderId: string): string {
  return crypto.createHmac("sha256", redirectSecret()).update(`payfast:${orderId}`).digest("base64url").slice(0, 32);
}
export function payfastRedirectTokenOk(orderId: string, token: unknown): boolean {
  if (typeof token !== "string") return false;
  const want = Buffer.from(payfastRedirectToken(orderId));
  const got = Buffer.from(token);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/** What createPayment knew that the order row doesn't (the gateway line
 *  text and the exact return/cancel URLs). In-process, 6 h; on a miss
 *  (restart between create and redirect) the route rebuilds from the
 *  order row with a generic line. Amount is NEVER taken from here. */
interface PendingCheckout {
  itemName: string;
  itemDescription?: string;
  returnUrl: string;
  cancelUrl: string;
  expires: number;
}
const pendingCheckouts = new Map<string, PendingCheckout>();
const PENDING_TTL_MS = 6 * 60 * 60 * 1000;
export function takePendingCheckout(orderId: string): PendingCheckout | undefined {
  const now = Date.now();
  pendingCheckouts.forEach((v, k) => {
    if (v.expires < now) pendingCheckouts.delete(k);
  });
  return pendingCheckouts.get(orderId);
}

// ── ITN verification ──────────────────────────────────────────────────

/** Thrown by parseWebhook. `retryable` → the route answers 5xx so PayFast
 *  resends; `alert` → worth an admin email (it got past the signature,
 *  so it's PayFast talking about a real order, not a bot). */
export class PayfastItnError extends Error {
  constructor(message: string, readonly retryable = false, readonly alert = false) {
    super(message);
  }
}

// PayFast's ITN source hosts (docs "Check that the notification has come
// from a valid Payfast domain"), resolved at check time, plus the server IP
// ranges the docs publish under "Ports and IP addresses" (both read from
// developers.payfast.co.za/docs on 2026-10-15). Either match passes.
const PAYFAST_HOSTS = ["www.payfast.co.za", "sandbox.payfast.co.za", "w1w.payfast.co.za", "w2w.payfast.co.za"];
const PAYFAST_CIDRS = ["197.97.145.144/28", "41.74.179.192/27", "102.216.36.0/28", "102.216.36.128/28", "144.126.193.139/32"];

function ipv4ToInt(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const n = m.slice(1).map(Number);
  if (n.some((x) => x > 255)) return null;
  return ((n[0] << 24) >>> 0) + (n[1] << 16) + (n[2] << 8) + n[3];
}
function inCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const a = ipv4ToInt(ip);
  const b = ipv4ToInt(base);
  if (a == null || b == null) return false;
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}

let hostIpCache: { ips: Set<string>; at: number } | null = null;
async function payfastHostIps(): Promise<Set<string>> {
  if (hostIpCache && Date.now() - hostIpCache.at < 10 * 60 * 1000) return hostIpCache.ips;
  const ips = new Set<string>();
  await Promise.all(
    PAYFAST_HOSTS.map(async (h) => {
      try {
        for (const ip of await dns.resolve4(h)) ips.add(ip);
      } catch {
        /* one host failing to resolve is fine */
      }
    }),
  );
  hostIpCache = { ips, at: Date.now() };
  return ips;
}

/** The caller's real IP. We sit behind Cloudflare → Render, so the TCP
 *  peer is a proxy. CF-Connecting-IP is set by Cloudflare and cannot be
 *  forged through it, so it wins; else the FIRST X-Forwarded-For entry
 *  (proxies append, so the first entry is the client as it presented
 *  itself; forgeable when the origin is hit directly, which is why the IP
 *  check is defence in depth and the signature + server validate are the
 *  real gates); else
 *  the socket peer the route passes in. */
export function itnSourceIp(headers: Record<string, string | string[] | undefined>): string {
  const h = (k: string) => {
    const v = headers[k];
    return (Array.isArray(v) ? v[0] : v ?? "").trim();
  };
  const ip =
    h("cf-connecting-ip") ||
    h("x-forwarded-for").split(",")[0]?.trim() ||
    h("x-celebrait-peer-ip");
  return ip.replace(/^::ffff:/, "");
}

export async function payfastIpOk(ip: string): Promise<boolean> {
  if (!ip) return false;
  if (PAYFAST_CIDRS.some((c) => inCidr(ip, c))) return true;
  return (await payfastHostIps()).has(ip);
}

function bodyEntries(body: unknown): Array<[string, string]> {
  if (typeof body === "string" || Buffer.isBuffer(body)) {
    return Array.from(new URLSearchParams(body.toString()).entries());
  }
  if (body && typeof body === "object") {
    return Object.entries(body as Record<string, unknown>).map(([k, v]) => [
      k,
      Array.isArray(v) ? String(v[0] ?? "") : v == null ? "" : String(v),
    ]);
  }
  return [];
}

async function serverValidate(paramString: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(`https://${payfastHost()}/eng/query/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: paramString,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err: any) {
    throw new PayfastItnError(`validate call failed: ${err?.message ?? err}`, true, false);
  }
  const text = (await res.text()).trim();
  if (!res.ok) throw new PayfastItnError(`validate HTTP ${res.status}`, true, false);
  return text === "VALID";
}

// ── Provider ──────────────────────────────────────────────────────────

function mapOrderStatus(s: string | null | undefined): PaymentStatus["status"] {
  return s === "paid" || s === "failed" || s === "refunded" ? s : "pending";
}

export const payfastPaymentProvider: PaymentProvider = {
  name: "payfast",

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    config(); // fail at checkout, not on PayFast's page, if unconfigured
    if (req.currency !== "ZAR") {
      throw new Error(`PayFast only takes ZAR; order ${req.studioOrderId} is in ${req.currency}. Set MARKET=ZA.`);
    }
    if (!Number.isInteger(req.amount) || req.amount <= 0) {
      throw new Error(`PayFast: bad amount ${req.amount} for order ${req.studioOrderId}`);
    }
    pendingCheckouts.set(req.studioOrderId, {
      itemName: req.description ?? "Celebrait card",
      itemDescription: req.productDescription,
      returnUrl: req.returnUrl,
      cancelUrl: req.cancelUrl,
      expires: Date.now() + PENDING_TTL_MS,
    });
    // ABSOLUTE url on the same origin as returnUrl: the checkout client
    // only does a real navigation for http(s) URLs (a relative path would
    // be swallowed by the SPA router and never reach this server route).
    const origin = new URL(req.returnUrl).origin;
    return {
      // Our order id until the ITN tells us PayFast's pf_payment_id
      // (the webhook route then stores that here).
      paymentReference: req.studioOrderId,
      mode: "redirect",
      redirectUrl: `${origin}/api/payfast/redirect/${encodeURIComponent(req.studioOrderId)}?t=${payfastRedirectToken(req.studioOrderId)}`,
    };
  },

  /** No PayFast status API for once-off payments: report our own row.
   *  `paymentReference` may be our order id or PayFast's pf_payment_id. */
  async getStatus(paymentReference: string): Promise<PaymentStatus> {
    const [order] = await db
      .select({ id: studioOrders.id, paymentStatus: studioOrders.paymentStatus, amountPaid: studioOrders.amountPaid })
      .from(studioOrders)
      .where(or(eq(studioOrders.id, paymentReference), eq(studioOrders.paymentReference, paymentReference)))
      .limit(1);
    return {
      paymentReference,
      status: mapOrderStatus(order?.paymentStatus),
      amountPaid: order?.amountPaid ?? undefined,
      studioOrderId: order?.id,
    };
  },

  // No cancelPayment: a PayFast form can't be voided once the buyer is on
  // PayFast's page. The redirect route refuses to render a form for an
  // order that is no longer pending, which closes most of the window.

  async parseWebhook(headers: Record<string, string>, body: unknown): Promise<PaymentStatus> {
    const cfg = config();
    const entries = bodyEntries(body);
    const data = Object.fromEntries(entries) as Record<string, string>;
    const orderId = (data.m_payment_id ?? "").trim();

    // 1. Signature.
    const given = (data.signature ?? "").trim().toLowerCase();
    const sigOk = !!given && given === payfastItnSignature(entries, cfg.passphrase);
    if (!sigOk) throw new PayfastItnError(`bad signature (order ${orderId || "?"})`);
    if (data.merchant_id !== cfg.merchantId) {
      throw new PayfastItnError(`merchant_id mismatch (order ${orderId})`, false, true);
    }

    // 2. Source IP. Enforced on live; on sandbox only logged, because the
    //    sandbox's egress isn't in the published ranges and a dry run
    //    behind a tunnel/proxy shows the tunnel's IP.
    const ip = itnSourceIp(headers);
    if (!(await payfastIpOk(ip))) {
      if (cfg.sandbox) {
        console.warn(`[PAYFAST-ITN] source IP ${ip || "(none)"} not a PayFast address; allowed because PAYFAST_SANDBOX is set`);
      } else {
        throw new PayfastItnError(`ITN from non-PayFast IP ${ip || "(none)"} (order ${orderId})`, false, true);
      }
    }

    // 3. Amount against OUR order (the form's merchant_key is public, so a
    //    no-passphrase account could otherwise be paid R1 for a R149 card).
    const [order] = await db
      .select({ id: studioOrders.id, totalAmount: studioOrders.totalAmount, currency: studioOrders.currency })
      .from(studioOrders)
      .where(eq(studioOrders.id, orderId))
      .limit(1);
    if (!order) throw new PayfastItnError(`no order for m_payment_id ${orderId}`, false, true);
    const grossMinor = Math.round(parseFloat(data.amount_gross ?? "") * 100);
    if (!Number.isFinite(grossMinor) || grossMinor !== order.totalAmount) {
      throw new PayfastItnError(
        `amount_gross ${data.amount_gross} does not match order ${orderId} total ${randAmount(order.totalAmount)}`,
        false,
        true,
      );
    }

    // 4. Ask PayFast itself. Body = the param string without signature.
    if (!(await serverValidate(payfastItnParamString(entries)))) {
      throw new PayfastItnError(`PayFast validate did not answer VALID (order ${orderId})`, false, true);
    }

    const pfId = (data.pf_payment_id ?? "").trim();
    const status = (data.payment_status ?? "").trim().toUpperCase();
    console.log(`[PAYFAST-ITN] verified order ${orderId} pf_payment_id=${pfId || "?"} status=${status} gross=${data.amount_gross}`);
    const base = { paymentReference: pfId || orderId, studioOrderId: orderId };
    if (status === "COMPLETE") return { ...base, status: "paid", amountPaid: grossMinor };
    if (status === "CANCELLED") return { ...base, status: "failed" };
    return { ...base, status: "pending" };
  },
};
