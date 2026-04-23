// client/src/lib/face-count.ts
//
// Lightweight wrapper around @vladmandic/face-api's tinyFaceDetector.
// Used for two things in the Studio photo step:
//
//   1. Counting faces in an uploaded photo — so we can catch obvious
//      mode/photo mismatches ("you picked Just Sarah but this looks
//      like a group shot").
//   2. Returning the primary face's bounding box — so the crop dialog
//      can open pre-zoomed onto the face instead of centre-on-pixels.
//
// Design notes:
//   - Dynamic import + module-scoped cache. face-api pulls in tfjs,
//     which is chunky; we only load it when the photo step is reached.
//   - Swapped from the original `face-api.js` to @vladmandic/face-api
//     (actively maintained fork, ESM-native) after the former crashed
//     under Vite's runtime.
//   - Model weights served from /client/public/models/ as static assets.
//   - Heuristic only. `undefined` / `null` returns mean "don't nag the
//     user" — detection is best-effort, never blocking.

const MODEL_URL = '/models';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceApiModule: any | null = null;
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const mod = await import('@vladmandic/face-api');
      faceApiModule = mod;
      await mod.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    } catch (err) {
      faceApiModule = null;
      loadPromise = null;
      throw err;
    }
  })();
  return loadPromise;
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not load image for face detection'));
    el.src = dataUrl;
  });
}

// Small LRU of detection results keyed by dataURL. We run detection on
// queued multi-uploads in the background while the user is busy with the
// current photo — by the time CropDialog mounts the next one, the result
// is already cached and snap-to-face is instant. 10 slots is plenty:
// max upload batch is 5, so we'd never evict anything the user is about
// to see.
const MAX_CACHE = 10;
const resultCache = new Map<string, FaceDetectionResult | null>();
// Tracks in-flight detections so concurrent calls for the same dataURL
// share one promise instead of spawning parallel detectors.
const inFlight = new Map<string, Promise<FaceDetectionResult | null>>();

function cachePut(key: string, value: FaceDetectionResult | null): void {
  resultCache.set(key, value);
  if (resultCache.size > MAX_CACHE) {
    const firstKey = resultCache.keys().next().value;
    if (firstKey !== undefined) resultCache.delete(firstKey);
  }
}

/**
 * A face's bounding box in normalised image coordinates (0..1 on both
 * axes, relative to the original image size). The crop dialog uses the
 * same convention, so callers can pass this straight through.
 */
export interface FaceBounds {
  xNorm: number;
  yNorm: number;
  widthNorm: number;
  heightNorm: number;
}

export interface FaceDetectionResult {
  /** Count of faces detected. */
  count: number;
  /** Bounding box of the largest (likely primary) face, or null when
   *  no faces were detected. */
  primary: FaceBounds | null;
}

/**
 * Detect faces in an image. Returns `null` when detection isn't
 * available — model failed to load, image couldn't decode, tfjs blew
 * up, etc. Callers MUST treat null as "skip the nag / skip auto-crop",
 * not a real zero.
 *
 * Results are cached by dataURL — repeat calls (e.g. CropDialog mount
 * after a prefetch) return instantly.
 */
export async function detectFaces(dataUrl: string): Promise<FaceDetectionResult | null> {
  const cached = resultCache.get(dataUrl);
  if (cached !== undefined) return cached;
  const pending = inFlight.get(dataUrl);
  if (pending) return pending;

  const task = (async (): Promise<FaceDetectionResult | null> => {
    try {
      await ensureLoaded();
      if (!faceApiModule) return null;
      const faceapi = faceApiModule;
      const img = await loadImage(dataUrl);

      const detections = await faceapi.detectAllFaces(
        img,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.4,
        }),
      );

      if (detections.length === 0) {
        return { count: 0, primary: null };
      }

      // Pick the largest face by area — the "primary" subject when
      // there are multiple. The photo step will auto-crop to this in
      // one_person mode (group mode skips auto-crop — no single hero).
      let primaryBox:
        | { x: number; y: number; width: number; height: number }
        | null = null;
      let largestArea = 0;
      for (const det of detections) {
        const box = det.box; // { x, y, width, height } in image pixels
        const area = box.width * box.height;
        if (area > largestArea) {
          largestArea = area;
          primaryBox = box;
        }
      }

      const primary: FaceBounds | null =
        primaryBox && img.width > 0 && img.height > 0
          ? {
              xNorm: primaryBox.x / img.width,
              yNorm: primaryBox.y / img.height,
              widthNorm: primaryBox.width / img.width,
              heightNorm: primaryBox.height / img.height,
            }
          : null;

      return { count: detections.length, primary };
    } catch (err) {
      console.warn('[face-count] detection failed:', err);
      return null;
    }
  })();

  inFlight.set(dataUrl, task);
  const result = await task;
  inFlight.delete(dataUrl);
  cachePut(dataUrl, result);
  return result;
}

/**
 * Fire-and-forget prefetch. Use when you know the user will hit a given
 * image shortly (e.g. it's next in a multi-upload queue) — running
 * detection early while they're busy elsewhere means the subsequent
 * `detectFaces(sameUrl)` call returns from cache instantly. Cheap to
 * call multiple times; failures are swallowed.
 */
export function prefetchFaces(dataUrl: string): void {
  if (resultCache.has(dataUrl) || inFlight.has(dataUrl)) return;
  void detectFaces(dataUrl).catch(() => {
    // Swallowed — detectFaces already logs on real failures.
  });
}

/**
 * @deprecated Prefer `detectFaces` — this wrapper is kept for callers
 * that only need the count.
 */
export async function countFacesInDataUrl(
  dataUrl: string,
): Promise<number | undefined> {
  const result = await detectFaces(dataUrl);
  return result?.count;
}

/**
 * Fire-and-forget model preload. Call this when you know detection is
 * about to be needed — the user has reached a screen that will trigger
 * it shortly. On cold start the dynamic import + model fetch take
 * ~300-1500ms (dev is the heavy end); doing it early means the first
 * real call returns in ~50-150ms instead of waiting on the whole lot.
 *
 * Safe to call multiple times — internal promise cache deduplicates.
 * Failures are swallowed: detectFaces() handles retries on its own.
 */
export function prewarmFaceDetection(): void {
  void ensureLoaded().catch(() => {
    // Swallowed — detectFaces() logs its own errors on the real call.
  });
}
