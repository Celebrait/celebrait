// Throwaway diagnostic — print the actual text of the active group v4
// template, so we can confirm whether the latest in-place rewrite of
// the GROUP_PREAMBLE landed or if Prompt Lab is showing cached UI.
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import { promptTemplates } from '@shared/schema';

async function main() {
  const rows = await db
    .select({
      id: promptTemplates.id,
      version: promptTemplates.version,
      templateText: promptTemplates.templateText,
    })
    .from(promptTemplates)
    .where(eq(promptTemplates.id, 21));

  if (rows.length === 0) {
    console.log('id=21 not found');
    process.exit(1);
  }
  const r = rows[0];
  console.log(`id=${r.id} v${r.version} | ${r.templateText.length} chars`);
  console.log('---');
  // Print the GROUP-PREAMBLE region only — first 2500 chars of body.
  // If the new "For EVERY scene" wording is present we'll see it; if
  // the old "For PHOTOGRAPH scenes" wording is present we'll see that.
  const body = r.templateText;
  const everyIdx = body.indexOf('For EVERY scene');
  const photoIdx = body.indexOf('For PHOTOGRAPH scenes');
  console.log(`"For EVERY scene" found at: ${everyIdx === -1 ? 'NOT FOUND' : everyIdx}`);
  console.log(`"For PHOTOGRAPH scenes" found at: ${photoIdx === -1 ? 'NOT FOUND' : photoIdx}`);
  console.log('---');
  console.log('First 1500 chars after IDENTITY ≠ EXPRESSION block:');
  const start = body.indexOf('CRITICAL — BREAK THE');
  console.log(body.substring(start, start + 1500));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
