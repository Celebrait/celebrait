// Make one saved, approved run to drive, from finished drafts.
//   node seed-run.mjs [draftId]              a PHOTO run (photo included)
//   node seed-run.mjs --cards                a THREE-CARD run, three fronts
//                                            taken from the newest finished
//                                            cards in the account
// Prints the new run id.
import { chromium } from 'playwright';
import { BASE, signIn, api } from './lib.mjs';

const wantCards = process.argv.includes('--cards');
const draftId = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 338);
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await signIn(p);

if (wantCards) {
  // Three fronts is what that route films: the reveal replays whichever
  // one was picked, and the opener leads with the same.
  const list = (await api(p, 'GET', '/api/user/cards')).body;
  const finished = (Array.isArray(list) ? list : []).filter((c) => c.frontImageUrl).slice(0, 3);
  if (finished.length < 3) { console.error(`only ${finished.length} finished cards — need 3`); process.exit(1); }
  // A fourth, distinct image stands in for "the same card with them in
  // it", so a wrong pick is obvious rather than invisible.
  const cameoSource = (Array.isArray(list) ? list : []).filter((c) => c.frontImageUrl)[3] ?? null;
  const made = await api(p, 'POST', '/api/admin/demo-runs', {
    route: 'cards',
    label: `${finished[0].recipientName ?? 'Them'} · three cards (seed)`,
    brief: { who: finished[0].recipientName ?? 'Mum', occasion: finished[0].occasion ?? 'birthday', age: '70', vibe: 'warm', thing: 'Her garden' },
    concepts: finished.map((c) => ({ front_text: c.recipientName ?? '', inside_text: 'With love.' })),
    fronts: finished.map((c) => c.frontImageUrl),
    pickedIndex: 1,
    // A real three-card run that used a photo ends on the CAMEO, not on
    // the picked front — so seed one, or anything that leads with the
    // final card cannot be tested.
    cameo: cameoSource?.frontImageUrl ?? undefined,
    inside: finished[0].insideImageUrl ?? undefined,
    words: { dear: 'Dear Mum,', message: 'Happy birthday.', from: 'Love, Aidan' },
  });
  if (made.status !== 200) { console.error('save failed', made.status, made.body); process.exit(1); }
  await api(p, 'PATCH', `/api/admin/demo-runs/${made.body.id}`, { approved: true });
  console.log(made.body.id);
  await b.close();
  process.exit(0);
}

const d = (await api(p, 'GET', `/api/studio/drafts/${draftId}`)).body;
if (!d?.frontImageUrl) { console.error(`draft ${draftId} has no front image`); process.exit(1); }
const st = d.state ?? {};

// The photo the draft used, resolved the way the client does.
let photoUrl = null;
const photoId = st.photos?.photoIds?.[0];
if (photoId != null) {
  const lib = (await api(p, 'GET', '/api/user/photos')).body;
  const row = Array.isArray(lib) ? lib.find((x) => x.id === photoId) : null;
  const path = row?.croppedStoragePath ?? row?.storagePath;
  if (path) photoUrl = `/images/${path}`;
}
if (!photoUrl) console.warn('! no photo on that draft — the replay will stop at the photo screen');

const w = st.inside?.write ?? {};
const made = await api(p, 'POST', '/api/admin/demo-runs', {
  route: 'photo',
  label: `${st.recipient?.name ?? 'Them'} · ${st.recipient?.occasion ?? 'birthday'} (seed)`,
  brief: {
    name: st.recipient?.name ?? 'Them',
    occasion: st.recipient?.occasion ?? 'birthday',
    photoMode: st.photos?.mode ?? 'one_person',
    scene: st.scene?.description ?? '',
    frontText: st.front?.text ?? '',
  },
  fronts: [d.frontImageUrl],
  inside: d.insideImageUrl ?? undefined,
  photo: photoUrl ?? undefined,
  words: { dear: w.salutation ?? '', message: w.message ?? '', from: w.signoff ?? '' },
});
if (made.status !== 200) { console.error('save failed', made.status, made.body); process.exit(1); }
await api(p, 'PATCH', `/api/admin/demo-runs/${made.body.id}`, { approved: true });
console.log(made.body.id);
await b.close();
