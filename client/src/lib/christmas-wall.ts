// client/src/lib/christmas-wall.ts — the Christmas landing page's wall
//
// Fourteen fronts for /create?occasion=christmas (2026-11-18). Real
// engine output from the Christmas look test: each was written and drawn
// from a typed brief (who, age, vibe, what they love). ⚠️ The briefs were
// OURS, written to test the engine, so the page must not call these
// cards "made for real people" (DMCC: no invented customers). The label
// on the page says what is true: each one drawn from a few answers.
// Images live in client/public/xmas-wall as WebP. Negative ids: these are
// not catalogue rows and must never collide with one.
import type { CatalogueCard } from '@/components/catalogue/rack-wall';

const FRONTS: string[] = [
  'Merry Christmas to the only walk improved by a tiny coat, then gin',
  'Merry Christmas. Eyes down. Pens up.',
  'First tracks. Then crackers.',
  "Merry Christmas to Biscuit's favourite cuddler",
  'Merry Christmas. Fully shed-uled.',
  'Santa took the dawn dip.',
  'Merry Christmas to the one who gets everyone to reply',
  'Christmas in the shed. Five more, then back in for pudding.',
  'Slime in full Christmas mode',
  'Seed topped up. Robins fed. Santa held to inspection.',
  'Santa agrees. That was a decent price for a house.',
  'Christmas belongs at the table with good books, sharp takes and proper digressions.',
  'Evening plan: armchair, blanket, telly, headlines, gone.',
  'The air fryer earns Christmas.',
];

export const CHRISTMAS_WALL: CatalogueCard[] = FRONTS.map((front_text, i) => ({
  id: -(i + 1),
  front_text,
  imageUrl: `/xmas-wall/${String(i + 1).padStart(2, '0')}.webp`,
  published: false,
}));
