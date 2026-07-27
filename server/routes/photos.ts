// server/routes/photos.ts
//
// User-owned photo library for the Studio. Uploads are base64-in-JSON to
// match the existing pattern (the top-level express.json limit is 50mb).
// Sharp handles metadata + thumbnail generation + optional crop.
//
// Files on disk:
//   stored_images/photos/{userId}/original_{photoId}.{ext}
//   stored_images/photos/{userId}/cropped_{photoId}.jpg   (if crop supplied)
//   stored_images/photos/{userId}/thumb_{photoId}.jpg
//
// All endpoints require an authenticated OTP session. Ownership is
// enforced per request against the session's otpUserId.

import type { Express, Request, Response } from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { storage } from '../storage';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';
import type { CropBounds } from '@shared/models/photos';
import { analyzePhoto } from '../photos/analyze';
import { isR2Enabled, r2Put, r2Delete } from '../r2-storage';

const PHOTOS_ROOT = path.join(process.cwd(), 'stored_images', 'photos');
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB of raw image data
const THUMBNAIL_SIZE = 400;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function getUserId(req: Request): string | null {
  const id = (req as any).session?.otpUserId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

// Decode a data URL or raw base64 string into a Buffer plus its reported MIME.
// Returns null if the payload is malformed or too large.
function decodeBase64Image(raw: string): { buffer: Buffer; mimeType: string | null } | null {
  const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = dataUrlMatch?.[1] ?? null;
  const base64 = dataUrlMatch ? dataUrlMatch[2] : raw;
  try {
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) return null;
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

// Given a MIME, return the extension we'll use on disk for the original.
function extForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic';
  return 'bin';
}

function validateCropBounds(bounds: unknown, width: number, height: number): CropBounds | null {
  if (!bounds || typeof bounds !== 'object') return null;
  const b = bounds as Record<string, unknown>;
  const x = Number(b.x);
  const y = Number(b.y);
  const w = Number(b.width);
  const h = Number(b.height);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  if (x < 0 || y < 0 || w <= 0 || h <= 0) return null;
  if (x + w > width || y + h > height) return null;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
}

export function registerPhotoRoutes(app: Express): void {
  // ── POST /api/photos/upload ─────────────────────────────────────────────
  // Body: { imageBase64, filename?, label?, cropBounds? }
  // cropBounds is optional here so the API stays flexible — the Studio UI
  // forces a crop step before calling this endpoint.
  app.post('/api/photos/upload', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
      const { imageBase64, filename, label, cropBounds } = req.body ?? {};

      if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
        return res.status(400).json({ message: 'imageBase64 is required' });
      }

      const decoded = decodeBase64Image(imageBase64);
      if (!decoded) {
        return res.status(400).json({ message: 'Invalid image data or too large (15 MB limit)' });
      }

      // Inspect the image to determine real format, dimensions, and reject
      // anything that isn't a supported raster image.
      const meta = await sharp(decoded.buffer).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (!width || !height) {
        return res.status(400).json({ message: 'Could not determine image dimensions' });
      }

      const formatToMime: Record<string, string> = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        heif: 'image/heic',
      };
      const resolvedMime = formatToMime[meta.format ?? ''] ?? decoded.mimeType ?? '';
      if (!ALLOWED_MIME.has(resolvedMime)) {
        return res.status(400).json({ message: `Unsupported image type: ${resolvedMime || 'unknown'}` });
      }

      // Validate the crop against the actual image dimensions before we
      // commit files to disk.
      const validCrop = cropBounds ? validateCropBounds(cropBounds, width, height) : null;
      if (cropBounds && !validCrop) {
        return res.status(400).json({ message: 'cropBounds is invalid or falls outside the image' });
      }

      // Create the user's photo directory on demand.
      const userDir = path.join(PHOTOS_ROOT, userId);
      await fs.mkdir(userDir, { recursive: true });

      // Insert a DB row first with provisional paths, then use the returned
      // id to name files on disk. This avoids racing two uploads over the
      // same filename.
      const ext = extForMime(resolvedMime);
      const provisional = await storage.createPhoto({
        userId,
        originalFilename: typeof filename === 'string' ? filename.slice(0, 200) : 'upload',
        storagePath: `photos/${userId}/pending.${ext}`,
        thumbnailPath: `photos/${userId}/pending_thumb.jpg`,
        croppedStoragePath: null,
        cropBounds: null,
        mimeType: resolvedMime,
        sizeBytes: decoded.buffer.length,
        width,
        height,
        label: typeof label === 'string' ? label.slice(0, 100) : null,
      });

      const photoId = provisional.id;
      const originalRel = `photos/${userId}/original_${photoId}.${ext}`;
      const thumbRel = `photos/${userId}/thumb_${photoId}.jpg`;
      const originalAbs = path.join(process.cwd(), 'stored_images', originalRel);
      const thumbAbs = path.join(process.cwd(), 'stored_images', thumbRel);

      // Write the original bytes verbatim so we don't re-encode.
      await fs.writeFile(originalAbs, decoded.buffer);
      // Mirror to R2 under the SAME relative key (audit 2026-07-27,
      // P0-1): Render's local disk is wiped on every deploy, and these
      // files are what generation reads — without the mirror, every
      // resumed draft/regen after a deploy failed with ENOENT. When R2
      // is on, the mirror is durable-or-error: an upload that would
      // silently break after the next deploy is worse than a retry.
      if (isR2Enabled()) {
        await r2Put(originalRel, decoded.buffer, resolvedMime);
      }

      // If the client supplied a crop, materialise the cropped derivative
      // now — providers receive this version at generation time, and we
      // also base the thumbnail on it so the UI reflects what the user
      // actually framed (rather than the full original, which made the
      // crop feel like it hadn't saved).
      let croppedRel: string | null = null;
      let thumbSourceBuffer: Buffer = decoded.buffer;
      if (validCrop) {
        croppedRel = `photos/${userId}/cropped_${photoId}.jpg`;
        const croppedAbs = path.join(process.cwd(), 'stored_images', croppedRel);
        const croppedBuffer = await sharp(decoded.buffer)
          .extract({
            left: validCrop.x,
            top: validCrop.y,
            width: validCrop.width,
            height: validCrop.height,
          })
          .jpeg({ quality: 92 })
          .toBuffer();
        await fs.writeFile(croppedAbs, croppedBuffer);
        if (isR2Enabled()) {
          await r2Put(croppedRel, croppedBuffer, 'image/jpeg');
        }
        thumbSourceBuffer = croppedBuffer;
      }

      // Generate the tile thumbnail from the cropped derivative when
      // available, otherwise from the original.
      //   • With a hand-chosen crop: PRESERVE the crop's own aspect ratio
      //     (fit:'inside'). Group crops are free-aspect (usually landscape),
      //     and squaring them here (the old fit:'cover') made a landscape
      //     crop show as a square tile — WYSIWYG broken. one-person crops
      //     are 1:1, so 'inside' still yields a square for them.
      //   • Without a crop: rough saliency square (position:'attention') —
      //     fine for an unframed original.
      const thumbPipeline = sharp(thumbSourceBuffer);
      if (validCrop) {
        thumbPipeline.resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'inside' });
      } else {
        thumbPipeline.resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
          fit: 'cover',
          position: 'attention',
        });
      }
      const thumbBuffer = await thumbPipeline.jpeg({ quality: 80 }).toBuffer();
      await fs.writeFile(thumbAbs, thumbBuffer);
      if (isR2Enabled()) {
        await r2Put(thumbRel, thumbBuffer, 'image/jpeg');
      }

      // Patch the row with real paths + crop metadata.
      const updated = await storage.updatePhoto(photoId, {
        storagePath: originalRel,
        thumbnailPath: thumbRel,
        croppedStoragePath: croppedRel,
        cropBounds: validCrop,
      });

      // Fire-and-forget vision analysis. Runs in the background after
      // we've already sent the response — the upload feels instant and
      // the inside-text helper picks up the summary by the time the
      // user reaches the inside step (typically a minute or two later).
      // Failure is logged inside analyzePhoto and doesn't affect the
      // upload outcome.
      const analyzeAbsPath = croppedRel
        ? path.join(process.cwd(), 'stored_images', croppedRel)
        : originalAbs;
      const analyzeMime = croppedRel ? 'image/jpeg' : resolvedMime;
      void analyzePhoto({
        photoId,
        imageAbsPath: analyzeAbsPath,
        mimeType: analyzeMime,
      });

      res.json(updated);
    } catch (err: any) {
      console.error('[PHOTOS] upload error:', err);
      res.status(500).json({ message: 'Upload failed: ' + (err?.message ?? String(err)) });
    }
  });

  // ── GET /api/user/photos ────────────────────────────────────────────────
  // List the caller's photos, newest first.
  app.get('/api/user/photos', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
      const list = await storage.getUserPhotos(userId);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: 'Failed to list photos: ' + (err?.message ?? String(err)) });
    }
  });

  // ── DELETE /api/photos/:id ──────────────────────────────────────────────
  // Hard-delete the photo row and its files on disk. Already-generated
  // cards that used this photo are unaffected — their output images live
  // separately under stored_images/ and don't point back at the source.
  app.delete('/api/photos/:id', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    const photoId = parseInt(req.params.id, 10);
    if (!Number.isFinite(photoId)) {
      return res.status(400).json({ message: 'Invalid photo id' });
    }

    try {
      const photo = await storage.getPhoto(photoId);
      if (!photo) return res.status(404).json({ message: 'Photo not found' });
      if (photo.userId !== userId) return res.status(403).json({ message: 'Not your photo' });

      // Remove files best-effort — missing files aren't an error, but
      // failing the DB delete on a disk I/O hiccup would orphan the row.
      const paths = [photo.storagePath, photo.thumbnailPath, photo.croppedStoragePath].filter(
        (p): p is string => typeof p === 'string' && p.length > 0,
      );
      for (const rel of paths) {
        const abs = path.join(process.cwd(), 'stored_images', rel);
        await fs.unlink(abs).catch(() => {});
        // Purge the R2 mirror too (uploads mirror there since the
        // 2026-07-27 durability fix) — a deleted photo must not linger
        // in the bucket. Best-effort, same as the disk unlink.
        if (isR2Enabled()) {
          await r2Delete(rel).catch(() => {});
        }
      }

      await storage.deletePhoto(photoId);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[PHOTOS] delete error:', err);
      res.status(500).json({ message: 'Delete failed: ' + (err?.message ?? String(err)) });
    }
  });
}
