// server/scripts/test-fulfillment.ts
//
// Exercises applyFulfillmentUpdate end-to-end against the dev DB: status
// transitions advance forward only, each lifecycle email fires exactly
// once, duplicates + late/out-of-order webhooks don't re-fire or downgrade.
// Inserts a throwaway paid print order, drives it, then deletes it.
//
// Email sends will log "sent/failed/skipped" depending on the dev Brevo
// key — the [FULFILMENT] lines prove the TRIGGER fired regardless.
//
//   npx tsx server/scripts/test-fulfillment.ts

import 'dotenv/config';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { cards, studioOrders } from '@shared/schema';
import { applyFulfillmentUpdate } from '../routes/studio-checkout';

async function statusOf(orderId: string): Promise<string | null> {
  const r = await db
    .select({ f: studioOrders.fulfillmentStatus })
    .from(studioOrders)
    .where(eq(studioOrders.id, orderId))
    .limit(1);
  return r[0]?.f ?? null;
}

let pass = 0;
let fail = 0;
function check(label: string, got: string | null, want: string) {
  const ok = got === want;
  console.log(`  ${ok ? '✓' : '✗'} ${label}: ${got}${ok ? '' : ` (expected ${want})`}`);
  ok ? pass++ : fail++;
}

async function main() {
  // Anchor on a real completed card so cardId/userId are valid.
  const cardRows = await db
    .select({ id: cards.id, userId: cards.userId })
    .from(cards)
    .where(eq(cards.status, 'completed'))
    .orderBy(desc(cards.id))
    .limit(1);
  const card = cardRows[0];
  if (!card) throw new Error('No completed card to anchor the test order to.');

  const inserted = await db
    .insert(studioOrders)
    .values({
      cardId: card.id,
      userId: card.userId,
      customerEmail: 'fulfilment-test@example.com',
      customerName: 'Test Sender',
      includesPrint: true,
      includesDigital: true,
      shipTo: 'recipient',
      shippingTier: 'express',
      currency: 'GBP',
      printAmount: 899,
      shippingAmount: 895,
      totalAmount: 1794,
      paymentStatus: 'paid',
      fulfillmentStatus: 'submitted',
      printProvider: 'prodigi',
      providerOrderId: 'test_wh_fulfilment',
    })
    .returning();
  const order = inserted[0];
  console.log(`[TEST] order ${order.id} (card ${card.id}) → submitted\n`);

  const reload = async () =>
    (await db.select().from(studioOrders).where(eq(studioOrders.id, order.id)).limit(1))[0];

  try {
    console.log('── printed ──');
    await applyFulfillmentUpdate(await reload(), { status: 'printed' });
    check('advances to printed', await statusOf(order.id), 'printed');

    console.log('── shipped (fires shipped email) ──');
    await applyFulfillmentUpdate(await reload(), {
      status: 'shipped',
      trackingNumber: 'TESTTRACK123GB',
      trackingUrl: 'https://track.example/TESTTRACK123GB',
    });
    check('advances to shipped', await statusOf(order.id), 'shipped');

    console.log('── shipped AGAIN (duplicate — must NOT re-fire) ──');
    await applyFulfillmentUpdate(await reload(), { status: 'shipped' });
    check('stays shipped', await statusOf(order.id), 'shipped');

    console.log('── delivered (fires delivered email) ──');
    await applyFulfillmentUpdate(await reload(), { status: 'delivered' });
    check('advances to delivered', await statusOf(order.id), 'delivered');

    console.log('── shipped LATE (out-of-order — must NOT downgrade) ──');
    await applyFulfillmentUpdate(await reload(), { status: 'shipped' });
    check('stays delivered', await statusOf(order.id), 'delivered');
  } finally {
    await db.delete(studioOrders).where(eq(studioOrders.id, order.id));
    console.log(`\n[TEST] cleaned up order ${order.id}`);
  }

  console.log(`\n${fail === 0 ? '✓' : '✗'} ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('✗ Test failed:', err?.message ?? err);
  process.exit(1);
});
