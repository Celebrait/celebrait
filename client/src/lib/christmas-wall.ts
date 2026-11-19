// client/src/lib/christmas-wall.ts — the Christmas landing page's wall
//
// Fourteen fronts for /create?occasion=christmas. Rebuilt 2026-11-19
// (Aidan: the carousel should be "a mix of ones with people in the photo
// and also have names on", names on the majority, "it will feel super
// personal"): ten carry the name or word the brief asked for, six have the
// person drawn in, four are plain.
//
// All real engine output. The named ones come from briefs run through the
// production front-word rule (server/scripts/front-word-bench.ts); the
// ones with a person are those cards redrawn by the maker's own "put them
// in it" route (server/scripts/wall-cameo.ts) from portrait photos made
// for the purpose (server/scripts/wall-portraits.ts).
// ⚠️ NOBODY HERE IS REAL: the briefs and the faces are OURS, so the page
// must not call these cards "made for real people" or a customer's (DMCC:
// no invented customers). The label says what is true: each one drawn
// from a few answers.
// Images live in client/public/xmas-wall as WebP. Negative ids: these are
// not catalogue rows and must never collide with one.
import type { CatalogueCard } from '@/components/catalogue/rack-wall';

const FRONTS: string[] = [
  "Merry Christmas, Grandad. Watering round first.", // name, person
  "Nan. Merry Christmas, eyes down for mince pies.", // name
  "Jess takes the sausage dog out and the suspects with her.", // name, person
  "Santa agrees. That was a decent price for a house.",
  "Dave knows exactly which gadget earns its place at Christmas. The air fryer, obviously.", // name, person
  "Evie’s Christmas list. Biscuit fed. Biscuit cosy. Santa inspected.", // name
  "Sarah. Christmas Day starts after the lake and before the oven.", // name, person
  "Merry Christmas Tom. The washing up can see itself out", // name
  "First tracks. Then crackers.",
  "Rob knows the Christmas coffee order.", // name, person
  "Dad. Shed first. Christmas second.", // name
  "Linda keeps the border in order", // name, person
  "Evening plan: armchair, blanket, telly, headlines, gone.",
  "Merry Christmas to the one who gets everyone to reply",
];

export const CHRISTMAS_WALL: CatalogueCard[] = FRONTS.map((front_text, i) => ({
  id: -(i + 1),
  front_text,
  imageUrl: `/xmas-wall/${String(i + 1).padStart(2, '0')}.webp`,
  published: false,
}));
