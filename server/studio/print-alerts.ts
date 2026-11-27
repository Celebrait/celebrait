// server/studio/print-alerts.ts
//
// PRINT ALERTS THAT ARRIVE ONCE, NOT EVERY TEN MINUTES (launch audit
// 2026-11-26).
//
// Two opposite failures lived here. A paid order whose print could not
// be submitted mailed the operator on EVERY sweeper retry, six an hour
// for as long as it stayed broken, which is how a real alert gets
// filtered to a folder and missed. And an order the printer had quietly
// stopped on (artwork it could not download, an item it cannot make)
// mailed nobody at all.
//
// Both are fixed by the same small ledger: "have I already told a human
// about THIS problem on THIS order in the last day?" It has to survive a
// restart, because this app restarts on every deploy and an in-memory
// map would re-send everything each time. It lives in site_settings
// (one JSON row) rather than a new column on studio_orders so production
// needs no schema change: a missing column would break every order query
// until someone ran SQL, and a missed alert is far cheaper than that.

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { siteSettings } from '@shared/schema';
import { sendAdminAlertEmail } from '../email-service';
import { publicOrigin } from '@shared/market';

const KEY = 'print-alerts';
const REPEAT_AFTER_MS = 24 * 60 * 60 * 1000;
const FORGET_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/** What the alert is about. One order can have one live entry per kind. */
export type PrintAlertKind =
  | 'submit-failed'   // we could not hand the order to the printer
  | 'issues'          // the printer has it but reports a problem
  | 'stalled'         // accepted days ago and still not posted
  | 'check-failed';   // we cannot reach the printer to ask

type Ledger = Record<string, { sig: string; at: number }>;

async function readLedger(): Promise<Ledger> {
  const rows = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, KEY))
    .limit(1);
  const v = rows[0]?.value;
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Ledger) : {};
}

/**
 * True when this alert should be sent: it is new, its content changed
 * (a different error is news), or a day has passed and it is still
 * broken. Records the send. If the ledger itself cannot be read or
 * written the answer is TRUE: a repeated alert is an annoyance, a
 * swallowed one is a customer who paid and got nothing.
 */
export async function shouldSendPrintAlert(
  kind: PrintAlertKind,
  orderId: string,
  signature: string,
): Promise<boolean> {
  const id = `${kind}:${orderId}`;
  const sig = signature.slice(0, 300);
  const now = Date.now();
  try {
    const ledger = await readLedger();
    const seen = ledger[id];
    if (seen && seen.sig === sig && now - seen.at < REPEAT_AFTER_MS) return false;
    ledger[id] = { sig, at: now };
    for (const [k, e] of Object.entries(ledger)) {
      if (now - (e?.at ?? 0) > FORGET_AFTER_MS) delete ledger[k];
    }
    await db
      .insert(siteSettings)
      .values({ key: KEY, value: ledger })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: ledger, updatedAt: new Date() } });
    return true;
  } catch (err: any) {
    console.error('[PRINT-ALERT] ledger unavailable, sending anyway:', err?.message ?? err);
    return true;
  }
}

/** The order's row on the admin print queue, where it can be reprinted. */
export function adminOrderLink(orderId: string): string {
  return `${publicOrigin()}/admin/fulfilment#order-${orderId}`;
}

/** Send an operator alert about a print, at most once a day per problem. */
export async function sendPrintAlert(
  kind: PrintAlertKind,
  orderId: string,
  signature: string,
  subject: string,
  lines: string[],
): Promise<void> {
  if (!(await shouldSendPrintAlert(kind, orderId, signature))) return;
  await sendAdminAlertEmail(subject, [
    ...lines,
    '',
    `Order on the print queue: ${adminOrderLink(orderId)}`,
    'While it stays like this you will get this message once a day, not on every retry.',
  ]);
}
