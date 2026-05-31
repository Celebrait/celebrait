// One-off cleanup: delete superseded one_person front_scene templates,
// leaving only the active v5 (id=22). Founder call 2026-05-27 after v5
// passed validation ("clean all, keep v5").
//
// Deletes one_person versions: ids 6 (v1), 13 (v2), 16 (v3), 19 (v4).
// Keeps: id 22 (v5, active). Does NOT touch id 1 (variant=null baseline,
// still active on the null pointer), nor group/multi templates.
//
// Safety: the only FK to promptTemplates is promptActive.activeTemplateId.
// We abort if any delete target is currently an active pointer.
//
// Run: npx tsx scripts/cleanup-one-person-old-versions.ts

import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { db } from '../server/db';
import { promptTemplates, promptActive } from '@shared/schema';

const DELETE_IDS = [6, 13, 16, 19]; // one_person v1–v4

async function main() {
  console.log('=== Active pointers (safety check) ===');
  const active = await db.select().from(promptActive);
  const activeIds = new Set(active.map((a) => a.activeTemplateId));
  for (const a of active) {
    console.log(`  slot=${a.slot} variant=${a.variant || '(null)'} → id=${a.activeTemplateId}`);
  }

  // Abort if any delete target is active.
  const collision = DELETE_IDS.filter((id) => activeIds.has(id));
  if (collision.length > 0) {
    throw new Error(
      `ABORT: delete target(s) ${collision.join(', ')} are ACTIVE pointers. Refusing to delete.`,
    );
  }

  // Show what we're about to delete.
  const targets = await db
    .select({
      id: promptTemplates.id,
      variant: promptTemplates.variant,
      version: promptTemplates.version,
      name: promptTemplates.name,
    })
    .from(promptTemplates)
    .where(inArray(promptTemplates.id, DELETE_IDS));

  console.log('\n=== Deleting ===');
  for (const t of targets) {
    console.log(`  id=${t.id} variant=${t.variant} v${t.version} | ${t.name}`);
  }

  const deleted = await db
    .delete(promptTemplates)
    .where(inArray(promptTemplates.id, DELETE_IDS))
    .returning({ id: promptTemplates.id });

  console.log(`\nDeleted ${deleted.length} template(s): ${deleted.map((d) => d.id).join(', ')}`);

  // Show what's left for one_person.
  const remaining = await db
    .select({
      id: promptTemplates.id,
      variant: promptTemplates.variant,
      version: promptTemplates.version,
    })
    .from(promptTemplates);
  const onep = remaining.filter((r) => r.variant === 'one_person');
  console.log(
    `\nRemaining one_person templates: ${onep.map((r) => `id=${r.id} v${r.version}`).join(', ') || '(none)'}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
