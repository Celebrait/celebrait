// client/src/lib/guest-photos.ts — THE GUEST PHOTO STORE
//
// The public photo maker (/photo/make, 2026-09-04) lets a signed-out
// visitor crop a photo and see its likeness verdict BEFORE they have an
// account. Nothing is stored on the server for a guest: the bytes stay
// in this browser (IndexedDB, so a Google sign-in's full-page redirect
// survives), the verdict comes from the stateless POST /api/photos/assess,
// and the real upload happens after sign-up when the page transfers the
// draft into the studio.
//
// The store hands PhotoStep rows in the SAME shape as /api/user/photos
// (shared Photo type) so the step's tiles, polling gate and likeness
// notes run unchanged. Guest ids are negative so they can never collide
// with a real photo id; thumbnails are data: URLs (see photoThumbSrc).

import { createContext, useContext, useSyncExternalStore } from 'react';
import type { CropBounds, Photo } from '@shared/models/photos';
import { toast } from '@/hooks/use-toast';

const DB_NAME = 'celebrait-guest-photos';
const STORE = 'photos';
const THUMB = 400;
/** Long edge the held original is capped at. The studio path never
 *  holds more than one original in memory; this path holds up to five,
 *  so they are downscaled first (2048px is plenty for the crop the
 *  generator receives). Crop bounds are scaled to match. */
const MAX_EDGE = 2048;
/** A guest's photos are theirs, not ours: anything older than this is
 *  dropped on the next load (a shared or public machine must not keep
 *  someone's face around). */
const TTL_MS = 24 * 60 * 60 * 1000;

export interface GuestPhotoBlob {
  imageBase64: string;
  filename: string;
  cropBounds: CropBounds;
}

interface Record_ {
  id: number;
  row: Photo;
  blob: GuestPhotoBlob;
}

// ── Context: is this PhotoStep running for a guest? ───────────────────
export const GuestPhotoContext = createContext(false);
export const useIsGuestPhotos = () => useContext(GuestPhotoContext);

