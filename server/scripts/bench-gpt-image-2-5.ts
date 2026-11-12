// server/scripts/bench-gpt-image-2-5.ts
//
// First contact with gpt-image-2.5 (2026-09-14). One small card front on
// each OpenAI model at the same quality: does the API accept the model
// string, what does it cost per `usage`, how long does it take.
//
//   npx tsx server/scripts/bench-gpt-image-2-5.ts [low|medium]

import 'dotenv/config';
import { promises as fs } from 'fs';
import { getProvider } from '../providers/registry';

const OUT = process.env.BENCH_OUT ?? '/tmp';
const quality = (process.argv[2] ?? 'low') as 'low' | 'medium' | 'high';
const PROMPT = [
  'A greeting card front, square 1024x1024, the whole image IS the card.',
  'Risograph-style illustration: a tabby cat asleep inside an upturned birthday cake box, crumbs everywhere, one candle still lit on the floor beside it.',
  'FRONT TEXT — render EXACTLY and ONLY: "Forty. Still not a grown-up." set in a chunky hand-cut sans, two flush-left lines, top third of the card.',
  'Two-ink palette: warm orange and deep teal on cream paper. No border, no mock-up, no shadow.',
].join('\n');

async function main() {
  for (const id of ['openai-2', 'openai-2.5-flare', 'openai-2.5-sunburst']) {
    const p = getProvider(id);
    try {
      const r = await p.generate({ prompt: PROMPT, quality, size: '1024x1024', slot: 'card_lab', timeoutMs: 180_000 });
      const file = `${OUT}/bench-${id}-${quality}.png`;
      await fs.writeFile(file, Buffer.from(r.imageUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
      console.log(`✅ ${id.padEnd(20)} ${r.model.padEnd(22)} ${String(Math.round(r.durationMs / 1000)).padStart(3)}s  ${r.costUsd}  → ${file}`);
    } catch (e: any) {
      console.log(`❌ ${id.padEnd(20)} ${e?.code ?? e?.kind ?? ''} ${String(e?.message ?? e).slice(0, 200)}`);
    }
  }
  // Bench scripts settle before exit (project_seam_ledger_and_style_floors).
  await new Promise((r) => setTimeout(r, 2000));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
