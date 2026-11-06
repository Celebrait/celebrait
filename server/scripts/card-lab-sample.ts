/**
 * Render Quirky card fronts straight to PNG files, bypassing the Lab UI.
 *
 * The Lab returns images as data URLs to the browser and never writes them
 * anywhere, which makes it awkward to (a) compare style revisions side by
 * side and (b) get a file to push through composeCardPrintStrip for the
 * Prodigi test print. This does both: same prompt assembly as the
 * /render endpoint, PNGs on disk.
 *
 *   npx tsx server/scripts/card-lab-sample.ts <concepts.json> <outDir> [quality]
 *
 * concepts.json is an array of { angle, format, front_text, palette,
 * art_direction } — exactly the shape /api/admin/card-lab/concepts
 * returns, so you can paste a set straight out of the Lab.
 */
import 'dotenv/config';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  quirkyDna,
  freeStyleDna,
  QUIRKY_FORMATS,
  IS_THE_CARD_ITSELF,
  type CharacterLevel,
} from '../routes/admin-card-lab';
import { getProvider } from '../providers/registry';

interface SampleConcept {
  angle: string;
  format: string;
  front_text: string;
  palette?: string;
  typeface?: string;
  art_direction: string;
  /** Per-concept, because free style is now half the surface we test and
   *  a bug that only shows with the house style stepped aside (the
   *  card-drawn-as-an-object one did) is untestable without it. */
  freeStyle?: boolean;
  characters?: CharacterLevel;
}

async function main(): Promise<void> {
  const [, , conceptsPath, outDir, qualityArg] = process.argv;
  if (!conceptsPath || !outDir) {
    console.error('usage: card-lab-sample.ts <concepts.json> <outDir> [low|medium|high]');
    process.exit(1);
  }
  const quality = (qualityArg ?? 'low') as 'low' | 'medium' | 'high';
  const characters: CharacterLevel = 'objects';

  const concepts: SampleConcept[] = JSON.parse(await readFile(conceptsPath, 'utf8'));
  await mkdir(outDir, { recursive: true });

  const provider = getProvider('openai-2');

  for (let i = 0; i < concepts.length; i++) {
    const c = concepts[i];
    const level = c.characters ?? characters;
    const prompt = [
      c.freeStyle ? freeStyleDna(level) : quirkyDna(level),
      '',
      QUIRKY_FORMATS[c.format] ?? QUIRKY_FORMATS.hero,
      '',
      `ILLUSTRATION: ${c.art_direction}`,
      c.palette ? `PALETTE (obey exactly): ${c.palette}` : '',
      c.typeface ? `TYPE (obey exactly — this card's lettering personality): ${c.typeface}. Draw the words in that idiom, and draw it well.` : '',
      '',
      `FRONT TEXT — render EXACTLY and ONLY: "${c.front_text}". Set it per the TYPOGRAPHY block: a real typeface, stacked into 2-3 flush-aligned lines, printing perfectly clean with no texture, distressing or stray marks on the letters, sitting in its own clear zone of ground. Every word legible, nothing cropped. ABSOLUTELY NO other text, letters, numbers, signatures or watermarks anywhere in the image.`,
      '',
      `Square 1024x1024. ${IS_THE_CARD_ITSELF}`,
    ].join('\n');

    const result = await provider.generate({ prompt, quality, size: '1024x1024', slot: 'card_lab' });
    const base64 = String(result.imageUrl).replace(/^data:image\/\w+;base64,/, '');
    const file = path.join(outDir, `${i + 1}-${c.angle}.png`);
    await writeFile(file, Buffer.from(base64, 'base64'));
    console.log(`${file}  ${result.provider}/${result.model}  ${result.durationMs}ms  ${result.costCents}c`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
