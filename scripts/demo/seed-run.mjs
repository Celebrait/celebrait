// Make one saved, approved photo run to drive — from an existing finished
// draft, photo included, so a replay has everything it needs.
//   node seed-run.mjs [draftId]        → prints the new run id
import { chromium } from 'playwright';
import { BASE, signIn, api } from './lib.mjs';

const draftId = Number(process.argv[2] ?? 338);
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await signIn(p);

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
