// server/routes/dev-test-failures.ts
//
// Dev-only endpoints powering the floating test panel in Studio:
//
//   GET  /api/dev/stub-mode           → returns { on: boolean }
//   POST /api/dev/stub-mode           → body { on: boolean }; toggles
//                                        DEV_STUB_AI at runtime (no
//                                        restart needed). Reverts to env
//                                        default on next server boot.
//   POST /api/dev/inject-failure      → body { kind: ProviderErrorKind | null };
//                                        next stub-mode gen call throws
//                                        a synthetic ProviderError of
//                                        that kind. Auto-clears after
//                                        one consumption.
//   POST /api/dev/spawn-test-card     → builds a realistic dummy
//                                        CardDraftState (using the
//                                        caller's most recent photo as
//                                        reference) and immediately
//                                        kicks off generation. Returns
//                                        { cardId } so the client can
//                                        redirect into the card view.
//                                        Composes with inject-failure:
//                                        arm a kind, spawn, watch the
//                                        panel render.
//
// Hard guards:
//   - All endpoints 404 in production (NODE_ENV check)
//   - inject-failure 400s if stub mode is OFF (real provider calls would
//     burn tokens before consuming the injection — only safe inside the
//     stub path)
//   - spawn-test-card 400s if the user has no uploaded photos (we use
//     the most recent one as the reference)
//
// Throwaway tooling — pairs with the dev test panel client component.
// Both can be deleted post-launch without touching anything else.

