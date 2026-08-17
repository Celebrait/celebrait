/**
 * What a set of cards ACTUALLY costs, from measured prompt sizes and
 * published per-token prices.
 *
 * Built 2026-08-17 after a $10 day: the working figure of ~2p a set had
 * only ever counted image OUTPUT and ignored prompt tokens entirely,
 * which turned out to be the largest single line on the bill.
 *
 * Prices are per OpenAI's published table, Aug 2026. Re-check when a
 * model changes — this file is the estimate, the invoice is the truth.
 */
import 'dotenv/config';
import { quirkyDna, QUIRKY_FORMATS } from '../routes/admin-card-lab';

const P = {
  img: { textIn: 5.00, imgOut: 30.00 },   // gpt-image-2, $/Mtok
  llm: { in: 2.50, out: 15.00 },          // gpt-5.4, $/Mtok
};
const IMG_OUT_TOKENS_LOW = 200;           // 1024x1024 low ~= $0.006
const tok = (s: string) => Math.round(s.length / 4);

const renderPrompt = quirkyDna('objects') + QUIRKY_FORMATS.hero + 'x'.repeat(800);
const rTok = tok(renderPrompt);

// Writer + judge system prompts are private; approximate from the file
// itself, which is dominated by them.
const fs = await import('node:fs/promises');
const src = await fs.readFile('server/routes/admin-card-lab.ts', 'utf8');
const writerTok = Math.round(tok(src) * 0.42);   // writer prompt share
const judgeTok  = Math.round(tok(src) * 0.14);

const concepts = (writerTok * P.llm.in + 1100 * P.llm.out) / 1e6;
const judge    = ((judgeTok + 700) * P.llm.in + 500 * P.llm.out) / 1e6;
const oneRender = (rTok * P.img.textIn + IMG_OUT_TOKENS_LOW * P.img.imgOut) / 1e6;

const set = concepts + judge + oneRender * 3;
const f = (n: number) => `$${n.toFixed(4)}`;
console.log(`render prompt: ${rTok} tokens`);
console.log(`  concepts (writer) ${f(concepts)}`);
console.log(`  judge             ${f(judge)}`);
console.log(`  render x3         ${f(oneRender * 3)}   (${f(oneRender)} each)`);
console.log(`  ---------------------------`);
console.log(`  SET OF THREE      ${f(set)}   = £${(set * 0.79).toFixed(3)}`);
console.log(`  10 sets           ${f(set * 10)}`);
console.log(`  100 sets          ${f(set * 100)}`);

// Importing the routes module opens a DB pool; nothing here needs it.
process.exit(0);
