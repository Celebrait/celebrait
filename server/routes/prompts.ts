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
import { openai } from '../utils/shared';
import FormData from 'form-data';

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

  // POST /api/admin/prompts/test-run
  // The heart of the Prompt Lab. Takes a template string (the one the admin
  // is currently editing — could be an unsaved draft), a set of input vars,
  // and an optional reference photo. Renders the template, calls OpenAI at
  // the requested quality, returns the generated image + metadata.
  //
  // This is the "click Run and see an image" primitive. Everything Phase 3+
  // builds on top — fixtures, variant grids, cost ledgers — is just UI/data
  // layered on this call.
  //
  // Body:
  //   {
  //     slot: 'front_scene' | 'inside',
  //     templateText: string,               // the template to render
  //     inputs: FrontSceneVars | InsideVars, // what to substitute
  //     quality: 'low' | 'medium' | 'high', // OpenAI quality tier
  //     photoBase64?: string,               // optional: user's face photo (front_scene)
  //     referenceImageBase64?: string,      // optional: front-card reference (inside)
  //   }
  //
  // Both image params are accepted as "data:image/...;base64,..." or raw
  // base64. Either one routes to /v1/images/edits at the OpenAI level; if
  // both are present referenceImageBase64 wins. If neither is present,
  // the call is text-only via images.generate.
  //
  // Returns:
  //   {
  //     imageUrl: string,                   // data URL, base64 PNG
  //     renderedPrompt: string,             // the exact text sent to OpenAI
  //     costCents: number,                  // approximate cost in US cents
  //     costUsd: string,                    // formatted for display
  //     durationMs: number,
  //     quality: string,
  //     hadReferenceImage: boolean,
  //   }
  app.post('/api/admin/prompts/test-run', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const startTime = Date.now();
    try {
      if (!openai) {
        return res
          .status(503)
          .json({ message: 'OpenAI API key not configured on server' });
      }

      const {
        slot,
        templateText,
        inputs,
        quality,
        photoBase64,
        referenceImageBase64,
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
      const q: 'low' | 'medium' | 'high' =
        quality === 'high' || quality === 'medium' ? quality : 'low';

      // Render the template with derived vars (so {{#if}} blocks work the
      // same way as production).
      const renderVars =
        slot === 'front_scene'
          ? deriveFrontSceneVars(inputs as FrontSceneVars)
          : deriveInsideVars(inputs as InsideVars);
      const renderedPrompt = renderTemplate(templateText, renderVars);

      // Unified reference-image resolution. Two param names are accepted:
      //   - photoBase64: the user's face photo (front_scene flow)
      //   - referenceImageBase64: a previously generated front card to
      //     inherit style from (inside flow — mirrors production, where
      //     background-generator.ts feeds the front card PNG into the
      //     inside /v1/images/edits call)
      // Both wire into /v1/images/edits the same way at the OpenAI level.
      const effectiveReferenceImage: string | null =
        (typeof referenceImageBase64 === 'string' && referenceImageBase64) ||
        (typeof photoBase64 === 'string' && photoBase64) ||
        null;

      console.log(
        `[PROMPT_LAB_TEST] slot=${slot} quality=${q} hasReference=${!!effectiveReferenceImage} promptLen=${renderedPrompt.length}`,
      );

      // Route 1: reference image provided → /v1/images/edits (multipart)
      // Route 2: no reference → openai.images.generate (text-only)
      //
      // For the inside slot, text-only is technically valid but misleading
      // — the v1 inside template references "the front card" which only
      // makes sense when a reference image is actually present. Log a
      // warning so it shows up in the console for the user.
      let imageUrl: string | null = null;

      if (slot === 'inside' && !effectiveReferenceImage) {
        console.warn(
          `[PROMPT_LAB_TEST] WARN: inside slot running WITHOUT a front-card reference image — output will NOT reflect production behaviour, where the inside card is rendered via /v1/images/edits with the front PNG as input. Pass referenceImageBase64 to mirror production.`,
        );
      }

      if (effectiveReferenceImage) {
        // Normalise: strip data URL prefix if present
        const base64Match = effectiveReferenceImage.match(/^data:image\/([a-z0-9]+);base64,(.+)$/);
        const mimeType = base64Match ? base64Match[1] : 'png';
        const rawBase64 = base64Match ? base64Match[2] : effectiveReferenceImage;
        const imageBuffer = Buffer.from(rawBase64, 'base64');

        // Diagnostic: prove the buffer actually contains a valid image.
        // PNGs start with [89 50 4E 47 0D 0A 1A 0A], JPEGs with [FF D8].
        // If the first 8 bytes are garbage, the base64 decode failed or
        // the data URL was malformed.
        const first8 = imageBuffer.subarray(0, 8).toString('hex');
        const isPng = first8.startsWith('89504e470d0a1a0a');
        const isJpeg = first8.startsWith('ffd8');
        console.log(
          `[PROMPT_LAB_TEST] reference image: mimeClaimed=${mimeType} bufferBytes=${imageBuffer.length} first8=${first8} detected=${isPng ? 'PNG' : isJpeg ? 'JPEG' : 'UNKNOWN/CORRUPT'}`,
        );

        const formData = new FormData();
        formData.append('image', imageBuffer, {
          filename: `reference.${mimeType}`,
          contentType: `image/${mimeType}`,
        });
        formData.append('prompt', renderedPrompt);
        formData.append('model', 'gpt-image-1.5');
        formData.append('n', '1');
        formData.append('size', '1024x1024');
        formData.append('quality', q);
        formData.append('moderation', 'low');
        formData.append('background', 'auto');

        const fetch = (await import('node-fetch')).default;
        const openaiStart = Date.now();
        console.log(
          `[PROMPT_LAB_TEST] → POST https://api.openai.com/v1/images/edits (model=gpt-image-1.5 quality=${q} imageBytes=${imageBuffer.length})`,
        );
        const response = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            ...formData.getHeaders(),
          },
          body: formData as any,
        });
        console.log(
          `[PROMPT_LAB_TEST] ← ${response.status} ${response.statusText} (${Date.now() - openaiStart}ms)`,
        );

        if (!response.ok) {
          const errorText = await response.text();
          let errMsg = errorText;
          try {
            const parsed = JSON.parse(errorText);
            errMsg = parsed?.error?.message ?? errorText;
          } catch {
            /* keep raw */
          }
          return res.status(response.status).json({
            message: `OpenAI error: ${errMsg}`,
            renderedPrompt,
          });
        }

        const json = (await response.json()) as any;
        const b64 = json?.data?.[0]?.b64_json;
        if (!b64) {
          return res.status(500).json({
            message: 'OpenAI returned no image data',
            renderedPrompt,
          });
        }
        imageUrl = `data:image/png;base64,${b64}`;
      } else {
        // Text-only generation via the OpenAI SDK (hits
        // https://api.openai.com/v1/images/generations under the hood).
        const openaiStart = Date.now();
        console.log(
          `[PROMPT_LAB_TEST] → openai.images.generate (model=gpt-image-1.5 quality=${q})`,
        );
        const gen = await openai.images.generate({
          model: 'gpt-image-1.5',
          prompt: renderedPrompt,
          n: 1,
          size: '1024x1024',
          quality: q,
        } as any);
        console.log(
          `[PROMPT_LAB_TEST] ← openai.images.generate returned (${Date.now() - openaiStart}ms)`,
        );
        const data = (gen as any)?.data?.[0];
        const b64 = data?.b64_json;
        if (b64) {
          imageUrl = `data:image/png;base64,${b64}`;
        } else if (data?.url) {
          imageUrl = data.url;
        }
        if (!imageUrl) {
          return res.status(500).json({
            message: 'OpenAI returned no image data',
            renderedPrompt,
          });
        }
      }

      // Cost estimate — figures from OpenAI pricing at 2026-04-10 for
      // gpt-image-1.5 at 1024x1024. See PROMPT_LAB_PLAN.md §6.1.
      // low=$0.009, medium=$0.034, high=$0.133 per image.
      const costByQuality: Record<string, number> = {
        low: 0.9,
        medium: 3.4,
        high: 13.3,
      };
      const costCents = costByQuality[q];
      const costUsd = `$${(costCents / 100).toFixed(3)}`;
      const durationMs = Date.now() - startTime;

      console.log(
        `[PROMPT_LAB_TEST] SUCCESS slot=${slot} quality=${q} cost=${costUsd} duration=${durationMs}ms`,
      );

      return res.json({
        imageUrl,
        renderedPrompt,
        costCents,
        costUsd,
        durationMs,
        quality: q,
        hadReferenceImage: !!effectiveReferenceImage,
      });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[PROMPT_LAB_TEST] FAILED after ${durationMs}ms:`, err);
      res.status(500).json({
        message: err?.message ?? 'Test run failed',
      });
    }
  });
}
