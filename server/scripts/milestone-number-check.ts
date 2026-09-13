/**
 * MILESTONE NUMBERS — is the age said once, or twice?
 *
 *   npx tsx server/scripts/milestone-number-check.ts
 *
 * WHY. Aidan on a set of 18ths, 2026-08-19: every card carried a big 18
 * in the artwork AND opened its line with the number and a full stop —
 * printed twice, on all three. It reads as a mistake rather than a
 * design, and three fronts opening identically is one template three
 * times. Milestone cards are the bulk of the catalogue spine, so this
 * would have been on most of the rack.
 *
 * ⚠️ THE CAUSE IS THE PART WORTH REMEMBERING: the rules written to STOP
 * it were causing it. Both the anti-duplication rule and the threshold
 * band's failure example RENDERED the pattern literally, so every
 * instruction telling the writer not to use that opening was showing it
 * the opening. Rewriting them to DESCRIBE the shape rather than print
 * it took the rate from 8/9 to 3/9. The prompt-leakage law applies to
 * anti-leak rules too.
 *
 * Two bars: at most ONE front per set may open with the bare number,
 * and NONE may state it in the words while the artwork also draws it.
 */
import 'dotenv/config';
import express from 'express';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';
(async () => {
  const app = express(); app.use(express.json());
  app.use((req: any, _r, n) => { req.session = { otpUserId: process.env.LAB_ADMIN_USER_ID }; n(); });
  registerAdminCardLabRoutes(app);
  const s = app.listen(0); const port = (s.address() as any).port;
  let leads = 0, total = 0;
  for (const age of [18, 30, 60]) {
    const r = await fetch(`http://localhost:${port}/api/admin/card-lab/concepts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ who: 'Anyone', occasion: 'Birthday', age, tone: 'funny',
        insideMode: 'auto', cheeky: false, freeStyle: true, characters: 'objects' }),
    });
    const j: any = await r.json();
    console.log(`\n### ${age}`);
    (j.concepts ?? []).forEach((c: any) => {
      const lead = new RegExp(`^\\s*${age}[.\\s]`).test(c.front_text);
      const inArt = new RegExp(`\\b${age}\\b`).test(String(c.art_direction ?? ''));
      const both = lead && inArt;
      total++; if (lead) leads++;
      console.log(`  ${both ? 'BOTH!' : lead ? 'lead ' : inArt ? 'art  ' : '     '} "${c.front_text}"`);
    });
  }
  console.log(`\n${leads}/${total} fronts open with the bare number (want <= 1 per set of 3)`);
  s.close(); process.exit(0);
})();
