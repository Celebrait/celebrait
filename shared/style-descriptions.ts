// shared/style-descriptions.ts
//
// The three customer-facing style modes in the Studio (animAIted /
// reAIlistic / Custom) map to detailed art-direction strings fed into
// the front-scene prompt as `userArtStyle`. Those strings live here so
// client copy and server-side generation agree.
//
// Why three, not the Lab's larger palette? The Studio deliberately
// constrains customer choice — one "warm animated" house style plus
// one photoreal option plus a Custom escape. The Lab retains more
// presets for experimentation. See ROADMAP_IDEAS.md "Customer-facing
// style system".
//
// The Lab's admin-prompts.tsx has near-duplicates of these strings for
// its preset dropdown. Leaving those alone for now — the Lab can
// migrate to reading from this file in a later cleanup.

import type { StyleMode } from './models/card-draft';

/** Warm animated illustration — the default, Gemini-tuned house style. */
export const STUDIO_STYLE_ANIMATED =
  'Warm, modern animated illustration with a premium, polished feel. The character should be a stylised but clearly recognisable version of themselves — expressive features, warm natural smile, lively eyes with visible highlights. Proportions are gently stylised: not full cartoon but not photorealistic — the appealing middle ground where someone looks at it and says "that looks like me, but better." Smooth, confident rendering with soft cel-shading — gentle shadow shapes rather than harsh lines, with warm ambient light throughout. Colour palette is rich and inviting: warm sunset oranges, golden ambers, soft teals, dusty pinks, and deep but never cold blues. The overall lighting should feel like golden hour — warm, flattering, slightly magical. Environment rendered with the same warmth: simplified but atmospheric backgrounds with depth, soft bokeh, and gentle environmental details that tell the story of the scene. The overall impression should be unmistakably a "Celebrait card" — warm enough for a mum, fun enough for a mate, premium enough to frame.';

/** Photoreal cinematic portrait — for customers who want a film-still feel. */
export const STUDIO_STYLE_REALISTIC =
  'Photorealistic cinematic portrait with the quality of a high-budget film still. Shot on an ARRI Alexa with anamorphic lenses — natural skin texture with visible pores, fine facial hair, and authentic imperfections. Shallow depth of field with creamy bokeh in the background. Lighting is dramatic and intentional: warm golden key light from one side, cool blue-purple fill from the other, soft rim light separating the subject from the background. Natural film grain throughout. Colour grading is cinematic: lifted shadows with a slight teal tint, warm midtones, desaturated but rich highlights. Skin has natural subsurface scattering — warm translucency on ears and nose. Hair has individual strand detail catching the light. Clothing has real fabric texture and natural draping. The character must look EXACTLY like the reference photo — photorealistic, not stylised. Every facial feature preserved with maximum fidelity. Background has real-world environmental detail with atmospheric haze and depth.';

/** Resolve a Studio draft's style choice to the art-direction string the
 *  front-scene prompt expects. Custom is passed through verbatim — the
 *  Studio's 15-char-minimum check lives in the step component. */
export function resolveStyleDescription(
  mode: StyleMode | undefined,
  custom: string | undefined,
): string {
  switch (mode) {
    case 'animated':
      return STUDIO_STYLE_ANIMATED;
    case 'realistic':
      return STUDIO_STYLE_REALISTIC;
    case 'custom':
      return (custom ?? '').trim();
    default:
      // Fall back to animated — matches the Studio's implicit default.
      return STUDIO_STYLE_ANIMATED;
  }
}
