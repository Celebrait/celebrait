/**
 * SET ACCEPTANCE — the audit's measuring stick.
 *
 *   npx tsx server/scripts/set-acceptance-check.ts [arms]
 *   e.g.  ... current,bare        (cheap comparison)
 *         ... current,bare,short,archetype   (the full baseline)
 *
 * Scores whole SETS against ALL floors at once — the customer's actual
 * experience — across four architectures:
 *
 *   current    the live /concepts endpoint (the ~8k-token prompt)
 *   bare       Aidan's null hypothesis: brief + "make 3 cards that land"
 *   short      a ~40-line prompt + the CODE REFEREE (verify + one
 *              targeted repair round)
 *   archetype  archetype call -> short prompt + archetype -> referee
 *
 * The referee and archetype live HERE, not in the route, on purpose:
 * measure first, integrate the winner after. Floors are deterministic
 * code — no LLM judges its own homework.
 *
 * ⚠️ Hint lists are deliberately oblique-heavy (LESSONS_ENGINE.md law 9:
 * keyword checkers punish the cleverest lines). A miss on these hints
 * means genuinely generic, not merely indirect.
 */
import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

const MODEL = process.env.CARD_LAB_LLM ?? 'gpt-5.4';
const YEAR = 2026;

interface PanelBrief {
  name: string;
  who: string; age: number | null; gender?: 'him' | 'her';
  interest: string; dislikes?: string; tone: 'funny' | 'warm' | 'rude';
  interestHints: RegExp; dislikeHints?: RegExp;
}

/** Eight briefs covering every failure class we have actually seen. */
const PANEL: PanelBrief[] = [
  { name: 'THE failing set', who: 'Dad', age: 50, gender: 'him', interest: 'Oasis', dislikes: 'Manchester City', tone: 'rude',
    interestHints: /oasis|gallagher|liam|noel|wonderwall|supersonic|britpop|definitely maybe|morning glory|champagne supernova|roll with it|look back in anger|masterplan|knebworth|maine road|parka|bucket hat|mad fer|cigarettes ?& ?alcohol|manc/i,
    dislikeHints: /city|citeh|etihad|blue half|blue lot|blue mob|blue side|noisy neighbour/i },
  { name: 'franchise clean', who: 'Sister', age: 30, gender: 'her', interest: 'Harry Potter', tone: 'funny',
    interestHints: /potter|hogwarts|wizard|owl|wand|muggle|spell|gryffindor|slytherin|hufflepuff|ravenclaw|quidditch|diagon|platform|patronus|always|dumbledore|hermione|butterbeer|sorting/i },
  { name: 'gentle + warm', who: 'Nan', age: 78, gender: 'her', interest: 'her garden', tone: 'warm',
    interestHints: /garden|rose|seed|soil|compost|greenhouse|border|bloom|blossom|pot|slug|weed|sweet pea|iris|petal|trowel|kneeler|allotment|prun|dahlia|bulb|lawn|shed|bird/i },
  { name: 'rude + dislike', who: 'Best mate', age: 40, gender: 'him', interest: 'Man United away days', dislikes: 'Liverpool', tone: 'rude',
    interestHints: /united|old trafford|stretford|away|red|devils|fergie|matchday|terrace|fixture|kick-?off|turnstile|coach|pie|programme|scarf|utd/i,
    dislikeHints: /liverpool|anfield|kop|scouse|merseyside|wrong red|that lot|one lot|other lot|rival|hating reds/i },
  { name: 'kids + IP', who: 'Daughter', age: 5, gender: 'her', interest: 'Moana', tone: 'warm',
    interestHints: /moana|ocean|sea|wave|island|canoe|outrigger|voyage|wayfind|shell|palm|tropical|reef|tide|sail|heihei|te fiti|how far/i },
  { name: 'ageless hobby', who: 'Friend', age: null, interest: 'fly fishing', tone: 'funny',
    interestHints: /fish|fly|flies|rod|reel|river|cast|wader|hatch|trout|salmon|lure|tackle|bank|net|feather|hook|upstream|current/i },
  { name: 'plain interest', who: 'Mum', age: 60, gender: 'her', interest: 'red wine', tone: 'funny',
    interestHints: /wine|red|glass|bottle|cork|grape|vintage|cellar|malbec|rioja|merlot|decant|tannin|vineyard|pour|uncork|breathe/i },
  { name: 'ageless neutral', who: 'Colleague', age: null, interest: 'running', tone: 'funny',
    interestHints: /run|jog|marathon|5k|10k|parkrun|trainer|pace|mile|race|medal|stretch|splits|pb|hill|treadmill|jogg/i },
];

