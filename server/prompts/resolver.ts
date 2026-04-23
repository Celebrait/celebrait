// server/prompts/resolver.ts
//
// Phase 1 of the Prompt Lab. Reads the active prompt template for a given
// (slot, cardType) from the database and renders it with variable
// substitution. Falls back to the hardcoded functions in `shared/prompts.ts`
// if the DB row is missing — this keeps the app running before/during seed
// and makes the rollout safe.
//
// Call sites should import `resolvePrompt` and pass the same variables they
// used to pass to `buildScenePrompt` / `buildInsidePrompt`.

import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  promptActive,
  promptTemplates,
  PROMPT_SLOTS,
  type PromptSlot,
  type PromptTemplate,
  type PromptProvider,
  type PromptQuality,
  type PromptVariant,
} from '@shared/schema';
import { buildScenePrompt, buildInsidePrompt } from '@shared/prompts';
import {
  deriveFrontSceneVars,
  deriveInsideVars,
  type FrontSceneVars,
  type InsideVars,
} from './derive';

// In-memory cache to avoid a DB round-trip on every image generation. The
// admin UI invalidates this cache via `invalidatePromptCache()` whenever a
// template is activated (or its production config is edited).
//
// Caches the *full active config* — template + provider + quality + vars —
// so the entire production row is one read.
interface ActiveConfig {
  template: PromptTemplate;
  provider: PromptProvider | null;
  quality: PromptQuality | null;
  vars: Record<string, unknown> | null;
}
type CacheKey = string;
const configCache = new Map<CacheKey, ActiveConfig>();
const CACHE_TTL_MS = 60_000;
const cacheTimestamps = new Map<CacheKey, number>();

function cacheKey(
  slot: string,
  cardType: string | null,
  variant: string | null,
): CacheKey {
  return `${slot}::${cardType ?? ''}::${variant ?? ''}`;
}

export function invalidatePromptCache(
  slot?: string,
  cardType?: string | null,
  variant?: string | null,
): void {
  if (!slot) {
    configCache.clear();
    cacheTimestamps.clear();
    return;
  }
  // If variant unspecified, invalidate every cached entry matching (slot, cardType).
  // This covers the common "activate" flow which only knows slot+cardType.
  if (variant === undefined) {
    const prefix = `${slot}::${cardType ?? ''}::`;
    for (const key of Array.from(configCache.keys())) {
      if (key.startsWith(prefix)) {
        configCache.delete(key);
        cacheTimestamps.delete(key);
      }
    }
    return;
  }
  const key = cacheKey(slot, cardType ?? null, variant ?? null);
  configCache.delete(key);
  cacheTimestamps.delete(key);
}

/**
 * Loads the active *config* for (slot, cardType, variant) — template +
 * provider + quality + vars. Falls back in order:
 *   1. (slot, cardType, variant) — exact match
 *   2. (slot, cardType, null-variant) — card-type-specific default
 *   3. (slot, "", variant) — slot+variant default, ignoring card-type
 *   4. (slot, "", null-variant) — slot default
 * Returns null if nothing is active; callers use the hardcoded fallback.
 */
async function loadActiveConfig(
  slot: string,
  cardType: string | null,
  variant: string | null = null,
): Promise<ActiveConfig | null> {
  const key = cacheKey(slot, cardType, variant);
  const cached = configCache.get(key);
  const cachedAt = cacheTimestamps.get(key) ?? 0;
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const rowToConfig = (row: {
    prompt_templates: PromptTemplate;
    prompt_active: { provider: string | null; quality: string | null; vars: unknown };
  }): ActiveConfig => ({
    template: row.prompt_templates,
    provider: (row.prompt_active.provider as PromptProvider | null) ?? null,
    quality: (row.prompt_active.quality as PromptQuality | null) ?? null,
    vars: (row.prompt_active.vars as Record<string, unknown> | null) ?? null,
  });

  // Try each fallback step in order.
  // cardType sentinel: "" = default; variant sentinel: "" = default.
  const steps: Array<{ ct: string; v: string }> = [];
  if (cardType && variant) steps.push({ ct: cardType, v: variant });
  if (cardType) steps.push({ ct: cardType, v: '' });
  if (variant) steps.push({ ct: '', v: variant });
  steps.push({ ct: '', v: '' });

  for (const { ct, v } of steps) {
    const row = await db
      .select()
      .from(promptTemplates)
      .innerJoin(
        promptActive,
        eq(promptActive.activeTemplateId, promptTemplates.id),
      )
      .where(
        and(
          eq(promptActive.slot, slot),
          eq(promptActive.cardType, ct),
          eq(promptActive.variant, v),
        ),
      )
      .limit(1);
    if (row.length > 0) {
      const config = rowToConfig(row[0]);
      configCache.set(key, config);
      cacheTimestamps.set(key, Date.now());
      return config;
    }
  }

  return null;
}

