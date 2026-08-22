// server/routes/catalogue.ts
//
// THE PUBLIC CATALOGUE — the rack, customer-facing (UX_PLATFORM_IA.md
// slice 1). Reads the same card_templates the studio curates into;
// admin-only fields never leave the server, and only aisles that clear
// their stock threshold are offered at all (the pSEO rule: pages need
// real cards or Google bins them — so the API refuses to describe a
// bare shelf rather than trusting every client to check).
//
// Aisle grammar mirrors the market's URLs (/cards/birthday/18th,
// /for-mum, /funny) because SEO arrivals pattern-match known shapes.

import type { Express, Request, Response } from 'express';
import { desc, eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { cardTemplates } from '@shared/schema';
import { publicImageUrl } from '../image-storage';

/** Thresholds from UX_PLATFORM_IA.md §5. */
const HUB_MIN = 24;
const AISLE_MIN = 8;

/** The aisles the platform knows how to slice. Extended by adding a
 *  row here — the client renders whatever this returns. */
const MILESTONES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 16, 18, 21, 25, 30, 40, 50, 60, 70, 80];
const RECIPIENTS = ['mum', 'dad', 'nan', 'grandad', 'sister', 'brother', 'daughter', 'son', 'partner', 'best mate', 'friend', 'colleague'];
const STYLES = ['funny', 'warm', 'rude'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Parse an aisle slug into a where-clause fragment, or null. */
function aisleFilter(slug: string) {
  const m = slug.match(/^(\d{1,3})(st|nd|rd|th)$/);
  if (m) return { kind: 'age' as const, age: Number(m[1]) };
  if (slug.startsWith('for-')) {
    const who = slug.slice(4).replace(/-/g, ' ');
    if (RECIPIENTS.includes(who)) return { kind: 'recipient' as const, who };
  }
  if (STYLES.includes(slug)) return { kind: 'style' as const, tone: slug };
  return null;
}

export function registerCatalogueRoutes(app: Express): void {
  // GET /api/catalogue/:occasion — the hub payload: cards + which
  // aisles have cleared their threshold. One round trip per page.
  app.get('/api/catalogue/:occasion', async (req: Request, res: Response) => {
    try {
      const occasion = String(req.params.occasion).toLowerCase();
      const aisle = typeof req.query.aisle === 'string' ? req.query.aisle : null;

      const base = eq(cardTemplates.occasion, occasion);
      let where = base as ReturnType<typeof and>;
      if (aisle) {
        const f = aisleFilter(aisle);
        if (!f) return res.status(404).json({ message: 'No such aisle' });
        where = and(base,
          f.kind === 'age' ? eq(cardTemplates.age, f.age)
          : f.kind === 'recipient' ? sql`lower(${cardTemplates.recipient}) = ${f.who}`
          : eq(cardTemplates.tone, f.tone))!;
      }

      const rows = await db.select().from(cardTemplates).where(where).orderBy(desc(cardTemplates.id)).limit(120);

      // Threshold gate: a bare page is worse than no page.
      const min = aisle ? AISLE_MIN : HUB_MIN;
      if (rows.length < min) return res.status(404).json({ message: 'Not enough cards here yet' });

      // Aisle availability for the rails — counts in one grouped query
      // per axis, filtered to threshold server-side.
      const [byAge, byWho, byTone] = await Promise.all([
        db.select({ k: cardTemplates.age, n: sql<number>`count(*)` }).from(cardTemplates).where(base).groupBy(cardTemplates.age),
        db.select({ k: sql<string>`lower(${cardTemplates.recipient})`, n: sql<number>`count(*)` }).from(cardTemplates).where(base).groupBy(sql`lower(${cardTemplates.recipient})`),
        db.select({ k: cardTemplates.tone, n: sql<number>`count(*)` }).from(cardTemplates).where(base).groupBy(cardTemplates.tone),
      ]);
      const aisles = {
        ages: byAge.filter((r) => r.k !== null && Number(r.n) >= AISLE_MIN && MILESTONES.includes(r.k as number))
          .map((r) => ({ slug: ordinal(r.k as number), label: `${ordinal(r.k as number)} birthday`, count: Number(r.n) })),
        recipients: byWho.filter((r) => r.k && Number(r.n) >= AISLE_MIN && RECIPIENTS.includes(r.k))
          .map((r) => ({ slug: `for-${r.k.replace(/ /g, '-')}`, label: `For ${r.k}`, count: Number(r.n) })),
        styles: byTone.filter((r) => r.k && Number(r.n) >= AISLE_MIN && STYLES.includes(r.k as string))
          .map((r) => ({ slug: r.k as string, label: r.k as string, count: Number(r.n) })),
      };

      res.json({
        occasion,
        aisle,
        count: rows.length,
        aisles,
        cards: rows.map((t) => ({
          id: t.id,
          front_text: t.front_text,
          tone: t.tone,
          age: t.age,
          recipient: t.recipient,
          editable: t.editable,
          imageUrl: publicImageUrl(t.image_path),
        })),
      });
    } catch (err) {
      console.error('[CATALOGUE] failed:', err);
      res.status(500).json({ message: 'The rack is having a moment' });
    }
  });
}
