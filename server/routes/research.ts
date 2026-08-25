// server/routes/research.ts
//
// THE F&F RESEARCH SURVEY — response capture + admin readout. The
// engine endpoints the walk-through uses live in admin-card-lab.ts
// (dual-registered under /api/research/* behind the same key gate
// this file imports). This file owns only the survey row and the
// admin view of it.

import type { Express, Request, Response } from 'express';
import { desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { randomUUID as uuid } from 'crypto';
import { db } from '../db';
import { researchResponses, researchRenders, users } from '@shared/schema';
import { requireAdmin, requireResearch } from './admin-card-lab';
import { isR2Enabled, r2Put } from '../r2-storage';
import { publicImageUrl } from '../image-storage';

/** Store a data-URL image the same way template keeps do; returns the
 *  stored filename or null. Never throws — a lost thumbnail must not
 *  lose the answers. */
async function storeImage(dataUrl: unknown, label: string): Promise<string | null> {
  try {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/') || dataUrl.length > 8_000_000) return null;
    const buffer = Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const filename = `research_${label}_${randomUUID()}.png`;
    if (isR2Enabled()) await r2Put(filename, buffer, 'image/png');
    else await fs.writeFile(path.join(process.cwd(), 'stored_images', filename), buffer);
    return filename;
  } catch (err) {
    console.warn('[RESEARCH] image store failed (non-fatal):', err);
    return null;
  }
}

export function registerResearchRoutes(app: Express): void {
  // POST /api/research/photo/session — the no-signup door to the REAL
  // photo studio (Aidan: "No studio sign up etc. Just want the same
  // public facing for friends and fam"). The key silently mints a
  // throwaway tester account and logs the browser in, so the studio's
  // whole authed pipeline works untouched and the tester never sees a
  // signup screen. One mint per browser (re-used if already signed in);
  // tester accounts are flagged by their email domain for later
  // cleanup and are invisible to marketing (opt-in stays false).
  app.post('/api/research/photo/session', async (req: Request, res: Response) => {
    if (!(await requireResearch('photo-session')(req, res))) return;
    try {
      const existing = (req as any).session?.otpUserId;
      if (typeof existing === 'string' && existing.length > 0) return res.json({ ok: true, reused: true });
      const [u] = await db.insert(users).values({
        email: `research+${uuid().slice(0, 12)}@testers.celebrait.co.uk`,
        firstName: 'Research tester',
      }).returning({ id: users.id });
      (req as any).session.otpUserId = u.id;
      res.json({ ok: true, reused: false });
    } catch (err) {
      console.error('[RESEARCH] session mint failed:', err);
      res.status(500).json({ message: 'Could not open the maker — try again' });
    }
  });

  // POST /api/research/response — one row per completed walk-through.
  app.post('/api/research/response', async (req: Request, res: Response) => {
    if (!(await requireResearch('response')(req, res))) return;
    const schema = z.object({
      tester_name: z.string().max(80).optional(),
      brief: z.record(z.unknown()).optional(),
      cards: z.array(z.object({
        front_text: z.string().max(400),
        tone: z.string().max(20).optional(),
        angle: z.string().max(160).optional(),
        // Every card the tester SAW, as a data URL (Aidan: "I want to
        // see the cards they see, plus the one they choose"). 25mb
        // body limit comfortably takes three fronts + an inside.
        imageUrl: z.string().optional(),
      })).max(3).optional(),
      picked_index: z.number().int().min(0).max(2).nullable().optional(),
      regen_used: z.boolean().optional(),
      pickedImageUrl: z.string().optional(),
      insideImageUrl: z.string().optional(),
      answers: z.record(z.string().max(2000)).optional(),
    });
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(req.body);
    } catch (err) {
      const issue = err instanceof z.ZodError ? err.issues[0] : null;
      return res.status(400).json({ message: issue ? `Invalid response — ${issue.path.join('.')}: ${issue.message}` : 'Invalid response' });
    }
    try {
      const cardPaths = await Promise.all(
        (body.cards ?? []).map((c, i) => storeImage(c.imageUrl, `card${i}`)),
      );
      const cardsStored = body.cards?.map(({ imageUrl: _drop, ...rest }, i) => ({ ...rest, image_path: cardPaths[i] })) ?? null;
      const [picked, inside] = await Promise.all([
        body.picked_index != null && cardPaths[body.picked_index]
          ? Promise.resolve(cardPaths[body.picked_index])
          : storeImage(body.pickedImageUrl, 'front'),
        storeImage(body.insideImageUrl, 'inside'),
      ]);
      const [row] = await db.insert(researchResponses).values({
        tester_name: body.tester_name?.trim() || null,
        brief: body.brief ?? null,
        cards: cardsStored,
        picked_index: body.picked_index ?? null,
        regen_used: body.regen_used ?? false,
        picked_image_path: picked,
        inside_image_path: inside,
        answers: body.answers ?? null,
      }).returning({ id: researchResponses.id });
      res.json({ ok: true, id: row.id });
    } catch (err) {
      console.error('[RESEARCH] save failed:', err);
      res.status(500).json({ message: 'Could not save — your card is still yours though' });
    }
  });

  // GET /api/admin/research — the readout, newest first.
  app.get('/api/admin/research', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const rows = await db.select().from(researchResponses)
        .orderBy(desc(researchResponses.id)).limit(200);
      const liveRenders = await db.select().from(researchRenders)
        .orderBy(desc(researchRenders.id)).limit(150);
      res.json({
        responses: rows.map((r) => ({
          ...r,
          cards: Array.isArray(r.cards)
            ? (r.cards as Array<Record<string, unknown>>).map((c) => ({ ...c, imageUrl: c.image_path ? publicImageUrl(String(c.image_path)) : null }))
            : r.cards,
          pickedImageUrl: r.picked_image_path ? publicImageUrl(r.picked_image_path) : null,
          insideImageUrl: r.inside_image_path ? publicImageUrl(r.inside_image_path) : null,
        })),
        renders: liveRenders.map((r) => ({
          id: r.id, created_at: r.created_at, kind: r.kind, front_text: r.front_text,
          imageUrl: r.image_path ? publicImageUrl(r.image_path) : null,
        })),
      });
    } catch (err) {
      console.error('[RESEARCH] list failed:', err);
      res.status(500).json({ message: 'Could not load responses' });
    }
  });
}
