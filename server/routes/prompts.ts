// server/routes/prompts.ts
//
// Admin API for the Prompt Lab. Exposes CRUD over prompt_templates and
// prompt_active so the /admin/prompts page can list versions, view diffs,
// create new drafts, and atomically activate a version.
//
// Phase 1 of the Prompt Lab — see PROMPT_LAB_PLAN.md §4.
//
// Auth: all endpoints are mounted under /api/admin/prompts and rely on
// Express session + an admin-email allow-list check. Keep this minimal but
// real — these endpoints control what prompts hit production.

import type { Express, Request, Response } from 'express';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  promptTemplates,
  promptActive,
  regenSettings,
  REGEN_SIDES,
  PROMPT_SLOTS,
  PROMPT_VARIANTS,
  users,
  type PromptSlot,
  type PromptVariant,
  type RegenSide,
  type PromptProvider,
  type PromptQuality,
} from '@shared/schema';
import { invalidatePromptCache, renderTemplate } from '../prompts/resolver';
import {
  deriveFrontSceneVars,
  deriveInsideVars,
  type FrontSceneVars,
  type InsideVars,
} from '../prompts/derive';
import { getProvider, listProviders } from '../providers/registry';
import { generateWithRetry } from '../providers/retry';
import { isProviderError } from '../providers/errors';
import { aspectLabel, isKnownSize } from '../providers/size';
import { logGeneration } from '../prompts/generation-log';
import {
  buildRefineInstruction,
  REFINE_SLOT,
  VALID_REFINE_SIDES,
  type RefineSide,
} from '../prompts/refine-scaffolds';

/**
 * Reads the caller's OTP session and checks the `users.is_admin` DB flag.
 * Returns true only if both a valid session exists AND the user row has
 * is_admin=true. Replaces the old hardcoded email allow-list.
 *
 * Flip the bit via: npx tsx server/scripts/make-admin.ts <email>
 */
async function isAdmin(req: Request): Promise<boolean> {
  const otpUserId = (req as any).session?.otpUserId;
  if (typeof otpUserId !== 'string' || otpUserId.length === 0) {
    return false;
  }
  const row = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, otpUserId))
    .limit(1);
  return row[0]?.isAdmin === true;
}

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!(await isAdmin(req))) {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
}

const VALID_SLOTS = new Set<string>(Object.values(PROMPT_SLOTS));
const VALID_VARIANTS = new Set<string>(Object.values(PROMPT_VARIANTS));

/** Normalise a request's variant value. Accepts a PromptVariant or null/""
 *  (both mean "variant-agnostic template"). Returns null for the variant-
 *  agnostic case so downstream code can branch on null. Returns undefined
 *  when the value is invalid — callers should 400. */
function parseVariant(raw: unknown): PromptVariant | null | undefined {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') return undefined;
  return VALID_VARIANTS.has(raw) ? (raw as PromptVariant) : undefined;
}

