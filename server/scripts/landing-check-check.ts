/**
 * Regression test for the LANDING CHECK — the bouncer that stands between
 * the writer and the rack.
 *
 *   npx tsx server/scripts/landing-check-check.ts
 *
 * WHY THIS ONE COSTS MONEY. The other check scripts here
 * (artefact-floor-check, occasion-classifier-check, birthday-age-check)
 * are regexes and pure functions, so they run free. This one is a model
 * judging taste, which is exactly why it needs pinning: it is the only
 * guard in the pipeline with no deterministic floor underneath it, and a
 * prompt edit that quietly makes it trigger-happy would start binning
 * good quiet cards without anyone noticing. One run is about 1p.
 *
 * THE CASES ARE ALL REAL. Every failure below actually shipped to Aidan
 * in the Lab and was rejected by him. The two PASS cases matter as much
 * as the kills — a bouncer that kills everything is not a bouncer.
 */
import 'dotenv/config';
import OpenAI from 'openai';
import { landingCheckPrompt } from '../routes/admin-card-lab';

interface Case {
  name: string;
  brief: string;
  line: string;
  look: string;
  colours: string;
  lettering: string;
  want: 'pass' | 'kill';
  /** Only checked on a kill — which half should it name? */
  wantWhat?: 'words' | 'look';
}

const CASES: Case[] = [
  // ── THE ONE THAT PROMPTED ALL THIS ───────────────────────────────
  // Aidan, 2026-08-18: "for me the middle one is wasted... there's no
  // way that look and feel lands for Moana". The LINE is good. The card
  // was a bright orange ground with heavy blue poster type — a fine
  // piece of design belonging to no world at all, on a card for a
  // four-year-old. Before this, the check was only ever shown the line,
  // so it could not have caught this if it wanted to.
  {
    name: 'wrong-world look, good line (Moana, age 4)',
    brief: 'Birthday card for my daughter turning 4. She is obsessed with Moana.',
    line: 'The ocean has been informed. You are 4.',
    look: 'typeled — no illustration, the words set enormous across the card',
    colours: 'bright marigold ground with bold cobalt blue type and a red full stop',
    lettering: 'heavy grotesque poster sans, Swiss and graphic',
    want: 'kill',
    wantWhat: 'look',
  },

  // ── CONTROLS: BOTH OF THESE MUST SURVIVE ─────────────────────────
  // Same set, same brief. Aidan kept both. If a prompt edit ever kills
  // one of these, the edit is wrong, however good it looks on paper.
  {
    name: 'on-world look, playful line (Moana, age 4)',
    brief: 'Birthday card for my daughter turning 4. She is obsessed with Moana.',
    line: 'Fourana',
    look: 'hero — a cresting paper wave with a small canoe, tropical leaves below',
    colours: 'turquoise ground, deep teal, coral accent, sunshine yellow',
    lettering: 'chunky playful rounded type, childlike without being babyish',
    want: 'pass',
  },
  // Plain, warm, no joke at all, on a look that plainly belongs to its
  // subject. Nothing here is clever and nothing needs to be: the prompt
  // says in as many words that quiet and plain are passes, and this is
  // the case that holds it to that. A bouncer hunting for brilliance
  // empties the rack.
  {
    name: 'plain and warm, nothing clever, on-world (gardening, nan)',
    brief: "Birthday card for my nan. She is 78 and lives in her garden.",
    line: 'Happy birthday to the best gardener we know',
    look: 'statement — a stack of terracotta pots and a row of seed packets',
    colours: 'soft sage ground, terracotta, cream, deep pink accent',
    lettering: "gentle sign-painter's script, warm and generous",
    want: 'pass',
  },

  // ── THE ADULT WHO LOVES A KIDS' FILM ─────────────────────────────
  // Aidan kept this one: "was good as the card was for dad". It is here
  // because it is the exact false positive the new age rule could
  // spring — the recipient is a grown man, the look is children's-book
  // gouache, and read carelessly that is "childish look on an adult's
  // card, kill it". It is not. The storybook idiom belongs to the
  // SUBJECT, and the subject is a children's film the recipient loves.
  // Age rules the look only where the subject leaves it free.
  //
  // It also earns its place as the case that caught ME: run first
  // against the daughter's brief instead of dad's, it was killed as
  // "about dad, not her" — correct reasoning, wrong input.
  //
  // ⚠️ DO NOT WRITE THIS EXCEPTION INTO THE PROMPT. It passes on
  // judgement alone, and spelling it out as an explicit clause was
  // TRIED and made things WORSE — 5/5 became 4/5 twice, and the case
  // it broke was the nan one, nowhere near the rule that was edited.
  // The extra length diluted a guard on the other side of the prompt.
  // Same lesson as the condensed front-scene prompt: past a point,
  // more words drown the rules already there.
  {
    name: "adult recipient, children's-film subject, storybook look",
    brief: 'Birthday card for my dad. He loves Moana, watches it with the grandkids.',
    line: 'Dad takes Moana very seriously',
    look: 'statement — a carved wooden oar with shells and a rolled map, palm leaves',
    colours: 'warm sand ground, island green, deep pink, ocean blue',
    lettering: "warm confident mid-century children's book lettering",
    want: 'pass',
  },

  // ── THE WORDS FAILURE, so the two halves stay distinguishable ────
  // The original landing-check case. Names the ground, means nothing.
  // The look here is deliberately GOOD, so a check that lazily blames
  // the artwork fails this case.
  {
    name: 'nonsense line, good look (Man United)',
    brief: 'Birthday card for my dad, he is 60 and a lifelong Manchester United fan.',
    line: 'A Proper Old Traffordy',
    look: 'statement — a folded matchday programme and a chipped enamel mug',
    colours: 'oxblood ground, terrace red accent, cream, slate',
    lettering: 'condensed poster gothic, terrace-chant energy',
    want: 'kill',
    wantWhat: 'words',
  },
];

