import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import { promptTemplates } from '@shared/schema';

async function main() {
  const rows = await db.select().from(promptTemplates).where(eq(promptTemplates.id, 16));
  const r = rows[0];
  console.log(`id=16 v${r.version} | ${r.templateText.length} chars`);
  const relTest = r.templateText.indexOf('RELATIONSHIP TEST');
  const pubPriv = r.templateText.indexOf('PUBLIC vs PRIVATE');
  console.log(`"RELATIONSHIP TEST" at: ${relTest === -1 ? 'NOT FOUND' : relTest}`);
  console.log(`"PUBLIC vs PRIVATE" at: ${pubPriv === -1 ? 'NOT FOUND' : pubPriv}`);
  process.exit(0);
}
main();
