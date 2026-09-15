#!/usr/bin/env node
// marketing/hyperframes/demo-run/build.mjs
//
// One saved /demo run → a HyperFrames composition (index.html) with the
// run's own words and images baked in. Then render:
//
//   node build.mjs <run id>                # from a dev server on :5050 (dev OTP sign-in)
//   BASE=https://www.celebrait.co.uk COOKIE='connect.sid=…' node build.mjs 12
//   npm run check && npm run render        # → out/index.mp4
//
// The storyboard (1080×1920, 30fps): the hook line typed in Fraunces Bold
// with the recipient in violet → ink; the brief as pills; three fronts
// fan in and one is picked; (if there was a photo) the photo goes in and
// becomes the cameo; the card flips to its inside; "It's on the way".

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://localhost:5050';
const id = process.argv[2];
if (!id) { console.error('usage: node build.mjs <run id>'); process.exit(1); }

// ── fetch the run ─────────────────────────────────────────────────────
const jar = {};
const cookie = () => process.env.COOKIE ?? Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
async function call(p, opts = {}) {
  const r = await fetch(BASE + p, { ...opts, headers: { 'Content-Type': 'application/json', cookie: cookie(), ...(opts.headers ?? {}) } });
  for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(';'); const [k, v] = kv.split('='); jar[k] = v; }
  return r;
}
if (!process.env.COOKIE) {
  const email = process.env.DEMO_EMAIL ?? 'audit-test@celebrait.test';
  await call('/api/auth/otp/send', { method: 'POST', body: JSON.stringify({ email }) });
  const v = await call('/api/auth/otp/verify', { method: 'POST', body: JSON.stringify({ email, code: '000000' }) });
  if (!v.ok) { console.error('dev sign-in failed', v.status); process.exit(1); }
}
const res = await call(`/api/admin/demo-runs/${id}`);
if (!res.ok) { console.error(`run ${id}: ${res.status}`); process.exit(1); }
const { run } = await res.json();

