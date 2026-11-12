// server/simple-rate-limit.ts
//
// Tiny in-memory fixed-window rate limiter. Deliberately dependency-free:
// we run a single Render instance, so per-process counters are the correct
// scope — no Redis needed. If we ever scale to multiple instances this
// becomes per-instance (i.e. limits multiply by instance count), which is
// still a real ceiling; swap for a shared store then.
//
// Added 2026-07-02 (security audit): the OTP endpoints had NO limiting —
// 6-digit codes + unlimited verify guesses = practical account takeover,
// and unlimited sends = inbox-bombing + Brevo cost abuse.
//
// Fixed-window (not sliding): counts reset when the window rolls over.
// Coarser than a token bucket but plenty for auth abuse ceilings, and the
// implementation stays small enough to audit at a glance.

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// Cap total tracked keys so an attacker rotating keys (e.g. spraying
// emails) can't balloon memory. When full, the whole map resets — brief
// amnesty, bounded memory. 100k keys ≈ a few MB.
const MAX_KEYS = 100_000;

/**
 * Record a hit against `key` and report whether the caller is now over
 * `max` hits within the current `windowMs` window.
 *
 * Returns true = BLOCK (over limit), false = allow.
 */
export function rateLimitHit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > MAX_KEYS) buckets.clear();

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

/** Clear a key (e.g. reset an email's failed-verify count on success). */
export function rateLimitClear(key: string): void {
  buckets.delete(key);
}

/** Client IP for keying. Express sets req.ip from X-Forwarded-For when
 *  `trust proxy` is configured (it is — see replitAuth.ts). */
export function clientIp(req: { ip?: string }): string {
  return req.ip ?? 'unknown';
}
