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
import { randomBytes } from 'crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import {
  cards,
  cardAttempts,
  orders,
  users,
  EMPTY_CARD_DRAFT,
  studioOrders,
  type CardDraftState,
  type CardSide,
  type CardAttemptListItem,
} from '@shared/schema';
import { sendSenderCardOpenedEmail } from '../email-service';
import { publicImageUrl, resolveStoredImageUrl, deleteCardImages } from '../image-storage';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';
import {
  generateStudioCard,
  finalizeCardArtifacts,
  createRegenAttemptRow,
  runRegenAttempt,
  regenerateStudioCardSide,
  REGEN_HARD_CAP_PER_SIDE,
} from '../background-generator';
import { isProviderError } from '../providers/errors';
import { checkDailyGenerationLimit } from '../rate-limits';
import {
  promoteAttemptToCanonical,
  generatePrintResolutionFiles,
} from '../pipeline/storage/LocalStorageAdapter';

// Generates a URL-safe random token for public card sharing. 16 bytes
// of entropy → 22 base64url chars. That's ~128 bits of entropy — well
// beyond brute-forceable for a card-id-keyed lookup.
function generateShareToken(): string {
  return randomBytes(16).toString('base64url');
}

function getUserId(req: Request): string | null {
  const id = (req as any).session?.otpUserId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** True if the given user id belongs to an admin. Lets admins VIEW any
 *  card from the CRM (read-only) — write actions stay owner-only. Mirrors
 *  the is_admin gate used by /admin/* routes. */
async function isAdminUser(userId: string): Promise<boolean> {
  const rows = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.isAdmin === true;
}


// Server-side mirror of the client's readiness gates. The UI blocks Next
// until each step is complete, but the server shouldn't trust that — a
// crafted POST could skip straight to /generate with a half-filled state.
// FRONT-FIRST rollout flag. When '1', /generate produces the front only
// and the inside is a separate, post-approval step. Default OFF so the
// backend can ship before the studio + chat surfaces understand the new
// statuses (generating-front / front-ready / generating-inside). Flip to
// '1' on Render once those client surfaces are live.
const FRONT_FIRST_GEN = process.env.FRONT_FIRST_GEN === '1';

// Front-first split: the FRONT can generate as soon as recipient/photo/
// scene are set — the inside message is collected AFTER the front is
// revealed, so it must NOT gate the front gen. Style validation removed
// 2026-05-17 (parked for Premium; V1 locks to 'animated'). See
// next_celebrait_premium.md.
function isReadyToGenerateFront(state: CardDraftState): { ok: boolean; reason?: string } {
  if (!state.recipient?.name?.trim() || !state.recipient?.occasion?.trim()) {
    return { ok: false, reason: 'Recipient name + occasion required' };
  }
  if (!state.photos?.photoIds?.length) {
    return { ok: false, reason: 'At least one photo required' };
  }
  if (!state.scene?.description?.trim()) {
    return { ok: false, reason: 'Scene description required' };
  }
  // The front headline always derives from name+occasion (deriveDefault
  // FrontText), so no separate front-text gate is needed here.
  return { ok: true };
}

// The inside half — gates the SECOND step (generate-inside), collected
// after the front is approved.
function isInsideDecisionReady(state: CardDraftState): { ok: boolean; reason?: string } {
  const insideMode = state.inside?.mode;
  if (insideMode === 'blank') return { ok: true }; // blank is always ready
  if (insideMode === 'write') {
    if (!state.inside?.write?.message?.trim()) {
      return { ok: false, reason: 'Inside message required for Write mode' };
    }
    return { ok: true };
  }
  return { ok: false, reason: 'Inside mode (write or blank) required' };
}

// Legacy combined gate (used by the 'full' single-job path) — both
// halves must pass.
function isDraftReadyToGenerate(state: CardDraftState): { ok: boolean; reason?: string } {
  const front = isReadyToGenerateFront(state);
  if (!front.ok) return front;
  return isInsideDecisionReady(state);
}

export function registerStudioDraftRoutes(app: Express): void {
  // ── POST /api/studio/drafts ──────────────────────────────────────
  // Create a new empty draft owned by the caller. Returns the card
  // id so the client can redirect to /studio/card/:id/edit.
  app.post('/api/studio/drafts', isAuthenticated, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
      // Optional prefill from a reminder deep-link
      // (/studio/new-card?recipient=…&occasion=…) so "Start Mum's card"
      // lands on a draft that already knows who it's for. Previously the
      // params were built by the dispatcher but silently ignored here
      // (audit 2026-07-02).
      const body = (req.body ?? {}) as { recipientName?: unknown; occasion?: unknown };
      const seedName =
        typeof body.recipientName === 'string' ? body.recipientName.trim().slice(0, 100) : '';
      const seedOccasion =
        typeof body.occasion === 'string' ? body.occasion.trim().slice(0, 100) : '';
      const conversationData =
        seedName || seedOccasion
          ? {
              ...EMPTY_CARD_DRAFT,
              recipient: {
                ...(seedName ? { name: seedName } : {}),
                ...(seedOccasion ? { occasion: seedOccasion } : {}),
              },
            }
          : EMPTY_CARD_DRAFT;

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
          conversationData,
          // Stable, unguessable secret woven into this card's image object
          // keys so they can't be enumerated from the sequential id
          // (security audit 2026-07-02).
          imageKey: generateShareToken(),
        })
        .returning({ id: cards.id });

      res.json({ id: inserted.id });
    } catch (err: any) {
      console.error('[STUDIO] draft create error:', err);
      res.status(500).json({ message: 'Could not create draft: ' + (err?.message ?? String(err)) });
    }
  });

  // ── POST /api/studio/drafts/:id/duplicate ─────────────────────────
  // "Start again with these details" (Kevin 2026-07-07 — the regen
  // replacement; tweak workbench parked for Premium). Clones the
  // draft's INPUTS into a brand-new draft so the user can re-roll
  // through the full crafted generation prompt without re-typing:
  // recipient, photo refs, scene, front text, inside decision all
  // carry over; generation outputs/status do NOT — the clone starts
  // life as a plain 'draft' parked on the Review step. The source
  // card is untouched (stays in drafts, versions intact).
  app.post(
    '/api/studio/drafts/:id/duplicate',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

      try {
        const rows = await db
          .select({
            userId: cards.userId,
            conversationData: cards.conversationData,
            sceneType: cards.sceneType,
            cardType: cards.cardType,
            printOption: cards.printOption,
          })
          .from(cards)
          .where(eq(cards.id, id))
          .limit(1);
        const row = rows[0];
        if (!row) return res.status(404).json({ message: 'Card not found' });
        if (row.userId !== userId) return res.status(403).json({ message: 'Not your card' });

        const state = (row.conversationData ?? {}) as CardDraftState;
        // Land the clone on Review — inputs pre-filled and editable via
        // the stepper, one tap to generate. Index 5 = review
        // (CARD_MAKER_STEPS; the inside step at 4 is skipped in the
        // linear walk since the 2026-07-07 re-sequence).
        // rerollOfCardId marks the clone as a "take two" so the Review
        // step can signpost the fresh start + link back to the source.
        const conversationData: CardDraftState = {
          ...state,
          step: 5,
          rerollOfCardId: id,
          // Family id survives chained clones: a take-three cloned
          // from take-two still belongs to take-one's family.
          rerollFamilyId: state.rerollFamilyId ?? id,
        };

        const [inserted] = await db
          .insert(cards)
          .values({
            userId,
            sceneType: row.sceneType ?? 'with-person',
            price: 0,
            status: 'draft',
            cardType: row.cardType ?? 'printed',
            printOption: row.printOption ?? 'front-and-inside',
            conversationData,
            imageKey: generateShareToken(),
          })
          .returning({ id: cards.id });

        res.json({ id: inserted.id });
      } catch (err: any) {
        console.error('[STUDIO] draft duplicate error:', err);
        res
          .status(500)
          .json({ message: 'Could not start again: ' + (err?.message ?? String(err)) });
      }
    },
  );

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
          // Which door made it — checkout prices from this (§8a).
          source: cards.source,
          conversationData: cards.conversationData,
          frontImageUrl: cards.frontImageUrl,
          insideImageUrl: cards.insideImageUrl,
          frontImagePath: cards.frontImagePath,
          insideImagePath: cards.insideImagePath,
          selectedFrontAttemptId: cards.selectedFrontAttemptId,
          selectedInsideAttemptId: cards.selectedInsideAttemptId,
          createdAt: cards.createdAt,
          // Failure metadata — populated when status='failed' and the
          // generator caught a typed ProviderError. Drives the
          // <GenerationErrorPanel>'s kind-specific copy + suggestions.
          failureKind: cards.failureKind,
          failureMessage: cards.failureMessage,
          failureModelExplanation: cards.failureModelExplanation,
          failureProvider: cards.failureProvider,
          failureCode: cards.failureCode,
          failureSuggestions: cards.failureSuggestions,
        })
        .from(cards)
        .where(eq(cards.id, id))
        .limit(1);

      const row = rows[0];
      if (!row) return res.status(404).json({ message: 'Draft not found' });
      // Owner sees their own card; admins can view ANY card (read-only,
      // for the CRM + grabbing marketing assets). Write routes below stay
      // strictly owner-only.
      if (row.userId !== userId && !(await isAdminUser(userId))) {
        return res.status(403).json({ message: 'Not your draft' });
      }

      // Default empty state if conversationData is null or shaped
      // differently (legacy rows from the old flow).
      const stateRaw = (row.conversationData as any) ?? null;
      const state: CardDraftState =
        stateRaw && typeof stateRaw === 'object' && stateRaw.version === 1
          ? (stateRaw as CardDraftState)
          : EMPTY_CARD_DRAFT;

      // Prefer the stored-file path and fall back to the legacy URL
      // column — BOTH resolved through publicImageUrl so legacy
      // '/images/<name>' rows come back as direct R2 URLs (CORS-safe
      // for the 3D texture loader; see resolveStoredImageUrl). Mirrors
      // storage.getUserCardsForGrid — keep them aligned so all
      // dashboard surfaces resolve the same.
      const frontUrl = resolveStoredImageUrl(row.frontImagePath, row.frontImageUrl);
      const insideUrl = resolveStoredImageUrl(row.insideImagePath, row.insideImageUrl);

      // Attempts (regen history) — slim projection. Failed attempts
      // are filtered out so the versions strip never shows broken
      // tiles. In-flight ('generating') attempts are included so the
      // client can render a spinner thumbnail while waiting.
      const attemptRows = await db
        .select({
          id: cardAttempts.id,
          side: cardAttempts.side,
          attemptNumber: cardAttempts.attemptNumber,
          status: cardAttempts.status,
          errorCode: cardAttempts.errorCode,
          imageUrl: cardAttempts.imageUrl,
          imagePath: cardAttempts.imagePath,
          createdAt: cardAttempts.createdAt,
        })
        .from(cardAttempts)
        .where(eq(cardAttempts.cardId, id))
        .orderBy(cardAttempts.side, cardAttempts.attemptNumber);

      // Per-side regen failure signal. Background regens are
      // fire-and-forget, so the client's POST resolves before the gen
      // runs — this projection is the ONLY way it learns a regen failed.
      // For each side, if the MOST RECENT attempt failed (nothing
      // succeeded after it), surface it so the client shows the error
      // panel instead of silently dropping back to the old card. See
      // next_regen_interaction_polish.md (G1).
      const latestBySide = new Map<string, (typeof attemptRows)[number]>();
      for (const a of attemptRows) {
        const cur = latestBySide.get(a.side);
        if (!cur || a.attemptNumber > cur.attemptNumber) latestBySide.set(a.side, a);
      }
      const regenFailures = Array.from(latestBySide.values())
        .filter((a) => a.status === 'failed')
        .map((a) => ({
          side: a.side as CardSide,
          kind: a.errorCode ?? 'server',
        }));

      const attempts: (CardAttemptListItem & { status: string })[] = attemptRows
        .filter((a) => a.status !== 'failed')
        .map((a) => ({
          id: a.id,
          side: a.side as CardSide,
          attemptNumber: a.attemptNumber,
          status: a.status,
          imageUrl: resolveStoredImageUrl(a.imagePath, a.imageUrl) ?? '',
          isSelected:
            (a.side === 'front' && a.id === row.selectedFrontAttemptId) ||
            (a.side === 'inside' && a.id === row.selectedInsideAttemptId),
          createdAt: a.createdAt,
        }));

      // Failure block — included when the card failed outright ('failed')
      // OR the inside step failed while the front survived
      // ('inside-failed'). Both populate the same card-level failure*
      // columns, so the client renders one <GenerationErrorPanel> path.
      const failure =
        row.status === 'failed' || row.status === 'inside-failed'
          ? {
              kind: row.failureKind,
              message: row.failureMessage,
              modelExplanation: row.failureModelExplanation,
              provider: row.failureProvider,
              code: row.failureCode,
              suggestions: row.failureSuggestions,
            }
          : null;

      res.json({
        id: row.id,
        status: row.status,
        frontImageUrl: frontUrl,
        insideImageUrl: insideUrl,
        createdAt: row.createdAt,
        state,
        attempts,
        failure,
        regenFailures,
      });
    } catch (err: any) {
      console.error('[STUDIO] draft fetch error:', err);
      res.status(500).json({ message: 'Could not load draft' });
    }
  });

  // ── POST /api/studio/cards/:id/share-token ───────────────────────
  // Lazily generates (and stores) a public share token for the card.
  // Idempotent — returns the existing token if one's already there.
  // Auth-gated: only the sender can mint a token. The token is what
  // the recipient uses to view the card via the public viewer
  // endpoint without needing to log in.
  app.post(
    '/api/studio/cards/:id/share-token',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

      try {
        const rows = await db
          .select({
            id: cards.id,
            userId: cards.userId,
            viewToken: cards.viewToken,
          })
          .from(cards)
          .where(eq(cards.id, id))
          .limit(1);

        const row = rows[0];
        if (!row) return res.status(404).json({ message: 'Card not found' });
        // Owner, or admin. Minting is the one WRITE that admins get:
        // it's idempotent (reuses any existing token), grants nothing
        // the owner couldn't grant themselves, and it's the support
        // path — "send her the link she couldn't get to" (Aidan hit
        // this 403 from the CRM, 2026-08-07). Every other write on
        // this router stays strictly owner-only.
        if (row.userId !== userId && !(await isAdminUser(userId))) {
          return res.status(403).json({ message: 'Not your card' });
        }

        // Reuse existing token if there is one — mint a new one only
        // if this is the first share.
        let token = row.viewToken;
        if (!token) {
          token = generateShareToken();
          await db.update(cards).set({ viewToken: token }).where(eq(cards.id, id));
        }

        res.json({
          token,
          // Convenience: client doesn't need to know the URL shape.
          // Short form — the token alone is the credential.
          shareUrl: `/c/${encodeURIComponent(token)}`,
        });
      } catch (err: any) {
        console.error('[STUDIO] share-token error:', err);
        res.status(500).json({ message: 'Could not mint share token' });
      }
    },
  );

  // ── GET /api/card/:id/view ───────────────────────────────────────
  // Public — no auth. Recipients hit this with a token in the query
  // string to load the card for the 3D viewer. Validates the token
  // matches the card's stored view_token; otherwise 404 (not 401, so
  // we don't leak existence of the card to URL-guessers).
  //
  // Returns ONLY what the viewer needs — image URLs + recipient name +
  // occasion (for the welcome screen). Never exposes user_id, the full
  // conversationData (which contains the inside message + scene), or
  // any other fields that would leak sender/recipient personal info
  // beyond what's already on the card itself.
  // Shared by BOTH public viewer routes — the short /api/c/:token and
  // the legacy /api/card/:id/view?t=. One response shape, one
  // first-opened dispatch, zero drift.
  const publicViewColumns = {
    id: cards.id,
    userId: cards.userId,
    status: cards.status,
    conversationData: cards.conversationData,
    frontImageUrl: cards.frontImageUrl,
    insideImageUrl: cards.insideImageUrl,
    frontImagePath: cards.frontImagePath,
    insideImagePath: cards.insideImagePath,
    viewToken: cards.viewToken,
  };

  // ── GET /api/c/:token ────────────────────────────────────────────
  // Short share links: celebrait.co.uk/c/<token>. The token is 16
  // random bytes — unguessable on its own — so the card id and query
  // string were pure noise in a pasted link (Aidan 2026-08-07: "looks
  // shit when copying and pasting"). Lookup is BY token.
  app.get('/api/c/:token', async (req: Request, res: Response) => {
    const token = req.params.token ?? '';
    if (!token || token.length < 10) {
      return res.status(404).json({ message: 'Card not found' });
    }
    try {
      const rows = await db
        .select(publicViewColumns)
        .from(cards)
        .where(eq(cards.viewToken, token))
        .limit(1);
      if (!rows[0]) {
        console.warn(`[PUBLIC_VIEW_404] short token ${token.slice(0, 6)}… unknown`);
        return res.status(404).json({ message: 'Card not found' });
      }
      respondPublicCard(req, res, rows[0]);
    } catch (err: any) {
      console.error('[STUDIO] public short view error:', err);
      res.status(500).json({ message: 'Could not load card' });
    }
  });

  app.get('/api/card/:id/view', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const token = typeof req.query.t === 'string' ? req.query.t : '';
    if (!Number.isFinite(id) || !token) {
      return res.status(404).json({ message: 'Card not found' });
    }

    try {
      const rows = await db
        .select(publicViewColumns)
        .from(cards)
        .where(eq(cards.id, id))
        .limit(1);

      const row = rows[0];
      // Treat token mismatch + missing card as the same response —
      // don't reveal that the card exists. But LOG which it was: Aidan
      // hit the broken-link screen from the admin's Digital link
      // (2026-08-07) and the 404 gave us nothing to diagnose with. The
      // response stays identical either way; only stderr learns more.
      if (!row || row.viewToken !== token) {
        console.warn(
          `[PUBLIC_VIEW_404] card=${id} ` +
            (!row
              ? 'no such card'
              : `token mismatch (got ${token.slice(0, 6)}…, ` +
                `stored ${row.viewToken ? row.viewToken.slice(0, 6) + '…' : 'NULL'})`),
        );
        return res.status(404).json({ message: 'Card not found' });
      }

      respondPublicCard(req, res, row);
    } catch (err: any) {
      console.error('[STUDIO] public view error:', err);
      res.status(500).json({ message: 'Could not load card' });
    }
  });

  /** The single public-card response: viewer payload + the first-opened
   *  email dispatch (skipped when the sender views their own link). */
  function respondPublicCard(
    req: Request,
    res: Response,
    row: {
      id: number;
      userId: string | null;
      status: string | null;
      conversationData: unknown;
      frontImageUrl: string | null;
      insideImageUrl: string | null;
      frontImagePath: string | null;
      insideImagePath: string | null;
    },
  ): void {
    const id = row.id;
    const stateRaw = (row.conversationData as any) ?? null;
    const recipientName =
      stateRaw?.recipient?.name && typeof stateRaw.recipient.name === 'string'
        ? stateRaw.recipient.name.trim()
        : null;
    const occasion =
      stateRaw?.recipient?.occasion && typeof stateRaw.recipient.occasion === 'string'
        ? stateRaw.recipient.occasion.trim()
        : null;

    res.json({
      id: row.id,
      status: row.status,
      frontImageUrl: resolveStoredImageUrl(row.frontImagePath, row.frontImageUrl),
      insideImageUrl: resolveStoredImageUrl(row.insideImagePath, row.insideImageUrl),
      recipientName,
      occasion,
    });

    const viewerId = (req as any).session?.otpUserId;
    if (typeof viewerId === 'string' && viewerId === row.userId) {
      console.log(
        `[STUDIO] card ${id}: sender viewed own share link — first-opened NOT fired`,
      );
    } else {
      fireFirstOpenedEmailIfNeeded(id, recipientName).catch((err) => {
        console.error('[STUDIO] first-opened dispatch failed:', err);
      });
    }
  }


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

      // FRONT-FIRST flag. When on, /generate renders the FRONT only
      // (→ 'front-ready'); the inside is generated later via
      // /generate-inside after the user approves the front. Off = the
      // legacy single-job 'full' path (front + inside → 'completed').
      // Kept behind a flag so the backend can deploy before the client
      // surfaces learn the new states — see the front-first plan.
      // Per-request opt-in lets a single surface adopt front-first
      // independently of the global flag: the chat studio passes body
      // {mode:'front'} so it can go front-first NOW, while the stepper
      // studio stays legacy until its reveal learns the new states.
      const frontFirst = req.body?.mode === 'front' || FRONT_FIRST_GEN;
      const genMode: 'front' | 'full' = frontFirst ? 'front' : 'full';
      const startStatus = frontFirst ? 'generating-front' : 'generating';

      // Readiness — mirror the client gates so a crafted POST can't skip
      // ahead. Front-first only needs the front half (no inside message
      // yet); the legacy path needs both halves.
      const ready = frontFirst
        ? isReadyToGenerateFront(state)
        : isDraftReadyToGenerate(state);
      if (!ready.ok) {
        return res.status(400).json({ message: ready.reason });
      }

      // Daily cap check. Limit is a rolling 24h window based on
      // generation_log rows (see server/rate-limits.ts). We check
      // BEFORE flipping status so a rate-limited request leaves the
      // draft in 'draft' state. NOTE: the later /generate-inside step
      // deliberately SKIPS this cap — once you've made the front you've
      // committed to the card, so we don't dead-end the inside.
      const rate = await checkDailyGenerationLimit(userId);
      if (!rate.allowed) {
        return res.status(429).json({
          message: `You've reached today's generation limit (${rate.used}/${rate.limit}). Try again tomorrow.`,
          used: rate.used,
          limit: rate.limit,
          oldestCountedAt: rate.oldestCountedAt,
        });
      }

      // Flip status BEFORE dispatching so a refresh during the gap
      // between response and job start shows the right status.
      await db
        .update(cards)
        .set({ status: startStatus })
        .where(and(eq(cards.id, id), eq(cards.userId, userId)));

      // Fire-and-forget. generateStudioCard does its own error handling
      // (sets the failure status + logs). Not awaited by the request.
      setImmediate(() => {
        generateStudioCard(id, genMode).catch((err) => {
          console.error(`[STUDIO] generateStudioCard threw for card ${id}:`, err);
        });
      });

      res.json({ id, status: startStatus });
    } catch (err: any) {
      console.error('[STUDIO] generate start error:', err);
      res.status(500).json({ message: 'Could not start generation' });
    }
  });

  // ── POST /api/studio/drafts/:id/generate-inside ──────────────────
  // Front-first step 2: generate the inside AFTER the user has approved
  // the front. Valid from 'front-ready', 'inside-failed' (retry), or
  // 'inside-ready' ("Change the inside" — re-roll the inside, keeping the
  // approved front; each roll appends+promotes a card_attempts version so
  // nothing is lost). The inside is built from the already-persisted
  // front, so no photos/scene re-run — just the inside decision
  // (write+message or blank). The FIRST inside SKIPS the daily cap
  // (committing to a card you've started shouldn't dead-end at the
  // inside); a RE-ROLL from 'inside-ready' is capped like any regen.
  app.post(
    '/api/studio/drafts/:id/generate-inside',
    isAuthenticated,
    async (req: Request, res: Response) => {
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
          })
          .from(cards)
          .where(eq(cards.id, id))
          .limit(1);

        const row = rows[0];
        if (!row) return res.status(404).json({ message: 'Draft not found' });
        if (row.userId !== userId) return res.status(403).json({ message: 'Not your draft' });

        // The inside can be generated once the front is ready
        // ('front-ready'), retried after an inside failure
        // ('inside-failed'), OR re-rolled from the inside reveal
        // ('inside-ready' — "Change the inside", keeping the approved
        // front). Anything else is the wrong moment.
        if (
          row.status !== 'front-ready' &&
          row.status !== 'inside-failed' &&
          row.status !== 'inside-ready'
        ) {
          return res.status(409).json({
            message: `Card is ${row.status}; the inside can only be made once the front is ready`,
          });
        }

        const state = row.conversationData as CardDraftState | null;
        if (!state || state.version !== 1) {
          return res.status(400).json({ message: 'Draft has no valid state' });
        }

        const ready = isInsideDecisionReady(state);
        if (!ready.ok) {
          return res.status(400).json({ message: ready.reason });
        }

        // Re-rolling the inside (status already 'inside-ready') is a fresh
        // cost every time, so it's gated like any other regen: a per-side
        // hard cap, a concurrent-gen guard, and the daily limit. The FIRST
        // inside (from 'front-ready'/'inside-failed') deliberately skips
        // all of this — once you've made the front, committing to the card
        // shouldn't dead-end at the inside (Kevin 2026-07-11).
        if (row.status === 'inside-ready') {
          const existing = await db
            .select({ id: cardAttempts.id, status: cardAttempts.status })
            .from(cardAttempts)
            .where(and(eq(cardAttempts.cardId, id), eq(cardAttempts.side, 'inside')));
          if (existing.length >= REGEN_HARD_CAP_PER_SIDE + 1) {
            return res.status(429).json({
              message: `You've reached the re-roll limit for the inside. Assemble your card, or start a fresh one.`,
            });
          }
          if (existing.some((a) => a.status === 'generating')) {
            return res.status(409).json({
              message: 'An inside is already generating — hang on a moment.',
            });
          }
          const rate = await checkDailyGenerationLimit(userId);
          if (!rate.allowed) {
            return res.status(429).json({
              message: `You've reached today's generation limit (${rate.used}/${rate.limit}). Try again tomorrow.`,
              limit: rate.limit,
              used: rate.used,
            });
          }
        }

        await db
          .update(cards)
          .set({ status: 'generating-inside' })
          .where(and(eq(cards.id, id), eq(cards.userId, userId)));

        setImmediate(() => {
          generateStudioCard(id, 'inside').catch((err) => {
            console.error(`[STUDIO] generateStudioCard(inside) threw for card ${id}:`, err);
          });
        });

        res.json({ id, status: 'generating-inside' });
      } catch (err: any) {
        console.error('[STUDIO] generate-inside start error:', err);
        res.status(500).json({ message: 'Could not start inside generation' });
      }
    },
  );

  // ── POST /api/studio/drafts/:id/finalize ─────────────────────────
  // Front-first step 3: the user has previewed + signed off the inside.
  // Flip 'inside-ready' → 'completed' and run the finalize artifacts
  // (print-res + card-ready email + address-book). This is the moment the
  // card is actually DONE (so emails etc. fire here, not before sign-off).
  app.post(
    '/api/studio/drafts/:id/finalize',
    isAuthenticated,
    async (req: Request, res: Response) => {
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
          })
          .from(cards)
          .where(eq(cards.id, id))
          .limit(1);

        const row = rows[0];
        if (!row) return res.status(404).json({ message: 'Draft not found' });
        if (row.userId !== userId) return res.status(403).json({ message: 'Not your draft' });
        // Idempotent: already-completed cards just succeed (a double-tap
        // on sign-off shouldn't error).
        if (row.status === 'completed') return res.json({ id, status: 'completed' });
        if (row.status !== 'inside-ready') {
          return res.status(409).json({
            message: `Card is ${row.status}; finalize only from 'inside-ready'`,
          });
        }

        const state = row.conversationData as CardDraftState | null;

        await db
          .update(cards)
          .set({ status: 'completed' })
          .where(and(eq(cards.id, id), eq(cards.userId, userId)));

        // Fire-and-forget the artifacts — the card is already complete +
        // viewable; print-res/email/address-book are non-blocking icing.
        if (state && state.version === 1) {
          setImmediate(() => {
            finalizeCardArtifacts(id, state, row.userId).catch((err) => {
              console.error(`[STUDIO] finalizeCardArtifacts threw for card ${id}:`, err);
            });
          });
        }

        res.json({ id, status: 'completed' });
      } catch (err: any) {
        console.error('[STUDIO] finalize error:', err);
        res.status(500).json({ message: 'Could not finalize card' });
      }
    },
  );

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

      // Clear failure metadata on retry — next attempt gets a fresh
      // slate. If it fails again, generateStudioCard's catch block
      // re-populates these fields with the new failure.
      await db
        .update(cards)
        .set({
          status: 'draft',
          failureKind: null,
          failureMessage: null,
          failureModelExplanation: null,
          failureProvider: null,
          failureCode: null,
          failureSuggestions: null,
          failureAt: null,
        })
        .where(and(eq(cards.id, id), eq(cards.userId, userId)));

      res.json({ ok: true, status: 'draft' });
    } catch (err: any) {
      console.error('[STUDIO] retry error:', err);
      res.status(500).json({ message: 'Could not reset draft' });
    }
  });

  // ── POST /api/studio/drafts/:id/regenerate ────────────────────────
  // Regenerate a single side (front or inside) as a new attempt.
  // Body: { side: 'front' | 'inside', tweak?: string }
  // Returns: { attemptId } — the client polls GET /api/studio/drafts/:id
  // and looks for that attempt's status to flip from 'generating' →
  // 'completed' (or 'failed').
  app.post(
    '/api/studio/drafts/:id/regenerate',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

      const side = req.body?.side as unknown;
      if (side !== 'front' && side !== 'inside') {
        return res.status(400).json({ message: "side must be 'front' or 'inside'" });
      }
      const tweakRaw = req.body?.tweak;
      const tweak =
        typeof tweakRaw === 'string' && tweakRaw.trim().length > 0
          ? tweakRaw.trim().slice(0, 500)
          : undefined;

      try {
        // Ownership + status check.
        const rows = await db
          .select({ id: cards.id, userId: cards.userId, status: cards.status })
          .from(cards)
          .where(eq(cards.id, id))
          .limit(1);
        const row = rows[0];
        if (!row) return res.status(404).json({ message: 'Card not found' });
        if (row.userId !== userId) return res.status(403).json({ message: 'Not your card' });
        // Per-side allowed states. FRONT can be iterated in the front-
        // first 'front-ready' state (front exists, inside not yet made)
        // and after an 'inside-failed', as well as on a 'completed' card.
        // INSIDE can only be regenerated once it exists, i.e. 'completed'
        // (before that the inside is generated via /generate-inside, not
        // regenerated).
        const allowedRegenStates =
          side === 'front'
            ? ['front-ready', 'inside-ready', 'completed', 'inside-failed']
            : ['inside-ready', 'completed'];
        if (!allowedRegenStates.includes(row.status ?? '')) {
          return res
            .status(409)
            .json({ message: `Card is ${row.status}; cannot regen ${side} now` });
        }

        // Hard cap: count existing attempts on this side and reject
        // if past cap. The +1 is because attempt #1 is the original
        // generation; the cap counts regens.
        // Also defence-in-depth concurrent-regen guard (added
        // 2026-05-15): if there's already a 'generating' attempt for
        // this side, reject the new one. The client SHOULD prevent
        // double-clicks via its disabled state, but Kevin saw 6
        // concurrent regens fire from rapid clicks before the disable
        // logic kicked in. Belt + braces.
        const existing = await db
          .select({ id: cardAttempts.id, status: cardAttempts.status })
          .from(cardAttempts)
          .where(and(eq(cardAttempts.cardId, id), eq(cardAttempts.side, side)));
        if (existing.length >= REGEN_HARD_CAP_PER_SIDE + 1) {
          return res.status(429).json({
            message: `You've reached the regen limit for the ${side}. Move on or start a new card.`,
          });
        }
        const inFlight = existing.find((a) => a.status === 'generating');
        if (inFlight) {
          return res.status(409).json({
            message: `A regeneration of the ${side} is already in progress (attempt id ${inFlight.id}). Wait for it to finish before starting another.`,
          });
        }

        // Daily cap (re-uses the same per-user limiter as initial gen).
        const limit = await checkDailyGenerationLimit(userId);
        if (!limit.allowed) {
          return res.status(429).json({
            message: `Daily generation limit reached (${limit.used} of ${limit.limit}).`,
          });
        }

        // True fire-and-forget (refactored 2026-05-15 — fixes the
        // regen "spinner stalls" UX bug). createRegenAttemptRow is
        // cheap (~few DB ops, <100ms): it allocates the attempt
        // number and inserts a row in 'generating' state. We return
        // that attemptId immediately so the client's POST resolves
        // right away. runRegenAttempt then does the heavy lifting
        // (provider call, file save, attempt-state update) in a
        // background promise — its result is observable purely via
        // the attempt row's status flipping completed/failed, which
        // the client's existing polling loop already watches.
        //
        // Errors during runRegenAttempt do NOT surface as HTTP
        // errors (the response has already been sent). They're
        // logged here AND persisted to the attempt row as
        // status='failed' so the client sees them via polling.
        const { attemptId, attemptNumber } = await createRegenAttemptRow(
          id,
          side,
          { tweak },
        );
        res.json({ attemptId });

        // Background gen — must NOT throw uncaught (would crash the
        // process). The function's own try/catch updates the attempt
        // row to failed; we just need to swallow the re-throw.
        void runRegenAttempt(attemptId, attemptNumber, id, side, { tweak }).catch(
          (err: any) => {
            if (isProviderError(err)) {
              console.error(
                `[STUDIO] background regenerate FAILED kind=${err.kind} code=${err.code} ` +
                  `retries=${err.retryAttempts} provider=${err.provider}`,
              );
            } else {
              console.error('[STUDIO] background regenerate error:', err);
            }
          },
        );
        return;
      } catch (err: any) {
        // Errors that fire BEFORE we send the response — i.e. from
        // ownership/cap checks above or from createRegenAttemptRow.
        // Background-gen errors are handled inside the void block
        // above and never reach here.
        if (isProviderError(err)) {
          console.error(
            `[STUDIO] regenerate setup FAILED kind=${err.kind} code=${err.code} ` +
              `retries=${err.retryAttempts} provider=${err.provider}`,
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
        console.error('[STUDIO] regenerate setup error:', err);
        res.status(500).json({
          message:
            err?.message ?? "Couldn't regenerate. Your previous version is still safe.",
        });
      }
    },
  );

  // ── PATCH /api/studio/cards/:id/select-attempt ────────────────────
  // Switch which attempt is the "displayed" one for a side without
  // running a new generation. Updates cards.{front|inside}ImageUrl +
  // selectedFrontAttemptId / selectedInsideAttemptId so checkout +
  // share continue to read the right image. Body: { attemptId }.
  app.patch(
    '/api/studio/cards/:id/select-attempt',
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

      const attemptId = Number(req.body?.attemptId);
      if (!Number.isFinite(attemptId)) {
        return res.status(400).json({ message: 'attemptId is required' });
      }

      try {
        // Ownership check + load attempt.
        const cardRows = await db
          .select({ id: cards.id, userId: cards.userId })
          .from(cards)
          .where(eq(cards.id, id))
          .limit(1);
        const card = cardRows[0];
        if (!card) return res.status(404).json({ message: 'Card not found' });
        if (card.userId !== userId) return res.status(403).json({ message: 'Not your card' });

        const attemptRows = await db
          .select({
            id: cardAttempts.id,
            cardId: cardAttempts.cardId,
            side: cardAttempts.side,
            status: cardAttempts.status,
            imageUrl: cardAttempts.imageUrl,
            imagePath: cardAttempts.imagePath,
          })
          .from(cardAttempts)
          .where(eq(cardAttempts.id, attemptId))
          .limit(1);
        const attempt = attemptRows[0];
        if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
        if (attempt.cardId !== id) {
          return res.status(400).json({ message: 'Attempt does not belong to this card' });
        }
        if (attempt.status !== 'completed') {
          return res.status(409).json({
            message: `Attempt is ${attempt.status}; can only select completed attempts`,
          });
        }
        if (!attempt.imageUrl && !attempt.imagePath) {
          return res
            .status(409)
            .json({ message: 'Attempt has no image to select' });
        }

        // The card's stable image-key secret — needed so the canonical
        // mirror + print-res files use the same unguessable filename the
        // attempt was stored under (security audit 2026-07-02).
        const [cardKeyRow] = await db
          .select({ imageKey: cards.imageKey })
          .from(cards)
          .where(eq(cards.id, id))
          .limit(1);
        const imageKey = cardKeyRow?.imageKey ?? null;

        const url = attempt.imagePath
          ? publicImageUrl(attempt.imagePath)
          : attempt.imageUrl!;
        const set =
          attempt.side === 'front'
            ? {
                frontImageUrl: url,
                frontImagePath: attempt.imagePath,
                selectedFrontAttemptId: attempt.id,
              }
            : {
                insideImageUrl: url,
                insideImagePath: attempt.imagePath,
                selectedInsideAttemptId: attempt.id,
              };

        await db.update(cards).set(set).where(eq(cards.id, id));

        // Mirror the per-attempt PNG into the canonical filename
        // (card_X_front.png). PDF, print-resolution upscale, and
        // fulfillment all read by canonical name, so without this
        // copy they'd keep using whichever attempt was last *generated*
        // rather than the one the user picked.
        await promoteAttemptToCanonical(id, attempt.side as CardSide, attempt.id, imageKey);

        // For front swaps, regenerate the 3000×3000 print-res file so
        // it matches the newly-selected attempt. Non-fatal — checkout
        // can still proceed if this hiccups (the canonical display
        // copy is already correct).
        if (attempt.side === 'front') {
          generatePrintResolutionFiles(id, imageKey).catch((err) =>
            console.warn(`[STUDIO] print-res after select-attempt failed:`, err),
          );
        }

        res.json({ ok: true });
      } catch (err: any) {
        console.error('[STUDIO] select-attempt error:', err);
        res.status(500).json({ message: 'Could not switch version' });
      }
    },
  );

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
      // Grab the card first so we can enforce ownership before any
      // deletion side effect.
      const rows = await db
        .select({ id: cards.id, userId: cards.userId })
        .from(cards)
        .where(eq(cards.id, id))
        .limit(1);

      const row = rows[0];
      if (!row) return res.status(404).json({ message: 'Card not found' });
      if (row.userId !== userId) return res.status(403).json({ message: 'Not your card' });

      // PAID-ORDER GUARD (audit 2026-07-27, P0-3): a card with a paid
      // order is a financial record — payment reference, amount, address,
      // Prodigi order id — that UK trading rules require us to retain
      // (and the next Prodigi status webhook needs the row to land on).
      // Deleting the card used to hard-delete those rows. Refuse instead.
      // Must run BEFORE deleteCardImages so we don't purge a paid card's
      // artwork and then refuse. GDPR erasure requests are handled
      // operator-side (anonymise the card, keep the transaction record).
      const paidOrders = await db
        .select({ id: studioOrders.id })
        .from(studioOrders)
        .where(
          and(
            eq(studioOrders.cardId, id),
            eq(studioOrders.paymentStatus, 'paid'),
          ),
        )
        .limit(1);
      if (paidOrders.length > 0) {
        return res.status(409).json({
          message:
            "This card has a completed order, so it can't be deleted — we keep order records for your protection. If something's wrong with the order, get in touch and we'll sort it.",
        });
      }

      // Erase the actual image files FIRST — every file for this card,
      // canonical + per-attempt, from R2 (or local disk in dev). This is
      // the storage half of "right to erasure": a deleted card must not
      // leave its artwork/photos sitting in the bucket. Best-effort — a
      // storage hiccup must not block the DB delete.
      const removed = await deleteCardImages(id);

      // Then remove the card and everything that hangs off it, atomically.
      // `orders` has a FK to cards (no cascade), so it must go before the
      // card row or the delete would error; card_attempts + studio_orders
      // carry user content (tweak text, recipient emails/addresses,
      // messages) and must be erased too. generation_log is left intact —
      // it holds only provider/model/cost/timing (no personal data) and is
      // needed for cost analytics.
      await db.transaction(async (tx) => {
        await tx.delete(cardAttempts).where(eq(cardAttempts.cardId, id));
        await tx.delete(studioOrders).where(eq(studioOrders.cardId, id));
        await tx.delete(orders).where(eq(orders.cardId, id));
        await tx.delete(cards).where(eq(cards.id, id));
      });

      console.log(`[STUDIO] Deleted card ${id} (user ${userId}), ${removed} image file(s) erased`);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[STUDIO] card delete error:', err);
      res.status(500).json({ message: 'Could not delete card: ' + (err?.message ?? String(err)) });
    }
  });
}

