// Throwaway: dump the full template text for one_person v2/v3/v4 so we
// can see exactly where they diverge (gaze + scene-energy + expression).
import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { writeFileSync } from 'fs';
import { db } from '../server/db';
import { promptTemplates } from '@shared/schema';

async function main() {
  const ids = [13, 16, 19]; // one_person v2, v3, v4
  const rows = await db
    .select({
      id: promptTemplates.id,
      variant: promptTemplates.variant,
      version: promptTemplates.version,
      name: promptTemplates.name,
      text: promptTemplates.templateText,
    })
    .from(promptTemplates)
    .where(inArray(promptTemplates.id, ids));

  for (const r of rows) {
    const path = `/tmp/onep_id${r.id}_v${r.version}.txt`;
    writeFileSync(path, r.text);
    console.log(`id=${r.id} v${r.version} (${r.name}) → ${path} [${r.text.length} chars]`);
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
