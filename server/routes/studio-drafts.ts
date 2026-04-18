// server/routes/studio-drafts.ts
//
// Draft card endpoints for the Studio card maker. Decoupled from the
// legacy /api/cards endpoints (which still serve the old guided-
// conversation flow) so we can iterate on the Studio model without
// destabilising the current codepath.
//
// A "draft" is a row in the cards table with status='draft' and the
// user's step-state packed into conversationData. The card maker
// autosaves into this row on step transitions + field blur. On final
// generate the status flips to 'generating' → 'ready'. See
// client/src/hooks/use-card-maker.ts for the client side.
//
// Ownership: every endpoint checks the session user owns the draft.
// Nobody should be able to PATCH someone else's draft.

import type { Express, Request, Response } from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { cards, EMPTY_CARD_DRAFT, type CardDraftState } from '@shared/schema';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';
import { generateStudioCard } from '../background-generator';

function getUserId(req: Request): string | null {
  const id = (req as any).session?.otpUserId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

// Strip the /images/ prefix to get the path relative to stored_images/.
// Images are served via express.static('stored_images') at /images, so
// what's in the DB may be either a bare relative path or already have
// the /images/ prefix depending on when it was written.
function imageDiskPath(storedPath: string | null | undefined): string | null {
  if (!storedPath) return null;
  const rel = storedPath.startsWith('/images/') ? storedPath.slice('/images/'.length) : storedPath;
  return path.join(process.cwd(), 'stored_images', rel);
}

// Server-side mirror of the client's readiness gates. The UI blocks Next
// until each step is complete, but the server shouldn't trust that — a
// crafted POST could skip straight to /generate with a half-filled state.
function isDraftReadyToGenerate(state: CardDraftState): { ok: boolean; reason?: string } {
  if (!state.recipient?.name?.trim() || !state.recipient?.occasion?.trim()) {
    return { ok: false, reason: 'Recipient name + occasion required' };
  }
  if (!state.photos?.photoIds?.length) {
    return { ok: false, reason: 'At least one photo required' };
  }
  if (!state.scene?.description?.trim()) {
    return { ok: false, reason: 'Scene description required' };
  }
  const styleMode = state.style?.mode;
  if (styleMode !== 'animated' && styleMode !== 'realistic' && styleMode !== 'custom') {
    return { ok: false, reason: 'Style selection required' };
  }
  if (styleMode === 'custom' && (state.style?.custom?.trim().length ?? 0) < 15) {
    return { ok: false, reason: 'Custom style needs at least 15 characters' };
  }
  const insideMode = state.inside?.mode;
  if (insideMode === 'blank') {
    // Blank is always ready.
  } else if (insideMode === 'write') {
    if (!state.inside?.write?.message?.trim()) {
      return { ok: false, reason: 'Inside message required for Write mode' };
    }
  } else {
    return { ok: false, reason: 'Inside mode (write or blank) required' };
  }
  return { ok: true };
}

export function registerStudioDraftRoutes(app: Express): void {
  // ── POST /api/studio/drafts ──────────────────────────────────────
  // Create a new empty draft owned by the caller. Returns the card
  // id so the client can redirect to /studio/card/:id/edit.
  app.post('/api/studio/drafts', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
      // sceneType + price are NOT NULL in the schema. We give them
      // harmless defaults — the real values get filled in as the user
      // progresses through the maker steps.
      const [inserted] = await db
        .insert(cards)
        .values({
          userId,
          sceneType: 'with-person',
          price: 0,
          status: 'draft',
          cardType: 'printed',
          printOption: 'front-and-inside',
          conversationData: EMPTY_CARD_DRAFT,
        })
        .returning({ id: cards.id });

      res.json({ id: inserted.id });
    } catch (err: any) {
      console.error('[STUDIO] draft create error:', err);
      res.status(500).json({ message: 'Could not create draft: ' + (err?.message ?? String(err)) });
    }
  });

  // ── GET /api/studio/drafts/:id ───────────────────────────────────
  // Fetch a single draft's state for resume. Only returns scalar
  // fields + the step state jsonb — no legacy image blobs.
  app.get('/api/studio/drafts/:id', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

    try {
      const rows = await db
        .select({
          id: cards.id,
          userId: cards.userId,
          status: cards.status,
          conversationData: cards.conversationData,
          frontImageUrl: cards.frontImageUrl,
          insideImageUrl: cards.insideImageUrl,
          createdAt: cards.createdAt,
        })
        .from(cards)
        .where(eq(cards.id, id))
        .limit(1);

      const row = rows[0];
      if (!row) return res.status(404).json({ message: 'Draft not found' });
      if (row.userId !== userId) return res.status(403).json({ message: 'Not your draft' });

      // Default empty state if conversationData is null or shaped
      // differently (legacy rows from the old flow).
      const stateRaw = (row.conversationData as any) ?? null;
      const state: CardDraftState =
        stateRaw && typeof stateRaw === 'object' && stateRaw.version === 1
          ? (stateRaw as CardDraftState)
          : EMPTY_CARD_DRAFT;

      res.json({
        id: row.id,
        status: row.status,
        frontImageUrl: row.frontImageUrl,
        insideImageUrl: row.insideImageUrl,
        createdAt: row.createdAt,
        state,
      });
    } catch (err: any) {
      console.error('[STUDIO] draft fetch error:', err);
      res.status(500).json({ message: 'Could not load draft' });
    }
  });

  // ── PATCH /api/studio/drafts/:id ─────────────────────────────────
  // Overwrite the draft's step state. The client sends the entire
  // CardDraftState each time (it's small) — simpler than patch
  // semantics and autosave-friendly.
  app.patch('/api/studio/drafts/:id', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

    const state = req.body?.state;
    if (!state || typeof state !== 'object' || state.version !== 1) {
      return res.status(400).json({ message: 'Invalid state payload (expected version=1)' });
    }

    try {
      // Ownership check + update in a single query via compound WHERE.
      const result = await db
        .update(cards)
        .set({ conversationData: state })
        .where(and(eq(cards.id, id), eq(cards.userId, userId)))
        .returning({ id: cards.id });

      if (result.length === 0) {
        return res.status(404).json({ message: 'Draft not found (or not yours)' });
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error('[STUDIO] draft patch error:', err);
      res.status(500).json({ message: 'Could not save draft' });
    }
  });

  // ── POST /api/studio/drafts/:id/generate ─────────────────────────
  // Kick off background generation for a draft. Ownership + readiness
  // checks run synchronously; generation itself is fire-and-forget
  // (the client polls GET /api/studio/drafts/:id for status).
  //
  // Transitions:  draft → generating → completed / failed
  // Returns 409 if the card isn't in 'draft' status (already generating,
  // completed, etc.) so double-click spam doesn't re-enter the pipeline.
  app.post('/api/studio/drafts/:id/generate', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

    try {
      // Single query: ownership + status + state in one go.
      const rows = await db
        .select({
          id: cards.id,
          userId: cards.userId,
          status: cards.status,
          conversationData: cards.conversationData,
        })
        .from(cards)
        .where(eq(cards.id, id))
        .limit(1);

      const row = rows[0];
      if (!row) return res.status(404).json({ message: 'Draft not found' });
      if (row.userId !== userId) return res.status(403).json({ message: 'Not your draft' });

      // Only 'draft' can start a generation. 'generating' means one is in
      // flight; 'completed'/'failed' means it's done (retry should go
      // through a regeneration flow, not this endpoint).
      if (row.status !== 'draft') {
        return res
          .status(409)
          .json({ message: `Draft is ${row.status}, not 'draft' — nothing to start` });
      }

      const state = row.conversationData as CardDraftState | null;
      if (!state || state.version !== 1) {
        return res.status(400).json({ message: 'Draft has no valid state' });
      }

      // Readiness gates — mirror the client-side isXStepReady checks so
      // the server doesn't trust a malicious client bypassing the UI.
      const ready = isDraftReadyToGenerate(state);
      if (!ready.ok) {
        return res.status(400).json({ message: ready.reason });
      }

      // Flip to 'generating' BEFORE dispatching so a refresh during the
      // gap between response and job start shows the right status.
      await db
        .update(cards)
        .set({ status: 'generating' })
        .where(and(eq(cards.id, id), eq(cards.userId, userId)));

      // Fire-and-forget. generateStudioCard does its own error handling
      // (sets status='failed' and logs). Not awaited by the request.
      setImmediate(() => {
        generateStudioCard(id).catch((err) => {
          console.error(`[STUDIO] generateStudioCard threw for card ${id}:`, err);
        });
      });

      res.json({ id, status: 'generating' });
    } catch (err: any) {
      console.error('[STUDIO] generate start error:', err);
      res.status(500).json({ message: 'Could not start generation' });
    }
  });

  // ── POST /api/studio/drafts/:id/retry ────────────────────────────
  // Reset a failed draft back to 'draft' status so the user can hit
  // Generate again without losing any of their inputs. Only valid
  // transition is 'failed' → 'draft'; everything else is 409.
  app.post('/api/studio/drafts/:id/retry', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

    try {
      const rows = await db
        .select({ id: cards.id, userId: cards.userId, status: cards.status })
        .from(cards)
        .where(eq(cards.id, id))
        .limit(1);

      const row = rows[0];
      if (!row) return res.status(404).json({ message: 'Draft not found' });
      if (row.userId !== userId) return res.status(403).json({ message: 'Not your draft' });
      if (row.status !== 'failed') {
        return res
          .status(409)
          .json({ message: `Draft is ${row.status}, only 'failed' can retry` });
      }

      await db
        .update(cards)
        .set({ status: 'draft' })
        .where(and(eq(cards.id, id), eq(cards.userId, userId)));

      res.json({ ok: true, status: 'draft' });
    } catch (err: any) {
      console.error('[STUDIO] retry error:', err);
      res.status(500).json({ message: 'Could not reset draft' });
    }
  });

  // ── DELETE /api/studio/cards/:id ──────────────────────────────────
  // Hard-delete a card from the gallery. Nukes the row and any
  // associated images on disk (front/inside/print-ready). Uploaded
  // reference photos are kept — those live in the user's photo
  // library and may be in use by other cards.
  app.delete('/api/studio/cards/:id', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

    try {
      // Grab the card first so we know which files to clean up AND so
      // we can enforce ownership before any deletion side effect.
      const rows = await db
        .select({
          id: cards.id,
          userId: cards.userId,
          frontImagePath: cards.frontImagePath,
          insideImagePath: cards.insideImagePath,
          printReadyPath: cards.printReadyPath,
        })
        .from(cards)
        .where(eq(cards.id, id))
        .limit(1);

      const row = rows[0];
      if (!row) return res.status(404).json({ message: 'Card not found' });
      if (row.userId !== userId) return res.status(403).json({ message: 'Not your card' });

      // Best-effort delete on disk — a missing file shouldn't block
      // the DB delete. Same pattern as /api/photos/:id.
      const diskPaths = [row.frontImagePath, row.insideImagePath, row.printReadyPath]
        .map(imageDiskPath)
        .filter((p): p is string => typeof p === 'string' && p.length > 0);
      for (const p of diskPaths) {
        await fs.unlink(p).catch(() => {});
      }

      await db.delete(cards).where(eq(cards.id, id));
      res.json({ success: true });
    } catch (err: any) {
      console.error('[STUDIO] card delete error:', err);
      res.status(500).json({ message: 'Could not delete card: ' + (err?.message ?? String(err)) });
    }
  });
}
