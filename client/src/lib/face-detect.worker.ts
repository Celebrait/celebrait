// client/src/lib/face-detect.worker.ts — SSD MobileNet OFF the main thread.
//
// Launch audit 2026-10-06: face-api (tfjs import + 5.4MB weights + the
// inference itself) ran on the main thread and froze the photo step for
// ~5.5s after a photo was picked. Everything heavy now lives here; the
// page only decodes the photo to an ImageBitmap and posts it over.
//
// Protocol (see lib/face-count.ts for the other side):
//   in  { type: 'warm' }                                    → preload model
//   in  { type: 'detect', id, bitmap, minConfidence, maxResults }
//   out { type: 'detect', id, ok: true, width, height, boxes: [{x,y,width,height}] }
//   out { type: 'detect', id, ok: false, error }
//
// face-api decides "browser or node" from `window`/`document`, neither of
// which exist in a worker, so we hand it a worker-shaped environment
// first. Only `fetch` (model weights) is actually exercised: the image
// arrives as a tensor, so the Canvas/Image shims are never constructed.

import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = '/models';

type DetectMsg = { type: 'detect'; id: number; bitmap: ImageBitmap; minConfidence: number; maxResults: number };
type WarmMsg = { type: 'warm' };

const scope = self as unknown as {
  onmessage: ((ev: MessageEvent<DetectMsg | WarmMsg>) => void) | null;
  postMessage(msg: unknown): void;
};

const notAvailable = (what: string) => () => {
  throw new Error(`${what} is not available in the face-detection worker`);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(faceapi.env as any).setEnv({
  Canvas: OffscreenCanvas,
  CanvasRenderingContext2D: OffscreenCanvasRenderingContext2D,
  Image: class WorkerImageStub {},
  ImageData,
  Video: class WorkerVideoStub {},
  createCanvasElement: () => new OffscreenCanvas(1, 1),
  createImageElement: notAvailable('Image'),
  createVideoElement: notAvailable('Video'),
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
  readFile: notAvailable('readFile'),
});

let loadPromise: Promise<void> | null = null;
function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL).catch((err) => {
      loadPromise = null; // let a later call retry after a transient failure
      throw err;
    });
  }
  return loadPromise;
}

scope.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg.type === 'warm') {
    try { await ensureLoaded(); } catch { /* detect() reports the real error */ }
    return;
  }
  if (msg.type !== 'detect') return;
  const { id, bitmap, minConfidence, maxResults } = msg;
  try {
    await ensureLoaded();
    const width = bitmap.width;
    const height = bitmap.height;
    // fromPixels reads the ImageBitmap straight onto the backend (WebGL
    // via OffscreenCanvas where the browser allows it, CPU otherwise —
    // slower, but no longer anyone's problem: it's not the UI thread).
    const tensor = faceapi.tf.browser.fromPixels(bitmap);
    bitmap.close();
    let detections: Array<{ box: { x: number; y: number; width: number; height: number } }>;
    try {
      detections = await faceapi.detectAllFaces(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tensor as any,
        new faceapi.SsdMobilenetv1Options({ minConfidence, maxResults }),
      );
    } finally {
      tensor.dispose();
    }
    scope.postMessage({
      type: 'detect', id, ok: true, width, height,
      boxes: detections.map((d) => ({ x: d.box.x, y: d.box.y, width: d.box.width, height: d.box.height })),
    });
  } catch (err) {
    scope.postMessage({ type: 'detect', id, ok: false, error: String(err) });
  }
};
