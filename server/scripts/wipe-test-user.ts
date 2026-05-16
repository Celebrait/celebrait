// server/scripts/wipe-test-user.ts
//
// CLI to nuke a test user + all their associated data (cards, attempts,
// orders, photos, OTPs). Use this to reset a tested email so the next
// signup with that email is treated as a brand-new user — handy for
// testing the welcome step + first-signup flows.
//
// USAGE:
//   npx tsx server/scripts/wipe-test-user.ts <email>
//
// SAFETY: refuses to wipe admin accounts unless --force is passed.
// Logs everything that gets deleted before deleting (no silent damage).

import 'dotenv/config';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  cards,
  orders,
  photos,
  cardAttempts,
  studioOrders,
  otpCodes,
} from '@shared/schema';

async function main(): Promise<void> {
  const email = process.argv[2]?.toLowerCase().trim();
  const force = process.argv.includes('--force');

  if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx server/scripts/wipe-test-user.ts <email> [--force]');
    process.exit(1);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.log(`No user found with email "${email}". Nothing to wipe.`);
    return;
  }

  if (user.isAdmin && !force) {
    console.error(`User ${email} is an ADMIN. Refusing to wipe without --force.`);
    process.exit(1);
  }

  console.log(`Found user:`);
  console.log(`  id:        ${user.id}`);
  console.log(`  email:     ${user.email}`);
  console.log(`  firstName: ${user.firstName ?? '(none)'}`);
  console.log(`  isAdmin:   ${user.isAdmin}`);
  console.log('');

  // ── Inventory the blast radius ─────────────────────────────────────
  const userCards = await db.select({ id: cards.id }).from(cards).where(eq(cards.userId, user.id));
  const cardIds = userCards.map((c) => c.id);

  const userOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.userId, user.id));

  const userStudioOrders = cardIds.length > 0
    ? await db.select({ id: studioOrders.id }).from(studioOrders).where(inArray(studioOrders.cardId, cardIds))
    : [];

  const userPhotos = await db.select({ id: photos.id }).from(photos).where(eq(photos.userId, user.id));
  const userOtps = await db.select({ id: otpCodes.id }).from(otpCodes).where(eq(otpCodes.email, email));

  console.log(`Will delete:`);
  console.log(`  cards:         ${userCards.length}`);
  console.log(`  studio_orders: ${userStudioOrders.length}`);
  console.log(`  legacy orders: ${userOrders.length}`);
  console.log(`  photos:        ${userPhotos.length} (cascade-deletes on user delete, but we'll be explicit)`);
  console.log(`  otp_codes:     ${userOtps.length}`);
  console.log('');

  // ── Delete in dependency order ─────────────────────────────────────
  // card_attempts → studio_orders → orders → cards → photos → otps → user
  if (cardIds.length > 0) {
    const deletedAttempts = await db
      .delete(cardAttempts)
      .where(inArray(cardAttempts.cardId, cardIds))
      .returning({ id: cardAttempts.id });
    console.log(`Deleted ${deletedAttempts.length} card_attempts.`);

    const deletedStudioOrders = await db
      .delete(studioOrders)
      .where(inArray(studioOrders.cardId, cardIds))
      .returning({ id: studioOrders.id });
    console.log(`Deleted ${deletedStudioOrders.length} studio_orders by card link.`);

    // Legacy orders reference card_id — delete them before cards
    const deletedLegacyOrdersByCard = await db
      .delete(orders)
      .where(inArray(orders.cardId, cardIds))
      .returning({ id: orders.id });
    console.log(`Deleted ${deletedLegacyOrdersByCard.length} legacy orders by card link.`);

    const deletedCards = await db
      .delete(cards)
      .where(inArray(cards.id, cardIds))
      .returning({ id: cards.id });
    console.log(`Deleted ${deletedCards.length} cards.`);
  }

  // Any remaining legacy orders referencing the user but not via cardIds
  const deletedLegacyOrders = await db
    .delete(orders)
    .where(eq(orders.userId, user.id))
    .returning({ id: orders.id });
  console.log(`Deleted ${deletedLegacyOrders.length} legacy orders by user link.`);

  // Any remaining studio_orders that reference the user directly but
  // weren't caught by the cardId sweep (e.g. orphaned orders where the
  // card was deleted independently). studio_orders.userId is a separate
  // FK to users.id and would block the user delete.
  const deletedStudioByUser = await db
    .delete(studioOrders)
    .where(eq(studioOrders.userId, user.id))
    .returning({ id: studioOrders.id });
  console.log(`Deleted ${deletedStudioByUser.length} studio_orders by user link.`);

  // Photos have ON DELETE CASCADE on user, but we delete explicitly so
  // the count is logged.
  const deletedPhotos = await db
    .delete(photos)
    .where(eq(photos.userId, user.id))
    .returning({ id: photos.id });
  console.log(`Deleted ${deletedPhotos.length} photos.`);

  const deletedOtps = await db
    .delete(otpCodes)
    .where(eq(otpCodes.email, email))
    .returning({ id: otpCodes.id });
  console.log(`Deleted ${deletedOtps.length} otp_codes.`);

  // Finally, the user row
  const deletedUser = await db
    .delete(users)
    .where(eq(users.id, user.id))
    .returning({ id: users.id });
  console.log(`Deleted ${deletedUser.length} user row.`);

  console.log('');
  console.log(`✓ Wiped "${email}". Next signup with this email will be treated as new.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Wipe failed:', err);
    process.exit(1);
  });
