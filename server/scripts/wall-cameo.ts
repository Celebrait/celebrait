/**
 * WALL CAMEO — redraw example cards "with them in it" for the landing page
 * walls (Aidan 2026-11-19). Each job takes a card from a bench set and a
 * portrait from wall-portraits.ts (a made-up person, nobody real) and runs
 * the card's own redraw: the same request the customer maker sends when a
 * buyer adds a photo (render with cameoPhoto + cameoMode 'redraw').
 *
 *   npx tsx server/scripts/wall-cameo.ts <jobs.json> [--parallel 4]
 *   jobs.json: [{ "set": "<set>.json", "card": 1..3, "photo": "<photo>.png", "out": "<out>.png" }]
 *
 * About 2.5c a card. A job whose out file exists is skipped. Dev database only.
 */
import 'dotenv/config';
import { readFile, writeFile, access } from 'node:fs/promises';
import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

interface Job { set: string; card: number; photo: string; out: string }
const exists = async (p: string) => { try { await access(p); return true; } catch { return false; } };

async function main() {
  const jobs: Job[] = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const pi = process.argv.indexOf('--parallel');
  const parallel = pi > -1 ? Number(process.argv[pi + 1]) : 4;
  const row = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).limit(1);
  const app = express();
  app.use(express.json({ limit: '30mb' }));
  app.use((req: any, _res, next) => { req.session = { otpUserId: row[0].id }; next(); });
  registerAdminCardLabRoutes(app);
  const server = app.listen(0);
  const port = (server.address() as any).port;
  let next = 0; let failed = 0;
  await Promise.all(Array.from({ length: parallel }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        if (await exists(job.out)) { console.log('skip', job.out); continue; }
        const c = JSON.parse(await readFile(job.set, 'utf8')).concepts[job.card - 1];
        const mime = /\.jpe?g$/i.test(job.photo) ? 'image/jpeg' : 'image/png';
        const photo = `data:${mime};base64,${(await readFile(job.photo)).toString('base64')}`;
        const r = await fetch(`http://localhost:${port}/api/admin/card-lab/render`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ front_text: c.front_text, art_direction: c.art_direction, palette: c.palette, typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true, cameoPhoto: photo, cameoMode: 'redraw' }) });
        const j: any = await r.json();
        if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 200)}`);
        const url: string = j.imageUrl ?? '';
        const buf = url.startsWith('data:') ? Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
          : Buffer.from(await (await fetch(url.startsWith('http') ? url : `http://localhost:${port}${url}`)).arrayBuffer());
        await writeFile(job.out, buf);
        console.log('ok', job.out.split('/').pop(), `"${c.front_text}"`);
      } catch (e) { failed++; console.log('FAILED', job.out.split('/').pop(), String(e).slice(0, 200)); }
    }
  }));
  await new Promise((r) => setTimeout(r, 2500));
  server.close();
  process.exit(failed ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
