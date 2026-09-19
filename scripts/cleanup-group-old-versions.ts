// One-off cleanup: delete superseded group front_scene templates after
// v5 (id=24) went live. Founder call 2026-05-31 ("nailed this, lock in v5,
// remove anything else"). Deletes group v1–v4 (ids 8/15/18/21); keeps v5
// (id 24, active). Guard aborts if any target is an active pointer.
//
// Run: npx tsx scripts/cleanup-group-old-versions.ts

import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { db } from '../server/db';
import { promptTemplates, promptActive } from '@shared/schema';

const DELETE_IDS = [8, 15, 18, 21]; // group v1–v4

async function main() {
  const active = await db.select().from(promptActive);
  const activeIds = new Set(active.map((a) => a.activeTemplateId));
  console.log('Active pointers:');
  for (const a of active) console.log(`  ${a.slot}/${a.variant || '(null)'} → id=${a.activeTemplateId}`);

  const collision = DELETE_IDS.filter((id) => activeIds.has(id));
  if (collision.length > 0) {
    throw new Error(`ABORT: delete target(s) ${collision.join(', ')} are ACTIVE. Refusing.`);
  }

  const deleted = await db
    .delete(promptTemplates)
    .where(inArray(promptTemplates.id, DELETE_IDS))
    .returning({ id: promptTemplates.id, version: promptTemplates.version });
  console.log(`\nDeleted ${deleted.length}: ${deleted.map((d) => `id=${d.id} v${d.version}`).join(', ')}`);

  const remaining = (
    await db.select({ id: promptTemplates.id, version: promptTemplates.version, variant: promptTemplates.variant }).from(promptTemplates)
  ).filter((r) => r.variant === 'group');
  console.log(`Remaining group: ${remaining.map((r) => `id=${r.id} v${r.version}`).join(', ') || '(none)'}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
