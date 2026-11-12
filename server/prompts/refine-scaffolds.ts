// server/prompts/refine-scaffolds.ts
//
// SHARED instruction scaffolds for image-edit (refine) calls.
//
// IMPORT FROM HERE — both Studio (background-generator.ts) and Prompt
// Lab (routes/prompts.ts) call the same builder so the wrapper text
// stays in lockstep across surfaces. Iterating on the wrapper means
// editing this file; production and the lab automatically share the
// new behaviour.
//
// Why this module exists
// ─────────────────────
// 2026-04-26: Studio shipped a refine-based regen flow with the
// instruction wrapper inlined as a string in background-generator.ts.
// The Prompt Lab's `/test-refine` route was using the user's raw
// instruction with no wrapper, so the lab couldn't reproduce
// production behaviour. The wrapper is the single most load-bearing
// string in the regen experience — it has to live in one place.
//
// See `project_prompt_lab_first.md` in Kevin's memory notes for the
// rule this enforces: prompt-related code is PL-first, scaffolds live
// in shared modules, no inline strings in Studio surfaces.
//
// 2026-05-05 — Mode detection added (Kevin's "Congrats Gx" repro)
// ─────────────────────────────────────────────────────────────
// Earlier scaffold said "keep the existing composition, character
// likeness, on-card text consistent" — too polite. Models treated it
// as a suggestion, not a constraint. Two failure modes observed:
//
//   1. User asks for a SCENE change ("remove the motorbike, add a
//      bay window"). Model re-renders the floor around the change,
//      damaging the scene-integrated lettering painted there.
//
//   2. User asks for a TEXT change ("redo the wording so it's flat").
//      Model treats it as licence to redo the whole image — style
//      drifts, scene composition mutates, character changes pose.
//
// Fix: keyword-detect the user's intent and dispatch to one of two
// scaffolds — `scene-edit` (text LOCKED) or `text-edit` (scene
// LOCKED). Stronger imperative language in both. The single most
// reliable way to keep an image model focused is to be explicit
// about what NOT to touch.
//
// What's in scope here
// ────────────────────
// Just the wrapper text + the side enum + the intent detector. The
// model call itself (provider.refine) is the caller's job, as is
// anchor-image selection (Studio loads from `cards.frontImagePath`;
// PL loads from the operator's last test-run output or an upload).

export type RefineSide = 'front' | 'inside';

/** Two intents the refine scaffold can dispatch on. Picked by keyword
 *  detection in `detectRefineIntent`. */
export type RefineIntent = 'scene-edit' | 'text-edit';

/** Slot value written to `generation_log.slot` for each side's refine
 *  call. Cost Ledger filters on these to break out regen spend
 *  separately from initial-gen spend. */
export const REFINE_SLOT: Record<RefineSide, string> = {
  front: 'front_scene_regen',
  inside: 'inside_regen',
};

export const VALID_REFINE_SIDES: readonly RefineSide[] = ['front', 'inside'];

/* ─── Intent detection ─────────────────────────────────────────────
 *
 * If the tweak instruction mentions text/wording/lettering in any
 * form, treat it as a text-edit. Otherwise it's a scene-edit.
 *
 * False-positive risk: a tweak like "make her shirt say 'no'" would
 * route to text-edit and lock the scene. Acceptable — adding text to
 * a shirt IS a text-edit, even if conceptually scene-y.
 *
 * False-negative risk: "make it look more like a postcard" might
 * affect text style without mentioning text. We accept this — the
 * scaffold's text-preservation language is now strong enough that
 * even scene-edit mode tries hard not to break the text. The
 * downstream model is the final arbiter.
 *
 * Patterns ordered by specificity. Word boundaries (\b) prevent
 * matches inside other words ("attext" would match "text" without
 * the \b).
 */
