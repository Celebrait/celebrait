// One sheet, grouped by BRIEF, all four architectures side by side.
// Archetype images are reused from the sheet Aidan already approved
// (same cards, not a re-roll); the other three arms render fresh.
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import express from 'express';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

(async () => {
  const fresh = JSON.parse(await readFile('/tmp/set-acceptance-results.json', 'utf8'));
  const arch = JSON.parse(await readFile('/tmp/archetype-results.json', 'utf8'));
  const rows = [...arch, ...fresh.filter((r: any) => r.arm !== 'archetype')];

  // Reuse the approved archetype images, in document order.
  const prevHtml = await readFile('/tmp/winner-rendered-small.html', 'utf8');
  const prevImgs = prevHtml.match(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/g) ?? [];
  let ai = 0;

  const app = express(); app.use(express.json({ limit: '60mb' }));
  app.use((req: any, _r, n) => { req.session = { otpUserId: process.env.LAB_ADMIN_USER_ID }; n(); });
  registerAdminCardLabRoutes(app);
  const s = app.listen(0); const port = (s.address() as any).port;
  const sharp = (await import('sharp')).default;

  const render = async (c: any): Promise<string> => {
    try {
      const r = await fetch(`http://localhost:${port}/api/admin/card-lab/render`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ front_text: c.front_text, art_direction: c.art_direction || 'a bold typographic card',
          palette: c.palette, typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true, quality: 'low' }),
      });
      const url = ((await r.json()) as any).imageUrl ?? '';
      if (!url) return '';
      const buf = Buffer.from(url.split(',')[1], 'base64');
      return 'data:image/jpeg;base64,' + (await sharp(buf).resize(520).jpeg({ quality: 82 }).toBuffer()).toString('base64');
    } catch { return ''; }
  };

  for (const row of rows) {
    row.imgs = row.arm === 'archetype'
      ? row.cards.map(() => prevImgs[ai++] ?? '')
      : await Promise.all(row.cards.map(render));
    console.log(`done: ${row.arm} / ${row.brief}`);
  }

  const esc = (x: string) => String(x ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string));
  const ARMS = ['current', 'bare', 'short', 'archetype'];
  const LABEL: Record<string,string> = { current: 'CURRENT (8k prompt)', bare: 'BARE (null hypothesis)', short: 'SHORT + REFEREE', archetype: 'ARCHETYPE (the winner)' };
  const briefs = Array.from(new Set(rows.map((r: any) => r.brief)));
  const parts = [`<title>All four architectures, rendered</title><style>
body{font-family:-apple-system,sans-serif;margin:20px;background:#faf9f7}
h2{font-size:16px;margin:34px 0 2px} .sub{color:#777;font-size:12px;margin-bottom:10px}
h3{font-size:12px;margin:14px 0 6px;color:#555;text-transform:uppercase;letter-spacing:.05em}
h3.win{color:#2a7} .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
figure{margin:0;border:1px solid #e2ded8;border-radius:10px;overflow:hidden;background:#fff}
img{width:100%;display:block} figcaption{padding:7px 9px;font-size:11.5px}
.fail{color:#a55;font-weight:600;font-size:11px;margin-left:8px}
@media(prefers-color-scheme:dark){body{background:#1c1b19;color:#ddd}figure{background:#262521;border-color:#3a3833}h3{color:#999}}
</style><h1 style="font-size:20px">Every architecture, rendered — grouped by brief</h1>`];
  for (const b of briefs) {
    const any = rows.find((r: any) => r.brief === b);
    parts.push(`<h2>${esc(b)}</h2><div class="sub">${esc(any.who)}${any.age ? ', ' + any.age : ''} · ${esc(any.interest)}${any.dislikes ? ' · can’t stand ' + esc(any.dislikes) : ''} · ${esc(any.tone)}</div>`);
    for (const a of ARMS) {
      const row = rows.find((r: any) => r.brief === b && r.arm === a);
      if (!row) continue;
      parts.push(`<h3 class="${a === 'archetype' ? 'win' : ''}">${LABEL[a]}${row.violations?.length ? `<span class="fail">[${esc(row.violations.join(', '))}]</span>` : ''}</h3><div class="g">`);
      row.cards.forEach((c: any, i: number) => {
        parts.push(`<figure>${row.imgs[i] ? `<img src="${row.imgs[i]}">` : '<div style="padding:26px;text-align:center;color:#a55;font-size:12px">render failed</div>'}<figcaption>${esc(c.front_text)}</figcaption></figure>`);
      });
      parts.push('</div>');
    }
  }
  await writeFile('/tmp/all-arms-rendered.html', parts.join('\n'));
  console.log('SHEET READY', rows.length, 'sets');
  s.close(); process.exit(0);
})();
