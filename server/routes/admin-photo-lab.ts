// server/routes/admin-photo-lab.ts
//
// Photo Lab — drop a photo in, see exactly what the studio sees.
//
// WHY THIS EXISTS
//   A card that doesn't resemble its subject is nearly always a bad
//   SOURCE PHOTO, but until now the only way to find out how a photo
//   would be read was to make a whole card and look at the result —
//   minutes, real spend, and no isolation of the variable.
//
//   This runs the SAME vision pass the studio runs on every upload
//   (runPhotoVision in server/photos/analyze.ts — literally the same
//   function, not a copy) and returns it immediately, alongside the
//   cheap deterministic measurements that don't need a model.
//
// NOT PERSISTED. Nothing here writes to `photos` or creates a card.
// It's a bench instrument: measure, learn, throw away. That also means
// a lab run can't pollute customer data or the Cost Ledger's per-card
// figures — the LLM spend is logged under its own slot like any other
// customer-facing call, because it IS real spend.
//
// Auth: admin-only, same per-request DB check as the other admin routes.

import type { Express, Request, Response } from 'express';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { runPhotoVision, assessPhotoLikeness } from '../photos/analyze';

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const otpUserId = (req as any).session?.otpUserId;
  if (typeof otpUserId !== 'string' || otpUserId.length === 0) {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  const row = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, otpUserId))
    .limit(1);
  if (row[0]?.isAdmin !== true) {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
}

/**
 * Blur proxy via Laplacian response.
 *
 * Convolving with a Laplacian kernel leaves edge energy behind; a sharp
 * image has lots, a soft or motion-blurred one has little. We take the
 * standard deviation of that response as the score.
 *
 * Normalised to a fixed 512px working size FIRST, deliberately: edge
 * energy scales with resolution, so without it a big photo would always
 * out-score a small one regardless of how sharp either actually is.
 *
 * It's a proxy, not a verdict — a deliberately shallow-depth-of-field
 * portrait scores lower than a flat snapshot while being the better
 * source. Read it next to the image, not instead of it.
 */
async function sharpnessScore(buf: Buffer): Promise<number | null> {
  try {
    const conv = await sharp(buf)
      .greyscale()
      .resize(512, 512, { fit: 'inside', withoutEnlargement: false })
      // offset 128 is NOT cosmetic. A Laplacian produces mostly negative
      // values and sharp clamps unsigned output at 0, so without it ~60%
      // of pixels floor and the deviation collapses — on a real photo it
      // reported a flat 0. Centring on mid-grey preserves both signs.
      .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 })
      .raw()
      .toBuffer();
    let sum = 0;
    for (let i = 0; i < conv.length; i++) sum += conv[i];
    const mean = sum / conv.length;
    let acc = 0;
    for (let i = 0; i < conv.length; i++) acc += (conv[i] - mean) ** 2;
    return Math.round(Math.sqrt(acc / conv.length) * 100) / 100;
  } catch {
    return null;
  }
}

export function registerAdminPhotoLabRoutes(app: Express): void {
  // ── POST /api/admin/photo-lab/analyze ───────────────────────────────
  // Body: { imageBase64: string (data URL or bare base64), mimeType? }
  app.post('/api/admin/photo-lab/analyze', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;

    try {
      const raw = String(req.body?.imageBase64 ?? '');
      if (!raw) {
        res.status(400).json({ message: 'imageBase64 required' });
        return;
      }
      // Accept either a data URL (what a browser FileReader produces) or
      // bare base64, so pasting from anywhere works.
      // [\s\S] rather than the /s flag — the TS target predates it.
      const m = raw.match(/^data:([^;]+);base64,([\s\S]*)$/);
      const mimeType = m?.[1] ?? String(req.body?.mimeType ?? 'image/jpeg');
      const b64 = m?.[2] ?? raw;
      const bytes = Buffer.from(b64, 'base64');
      if (bytes.length === 0) {
        res.status(400).json({ message: 'Could not decode image' });
        return;
      }

      const meta = await sharp(bytes).metadata();

      // Vision + blur in parallel — one is network-bound, one CPU-bound.
      const [vision, likeness, sharpness] = await Promise.all([
        runPhotoVision({ imageBytes: bytes, mimeType }),
        assessPhotoLikeness({ imageBytes: bytes, mimeType }),
        sharpnessScore(bytes),
      ]);

      res.json({
        file: {
          mimeType,
          bytes: bytes.length,
          width: meta.width ?? null,
          height: meta.height ?? null,
          // The provider works at 1024px. Anything whose shorter side is
          // under that gets upscaled, and detail the model then invents
          // is exactly what makes a face stop looking like the person.
          shorterSide: meta.width && meta.height ? Math.min(meta.width, meta.height) : null,
          wouldUpscale:
            meta.width && meta.height ? Math.min(meta.width, meta.height) < 1024 : null,
        },
        sharpness,
        // The question that actually matters: can a model rebuild these
        // faces in a new scene wearing a new expression?
        likeness: {
          noApiKey: likeness.noApiKey ?? false,
          parsed: !!likeness.result,
          raw: likeness.result ? undefined : likeness.raw.slice(0, 600),
          ...(likeness.result ?? {}),
          model: likeness.model,
          durationMs: likeness.durationMs,
        },
        vision: {
          noApiKey: vision.noApiKey ?? false,
          personCount: vision.result?.personCount ?? null,
          visualSummary: vision.result?.visualSummary ?? null,
          parsed: !!vision.result,
          raw: vision.result ? undefined : vision.raw.slice(0, 500),
          model: vision.model,
          durationMs: vision.durationMs,
          promptTokens: vision.promptTokens,
          outputTokens: vision.outputTokens,
        },
      });
    } catch (err) {
      console.error('[ADMIN_PHOTO_LAB] error:', err);
      res.status(500).json({ message: 'Analysis failed' });
    }
  });
}
