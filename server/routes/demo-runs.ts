// server/routes/demo-runs.ts
//
// Saved /demo runs — the assets behind a produced social video.
//   POST /api/admin/demo-runs       the run page saves itself at "It's on the way"
//   GET  /api/admin/demo-runs       newest first, with public image URLs
//   GET  /api/admin/demo-runs/:id   one run — what the HyperFrames build script reads
//   DELETE /api/admin/demo-runs/:id
//   PUT    /api/admin/demo-runs/:id/feature   { featured } — the run the home page loops
//   GET    /api/demo-runs/featured             PUBLIC: that run, for /demo-loop
// Images land in the normal store (R2 in prod, stored_images locally)
// under demo_<run>_<part>.png; the row keeps the names.

import type { Express, Request, Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { demoRuns, siteSettings } from '@shared/schema';
import { sql } from 'drizzle-orm';
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

const FEATURED_KEY = 'featured_demo_run';
async function featuredId(): Promise<number | null> {
  try {
    const rows = await db.select().from(siteSettings).where(eq(siteSettings.key, FEATURED_KEY)).limit(1);
    const v = rows[0]?.value as { id?: number } | undefined;
    return typeof v?.id === 'number' ? v.id : null;
  } catch { return null; }
}

export function registerDemoRunRoutes(app: Express): void {
  // The home page's looping demo (Aidan 2026-09-21): whichever run an admin
  // featured. Public, read-only, images are public URLs already.
  app.get('/api/demo-runs/featured', async (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const id = await featuredId();
    if (id == null) return res.status(404).json({ message: 'No featured run' });
    const [row] = await db.select().from(demoRuns).where(eq(demoRuns.id, id));
    if (!row) return res.status(404).json({ message: 'No featured run' });
    res.json({ run: withUrls(row) });
  });

  app.put('/api/admin/demo-runs/:id/feature', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Bad id' });
    const on = req.body?.featured !== false;
    const value = { id: on ? id : null };
    await db.insert(siteSettings).values({ key: FEATURED_KEY, value })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });
    res.json({ ok: true, featuredId: on ? id : null });
  });

  app.post('/api/admin/demo-runs', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: `Invalid run — ${parsed.error.issues[0]?.path.join('.')}: ${parsed.error.issues[0]?.message}` });
    const b = parsed.data;
    try {
      const key = randomUUID().replace(/-/g, '').slice(0, 12);
      const put = async (img: string | undefined, part: string) => (img ? (await storeImageToCustomFilename(img, `demo_${key}_${part}.png`)).filename : null);
      const frontPaths = await Promise.all(b.fronts.map((f, i) => put(f, `front${i + 1}`)));
      const [photo, cameo, inside] = await Promise.all([put(b.photo, 'photo'), put(b.cameo, 'cameo'), put(b.inside, 'inside')]);
      const [row] = await db.insert(demoRuns).values({
        label: b.label ?? null, mode: b.mode, brief: b.brief, hook_line: b.hookLine ?? null, concepts: b.concepts,
        front_paths: frontPaths, picked_index: b.pickedIndex, photo_path: photo, cameo_path: cameo, inside_path: inside,
        words: b.words ?? null, beats: b.beats ?? null,
      }).returning({ id: demoRuns.id });
      console.log(`[DEMO] run ${row.id} saved (${b.label ?? 'unlabelled'}, ${b.mode})`);
      res.json({ ok: true, id: row.id });
    } catch (err) {
      console.error('[DEMO] save failed:', err);
      res.status(500).json({ message: 'Could not save the run' });
    }
  });

  app.get('/api/admin/demo-runs', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const rows = await db.select().from(demoRuns).orderBy(desc(demoRuns.id)).limit(60);
      res.json({ runs: rows.map(withUrls), featuredId: await featuredId() });
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
