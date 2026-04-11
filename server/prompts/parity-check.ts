// server/prompts/parity-check.ts
//
// Proves that the seeded v1 templates, when rendered through the resolver,
// produce BYTE-IDENTICAL output to the hardcoded buildScenePrompt /
// buildInsidePrompt functions. Run after db:push + seed-v1:
//
//   npx tsx server/prompts/parity-check.ts
//
// Exits 0 if all cases match, 1 if any diverge. This is the safety net for
// Phase 1 rollout — if parity breaks we catch it before shipping.

import 'dotenv/config';
import { buildScenePrompt, buildInsidePrompt } from '@shared/prompts';
import { resolveFrontScenePrompt, resolveInsidePrompt, invalidatePromptCache } from './resolver';

interface Case {
  name: string;
  expected: string;
  actual: string;
}

function diff(expected: string, actual: string): string {
  if (expected === actual) return '';
  let i = 0;
  while (i < expected.length && i < actual.length && expected[i] === actual[i]) i++;
  const start = Math.max(0, i - 40);
  const end = i + 80;
  return [
    `First difference at char ${i}:`,
    `  expected …${JSON.stringify(expected.slice(start, end))}…`,
    `  actual   …${JSON.stringify(actual.slice(start, end))}…`,
  ].join('\n');
}

async function main(): Promise<void> {
  invalidatePromptCache();
  const cases: Case[] = [];

  // ── front_scene cases ──
  const fs1 = {
    scenePrompt: 'Sarah on a beach at sunset with a surfboard',
    userArtStyle: 'watercolor painting',
    userClothing: 'floral summer dress',
    includeText: true,
    cardText: 'Happy Birthday Sarah',
  };
  cases.push({
    name: 'front_scene: all fields filled',
    expected: buildScenePrompt(fs1),
    actual: (await resolveFrontScenePrompt(fs1)).text,
  });

  const fs2 = {
    scenePrompt: 'A quiet forest at dawn',
    userArtStyle: 'ai_decide',
    userClothing: '',
    includeText: false,
    cardText: '',
  };
  cases.push({
    name: 'front_scene: ai_decide style, no clothing, no text',
    expected: buildScenePrompt(fs2),
    actual: (await resolveFrontScenePrompt(fs2)).text,
  });

  const fs3 = {
    scenePrompt: 'Graduation day',
    userArtStyle: 'oil painting',
    includeText: true,
    cardText: 'Congrats Tom',
  };
  cases.push({
    name: 'front_scene: no clothing field',
    expected: buildScenePrompt(fs3),
    actual: (await resolveFrontScenePrompt(fs3)).text,
  });

  // ── inside cases ──
  const in1 = {
    insideText: 'Dear Sarah, wishing you a wonderful year ahead. Love, Mum',
    artStyle: 'watercolor painting',
    structuredData: {
      dear: 'Dear Sarah',
      message: 'wishing you a wonderful year ahead',
      from: 'Love, Mum',
    },
  };
  cases.push({
    name: 'inside: fully structured greeting',
    expected: buildInsidePrompt(
      in1.insideText,
      in1.artStyle,
      undefined,
      undefined,
      in1.structuredData,
    ),
    actual: (await resolveInsidePrompt(in1)).text,
  });

  const in2 = {
    insideText: 'Thinking of you',
    artStyle: 'ai_decide',
  };
  cases.push({
    name: 'inside: plain message, ai_decide style',
    expected: buildInsidePrompt(in2.insideText, in2.artStyle),
    actual: (await resolveInsidePrompt(in2)).text,
  });

  const in3 = {
    insideText: 'Have a great one',
    artStyle: 'oil painting',
    structuredData: { dear: 'Hey', from: 'Tom' },
  };
  cases.push({
    name: 'inside: structured with dear+from only (no message)',
    expected: buildInsidePrompt(
      in3.insideText,
      in3.artStyle,
      undefined,
      undefined,
      in3.structuredData,
    ),
    actual: (await resolveInsidePrompt(in3)).text,
  });

  // ── report ──
  let failed = 0;
  for (const c of cases) {
    if (c.expected === c.actual) {
      console.log(`  [OK]   ${c.name}`);
    } else {
      failed++;
      console.log(`  [FAIL] ${c.name}`);
      console.log(diff(c.expected, c.actual));
    }
  }

  if (failed > 0) {
    console.error(`\n${failed}/${cases.length} parity checks FAILED`);
    process.exit(1);
  }
  console.log(`\n${cases.length}/${cases.length} parity checks passed`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[PARITY] Error:', err);
  process.exit(1);
});
