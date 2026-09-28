// server/activity.ts — "has anyone actually used the site?"
//
// Neon bills COMPUTE, and a compute only suspends after five minutes
// with no queries. Background jobs on a short interval therefore cost
// real money on an idle site: every poll wakes the database, which then
// sits up for its whole idle window before the next poll wakes it
// again. Celebrait's compute was awake ~83% of a month in which nobody
// visited (2026-09-28: $36 of Neon, all compute, none of it storage).
//
// The fix is not slower polling — it is polling only when something can
// plausibly have happened. Every HTTP request stamps this; a job asks
// whether anything has come in since it last ran, and skips entirely if
// not. An idle site then does NO database work at all and the compute
// sleeps.
//
// Safe because the work these jobs do is always DOWNSTREAM of a
// request: a generation can only be stale if someone started one, an
// order can only strand if someone paid. No request since the last
// sweep means there is nothing new to find.

let lastRequestAt = Date.now();

export function touchActivity(): void {
  lastRequestAt = Date.now();
}

/** Has a request arrived since the given moment? */
export function activitySince(since: number): boolean {
  return lastRequestAt > since;
}

export function lastActivityAt(): number {
  return lastRequestAt;
}
