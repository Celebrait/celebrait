// server/scripts/test-photos.ts
//
// End-to-end test for the photo library endpoints. Generates a test image,
// logs in via the DEV_AUTH_ACCEPT_ANY_CODE bypass, exercises upload → list
// → delete → list, and prints each step.
//
// Prereqs:
//   - Dev server running at http://localhost:5050 (or pass --url)
//   - DEV_AUTH_ACCEPT_ANY_CODE=1 in the server's env (default in .env.local)
//
// Usage:
//   npx tsx server/scripts/test-photos.ts <email>
//   npx tsx server/scripts/test-photos.ts <email> --keep   # don't delete at the end
//   npx tsx server/scripts/test-photos.ts <email> --url http://localhost:3000
//
// Example:
//   npx tsx server/scripts/test-photos.ts aidan@example.com

import 'dotenv/config';
import sharp from 'sharp';

const DEFAULT_URL = 'http://localhost:5050';
const BYPASS_CODE = '123456';

interface CliOpts {
  email: string;
  baseUrl: string;
  keep: boolean;
}

function parseArgs(): CliOpts {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage:');
    console.log('  npx tsx server/scripts/test-photos.ts <email>');
    console.log('  npx tsx server/scripts/test-photos.ts <email> --keep');
    console.log('  npx tsx server/scripts/test-photos.ts <email> --url http://localhost:3000');
    process.exit(args.length === 0 ? 1 : 0);
  }
  const email = args[0];
  const urlIdx = args.indexOf('--url');
  const baseUrl = urlIdx !== -1 && args[urlIdx + 1] ? args[urlIdx + 1].replace(/\/$/, '') : DEFAULT_URL;
  const keep = args.includes('--keep');
  return { email, baseUrl, keep };
}

// Extract the session cookie from a Set-Cookie header so we can include it
// on subsequent requests.
function extractSessionCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const match = setCookie.match(/(connect\.sid=[^;]+)/);
  return match ? match[1] : null;
}

async function logIn(baseUrl: string, email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: BYPASS_CODE }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Login failed (${res.status}): ${body}\n` +
        `— is DEV_AUTH_ACCEPT_ANY_CODE=1 set on the server? Check startup logs for the banner.`,
    );
  }

  const cookie = extractSessionCookie(res.headers.get('set-cookie'));
  if (!cookie) throw new Error('Login succeeded but no session cookie was returned');

  const data = (await res.json()) as { user: { id: string; email: string } };
  console.log(`  logged in as ${data.user.email} (id=${data.user.id})`);
  return cookie;
}

async function generateTestImageBase64(): Promise<{ base64: string; width: number; height: number }> {
  const width = 800;
  const height = 800;
  // Build a recognisable image: a magenta square with a white disc in the
  // middle. Makes the crop visually easy to verify when you open the file.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#d946ef"/>
      <circle cx="400" cy="400" r="220" fill="#ffffff"/>
      <text x="400" y="420" text-anchor="middle" font-family="sans-serif" font-size="48" fill="#d946ef">TEST</text>
    </svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    base64: `data:image/png;base64,${buf.toString('base64')}`,
    width,
    height,
  };
}

// Shared helper: parses JSON, or throws a friendly error if the server
// returned HTML (which means the route isn't registered yet — usually
// because the dev server wasn't restarted after code changes).
async function parseJsonOrExplain(res: Response, label: string): Promise<any> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw new Error(
      `${label} returned HTML instead of JSON (status ${res.status}). ` +
        `The server is running old code — the photo routes aren't registered. ` +
        `Fix: Ctrl+C the dev server, then run 'npm run dev' again, then re-run this script.`,
    );
  }
  if (!res.ok) {
    throw new Error(`${label} failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function uploadPhoto(baseUrl: string, cookie: string, imageBase64: string) {
  const res = await fetch(`${baseUrl}/api/photos/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      imageBase64,
      filename: 'test-photo.png',
      label: 'Test (script)',
      // Centre crop so the white disc is fully contained.
      cropBounds: { x: 150, y: 150, width: 500, height: 500 },
    }),
  });
  return parseJsonOrExplain(res, 'Upload');
}

async function listPhotos(baseUrl: string, cookie: string) {
  const res = await fetch(`${baseUrl}/api/user/photos`, { headers: { Cookie: cookie } });
  return (await parseJsonOrExplain(res, 'List')) as any[];
}

async function deletePhoto(baseUrl: string, cookie: string, id: number) {
  const res = await fetch(`${baseUrl}/api/photos/${id}`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  return parseJsonOrExplain(res, 'Delete');
}

async function main(): Promise<void> {
  const { email, baseUrl, keep } = parseArgs();

  console.log(`\n▶ Photo library end-to-end test`);
  console.log(`  server: ${baseUrl}`);
  console.log(`  user:   ${email}${keep ? '  (--keep, won\'t delete at end)' : ''}\n`);

  // Fail early if the server isn't up — the error from fetch is unhelpful.
  try {
    await fetch(`${baseUrl}/api/auth/user`, { method: 'GET' });
  } catch {
    console.error(`✗ Can't reach ${baseUrl}. Is the dev server running? ('rs' or 'npm run dev')`);
    process.exit(1);
  }

  console.log('1/5  Logging in via DEV bypass');
  const cookie = await logIn(baseUrl, email);

  console.log('\n2/5  Generating a test image (800×800 magenta+disc)');
  const { base64 } = await generateTestImageBase64();
  const approxKb = Math.round((base64.length * 3) / 4 / 1024);
  console.log(`  ~${approxKb} KB base64 payload`);

  console.log('\n3/5  Uploading with centre crop (500×500 from offset 150,150)');
  const uploaded = await uploadPhoto(baseUrl, cookie, base64);
  console.log(`  ✓ photo id=${uploaded.id}`);
  console.log(`    original:   ${uploaded.storagePath}`);
  console.log(`    cropped:    ${uploaded.croppedStoragePath}`);
  console.log(`    thumbnail:  ${uploaded.thumbnailPath}`);
  console.log(`    dimensions: ${uploaded.width}×${uploaded.height}`);
  console.log(`    cropBounds: ${JSON.stringify(uploaded.cropBounds)}`);

  console.log('\n4/5  Listing library');
  const list = await listPhotos(baseUrl, cookie);
  console.log(`  ✓ ${list.length} photo(s)`);
  for (const p of list) {
    console.log(`    - id=${p.id}  ${p.originalFilename}  (${p.width}×${p.height}, ${p.label ?? 'no label'})`);
  }

  if (keep) {
    console.log('\n5/5  Skipping delete (--keep)');
    console.log(`\n✓ Done. Photo id=${uploaded.id} left in the library.`);
    console.log(`  Files on disk:`);
    console.log(`    stored_images/${uploaded.storagePath}`);
    if (uploaded.croppedStoragePath) console.log(`    stored_images/${uploaded.croppedStoragePath}`);
    console.log(`    stored_images/${uploaded.thumbnailPath}`);
    return;
  }

  console.log('\n5/5  Deleting the photo');
  await deletePhoto(baseUrl, cookie, uploaded.id);
  const after = await listPhotos(baseUrl, cookie);
  const stillThere = after.find((p: any) => p.id === uploaded.id);
  if (stillThere) {
    console.error('  ✗ Photo still appears in the library after delete');
    process.exit(1);
  }
  console.log(`  ✓ photo removed, library now has ${after.length} item(s)`);

  console.log('\n✓ All steps passed.');
}

main().catch((err) => {
  console.error('\n✗ Test failed:', err?.message ?? err);
  process.exit(1);
});
