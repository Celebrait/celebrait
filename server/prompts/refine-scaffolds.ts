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
// What's in scope here
// ────────────────────
// Just the wrapper text + the side enum. The model call itself
// (provider.refine) is the caller's job, as is anchor-image
// selection (Studio loads from `cards.frontImagePath`; PL loads from
// the operator's last test-run output or an upload).

export type RefineSide = 'front' | 'inside';

/** Slot value written to `generation_log.slot` for each side's refine
 *  call. Cost Ledger filters on these to break out regen spend
 *  separately from initial-gen spend. */
export const REFINE_SLOT: Record<RefineSide, string> = {
  front: 'front_scene_regen',
  inside: 'inside_regen',
};

export const VALID_REFINE_SIDES: readonly RefineSide[] = ['front', 'inside'];

/**
 * Build the instruction text passed to provider.refine() for a given
 * side. Wraps the user's tweak in side-appropriate "preserve what's
 * already there, only change X" language so the model edits rather
 * than re-rolls.
 *
 *   - Front: scene-style framing. Reminds the model to preserve
 *     composition, character likeness, and on-card text.
 *   - Inside: layout/text-style framing. Reminds the model to
 *     preserve the message text and layout, and notes the front
 *     image (passed as a referencePhoto by the caller) is a style
 *     anchor for continuity.
 *
 * Edit these sentences here when iterating; both Studio and the PL
 * will pick up the change on the same deploy.
 */
export function buildRefineInstruction(
  side: RefineSide,
  tweak: string,
): string {
  const trimmed = tweak.trim();
  if (side === 'front') {
    return (
      `Modify this greeting card image as follows: ${trimmed}. ` +
      `Keep the existing composition, character likeness, on-card text, ` +
      `and overall art style consistent — only change what the ` +
      `instruction explicitly asks for.`
    );
  }
  return (
    `Modify this greeting card inside as follows: ${trimmed}. ` +
    `Keep the existing layout, message text, and overall art style ` +
    `consistent — only change what the instruction explicitly asks ` +
    `for. The other reference image is the card's matching front ` +
    `face; keep this inside stylistically continuous with it.`
  );
}