const TEXT_EDIT_PATTERNS: RegExp[] = [
  /\b(?:text|wording|words?|word|letter|letters|lettering|font|fonts|typography|typeset|inscription|caption|signature)\b/i,
  /\b(?:writing|written|handwritten|handwriting|calligraphy|script|message)\b/i,
  /\bsays?\b/i,
  /\b(?:add|change|swap|replace|remove|delete|edit|fix|tidy|tidier|make|redo|rewrite)\s+(?:the\s+)?(?:wording|text|message|writing|words?|letters?|font|caption)\b/i,
  /\b(?:on the card|on card|over the|across the)\b.*\b(?:text|writing|words?|letters?|font|message)\b/i,
  /\b(?:flat|bigger|smaller|move|reposition|recenter|center|centre|align|cleaner|tidier)\b.*\b(?:text|wording|words?|letters?|font|writing|message)\b/i,
];

export function detectRefineIntent(tweak: string): RefineIntent {
  const t = tweak.toLowerCase();
  for (const pattern of TEXT_EDIT_PATTERNS) {
    if (pattern.test(t)) return 'text-edit';
  }
  return 'scene-edit';
}

/* ─── Scaffolds ────────────────────────────────────────────────────
 *
 * Imperative tone. Capital-letter LOCKED for emphasis. Concrete
 * instructions about what NOT to touch (more reliable than vague
 * "preserve" language).
 */

/** SCENE-EDIT mode (most regens). User wants to change the scene —
 *  swap a prop, recolour, change weather, etc. The on-card text
 *  must stay PIXEL-IDENTICAL. Composition flexes around the
 *  requested change. */
function buildSceneEditScaffold(side: RefineSide, tweak: string): string {
  if (side === 'front') {
    return (
      `Modify this greeting card image as follows: ${tweak}.\n\n` +
      `LOCKED — DO NOT MODIFY UNDER ANY CIRCUMSTANCES:\n` +
      `• The on-card text/lettering/wording must remain EXACTLY as it ` +
      `appears in the original. Same words, same characters, same ` +
      `handwriting / typography style, same position, same colour, ` +
      `same size, same orientation. Do not redraw, restyle, reposition, ` +
      `recolour, or re-letter ANY text on the card. Treat all visible ` +
      `text as pixel-locked elements that must be carried forward ` +
      `unchanged.\n` +
      `• Character likeness — the same person, same face, same hair, ` +
      `same expression, same pose, same outfit. Do not redraw the ` +
      `subject.\n` +
      `• Overall art style — same illustration approach, same colour ` +
      `palette, same lighting mood. Do not switch render styles.\n\n` +
      `FREE TO CHANGE — only what the instruction above explicitly asks ` +
      `for. Make the requested edit cleanly without touching anything ` +
      `else.`
    );
  }
  // inside
  return (
    `Modify this greeting card INSIDE as follows: ${tweak}.\n\n` +
    `LOCKED — DO NOT MODIFY UNDER ANY CIRCUMSTANCES:\n` +
    `• The message text content — every word, every character, every ` +
    `punctuation mark must remain EXACTLY as it appears. Do not ` +
    `rephrase, retype, restyle, or move the message text.\n` +
    `• Layout structure — the same overall arrangement of text and ` +
    `decoration. Do not relayout the spread.\n` +
    `• Overall art style — keep the inside stylistically continuous ` +
    `with the front (passed as the reference image).\n\n` +
    `FREE TO CHANGE — only what the instruction above explicitly asks ` +
    `for. The other reference image is the card's matching front face; ` +
    `do not redraw it, only use it to anchor style continuity.`
  );
}

/** TEXT-EDIT mode (user explicitly wants to change text). Scene is
 *  LOCKED — composition, character, props, lighting, palette all
 *  pixel-identical. ONLY the text changes per the instruction. */
