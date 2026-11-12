// server/routes/admin-comp-codes.ts
//
// Mint and review comp codes. Admin-only, same DB-backed gate as the
// rest of /admin.
//
// The list view exists so a gifted card is never a mystery: every code
// carries who it was for, what it covers, and whether it's been used.
// Without that, six weeks of a creator campaign leaves a pile of £0
// orders nobody can account for.

import type { Express, Request, Response } from 'express';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { compCodes, studioOrders, users, normaliseCompCode } from '@shared/schema';

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const userId = (req as any).session?.otpUserId;
  if (!userId) {
    res.status(401).json({ message: 'Not authenticated' });
    return false;
  }
  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, String(userId)))
    .limit(1);
  if (row?.isAdmin !== true) {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
}

/** Human-friendly code generator. Ambiguous glyphs (O/0, I/1, S/5) are
 *  excluded on purpose — these get read off a phone and retyped into a
 *  checkout, and "was that an O or a zero" is a support message. */
function generateCode(prefix: string): string {
  const ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789';
  let tail = '';
  for (let i = 0; i < 5; i++) {
    tail += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  const clean = prefix.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
  return `${clean || 'GIFT'}-${tail}`;
}

export function registerAdminCompCodeRoutes(app: Express): void {
  // ── POST /api/admin/comp-codes ──────────────────────────────────────
  // Mint a code for one named person.
  app.post('/api/admin/comp-codes', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const label = String(req.body?.label ?? '').trim();
      if (!label) {
        return res.status(400).json({ message: 'Label required — who is this for?' });
      }
      // Default = postage only. The free-first-card credit already zeroes
      // the £8.99, so a creator with both pays nothing; covering the card
      // as well is only needed for someone who's already used their free
      // one, and that should be a deliberate tick, not the default.
      const coversShipping = req.body?.coversShipping !== false;
      const coversCard = req.body?.coversCard === true;
      const maxUses = Math.max(1, Math.min(50, Number(req.body?.maxUses) || 1));
      const custom = normaliseCompCode(req.body?.code);
      const code = custom ?? generateCode(req.body?.prefix ?? label.split(/\s+/)[0]);

      const [row] = await db
        .insert(compCodes)
        .values({
          code,
          label,
          coversShipping,
          coversCard,
          maxUses,
          notes: typeof req.body?.notes === 'string' ? req.body.notes : null,
        })
        .returning();

      console.log(`[COMP-CODE] minted ${code} for "${label}" (${maxUses} use(s))`);
      res.json({ compCode: row });
    } catch (err: any) {
      // Unique violation = the code already exists. Say so plainly rather
      // than 500ing, since a custom code collision is a normal mistake.
      if (String(err?.code) === '23505') {
        return res.status(409).json({ message: 'That code already exists.' });
      }
      console.error('[ADMIN_COMP_CODES] create error:', err);
      res.status(500).json({ message: 'Could not create code' });
    }
  });

  // ── GET /api/admin/comp-codes ───────────────────────────────────────
  // Every code, newest first, with what it actually cost us. The
  // gifted-value join is the point: it turns "we sent some free cards"
  // into a number that belongs next to the Cost Ledger.
  app.get('/api/admin/comp-codes', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const rows = (
        await db.execute(sql`
          select c.code, c.label, c.covers_shipping as "coversShipping",
                 c.covers_card as "coversCard", c.max_uses as "maxUses",
                 c.uses, c.active, c.expires_at as "expiresAt",
                 c.notes, c.created_at as "createdAt",
                 coalesce(o.gifted_value, 0) as "giftedValue",
                 o.last_used as "lastUsed"
          from comp_codes c
          left join (
            select comp_code,
                   sum(print_amount + shipping_amount) as gifted_value,
                   max(paid_at) as last_used
            from studio_orders
            where comp_code is not null and payment_status = 'paid'
            group by comp_code
          ) o on o.comp_code = c.code
          order by c.created_at desc
          limit 200
        `)
      ).rows as any[];

      res.json({
        compCodes: rows.map((r) => ({
          code: r.code,
          label: r.label,
          coversShipping: r.coversShipping === true,
          coversCard: r.coversCard === true,
          maxUses: Number(r.maxUses),
          uses: Number(r.uses),
          active: r.active === true,
          expiresAt: r.expiresAt,
          notes: r.notes,
          createdAt: r.createdAt,
          // What we'd have charged for what we gave away, in pence.
          giftedValue: Number(r.giftedValue),
          lastUsed: r.lastUsed,
        })),
      });
    } catch (err) {
      console.error('[ADMIN_COMP_CODES] list error:', err);
      res.status(500).json({ message: 'Could not load codes' });
    }
  });

  // ── PATCH /api/admin/comp-codes/:code ───────────────────────────────
  // Switch a code off. No delete — a spent code is a record of a gift
  // and the orders still point at it.
  app.patch('/api/admin/comp-codes/:code', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const code = normaliseCompCode(req.params.code);
      if (!code) return res.status(400).json({ message: 'Bad code' });
      const [row] = await db
        .update(compCodes)
        .set({ active: req.body?.active === true })
        .where(eq(compCodes.code, code))
        .returning();
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ compCode: row });
    } catch (err) {
      console.error('[ADMIN_COMP_CODES] patch error:', err);
      res.status(500).json({ message: 'Could not update code' });
    }
  });
}
