// server/routes/admin-card-lab.ts
//
// CARD LAB — the illustrated-card test bench (Aidan 2026-08-15).
//
// The bet under test: users who don't know what they want give us a
// snapshot (who / occasion / a detail or two) and we deal them THREE
// finished card concepts — gag + artwork in a locked house style — for
// pennies. Thortful has 6,000 illustrators; we have one model and a
// per-customer print run of one.
//
// Two endpoints, mirroring the product's real shape:
//   concepts — ONE LLM call → 3 concepts (the gag is the product;
//              text is nearly free, so bad ideas die before pixels)
//   render   — ONE gpt-image-2 LOW render of a chosen concept's front
//              (~$0.006). The client fires 3 in parallel and reveals
//              them as they land.
//
// Admin-gated lab, not customer-facing. Spend logs slot 'card_lab'
// with cardId null → reads as R&D in the ledger, same as Prompt Lab.
//
// DESIGN DECISIONS BAKED IN (move deliberately, not accidentally):
// - Graceful-degradation ladder: contrast joke (loves vs can't-stand)
//   → single-detail joke → relationship+occasion joke. A thin brief
//   must produce a decent card, NEVER a scolding or a wrongly-specific
//   one — "works for everyone" lives or dies here.
// - No humans in the artwork. Illustrated strangers standing in for
//   real people are uncanny AND blur the photo product's lane.
//   Characterful animals + objects are the Thortful-proven language.
// - Front text ≤ 10 words, inside ≤ 28: inside renders as clean
//   typography (like the main product), so only the FRONT text has to
//   survive in-image rendering, and short lines render clean.
// - Cheeky is opt-in and capped at mild British ("bloody", "daft",
//   "arse") — provider moderation judges the OUTPUT image, so the
//   front stays clean and any edge lives inside.

import type { Express, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { users } from '@shared/schema';
import { openai } from '../utils/shared';
import { getProvider } from '../providers/registry';
import { logGeneration } from '../prompts/generation-log';
import { llmCostCents } from '../prompts/llm-cost';

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const otpUserId = (req as any).session?.otpUserId;
  if (typeof otpUserId !== 'string' || otpUserId.length === 0) {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  const row = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, otpUserId))
    .limit(1);
  if (row[0]?.isAdmin !== true) {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
}

// ── THE HOUSE STYLE ──────────────────────────────────────────────────
// "The Celebrait Look — Illustrated". Locked here so every render in a
// session is unmistakably one shop's work. Iterate the WORDS of this in
// the lab; never let per-card art direction override the style spine.
export const HOUSE_STYLE = `STYLE — "Celebrait Illustrated" (locked, applies to the whole image):
Modern gouache greeting-card illustration. Chunky, simplified shapes with visible brush texture and a soft paper grain across the whole image. Warm cream paper background. Bold but LIMITED palette — at most five colours plus one hot accent colour. Generous negative space; one clear focal subject, never cluttered. Characterful ANIMALS and OBJECTS only — absolutely no humans, no human faces, no hands. Flat, print-friendly colour with slight ink-edge darkening; contemporary indie-card-shop aesthetic (think risograph-meets-gouache), NOT glossy digital art, NOT 3D render, NOT photorealism, NOT watercolour wash.
LETTERING: the front text is hand-painted lettering, PART of the artwork — same gouache brush quality, same palette, integrated into the composition (on a banner, painted large in the negative space, wrapped around the subject). Big, joyful, instantly legible from arm's length.`;

const conceptsSchema = z.object({
  who: z.string().max(60),
  occasion: z.string().max(60),
  from: z.string().max(60).optional(),
  loves: z.string().max(200).optional(),
  cantStand: z.string().max(200).optional(),
  anythingElse: z.string().max(300).optional(),
  tone: z.enum(['funny', 'warm', 'mix']).default('mix'),
  cheeky: z.boolean().default(false),
  insideMode: z.enum(['auto', 'own', 'blank']).default('auto'),
  ownInsideText: z.string().max(300).optional(),
});

interface CardConcept {
  angle: string;
  front_text: string;
  inside_text: string;
  art_direction: string;
}

