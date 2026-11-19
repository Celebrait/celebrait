/**
 * SENSE JUDGE BENCH — is the sense referee worth trusting, and would a
 * newer model do the job better? Built 2026-11-19 after a day of bench
 * sets showed every set going to a repair round and most still carrying
 * a sense note afterwards.
 *
 * Takes finished sets (the JSON files front-word-bench.ts writes), and
 * for each model runs the PRODUCTION sense prompt over every set, more
 * than once, with exactly the request the live referee sends. Nothing is
 * written, drawn or repaired: it only judges cards that already exist.
 *
 *   npx tsx server/scripts/sense-judge-bench.ts <out.json> --sets <dir>[,<dir>...] --models a,b,c [--runs 2] [--parallel 8] [--limit n] [--effort low|medium|high]
 *
 * --effort sends reasoning_effort (the live referee sends none unless
 * CONCEPT_HELPER_EFFORT is set): the newer models think for longer by
 * default, which is where their extra seconds go.
 *
 * Per model it reports: how many cards it flags, how often two runs of the
 * SAME model agree about a card (a judge that changes its mind is noise),
 * how often it agrees with the first model listed (the baseline), and the
 * median seconds and tokens per call. out.json keeps every verdict so a
 * human's marks can be laid against it afterwards.
 */
import 'dotenv/config';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { senseSystemPrompt } from '../routes/admin-card-lab';

interface SetFile { brief: { id: string; age: number | null; interest: string }; concepts: Array<{ front_text: string; art_direction?: string }> }
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : undefined; };
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

async function main() {
  const out = process.argv[2];
  const dirs = (arg('--sets') ?? '').split(',').filter(Boolean);
  const models = (arg('--models') ?? 'gpt-5.4').split(',').filter(Boolean);
  const runs = Number(arg('--runs') ?? 2);
  const parallel = Number(arg('--parallel') ?? 8);
  const limit = Number(arg('--limit') ?? 0);
  const effort = arg('--effort') as 'low' | 'medium' | 'high' | undefined;
  if (!out || !dirs.length) { console.error('usage: sense-judge-bench.ts <out.json> --sets dir[,dir] --models a,b [--runs 2]'); process.exit(1); }

  let sets: Array<{ key: string; s: SetFile }> = [];
  for (const d of dirs) for (const f of (await readdir(d)).filter((x) => x.endsWith('.json')).sort()) {
    sets.push({ key: `${path.basename(path.dirname(d))}/${path.basename(d)}/${f.replace('.json', '')}`, s: JSON.parse(await readFile(path.join(d, f), 'utf8')) });
  }
  if (limit) sets = sets.slice(0, limit);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  type Verdict = { model: string; run: number; set: string; flagged: boolean[]; notes: string[][]; ms: number; inTok: number; outTok: number; error?: string };
  const jobs: Array<{ model: string; run: number; key: string; s: SetFile }> = [];
  for (const model of models) for (let run = 0; run < runs; run++) for (const { key, s } of sets) jobs.push({ model, run, key, s });
  const verdicts: Verdict[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: parallel }, async () => {
    while (next < jobs.length) {
      const j = jobs[next++];
      const t0 = Date.now();
      try {
        // Exactly the live referee's request (v2SenseCheck + helperParams).
        const r = await client.chat.completions.create({
          model: j.model, max_completion_tokens: 2800, ...(effort ? { reasoning_effort: effort } : {}),
          messages: [
            { role: 'system', content: senseSystemPrompt(j.s.brief.age, j.s.brief.interest, true) },
            { role: 'user', content: j.s.concepts.map((c, i) => `${i + 1}. FRONT: ${c.front_text}\n   ARTWORK: ${String(c.art_direction ?? '').slice(0, 160)}`).join('\n') },
          ],
          response_format: { type: 'json_object' },
        });
        const parsed = JSON.parse(r.choices[0]?.message?.content ?? '{}');
        const cards: any[] = Array.isArray(parsed.cards) ? parsed.cards : [];
        const notes = j.s.concepts.map((_, i) => (Array.isArray(cards[i]?.violations) ? cards[i].violations.filter((v: unknown) => typeof v === 'string' && v.trim()) : []));
        verdicts.push({ model: j.model, run: j.run, set: j.key, flagged: notes.map((n) => n.length > 0), notes, ms: Date.now() - t0, inTok: r.usage?.prompt_tokens ?? 0, outTok: r.usage?.completion_tokens ?? 0 });
      } catch (e) {
        verdicts.push({ model: j.model, run: j.run, set: j.key, flagged: [], notes: [], ms: Date.now() - t0, inTok: 0, outTok: 0, error: String((e as Error)?.message ?? e).slice(0, 160) });
      }
    }
  }));

  await writeFile(out, JSON.stringify({ models, runs, sets: sets.map((x) => ({ key: x.key, id: x.s.brief.id, fronts: x.s.concepts.map((c) => c.front_text) })), verdicts }, null, 1), 'utf8');
  const get = (model: string, run: number, set: string) => verdicts.find((v) => v.model === model && v.run === run && v.set === set && !v.error);
  const cardsTotal = sets.length * 3;
  console.log(`sets ${sets.length}, cards ${cardsTotal}, runs ${runs}`);
  for (const m of models) {
    const mine = verdicts.filter((v) => v.model === m);
    const errs = mine.filter((v) => v.error);
    if (errs.length === mine.length) { console.log(`${m}: ALL CALLS FAILED: ${errs[0]?.error}`); continue; }
    const ok = mine.filter((v) => !v.error);
    const flagRate = ok.reduce((n, v) => n + v.flagged.filter(Boolean).length, 0) / (ok.length * 3);
    let same = 0, both = 0, vsBase = 0, vsBaseN = 0;
    for (const { key } of sets) {
      const a = get(m, 0, key), b = get(m, 1, key), base = get(models[0], 0, key);
      if (a && b) a.flagged.forEach((f, i) => { both++; if (f === b.flagged[i]) same++; });
      if (a && base && m !== models[0]) a.flagged.forEach((f, i) => { vsBaseN++; if (f === base.flagged[i]) vsBase++; });
    }
    console.log(`${m}: flags ${(flagRate * 100).toFixed(0)}% of cards | agrees with itself ${both ? ((same / both) * 100).toFixed(0) : '-'}% | agrees with ${models[0]} ${vsBaseN ? ((vsBase / vsBaseN) * 100).toFixed(0) + '%' : '-'} | median ${(median(ok.map((v) => v.ms)) / 1000).toFixed(1)}s | tokens in ${median(ok.map((v) => v.inTok))} out ${median(ok.map((v) => v.outTok))} | failed calls ${errs.length}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
