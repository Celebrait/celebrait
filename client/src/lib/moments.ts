// client/src/lib/moments.ts
//
// Shared vocabulary of the Moments system — used by BOTH the studio
// home's world section and the full-year /studio/moments river, so the
// two surfaces can never disagree about what a moment is or when the
// nationals fall.

export interface UpcomingReminder {
  occasionId: number;
  entryId: number;
  recipientName: string;
  relationship: string | null;
  occasion: string;
  occurrenceDate: string;
  daysUntil: number;
  suppressed: boolean;
  suppressedUntil: string | null;
}

// National moments: public-fact dates, resolved client-side. Movable
// feasts are a lookup table (Mothering Sunday tracks Easter; Father's
// Day is the third Sunday of June) — a table is auditable at a glance,
// an Easter computation is not. Extend before 2030.
const NATIONAL_TABLE: Record<string, string[]> = {
  "Mother's Day": ['2026-03-15', '2027-03-07', '2028-03-26', '2029-03-11', '2030-03-31'],
  "Father's Day": ['2026-06-21', '2027-06-20', '2028-06-18', '2029-06-17', '2030-06-16'],
};

export interface NationalMoment {
  label: string;
  occurrenceDate: string;
  daysUntil: number;
  prompt: string;
}

export function nextNationalMoments(today: Date): NationalMoment[] {
  const out: NationalMoment[] = [];
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = (iso: string) =>
    Math.round((new Date(iso + 'T00:00:00').getTime() - midnight.getTime()) / 86_400_000);

  for (const [label, dates] of Object.entries(NATIONAL_TABLE)) {
    const next = dates.find((d) => days(d) >= 0);
    if (next) {
      out.push({
        label,
        occurrenceDate: next,
        daysUntil: days(next),
        prompt:
          label === "Mother's Day"
            ? 'Who’s your Mother’s Day card for?'
            : 'Who’s your Father’s Day card for?',
      });
    }
  }
  for (const [label, mmdd, prompt] of [
    ["Valentine's Day", '02-14', 'Someone in mind?'],
    ['Christmas', '12-25', 'Who gets the first card of Christmas?'],
  ] as const) {
    const thisYear = `${today.getFullYear()}-${mmdd}`;
    const iso = days(thisYear) >= 0 ? thisYear : `${today.getFullYear() + 1}-${mmdd}`;
    out.push({ label, occurrenceDate: iso, daysUntil: days(iso), prompt });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function fmtMomentDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
}

export function countdownLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 30) return `${days} days`;
  if (days < 60) return 'Next month';
  return new Date(Date.now() + days * 86_400_000).toLocaleDateString('en-GB', {
    month: 'long',
  });
}

/** Warm-gradient stand-ins for person tiles until the craft pass wires
 *  each person's own card art. Deterministic per name so a person keeps
 *  their colour between renders and pages. */
export function personGradient(name: string): string {
  const palettes = [
    'radial-gradient(120% 120% at 20% 15%,#ffd9a8 0%,#ff9d76 38%,#b06ab3 100%)',
    'radial-gradient(120% 120% at 25% 20%,#9be7ff 0%,#5aa9ff 45%,#2b3f9e 100%)',
    'radial-gradient(120% 120% at 25% 20%,#ffe29a 0%,#8fd694 55%,#2e7d54 100%)',
    'radial-gradient(120% 120% at 25% 20%,#fbc2eb 0%,#a6c1ee 60%,#5c57d4 100%)',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

/** Occasions are stored lowercase; display them like a person wrote
 *  them. */
export function occasionLabel(o: string): string {
  return o.charAt(0).toUpperCase() + o.slice(1);
}
