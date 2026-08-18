/**
 * What a set of cards ACTUALLY costs, from measured prompt sizes and
 * published per-token prices.
 *
 * Built 2026-08-17 after a $10 day: the working figure of ~2p a set had
 * only ever counted image OUTPUT and ignored prompt tokens entirely,
 * which turned out to be the largest single line on the bill.
 *
 * Prices are per OpenAI's published table, Aug 2026.
 *
 * ⚠️ MEASURED 2026-08-18 — the estimate below was 2.7x TOO HIGH.
 * A controlled run of 10 sets (30 cards) on an otherwise-idle day cost
 * $0.51, against a predicted $1.37. Actuals:
 *
 *     per set          $0.051   (~4p)
 *     per card         $0.017   (~1.3p)
 *     image prompt     62,811 tokens = $0.31  (62% OF THE BILL)
 *     llm prompt       31,072 tokens = $0.08
 *     per render       2,094 tokens (predicted 2,929)
 *     per set, writer+judge combined  3,107 tokens
 *
 * WHERE THE ESTIMATE WENT WRONG: the writer prompt was guessed at 42%
 * of this source FILE's token count, which is mostly code and comments
 * rather than prompt — that alone was ~7x out. Lesson: measure the
 * string you actually send, never a proxy for it.
 *
 * WHAT IT MEANS: at 4p a set the cost is negligible against an £8.99
 * card (0.45% COGS), so trimming the render prompt is NOT worth doing
 * for money — even though image prompt tokens really are 62% of spend,
 * 40% off them saves about 1p a set. The number that would actually
 * move: rendering at HIGH quality for print is $0.211 an image against
 * $0.006 at low — 35x, and it dwarfs everything here. That is the
 * Prodigi print-test question, not a prompt question.
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