import type { Express, Request, Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { cards, photos, type CardDraftState } from '@shared/schema';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';
import {
  generateStudioCard,
  injectNextTestFailure,
  isStubMode,
  setStubMode,
} from '../background-generator';
import type { ProviderErrorKind } from '../providers/errors';

const VALID_KINDS = new Set<ProviderErrorKind>([
  'safety',
  'rate',
  'server',
  'unknown',
]);

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

// The stub-mode toggle (only) is allowed in production when opted in via
// ALLOW_STUB_TOGGLE=1 — so a TEST server can flip stub live. The failure-
// injection endpoints stay strictly dev-only.
function stubToggleBlocked(): boolean {
  return isProd() && process.env.ALLOW_STUB_TOGGLE !== '1';
}

function getUserId(req: Request): string | null {
  const id = (req as any).session?.otpUserId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function registerDevTestFailureRoutes(app: Express): void {
  // ── GET /api/dev/stub-mode ───────────────────────────────────────────
  app.get('/api/dev/stub-mode', (_req: Request, res: Response) => {
    if (stubToggleBlocked()) return res.status(404).json({ message: 'Not found' });
    res.json({ on: isStubMode() });
  });

  // ── POST /api/dev/stub-mode ──────────────────────────────────────────
  app.post('/api/dev/stub-mode', (req: Request, res: Response) => {
    if (stubToggleBlocked()) return res.status(404).json({ message: 'Not found' });
    const { on } = req.body as { on: boolean };
    if (typeof on !== 'boolean') {
      return res
        .status(400)
        .json({ message: 'Body must be { on: boolean }' });
    }
    setStubMode(on);
    res.json({ ok: true, on: isStubMode() });
  });

  // ── POST /api/dev/inject-failure ─────────────────────────────────────
  app.post('/api/dev/inject-failure', (req: Request, res: Response) => {
    if (isProd()) return res.status(404).json({ message: 'Not found' });

    if (!isStubMode()) {
      return res.status(400).json({
        message:
          'Test failures only fire in stub mode. Toggle stub mode ON via the dev panel first — otherwise the next gen would burn real tokens before consuming the injection.',
      });
    }

    const { kind } = req.body as { kind: ProviderErrorKind | null };

    if (kind === null) {
      injectNextTestFailure(null);
      return res.json({ ok: true, kind: null });
    }

    if (!VALID_KINDS.has(kind)) {
      return res.status(400).json({
        message: `Invalid kind. Must be one of: ${Array.from(VALID_KINDS).join(', ')} or null`,
      });
    }

    injectNextTestFailure(kind);
    res.json({ ok: true, kind });
  });

  // ── POST /api/dev/spawn-test-card ────────────────────────────────────
  // Skip the entire card-maker flow. Builds a realistic CardDraftState
  // from dummy values + the caller's most recent photo, creates the
  // card row, immediately kicks off generation. Composes with
  // inject-failure for one-click failure-panel iteration.
  app.post(
    '/api/dev/spawn-test-card',
    isAuthenticated,
    async (req: Request, res: Response) => {
      if (isProd()) return res.status(404).json({ message: 'Not found' });

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      try {
        // Pull the user's most recent photo to use as the reference.
        // We use real user data so the test card exercises the real
        // photo pipeline (cropping, face-detect, upload paths).
        const recentPhoto = await db
          .select({ id: photos.id })
          .from(photos)
          .where(eq(photos.userId, userId))
          .orderBy(desc(photos.id))
          .limit(1);

        if (recentPhoto.length === 0) {
          return res.status(400).json({
            message:
              'No photos found on your account. Upload one via /studio/new-card → photo step, then try spawn again. Subsequent spawns will reuse it.',
          });
        }
        const photoId = recentPhoto[0].id;

        // Realistic dummy draft. Hits all readiness checks
        // (isDraftReadyToGenerate in studio-drafts.ts).
        const draft: CardDraftState = {
          version: 1,
          // Review step. Was 6 pre-V1-scope-cut when there were 7 steps;
          // after the Style step was removed (2026-05-17, 37d7f4be) the
          // Review step's index is 5. The stale `6` here made spawned
          // cards land at currentStep=6 in the card-maker — no render
          // branch matched → empty panel + all-green stepper (the
          // failure-injection no-render bug, fixed 2026-05-22).
          step: 5,
          recipient: {
            name: 'Sarah',
            occasion: 'birthday',
          },
          photos: {
            mode: 'one_person',
            photoIds: [photoId],
          },
          scene: {
            description:
              'A sunny day at the beach with friends, cocktails in hand, warm golden-hour light.',
          },
          style: {
            mode: 'animated',
          },
          front: {
            mode: 'write',
            text: 'Happy Birthday, Sarah',
          },
          inside: {
            mode: 'write',
            write: {
              salutation: 'Hey Sarah,',
              message:
                "Happy birthday! Hope this year brings every good thing. So glad to know you.",
              signoff: 'Love, K',
            },
          },
        };

        // Insert as 'generating' immediately — we're firing gen on the
        // same tick. The card-edit page detects 'generating' and shows
        // the right UI.
        const [inserted] = await db
          .insert(cards)
          .values({
            userId,
            sceneType: 'with-person',
            price: 0,
            status: 'generating',
            cardType: 'printed',
            printOption: 'front-and-inside',
            conversationData: draft,
          })
          .returning({ id: cards.id });

        const cardId = inserted.id;

        console.log(
          `[DEV_SPAWN] Spawned test card ${cardId} for user ${userId.slice(0, 8)}… (photo=${photoId})`,
        );

        // Fire-and-forget gen. generateStudioCard sets status='failed'
        // on errors (including our injected ones), so the client polling
        // /api/studio/drafts/:id sees the right state.
        setImmediate(() => {
          generateStudioCard(cardId).catch((err) => {
            console.error(
              `[DEV_SPAWN] generateStudioCard threw for card ${cardId}:`,
              err,
            );
          });
        });

        res.json({
          ok: true,
          cardId,
          redirectTo: `/studio/card/${cardId}/edit`,
        });
      } catch (err: any) {
        console.error('[DEV_SPAWN] error:', err);
        res
          .status(500)
          .json({ message: `Spawn failed: ${err?.message ?? String(err)}` });
      }
    },
  );
}