function conceptSystemPrompt(): string {
  return `You write greeting-card concepts for Celebrait — personalised, illustrated, printed cards. You are given a snapshot of a real person and you return THREE complete card concepts as JSON.

Each concept = the CARD ITSELF:
- front_text: what is painted on the front. MAXIMUM 10 words. This is the hook — a setup, a declaration, or the gag itself.
- inside_text: what is printed inside. MAXIMUM 28 words. If the front is a setup, this is the punchline. Always ends warm enough to sign.
- art_direction: one sentence describing the front illustration — ONE focal subject (an animal or object, NEVER a human), what it is doing, one or two supporting details. It must serve the joke or sentiment, not decorate it.
- angle: one word — 'funny', 'dry', or 'warm'.

THE MATERIAL LADDER — use the best rung you actually have, never reach for one you don't:
1. CONTRAST: they love X and can't stand Y → the joke writes itself from the gap. This is gold — use it when both exist.
2. SINGLE DETAIL: one thing they love, a running joke, a fact → build the card around it, specifically and affectionately.
3. RELATIONSHIP + OCCASION alone → warm, sharp, universal-but-well-made. NEVER invent details you weren't given. NEVER complain about missing information. A thin brief still gets a great card.

HUMOUR RULES:
- The joke is NOTICED, not invented: it comes from their actual details, seen fondly and from an unexpected angle.
- Affectionate teasing, never cruel. The recipient should feel KNOWN, not roasted.
- Banned: "another year older", "over the hill", age-mocking, generic pun-with-no-connection, anything a supermarket card could say.
- Dry = understatement and deadpan. Warm = specific gratitude or love, never greeting-card mush ("you mean the world").

TONE STEER:
- tone=funny → three different JOKE SHAPES (e.g. contrast gag, deadpan understatement, absurd escalation of their thing).
- tone=warm → three warm registers (tender, proud, playful-warm).
- tone=mix → one funny, one dry, one warm.
- cheeky=true → mild British cheek is allowed ("bloody", "daft", "arse") — INSIDE TEXT ONLY, front stays clean. cheeky=false → keep it clean everywhere.

INSIDE MODE:
- auto → write inside_text per the rules above.
- own → the sender is writing their own message: set inside_text to "".
- blank → set inside_text to "".

Return JSON: {"concepts":[{...},{...},{...}]} — exactly three, distinct from each other in shape, not three drafts of one idea.`;
}

export function registerAdminCardLabRoutes(app: Express): void {
  // ── POST /api/admin/card-lab/concepts ────────────────────────────
  app.post('/api/admin/card-lab/concepts', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    if (!openai) return res.status(503).json({ message: 'OpenAI not configured' });
    let body: z.infer<typeof conceptsSchema>;
    try {
      body = conceptsSchema.parse(req.body);
    } catch {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const briefLines = [
      `Recipient: ${body.who}`,
      `Occasion: ${body.occasion}`,
      body.from?.trim() ? `From: ${body.from.trim()}` : '',
      body.loves?.trim() ? `They love: ${body.loves.trim()}` : '',
      body.cantStand?.trim() ? `They can't stand: ${body.cantStand.trim()}` : '',
      body.anythingElse?.trim() ? `Also: ${body.anythingElse.trim()}` : '',
      `tone=${body.tone} cheeky=${body.cheeky} insideMode=${body.insideMode}`,
    ].filter(Boolean);

    const startedAt = Date.now();
    try {
      // gpt-4o, not mini: wit is the product here and mini's jokes are
      // flat. Still ~£0.003/call — the art costs 2× more than the words.
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: conceptSystemPrompt() },
          { role: 'user', content: briefLines.join('\n') },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
        max_tokens: 700,
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
      const concepts: CardConcept[] = (parsed.concepts ?? []).slice(0, 3);

      void logGeneration({
        cardId: null,
        slot: 'card_lab',
        templateId: null,
        templateVersion: null,
        provider: 'openai',
        model: 'gpt-4o',
        quality: null,
        costCents: llmCostCents(
          'gpt-4o',
          completion.usage?.prompt_tokens ?? 0,
          completion.usage?.completion_tokens ?? 0,
        ),
        durationMs: Date.now() - startedAt,
        success: concepts.length === 3,
      });

      if (concepts.length !== 3) {
        return res.status(502).json({ message: 'Concept generation came back malformed — try again' });
      }
      res.json({ concepts });
    } catch (err) {
      console.error('[CARD-LAB] concepts error:', err);
      res.status(500).json({ message: 'Concept generation failed' });
    }
  });

  // ── POST /api/admin/card-lab/render ──────────────────────────────
  // One front, gpt-image-2 LOW (~$0.006). The client fires three of
  // these in parallel — no batching server-side so each card can land
  // and reveal the moment it's ready.
  app.post('/api/admin/card-lab/render', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const schema = z.object({
      front_text: z.string().min(1).max(120),
      art_direction: z.string().min(1).max(500),
    });
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(req.body);
    } catch {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const prompt = [
      HOUSE_STYLE,
      '',
      `ILLUSTRATION: ${body.art_direction}`,
      '',
      `FRONT TEXT — render EXACTLY and ONLY: "${body.front_text}". Hand-painted lettering per the style block, integrated into the composition, every word legible, no cropping. ABSOLUTELY NO other text, letters, numbers, signatures or watermarks anywhere in the image.`,
      '',
      'Square 1024x1024 full-bleed greeting-card front.',
    ].join('\n');

    try {
      const provider = getProvider('openai-2');
      const result = await provider.generate({
        prompt,
        quality: 'low',
        size: '1024x1024',
        slot: 'card_lab',
      });
      void logGeneration({
        cardId: null,
        slot: 'card_lab',
        templateId: null,
        templateVersion: null,
        provider: result.provider,
        model: result.model,
        quality: 'low',
        costCents: result.costCents,
        durationMs: result.durationMs,
        success: true,
      });
      res.json({ imageUrl: result.imageUrl, costUsd: result.costUsd, durationMs: result.durationMs });
    } catch (err: any) {
      console.error('[CARD-LAB] render error:', err?.message ?? err);
      res.status(502).json({ message: err?.message ?? 'Render failed' });
    }
  });
}
