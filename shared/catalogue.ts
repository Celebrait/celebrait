// shared/catalogue.ts
//
// HOW A CARD GETS SHELVED. One definition of the aisles, used by the
// studio's coverage view and (later) the generated category pages, so
// the shop and its SEO can never disagree about what a card is.
//
// WHY IT IS DERIVED RATHER THAN STORED: milestone and audience band
// both fall out of `age`, so storing them would just be two more
// columns to get out of sync. Gender is the exception — it cannot be
// derived, and is a real column on card_templates for that reason.
//
// The aisle names come from the market rather than from us: see
// PLAN_CATALOGUE_TAXONOMY.md and RESEARCH_UK_CARD_MARKET.md. Moonpig's
// own birthday navigation was pulled 2026-08-19.

/** Milestones the market actually racks.
 *
 *  ⚠️ CHILDREN GET EVERY YEAR, ADULTS GET DECADES. This is not a
 *  tidiness choice, it is how the aisles are built: Moonpig runs a
 *  separate page for 1st, 2nd, 3rd … 13th, because a four-year-old
 *  wants a card with a 4 on it and the buyer searches "4th birthday
 *  card". Above the teen line nobody shops for a 37th, so it collapses
 *  to 16/18/21 and then the decades. 90th and 100th exist but are too
 *  thin to build for. */
export const MILESTONES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
  16, 18, 21, 30, 40, 50, 60, 70, 80,
] as const;

/** 1st, 2nd, 3rd, 4th… — the aisle label, not just the number. */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

export type AudienceBand =
  | 'baby' | 'kids' | 'tween' | 'teen' | 'young-adult' | 'adult' | 'senior';

/** ⚠️ KIDS IS A DIFFERENT PRODUCT, NOT A DIFFERENT PALETTE — the words
 *  are written for the adult reading them aloud, the artwork must
 *  belong to the child, rude is off and the age-roast is off. Anything
 *  from 'young-adult' up is one product with a tone dial. */
export const AUDIENCE_BANDS: Array<{ key: AudienceBand; label: string; min: number; max: number }> = [
  { key: 'baby', label: 'Baby', min: 0, max: 1 },
  { key: 'kids', label: 'Kids', min: 2, max: 9 },
  { key: 'tween', label: 'Tween', min: 10, max: 12 },
  { key: 'teen', label: 'Teen', min: 13, max: 17 },
  { key: 'young-adult', label: 'Young adult', min: 18, max: 24 },
  { key: 'adult', label: 'Adult', min: 25, max: 64 },
  { key: 'senior', label: 'Senior', min: 65, max: 130 },
];

export function audienceBand(age: number | null | undefined): AudienceBand | null {
  if (typeof age !== 'number' || !Number.isFinite(age)) return null;
  return AUDIENCE_BANDS.find((b) => age >= b.min && age <= b.max)?.key ?? null;
}

export function isMilestone(age: number | null | undefined): boolean {
  return typeof age === 'number' && (MILESTONES as readonly number[]).includes(age);
}

/** Is this card for a child? Drives the rules that actually differ —
 *  no rude, no age-roast, artwork pitched at the recipient. */
export function isKidsCard(age: number | null | undefined): boolean {
  const b = audienceBand(age);
  return b === 'baby' || b === 'kids' || b === 'tween';
}

export interface ShelvableCard {
  occasion?: string | null;
  recipient?: string | null;
  age?: number | null;
  gender?: string | null;
  tone?: string | null;
  interest?: string | null;
}

/** Slugify for aisle URLs. Kept here so the shop and the sitemap cannot
 *  drift apart on how a recipient becomes a path segment. */
export function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** EVERY aisle this card belongs in. A card sits on several shelves at
 *  once, which is the point — one 60th card for Dad is stock for the
 *  60th aisle, the Dad aisle and the For Him aisle simultaneously.
 *
 *  ⚠️ A card with NO gender in its brief belongs in BOTH gender aisles,
 *  not a third one. It suits anyone, so it is stock everywhere rather
 *  than stock nowhere — which is also why `gender` is nullable and the
 *  studio drops 'unspecified' instead of storing it. */
export function aislesFor(card: ShelvableCard): string[] {
  const out: string[] = [];
  const occasion = slug(card.occasion ?? 'birthday');
  out.push(occasion);

  if (isMilestone(card.age)) out.push(`${occasion}/${ordinal(card.age as number)}`);
  const band = audienceBand(card.age);
  if (band) out.push(`${occasion}/${band}`);

  if (card.recipient) out.push(`${occasion}/for-${slug(card.recipient)}`);

  if (card.gender === 'her') out.push(`${occasion}/for-her`);
  else if (card.gender === 'him') out.push(`${occasion}/for-him`);
  else { out.push(`${occasion}/for-her`); out.push(`${occasion}/for-him`); }

  if (card.tone) out.push(`${occasion}/${slug(card.tone)}`);
  if (card.interest) out.push(`${occasion}/${slug(card.interest)}`);

  return Array.from(new Set(out));
}
