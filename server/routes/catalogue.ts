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
  // Kids is a real aisle (the taxonomy: a different product) — tagged
  // 'kids' or simply aged 1-12.
  if (slug === 'kids') return { kind: 'kids' as const };
  // The market's top two aisles — checked before the recipient grammar
  // ('for-her' would otherwise fall through it and 404).
  if (slug === 'for-her') return { kind: 'gender' as const, gender: 'her' as const };
  if (slug === 'for-him') return { kind: 'gender' as const, gender: 'him' as const };
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
  // GET /api/catalogue/card/:id — the product page payload. Public,
  // published cards only; admin fields stay server-side.
  app.get('/api/catalogue/card/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: 'Bad id' });
      const [t] = await db.select().from(cardTemplates).where(eq(cardTemplates.id, id));
      if (!t || !t.published) return res.status(404).json({ message: 'No such card' });
      res.json({ card: {
        id: t.id, occasion: t.occasion, front_text: t.front_text, inside_text: t.inside_text,
        tone: t.tone, age: t.age, recipient: t.recipient, editable: t.editable,
        imageUrl: publicImageUrl(t.image_path),
        insideImageUrl: t.inside_image_path ? publicImageUrl(t.inside_image_path) : null,
      } });
    } catch (err) {
      console.error('[CATALOGUE] card failed:', err);
      res.status(500).json({ message: 'Could not load the card' });
    }
  });

  // GET /api/catalogue/:occasion — the hub payload: cards + which
  // aisles have cleared their threshold. One round trip per page.
  app.get('/api/catalogue/:occasion', async (req: Request, res: Response) => {
    try {
      const occasion = String(req.params.occasion).toLowerCase();
      const aisle = typeof req.query.aisle === 'string' ? req.query.aisle : null;

      // Published only, and aisle membership is DERIVED ∪ TAGGED: a
      // card sits in every aisle its fields imply PLUS any it was
      // hand-shelved into (overlap by design). Membership is computed
      // in JS off one slim fetch — at catalogue scale (hundreds, not
      // thousands) that beats three OR-heavy grouped queries.
      const all = await db.select().from(cardTemplates)
        .where(and(eq(cardTemplates.occasion, occasion), eq(cardTemplates.published, true))!)
        .orderBy(desc(cardTemplates.id));

      const inAisle = (t: typeof all[number], slug: string): boolean => {
        const f = aisleFilter(slug);
        if (!f) return false;
        const tags: string[] = (t.aisle_tags as string[] | null) ?? [];
        if (tags.includes(slug)) return true;
        if (f.kind === 'kids') return t.age !== null && t.age >= 1 && t.age <= 12;
        if (f.kind === 'gender') {
          const implied = ({ mum: 'her', nan: 'her', sister: 'her', daughter: 'her', dad: 'him', grandad: 'him', brother: 'him', son: 'him' } as Record<string, string>)[(t.recipient ?? '').toLowerCase()];
          return t.gender === f.gender || implied === f.gender;
        }
        if (f.kind === 'age') return t.age === f.age;
        if (f.kind === 'recipient') return (t.recipient ?? '').toLowerCase() === f.who;
        return (t.tone ?? '').toLowerCase() === f.tone;
      };

      const rows = aisle
        ? (aisleFilter(aisle) ? all.filter((t) => inAisle(t, aisle)) : null)
        : all;
      if (rows === null) return res.status(404).json({ message: 'No such aisle' });

      // Threshold gate: a bare page is worse than no page.
      const min = aisle ? AISLE_MIN : HUB_MIN;
      if (rows.length < min) return res.status(404).json({ message: 'Not enough cards here yet' });

      const countFor = (slug: string) => all.filter((t) => inAisle(t, slug)).length;
      const aisles = {
        ages: [
          ...MILESTONES.map((n) => ({ slug: ordinal(n), label: `${ordinal(n)} birthday`, count: countFor(ordinal(n)) })),
          { slug: 'kids', label: 'Kids', count: countFor('kids') },
        ].filter((a) => a.count >= AISLE_MIN),
        recipients: [
          { slug: 'for-her', label: 'For her', count: countFor('for-her') },
          { slug: 'for-him', label: 'For him', count: countFor('for-him') },
          ...RECIPIENTS.map((w) => ({ slug: `for-${w.replace(/ /g, '-')}`, label: `For ${w}`, count: countFor(`for-${w.replace(/ /g, '-')}`) })),
        ].filter((a) => a.count >= AISLE_MIN),
        styles: STYLES.map((t) => ({ slug: t, label: t, count: countFor(t) }))
          .filter((a) => a.count >= AISLE_MIN),
      };

      res.json({
        occasion,
        aisle,
        count: rows.length,
        aisles,
        cards: rows.slice(0, 120).map((t) => ({
          id: t.id,
          front_text: t.front_text,
          tone: t.tone,
          age: t.age,
          recipient: t.recipient,
          editable: t.editable,
          // The search haystack: the brief's interest finds cards whose
          // front never names it ("Es Vedrà" cards match "ibiza").
          interest: t.interest,
          imageUrl: publicImageUrl(t.image_path),
        })),
      });
    } catch (err) {
      console.error('[CATALOGUE] failed:', err);
      res.status(500).json({ message: 'The rack is having a moment' });
    }
  });
}
