// server/scripts/front-ab-test.ts
//
// A/B harness: edits (openai-2) vs Responses-generate (openai-2-gen) for the
// SINGLE-PERSON front, so the "does generate free expression while holding
// identity?" question gets decided on a grid instead of 100 Lab clicks
// (Kevin 2026-07-17).
//
// It resolves the REAL, live front prompt via resolveFrontScenePrompt — the
// exact call production uses — so you're testing whatever one_person version
// is ACTIVE on the DB you connect to (dev = v6). Then it runs every
// photo × scene × provider × sample, saves each PNG, and writes an HTML
// contact sheet you open in a browser: source | edits×N | generate×N per row.
//
// RUN:
//   PHOTOS_DIR=~/Downloads QUALITY=medium SAMPLES=2 \
//     npx tsx --env-file=.env server/scripts/front-ab-test.ts
//
//   env overrides (all optional):
//     PHOTOS_DIR  where the source photos live      (default ~/Downloads)
//     QUALITY     low | medium | high               (default medium)
//     SAMPLES     images per provider per cell       (default 2)
//     POOL        max concurrent gens                (default 2)
//     PROVIDERS   comma list                         (default openai-2,openai-2-gen)
//
// EDIT the PHOTOS + SCENES below to your Round-1 / Round-2 matrix. Each photo
// value is a filename inside PHOTOS_DIR.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { homedir } from 'node:os';
import { resolveFrontScenePrompt } from '../prompts/resolver';
import { getProvider } from '../providers/registry';

// ── CONFIG — edit these ──────────────────────────────────────────────
const PHOTOS: Record<string, string> = {
  // label : filename inside PHOTOS_DIR   (← put your real files here)
  candid: 'chess-source.png',   // the looking-down candid (the failure case)
  selfie: 'selfie.png',         // a straight-on selfie
};

const SCENES: Array<{ id: string; scene: string; cardText: string }> = [
  { id: 'joyful',  scene: 'Celebrating her birthday, living it up',   cardText: 'Happy Birthday!' },
  { id: 'serious', scene: 'Playing a serious game of chess in Vegas',  cardText: 'Congrats Babe!'  },
  { id: 'eiffel',  scene: 'At the Eiffel Tower at sunset',            cardText: 'Bon Voyage!'     },
];
// ─────────────────────────────────────────────────────────────────────

const PHOTOS_DIR = (process.env.PHOTOS_DIR || join(homedir(), 'Downloads')).replace(/^~/, homedir());
const QUALITY = (process.env.QUALITY || 'medium') as 'low' | 'medium' | 'high';
const SAMPLES = Math.max(1, parseInt(process.env.SAMPLES || '2', 10));
const POOL = Math.max(1, parseInt(process.env.POOL || '2', 10));
const PROVIDERS = (process.env.PROVIDERS || 'openai-2,openai-2-gen').split(',').map((s) => s.trim());
const OUT_DIR = join(homedir(), 'Downloads', `front-ab-${QUALITY}-x${SAMPLES}`);

