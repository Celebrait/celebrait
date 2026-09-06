/**
 * THE BENCH — run a fixed set of briefs through the whole engine and lay
 * the results out on one page.
 *
 * Built 2026-08-16 because it should have existed ten changes ago. Every
 * prompt change today was tested on its own, which proves each change did
 * what it claimed and proves NOTHING about whether the engine as a whole
 * got better. Aidan, fairly: "not sure if we've regressed after so many
 * changes". Without a fixed set of briefs and a before/after you cannot
 * answer that, and neither can I.
 *
 * So: same briefs every time, one HTML sheet, look at it with your eyes.
 * Run it BEFORE a change and AFTER, and keep both files.
 *
 *   npx tsx server/scripts/card-lab-bench.ts <outDir> [--rude] [--quality low|medium|high]
 *
 * Costs roughly 2p per brief (concepts + judge + three renders).
 */
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

/** Fixed on purpose. Do not tweak these between runs or the comparison is
 *  worthless. They cover the range that has actually broken before: a
 *  hobby with kit, a subject that owns a colour, a franchise (IP rules), a
 *  gentle recipient, and a subject with no obvious objects. */
const BRIEFS = [
  { who: 'Dad', occasion: 'Birthday', interest: 'fishing' },
  { who: 'Brother', occasion: 'Birthday', interest: 'Manchester United' },
  { who: 'Sister', occasion: 'Birthday', interest: 'Harry Potter' },
  { who: 'Nan', occasion: 'Birthday', interest: 'her garden' },
  { who: 'Best mate', occasion: 'Birthday', interest: 'making cocktails' },
];

interface Concept {
  angle: string;
  format?: string;
  front_text: string;
  art_direction: string;
  palette?: string;
  typeface?: string;
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

async function main(): Promise<void> {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error('usage: card-lab-bench.ts <outDir> [--rude] [--quality low|medium|high]');
    process.exit(1);
  }
  const rude = process.argv.includes('--rude');
  const qi = process.argv.indexOf('--quality');
  const quality = qi > -1 ? process.argv[qi + 1] : 'low';

  const app = express();
  app.use(express.json());
  // The bench talks to the real routes, so it exercises the judge, the ban
  // list and the retries exactly as the Lab does. Admin gate stubbed: this
  // runs locally against the dev database only.
  app.use((req: any, _res, next) => { req.session = { otpUserId: process.env.LAB_ADMIN_USER_ID }; next(); });
  registerAdminCardLabRoutes(app);
  const server = app.listen(0);
  const port = (server.address() as any).port;
  await mkdir(outDir, { recursive: true });

  const rows: string[] = [];

  for (const brief of BRIEFS) {
    const cr = await fetch(`http://localhost:${port}/api/admin/card-lab/concepts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...brief, insideMode: 'auto', cheeky: rude, characters: 'objects' }),
    });
    const cj: any = await cr.json();
    const concepts: Concept[] = cj.concepts ?? [];
    if (!concepts.length) {
      console.warn(`  ${brief.interest}: no concepts — ${JSON.stringify(cj).slice(0, 120)}`);
      continue;
    }
    console.log(`  ${brief.interest}: ${concepts.map((c) => `"${c.front_text}"`).join(' / ')}`);

    const cells = await Promise.all(concepts.map(async (c) => {
      const rr = await fetch(`http://localhost:${port}/api/admin/card-lab/render`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          front_text: c.front_text, art_direction: c.art_direction, palette: c.palette,
          typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', quality,
        }),
      });
      const rj: any = await rr.json();
      const img = rj.imageUrl
        ? `<img src="${rj.imageUrl}" alt="${esc(c.front_text)}">`
        : `<div class="fail">render failed</div>`;
      return `<figure>
        ${img}
        <figcaption>
          <span class="angle">${esc(c.angle)}</span>
          <strong>&ldquo;${esc(c.front_text)}&rdquo;</strong>
          <span class="meta">${esc(c.typeface ?? '')}</span>
          <span class="meta">${esc(c.palette ?? '')}</span>
        </figcaption>
      </figure>`;
    }));

    rows.push(`<section>
      <h2>${esc(brief.interest)} <span class="for">for ${esc(brief.who)} &middot; ${esc(brief.occasion)}</span></h2>
      <div class="row">${cells.join('')}</div>
    </section>`);
  }

  server.close();

  const html = `<!doctype html><meta charset="utf-8">
<title>Card Lab bench${rude ? ' (rude)' : ''}</title>
<style>
  body{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:32px;background:#faf9f7;color:#3A342E}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#7A7267;margin:0 0 28px}
  h2{font-size:17px;margin:32px 0 10px;text-transform:capitalize}
  .for{font-weight:400;color:#7A7267;font-size:14px;text-transform:none}
  .row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  figure{margin:0;background:#fff;border:1px solid #e8e4de;border-radius:10px;overflow:hidden}
  img{width:100%;display:block}
  .fail{aspect-ratio:1;display:grid;place-items:center;color:#b23}
  figcaption{padding:10px 12px 12px;display:flex;flex-direction:column;gap:3px}
  .angle{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b5bd2}
  .meta{font-size:11px;color:#8a8279}
  @media (max-width:800px){.row{grid-template-columns:1fr}}
</style>
<h1>Card Lab bench${rude ? ' &mdash; rude mode' : ''}</h1>
<p class="sub">Same five briefs every run, quality=${esc(quality)}. Compare against the previous sheet to see whether the engine moved forwards or backwards.</p>
${rows.join('\n')}`;

  const file = path.join(outDir, `bench${rude ? '-rude' : ''}.html`);
  await writeFile(file, html, 'utf8');
  console.log(`\n${file}`);
}

main().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