function buildTextEditScaffold(side: RefineSide, tweak: string): string {
  if (side === 'front') {
    return (
      `Modify this greeting card image as follows: ${tweak}.\n\n` +
      `Apply this change ONLY to the text/lettering/wording on the card. ` +
      `Do not touch any other element of the image.\n\n` +
      // 2026-07-07 (Kevin's "Congrats G → Congrats Steve" repro): the
      // model APPENDED the new wording under the old instead of
      // replacing it. His manual fix was adding "and nothing else" —
      // this block bakes that hard push in for everyone.
      `TEXT REPLACEMENT IS TOTAL. If the instruction changes or replaces ` +
      `the wording, the OLD wording must be COMPLETELY REMOVED — erased ` +
      `as if it was never there — and ONLY the new wording rendered in ` +
      `its place, in the same lettering style and position as the ` +
      `original. NEVER show both old and new. NEVER keep any word, ` +
      `letter or fragment of the previous text anywhere in the image. ` +
      `Before finishing, read the card back: if ANY of the previous ` +
      `wording is still visible, the edit has FAILED — remove it.\n\n` +
      `LOCKED — DO NOT MODIFY UNDER ANY CIRCUMSTANCES:\n` +
      `• Character — same person, same face, same hair, same expression, ` +
      `same pose, same outfit. PIXEL-IDENTICAL.\n` +
      `• Scene composition — same room, same furniture, same props, ` +
      `same window, same view through the window, same lighting, same ` +
      `time of day, same camera angle. Every non-text element must ` +
      `remain EXACTLY as it appears.\n` +
      `• Art style — same illustration approach, same render style, same ` +
      `colour palette, same texture treatment. Do not switch styles.\n\n` +
      `FREE TO CHANGE — ONLY the text/lettering itself, exactly as the ` +
      `instruction asks. Apply the requested text change as if you ` +
      `were a typographer editing one element of an otherwise frozen ` +
      `composition.`
    );
  }
  return (
    `Modify this greeting card INSIDE as follows: ${tweak}.\n\n` +
    `Apply this change ONLY to the text/wording inside the card. Do not ` +
    `touch any other element.\n\n` +
    `TEXT REPLACEMENT IS TOTAL. If the instruction changes or replaces ` +
    `any wording, the OLD wording must be COMPLETELY REMOVED and ONLY ` +
    `the new wording rendered in its place. NEVER show both old and ` +
    `new. Before finishing, read the spread back: if ANY of the ` +
    `previous wording is still visible, the edit has FAILED — remove ` +
    `it.\n\n` +
    `LOCKED — DO NOT MODIFY UNDER ANY CIRCUMSTANCES:\n` +
    `• Layout structure — same overall arrangement of decorative ` +
    `elements, same margins, same alignment.\n` +
    `• Decorative art — any borders, illustrations, motifs around the ` +
    `text must remain pixel-identical.\n` +
    `• Style — same handwriting / typeface feel, same colour palette ` +
    `(unless the instruction explicitly asks for a colour change).\n\n` +
    `FREE TO CHANGE — ONLY the text content/style itself, per the ` +
    `instruction. The reference image is the card's matching front face; ` +
    `keep stylistic continuity.`
  );
}

/**
 * Build the instruction text passed to provider.refine() for a given
 * side. Wraps the user's tweak in a side-and-intent-appropriate
 * scaffold so the model edits rather than re-rolls.
 *
 * Intent dispatch:
 *   - text-edit (mentions text/wording/letters/font/etc.) → scene
 *     elements LOCKED, only text changes per the instruction
 *   - scene-edit (default) → on-card text LOCKED, scene flexes
 *     around the requested change
 *
 * The detector is keyword-based; not perfect but high enough recall
 * to dispatch most cases correctly. Even when it mis-routes, both
 * scaffolds carry strong preservation language for the locked element.
 *
 * Edit these sentences here when iterating; both Studio and the PL
 * pick up the change on the same deploy.
 */
export function buildRefineInstruction(
  side: RefineSide,
  tweak: string,
): string {
  const trimmed = tweak.trim();
  const intent = detectRefineIntent(trimmed);
  return intent === 'text-edit'
    ? buildTextEditScaffold(side, trimmed)
    : buildSceneEditScaffold(side, trimmed);
}