// ── pull the images local (renders must not touch the network) ────────
const runDir = path.join(HERE, 'assets', 'run');
await fs.rm(runDir, { recursive: true, force: true }); await fs.mkdir(runDir, { recursive: true });
const grab = async (url, name) => {
  if (!url) return null;
  const abs = url.startsWith('http') ? url : BASE + url;
  const r = await fetch(abs, { headers: { cookie: cookie() } });
  if (!r.ok) throw new Error(`${name}: ${r.status} ${abs}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.writeFile(path.join(runDir, name), buf);
  return `assets/run/${name}`;
};
const fronts = await Promise.all(run.frontUrls.map((u, i) => grab(u, `front${i + 1}.png`)));
const photo = await grab(run.photoUrl, 'photo.png');
const cameo = await grab(run.cameoUrl, 'cameo.png');
const inside = await grab(run.insideUrl, 'inside.png');

// ── words ─────────────────────────────────────────────────────────────
const b = run.brief ?? {};
const esc = (t) => String(t ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const NAME_LIKE = ['Mum', 'Dad', 'Nan', 'Grandad'];
const who = b.name?.trim() && b.front === 'name' ? b.name.trim() : NAME_LIKE.includes(b.who) ? b.who : (b.who ? `your ${String(b.who).toLowerCase()}` : 'them');
const hookLine = run.hook_line || `Watch us make a card for ${who}.`;
const gradientWords = [b.who, b.name].filter(Boolean);
// Each character its own span so it can type; the recipient's word carries the gradient.
function hookHtml(line) {
  // Words stay whole (no mid-word wraps); the recipient's word carries the gradient.
  return line.split(' ').map((word) => {
    const core = word.replace(/[^\w'’-]+$/, ''); const tail = word.slice(core.length);
    const isWho = gradientWords.some((x) => x === core);
    const chars = (t) => [...t].map((ch) => `<span class="ch">${esc(ch)}</span>`).join('');
    return `<span class="w">${isWho ? `<span class="who">${chars(core)}</span>` : chars(core)}${chars(tail)}</span>`;
  }).join('<span class="ch sp"> </span>');
}
const VIBE = { funny: 'Light humour', warm: 'Warm', rude: 'Cheeky', mix: 'One of each' };
const chips = [
  b.who && `For ${esc(b.who)}`,
  b.occasion && `${esc(b.occasion[0].toUpperCase() + b.occasion.slice(1))}${b.age ? ` · ${esc(b.age)}` : ''}`,
  b.vibe && VIBE[b.vibe],
  b.thing && `“${esc(b.thing)}”`,
  b.cant && `Can’t stand ${esc(b.cant)}`,
].filter(Boolean);
const picked = Number.isInteger(run.picked_index) ? run.picked_index : 0;
const pickedRaw = run.concepts?.[picked]?.front_text ?? '';
const pickedText = esc(pickedRaw);
const captionSize = pickedRaw.length > 90 ? 30 : pickedRaw.length > 50 ? 36 : 44;
const finalFront = cameo ?? fronts[picked];
const expectBy = new Date(); expectBy.setDate(expectBy.getDate() + 7);
const expectStr = expectBy.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

// ── timing (seconds) ──────────────────────────────────────────────────
const hasPhoto = !!(photo && cameo);
const T = { hook: 0, brief: 3.4, three: 6.6, photo: 11.8, inside: hasPhoto ? 16.2 : 11.8 };
T.close = T.inside + 4.4; T.end = T.close + 3.2;

// ── compose ───────────────────────────────────────────────────────────
let html = await fs.readFile(path.join(HERE, 'src', 'template.html'), 'utf8');
const vars = {
  DURATION: T.end.toFixed(2), HOOK_HTML: hookHtml(hookLine), WHO: esc(who),
  CHIPS_HTML: chips.map((c, i) => `<span class="pill" id="s2-p${i}">${c}</span>`).join(''),
  FRONT1: fronts[0] ?? '', FRONT2: fronts[1] ?? '', FRONT3: fronts[2] ?? '', PICKED: String(picked), PICKED_TEXT: pickedText, CAPTION_SIZE: String(captionSize),
  PHOTO: photo ?? '', CAMEO: cameo ?? '', FINAL_FRONT: finalFront ?? '', INSIDE: inside ?? '', EXPECT: esc(expectStr),
  T_BRIEF: T.brief, T_THREE: T.three, T_PHOTO: T.photo, T_INSIDE: T.inside, T_CLOSE: T.close, T_END: T.end,
  D_BRIEF: (T.three - T.brief).toFixed(2), D_THREE: (T.photo - T.three).toFixed(2), D_PHOTO: (T.inside - T.photo).toFixed(2),
  D_INSIDE: (T.close - T.inside).toFixed(2), D_TOP: (T.end - T.brief).toFixed(2), D_CLOSE: (T.end - T.close).toFixed(2), HAS_PHOTO: hasPhoto ? 'true' : 'false',
};
// The photo scene is cut out of the DOM entirely when there was no photo.
html = html.replace(/<!--IF_PHOTO-->([\s\S]*?)<!--END_PHOTO-->/g, hasPhoto ? '$1' : '');
for (const [k, v] of Object.entries(vars)) html = html.split(`{{${k}}}`).join(String(v));
const left = html.match(/{{[A-Z_0-9]+}}/g);
if (left) { console.error('unfilled:', [...new Set(left)].join(' ')); process.exit(1); }
await fs.writeFile(path.join(HERE, 'index.html'), html);
await fs.writeFile(path.join(HERE, 'assets', 'run', 'run.json'), JSON.stringify(run, null, 1));
console.log(`built index.html for run #${run.id} (${run.label}) — ${T.end.toFixed(1)}s, ${hasPhoto ? 'with' : 'no'} photo`);
console.log('next: npm run check && npm run render');
