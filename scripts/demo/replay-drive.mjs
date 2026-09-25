// scripts/demo/replay-drive.mjs
//
// NEEDS PLAYWRIGHT, which is deliberately NOT a dependency of this repo —
// Render builds with `npm install --include=dev` and there is no reason
// to ship a browser download into a production build for a dev tool. Run
// it from a scratch directory that has playwright installed, e.g.
//   mkdir -p /tmp/demo-harness && cd /tmp/demo-harness && npm i playwright
//   node <repo>/scripts/demo/replay-drive.mjs 10
//
// Drive a saved demo run end to end, the way Aidan does — one tap per
// control. The old harness assumed the run played itself; the director
// was removed on 2026-09-24, so every screen now waits for a tap and
// nothing advances on its own.
//
//   node seed-run.mjs                 → prints a run id to drive
//   node replay-drive.mjs 10                       the whole flow
//   node replay-drive.mjs 10 --opener --open --post
//   node replay-drive.mjs 10 --shots 1500,3000,5000 --out out-reveal
//
// Every step waits for its own control, so a failure names the screen it
// died on, prints the phase and the on-screen error, and leaves a
// screenshot behind instead of timing out anonymously.
import { chromium } from 'playwright';
import fs from 'fs/promises';
import { BASE, signIn, api, state, bannerError } from './lib.mjs';

const args = process.argv.slice(2);
const runId = Number(args.find((a) => /^\d+$/.test(a)));
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
if (!runId) { console.error('usage: node replay-drive.mjs <runId> [--opener] [--open] [--post] [--shots a,b] [--out DIR] [--viewport WxH]'); process.exit(1); }

const OUT = opt('out', 'out-drive');
const SHOTS = opt('shots', '1500,3200,5200').split(',').map(Number).filter(Boolean);
const [VW, VH] = opt('viewport', '430x820').split('x').map(Number);
await fs.rm(OUT, { recursive: true, force: true }); await fs.mkdir(OUT, { recursive: true });

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await signIn(page);
const run = (await api(page, 'GET', `/api/admin/demo-runs/${runId}`)).body?.run;
if (!run) { console.error(`no run ${runId}`); process.exit(1); }
const brief = run.brief ?? {}; const words = run.words ?? {};
console.log(`run ${runId} · ${run.label ?? 'unlabelled'} · route ${run.route ?? '(none)'} · approved ${run.approved}`);

const t0 = Date.now();
const since = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const sel = (k) => `[data-demo="${k}"]`;

async function die(where, why) {
  await page.screenshot({ path: `${OUT}/FAILED-${where}.png` });
  console.error(`\n✗ stalled on "${where}" — ${why}`);
  console.error(`  phase: ${await state(page)}`);
  console.error(`  banner: ${(await bannerError(page)) ?? 'none'}`);
  if (pageErrors.length) console.error(`  page errors: ${pageErrors.join(' | ')}`);
  console.error(`  screenshot: ${OUT}/FAILED-${where}.png`);
  await b.close();
  process.exit(1);
}

const waitFor = async (key, where, timeout = 20000) => {
  const el = await page.waitForSelector(sel(key), { timeout, state: 'visible' }).catch(() => null);
  if (!el) await die(where, `never found [data-demo="${key}"]`);
  return el;
};
const tap = async (key, where) => {
  const el = await waitFor(key, where);
  await el.click({ force: true });          // awaited — an un-awaited click races the next step
  await page.waitForTimeout(420);
};
/** Settle on a screen before touching the next one. Several transitions
 *  are async (a replay's photo step resolves and jumps to the scene on
 *  its own), so tapping the moment a control appears races the state
 *  machine and lands taps on the wrong screen. */
const waitPhase = async (want, where, timeout = 30000) => {
  const start = Date.now();
  const wanted = Array.isArray(want) ? want : [want];
  while (Date.now() - start < timeout) {
    if (wanted.includes(await state(page))) return;
    const err = await bannerError(page);
    if (err) await die(where, `the run reported: ${err}`);
    await page.waitForTimeout(120);
  }
  await die(where, `phase stuck on "${await state(page)}", wanted ${wanted.join(' or ')}`);
};

