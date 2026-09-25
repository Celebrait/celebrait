// server/routes/demo-runs.ts
//
// Saved /demo runs — the assets behind a produced social video.
//   POST /api/admin/demo-runs       the run page saves itself at "It's on the way"
//   GET  /api/admin/demo-runs       newest first, with public image URLs (?route= filters)
//   GET  /api/admin/demo-runs/:id   one run — what the HyperFrames build script reads
//   DELETE /api/admin/demo-runs/:id
//
// BOTH ROUTES SAVE (Aidan 2026-09-25: "allow me to save runs that are
// purely generated in this demo view so we have new runs for both
// routes"). `route` says which door made it, so each replay picker only
// offers runs its own screens can actually play.
//
// The POST was deleted by 4e5467d4 along with the home-page demo reel
// and never replaced, so nothing had been saved since. Restored here —
// and it no longer re-uploads the images. Every asset the demo has on
// screen is ALREADY in the store (the renderer put it there), so the row
// just keeps the filename. The old handler re-encoded all five images as
// data URLs and wrote fresh copies, which meant a 12MB request per save
// and a second identical object in R2 for every run.

import type { Express, Request, Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { demoRuns } from '@shared/schema';
import { requireAdmin } from './admin-card-lab';
import { publicImageUrl, storeImageToCustomFilename } from '../image-storage';

/** An image the run already has on screen: either something the store
 *  is already holding (`/images/x.png`, or an absolute URL to it) or,
 *  for an uploaded photo that never went through the renderer, a data
 *  URL we do have to store ourselves. */
const imageRef = z.string().min(1).max(12_000_000);
const saveSchema = z.object({
  route: z.enum(['cards', 'photo']).default('cards'),
  label: z.string().max(120).optional(),
  brief: z.record(z.unknown()),
  hookLine: z.string().max(200).optional(),
  /** Three-card runs carry the concepts; a photo run has none. */
  concepts: z.array(z.record(z.unknown())).max(3).default([]),
  /** Three fronts on the cards route, one on the photo route. */
  fronts: z.array(imageRef).min(1).max(3),
  pickedIndex: z.number().int().min(0).max(2).default(0),
  photo: imageRef.optional(),
  cameo: imageRef.optional(),
  inside: imageRef.optional(),
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

/** `/images/demo_x.png` or `https://…/demo_x.png` → `demo_x.png`.
 *  A data URL has no name yet, so it gets stored and named here. */
async function refToPath(ref: string | undefined, part: string, key: string): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith('data:image/')) {
    return (await storeImageToCustomFilename(ref, `demo_${key}_${part}.png`)).filename;
  }
  const clean = ref.split('?')[0].split('#')[0];
  const name = clean.slice(clean.lastIndexOf('/') + 1);
  return name || null;
}

export function registerDemoRunRoutes(app: Express): void {
  app.post('/api/admin/demo-runs', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      return res.status(400).json({ message: `Invalid run — ${i?.path.join('.')}: ${i?.message}` });
    }
    const b = parsed.data;
    try {
      const key = randomUUID().replace(/-/g, '').slice(0, 12);
      const frontPaths = (await Promise.all(b.fronts.map((f, i) => refToPath(f, `front${i + 1}`, key)))).filter(Boolean) as string[];
      const [photo, cameo, inside] = await Promise.all([
        refToPath(b.photo, 'photo', key),
        refToPath(b.cameo, 'cameo', key),
        refToPath(b.inside, 'inside', key),
      ]);
      const [row] = await db.insert(demoRuns).values({
        route: b.route,
        label: b.label ?? null, brief: b.brief, hook_line: b.hookLine ?? null, concepts: b.concepts,
        front_paths: frontPaths, picked_index: b.pickedIndex, photo_path: photo, cameo_path: cameo, inside_path: inside,
        words: b.words ?? null, beats: b.beats ?? null,
      }).returning({ id: demoRuns.id });
      console.log(`[DEMO] run ${row.id} saved (${b.route}, ${b.label ?? 'unlabelled'})`);
      res.json({ ok: true, id: row.id });
    } catch (err) {
      console.error('[DEMO] save failed:', err);
      res.status(500).json({ message: 'Could not save the run' });
    }
  });

  app.get('/api/admin/demo-runs', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const want = req.query.route === 'photo' ? 'photo' : req.query.route === 'cards' ? 'cards' : null;
      const rows = want
        ? await db.select().from(demoRuns).where(eq(demoRuns.route, want)).orderBy(desc(demoRuns.id)).limit(60)
        : await db.select().from(demoRuns).orderBy(desc(demoRuns.id)).limit(60);
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
