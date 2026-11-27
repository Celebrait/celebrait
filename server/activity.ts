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

// A CHECKOUT IS NOT ORDINARY TRAFFIC. The buyer leaves for Stripe, pays,
// and may never come back — and if the webhook is missing on prod, the
// only thing that will ever notice is a sweep. That sweep must not be
// starved by the idle gate above, so a checkout leaves a longer mark:
// the sweeper keeps running while any checkout is young enough to still
// be settling, traffic or no traffic.
const CHECKOUT_SETTLING_MS = 48 * 60 * 60 * 1000;
let lastCheckoutAt = 0;
export function touchCheckout(): void { lastCheckoutAt = Date.now(); }
export function checkoutSettling(): boolean { return Date.now() - lastCheckoutAt < CHECKOUT_SETTLING_MS; }
