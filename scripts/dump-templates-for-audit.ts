// Throwaway: dump the live group template + one_person v5 to /tmp for an
// audit pass. group active = id 21 (v4); one_person v5 = id 22.
import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { writeFileSync } from 'fs';
import { db } from '../server/db';
import { promptTemplates, promptActive } from '@shared/schema';

async function main() {
  const active = await db.select().from(promptActive);
  const groupActive = active.find((a) => a.slot === 'front_scene' && a.variant === 'group');
  const ids = [22]; // one_person v5
  if (groupActive) ids.push(groupActive.activeTemplateId);

  const rows = await db
    .select({ id: promptTemplates.id, variant: promptTemplates.variant, version: promptTemplates.version, name: promptTemplates.name, text: promptTemplates.templateText })
    .from(promptTemplates)
    .where(inArray(promptTemplates.id, ids));

  for (const r of rows) {
    const path = `/tmp/audit_${r.variant}_id${r.id}_v${r.version}.txt`;
    writeFileSync(path, r.text);
    console.log(`${r.variant} v${r.version} (id=${r.id}, ${r.text.length} chars) → ${path}`);
  }
  console.log(`\ngroup active pointer = id ${groupActive?.activeTemplateId}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
