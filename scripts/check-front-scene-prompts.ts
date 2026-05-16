// Throwaway diagnostic — list every front_scene template + active
// pointer in the DB so we can confirm whether versions/variants got
// lost or whether it's just a UI display question.
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import { promptTemplates, promptActive } from '@shared/schema';

async function main() {
  console.log('=== ALL templates for slot=front_scene ===');
  const rows = await db
    .select({
      id: promptTemplates.id,
      slot: promptTemplates.slot,
      variant: promptTemplates.variant,
      version: promptTemplates.version,
      name: promptTemplates.name,
      chars: promptTemplates.templateText,
      createdAt: promptTemplates.createdAt,
      notes: promptTemplates.notes,
    })
    .from(promptTemplates)
    .where(eq(promptTemplates.slot, 'front_scene'));
  for (const r of rows) {
    console.log(
      `  id=${r.id} variant=${r.variant ?? '(none)'} v${r.version} | ${r.name} | ${r.chars.length} chars | ${r.createdAt}`,
    );
    if (r.notes) console.log(`     notes: ${r.notes.slice(0, 120)}`);
  }
  console.log('\n=== Active pointers for front_scene ===');
  const active = await db
    .select()
    .from(promptActive)
    .where(eq(promptActive.slot, 'front_scene'));
  for (const a of active) {
    console.log(
      `  variant=${a.variant ?? '(none)'} → activeTemplateId=${a.activeTemplateId}`,
    );
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