/**
 * Substitutes {{variable}} placeholders in a template with values from the
 * provided map. Missing variables are replaced with an empty string and
 * logged. Boolean variables render as 'true' / 'false'; prefer explicit
 * conditional blocks in templates instead.
 *
 * Supports one level of conditional blocks:
 *   {{#if varName}}...{{/if}}
 * The block is kept if varName is truthy, otherwise stripped.
 */
export function renderTemplate(
  templateText: string,
  variables: Record<string, string | boolean | undefined>,
): string {
  let rendered = templateText;

  // 1. Resolve {{#if}}...{{/if}} blocks innermost-first so nesting works.
  // On each pass we only match blocks whose body contains no further
  // {{#if}} openers. Loop until no more blocks remain or we detect a
  // broken/unbalanced template.
  const innerIfPattern = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if\s)[\s\S])*?)\{\{\/if\}\}/;
  let safety = 0;
  while (innerIfPattern.test(rendered)) {
    rendered = rendered.replace(innerIfPattern, (_m, name, body) => {
      const val = variables[name];
      return val ? body : '';
    });
    if (++safety > 1000) {
      console.error('[PROMPT_RESOLVER] renderTemplate: infinite loop, aborting');
      break;
    }
  }

  // 2. Replace {{varName}} with the value (or empty).
  rendered = rendered.replace(/\{\{(\w+)\}\}/g, (_m, name) => {
    const val = variables[name];
    if (val === undefined || val === null) {
      console.warn(`[PROMPT_RESOLVER] Missing variable {{${name}}} in template`);
      return '';
    }
    return String(val);
  });

  return rendered;
}

/**
 * Resolves and renders a prompt. Phase 1 behaviour:
 *   - If a DB template is active, use it (render with vars).
 *   - Otherwise fall back to the hardcoded `shared/prompts.ts` functions
 *     so the app keeps working during the migration window.
 *
 * Returns both the rendered string and metadata that Phase 4 will log to
 * `generation_log` so we always know which template produced which image.
 */
export interface ResolvedPrompt {
  text: string;
  source: 'db' | 'fallback';
  templateId: number | null;
  templateVersion: number | null;
  slot: PromptSlot;
  cardType: string | null;
  /** Which variant of the slot's template was resolved. Null = variant-
   *  agnostic template (the default for pre-split slots + slots that
   *  don't use variants). For front_scene this mirrors photoMode. */
  variant: PromptVariant | null;
  /** Provider the admin chose for this slot in production. Null = caller
   *  should use its runtime fallback (current behaviour: OpenAI). */
  provider: PromptProvider | null;
  /** Quality tier the admin chose. Null = caller's runtime fallback. */
  quality: PromptQuality | null;
  /** Slot-specific variable overrides merged into the render. The resolver
   *  already applied these to `text`; exposed so downstream code (e.g. the
   *  generator choosing reference handling per layout) can inspect them. */
  vars: Record<string, unknown> | null;
}

export type { FrontSceneVars, InsideVars } from './derive';

export async function resolveFrontScenePrompt(
  vars: FrontSceneVars,
  cardType: string | null = null,
): Promise<ResolvedPrompt> {
  // Variant is derived directly from photoMode — the whole point of
  // the split. When photoMode is missing (legacy callers that predate
  // multi-photo UI), default to one_person since that's the overwhelming
  // majority of cards. The loadActiveConfig fallback chain will still try
  // the null-variant row if no one_person template is active.
  const variant: PromptVariant =
    vars.photoMode === 'one_person' ||
    vars.photoMode === 'multi_individual' ||
    vars.photoMode === 'group'
      ? vars.photoMode
      : 'one_person';
  const config = await loadActiveConfig(
    PROMPT_SLOTS.FRONT_SCENE,
    cardType,
    variant,
  );
  if (config) {
    // Slot-level variable overrides win over caller-supplied vars — the
    // admin's production choice is the source of truth. Only known keys are
    // merged (guards against accidental template pollution).
    const merged: FrontSceneVars = {
      ...vars,
      ...extractFrontSceneOverrides(config.vars),
    };
    return {
      text: renderTemplate(config.template.templateText, deriveFrontSceneVars(merged)),
      source: 'db',
      templateId: config.template.id,
      templateVersion: config.template.version,
      slot: PROMPT_SLOTS.FRONT_SCENE,
      cardType,
      variant: (config.template.variant as PromptVariant | null) ?? null,
      provider: config.provider,
      quality: config.quality,
      vars: config.vars,
    };
  }
  return {
    text: buildScenePrompt(vars),
    source: 'fallback',
    templateId: null,
    templateVersion: null,
    slot: PROMPT_SLOTS.FRONT_SCENE,
    cardType,
    variant,
    provider: null,
    quality: null,
    vars: null,
  };
}