export function registerPromptRoutes(app: Express): void {
  // GET /api/admin/prompts/slots
  // Returns the list of slots plus the currently-active template id for each.
  app.get('/api/admin/prompts/slots', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const active = await db
        .select({
          slot: promptActive.slot,
          cardType: promptActive.cardType,
          variant: promptActive.variant,
          activeTemplateId: promptActive.activeTemplateId,
          templateName: promptTemplates.name,
          templateVersion: promptTemplates.version,
          updatedAt: promptActive.updatedAt,
        })
        .from(promptActive)
        .innerJoin(
          promptTemplates,
          eq(promptActive.activeTemplateId, promptTemplates.id),
        );

      const slots = Object.values(PROMPT_SLOTS).map((slot) => ({
        slot,
        active: active
          .filter((a) => a.slot === slot)
          .map((a) => ({
            cardType: a.cardType || null,
            variant: a.variant || null,
            templateId: a.activeTemplateId,
            templateName: a.templateName,
            templateVersion: a.templateVersion,
            updatedAt: a.updatedAt,
          })),
      }));

      res.json({ slots });
    } catch (err: any) {
      console.error('[ADMIN_PROMPTS] slots error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/admin/prompts/slot/:slot
  // Returns the full version history for a slot, newest first.
  // Optional ?cardType=xxx filters to just that card type (empty = default).
  // NOTE: nested under `/slot/` so it doesn't collide with sibling routes
  // like /slots, /activate, /preview, /test-run, /template/:id.
  app.get('/api/admin/prompts/slot/:slot', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const { slot } = req.params;
      if (!VALID_SLOTS.has(slot)) {
        return res.status(400).json({ message: `Unknown slot: ${slot}` });
      }
      const cardTypeFilter = req.query.cardType as string | undefined;
      // Variant query param: omitted = all variants; '' / 'null' = the
      // variant-agnostic row only; a specific variant = only that variant's rows.
      const variantRaw = req.query.variant as string | undefined;
      const variantFilter =
        variantRaw === undefined
          ? undefined
          : variantRaw === '' || variantRaw === 'null'
            ? null
            : VALID_VARIANTS.has(variantRaw)
              ? (variantRaw as PromptVariant)
              : (undefined as never);
      if (variantRaw !== undefined && variantFilter === (undefined as never)) {
        return res.status(400).json({ message: `Unknown variant: ${variantRaw}` });
      }

      const conditions = [eq(promptTemplates.slot, slot)];
      if (cardTypeFilter !== undefined) {
        conditions.push(
          cardTypeFilter === ''
            ? sql`${promptTemplates.cardType} IS NULL`
            : eq(promptTemplates.cardType, cardTypeFilter),
        );
      }
      if (variantFilter !== undefined) {
        conditions.push(
          variantFilter === null
            ? isNull(promptTemplates.variant)
            : eq(promptTemplates.variant, variantFilter),
        );
      }

      const rows = await db
        .select()
        .from(promptTemplates)
        .where(and(...conditions))
        .orderBy(desc(promptTemplates.version));

      // Annotate which row is currently active for the (slot, variant) default
      // pointer. When variant is unspecified we show the null-variant pointer
      // for backwards-compat with the pre-split UI.
      const activeVariantSentinel =
        variantFilter === undefined || variantFilter === null ? '' : variantFilter;
      const activeRow = await db
        .select()
        .from(promptActive)
        .where(
          and(
            eq(promptActive.slot, slot),
            eq(promptActive.cardType, ''),
            eq(promptActive.variant, activeVariantSentinel),
          ),
        )
        .limit(1);
      const activeId = activeRow[0]?.activeTemplateId ?? null;

      res.json({
        slot,
        variant: variantFilter ?? null,
        activeTemplateId: activeId,
        versions: rows.map((r) => ({ ...r, isActive: r.id === activeId })),
      });
    } catch (err: any) {
      console.error('[ADMIN_PROMPTS] list versions error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/admin/prompts/template/:id
  // Returns a single template by id.
  app.get('/api/admin/prompts/template/:id', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

      const row = await db
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.id, id))
        .limit(1);

      if (row.length === 0) return res.status(404).json({ message: 'Not found' });
      res.json(row[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/admin/prompts/slot/:slot
  // Create a new version of a template for a slot. Body:
  //   { name, templateText, variables?, notes?, cardType?, fromVersionId? }
  // The new version number is auto-computed as max(version)+1 for the
  // (slot, cardType) pair. New versions are DRAFT — not active until
  // explicitly activated.
  app.post('/api/admin/prompts/slot/:slot', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const { slot } = req.params;
      if (!VALID_SLOTS.has(slot)) {
        return res.status(400).json({ message: `Unknown slot: ${slot}` });
      }
      const { name, templateText, variables, notes, cardType, variant } = req.body ?? {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'name is required' });
      }
      if (!templateText || typeof templateText !== 'string') {
        return res.status(400).json({ message: 'templateText is required' });
      }

      // Compute next version number for this (slot, cardType, variant)
      const normalizedCardType: string | null =
        cardType === undefined || cardType === '' || cardType === null ? null : String(cardType);
      const normalizedVariant = parseVariant(variant);
      if (normalizedVariant === undefined) {
        return res.status(400).json({ message: `Unknown variant: ${variant}` });
      }

      const existing = await db
        .select({ version: promptTemplates.version })
        .from(promptTemplates)
        .where(
          and(
            eq(promptTemplates.slot, slot),
            normalizedCardType === null
              ? sql`${promptTemplates.cardType} IS NULL`
              : eq(promptTemplates.cardType, normalizedCardType),
            normalizedVariant === null
              ? isNull(promptTemplates.variant)
              : eq(promptTemplates.variant, normalizedVariant),
          ),
        )
        .orderBy(desc(promptTemplates.version))
        .limit(1);

      const nextVersion = (existing[0]?.version ?? 0) + 1;

      const user = (req as any).user;
      const createdBy: string =
        user?.claims?.email ?? user?.email ?? 'admin-ui';

      const [inserted] = await db
        .insert(promptTemplates)
        .values({
          slot,
          cardType: normalizedCardType,
          variant: normalizedVariant,
          name,
          version: nextVersion,
          templateText,
          variables: Array.isArray(variables) ? variables : [],
          notes: notes ?? null,
          createdBy,
        })
        .returning();

      res.json(inserted);
    } catch (err: any) {
      console.error('[ADMIN_PROMPTS] create version error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/admin/prompts/activate
  // Body: {
  //   slot, cardType?, templateId,
  //   provider?: 'openai'|'gemini'|'flux',   // optional: set production provider
  //   quality?: 'low'|'medium'|'high',       // optional: set production quality tier
  //   vars?: object,                         // optional: slot-specific var overrides
  //                                          //   (e.g. { textLayout: 'scene_integrated' })
  //                                          //   passing undefined preserves the existing row's value;
  //                                          //   passing null explicitly clears it.
  // }
  // Atomically flips the prompt_active pointer to the given template and
  // updates any of the production-config fields that were included.
  // Invalidates the in-process cache so next generation picks it up.
  app.post('/api/admin/prompts/activate', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const { slot, cardType, variant, templateId, provider, quality, vars } = req.body ?? {};
      if (!slot || typeof slot !== 'string' || !VALID_SLOTS.has(slot)) {
        return res.status(400).json({ message: 'Invalid slot' });
      }
      const id = parseInt(templateId, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: 'Invalid templateId' });
      }
      const ct: string = cardType && typeof cardType === 'string' ? cardType : '';
      // Normalise variant → "" sentinel = default pointer.
      const normalizedVariant = parseVariant(variant);
      if (normalizedVariant === undefined) {
        return res.status(400).json({ message: `Unknown variant: ${variant}` });
      }
      const vt: string = normalizedVariant ?? '';

      // Validate the optional production-config fields.
      // Provider whitelist is sourced from the registry so adding a
      // new variant in registry.ts (e.g. `openai-2` 2026-04-21,
      // `gemini-flash-2-5`) doesn't require a separate edit here.
      // Bug Kevin caught 2026-04-30: `openai-2` was registered but the
      // hardcoded whitelist didn't include it → "Invalid provider"
      // when activating in the Prompt Lab production area.
      const registeredIds = new Set(listProviders().map((p) => p.id));
      const providerValid =
        provider === undefined ||
        provider === null ||
        (typeof provider === 'string' && registeredIds.has(provider));
      if (!providerValid) {
        return res.status(400).json({
          message: `Invalid provider "${provider}". Available: ${Array.from(registeredIds).join(', ')}`,
        });
      }
      const qualityValid =
        quality === undefined ||
        quality === null ||
        (typeof quality === 'string' && ['low', 'medium', 'high'].includes(quality));
      if (!qualityValid) {
        return res.status(400).json({ message: 'Invalid quality' });
      }

      // Verify the template exists and belongs to the slot
      const tpl = await db
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.id, id))
        .limit(1);
      if (tpl.length === 0) {
        return res.status(404).json({ message: 'Template not found' });
      }
      if (tpl[0].slot !== slot) {
        return res
          .status(400)
          .json({ message: `Template ${id} belongs to slot ${tpl[0].slot}, not ${slot}` });
      }
      // Refuse cross-variant activation: a template tagged variant=X can only
      // be activated on the (slot, cardType, variant=X) pointer. Templates with
      // variant=null activate on the variant-agnostic pointer.
      const tplVariant: string | null = (tpl[0].variant as string | null) ?? null;
      if ((tplVariant ?? '') !== vt) {
        return res.status(400).json({
          message:
            `Template ${id} variant="${tplVariant ?? 'null'}" ` +
            `does not match activation variant="${normalizedVariant ?? 'null'}".`,
        });
      }

      const user = (req as any).user;
      const updatedBy: string =
        user?.claims?.email ?? user?.email ?? 'admin-ui';

      // Build the partial update. Only keys the caller passed (undefined = leave).
      const updates: Record<string, unknown> = {
        activeTemplateId: id,
        updatedAt: new Date(),
        updatedBy,
      };
      if (provider !== undefined) updates.provider = provider; // null or string
      if (quality !== undefined) updates.quality = quality;
      if (vars !== undefined) updates.vars = vars;

      // Upsert the pointer
      const existing = await db
        .select()
        .from(promptActive)
        .where(
          and(
            eq(promptActive.slot, slot),
            eq(promptActive.cardType, ct),
            eq(promptActive.variant, vt),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(promptActive)
          .set(updates)
          .where(
            and(
              eq(promptActive.slot, slot),
              eq(promptActive.cardType, ct),
              eq(promptActive.variant, vt),
            ),
          );
      } else {
        await db.insert(promptActive).values({
          slot,
          cardType: ct,
          variant: vt,
          activeTemplateId: id,
          provider: provider ?? null,
          quality: quality ?? null,
          vars: vars ?? null,
          updatedBy,
        });
      }

      invalidatePromptCache(
        slot,
        ct === '' ? null : ct,
        normalizedVariant,
      );

      res.json({
        success: true,
        slot,
        cardType: ct || null,
        variant: normalizedVariant,
        activeTemplateId: id,
        provider: provider ?? null,
        quality: quality ?? null,
        vars: vars ?? null,
      });
    } catch (err: any) {
      console.error('[ADMIN_PROMPTS] activate error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/admin/prompts/production
  // Returns the full production config for every active slot — the data
  // powering the Production View dashboard. One row per active (slot,
  // cardType) pairing, joined with the template it points at so the UI
  // can display template name + version without a second request.
  app.get('/api/admin/prompts/production', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const rows = await db
        .select({
          slot: promptActive.slot,
          cardType: promptActive.cardType,
          variant: promptActive.variant,
          activeTemplateId: promptActive.activeTemplateId,
          provider: promptActive.provider,
          quality: promptActive.quality,
          vars: promptActive.vars,
          updatedAt: promptActive.updatedAt,
          updatedBy: promptActive.updatedBy,
          templateName: promptTemplates.name,
          templateVersion: promptTemplates.version,
          templateText: promptTemplates.templateText,
        })
        .from(promptActive)
        .innerJoin(
          promptTemplates,
          eq(promptActive.activeTemplateId, promptTemplates.id),
        );

      res.json({ configs: rows });
    } catch (err: any) {
      console.error('[ADMIN_PROMPTS] production fetch error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/admin/prompts/preview
  // Body: { templateText, variables: {...} }
  // Renders a template string with arbitrary variables, returns the output.
  // Lets the editor show a live preview without saving a new version.
  app.post('/api/admin/prompts/preview', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const { templateText, variables } = req.body ?? {};
      if (typeof templateText !== 'string') {
        return res.status(400).json({ message: 'templateText required' });
      }
      const rendered = renderTemplate(
        templateText,
        (variables ?? {}) as Record<string, string | boolean | undefined>,
      );
      res.json({ rendered });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/admin/prompts/providers
  // Returns the list of registered image providers with availability status.
  // The client uses this to populate the provider selector dropdown and to
  // adapt the quality selector per provider.
  app.get('/api/admin/prompts/providers', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      res.json({ providers: listProviders() });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/admin/prompts/regen-settings
  // Returns all rows from regen_settings (typically 0–3 rows: global,
  // front, inside). Empty list = no DB overrides; production falls back
  // to env var → hardcoded default.
  app.get('/api/admin/prompts/regen-settings', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const rows = await db.select().from(regenSettings);
      res.json({ rows });
    } catch (err: any) {
      console.error('[ADMIN_PROMPTS] regen-settings GET error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // PUT /api/admin/prompts/regen-settings/:side
  // Upserts a regen settings row. side ∈ {global, front, inside}.
  // Body: { provider: string, quality: 'low'|'medium'|'high' }
  // Pass an empty body to DELETE the row (revert to env/default fallback).
  app.put('/api/admin/prompts/regen-settings/:side', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const sideRaw = req.params.side;
    if (!REGEN_SIDES.includes(sideRaw as RegenSide)) {
      return res
        .status(400)
        .json({ message: `Invalid side. Must be one of: ${REGEN_SIDES.join(', ')}` });
    }
    const side = sideRaw as RegenSide;

    const { provider: rawProvider, quality: rawQuality } = req.body ?? {};

    // Empty body or null provider → DELETE the row.
    if (!rawProvider || !rawQuality) {
      try {
        await db.delete(regenSettings).where(eq(regenSettings.side, side));
        return res.json({ deleted: true, side });
      } catch (err: any) {
        console.error('[ADMIN_PROMPTS] regen-settings DELETE error:', err);
        return res.status(500).json({ message: err.message });
      }
    }

    // Validate provider exists in registry.
    try {
      getProvider(rawProvider);
    } catch {
      return res.status(400).json({
        message: `Unknown provider "${rawProvider}". See server/providers/registry.ts.`,
      });
    }

    if (!['low', 'medium', 'high'].includes(rawQuality)) {
      return res
        .status(400)
        .json({ message: `Invalid quality. Must be 'low' | 'medium' | 'high'.` });
    }

    try {
      const session = (req as any).session;
      const updatedBy = session?.userEmail ?? null;

      // Upsert via INSERT ... ON CONFLICT (drizzle-orm syntax).
      await db
        .insert(regenSettings)
        .values({
          side,
          provider: rawProvider as PromptProvider,
          quality: rawQuality as PromptQuality,
          updatedBy,
        })
        .onConflictDoUpdate({
          target: regenSettings.side,
          set: {
            provider: rawProvider as PromptProvider,
            quality: rawQuality as PromptQuality,
            updatedAt: new Date(),
            updatedBy,
          },
        });

      const [row] = await db
        .select()
        .from(regenSettings)
        .where(eq(regenSettings.side, side))
        .limit(1);
      res.json({ row });
    } catch (err: any) {
      console.error('[ADMIN_PROMPTS] regen-settings PUT error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/admin/prompts/test-run
  // The heart of the Prompt Lab. Renders a template with input vars, then
  // delegates image generation to the selected provider (OpenAI or Gemini).
  //
  // Body:
  //   {
  //     slot: 'front_scene' | 'inside_write' | 'inside_blank',
  //     templateText: string,
  //     inputs: FrontSceneVars | InsideVars,
  //     quality: 'low' | 'medium' | 'high',
  //     provider?: string,                  // default: 'openai'
  //     photoBase64?: string,               // user's face photo (front_scene)
  //     referenceImageBase64?: string,      // front-card reference (inside)
  //   }
  //
  // Returns:
  //   {
  //     imageUrl, renderedPrompt, costCents, costUsd, durationMs,
  //     quality, hadReferenceImage, provider, model
  //   }
  app.post('/api/admin/prompts/test-run', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const {
        slot,
        templateText,
        inputs,
        quality,
        provider: providerId,
        photoBase64,
        referenceImageBase64,
        additionalPhotos,
        photoMode,
        textLayout,
        useCharacterAnchor,
        anchorProviderId,
        size,
      } = req.body ?? {};

      if (!slot || !VALID_SLOTS.has(slot)) {
        return res.status(400).json({ message: 'Invalid slot' });
      }
      if (typeof templateText !== 'string' || templateText.length === 0) {
        return res.status(400).json({ message: 'templateText is required' });
      }
      if (typeof inputs !== 'object' || inputs === null) {
        return res.status(400).json({ message: 'inputs must be an object' });
      }

      // Resolve provider (default to openai for backwards compat)
      const pid = typeof providerId === 'string' && providerId ? providerId : 'openai';
      const provider = getProvider(pid);
      if (!provider.isAvailable()) {
        return res
          .status(503)
          .json({ message: `Provider "${pid}" is not available — API key not configured.` });
      }

      const q: 'low' | 'medium' | 'high' =
        quality === 'high' || quality === 'medium' ? quality : 'low';

      // Validate + default the output size. Unknown values fall back to
      // square (the production default) so a bad client can't make us
      // generate a weirdly shaped image.
      const resolvedSize = typeof size === 'string' && isKnownSize(size) ? size : '1024x1024';

      // Compute photo count for the template's {{#if}} blocks.
      const extras: string[] = Array.isArray(additionalPhotos)
        ? additionalPhotos.filter((p: any) => typeof p === 'string' && p.length > 0)
        : [];
      const totalPhotoCount =
        (typeof photoBase64 === 'string' && photoBase64 ? 1 : 0) + extras.length;

      // Resolve the reference image (user photo or front card).
      const effectiveReferenceImage: string | null =
        (typeof referenceImageBase64 === 'string' && referenceImageBase64) ||
        (typeof photoBase64 === 'string' && photoBase64) ||
        null;

      // Character Anchor: if enabled, analyse the reference photos with the
      // provider's vision model BEFORE rendering the template. We need to
      // know whether the anchor succeeded so we can set hasCharacterAnchor
      // in the template vars — which skips the generic 8-point facial
      // recreation section (the anchor replaces it with specific values).
      let characterAnchor: string | null = null;
      if (useCharacterAnchor && effectiveReferenceImage) {
        // Use the specified anchor provider, defaulting to openai.
        const apid = typeof anchorProviderId === 'string' && anchorProviderId ? anchorProviderId : 'openai';
        const anchorProvider = getProvider(apid);
        const analyzeWith = anchorProvider.analyzeReference ? anchorProvider : provider;
        const allImages = [effectiveReferenceImage, ...extras];
        console.log(
          `[PROMPT_LAB_TEST] CHARACTER_ANCHOR: analysing ${allImages.length} image(s) via ${analyzeWith.id}...`,
        );
        characterAnchor = analyzeWith.analyzeReference
          ? await analyzeWith.analyzeReference(allImages)
          : null;
        if (characterAnchor) {
          console.log(
            `[PROMPT_LAB_TEST] CHARACTER_ANCHOR result (${characterAnchor.length} chars):\n${characterAnchor}`,
          );
        } else {
          console.log(`[PROMPT_LAB_TEST] CHARACTER_ANCHOR: analysis returned nothing`);
        }
      }

      // Render the template with derived vars. When hasCharacterAnchor is
      // true, the template skips the generic facial recreation section
      // (the anchor already provides specific feature descriptions).
      const renderVars =
        slot === 'front_scene'
          ? deriveFrontSceneVars({
              ...(inputs as FrontSceneVars),
              photoMode:
                photoMode === 'group' || photoMode === 'one_person' || photoMode === 'multi_individual'
                  ? photoMode
                  : undefined,
              photoCount: totalPhotoCount,
              textLayout: textLayout === 'movie_poster' ? 'movie_poster' : 'scene_integrated',
              hasCharacterAnchor: !!characterAnchor,
            })
          : deriveInsideVars(inputs as InsideVars);
      let renderedPrompt = renderTemplate(templateText, renderVars);

      // Prepend the anchor to the rendered prompt.
      if (characterAnchor) {
        renderedPrompt = `CHARACTER ANCHOR — preserve these EXACT features in the output:\n${characterAnchor}\n\n${renderedPrompt}`;
      }

      // When testing a non-square size, the existing templates still
      // bake "SQUARE 1024x1024" / "Square 1:1" into the prompt text.
      // A polite "override" prefix doesn't beat baked-in "MANDATORY
      // SQUARE" — the model keeps fighting itself. Instead we surgically
      // rewrite the offending phrases before prepending the new
      // orientation instruction. No-op for the square default.
      if (resolvedSize !== '1024x1024') {
        const [w, h] = resolvedSize.split('x');
        const aspect = aspectLabel(resolvedSize);

        // Strip phrases that lock the model into square. Case-insensitive,
        // intentionally greedy — better to remove too much square
        // language than leave a stray "perfectly square" to fight with.
        const replacements: Array<[RegExp, string]> = [
          [/MANDATORY:\s*Create a perfectly SQUARE 1024x1024 composition with equal width and height - NOT portrait, NOT landscape\.?\s*/gi, ''],
          [/Full bleed square design with no borders, fill entire square frame\.?\s*/gi, ''],
          [/Create a SQUARE 1024x1024 card image, full bleed, no borders\.?\s*/gi, ''],
          [/Square 1:1 aspect ratio interior design,?\s*/gi, ''],
          [/,?\s*square 1:1 aspect ratio\.?/gi, ''],
          [/\bperfectly square\b/gi, `perfectly ${aspect}`],
          [/\bSQUARE 1024x1024\b/gi, `${aspect} ${w}×${h}`],
          [/\b1024x1024\b/g, `${w}×${h}`],
          [/\bsquare frame\b/gi, `${aspect} frame`],
          [/\bsquare composition\b/gi, `${aspect} composition`],
        ];
        for (const [rx, replacement] of replacements) {
          renderedPrompt = renderedPrompt.replace(rx, replacement);
        }

        // Now prepend the new orientation instruction. By this point
        // the contradictions are gone and the model has no reason to
        // default back to square.
        renderedPrompt = `OUTPUT FORMAT: Generate this image in ${aspect} aspect ratio (${w}×${h} pixels). The composition must fill the entire ${aspect} frame — no borders, no letterboxing, no square canvas inside a ${aspect} image.\n\n${renderedPrompt}`;
      }

      if (slot.startsWith('inside_') && !effectiveReferenceImage) {
        console.warn(
          `[PROMPT_LAB_TEST] WARN: ${slot} slot running WITHOUT a front-card reference — results will NOT reflect production.`,
        );
      }

      // Log the full rendered prompt so we can trace exactly what was sent
      // to the model for any given run. Truncated to 500 chars in the
      // summary line; full prompt logged separately for debugging.
      console.log(
        `[PROMPT_LAB_TEST] slot=${slot} provider=${pid} quality=${q} size=${resolvedSize} hasReference=${!!effectiveReferenceImage} promptLen=${renderedPrompt.length}`,
      );
      console.log(
        `[PROMPT_LAB_TEST] RENDERED_PROMPT:\n${renderedPrompt}\n[END_PROMPT]`,
      );

      // Delegate to the provider with automatic retry on transient errors
      // (server). Safety errors are NOT retried — deterministic; would just
      // burn attempts. See server/providers/retry.ts for the policy.
      const result = await generateWithRetry(
        provider,
        {
          prompt: renderedPrompt,
          referenceImageBase64: effectiveReferenceImage ?? undefined,
          additionalReferenceImages: extras.length > 0 ? extras : undefined,
          quality: q,
          size: resolvedSize,
          slot,
        },
        {
          maxAttempts: 3,
          delayMs: 3000,
        },
      );

      console.log(
        `[PROMPT_LAB_TEST] SUCCESS provider=${result.provider} model=${result.model} cost=${result.costUsd} duration=${result.durationMs}ms`,
      );

      return res.json({
        imageUrl: result.imageUrl,
        renderedPrompt,
        characterAnchor,
        costCents: result.costCents,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
        quality: q,
        hadReferenceImage: !!effectiveReferenceImage,
        provider: result.provider,
        model: result.model,
      });
    } catch (err: any) {
      // Structured error handling — returns typed JSON so the client
      // can show safety errors differently from generic failures.
      if (isProviderError(err)) {
        console.error(
          `[PROMPT_LAB_TEST] FAILED kind=${err.kind} code=${err.code} retries=${err.retryAttempts} provider=${err.provider}`,
        );
        return res.status(err.httpStatus).json({
          message: err.message,
          kind: err.kind,
          code: err.code,
          modelExplanation: err.modelExplanation,
          retryAttempts: err.retryAttempts,
          suggestions: err.suggestions,
          provider: err.provider,
        });
      }
      // Fallback for non-provider errors
      console.error(`[PROMPT_LAB_TEST] FAILED:`, err);
      res.status(500).json({
        message: err?.message ?? 'Test run failed',
      });
    }
  });

  // POST /api/admin/prompts/test-refine
  // Takes an existing generated image and a modification instruction;
  // returns the edited image. Mirrors what Studio's `regenerateStudio
  // CardSide` does for tweak'd regens — same provider.refine() call,
  // same instruction wrapper (via buildRefineInstruction), same
  // generation_log row. So the lab and production can't drift.
  //
  // Body:
  //   {
  //     imageBase64: string,        // the existing generated image (data URL)
  //     instruction: string,        // user tweak: "make the shirt blue"
  //     side?: 'front' | 'inside',  // which scaffold to apply (default 'front')
  //     useScaffold?: boolean,      // false = pass instruction RAW (debug);
  //                                 // default true = wrap with side scaffold
  //     referencePhotos?: string[], // optional likeness/style anchors
  //   }
  app.post('/api/admin/prompts/test-refine', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const startTime = Date.now();
    try {
      const {
        imageBase64,
        instruction,
        side: rawSide,
        useScaffold: rawUseScaffold,
        referencePhotos,
        provider: rawProvider,
      } = req.body ?? {};

      if (typeof imageBase64 !== 'string' || !imageBase64) {
        return res.status(400).json({ message: 'imageBase64 is required' });
      }
      if (typeof instruction !== 'string' || !instruction.trim()) {
        return res.status(400).json({ message: 'instruction is required' });
      }

      // Side defaults to 'front' for backward compat with the original
      // single-side PL refine. New callers should always specify it.
      const side: RefineSide = VALID_REFINE_SIDES.includes(rawSide as RefineSide)
        ? (rawSide as RefineSide)
        : 'front';

      // useScaffold defaults true — production behaviour. Set false
      // for raw-instruction debugging, which is PL-only territory.
      const useScaffold = rawUseScaffold !== false;

      // Provider defaults to 'gemini' for backward compat. Lab now
      // exposes a toggle so callers can pick any registered provider
      // — production parity stays with Gemini unless the production
      // override below says otherwise.
      const providerId =
        typeof rawProvider === 'string' && rawProvider.length > 0
          ? rawProvider
          : 'gemini';
      let provider;
      try {
        provider = getProvider(providerId);
      } catch {
        return res.status(400).json({
          message: `Unknown provider "${providerId}". Pick a registered provider.`,
        });
      }
      if (!provider.isAvailable()) {
        return res.status(503).json({
          message: `${provider.displayName} is not configured (missing API key).`,
        });
      }
      if (!provider.refine) {
        return res.status(501).json({
          message: `${provider.displayName} doesn't support refine. Pick a different provider.`,
        });
      }

      const refPhotos: string[] = Array.isArray(referencePhotos)
        ? referencePhotos.filter((p: any) => typeof p === 'string' && p.length > 0)
        : [];

      // Build the actual instruction sent to the model. With scaffold
      // (default), the user's text is wrapped per-side — identical to
      // what Studio sends. Without scaffold, raw — useful for the
      // operator iterating on the wrapper itself or debugging the
      // model's behaviour without the scaffold's constraints.
      const finalInstruction = useScaffold
        ? buildRefineInstruction(side, instruction)
        : instruction;

      console.log(
        `[PROMPT_LAB_TEST] REFINE provider=${provider.id} side=${side} useScaffold=${useScaffold} instruction="${instruction.slice(0, 100)}" refPhotos=${refPhotos.length}`,
      );

      try {
        const result = await provider.refine!(
          imageBase64,
          finalInstruction,
          refPhotos.length > 0 ? refPhotos : undefined,
        );

        // Log to generation_log so PL refine traffic shows up in
        // Cost Ledger alongside Studio refine. cardId: null marks
        // this as a lab call (Cost Ledger filters by joining to
        // `cards` for customer-facing metrics — null cardId stays
        // out of those aggregates by definition).
        await logGeneration({
          cardId: null,
          slot: REFINE_SLOT[side],
          templateId: null,
          templateVersion: null,
          provider: result.provider,
          model: result.model,
          quality: 'high',
          costCents: result.costCents,
          durationMs: result.durationMs,
          success: true,
        });

        console.log(
          `[PROMPT_LAB_TEST] REFINE SUCCESS cost=${result.costUsd} duration=${result.durationMs}ms`,
        );

        return res.json({
          imageUrl: result.imageUrl,
          costCents: result.costCents,
          costUsd: result.costUsd,
          durationMs: result.durationMs,
          provider: result.provider,
          model: result.model,
          instruction,
          finalInstruction,
          side,
          useScaffold,
        });
      } catch (refineErr: any) {
        // Log the failure too — Cost Ledger needs both successes and
        // failures to compute success rate; otherwise PL "wasted" gen
        // spend disappears from the ledger.
        await logGeneration({
          cardId: null,
          slot: REFINE_SLOT[side],
          templateId: null,
          templateVersion: null,
          provider: provider.id,
          model: provider.model,
          quality: 'high',
          costCents: 0,
          durationMs: Date.now() - startTime,
          success: false,
          errorCode: refineErr?.kind ?? refineErr?.code ?? 'unknown',
        });
        throw refineErr;
      }
    } catch (err: any) {
      if (isProviderError(err)) {
        return res.status(err.httpStatus).json({
          message: err.message,
          kind: err.kind,
          code: err.code,
          modelExplanation: err.modelExplanation,
          suggestions: err.suggestions,
          provider: err.provider,
        });
      }
      console.error(`[PROMPT_LAB_TEST] REFINE FAILED:`, err);
      res.status(500).json({ message: err?.message ?? 'Refine failed' });
    }
  });
}
