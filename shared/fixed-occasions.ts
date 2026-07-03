// shared/fixed-occasions.ts
//
// Occasions whose date the calendar already knows — so the user never
// enters one, and reminders resolve the date DYNAMICALLY each cycle
// (no stored date, no drift on the moveable feasts, no backfill).
//
// UK dates (Celebrait is UK-only):
//   • Christmas      — 25 December
//   • Valentine's    — 14 February
//   • Mother's Day   — Mothering Sunday = 4th Sunday of Lent = 3 weeks
//                      before Easter Sunday (March, moves each year).
//                      NOT the US "2nd Sunday of May".
//   • Father's Day   — 3rd Sunday of June
//
// All dates are UTC-midnight, matching the reminder system's date maths.

export const FIXED_DATE_OCCASIONS = new Set([
  'christmas',
  'valentines',
  'mothers_day',
  'fathers_day',
]);

export function isFixedDateOccasion(occasion: string): boolean {
  return FIXED_DATE_OCCASIONS.has(occasion);
}

/** Gregorian Easter Sunday for `year`, as a UTC date. Anonymous Gregorian
 *  ("Meeus/Jones/Butcher") computus. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** UK Mothering Sunday — 3 weeks before Easter Sunday. */
export function motheringSunday(year: number): Date {
  const easter = easterSunday(year);
  return new Date(easter.getTime() - 21 * 24 * 60 * 60 * 1000);
}

/** The `n`th (1-based) `weekday` (0 = Sunday) of a month, UTC. */
function nthWeekdayOfMonth(year: number, month0: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month0, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month0, 1 + offset + (n - 1) * 7));
}

/** The date a fixed occasion falls on in a given calendar year (UTC
 *  midnight), or null if `occasion` isn't a fixed-date occasion. */
export function fixedOccasionDateForYear(occasion: string, year: number): Date | null {
  switch (occasion) {
    case 'christmas':
      return new Date(Date.UTC(year, 11, 25)); // 25 Dec
    case 'valentines':
      return new Date(Date.UTC(year, 1, 14)); // 14 Feb
    case 'mothers_day':
      return motheringSunday(year);
    case 'fathers_day':
      return nthWeekdayOfMonth(year, 5, 0, 3); // 3rd Sunday of June
    default:
      return null;
  }
}

/** The next occurrence of a fixed occasion on or after `today` (UTC
 *  midnight). Rolls to next year once this year's date has passed. */
export function nextFixedOccasionDate(occasion: string, today: Date): Date | null {
  const year = today.getUTCFullYear();
  const thisYear = fixedOccasionDateForYear(occasion, year);
  if (!thisYear) return null;
  if (thisYear.getTime() >= today.getTime()) return thisYear;
  return fixedOccasionDateForYear(occasion, year + 1);
}
