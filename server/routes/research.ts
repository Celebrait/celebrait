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
import { db } from '../db';
import { researchResponses } from '@shared/schema';
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
      const [picked, inside] = await Promise.all([
        storeImage(body.pickedImageUrl, 'front'),
        storeImage(body.insideImageUrl, 'inside'),
      ]);
      const [row] = await db.insert(researchResponses).values({
        tester_name: body.tester_name?.trim() || null,
        brief: body.brief ?? null,
        cards: body.cards ?? null,
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
      res.json({
        responses: rows.map((r) => ({
          ...r,
          pickedImageUrl: r.picked_image_path ? publicImageUrl(r.picked_image_path) : null,
          insideImageUrl: r.inside_image_path ? publicImageUrl(r.inside_image_path) : null,
        })),
      });
    } catch (err) {
      console.error('[RESEARCH] list failed:', err);
      res.status(500).json({ message: 'Could not load responses' });
    }
  });
}