/** The screens CROSS-FADE — AnimatePresence here has no mode="wait", so
 *  for ~0.4s two <section>s are mounted at once and a tap can land on
 *  the one on its way out. The phase flips at the start of that fade, so
 *  waiting on the phase alone is not enough: wait for the DOM to come
 *  back down to one screen. */
const waitSettled = async (where, timeout = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if ((await page.evaluate(() => document.querySelectorAll('section').length)) <= 1) {
      await page.waitForTimeout(180);
      return;
    }
    await page.waitForTimeout(80);
  }
  console.warn(`  ! ${where}: still cross-fading after ${timeout}ms, carrying on`);
};

const type = async (key, text, where) => {
  if (!text) return;
  const el = await waitFor(key, where);
  await el.fill(String(text));
  await page.waitForTimeout(220);
};

const url = `${BASE}/demo?route=photo&run=${runId}&waits=none${flag('opener') ? '&opener=card&hook=typed' : ''}`;
await page.goto(url, { waitUntil: 'domcontentloaded' });

// on: the phase this step belongs to. then: the phase it should leave behind.
const STEPS = [
  { name: 'opener', skip: !flag('opener'), on: 'opener', then: 'who', run: async () => tap('opener', 'opener') },
  { name: 'who', on: 'who', then: 'mode', run: async () => { await type('name', brief.name, 'who'); await tap('who-next', 'who'); } },
  { name: 'mode', on: 'mode', then: 'photo', run: async () => {
      if (brief.photoMode && brief.photoMode !== 'one_person') await tap(`mode-${brief.photoMode}`, 'mode');
      await tap('mode-next', 'mode');
    } },
  // A replay never uploads: picking the photo resolves and jumps to the
  // scene on its own, which is why this one waits rather than taps on.
  { name: 'photo', on: 'photo', then: 'scene', run: async () => { await tap('add-photo', 'photo'); await tap('picker-photo', 'photo picker'); } },
  { name: 'scene', on: 'scene', then: 'front', run: async () => { await type('scene', brief.scene, 'scene'); await tap('scene-next', 'scene'); } },
  { name: 'front', on: 'front', then: 'inside', run: async () => { await type('front-text', brief.frontText, 'front'); await tap('front-next', 'front'); } },
  { name: 'inside', on: 'inside', then: ['generating', 'card'], run: async () => {
      await type('dear', words.dear, 'inside'); await type('message', words.message, 'inside'); await type('from', words.from, 'inside');
      await tap('make-card', 'inside');
    } },
];

for (const s of STEPS) {
  if (s.skip) continue;
  await waitPhase(s.on, `waiting for the ${s.name} screen`);
  await waitSettled(s.name);
  await s.run();
  await waitPhase(s.then, `leaving the ${s.name} screen`);
  console.log(`  ${since().padStart(6)}  ${s.name.padEnd(7)} ✓   → ${await state(page)}`);
}

// the reveal
const landed = await (async () => {
  const start = Date.now();
  while (Date.now() - start < 120000) {
    if ((await state(page)) === 'card') return Date.now();
    const err = await bannerError(page);
    if (err) await die('generating', `the run reported: ${err}`);
    await page.waitForTimeout(150);
  }
  return 0;
})();
if (!landed) await die('card', 'the card never landed inside 120s');
console.log(`  ${since().padStart(6)}  card ✓`);

for (const ms of SHOTS) {
  while (Date.now() - landed < ms) await page.waitForTimeout(40);
  await page.screenshot({ path: `${OUT}/card-${ms}ms.png` });
}
if (flag('open')) { await tap('card', 'open the card'); await page.waitForTimeout(2200); await page.screenshot({ path: `${OUT}/card-open.png` }); }
if (flag('post')) {
  await tap('post', 'post it');
  const start = Date.now();
  while (Date.now() - start < 20000 && (await state(page)) !== 'sent') await page.waitForTimeout(150);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/sent.png` });
  console.log(`  ${since().padStart(6)}  sent ✓`);
}

console.log(`\n✓ drove run ${runId} to ${await state(page)} in ${since()} — shots in ${OUT}/`);
if (pageErrors.length) console.log(`! page errors: ${pageErrors.join(' | ')}`);
await b.close();
