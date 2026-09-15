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
    // 2026-09-15: saved /demo runs (shared/models/demo.ts) — the assets
    // behind a produced social video. Whole table, additive, idempotent.
    await db.execute(sql`create table if not exists demo_runs (
      id serial primary key,
      created_at timestamptz not null default now(),
      label text, mode text, brief jsonb, hook_line text, concepts jsonb, front_paths jsonb,
      picked_index integer, photo_path text, cameo_path text, inside_path text, words jsonb, beats jsonb
    )`);
  } catch (err) {
    console.warn('[SCHEMA] launch column check failed:', (err as Error)?.message ?? err);
  }
}
