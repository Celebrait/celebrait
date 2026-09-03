// server/routes/make.ts
//
// DOOR 2 — KEEP AND BUY (Phase C, 2026-09-02).
//
// The public maker (/make) generates for free behind the guest gate;
// nothing is written until the person has a finished card and wants to
// keep or buy it (the money boundary, UX_THREE_DOORS.md §3). Then:
//
//   POST /api/make/cards        — persist the finished card as a `cards`
//                                 row with source 'maker', owned by the
//                                 session user if signed in, otherwise
//                                 anonymous and proved by its imageKey —
//                                 the rack's exact guest pattern, so
//                                 /buy/:id and checkout need no changes.
//   POST /api/make/cards/:id/claim — a signed-in user adopts an
//                                 anonymous maker card by presenting its
//                                 token ("Keep it → sign in"). Single-shot
//                                 and race-safe (user_id IS NULL guard).

import type { Express, Request, Response } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { cards } from '@shared/schema';
import { cardPriceGBP } from '@shared/pricing';
import { publicImageUrl, storeImageToCustomFilename } from '../image-storage';
import { requireGuestMaker } from './admin-card-lab';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';
import type { MakerDraftState } from '@shared/models/card-draft';

const dataImage = z.string().startsWith('data:image/').max(12_000_000);

const saveSchema = z.object({
  frontImageUrl: dataImage,
  insideImageUrl: dataImage.nullable().optional(),
  /** The kept front is the cameo version (them drawn in). */
  cameo: z.boolean().optional(),
  insideMode: z.enum(['ours', 'own', 'blank']).optional(),
  brief: z.object({
    who: z.string().max(40),
    gender: z.enum(['him', 'her']).nullable().optional(),
    age: z.number().int().min(1).max(110).nullable().optional(),
    interest: z.string().max(80).optional(),
    dislike: z.string().max(60).optional(),
    recipientName: z.string().max(40).optional(),
    tone: z.enum(['funny', 'warm', 'rude', 'mix']),
    occasion: z.string().max(40),
  }),
  concept: z.object({
    front_text: z.string().max(400),
    inside_text: z.string().max(1000).optional(),
    art_direction: z.string().max(4000).optional(),
    palette: z.string().max(200).optional(),
    typeface: z.string().max(200).optional(),
    direction: z.string().max(400).optional(),
  }).optional(),
  /** What went inside, as the person composed it (opener + body + sign-off). */
  message: z.string().max(2000).optional(),
});

/** What the studio grid reads (storage.ts getUserCardsForGrid) sits
 *  alongside the maker's own state: recipient.name / recipient.occasion
 *  give the tile its title, `step` marks it finished. Without them a
 *  maker card would be "Untitled card" — or hidden as an untouched draft. */
type MakerCardState = MakerDraftState & {
  recipient: { name: string | null; occasion: string | null };
  step: number;
  cameo?: boolean;
  concept?: z.infer<typeof saveSchema>['concept'];
  message?: string;
};

export function registerMakeRoutes(app: Express): void {
  const saveGate = requireGuestMaker('save');

  // ── POST /api/make/cards ───────────────────────────────────────────
  app.post('/api/make/cards', async (req: Request, res: Response) => {
    if (!(await saveGate(req, res))) return;
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'That card didn’t come through in one piece — try again' });
    const body = parsed.data;
    try {
      const imageKey = randomUUID().replace(/-/g, '');
      // Stored under the token so the names are unguessable and the
      // webp + thumb siblings come for free (storeImageToCustomFilename).
      const front = await storeImageToCustomFilename(body.frontImageUrl, `maker_${imageKey}_front.png`);
      const inside = body.insideImageUrl
        ? await storeImageToCustomFilename(body.insideImageUrl, `maker_${imageKey}_inside.png`)
        : null;

      const occasionLabel = body.brief.occasion.trim() || 'Birthday';
      const state: MakerCardState = {
        version: 1,
        source: 'maker',
        brief: {
          who: body.brief.who,
          gender: body.brief.gender ?? undefined,
          age: body.brief.age ?? null,
          interest: body.brief.interest || undefined,
          dislike: body.brief.dislike || undefined,
          recipientName: body.brief.recipientName || undefined,
          tone: body.brief.tone,
          occasion: occasionLabel,
        },
        resumeAt: 'done',
        insideMode: body.insideMode,
        cameo: body.cameo ?? false,
        concept: body.concept,
        message: body.message,
        recipient: { name: body.brief.recipientName?.trim() || body.brief.who.trim() || null, occasion: occasionLabel },
        step: 5,
      };

      // A signed-in maker owns the card outright; a guest proves it by
      // the token. `status: 'completed'` = finished but unpaid — what
      // checkout expects and where the studio's Ready shelf looks.
      const userId = (req as any).session?.otpUserId ?? null;
      const [card] = await db
        .insert(cards)
        .values({
          userId,
          source: 'maker',
          sceneType: 'maker',
          cardType: 'printed',
          printOption: 'front-and-inside',
          status: 'completed',
          price: cardPriceGBP('maker'),
          frontImagePath: front.filename,
          insideImagePath: inside?.filename ?? null,
          conversationData: state as unknown as Record<string, unknown>,
          imageKey,
          viewToken: randomUUID().replace(/-/g, ''),
        })
        .returning({ id: cards.id });

      console.log(`[MAKE] card ${card.id} saved (${userId ? `user ${userId}` : 'guest'}${body.cameo ? ', cameo' : ''})`);
      res.json({
        cardId: card.id,
        cardToken: imageKey,
        owned: !!userId,
        frontImageUrl: publicImageUrl(front.filename),
        insideImageUrl: inside ? publicImageUrl(inside.filename) : null,
        price: cardPriceGBP('maker'),
      });
    } catch (err) {
      console.error('[MAKE] save failed:', err);
      res.status(500).json({ message: "We couldn't save that card — try again" });
    }
  });

  // ── POST /api/make/cards/:id/claim ─────────────────────────────────
  // "Keep it → sign in": the token travels in the browser (the OTP
  // verify regenerates the session, so nothing pre-auth survives there),
  // and is presented once the person is signed in.
  app.post('/api/make/cards/:id/claim', isAuthenticated, async (req: Request, res: Response) => {
    const cardId = Number(req.params.id);
    const token = typeof req.body?.cardToken === 'string' ? req.body.cardToken : '';
    const userId = (req as any).session?.otpUserId as string | undefined;
    if (!Number.isInteger(cardId) || !token || !userId) return res.status(400).json({ message: 'Nothing to claim' });
    try {
      const updated = await db
        .update(cards)
        .set({ userId })
        .where(and(eq(cards.id, cardId), isNull(cards.userId), eq(cards.imageKey, token), eq(cards.source, 'maker')))
        .returning({ id: cards.id });
      if (updated.length === 0) {
        // Already theirs? Fine — say so rather than fail the landing.
        const [own] = await db.select({ id: cards.id }).from(cards).where(and(eq(cards.id, cardId), eq(cards.userId, userId))).limit(1);
        if (own) return res.json({ ok: true, cardId, alreadyOwned: true });
        return res.status(404).json({ message: "That card isn't here to keep" });
      }
      console.log(`[MAKE] card ${cardId} claimed by user ${userId}`);
      res.json({ ok: true, cardId });
    } catch (err) {
      console.error('[MAKE] claim failed:', err);
      res.status(500).json({ message: "We couldn't keep that card — try again" });
    }
  });
}