// ── FLOORS (all deterministic) ─────────────────────────────────────
const SWEAR = /f\*+\w*|s\*+|c\*+|bollocks|bastard|wanker|prick|twat|bellend|knobhead|arse|piss|shag|tits|knob|bugger all|fuck\w*|shit\w*/i;
const MALE = /\b(man|men|bloke|lad|lads|guy|boy|he|him|his|sir|king|gent)\b/i;
const FEMALE = /\b(woman|women|lass|girl|she|her|hers|madam|queen|lady|ladies)\b/i;
const OCCASION = /\bbirthday\b|\bhappy returns\b|\bmany happy\b|\bcandles?\b|\bcake\b|\bcelebrat/i;
const REAL_DAY = new Set(['today','monday','tuesday','wednesday','thursday','friday','saturday','sunday','holiday','weekday','everyday','someday','yesterday','midday','day','days','matchday','payday','workday','doomsday','mayday']);
const portmanteau = (t: string) => (t.toLowerCase().match(/\b[a-z']*day'?s?\b/g) ?? []).some((w) => !REAL_DAY.has(w.replace(/'s$|s$/, '')));
const saysOccasion = (t: string) => OCCASION.test(t) || portmanteau(t);
const STOP = new Set(['this','that','with','your','still','from','have','been','they','them','their','what','when','then','than','just','only','more','most','very','years','year','birthday','happy','about','into','over','some','like','being','remains','perfectly','completely']);

interface Card { front_text: string; inside_text?: string; art_direction?: string; palette?: string; typeface?: string; format?: string; angle?: string }

function scoreSet(cards: Card[], b: PanelBrief): string[] {
  const v: string[] = [];
  if (cards.length !== 3) return ['not-three-cards'];
  const fronts = cards.map((c) => String(c.front_text ?? ''));
  const arts = cards.map((c) => String(c.art_direction ?? ''));
  const whole = cards.map((c, i) => `${fronts[i]} ${arts[i]}`);

  if (b.tone === 'rude' && fronts.filter((f) => SWEAR.test(f)).length < 2) v.push('rude-floor');
  if (b.dislikeHints) {
    const n = whole.filter((w) => b.dislikeHints!.test(w)).length;
    if (n === 0) v.push('dislike-missing'); if (n === 3) v.push('dislike-everywhere');
  }
  if (whole.filter((w) => b.interestHints.test(w)).length < 2) v.push('generic-set');
  if (!arts.some((a) => b.interestHints.test(a))) v.push('generic-artwork');
  const birthYear = b.age ? YEAR - b.age : null;
  for (const f of fronts) {
    const yrs = f.match(/\b(19|20)\d{2}\b/g) ?? [];
    if (yrs.some((y) => Number(y) !== birthYear)) { v.push('invented-year'); break; }
  }
  if (b.age) {
    const leadRe = new RegExp(`^\\s*${b.age}[.\\s]`);
    if (fronts.filter((f) => leadRe.test(f)).length > 1) v.push('number-template');
    const numRe = new RegExp(`\\b${b.age}\\b`);
    if (cards.some((c, i) => numRe.test(fronts[i]) && numRe.test(arts[i]))) v.push('number-twice');
  } else {
    const n = fronts.filter(saysOccasion).length;
    if (n === 0) v.push('occasion-missing'); if (n === 3) v.push('occasion-everywhere');
  }
  if (b.gender) {
    const wrong = b.gender === 'her' ? MALE : FEMALE;
    if (fronts.some((f) => wrong.test(f))) v.push('gender-clash');
  }
  const seen = new Map<string, number>();
  const briefWords = new Set(`${b.interest} ${b.who}`.toLowerCase().match(/[a-z']{4,}/g) ?? []);
  for (const f of fronts) {
    const ws = new Set(f.toLowerCase().match(/[a-z']{5,}/g)?.filter((w) => !STOP.has(w) && !briefWords.has(w)) ?? []);
    ws.forEach((w) => seen.set(w, (seen.get(w) ?? 0) + 1));
  }
  if (Array.from(seen.values()).some((n) => n >= 2)) v.push('shared-vocab');
  return v;
}

// ── ARMS ───────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const chat = async (system: string, user: string, maxTok = 4000): Promise<string> => {
  const r = await openai.chat.completions.create({
    model: MODEL, max_completion_tokens: maxTok,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_object' },
  });
  return r.choices[0]?.message?.content ?? '{}';
};

const briefText = (b: PanelBrief) => [
  `Recipient: ${b.who}${b.gender ? ` (${b.gender === 'her' ? 'she/her' : 'he/him'})` : ''}`,
  b.age ? `Age: ${b.age}` : 'Age: not stated — no age jokes, no guessed numbers',
  `They love: ${b.interest}`,
  b.dislikes ? `They cannot stand: ${b.dislikes}` : '',
  `Occasion: Birthday`, `Register: ${b.tone}${b.tone === 'rude' ? ' — real swearing expected, masked f***/s*** style' : ''}`,
].filter(Boolean).join('\n');

const CARD_JSON = 'Return JSON {"concepts":[{"angle":"...","front_text":"...","inside_text":"...","art_direction":"one sentence for the illustrator","palette":"...","typeface":"...","format":"hero"}]} — exactly three concepts.';

/** Aidan's null hypothesis, near-verbatim. */
async function bareArm(b: PanelBrief): Promise<Card[]> {
  const sys = `You design personalised UK greeting cards. Given what a customer typed, return 3 finished card concepts in any style you like. Make sure every one of them lands with the intended recipient — current, specific to them, something a British card shop would be proud to rack in ${YEAR}. ${CARD_JSON}`;
  return JSON.parse(await chat(sys, briefText(b))).concepts ?? [];
}

/** The short prompt both new arms share: craft bar, no lectures. */
const SHORT_SYS = `You write and art-direct personalised UK greeting cards — the kind a good independent shop racks in ${YEAR}. From the brief, return THREE genuinely different finished cards.

The bar, per card:
- It lands for THIS person: built from their world, not the broad category it sits in. A card that suits anyone who vaguely likes the topic has failed.
- Front line: max 8 words (one card may run to 20), says something — a joke, an observation, or the occasion said beautifully. No invented facts about their life, no years or ages the brief did not give you.
- The three cards are three different ideas, not one idea reworded, and no distinctive word appears twice.
- art_direction: one drawable sentence. Real places, caricature of public figures, the styling and kit of their world are all welcome. Never an actual logo/wordmark/crest, never a copyrighted character depicted as themselves.
- Design free: any medium, any palette, as long as it is CURRENT and suits this person. Old styles welcome if treated with a modern eye.
- If the register is rude: at least two fronts carry real (masked) swearing — the joke must survive with the swearing removed.
- If they gave a dislike: exactly ONE card is built on it, fused into the joke.
${CARD_JSON}`;

async function shortArm(b: PanelBrief, archetype?: string): Promise<Card[]> {
  const user = archetype ? `${briefText(b)}\n\nWHO THIS PERSON IS (use this to aim everything):\n${archetype}` : briefText(b);
  let cards: Card[] = JSON.parse(await chat(SHORT_SYS, user)).concepts ?? [];
  // THE REFEREE: verify in code, one targeted repair round.
  const violations = scoreSet(cards, b);
  if (violations.length) {
    const repair = `Your set broke these rules: ${violations.join(', ')}.
${violations.includes('rude-floor') ? '- At least TWO fronts need real masked swearing (f***, s***, bollocks, arse...).\n' : ''}${violations.includes('dislike-missing') ? `- Exactly one card must be built on the dislike (${b.dislikes}).\n` : ''}${violations.includes('generic-set') || violations.includes('generic-artwork') ? `- The cards must be unmistakably about ${b.interest} — including at least one ARTWORK. Use its own places, people, kit, rituals.\n` : ''}${violations.includes('invented-year') ? '- Remove any year the brief did not give you.\n' : ''}${violations.includes('gender-clash') ? '- Remove gendered words that contradict the recipient.\n' : ''}${violations.includes('number-template') ? `- Only one front may open with the bare number ${b.age}.\n` : ''}${violations.includes('occasion-missing') ? '- Exactly one front must say what the occasion is.\n' : ''}Fix ONLY what is broken, keep everything good. Return the complete corrected JSON.`;
    cards = JSON.parse(await chat(SHORT_SYS, `${user}\n\nYOUR PREVIOUS ATTEMPT:\n${JSON.stringify({ concepts: cards })}\n\n${repair}`)).concepts ?? cards;
  }
  return cards;
}

async function archetypeArm(b: PanelBrief): Promise<Card[]> {
  const arch = await chat(
    `You profile card recipients for a UK card maker. Given a brief, return JSON {"archetype":"..."} — 100-140 words on: the era they came of age in; what they ACTUALLY react to about this interest (the famous layer a non-fan would know, plus the insider rituals); what reads as cliché to them vs genuinely current; where the line is on cheek for this relationship. Concrete, ${YEAR}, UK.`,
    briefText(b), 1500,
  );
  return shortArm(b, JSON.parse(arch).archetype ?? '');
}

// ── RUN ────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const arms = (process.argv[2] ?? 'current,bare,short,archetype').split(',');
  const app = express(); app.use(express.json());
  app.use((req: any, _r, n) => { req.session = { otpUserId: process.env.LAB_ADMIN_USER_ID }; n(); });
  registerAdminCardLabRoutes(app);
  const server = app.listen(0);
  const port = (server.address() as any).port;

  const currentArm = async (b: PanelBrief): Promise<Card[]> => {
    const r = await fetch(`http://localhost:${port}/api/admin/card-lab/concepts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ who: b.who, gender: b.gender ?? 'unspecified', occasion: 'Birthday',
        age: b.age ?? undefined, interest: b.interest, dislikes: b.dislikes, tone: b.tone,
        insideMode: 'auto', freeStyle: true, characters: 'objects' }),
    });
    return ((await r.json()) as any).concepts ?? [];
  };

  // live-celebrait / live-open hit the REAL route's v2 pipeline — the
  // wired version of what the archetype/short arms prototyped.
  const liveArm = (pipeline: string) => async (b: PanelBrief): Promise<Card[]> => {
    const r = await fetch(`http://localhost:${port}/api/admin/card-lab/concepts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ who: b.who, gender: b.gender ?? 'unspecified', occasion: 'Birthday',
        age: b.age ?? undefined, interest: b.interest, dislikes: b.dislikes, tone: b.tone,
        insideMode: 'auto', freeStyle: true, characters: 'objects', pipeline }),
    });
    return ((await r.json()) as any).concepts ?? [];
  };
  const ARMS: Record<string, (b: PanelBrief) => Promise<Card[]>> = {
    current: currentArm, bare: bareArm, short: (b) => shortArm(b), archetype: archetypeArm,
    'live-celebrait': liveArm('celebrait'), 'live-open': liveArm('open'),
  };

  // ⚠️ FULL RESULTS TO DISK, always. Aidan: "FYI I need to see these" —
  // the pass/fail number is my score; the CARDS are his. Every run
  // writes everything it generated to /tmp/set-acceptance-results.json
  // so a human-readable sheet can be built from any run after the fact.
  const dump: any[] = [];
  for (const arm of arms) {
    const fn = ARMS[arm]; if (!fn) continue;
    console.log(`\n${'='.repeat(64)}\nARM: ${arm.toUpperCase()}`);
    let clean = 0; const tally = new Map<string, number>();
    const results = await Promise.all(PANEL.map(async (b) => {
      try { return { b, cards: await fn(b) }; } catch (e: any) { return { b, cards: [], err: String(e?.message ?? e) }; }
    }));
    for (const { b, cards, err } of results as any[]) {
      const v = err ? ['error'] : scoreSet(cards, b);
      if (!v.length) clean += 1;
      v.forEach((x: string) => tally.set(x, (tally.get(x) ?? 0) + 1));
      console.log(`\n  ${v.length ? 'FAIL' : 'PASS'}  ${b.name}${v.length ? '  [' + v.join(', ') + ']' : ''}`);
      (cards as Card[]).forEach((c) => console.log(`        "${c.front_text}"`));
      dump.push({ arm, brief: b.name, who: b.who, age: b.age, interest: b.interest, dislikes: b.dislikes ?? null, tone: b.tone, violations: v, cards, err: err ?? null });
    }
    console.log(`\n  >>> ${arm}: ${clean}/${PANEL.length} sets clean`);
    if (tally.size) console.log(`      violations: ${Array.from(tally.entries()).map(([k, n]) => `${k}×${n}`).join('  ')}`);
  }
  const { writeFile } = await import('node:fs/promises');
  await writeFile('/tmp/set-acceptance-results.json', JSON.stringify(dump, null, 2));
  console.log('\nfull results -> /tmp/set-acceptance-results.json');
  server.close(); process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