// ── Tiny IndexedDB wrapper ─────────────────────────────────────────────
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function idbAll(): Promise<Record_[]> {
  const db = await openDb(); if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as Record_[]) ?? []);
    req.onerror = () => resolve([]);
  });
}
async function idbPut(r: Record_): Promise<void> {
  const db = await openDb(); if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(r);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
async function idbDelete(id: number): Promise<void> {
  const db = await openDb(); if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
async function idbClear(): Promise<void> {
  const db = await openDb(); if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

// ── In-memory mirror + subscribers (useSyncExternalStore) ─────────────
let records: Record_[] = [];
let rows: Photo[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  rows = records.map((r) => r.row);
  for (const l of Array.from(listeners)) l();
}
function ensureLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = idbAll().then((all) => {
      // Dates come back as Dates from IDB (structured clone) — fine.
      const cutoff = Date.now() - TTL_MS;
      const fresh = all.filter((r) => new Date(r.row.createdAt as unknown as string | Date).getTime() > cutoff);
      for (const r of all) if (!fresh.includes(r)) void idbDelete(r.id);
      records = fresh.sort((a, b) => b.id - a.id).reverse();
      loaded = true;
      emit();
    });
  }
  return loading;
}
function subscribe(l: () => void) {
  listeners.add(l);
  void ensureLoaded();
  return () => { listeners.delete(l); };
}
const getSnapshot = () => rows;

/** The guest's photo rows, in upload order. Loads from IndexedDB on
 *  first use (empty until then, then re-renders). */
export function useGuestPhotos(): Photo[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Thumbnail src for any photo row: guest rows carry a data: URL in
 *  thumbnailPath; server rows carry a storage-relative path. */
export function photoThumbSrc(p: Pick<Photo, 'thumbnailPath'>): string {
  return p.thumbnailPath.startsWith('data:') ? p.thumbnailPath : `/images/${p.thumbnailPath}`;
}

// ── Crop + thumbnail in the browser ───────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}
async function makeThumb(src: string, b: CropBounds): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(src);
  const scale = Math.min(1, THUMB / Math.max(b.width, b.height));
  const w = Math.max(1, Math.round(b.width * scale));
  const h = Math.max(1, Math.round(b.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.drawImage(img, b.x, b.y, b.width, b.height, 0, 0, w, h);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: img.naturalWidth, height: img.naturalHeight };
}

let nextId = -Date.now();

/** Cap the held original at MAX_EDGE on its long side (JPEG), scaling
 *  the crop bounds with it. Anything already small passes through. */
async function downscale(b: GuestPhotoBlob): Promise<GuestPhotoBlob> {
  const src = b.imageBase64.startsWith('data:') ? b.imageBase64 : `data:image/jpeg;base64,${b.imageBase64}`;
  const img = await loadImage(src);
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  if (long <= MAX_EDGE) return { ...b, imageBase64: src };
  const f = MAX_EDGE / long;
  const w = Math.max(1, Math.round(img.naturalWidth * f));
  const h = Math.max(1, Math.round(img.naturalHeight * f));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ...b, imageBase64: src };
  ctx.drawImage(img, 0, 0, w, h);
  const x = Math.min(w - 1, Math.max(0, Math.round(b.cropBounds.x * f)));
  const y = Math.min(h - 1, Math.max(0, Math.round(b.cropBounds.y * f)));
  const cw = Math.max(1, Math.min(w - x, Math.round(b.cropBounds.width * f)));
  const ch = Math.max(1, Math.min(h - y, Math.round(b.cropBounds.height * f)));
  return {
    imageBase64: canvas.toDataURL('image/jpeg', 0.92),
    filename: b.filename.replace(/\.(heic|heif|png|webp)$/i, '.jpg'),
    cropBounds: { x, y, width: cw, height: ch },
  };
}

/** Mirror of POST /api/photos/upload for a guest: builds the row here,
 *  keeps the bytes in IndexedDB, and asks the server for the verdict
 *  without storing anything. Resolves as soon as the row exists (the
 *  verdict lands a few seconds later, exactly like the upload path). */
export async function guestUpload(input: GuestPhotoBlob): Promise<Photo> {
  await ensureLoaded();
  const id = nextId--;
  const args = await downscale(input);
  const src = args.imageBase64;
  const mime = src.match(/^data:([^;]+);/)?.[1] ?? 'image/jpeg';
  const { dataUrl, width, height } = await makeThumb(src, args.cropBounds);
  const row: Photo = {
    id,
    userId: 'guest',
    originalFilename: args.filename,
    storagePath: '',
    croppedStoragePath: null,
    cropBounds: args.cropBounds,
    thumbnailPath: dataUrl,
    mimeType: mime,
    sizeBytes: Math.round((src.length * 3) / 4),
    width,
    height,
    label: null,
    personCount: null,
    visualSummary: null,
    analyzedAt: null,
    likeness: null,
    createdAt: new Date(),
  };
  const rec: Record_ = { id, row, blob: args };
  records = [...records, rec];
  emit();
  void idbPut(rec);

  // The verdict, off the critical path. Any failure (cap hit, model
  // down) stamps analyzedAt so the step's 30s gate fails open, as the
  // server path does — but SAY so, once, rather than showing no traffic
  // light and leaving the user to wonder.
  void (async () => {
    let patch: Partial<Photo> = { analyzedAt: new Date() };
    let checked = false;
    try {
      const r = await fetch('/api/photos/assess', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: args.imageBase64, cropBounds: args.cropBounds }),
      });
      if (r.ok) {
        const j = await r.json();
        patch = { likeness: j.likeness ?? null, analyzedAt: new Date(j.analyzedAt ?? Date.now()) };
        checked = !!j.likeness;
      }
    } catch { /* fail open */ }
    if (!checked) {
      toast({
        title: "We couldn't check that photo this time",
        description: 'You can carry on — we look at it properly when we draw. A clear, front-on face works best.',
      });
    }
    const cur = records.find((x) => x.id === id);
    if (!cur) return;
    const updated: Record_ = { ...cur, row: { ...cur.row, ...patch } };
    records = records.map((x) => (x.id === id ? updated : x));
    emit();
    void idbPut(updated);
  })();

  return row;
}

export async function removeGuestPhoto(id: number): Promise<void> {
  records = records.filter((r) => r.id !== id);
  emit();
  await idbDelete(id);
}

/** The bytes the transfer uploads after sign-up, keyed by guest id. */
export async function getGuestPhotoBlobs(): Promise<Map<number, GuestPhotoBlob>> {
  await ensureLoaded();
  return new Map(records.map((r) => [r.id, r.blob]));
}

export async function clearGuestPhotos(): Promise<void> {
  records = [];
  emit();
  await idbClear();
}

/** "Close" on the public maker: the visitor is leaving, so nothing of
 *  theirs stays behind in this browser. */
export async function discardGuestSession(): Promise<void> {
  await clearGuestPhotos();
}
