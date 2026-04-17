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
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { cards, EMPTY_CARD_DRAFT, type CardDraftState } from '@shared/schema';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';

function getUserId(req: Request): string | null {
  const id = (req as any).session?.otpUserId;
  return typeof id === 'string' && id.length > 0 ? id : null;
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
}
