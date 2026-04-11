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
// template is activated.
type CacheKey = string;
const templateCache = new Map<CacheKey, PromptTemplate>();
const CACHE_TTL_MS = 60_000;
const cacheTimestamps = new Map<CacheKey, number>();

function cacheKey(slot: string, cardType: string | null): CacheKey {
  return `${slot}::${cardType ?? ''}`;
}

export function invalidatePromptCache(slot?: string, cardType?: string | null): void {
  if (!slot) {
    templateCache.clear();
    cacheTimestamps.clear();
    return;
  }
  const key = cacheKey(slot, cardType ?? null);
  templateCache.delete(key);
  cacheTimestamps.delete(key);
}

/**
 * Loads the active template for (slot, cardType) from the DB, falling back
 * to the default (cardType = "") row if no card-type-specific override
 * exists. Returns null if nothing is active yet — callers use the hardcoded
 * fallback in that case.
 */
async function loadActiveTemplate(
  slot: string,
  cardType: string | null,
): Promise<PromptTemplate | null> {
  const key = cacheKey(slot, cardType);
  const cached = templateCache.get(key);
  const cachedAt = cacheTimestamps.get(key) ?? 0;
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  // 1. Try card-type-specific override
  if (cardType) {
    const specific = await db
      .select()
      .from(promptTemplates)
      .innerJoin(
        promptActive,
        eq(promptActive.activeTemplateId, promptTemplates.id),
      )
      .where(and(eq(promptActive.slot, slot), eq(promptActive.cardType, cardType)))
      .limit(1);
    if (specific.length > 0) {
      const tpl = specific[0].prompt_templates;
      templateCache.set(key, tpl);
      cacheTimestamps.set(key, Date.now());
      return tpl;
    }
  }

  // 2. Fall back to the default (cardType = "") row
  const defaultRow = await db
    .select()
    .from(promptTemplates)
    .innerJoin(promptActive, eq(promptActive.activeTemplateId, promptTemplates.id))
    .where(and(eq(promptActive.slot, slot), eq(promptActive.cardType, '')))
    .limit(1);
  if (defaultRow.length > 0) {
    const tpl = defaultRow[0].prompt_templates;
    templateCache.set(key, tpl);
    cacheTimestamps.set(key, Date.now());
    return tpl;
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
}

export type { FrontSceneVars, InsideVars } from './derive';

export async function resolveFrontScenePrompt(
  vars: FrontSceneVars,
  cardType: string | null = null,
): Promise<ResolvedPrompt> {
  const tpl = await loadActiveTemplate(PROMPT_SLOTS.FRONT_SCENE, cardType);
  if (tpl) {
    return {
      text: renderTemplate(tpl.templateText, deriveFrontSceneVars(vars)),
      source: 'db',
      templateId: tpl.id,
      templateVersion: tpl.version,
      slot: PROMPT_SLOTS.FRONT_SCENE,
      cardType,
    };
  }
  return {
    text: buildScenePrompt(vars),
    source: 'fallback',
    templateId: null,
    templateVersion: null,
    slot: PROMPT_SLOTS.FRONT_SCENE,
    cardType,
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

export async function resolveInsidePrompt(
  vars: InsideResolveVars,
  cardType: string | null = null,
): Promise<ResolvedPrompt> {
  const tpl = await loadActiveTemplate(PROMPT_SLOTS.INSIDE, cardType);
  if (tpl) {
    return {
      text: renderTemplate(tpl.templateText, deriveInsideVars(vars)),
      source: 'db',
      templateId: tpl.id,
      templateVersion: tpl.version,
      slot: PROMPT_SLOTS.INSIDE,
      cardType,
    };
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
    slot: PROMPT_SLOTS.INSIDE,
    cardType,
  };
}
