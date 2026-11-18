/**
 * CHRISTMAS LOOK BENCH — the same ten Christmas briefs through the engine
 * twice: once on the old rules (`christmasLook: 'current'`), once on the
 * drawn Christmas (`'drawn'`: every card's PICTURE must read as Christmas
 * at a glance). Built 2026-11-18 for Aidan's before/after; 'drawn' became
 * production the same day, so 'current' is now the comparison arm.
 *
 *   npx tsx server/scripts/christmas-look-bench.ts <outDir> [--only current|drawn] [--parallel 4]
 *
 * Writes <outDir>/<arm>/<brief>.json (the set as returned) and
 * <outDir>/<arm>/<brief>-<1..3>.png (the three fronts). A set whose json
 * already exists is skipped, so a failed run can be resumed.
 *
 * The briefs are fixed on purpose and written the way a buyer types them.
 * Requests mirror the customer maker (client/src/pages/make.tsx): v2
 * pipeline, free composition, memory off, default render quality. They go
 * through the ADMIN door because that is the only door that may ask for
 * the old rule. Dev database only.
 */
import 'dotenv/config';
import { writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

const BRIEFS = [
  { id: 'dad', who: 'Dad', gender: 'him', age: 60, tone: 'funny', recipientName: 'Dave',
    interest: 'His shed, his air fryer, and what he paid for the house in 1994', dislikes: 'Self-service checkouts' },
  { id: 'mum', who: 'Mum', gender: 'her', age: 58, tone: 'warm',
    interest: 'Her garden, Strictly, and a proper cup of tea', dislikes: "People who don't RSVP" },
  { id: 'husband', who: 'Husband', gender: 'him', age: 41, tone: 'funny',
    interest: 'Cycling, his coffee machine, and fantasy football', dislikes: 'Slow walkers' },
  { id: 'nan', who: 'Nan', gender: 'her', age: 82, tone: 'warm',
    interest: 'Bingo on Tuesdays, her crossword, and feeding the birds' },
  { id: 'brother', who: 'Brother', gender: 'him', age: 34, tone: 'rude',
    interest: 'Five-a-side, his PlayStation, and never doing the washing up', dislikes: 'Losing' },
  { id: 'best-mate', who: 'Best mate', gender: 'her', age: 29, tone: 'mix',
    interest: 'Gin, true crime podcasts, and her sausage dog' },
  { id: 'grandad', who: 'Grandad', gender: 'him', age: 78, tone: 'funny',
    interest: 'His allotment, the horse racing, and falling asleep in front of the telly' },
  { id: 'daughter-8', who: 'Daughter', gender: 'her', age: 8, tone: 'funny',
    interest: 'Horses, slime, and her guinea pig Biscuit' },
  { id: 'wife', who: 'Wife', gender: 'her', age: 45, tone: 'warm',
    interest: 'Wild swimming, her book club, and the dog' },
  { id: 'colleague', who: 'Colleague', gender: 'unspecified', age: null, tone: 'funny',
    interest: 'Spreadsheets, oat flat whites, and the office plants' },
] as const;

type Arm = 'current' | 'drawn';

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function main(): Promise<void> {
  const outDir = process.argv[2];
  if (!outDir) { console.error('usage: christmas-look-bench.ts <outDir> [--only current|drawn] [--parallel n]'); process.exit(1); }
  const oi = process.argv.indexOf('--only');
  const arms: Arm[] = oi > -1 ? [process.argv[oi + 1] as Arm] : ['current', 'drawn'];
  const pi = process.argv.indexOf('--parallel');
  const parallel = pi > -1 ? Number(process.argv[pi + 1]) : 4;

  let adminId = process.env.LAB_ADMIN_USER_ID;
  if (!adminId) {
    const row = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).limit(1);
    adminId = row[0]?.id;
  }
  if (!adminId) throw new Error('No admin user in this database');

  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use((req: any, _res, next) => { req.session = { otpUserId: adminId }; next(); });
  registerAdminCardLabRoutes(app);
  const server = app.listen(0);
  const base = `http://localhost:${(server.address() as any).port}/api/admin/card-lab`;
  const post = async (route: string, body: unknown): Promise<any> => {
    const r = await fetch(`${base}/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${route} ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    return j;
  };

  const jobs: Array<{ arm: Arm; brief: (typeof BRIEFS)[number] }> = [];
  for (const brief of BRIEFS) for (const arm of arms) jobs.push({ arm, brief });
  let cents = 0;

  const runOne = async ({ arm, brief }: (typeof jobs)[number]): Promise<void> => {
    const dir = path.join(outDir, arm);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${brief.id}.json`);
    if (await exists(file)) { console.log(`skip ${arm}/${brief.id}`); return; }
    const t0 = Date.now();
    const { id, ...b } = brief;
    const set = await post('concepts', {
      ...b, age: b.age ?? undefined, occasion: 'Christmas', pipeline: 'celebrait', freeComposition: true, memory: false,
      christmasLook: arm,
    });
    const concepts: any[] = set.concepts ?? [];
    if (concepts.length !== 3) throw new Error(`${arm}/${id}: ${concepts.length} concepts`);
    cents += set.meter?.cents ?? 0;
    const renders = await Promise.all(concepts.map(async (c, i) => {
      try {
        const rj = await post('render', { front_text: c.front_text, art_direction: c.art_direction, palette: c.palette,
          typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true });
        const url: string = rj.imageUrl ?? rj.image ?? '';
        const buf = url.startsWith('data:')
          ? Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
          : Buffer.from(await (await fetch(url.startsWith('http') ? url : `http://localhost:${(server.address() as any).port}${url}`)).arrayBuffer());
        await writeFile(path.join(dir, `${id}-${i + 1}.png`), buf);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e).slice(0, 200) };
      }
    }));
    await writeFile(file, JSON.stringify({ arm, brief, concepts, violations: set.violations ?? [], meter: set.meter ?? null,
      archetype: set.archetype ?? null, renders }, null, 2), 'utf8');
    console.log(`done ${arm}/${id} in ${Math.round((Date.now() - t0) / 1000)}s rounds=${set.meter?.rounds} standing=${(set.violations ?? []).length} :: ${concepts.map((c) => `"${c.front_text}"`).join(' / ')}`);
  };

  // A small pool: sets are independent, and one at a time is half an hour.
  let next = 0;
  const failures: string[] = [];
  await Promise.all(Array.from({ length: parallel }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try { await runOne(job); }
      catch (e) { failures.push(`${job.arm}/${job.brief.id}: ${String(e).slice(0, 240)}`); console.warn(`FAILED ${job.arm}/${job.brief.id}:`, String(e).slice(0, 240)); }
    }
  }));

  console.log(`\nconcept spend this run: ${cents.toFixed(1)}c (renders are logged to the cost ledger separately)`);
  if (failures.length) console.log(`failures:\n${failures.join('\n')}`);
  // Generation-log inserts are fire-and-forget; give them time to land.
  await new Promise((r) => setTimeout(r, 2500));
  server.close();
  process.exit(failures.length ? 2 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
