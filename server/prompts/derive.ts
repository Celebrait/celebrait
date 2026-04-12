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
  /** 'one_person' = multiple photos are all the same person (multi-angle
   *  identity anchoring). 'group' = one photo with multiple people. Absent
   *  or undefined = legacy behaviour (no special preamble). */
  photoMode?: 'one_person' | 'group';
  /** How many reference photos were uploaded. */
  photoCount?: number;
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
  const isGroup = vars.photoMode === 'group';
  const photoCount = vars.photoCount ?? 1;
  return {
    scenePrompt: vars.scenePrompt,
    userArtStyle: hasUserArtStyle ? vars.userArtStyle! : '',
    userClothing: hasUserClothing ? vars.userClothing! : '',
    noClothing: !hasUserClothing,
    aiDecideStyle: !hasUserArtStyle,
    includeText: !!(vars.includeText && vars.cardText?.trim()),
    cardText: vars.cardText ?? '',
    // Photo mode flags — used by {{#if}} blocks in the template to
    // give the model explicit context about what the reference images
    // represent (same person from multiple angles vs multiple people
    // in one group shot).
    isOnePerson,
    isGroup,
    hasMultiplePhotos: photoCount > 1,
    photoCount: String(photoCount),
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
