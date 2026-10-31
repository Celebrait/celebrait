// server/photos/likeness-cache.ts — one verdict per set of bytes.
//
// Launch audit 2026-10-06: the same photo, same crop, came back amber on
// one run and green on the next. The judge is a sampled vision model
// (temperature 0.1, not 0) — so two calls on identical bytes CAN differ,
// and the public maker (/api/photos/assess) and the studio upload
// (analyzePhoto) each ask it afresh. This cache makes identical bytes
// return the identical verdict: keyed by a hash of exactly what the model
// sees (the cropped JPEG), so a guest's verdict is the one the studio
// shows after sign-up, and a re-assess of the same crop costs nothing.
//
// In-memory, bounded, 24h (matches the guest photo TTL). Only parsed
// verdicts are stored — a parse failure stays un-cached so the next
// attempt gets a fresh roll. Restart clears it; that is the one window
// where a repeat can still differ (the real fix is a deterministic judge,
// which is a Prompt Lab change, not plumbing).

import { createHash } from 'crypto';
import type { LikenessAssessment } from './analyze';

const MAX_ENTRIES = 500;
const TTL_MS = 24 * 60 * 60 * 1000;

const cache = new Map<string, { at: number; result: LikenessAssessment }>();

export function likenessCacheKey(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function getCachedLikeness(key: string): LikenessAssessment | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) { cache.delete(key); return null; }
  // Re-insert to mark as recently used (Map keeps insertion order).
  cache.delete(key);
  cache.set(key, hit);
  return hit.result;
}

export function putCachedLikeness(key: string, result: LikenessAssessment | null): void {
  if (!result) return;
  cache.set(key, { at: Date.now(), result });
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}
