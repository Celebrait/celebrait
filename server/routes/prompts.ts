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
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  promptTemplates,
  promptActive,
  PROMPT_SLOTS,
  users,
  type PromptSlot,
} from '@shared/schema';
import { invalidatePromptCache, renderTemplate } from '../prompts/resolver';
import {
  deriveFrontSceneVars,
  deriveInsideVars,
  type FrontSceneVars,
  type InsideVars,
} from '../prompts/derive';
import { getProvider, listProviders } from '../providers/registry';

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

      const whereClause = cardTypeFilter !== undefined
        ? and(
            eq(promptTemplates.slot, slot),
            cardTypeFilter === ''
              ? sql`${promptTemplates.cardType} IS NULL`
              : eq(promptTemplates.cardType, cardTypeFilter),
          )
        : eq(promptTemplates.slot, slot);

      const rows = await db
        .select()
        .from(promptTemplates)
        .where(whereClause)
        .orderBy(desc(promptTemplates.version));

      // Annotate which row is currently active (default pointer only)
      const activeRow = await db
        .select()
        .from(promptActive)
        .where(and(eq(promptActive.slot, slot), eq(promptActive.cardType, '')))
        .limit(1);
      const activeId = activeRow[0]?.activeTemplateId ?? null;

      res.json({
        slot,
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
      const { name, templateText, variables, notes, cardType } = req.body ?? {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'name is required' });
      }
      if (!templateText || typeof templateText !== 'string') {
        return res.status(400).json({ message: 'templateText is required' });
      }

      // Compute next version number for this (slot, cardType)
      const normalizedCardType: string | null =
        cardType === undefined || cardType === '' || cardType === null ? null : String(cardType);

      const existing = await db
        .select({ version: promptTemplates.version })
        .from(promptTemplates)
        .where(
          and(
            eq(promptTemplates.slot, slot),
            normalizedCardType === null
              ? sql`${promptTemplates.cardType} IS NULL`
              : eq(promptTemplates.cardType, normalizedCardType),
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
  // Body: { slot, cardType?, templateId }
  // Atomically flips the prompt_active pointer to the given template.
  // Invalidates the in-process cache so next generation picks it up.
  app.post('/api/admin/prompts/activate', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const { slot, cardType, templateId } = req.body ?? {};
      if (!slot || typeof slot !== 'string' || !VALID_SLOTS.has(slot)) {
        return res.status(400).json({ message: 'Invalid slot' });
      }
      const id = parseInt(templateId, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: 'Invalid templateId' });
      }
      const ct: string = cardType && typeof cardType === 'string' ? cardType : '';

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

      const user = (req as any).user;
      const updatedBy: string =
        user?.claims?.email ?? user?.email ?? 'admin-ui';

      // Upsert the pointer
      const existing = await db
        .select()
        .from(promptActive)
        .where(and(eq(promptActive.slot, slot), eq(promptActive.cardType, ct)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(promptActive)
          .set({ activeTemplateId: id, updatedAt: new Date(), updatedBy })
          .where(and(eq(promptActive.slot, slot), eq(promptActive.cardType, ct)));
      } else {
        await db.insert(promptActive).values({
          slot,
          cardType: ct,
          activeTemplateId: id,
          updatedBy,
        });
      }

      invalidatePromptCache(slot, ct === '' ? null : ct);

      res.json({ success: true, slot, cardType: ct || null, activeTemplateId: id });
    } catch (err: any) {
      console.error('[ADMIN_PROMPTS] activate error:', err);
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

  // POST /api/admin/prompts/test-run
  // The heart of the Prompt Lab. Renders a template with input vars, then
  // delegates image generation to the selected provider (OpenAI or Gemini).
  //
  // Body:
  //   {
  //     slot: 'front_scene' | 'inside',
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

      // Compute photo count for the template's {{#if}} blocks.
      const extras: string[] = Array.isArray(additionalPhotos)
        ? additionalPhotos.filter((p: any) => typeof p === 'string' && p.length > 0)
        : [];
      const totalPhotoCount =
        (typeof photoBase64 === 'string' && photoBase64 ? 1 : 0) + extras.length;

      // Render the template with derived vars.
      const renderVars =
        slot === 'front_scene'
          ? deriveFrontSceneVars({
              ...(inputs as FrontSceneVars),
              photoMode: photoMode === 'group' ? 'group' : photoMode === 'one_person' ? 'one_person' : undefined,
              photoCount: totalPhotoCount,
            })
          : deriveInsideVars(inputs as InsideVars);
      const renderedPrompt = renderTemplate(templateText, renderVars);

      // Resolve the reference image (user photo or front card).
      const effectiveReferenceImage: string | null =
        (typeof referenceImageBase64 === 'string' && referenceImageBase64) ||
        (typeof photoBase64 === 'string' && photoBase64) ||
        null;

      if (slot === 'inside' && !effectiveReferenceImage) {
        console.warn(
          `[PROMPT_LAB_TEST] WARN: inside slot running WITHOUT a front-card reference — results will NOT reflect production.`,
        );
      }

      console.log(
        `[PROMPT_LAB_TEST] slot=${slot} provider=${pid} quality=${q} hasReference=${!!effectiveReferenceImage} promptLen=${renderedPrompt.length}`,
      );

      // Delegate to the provider.
      const result = await provider.generate({
        prompt: renderedPrompt,
        referenceImageBase64: effectiveReferenceImage ?? undefined,
        additionalReferenceImages: extras.length > 0 ? extras : undefined,
        quality: q,
        size: '1024x1024',
      });

      console.log(
        `[PROMPT_LAB_TEST] SUCCESS provider=${result.provider} model=${result.model} cost=${result.costUsd} duration=${result.durationMs}ms`,
      );

      return res.json({
        imageUrl: result.imageUrl,
        renderedPrompt,
        costCents: result.costCents,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
        quality: q,
        hadReferenceImage: !!effectiveReferenceImage,
        provider: result.provider,
        model: result.model,
      });
    } catch (err: any) {
      console.error(`[PROMPT_LAB_TEST] FAILED:`, err);
      res.status(500).json({
        message: err?.message ?? 'Test run failed',
      });
    }
  });
}
