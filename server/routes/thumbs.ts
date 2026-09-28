// server/routes/thumbs.ts — SELF-HEALING THUMBNAILS
//
// GET /api/thumb/:name — serve the grid-tier webp for a stored PNG,
// GENERATING AND STORING it on first request if it doesn't exist yet.
//
// Why this shape (2026-08-28, "images loading slow"): thousands of
// pre-existing images have no `_t.webp` sibling, and a mass backfill
// job would need R2 credentials outside prod. Instead the client tries
// the R2 thumb URL first; on 404 its onError falls back to THIS route,
// which makes the thumb, stores it, and streams it — so the miss is
// paid exactly once per image, ever, and the fleet backfills itself
// (or via a crawl of this route). New images get their thumb at store
// time and never come here.
//
// Deliberately public: it derives a smaller copy of an already-public
// image, nothing more. The name grammar is locked down and the source
// must already exist in storage, so it cannot be used to write
// arbitrary keys or read outside the image space.

import type { Express, Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { isR2Enabled, r2Get } from '../r2-storage';
import { IMAGES_DIR, storeThumbSibling, thumbFilename } from '../image-storage';

/** Whole-filename grammar: the flat names we generate (uuid/imageKey
 *  based), no slashes, no dots beyond the extension — path traversal is
 *  unrepresentable. */
const NAME_RE = /^[A-Za-z0-9_-]+\.png$/;

/** One generation at a time per name — a grid of 30 tiles hitting a
 *  cold cache would otherwise run 30 duplicate sharp pipelines. */
const inFlight = new Map<string, Promise<boolean>>();

async function readStored(name: string): Promise<Buffer | null> {
  if (isR2Enabled()) return r2Get(name);
  try {
    return await fs.readFile(path.join(IMAGES_DIR, name));
  } catch {
    return null;
  }
}

export function registerThumbRoutes(app: Express): void {
  app.get('/api/thumb/:name', async (req: Request, res: Response) => {
    const name = String(req.params.name ?? '');
    if (!NAME_RE.test(name)) return res.status(400).json({ message: 'Bad image name' });
    try {
      const thumbName = thumbFilename(name);
      let thumb = await readStored(thumbName);
      if (!thumb) {
        const source = await readStored(name);
        if (!source) return res.status(404).json({ message: 'No such image' });
        let job = inFlight.get(name);
        if (!job) {
          job = storeThumbSibling(name, source);
          inFlight.set(name, job);
          job.finally(() => inFlight.delete(name));
        }
        const made = await job;
        thumb = made ? await readStored(thumbName) : null;
        if (!thumb) {
          // sharp refused (corrupt png?) — serve the original rather
          // than a broken tile; the client asked for *an* image.
          res.setHeader('content-type', 'image/png');
          res.setHeader('cache-control', 'public, max-age=3600');
          res.setHeader('access-control-allow-origin', '*');
          return res.send(source);
        }
      }
      res.setHeader('content-type', 'image/webp');
      // The R2 copy now exists, so this response can cache hard too.
      res.setHeader('cache-control', 'public, max-age=31536000, immutable');
      res.setHeader('access-control-allow-origin', '*');
      res.send(thumb);
    } catch (err) {
      console.error('[THUMBS] failed for', name, err);
      res.status(500).json({ message: 'Thumbnail failed' });
    }
  });
}
