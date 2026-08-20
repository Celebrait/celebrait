// PRINT THE PROMPTS — exactly what the two calls send, for a real brief.
//
// Aidan, 2026-08-20: "Show me the prompt please." The engine is two
// calls (archetype, then writer) and the writer's prompt is assembled
// per-request from the occasion brief, the age band and the three
// server-chosen slots — so no single string in the source IS the
// prompt. This builds one for a given brief and prints it.
//
// Usage: npx tsx server/scripts/print-prompts.ts [age] [tone]
import 'dotenv/config';
import { archetypeSystemPrompt, v2SystemPrompt, pickAngles, birthdayProfile } from '../routes/admin-card-lab';

const age = process.argv[2] ? Number(process.argv[2]) : 18;
const tone = process.argv[3] ?? 'funny';

const rule = (t: string) => `\n${'═'.repeat(72)}\n${t}\n${'═'.repeat(72)}\n`;

const angles = pickAngles(tone);
const slots = angles.map((a, i) => ({
  angle: a,
  format: i === 0 ? 'typeled' : ['statement', 'hero', 'label'][i - 1],
  register: i === 0 ? 'long' : 'mid',
  territory: `«territory ${i + 1} — filled in at runtime from the archetype's reply»`,
}));

console.log(rule('CALL 1 of 2 — THE ARCHETYPE (system)'));
console.log(archetypeSystemPrompt());
console.log(rule('CALL 1 of 2 — THE ARCHETYPE (user: the brief lines)'));
console.log([`Occasion: ${age}th Birthday`,
  '⚠️ NO INTEREST GIVEN — THE MILESTONE IS THE SUBJECT. …(full text in the writer prompt below)',
  `cheeky=${tone === 'rude'}`].join('\n'));

console.log(rule(`CALL 2 of 2 — THE WRITER (system) — tone=${tone}, age=${age}`));
console.log(v2SystemPrompt('celebrait', slots, birthdayProfile(tone as any, age).brief));
process.exit(0);