async function main(): Promise<void> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // One request, all cases — the check runs on a whole set in production,
  // so testing it card-by-card would be testing a different thing.
  const res = await openai.chat.completions.create({
    model: process.env.CARD_LAB_LLM ?? 'gpt-5.4',
    max_completion_tokens: 2000,
    temperature: 0.2,
    messages: [
      { role: 'system', content: landingCheckPrompt() },
      {
        role: 'user',
        content: [
          // Production sends ONE brief and three cards; here each case
          // carries its own, so the brief is stated per card.
          'Each card below was written for its own brief, given with it.',
          '',
          'THE CARDS:',
          ...CASES.map((c, i) => [
            `${i + 1}. BRIEF: ${c.brief}`,
            `   LINE: "${c.line}"`,
            `   LOOK: ${c.look}`,
            `   COLOURS: ${c.colours}`,
            `   LETTERING: ${c.lettering}`,
          ].join('\n')),
        ].join('\n'),
      },
    ],
    response_format: { type: 'json_object' },
  });

  const verdicts = JSON.parse(res.choices[0]?.message?.content ?? '{}').cards ?? [];
  let failures = 0;

  CASES.forEach((c, i) => {
    const v = verdicts[i] ?? {};
    const got = v.verdict === 'kill' ? 'kill' : 'pass';
    const verdictOk = got === c.want;
    // "what" is only meaningful on a kill, and only checked when the
    // case pins it. A kill for the right reason is the whole point:
    // killing the Moana card for its WORDS would be the wrong repair.
    const whatOk = got !== 'kill' || !c.wantWhat || v.what === c.wantWhat;
    const ok = verdictOk && whatOk;
    if (!ok) failures += 1;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${c.name}`,
      `\n        want ${c.want}${c.wantWhat ? `/${c.wantWhat}` : ''}`,
      `· got ${got}${v.what ? `/${v.what}` : ''}`,
      v.why ? `— "${v.why}"` : '',
    );
  });

  console.log(`\n${CASES.length - failures}/${CASES.length} cases correct`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
