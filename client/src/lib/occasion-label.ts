// client/src/lib/occasion-label.ts
//
// THE occasion display helper. Occasions are stored as slugs
// ('mothers_day', 'thankyou', 'new home') and reached three studio
// screens raw ("Test Mum · Mothers_day", launch audit 2026-10-06)
// because each surface had its own half-helper. Every display now
// routes through here:
//
//   occasionLabel('mothers_day')    → "Mother's Day"   (label position)
//   occasionLabelMid('birthday')    → "birthday"       (mid-sentence)
//   occasionLabelMid('mothers_day') → "Mother's Day"   (proper noun stays)

const LABELS: Record<string, string> = {
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  wedding: 'Wedding',
  engagement: 'Engagement',
  baby: 'New baby',
  graduation: 'Graduation',
  christmas: 'Christmas',
  valentines: "Valentine's Day",
  mothers_day: "Mother's Day",
  fathers_day: "Father's Day",
  thankyou: 'Thank you',
  sympathy: 'Sympathy',
  easter: 'Easter',
  other: 'Something else',
};

// Mid-sentence these keep their capitals; everything else lowercases.
const PROPER = new Set([
  'christmas', 'valentines', 'mothers_day', 'fathers_day', 'easter',
  'diwali', 'eid', 'hanukkah', 'new year', 'new_year',
]);

function normalise(o: string | null | undefined): string {
  return (o ?? '').trim().toLowerCase();
}

/** Label-position form: "Mother's Day", "Birthday", "New home". Unknown
 *  slugs are humanised (underscores → spaces, first letter up) rather
 *  than echoed raw. */
export function occasionLabel(o: string | null | undefined): string {
  const key = normalise(o);
  if (!key) return '';
  const known = LABELS[key];
  if (known) return known;
  const words = key.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Mid-sentence form: "Mum's birthday card", "Mum's Mother's Day card". */
export function occasionLabelMid(o: string | null | undefined): string {
  const key = normalise(o);
  if (!key) return '';
  const label = occasionLabel(key);
  return PROPER.has(key) ? label : label.toLowerCase();
}