// ── First-opened email dispatcher ────────────────────────────────────
// On a valid token hit of /api/card/:id/view, check whether there's
// a paid digital order for the card that hasn't been flagged opened
// yet. If so, flag it + fire one-shot "they've opened it" to the
// sender. All best-effort — errors only go to logs.
async function fireFirstOpenedEmailIfNeeded(
  cardId: number,
  recipientNameFromCard: string | null,
): Promise<void> {
  // Grab the oldest unopened paid digital order for this card. There's
  // typically only one, but belt-and-braces.
  const rows = await db
    .select()
    .from(studioOrders)
    .where(
      and(
        eq(studioOrders.cardId, cardId),
        eq(studioOrders.includesDigital, true),
        eq(studioOrders.paymentStatus, 'paid'),
        isNull(studioOrders.firstOpenedAt),
      ),
    )
    .orderBy(desc(studioOrders.paidAt))
    .limit(1);

  const order = rows[0];
  if (!order) return; // no paid digital, or already emailed

  // Stamp first_opened_at FIRST so a burst of concurrent token hits
  // can't send multiple emails. Guard the update with a WHERE that
  // ensures it's still null — the first write wins.
  const updated = await db
    .update(studioOrders)
    .set({ firstOpenedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(studioOrders.id, order.id),
        isNull(studioOrders.firstOpenedAt),
      ),
    )
    .returning({ id: studioOrders.id });

  if (updated.length === 0) {
    // Lost the race — another concurrent view already stamped it.
    return;
  }

  // Front + inside for the email heroes (remind the sender what they sent).
  const cardImgRows = await db
    .select({
      frontImagePath: cards.frontImagePath,
      frontImageUrl: cards.frontImageUrl,
      insideImagePath: cards.insideImagePath,
      insideImageUrl: cards.insideImageUrl,
    })
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  const cardImageUrl = resolveStoredImageUrl(
    cardImgRows[0]?.frontImagePath ?? null,
    cardImgRows[0]?.frontImageUrl ?? null,
  );
  const insideImageUrl = resolveStoredImageUrl(
    cardImgRows[0]?.insideImagePath ?? null,
    cardImgRows[0]?.insideImageUrl ?? null,
  );

  const senderName = order.customerName?.split(' ')[0] || 'there';
  const sent = await sendSenderCardOpenedEmail({
    senderEmail: order.customerEmail,
    senderName,
    recipientName: recipientNameFromCard,
    cardImageUrl,
    insideImageUrl,
  });
  console.log(
    `[STUDIO] first-opened email ${sent ? 'sent' : 'failed'} → ${order.customerEmail} (order ${order.id}, card ${cardId})`,
  );
}