function photoDataUrl(file: string): string {
  const p = join(PHOTOS_DIR, file);
  if (!existsSync(p)) throw new Error(`photo not found: ${p}`);
  const ext = extname(p).slice(1).toLowerCase().replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${readFileSync(p).toString('base64')}`;
}

type Cell = {
  photoLabel: string; photoFile: string; sceneId: string; scene: string;
  cardText: string; provider: string; sample: number;
};
type Result = Cell & { outFile?: string; durationMs?: number; costCents?: number; error?: string };

async function runPool<T>(items: T[], limit: number, fn: (t: T, i: number) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx], idx); }
  });
  await Promise.all(workers);
}

async function main() {
  const host = (process.env.DATABASE_URL ?? '').match(/@([^/.]+)/)?.[1] ?? '?';
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`DB=${host}  quality=${QUALITY}  samples=${SAMPLES}  pool=${POOL}`);
  console.log(`providers=${PROVIDERS.join(', ')}  →  ${OUT_DIR}\n`);

  // Guard: every provider must be available (key set) before we spend.
  for (const id of PROVIDERS) if (!getProvider(id).isAvailable()) throw new Error(`provider ${id} unavailable (OPENAI_API_KEY?)`);

  // Resolve the live prompt ONCE per scene (identical across providers/samples —
  // that's the point: only the provider changes) + copy the source photo in.
  const scenePrompt: Record<string, string> = {};
  let templateVersion: number | null = null;
  for (const s of SCENES) {
    const r = await resolveFrontScenePrompt({
      scenePrompt: s.scene, userArtStyle: 'artistic',
      includeText: s.cardText.length > 0, cardText: s.cardText,
      photoMode: 'one_person', photoCount: 1,
    });
    scenePrompt[s.id] = r.text;
    templateVersion = r.templateVersion;
  }
  console.log(`resolved one_person prompt v=${templateVersion} (${PROVIDERS.length}× same prompt, provider is the only variable)\n`);
  for (const [label, file] of Object.entries(PHOTOS)) copyFileSync(join(PHOTOS_DIR, file), join(OUT_DIR, `src__${label}${extname(file)}`));

  // Build the full cell list.
  const cells: Cell[] = [];
  for (const [photoLabel, photoFile] of Object.entries(PHOTOS))
    for (const s of SCENES)
      for (const provider of PROVIDERS)
        for (let sample = 1; sample <= SAMPLES; sample++)
          cells.push({ photoLabel, photoFile, sceneId: s.id, scene: s.scene, cardText: s.cardText, provider, sample });

  const results: Result[] = [];
  let done = 0;
  await runPool(cells, POOL, async (c) => {
    const tag = `${c.photoLabel}/${c.sceneId}/${c.provider}#${c.sample}`;
    try {
      const dataUrl = photoDataUrl(c.photoFile);
      const t = Date.now();
      const res = await getProvider(c.provider).generate({
        prompt: scenePrompt[c.sceneId], referenceImageBase64: dataUrl,
        quality: QUALITY, size: '1024x1024',
      } as any);
      const outFile = `${c.photoLabel}__${c.sceneId}__${c.provider}__s${c.sample}.png`;
      const b64 = (res.imageUrl || '').replace(/^data:image\/\w+;base64,/, '');
      writeFileSync(join(OUT_DIR, outFile), Buffer.from(b64, 'base64'));
      results.push({ ...c, outFile, durationMs: res.durationMs, costCents: res.costCents });
      console.log(`✓ ${(++done)}/${cells.length}  ${tag}  ${Math.round((Date.now() - t) / 1000)}s  ${res.costUsd}`);
    } catch (e: any) {
      results.push({ ...c, error: (e?.message ?? String(e)).slice(0, 200) });
      console.log(`✗ ${(++done)}/${cells.length}  ${tag}  ERROR: ${(e?.message ?? e).toString().slice(0, 120)}`);
    }
  });

  writeFileSync(join(OUT_DIR, 'index.html'), buildHtml(results, templateVersion));
  const cost = results.reduce((s, r) => s + (r.costCents ?? 0), 0);
  const fails = results.filter((r) => r.error).length;
  console.log(`\nDONE. ${results.length - fails}/${results.length} ok, ${fails} failed. Cost ~$${(cost / 100).toFixed(2)}.`);
  console.log(`Open:  ${join(OUT_DIR, 'index.html')}`);
}

function esc(s: string) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)); }

function buildHtml(results: Result[], v: number | null): string {
  const photos = [...new Set(results.map((r) => r.photoLabel))];
  const scenes = [...new Set(results.map((r) => r.sceneId))];
  const provs = [...new Set(results.map((r) => r.provider))];
  const cell = (r?: Result) => r?.outFile
    ? `<figure><img src="${r.outFile}"><figcaption>${r.provider}#${r.sample} · ${Math.round((r.durationMs ?? 0) / 1000)}s</figcaption></figure>`
    : `<figure class="err"><div>${r ? esc(r.error ?? 'no image') : ''}</div></figure>`;
  let html = `<style>body{font:14px system-ui;margin:24px;background:#faf8f4;color:#211d19}h2{margin:32px 0 4px}
  .scene{color:#645c53;margin-bottom:12px}.grid{display:grid;grid-template-columns:180px 1fr;gap:16px;align-items:start;padding:12px 0;border-top:1px solid #e5dfd4}
  .prov{margin-bottom:20px}.prov b{display:block;margin-bottom:6px}.row{display:flex;gap:10px;flex-wrap:wrap}
  figure{margin:0;width:200px}img{width:200px;height:200px;object-fit:cover;border-radius:8px;box-shadow:0 4px 16px -6px rgba(0,0,0,.3)}
  figcaption{font-size:11px;color:#645c53;margin-top:3px}.src img{border:2px solid #5c57d4}.err{width:200px;height:200px;display:flex;align-items:center;justify-content:center;background:#fbeaea;color:#a33;border-radius:8px;font-size:11px;padding:8px;text-align:center}</style>`;
  html += `<h1>Front A/B — one_person v${v ?? '?'}</h1><p class="scene">Same photo + scene + prompt; only the provider differs. Score each pair on <b>identity</b>, <b>expression fit</b>, <b>realism</b>.</p>`;
  for (const p of photos) {
    for (const sc of scenes) {
      const scene = results.find((r) => r.sceneId === sc)?.scene ?? sc;
      const text = results.find((r) => r.sceneId === sc)?.cardText ?? '';
      html += `<h2>${p} — ${sc}</h2><div class="scene">"${esc(scene)}" · text: "${esc(text)}"</div><div class="grid">`;
      html += `<div class="src"><figure><img src="src__${p}${['.png', '.jpg', '.jpeg', '.webp'].find((e) => existsSync(join(OUT_DIR, 'src__' + p + e))) ?? '.png'}"><figcaption>SOURCE</figcaption></figure></div><div>`;
      for (const prov of provs) {
        html += `<div class="prov"><b>${prov}</b><div class="row">`;
        for (const r of results.filter((x) => x.photoLabel === p && x.sceneId === sc && x.provider === prov).sort((a, b) => a.sample - b.sample)) html += cell(r);
        html += `</div></div>`;
      }
      html += `</div></div>`;
    }
  }
  return html;
}

main().then(() => process.exit(0)).catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
