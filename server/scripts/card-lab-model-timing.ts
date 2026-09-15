import 'dotenv/config';
import { registerAdminCardLabRoutes, CONCEPT_MODEL } from '../routes/admin-card-lab';
import express from 'express';

async function main() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { otpUserId: process.env.LAB_ADMIN_USER_ID }; next(); });
  registerAdminCardLabRoutes(app);
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const t0 = Date.now();
  const r = await fetch(`http://localhost:${port}/api/admin/card-lab/concepts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ who: 'Dad', occasion: '60th Birthday', interest: 'ocean beach club ibiza',
      insideMode: 'auto', cheeky: false, characters: 'objects' }),
  });
  const j: any = await r.json();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const label = `${CONCEPT_MODEL}${process.env.CARD_LAB_EFFORT ? '/' + process.env.CARD_LAB_EFFORT : ''}`;
  console.log(`\n${label}  —  ${secs}s`);
  for (const c of j.concepts ?? []) console.log(`   "${c.front_text}"`);
  if (!j.concepts) console.log('   ERROR', JSON.stringify(j).slice(0, 150));
  server.close();
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
