// server/routes/demo-runs.ts
//
// Saved /demo runs — the assets behind a produced social video.
//   POST /api/admin/demo-runs       the run page saves itself at "It's on the way"
//   GET  /api/admin/demo-runs       newest first, with public image URLs
//   GET  /api/admin/demo-runs/:id   one run — what the HyperFrames build script reads
//   DELETE /api/admin/demo-runs/:id
// Images land in the normal store (R2 in prod, stored_images locally)
// under demo_<run>_<part>.png; the row keeps the names.

import type { Express, Request, Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { demoRuns } from '@shared/schema';
import { requireAdmin } from './admin-card-lab';
import { publicImageUrl, storeImageToCustomFilename } from '../image-storage';

const dataUrl = z.string().startsWith('data:image/').max(12_000_000);
const saveSchema = z.object({
  mode: z.enum(['auto', 'manual']).default('auto'),
  label: z.string().max(120).optional(),
  brief: z.record(z.unknown()),
  hookLine: z.string().max(200).optional(),
  concepts: z.array(z.record(z.unknown())).max(3),
  fronts: z.array(dataUrl).max(3),
  pickedIndex: z.number().int().min(0).max(2).default(0),
  photo: dataUrl.optional(),
  cameo: dataUrl.optional(),
  inside: dataUrl.optional(),
  words: z.object({ dear: z.string().max(200), message: z.string().max(2000), from: z.string().max(200) }).optional(),
  beats: z.array(z.object({ name: z.string().max(80), t: z.number() })).max(200).optional(),
});

function withUrls(r: typeof demoRuns.$inferSelect) {
  const fronts = Array.isArray(r.front_paths) ? (r.front_paths as string[]) : [];
  return {
    ...r,
    frontUrls: fronts.map((p) => publicImageUrl(p)),
    photoUrl: r.photo_path ? publicImageUrl(r.photo_path) : null,
    cameoUrl: r.cameo_path ? publicImageUrl(r.cameo_path) : null,
    insideUrl: r.inside_path ? publicImageUrl(r.inside_path) : null,
  };
}

export function registerDemoRunRoutes(app: Express): void {
  app.get('/api/admin/demo-runs', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const rows = await db.select().from(demoRuns).orderBy(desc(demoRuns.id)).limit(60);
      res.json({ runs: rows.map(withUrls) });
    } catch (err) {
      console.error('[DEMO] list failed:', err);
      res.status(500).json({ message: 'Could not list runs' });
    }
  });

  app.get('/api/admin/demo-runs/:id', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Bad id' });
    const [row] = await db.select().from(demoRuns).where(eq(demoRuns.id, id));
    if (!row) return res.status(404).json({ message: 'No such run' });
    res.json({ run: withUrls(row) });
  });

  app.delete('/api/admin/demo-runs/:id', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Bad id' });
    await db.delete(demoRuns).where(eq(demoRuns.id, id));
    res.json({ ok: true });
  });
}
