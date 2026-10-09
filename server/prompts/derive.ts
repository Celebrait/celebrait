// server/prompts/derive.ts
//
// Pure helpers that turn user-facing inputs (scenePrompt, artStyle, …) into
// the full variable map that our templates expect, including the derived
// boolean flags that drive {{#if}} branches (noClothing, aiDecideStyle,
// hasStructuredGreeting, …).
//
// Extracted from resolver.ts so both the resolver (for real generation) and
// the /api/admin/prompts/test-run endpoint (for the Prompt Lab test panel)
// can share exactly the same rendering behaviour. No duplication, no drift.

export interface FrontSceneVars {
  scenePrompt: string;
  userArtStyle?: string;
  userClothing?: string;
  includeText?: boolean;
  cardText?: string;
  /** Three photo scenarios the FRONT_SCENE prompt branches on:
   *   - 'one_person'       = one or more photos, all the SAME individual
   *                          (single portrait or multi-angle identity anchor).
   *   - 'multi_individual' = N separate photos, each a DIFFERENT person;
   *                          all should appear together in the output scene.
   *   - 'group'            = ONE photo that contains multiple people.
   *  Absent/undefined = legacy behaviour (no photo-mode preamble). */
  photoMode?: 'one_person' | 'multi_individual' | 'group';
  /** How many reference photos were uploaded. */
  photoCount?: number;
  /** Typography layout: 'scene_integrated' = carved in sand, painted on
   *  walls, etc. 'movie_poster' = large text behind/around the character
   *  as background typography. */
  textLayout?: 'scene_integrated' | 'movie_poster';
  /** When true, a character anchor has been prepended to the prompt and
   *  the generic 8-point facial recreation section should be skipped. */
  hasCharacterAnchor?: boolean;
}

export interface InsideVars {
  insideText: string;
  artStyle?: string;
  structuredData?: {
    dear?: string | null;
    message?: string | null;
    from?: string | null;
  } | null;
}

export type RenderVars = Record<string, string | boolean | undefined>;

export function deriveFrontSceneVars(vars: FrontSceneVars): RenderVars {
  const hasUserClothing = !!vars.userClothing?.trim();
  const hasUserArtStyle = !!(
    vars.userArtStyle &&
    vars.userArtStyle.trim() &&
    vars.userArtStyle !== 'ai_decide'
  );
  const isOnePerson = vars.photoMode === 'one_person';
  const isMultiIndividual = vars.photoMode === 'multi_individual';
  const isGroup = vars.photoMode === 'group';
  const photoCount = vars.photoCount ?? 1;
  return {
    scenePrompt: vars.scenePrompt,
    userArtStyle: hasUserArtStyle ? vars.userArtStyle! : '',
    userClothing: hasUserClothing ? vars.userClothing! : '',
    noClothing: !hasUserClothing,
    aiDecideStyle: !hasUserArtStyle,
    includeText: !!(vars.includeText && vars.cardText?.trim()),
    /** The missing else-branch (Aidan's Maui card, 2026-08-14): with
     *  includeText false the template said NOTHING about text, and the
     *  image model invented its own slogan ("LIVING MY BEST LIFE MAUI
     *  STYLE!"). Silence is not an instruction. This powers the
     *  {{#if noText}} zero-text block in the front_scene templates. */
    noText: !(vars.includeText && vars.cardText?.trim()),
    cardText: vars.cardText ?? '',
    // Photo mode flags — used by {{#if}} blocks in the template to
    // give the model explicit context about what the reference images
    // represent (same person multi-angle vs multiple individual photos
    // of different people vs one photo containing a group).
    isOnePerson,
    isMultiIndividual,
    isGroup,
    hasMultiplePhotos: photoCount > 1,
    photoCount: String(photoCount),
    isSceneIntegrated: vars.textLayout !== 'movie_poster',
    isMoviePoster: vars.textLayout === 'movie_poster',
    hasCharacterAnchor: !!vars.hasCharacterAnchor,
    noCharacterAnchor: !vars.hasCharacterAnchor,
  };
}

export function deriveInsideVars(vars: InsideVars): RenderVars {
  const hasArtStyle = !!(vars.artStyle && vars.artStyle !== 'ai_decide');
  const hasStructuredGreeting = !!(
    vars.structuredData?.dear || vars.structuredData?.from
  );
  return {
    insideText: vars.insideText,
    artStyle: hasArtStyle ? vars.artStyle! : '',
    noArtStyle: !hasArtStyle,
    dear: vars.structuredData?.dear ?? '',
    message: vars.structuredData?.message ?? '',
    from: vars.structuredData?.from ?? '',
    hasStructuredGreeting,
    noStructuredGreeting: !hasStructuredGreeting,
    hasDear: !!vars.structuredData?.dear,
    hasMessage: !!vars.structuredData?.message,
    hasFrom: !!vars.structuredData?.from,
  };
}
