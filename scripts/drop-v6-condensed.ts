// One-off: drop the v6 condensed challenger (id=23). Founder call
// 2026-05-27 — tested, no generation-speed gain (synthesis-dominated),
// so the condense isn't worth carrying a second template for. v5 (id=22)
// stays as the sole production one_person template.
//
// Safety: refuse to delete if id=23 is somehow an active pointer.
//
// Run: npx tsx scripts/drop-v6-condensed.ts

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import { promptTemplates, promptActive } from '@shared/schema';

const DROP_ID = 23;

async function main() {
  const active = await db.select().from(promptActive);
  if (active.some((a) => a.activeTemplateId === DROP_ID)) {
    throw new Error(`ABORT: id=${DROP_ID} is an active pointer. Refusing to delete.`);
  }
  const deleted = await db
    .delete(promptTemplates)
    .where(eq(promptTemplates.id, DROP_ID))
    .returning({ id: promptTemplates.id, version: promptTemplates.version });
  console.log(deleted.length ? `Deleted id=${DROP_ID} (v6 condensed).` : `id=${DROP_ID} not found.`);

  const onep = (
    await db.select({ id: promptTemplates.id, version: promptTemplates.version, variant: promptTemplates.variant }).from(promptTemplates)
  ).filter((r) => r.variant === 'one_person');
  console.log(`Remaining one_person: ${onep.map((r) => `id=${r.id} v${r.version}`).join(', ') || '(none)'}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
