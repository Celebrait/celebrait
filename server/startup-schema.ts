// server/startup-schema.ts — additive columns applied at boot
//
// The same discipline as ensurePerfTable (server/rum.ts): a small,
// idempotent "add if missing" so a launch-week column never waits on a
// manual prod SQL run. ADD COLUMN IF NOT EXISTS is a no-op once applied
// and never touches existing data. Destructive changes still go through
// drizzle-kit by hand.

import { sql } from 'drizzle-orm';
import { db } from './db';

export async function ensureLaunchColumns(): Promise<void> {
  try {
    // 2026-09-09: the "when do you need it by?" capture at checkout.
    await db.execute(sql`alter table studio_orders add column if not exists need_by_date text`);
  } catch (err) {
    console.warn('[SCHEMA] launch column check failed:', (err as Error)?.message ?? err);
  }
}