// Extended form used internally by the fallback path. The resolver needs a
// couple of fields (frontPrompt, sceneDescription) that the hardcoded
// buildInsidePrompt understands but the DB templates don't — kept here so
// the fallback still works identically.
export interface InsideResolveVars extends InsideVars {
  frontPrompt?: string;
  sceneDescription?: string;
}

/**
 * Resolve the inside-card prompt for an AI-rendered written message.
 * This is the default path — customer typed Dear/Message/From in the
 * Studio (or the legacy guided flow supplied insideText) and the model
 * renders it as typography matching the card's style.
 *
 * Prompt Lab slot: `inside_write`.
 */
export async function resolveInsideWritePrompt(
  vars: InsideResolveVars,
  cardType: string | null = null,
): Promise<ResolvedPrompt> {
  return resolveInsideByMode('write', vars, cardType);
}

/**
 * Resolve the inside-card prompt for a blank-centre card. The model
 * produces a decorative border that matches the card's style; the
 * centre stays clean for a handwritten message. No text variable is
 * required by the template (v2).
 *
 * Prompt Lab slot: `inside_blank`.
 */
export async function resolveInsideBlankPrompt(
  vars: InsideResolveVars,
  cardType: string | null = null,
): Promise<ResolvedPrompt> {
  return resolveInsideByMode('blank', vars, cardType);
}

async function resolveInsideByMode(
  mode: 'write' | 'blank',
  vars: InsideResolveVars,
  cardType: string | null,
): Promise<ResolvedPrompt> {
  const slot = mode === 'blank' ? PROMPT_SLOTS.INSIDE_BLANK : PROMPT_SLOTS.INSIDE_WRITE;
  const config = await loadActiveConfig(slot, cardType, null);
  if (config) {
    return {
      text: renderTemplate(config.template.templateText, deriveInsideVars(vars)),
      source: 'db',
      templateId: config.template.id,
      templateVersion: config.template.version,
      slot,
      cardType,
      variant: (config.template.variant as PromptVariant | null) ?? null,
      provider: config.provider,
      quality: config.quality,
      vars: config.vars,
    };
  }
  // Fallback only covers write mode — the hardcoded buildInsidePrompt
  // always renders text. Blank mode with no active template would produce
  // a card with text in it, defeating the point; surface that as a clear
  // error rather than silently falling back.
  if (mode === 'blank') {
    throw new Error(
      `No active template for slot "${PROMPT_SLOTS.INSIDE_BLANK}". ` +
        `Seed and activate inside v2 (blank) before using blank mode.`,
    );
  }
  return {
    text: buildInsidePrompt(
      vars.insideText,
      vars.artStyle,
      vars.frontPrompt,
      vars.sceneDescription,
      vars.structuredData ?? undefined,
    ),
    source: 'fallback',
    templateId: null,
    templateVersion: null,
    slot,
    cardType,
    variant: null,
    provider: null,
    quality: null,
    vars: null,
  };
}

/**
 * @deprecated Call resolveInsideWritePrompt or resolveInsideBlankPrompt
 * directly. This wrapper preserves the pre-Phase-4c signature so legacy
 * callers (regeneration, guided-conversation) keep compiling; it always
 * resolves the Write mode.
 */
export async function resolveInsidePrompt(
  vars: InsideResolveVars,
  cardType: string | null = null,
): Promise<ResolvedPrompt> {
  return resolveInsideWritePrompt(vars, cardType);
}

// Pull the known front-scene overrides out of the generic `vars` jsonb.
// Anything the template doesn't recognise is dropped silently — the jsonb
// is open-ended so future keys land here without a schema change.
function extractFrontSceneOverrides(
  vars: Record<string, unknown> | null,
): Partial<FrontSceneVars> {
  if (!vars) return {};
  const out: Partial<FrontSceneVars> = {};
  if (vars.textLayout === 'scene_integrated' || vars.textLayout === 'movie_poster') {
    out.textLayout = vars.textLayout;
  }
  return out;
}
