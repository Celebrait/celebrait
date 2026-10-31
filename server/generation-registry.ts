// server/generation-registry.ts
//
// In-memory registry of card ids with a generation LIVE in THIS process.
//
// Why it exists (audit 2026-07-27, P0-2): generations run in-process for
// 4–8 minutes and `cards` has no updatedAt/startedAt column, so the
// stale-generation sweeper (server/recovery/stale-sweeper.ts) cannot use
// age to tell a crash-orphaned `generating*` card from a healthy one.
// This Set is the tiebreaker: a card in `generating*` that is NOT in here
// has no living generation behind it (generations never survive a process
// restart) and is safe to flip to failed.
//
// Contract: entry points add the card id SYNCHRONOUSLY before their first
// await and remove it in `finally` — see the wrappers in
// server/background-generator.ts.
export const inFlightCards = new Set<number>();
