// server/r2-storage.ts
//
// Cloudflare R2 object storage for persistent images (card renders, and
// later user photos). R2 is S3-compatible; we talk to it with aws4fetch
// (tiny, fetch-based — Cloudflare's recommended R2 client).
//
// WHY: card images were written to Render's LOCAL disk (stored_images/),
// which the free plan wipes on EVERY deploy — so old cards lost their
// artwork and the viewer dead-ended. R2 decouples storage from the web
// instance: images survive deploys/restarts/scaling, and are served
// straight from a Cloudflare-fronted public URL (CDN-cached, off our box).
//
// FLAG-GATED: if the five R2_* env vars aren't all set, isR2Enabled()
// returns false and every storage path falls back to the original local
// disk behaviour — so this whole module is a no-op until configured.
//
// Required env (set on Render; create a free Cloudflare account + bucket
// + an S3 API token, and a public bucket URL / custom domain):
//   R2_ACCOUNT_ID         — Cloudflare account id
//   R2_ACCESS_KEY_ID      — R2 S3 API token access key
//   R2_SECRET_ACCESS_KEY  — R2 S3 API token secret
//   R2_BUCKET             — bucket name
//   R2_PUBLIC_URL         — public base URL for the bucket (no trailing /),
//                           e.g. https://images.celebrait.co.uk or the
//                           https://pub-xxxx.r2.dev dev URL. This is what
//                           gets served to browsers (CDN-cached).

import { AwsClient } from 'aws4fetch';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;
// Normalise the public base URL. A value entered without a scheme
// ("img.celebrait.co.uk") would make every stored image URL RELATIVE —
// the browser resolves it against the app origin and every card image
// 404s, on new cards only. Cheap to defend against, brutal to debug
// (Aidan + a live customer, 2026-08-04).
const PUBLIC_URL = (() => {
  // Strip trailing slashes AND stray trailing punctuation. A copied
  // sentence can carry its full stop into the env var —
  // "https://img.example.com." fails TLS (the cert covers the undotted
  // host), so every image dies silently (Aidan + a live customer,
  // 2026-08-04). Cheap to defend, expensive to diagnose.
  const raw = process.env.R2_PUBLIC_URL?.trim().replace(/[./\s]+$/, '');
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  console.warn(
    `[R2] R2_PUBLIC_URL has no scheme ("${raw}") — assuming https://. ` +
      'Set the full URL (https://img.example.com) to silence this.',
  );
  return `https://${raw}`;
})();

export function isR2Enabled(): boolean {
  return Boolean(
    ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET && PUBLIC_URL,
  );
}

let _client: AwsClient | null = null;
function client(): AwsClient {
  if (!_client) {
    _client = new AwsClient({
      accessKeyId: ACCESS_KEY_ID!,
      secretAccessKey: SECRET_ACCESS_KEY!,
      service: 's3',
      region: 'auto',
    });
  }
  return _client;
}

/** Per-segment encode so nested keys (photos/<userId>/file.png) keep their
 *  slashes but special characters in a segment are escaped. */
function encodeKey(key: string): string {
  return key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function objectUrl(key: string): string {
  return `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/${encodeKey(key)}`;
}

/** The browser-facing URL for a stored key — served via the Cloudflare
 *  public bucket / custom domain (CDN-cached). */
export function r2PublicUrl(key: string): string {
  return `${PUBLIC_URL}/${encodeKey(key)}`;
}

export async function r2Put(
  key: string,
  body: Buffer,
  contentType = 'image/png',
): Promise<void> {
  const res = await client().fetch(objectUrl(key), {
    method: 'PUT',
    body: new Uint8Array(body),
    // Every key is content-addressed (uuid / imageKey names, never
    // rewritten in place) so a year-long immutable edge cache is safe —
    // measured 2026-08-28: the zone default was 4h, so the long tail of
    // catalogue images was a perpetual CDN MISS (0.46s vs 0.11s TTFB).
    headers: { 'content-type': contentType, 'cache-control': 'public, max-age=31536000, immutable' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`R2 put ${key} failed: ${res.status} ${detail}`);
  }
}

export async function r2Get(key: string): Promise<Buffer | null> {
  const res = await client().fetch(objectUrl(key), { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`R2 get ${key} failed: ${res.status}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/** Server-side copy (no download/upload round-trip) via S3 x-amz-copy-source.
 *  Returns false on failure so callers can treat it as a soft no-op. */
export async function r2Copy(srcKey: string, destKey: string): Promise<boolean> {
  try {
    const res = await client().fetch(objectUrl(destKey), {
      method: 'PUT',
      headers: { 'x-amz-copy-source': `/${BUCKET}/${encodeKey(srcKey)}` },
    });
    return res.ok;
  } catch (err: any) {
    console.warn(`[R2] copy ${srcKey} → ${destKey} failed: ${err?.message ?? err}`);
    return false;
  }
}

/** Delete a single object. S3 DELETE is idempotent — a missing key still
 *  returns 204 — so this only throws on a real error, not a 404. */
export async function r2Delete(key: string): Promise<void> {
  const res = await client().fetch(objectUrl(key), { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    const detail = await res.text().catch(() => '');
    throw new Error(`R2 delete ${key} failed: ${res.status} ${detail}`);
  }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** List every object key under a prefix (ListObjectsV2, paginated). We parse
 *  the S3 XML with a regex rather than pulling in an XML lib — keys are our
 *  own flat `card_<id>_*` filenames, so this stays simple and dependency-free. */
export async function r2List(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const params = new URLSearchParams({ 'list-type': '2', prefix });
    if (token) params.set('continuation-token', token);
    const url = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/?${params.toString()}`;
    const res = await client().fetch(url, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`R2 list ${prefix} failed: ${res.status}`);
    }
    const xml = await res.text();
    for (const m of Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g))) {
      keys.push(decodeXmlEntities(m[1]));
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1]
      : undefined;
  } while (token);
  return keys;
}

/** Delete every object under a prefix. Returns how many were removed.
 *  NB the trailing `_` in a `card_<id>_` prefix disambiguates card 2 from
 *  card 20/234 — string-prefix matching alone would not. */
export async function r2DeleteByPrefix(prefix: string): Promise<number> {
  const keys = await r2List(prefix);
  for (const key of keys) await r2Delete(key);
  return keys.length;
}
