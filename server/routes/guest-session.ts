// server/routes/guest-session.ts — POST /api/guest/session
//
// No sign-up on the photo route (Aidan 2026-11-27). Pressing Generate
// signed out mints a throwaway account and logs this browser into it, so
// the studio's whole authed pipeline (drafts, photo upload, generation,
// checkout) runs untouched: the beta door's trick (site-lock.ts), open
// to everyone. The account lives on the guest domain (shared/guest.ts):
// never mailed, never offered the free first card, and capped lower per
// day (server/rate-limits.ts). Minting is limited per connection so a
// script can't farm fresh daily allowances by clearing cookies.
import type { Express, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { users } from '@shared/schema';
import { GUEST_EMAIL_DOMAIN } from '@shared/guest';

const MINTS_PER_IP_PER_DAY = 4;
const DAY = 24 * 60 * 60 * 1000;
const mints = new Map<string, number[]>();

export function registerGuestSessionRoutes(app: Express): void {
  app.post('/api/guest/session', async (req: Request, res: Response) => {
    const existing = (req as any).session?.otpUserId;
    if (typeof existing === 'string' && existing.length > 0) return res.json({ ok: true, reused: true });
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').split(',')[0].trim();
    const now = Date.now();
    const recent = (mints.get(ip) ?? []).filter((t) => now - t < DAY);
    if (recent.length >= MINTS_PER_IP_PER_DAY) {
      return res.status(429).json({ message: "You've made a lot of cards today. Sign in with your email to keep going." });
    }
    try {
      const [u] = await db.insert(users).values({
        email: `guest+${randomUUID().replace(/-/g, '').slice(0, 16)}@${GUEST_EMAIL_DOMAIN}`,
      }).returning({ id: users.id });
      recent.push(now);
      mints.set(ip, recent);
      (req as any).session.otpUserId = u.id;
      // Save before answering: the very next request (the draft) must
      // already see the signed-in session.
      await new Promise<void>((resolve, reject) => (req as any).session.save((e: unknown) => (e ? reject(e) : resolve())));
      console.log(`[GUEST] account ${u.id} opened`);
      res.json({ ok: true, reused: false });
    } catch (err) {
      console.error('[GUEST] mint failed:', err);
      res.status(500).json({ message: "We couldn't start your card. Try again." });
    }
  });
}
