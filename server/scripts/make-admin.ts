// server/scripts/make-admin.ts
//
// CLI to grant or revoke back-office admin access to a user by email.
//
// Usage:
//   npx tsx server/scripts/make-admin.ts <email>            # grant admin
//   npx tsx server/scripts/make-admin.ts <email> --revoke   # revoke admin
//   npx tsx server/scripts/make-admin.ts --list             # list all admins
//
// The user must already exist in the `users` table (i.e. they've logged in
// at least once via the OTP flow, or been created by some other flow). This
// script does NOT create users — that would be an account creation tool, a
// separate concern.

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';

async function listAdmins(): Promise<void> {
  const rows = await db
    .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.isAdmin, true));
  if (rows.length === 0) {
    console.log('No admins.');
    return;
  }
  console.log(`${rows.length} admin(s):`);
  for (const r of rows) {
    console.log(`  - ${r.email ?? '(no email)'}  ${r.firstName ?? ''} ${r.lastName ?? ''}`.trim());
  }
}

async function setAdmin(email: string, value: boolean): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (existing.length === 0) {
    console.error(
      `✗ No user with email "${normalized}". The user must sign in via OTP at least once before they can be made admin.`,
    );
    process.exit(1);
  }

  const [updated] = await db
    .update(users)
    .set({ isAdmin: value, updatedAt: new Date() })
    .where(eq(users.email, normalized))
    .returning();

  const verb = value ? 'granted admin access' : 'revoked admin access';
  console.log(`✓ ${verb} for ${updated.email} (id=${updated.id})`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage:');
    console.log('  npx tsx server/scripts/make-admin.ts <email>            # grant admin');
    console.log('  npx tsx server/scripts/make-admin.ts <email> --revoke   # revoke admin');
    console.log('  npx tsx server/scripts/make-admin.ts --list             # list all admins');
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (args[0] === '--list') {
    await listAdmins();
    process.exit(0);
  }

  const email = args[0];
  const revoke = args.includes('--revoke');
  await setAdmin(email, !revoke);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
