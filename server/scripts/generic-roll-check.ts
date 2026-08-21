// GENERIC ROLL CHECK — the fully blank brief.
//
// WHY (Aidan, 2026-08-20, first real test of the generic roll): "none
// of these are funny? All the same colour and vibe?" — three handsome,
// quiet, cream-and-navy cards from a FUNNY brief. The generic brief
// line was instructing "warm and middle register", overriding the tone
// chip, and nothing asked the three to differ in colour.
//
// So this checks the two things that failed: does the tone survive to
// the words, and do the three cards look like three cards.
// Usage: npx tsx server/scripts/generic-roll-check.ts [runs] [tone] [age]
// An age turns it into the AGE-ONLY spine check (the milestone branch)
// rather than the fully blank one.
import 'dotenv/config';
import express from 'express';
import { registerAdminCardLabRoutes } from '../routes/admin-card-lab';

const app = express();
app.use(express.json({ limit: '12mb' }));
// Stands in for the admin session the real route requires — the route
// checks session.otpUserId against users.isAdmin, so a real dev admin
// id has to be supplied via ADMIN_USER_ID.
const ADMIN_ID = process.env.ADMIN_USER_ID;
if (!ADMIN_ID) { console.error('Set ADMIN_USER_ID to a dev user with isAdmin=true'); process.exit(1); }
app.use((req: any, _res, next) => { req.session = { otpUserId: ADMIN_ID }; next(); });
registerAdminCardLabRoutes(app);

const server = app.listen(0, async () => {
  const port = (server.address() as any).port;
  const runs = Number(process.argv[2] ?? 2);
  const tone = process.argv[3] ?? 'funny';
  const age = process.argv[4] ? Number(process.argv[4]) : undefined;
  const interest = process.argv[5] ?? '';
  const who = process.argv[6] ?? 'Anyone';
  const freeComposition = process.argv[7] === 'free' ? true : process.argv[7] === 'dealt' ? false : undefined;
  const gender = (process.argv[8] === 'him' || process.argv[8] === 'her') ? process.argv[8]
    : who === 'Sister' || who === 'Mum' || who === 'Nan' ? 'her'
    : who === 'Brother' || who === 'Dad' || who === 'Grandad' ? 'him' : undefined;
  for (let i = 0; i < runs; i++) {
    const r = await fetch(`http://localhost:${port}/api/admin/card-lab/concepts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        // OCC env var overrides the occasion — the non-birthday worlds
        // are testable too (activated 2026-08-21).
        occasion: process.env.OCC ?? (age ? `${age}th Birthday` : 'Birthday'), who, gender, tone, pipeline: 'celebrait', age, freeComposition,
        interest, dislikes: '', characters: 'objects', insideMode: 'blank',
        freeStyle: true, memory: true,
      }),
    });
    const j: any = await r.json();
    console.log(`\n### RUN ${i + 1} (${tone}${age ? ', age ' + age : ', blank'}) — status ${r.status} — mode ${j.compMode ?? '?'}`);
    if (!j.concepts) { console.log('   ', JSON.stringify(j).slice(0, 300)); continue; }
    for (const c of j.concepts) {
      console.log(`    [${c.angle}/${c.format}] "${c.front_text}"`);
      console.log(`        palette: ${c.palette}`);
      console.log(`        art:     ${c.art_direction}`);
    }
  }
  server.close(); process.exit(0);
});
