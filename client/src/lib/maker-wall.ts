// client/src/lib/maker-wall.ts — the three-card landing page's wall
//
// Fourteen fronts for /create (the everyday page; the Christmas page has
// its own list in christmas-wall.ts). Built 2026-11-19 (Aidan: the
// carousel should be "a mix of ones with people in the photo and also
// have names on", names on the majority, "it will feel super personal"):
// ten carry the name or word the brief asked for, six have the person
// drawn in, four are plain. Birthdays, with one anniversary.
//
// Until now this wall came from the database (the admin's carousel picks
// padded with the birthday rack). While the rack is parked the page shows
// this fixed set instead, because the point of the wall is now to show
// what THIS route does: your person's name, and your person, on the card.
//
// All real engine output, made the same way as the Christmas wall (see
// that file). ⚠️ NOBODY HERE IS REAL: the briefs and the faces are OURS,
// so the page must not call these cards "made for real people" or a
// customer's (DMCC: no invented customers).
// Images live in client/public/maker-wall as WebP. Ids start at -101 so
// they can never collide with a catalogue row or the Christmas wall.
import type { CatalogueCard } from '@/components/catalogue/rack-wall';

const FRONTS: string[] = [
  "Linda makes a garden look easy.", // name, person
  "Nan, full house in all the ways that count", // name
  "Pete makes even a bad round look like part of the plan.", // name, person
  "Evie makes birthday slime look spectacular", // name
  "Thirty, Hannah. Mabel still runs the place, you just pay for it beautifully.", // name, person
  "Tap in. Clock off.",
  "Rob. Built for the ride. Mainly the pre-ride faff.", // name, person
  "Jake. five-a-side now counts as a full night out.", // name
  "Grandad. Best plot twist after rain.", // name, person
  "Siobhan takes her sausage dog on weekend patrol.", // name
  "The best bit of the tray gets claimed first.",
  "Anniversary walks, Sarah. Leads, treats, and you.", // name, person
  "Your kind of baking is calm, useful, and the reason everybody arrives hoping there might be leftovers.",
  "Some people turn up. You get everyone to the good bit.",
];

export const MAKER_WALL: CatalogueCard[] = FRONTS.map((front_text, i) => ({
  id: -(101 + i),
  front_text,
  imageUrl: `/maker-wall/${String(i + 1).padStart(2, '0')}.webp`,
  published: false,
}));
