/**
 * BAND BLEED — is each age band telling its OWN joke?
 *
 *   npx tsx server/scripts/band-bleed-check.ts
 *
 * WHY. Aidan on a first run of 18ths, 2026-08-19: "right side is ok...
 * other 2 are not great are they?" Both failures were the same thing —
 * the band borrowing material that belongs to a different one.
 *
 * "18 is mainly forms, passwords and a hangover" is a THIRTIES joke
 * wearing an 18 (and was assembled almost verbatim out of the examples
 * I had written into the threshold brief — the prompt-leakage law,
 * walked into again). "18. Proof Of Ageing" resolves cleanly as a pun
 * and lands on AGEING, a decline joke, on the one birthday that is
 * entirely about arriving.
 *
 * The six bands were rebuilt from the aisle scans a day earlier, so
 * this is the failure mode to expect: they are new, and each one's
 * material is one paragraph away from its neighbours'.
 *
 * Checks the two ends, where the arc is steepest:
 *   THRESHOLD (18/21) — no life-admin material, no ageing jokes.
 *   ELEVATION (70/80) — no decline, frailty or memory jokes.
 */
import 'dotenv/config';
import express from 'express';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

/** Thirties-and-beyond material. Wrong on a threshold card. */
const LATER_BAND = /\b(forms?|passwords?|insurance|mortgages?|admin|paperwork|knees?|backache|early nights?|pensions?|tax returns?)\b/i;

/** ⚠️ "OLD ENOUGH" IS NOT AN AGEING JOKE — it is arrival language, and
 *  the first version of this checker flagged "18. Old enough to be
 *  asked for ID. Young enough to look surprised every time." as a
 *  failure. That is one of the best lines the band produced. Third time
 *  in three days a keyword test has marked the good card wrong; the
 *  lookahead is the whole fix. */
const AGEING = /\bage(ing|d)\b|\bgetting on\b|\bover the hill\b|\bwrinkl\w*|\bgrey hairs?\b|\bold(?!\s+enough)\b|\bpast it\b/i;

/** Never right on an elevation card. */
const DECLINE = /\bfrail\w*|\bmemory\b|\bforget\w*|\bdeaf\b|\bhow much longer\b|\bfalling apart\b|\bnot long left\b|\bdecrepit\b/i;

const CASES = [
  { age: 18, tone: 'funny', wrong: [['later', LATER_BAND], ['ageing', AGEING]] },
  { age: 21, tone: 'cheeky', wrong: [['later', LATER_BAND], ['ageing', AGEING]] },
  { age: 70, tone: 'funny', wrong: [['decline', DECLINE]] },
  { age: 80, tone: 'warm', wrong: [['decline', DECLINE]] },
] as const;

async function main(): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { otpUserId: process.env.LAB_ADMIN_USER_ID };
    next();
  });
  registerAdminCardLabRoutes(app);
  const server = app.listen(0);
  const port = (server.address() as any).port;

  let bleeds = 0, total = 0;

  for (const c of CASES) {
    const res = await fetch(`http://localhost:${port}/api/admin/card-lab/concepts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        who: 'Anyone', occasion: 'Birthday', age: c.age, tone: c.tone,
        insideMode: 'auto', cheeky: false, freeStyle: true, characters: 'objects',
      }),
    });
    const json: any = await res.json();
    const concepts: any[] = json.concepts ?? [];
    console.log(`\n### ${c.age}, ${c.tone}`);
    if (!concepts.length) { console.log('  NO CONCEPTS'); continue; }
    concepts.forEach((k: any) => {
      const t = String(k.front_text);
      const hit = c.wrong.find(([, re]) => (re as RegExp).test(t));
      total += 1; if (hit) bleeds += 1;
      console.log(`  ${hit ? String(hit[0]).toUpperCase().padEnd(6) : '  ok  '}"${t}"`);
    });
  }

  console.log(`\n${'='.repeat(56)}`);
  console.log(`${bleeds}/${total} fronts borrowed another band's joke (want 0)`);
  server.close();
  process.exit(bleeds ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
