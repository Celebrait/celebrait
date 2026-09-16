// server/scripts/measure-route-costs.ts
//
// What does one card cost to MAKE, per route? (Aidan 2026-09-16: "test the
// cost of the generations for both our routes as we'll see the balance go
// down.") Runs each route end to end against a running dev server, exactly
// the calls a customer triggers, then totals the generation_log rows written
// during each run. The dev server must be started with DEV_GEN_LOG=1 or no
// rows are written.
//
//   npx tsx server/scripts/measure-route-costs.ts three 3      # three-card sets (the 3rd adds a photo)
//   npx tsx server/scripts/measure-route-costs.ts photo 2      # photo-route cards, front + inside
//   npx tsx server/scripts/measure-route-costs.ts dry          # plumbing only, no paid calls
//
// OpenAI calls are priced from the usage OpenAI returns, so they should
// match the dashboard. Gemini calls (photo analysis, the cameo check, any
// Gemini front) bill to Google, not OpenAI.

import 'dotenv/config';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

const BASE = process.env.BASE ?? 'http://localhost:5050';
const EMAIL = process.env.MEASURE_EMAIL ?? 'audit-test@celebrait.test';
const sql = neon(process.env.DATABASE_URL!);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const jar: Record<string, string> = {};
async function call(p: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  const r = await fetch(BASE + p, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  const text = await r.text(); let j: any; try { j = JSON.parse(text); } catch { j = { raw: text.slice(0, 200) }; }
  if (!r.ok) throw new Error(`${p} → ${r.status} ${j?.message ?? j?.raw ?? ''}`);
  return j;
}
async function signIn() {
  await call('/api/auth/otp/send', { body: { email: EMAIL } });
  await call('/api/auth/otp/verify', { body: { email: EMAIL, code: '000000' } });
}
// Sized like a phone photo after the app's own prep (long edge 1600) —
// image INPUT tokens scale with resolution, so a small file would flatter.
const photoDataUrl = async (file: string, edge = 1600) => {
  const buf = await sharp(path.resolve(process.cwd(), 'client/public', file)).resize(edge, edge, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
};

// ── the ledger for a time window ─────────────────────────────────────
interface Row { provider: string; model: string; slot: string; quality: string | null; n: number; cents: number }
async function ledger(from: Date, to: Date): Promise<Row[]> {
  const rows = await sql`select provider, model, slot, quality, count(*)::int as n, sum(cost_cents_x100)::float / 100 as cents
    from generation_log where created_at >= ${from.toISOString()} and created_at <= ${to.toISOString()}
    group by provider, model, slot, quality order by provider, model, slot`;
  return rows as unknown as Row[];
}
function print(label: string, rows: Row[]) {
  const sum = (f: (r: Row) => boolean) => rows.filter(f).reduce((a, r) => a + r.cents, 0);
  console.log(`\n── ${label}`);
  for (const r of rows) console.log(`   ${r.provider.padEnd(7)} ${r.model.padEnd(28)} ${String(r.slot).padEnd(16)} ${String(r.quality ?? '').padEnd(7)} ×${String(r.n).padStart(2)}  ${r.cents.toFixed(2).padStart(7)}¢`);
  console.log(`   OpenAI ${sum((r) => r.provider.startsWith('openai')).toFixed(2)}¢ · Gemini ${sum((r) => r.provider.startsWith('gemini')).toFixed(2)}¢ · total ${sum(() => true).toFixed(2)}¢`);
  return { openai: sum((r) => r.provider.startsWith('openai')), gemini: sum((r) => r.provider.startsWith('gemini')) };
}
async function measure<T>(label: string, run: () => Promise<T>) {
  const from = new Date(Date.now() - 1000); const t0 = Date.now();
  await run();
  await sleep(6000); // fire-and-forget log writes and the async photo analysis land
  const out = print(`${label} (${Math.round((Date.now() - t0) / 1000)}s)`, await ledger(from, new Date()));
  return out;
}

// ── route 1: the three-card route (/make) ─────────────────────────────
async function threeCardSet(withPhoto: boolean) {
  const brief = { occasion: '70th Birthday', who: 'Mum', gender: 'her', tone: 'warm', age: 70, interest: 'Her garden — the roses, the robin, the shed radio', dislikes: 'Slugs', frontWord: 'Mum', recipientName: 'Linda' };
  const j = await call('/api/make/concepts', { body: { ...brief, pipeline: 'celebrait', characters: 'objects', insideMode: 'auto', freeStyle: true, freeComposition: true, memory: false } });
  const cs = j.concepts as any[];
  const art = (c: any) => ({ front_text: c.front_text, art_direction: c.art_direction, palette: c.palette, typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true });
  const fronts = await Promise.all(cs.map((c) => call('/api/make/render', { body: art(c) })));
  console.log(`   fronts: ${cs.map((c) => `"${String(c.front_text).slice(0, 40)}"`).join(' · ')}`);
  if (withPhoto) {
    const photo = await photoDataUrl('proof-source-photo.webp');
    const cameo = await call('/api/make/render', { body: { ...art(cs[0]), cameoPhoto: photo, cameoMode: 'redraw' } });
    const qa = await call('/api/make/cameo-check', { body: { cardImage: cameo.imageUrl, cameoPhoto: photo } });
    console.log(`   cameo check: ${qa?.result?.verdict ?? 'no verdict'}`);
  }
  const c = cs[0];
  await call('/api/make/render-inside', { body: { mode: 'own', message: `Dear Mum,\n\n${c.inside_text ?? 'Happy birthday.'}\n\nAll our love, Aidan & Sam x`, palette: c.palette, typeface: c.typeface, art_direction: c.art_direction, characters: 'objects', freeStyle: true, direction: c.direction } });
  return fronts.length;
}

// ── route 2: the photo route (studio) ─────────────────────────────────
async function waitStatus(id: number, want: string[], timeoutMs = 360_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const d = await call(`/api/studio/drafts/${id}`);
    const st = d?.status ?? d?.card?.status;
    if (want.includes(st)) return st;
    if (/failed/.test(String(st))) throw new Error(`card ${id} ${st}`);
    await sleep(3000);
  }
  throw new Error(`card ${id} timed out`);
}
async function photoCard(dry = false) {
  const draft = await call('/api/studio/drafts', { body: { recipientName: 'Mum', occasion: 'birthday' } });
  const id = draft.id ?? draft.card?.id;
  const up = await call('/api/photos/upload', { body: { imageBase64: await photoDataUrl('proof-timessquare-source.webp'), filename: 'mum.jpg' } });
  const photoId = up.id ?? up.photo?.id;
  console.log(`   draft ${id}, photo ${photoId}`);
  if (dry) return;
  const sug = await call('/api/studio/scene-suggestions', { body: { cardId: id } });
  const scene = sug?.suggestions?.[0]?.text ?? 'In her garden at golden hour, roses in full bloom, a robin on the fork handle, a radio on the shed shelf.';
  const state = { version: 1, step: 5, recipient: { name: 'Mum', occasion: 'birthday' }, scene: { description: scene, source: 'suggestion' }, photos: { mode: 'one_person', photoIds: [photoId] } };
  await call(`/api/studio/drafts/${id}`, { method: 'PATCH', body: { state } });
  await call(`/api/studio/drafts/${id}/generate`, { body: { mode: 'front' } });
  await waitStatus(id, ['front-ready']);
  await call(`/api/studio/drafts/${id}`, { method: 'PATCH', body: { state: { ...state, inside: { mode: 'write', write: { message: 'Happy birthday Mum. Here’s to the roses, the robin and you. All our love x' } } } } });
  await call(`/api/studio/drafts/${id}/generate-inside`, { body: {} });
  await waitStatus(id, ['inside-ready']);
  console.log(`   card ${id} front + inside done`);
}

async function main() {
  const [what = 'dry', nArg] = process.argv.slice(2);
  const n = Math.max(1, Math.min(5, Number(nArg) || 1));
  await signIn();
  const totals: Array<{ openai: number; gemini: number }> = [];
  if (what === 'dry') {
    const from = new Date();
    await photoCard(true);
    await sleep(8000);
    print('dry run (upload analysis only — Gemini)', await ledger(from, new Date()));
  } else if (what === 'three') {
    for (let i = 0; i < n; i++) totals.push(await measure(`three-card set ${i + 1}${i === n - 1 && n >= 3 ? ' + photo' : ''}`, () => threeCardSet(i === n - 1 && n >= 3)));
  } else if (what === 'photo') {
    for (let i = 0; i < n; i++) totals.push(await measure(`photo-route card ${i + 1}`, () => photoCard()));
  }
  if (totals.length) {
    const o = totals.reduce((a, t) => a + t.openai, 0), g = totals.reduce((a, t) => a + t.gemini, 0);
    console.log(`\n== ${what}: ${totals.length} runs · OpenAI ${o.toFixed(2)}¢ ($${(o / 100).toFixed(3)}) · Gemini ${g.toFixed(2)}¢ · per run ${((o + g) / totals.length).toFixed(2)}¢`);
  }
  await sleep(1500);
}
main().then(() => process.exit(0)).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
