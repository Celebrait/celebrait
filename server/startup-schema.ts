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
    // 2026-09-25: which door a saved run came from, so each replay
    // picker only offers runs its own screens can play.
    await db.execute(sql`alter table demo_runs add column if not exists route text`);
    // 2026-09-16: back-office switches (the pre-launch site lock).
    await db.execute(sql`create table if not exists site_settings (
      key text primary key, value jsonb not null, updated_at timestamptz not null default now()
    )`);
    // The early-access list writes to marketing_leads — make sure it exists
    // everywhere (it was a manual prod SQL step before).
    await db.execute(sql`create table if not exists marketing_leads (
      id serial primary key, email text not null, source text not null,
      card_id integer, marketing_opt_in boolean default false,
      recipient_name text, occasion_date text, created_at timestamp default now()
    )`);
    await db.execute(sql`alter table marketing_leads add column if not exists occasion_type text`);
  } catch (err) {
    console.warn('[SCHEMA] launch column check failed:', (err as Error)?.message ?? err);
  }
}
