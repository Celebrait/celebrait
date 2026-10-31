// shared/no-dash.ts
//
// THE DASH IS "TEXTBOOK AI" (Aidan 2026-10-09). Model-written text that a
// customer sees on a card or on the site may not lean on an em-dash, a
// spaced en-dash used as a clause break, or a double hyphen:
//
//   "Happy birthday, Linda — for all the steady jobs…"     ✗
//   "Sixty, and still the measure — for plants and people."  ✗
//   "Well-earned. Co-op. A 21-gun salute."                   ✓ (hyphens inside words)
//   "pages 2–3"                                              ✓ (an unspaced en-dash is a range)
//
// Two tools, same law (floors live in code — LESSONS_ENGINE.md):
//   hasAiDash(text)    the floor: does this text break the rule?
//   stripAiDash(text)  the last line of defence: a deterministic rewrite
//                      run at the boundary where model text leaves the
//                      server, so a standing violation never ships a dash.
//
// stripAiDash is a punctuation repair, not a rewrite. A spaced dash between
// clauses becomes a full stop when the next word is capitalised (it reads
// as a new sentence) and a comma otherwise; an unspaced em-dash or double
// hyphen becomes a comma; a dash left dangling at the end of a line is
// dropped; a dash leaning on punctuation that is already there is dropped.
// It never touches a hyphen inside a word.

/** Em-dash / horizontal bar anywhere, a double hyphen, or an en-dash with
 *  a space on either side (an unspaced en-dash is a range: 2–3, 1990–95). */
const AI_DASH_RE = /[—―]|--|(?:^|\s)–|–(?:\s|$)/;

export function hasAiDash(text: string | null | undefined): boolean {
  if (!text) return false;
  return AI_DASH_RE.test(String(text));
}

/** One dash token with the whitespace around it, plus whether it was
 *  spaced (a clause break) or glued to the words. The en-dash only
 *  counts when it has a space on at least one side. */
const DASH_TOKEN_RE = /([ \t]*)([—―]+|--+|–+)([ \t]*)/g;

export function stripAiDash(text: string): string {
  if (!text) return text;
  // Line by line: a dash at the END of a line is dropped, and the
  // rewrite never leaks across a line break (the inside message has
  // paragraphs).
  return String(text)
    .split('\n')
    .map((line) => stripLine(line))
    .join('\n');
}

function stripLine(line: string): string {
  if (!/[–—―]|--/.test(line)) return line;
  let out = line.replace(DASH_TOKEN_RE, (whole, pre: string, dash: string, post: string, offset: number, src: string) => {
    const isEn = dash[0] === '–';
    const spaced = pre.length > 0 || post.length > 0;
    // An unspaced en-dash is a range or a compound ("2–3", "Leeds–York"): keep it.
    if (isEn && !spaced) return whole;
    const before = src.slice(0, offset).replace(/[ \t]+$/, '');
    const after = src.slice(offset + whole.length).replace(/^[ \t]+/, '');
    // Dangling at the end of the line (or the line is nothing but a dash): drop it.
    if (!after) return '';
    // Nothing before it (a leading dash, "— for Mum"): drop it.
    if (!before) return '';
    // Leaning on punctuation that already does the job: just a space.
    if (/[,.;:!?…]$/.test(before) || /^[,.;:!?…)]/.test(after)) return ' ';
    // Spaced clause break: a full stop when the next word is capitalised
    // (it reads as a new sentence), a comma otherwise.
    if (spaced) return /^[A-Z]/.test(after) ? '. ' : ', ';
    // Glued em-dash / double hyphen ("word—word", "word--word"): a comma.
    return ', ';
  });
  // Tidy: collapse runs of spaces, no space before closing punctuation,
  // no trailing whitespace.
  out = out.replace(/ {2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/[ \t]+$/, '');
  return out;
}
