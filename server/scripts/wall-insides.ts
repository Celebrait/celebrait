/**
 * WALL INSIDES — draw the inside of each example card on a landing page wall
 * (Aidan 2026-11-26: the carousel cards opened onto a blank page; "unless you
 * can create insides for them" ... "Yeah go for it, start with the Christmas
 * ones"). Each job is one card: the words for its inside and the look of its
 * front, sent as the same request the customer maker sends when a buyer
 * writes their own message (render-inside, mode 'own', free style).
 *
 *   npx tsx server/scripts/wall-insides.ts <jobs.json> <outDir> [--parallel 4] [--only 3,7]
 *   jobs.json: [{ "n": 1, "dear": "...", "message": "...", "from": "...",
 *                 "palette": "...", "typeface": "...", "art_direction": "...", "direction": "..." }]
 *
 * Writes <outDir>/<nn>.png. About 1.7c a card at the maker's own quality.
 * A job whose file exists is skipped, so one card can be redrawn by deleting
 * its file. Dev database only. NOBODY in these messages is real: the names
 * are ours, like the names on the fronts.
 */
import 'dotenv/config';
import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

interface Job { n: number; dear: string; message: string; from: string; palette: string; typeface: string; art_direction: string; direction: string }
const exists = async (p: string) => { try { await access(p); return true; } catch { return false; } };

async function main() {
  const jobs: Job[] = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const outDir = process.argv[3];
  if (!outDir) { console.error('usage: wall-insides.ts <jobs.json> <outDir> [--parallel n] [--only 1,2]'); process.exit(1); }
  await mkdir(outDir, { recursive: true });
  const pi = process.argv.indexOf('--parallel');
  const parallel = pi > -1 ? Number(process.argv[pi + 1]) : 4;
  const oi = process.argv.indexOf('--only');
  const only = oi > -1 ? new Set(process.argv[oi + 1].split(',').map(Number)) : null;
  const todo = jobs.filter((j) => !only || only.has(j.n));
  const row = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).limit(1);
  const app = express();
  app.use(express.json({ limit: '30mb' }));
  app.use((req: any, _res, next) => { req.session = { otpUserId: row[0].id }; next(); });
  registerAdminCardLabRoutes(app);
  const server = app.listen(0);
  const port = (server.address() as any).port;
  let next = 0; let failed = 0; let cost = 0;
  await Promise.all(Array.from({ length: parallel }, async () => {
    while (next < todo.length) {
      const job = todo[next++];
      const out = path.join(outDir, `${String(job.n).padStart(2, '0')}.png`);
      try {
        if (await exists(out)) { console.log('skip', job.n); continue; }
        // Exactly the maker's body (client/src/pages/make.tsx, renderInside).
        const body = { mode: 'own', message: [job.dear, job.message, job.from].join('\n\n'), palette: job.palette, typeface: job.typeface,
          art_direction: job.art_direction, characters: 'objects', freeStyle: true, direction: job.direction };
        const r = await fetch(`http://localhost:${port}/api/admin/card-lab/render-inside`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j: any = await r.json();
        if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 200)}`);
        const url: string = j.imageUrl ?? '';
        const buf = url.startsWith('data:') ? Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
          : Buffer.from(await (await fetch(url.startsWith('http') ? url : `http://localhost:${port}${url}`)).arrayBuffer());
        await writeFile(out, buf);
        cost += Number(j.costUsd ?? 0);
        console.log('ok', job.n, `$${Number(j.costUsd ?? 0).toFixed(4)}`, `${Math.round((j.durationMs ?? 0) / 1000)}s`);
      } catch (e) { failed++; console.log('FAILED', job.n, String(e).slice(0, 200)); }
    }
  }));
  console.log(`total $${cost.toFixed(4)}, failed ${failed}`);
  await new Promise((r) => setTimeout(r, 2500));
  server.close();
  process.exit(failed ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
