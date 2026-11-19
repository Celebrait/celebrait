/**
 * FRONT WORD BENCH — does the buyer's front word land on ALL THREE fronts?
 * Built 2026-11-19 for Aidan's "if a user asks for the persons name on the
 * card, all 3 must serve with the name on". Six briefs that each choose a
 * front word (a role word, short names, a hard-to-spell one, a child's),
 * run through the engine the way the customer maker runs them.
 *
 *   npx tsx server/scripts/front-word-bench.ts <outDir> [--only one|all] [--parallel 3] [--brief <id>] [--briefs <file.json>]
 *
 * --no-render writes the three concepts only (no drawings): for measuring
 * the writing, the rounds and the wait, at about 5c a set.
 * --briefs swaps the six built-in briefs for a JSON array of the same
 * shape (how the landing page walls' example sets were made, 2026-11-19).
 *
 * Arm 'all' is production (every front carries the word); 'one' is the
 * rule it replaced, reachable only through the admin door. Default: 'all'
 * only. Writes <outDir>/<arm>/<brief>.json and <brief>-<1..3>.png; a set
 * whose json exists is skipped, so a failed run can be resumed.
 * Dev database only. Each set is about 5p of writing plus 3 drawings.
 */
import 'dotenv/config';
import { writeFile, mkdir, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

const BRIEFS = [
  { id: 'dad-role', occasion: 'Christmas', who: 'Dad', gender: 'him', age: 60, tone: 'funny', frontWord: 'Dad', recipientName: 'Dave',
    interest: 'His shed, his air fryer, and what he paid for the house in 1994' },
  { id: 'dad-name', occasion: 'Christmas', who: 'Dad', gender: 'him', age: 60, tone: 'funny', frontWord: 'Dave', recipientName: 'Dave',
    interest: 'His shed, his air fryer, and what he paid for the house in 1994' },
  { id: 'mum-linda', occasion: 'Birthday', who: 'Mum', gender: 'her', age: 58, tone: 'warm', frontWord: 'Linda', recipientName: 'Linda',
    interest: 'Her garden, Strictly, and a proper cup of tea' },
  { id: 'mate-siobhan', occasion: 'Birthday', who: 'Best mate', gender: 'her', age: 29, tone: 'mix', frontWord: 'Siobhan', recipientName: 'Siobhan',
    interest: 'Gin, true crime podcasts, and her sausage dog' },
  { id: 'husband-rob', occasion: 'Birthday', who: 'Husband', gender: 'him', age: 41, tone: 'funny', frontWord: 'Rob', recipientName: 'Rob',
    interest: 'Cycling, his coffee machine, and fantasy football' },
  { id: 'daughter-evie', occasion: 'Christmas', who: 'Daughter', gender: 'her', age: 8, tone: 'funny', frontWord: 'Evie', recipientName: 'Evie',
    interest: 'Horses, slime, and her guinea pig Biscuit' },
] as const;
type BenchBrief = { id: string; occasion: string; who: string; gender: string; age: number | null; tone: string; frontWord?: string; recipientName?: string; interest: string };

type Arm = 'one' | 'all';
const exists = async (p: string) => { try { await access(p); return true; } catch { return false; } };

async function main(): Promise<void> {
  const outDir = process.argv[2];
  if (!outDir) { console.error('usage: front-word-bench.ts <outDir> [--only one|all] [--parallel n] [--brief id]'); process.exit(1); }
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : undefined; };
  const arms: Arm[] = [(arg('--only') as Arm) ?? 'all'];
  const parallel = Number(arg('--parallel') ?? 3);
  const only = arg('--brief');
  const noRender = process.argv.includes('--no-render');

  const row = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).limit(1);
  const adminId = process.env.LAB_ADMIN_USER_ID ?? row[0]?.id;
  if (!adminId) throw new Error('No admin user in this database');

  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use((req: any, _res, next) => { req.session = { otpUserId: adminId }; next(); });
  registerAdminCardLabRoutes(app);
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const post = async (route: string, body: unknown): Promise<any> => {
    const r = await fetch(`http://localhost:${port}/api/admin/card-lab/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${route} ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    return j;
  };

  const briefsFile = arg('--briefs');
  const briefs: BenchBrief[] = briefsFile ? JSON.parse(await readFile(briefsFile, 'utf8')) : (BRIEFS as unknown as BenchBrief[]);
  const jobs = briefs.filter((b) => !only || b.id === only).flatMap((brief) => arms.map((arm) => ({ arm, brief })));
  let cents = 0;
  const runOne = async ({ arm, brief }: (typeof jobs)[number]): Promise<void> => {
    const dir = path.join(outDir, arm);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${brief.id}.json`);
    if (await exists(file)) { console.log(`skip ${arm}/${brief.id}`); return; }
    const t0 = Date.now();
    const { id, ...b } = brief;
    const set = await post('concepts', { ...b, age: b.age ?? undefined, pipeline: 'celebrait', freeComposition: true, memory: false, frontWordOn: arm });
    const concepts: any[] = set.concepts ?? [];
    if (concepts.length !== 3) throw new Error(`${arm}/${id}: ${concepts.length} concepts`);
    cents += set.meter?.cents ?? 0;
    const word = brief.frontWord ? new RegExp(`\\b${brief.frontWord}\\b`, 'i') : null;
    const carries = concepts.map((c) => (!word ? 'none asked' : word.test(c.front_text ?? '') ? 'words' : word.test(c.art_direction ?? '') ? 'artwork' : 'MISSING'));
    const renders = await Promise.all(concepts.map(async (c, i) => {
      if (noRender) return { ok: true, skipped: true };
      try {
        const rj = await post('render', { front_text: c.front_text, art_direction: c.art_direction, palette: c.palette,
          typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true });
        const url: string = rj.imageUrl ?? '';
        const buf = url.startsWith('data:')
          ? Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
          : Buffer.from(await (await fetch(url.startsWith('http') ? url : `http://localhost:${port}${url}`)).arrayBuffer());
        await writeFile(path.join(dir, `${id}-${i + 1}.png`), buf);
        return { ok: true };
      } catch (e) { return { ok: false, error: String(e).slice(0, 200) }; }
    }));
    await writeFile(file, JSON.stringify({ arm, brief, concepts, carries, violations: set.violations ?? [], meter: set.meter ?? null, renders }, null, 2), 'utf8');
    console.log(`done ${arm}/${id} in ${Math.round((Date.now() - t0) / 1000)}s rounds=${set.meter?.rounds} round1=${JSON.stringify((set.meter?.perRound?.[0] ?? []).map((v: string) => v.split(':')[0]))} standing=${JSON.stringify(set.violations ?? [])} carries=${carries.join('/')} :: ${concepts.map((c) => `"${c.front_text}"`).join(' / ')}`);
  };

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
  await new Promise((r) => setTimeout(r, 2500));
  server.close();
  process.exit(failures.length ? 2 : 0);
}
main().catch((err) => { console.error(err); process.exit(1); });
