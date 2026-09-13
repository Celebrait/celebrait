// Render the archetype arm's sets into an HTML sheet with real images.
// Step 1: harness (archetype only) -> /tmp/set-acceptance-results.json
// Step 2 (this file, mode=render): read JSON, render each card, build sheet.
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import express from 'express';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

(async () => {
  const rows = JSON.parse(await readFile('/tmp/set-acceptance-results.json', 'utf8'))
    .filter((r: any) => r.arm === 'archetype');
  const app = express(); app.use(express.json({ limit: '60mb' }));
  app.use((req: any, _r, n) => { req.session = { otpUserId: process.env.LAB_ADMIN_USER_ID }; n(); });
  registerAdminCardLabRoutes(app);
  const s = app.listen(0); const port = (s.address() as any).port;

  const esc = (x: string) => String(x ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string));
  const parts: string[] = [`<title>Archetype arm — rendered</title><style>
body{font-family:-apple-system,sans-serif;margin:20px;background:#faf9f7}
h2{font-size:15px;margin:26px 0 8px} .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
figure{margin:0;border:1px solid #e2ded8;border-radius:10px;overflow:hidden;background:#fff}
img{width:100%;display:block} figcaption{padding:8px 10px;font-size:12px}
.f{font-weight:600} .d{color:#888;font-size:11px;margin-top:3px}
.fail{color:#a55;font-size:11px;font-weight:600}
@media(prefers-color-scheme:dark){body{background:#1c1b19;color:#ddd}figure{background:#262521;border-color:#3a3833}}
</style><h1 style="font-size:20px">The winning architecture, rendered — archetype → short prompt → referee</h1>`];

  for (const row of rows) {
    parts.push(`<h2>${esc(row.brief)} — ${esc(row.who)}${row.age ? ', ' + row.age : ''}, ${esc(row.interest)}${row.dislikes ? ', can’t stand ' + esc(row.dislikes) : ''} (${esc(row.tone)})${row.violations.length ? ` <span class="fail">[${esc(row.violations.join(', '))}]</span>` : ''}</h2><div class="g">`);
    const imgs = await Promise.all(row.cards.map(async (c: any) => {
      try {
        const r = await fetch(`http://localhost:${port}/api/admin/card-lab/render`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ front_text: c.front_text, art_direction: c.art_direction || 'a simple bold typographic card',
            palette: c.palette, typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', freeStyle: true, quality: 'low' }),
        });
        return ((await r.json()) as any).imageUrl ?? '';
      } catch { return ''; }
    }));
    row.cards.forEach((c: any, i: number) => {
      parts.push(`<figure>${imgs[i] ? `<img src="${imgs[i]}">` : '<div style="padding:30px;text-align:center;color:#a55">render failed</div>'}<figcaption><div class="f">${esc(c.front_text)}</div><div class="d">${esc(c.art_direction ?? '')}</div></figcaption></figure>`);
    });
    parts.push('</div>');
    console.log(`rendered: ${row.brief}`);
  }
  await writeFile('/tmp/winner-rendered.html', parts.join('\n'));
  console.log('SHEET READY');
  s.close(); process.exit(0);
})();
