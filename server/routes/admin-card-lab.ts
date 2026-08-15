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

// ── THE HOUSE STYLE — "Celebrait Quirky" ─────────────────────────────
// Direction locked from Aidan's three references (2026-08-15): the
// lemons pattern card ("simply the zest"), the vintage seed-packet
// tomatoes card, the Aperol editorial print. Their shared DNA is the
// style; their three distinct FORMATS are how "varied" stays coherent.
// Object-led, never characters — the earlier animals-in-hats direction
// is dead: quirky-classy means still-life motifs doing visual puns.
export const QUIRKY_DNA = `STYLE DNA — "Celebrait Quirky" (applies to the whole image, always):
FLAT illustration — zero gradients, zero 3D, zero photorealism, zero digital gloss. Warm paper ground (soft cream or gentle blush pink). LIMITED palette: 3-5 ink colours plus at most one metallic-gold accent for sparkle marks. Visible print texture across everything — soft riso grain or halftone dots, slight ink misregistration charm. Confident simplified shapes with hand-painted edges. Motifs are OBJECTS, food, drink, botanicals, tools of a hobby — still-life elements ONLY: no humans, no faces, no cartoon animal characters. Composition is generous and classy — gallery-art-print restraint, never clip-art, never busy. HAND-LETTERING is part of the artwork: same ink, same hand, woven into the composition. The whole thing should look like a £5 card from a good independent shop.`;

export const QUIRKY_FORMATS: Record<string, string> = {
  pattern: `FORMAT — ALLOVER PATTERN: the motif repeats across the whole card like beautiful wrapping paper (varied sizes, whole and cut/cross-section views, scattered leaves or accents between). The lettering is broken into 2-4 short word-groups WOVEN through the gaps between motifs, wonky hand-drawn lowercase, reading top to bottom.`,
  label: `FORMAT — VINTAGE LABEL: a pastiche of an old packet, matchbox or produce label. Decorative hand-drawn border frame with corner ornaments, an arced banner carrying part of the text, the motif bunched in the centre with halftone shading, a small plaque or lozenge carrying the final word. Slightly aged, letterpress feel.`,
  editorial: `FORMAT — EDITORIAL PRINT: ONE hero object drawn large with confident contour line and flat colour fill, a single loose brush-swash of a second colour behind it, big casual brush-script for the main words plus one small neat hand-written caption block. Lots of calm paper space. Food-magazine art print energy.`,
};
const conceptsSchema = z.object({
  who: z.string().max(60),
  occasion: z.string().max(60),
  from: z.string().max(60).optional(),
  love1: z.string().max(120).optional(),
  love2: z.string().max(120).optional(),
  love3: z.string().max(120).optional(),
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
  return `You write QUIRKY greeting-card concepts for Celebrait — flat-illustrated, classy, visual-pun-led cards in the spirit of good independent card shops ("you are simply the zest" over lemons; "I love you from my head tomatoes" as a vintage seed packet).

You are given who the card is for, the occasion, who it's from, and up to THREE things the recipient loves. Return THREE concepts as JSON — EACH CONCEPT IS BUILT ON A DIFFERENT ONE of their loves (concept 1 → love 1, concept 2 → love 2, concept 3 → love 3). If fewer than three loves were given, build the remainder on the occasion itself.

Each concept:
- format: exactly one of "pattern", "label", "editorial" — USE ALL THREE ACROSS THE SET, one each, matched to whichever suits that love best.
- front_text: MAXIMUM 8 words. The visual pun or quip. The words must CONNECT to the picture — the pun IS the bridge ("zest" works because the card is lemons). Smooth puns only: it must read naturally as a sentence. If no good pun exists for that love, use a deadpan affectionate line about it instead — NEVER force a clunker.
- inside_text: MAXIMUM 28 words. Lands the affection, may extend the joke, always warm enough to sign. References their love naturally.
- art_direction: one sentence — the MOTIF (objects/food/botanicals/kit of that hobby, NEVER humans or cartoon animal characters) and how it sits in the chosen format.
- angle: "quirky".

RULES:
- Classy always: no clip-art energy, no emoji, at most one exclamation mark across the whole card.
- The pun bar is "simply the zest": a stranger should smile, not groan-and-die. Wordplay on THEIR thing beats generic occasion puns.
- Occasion belongs in the INSIDE text (or a small part of the front if natural) — the front is about THEM.
- If a love is a brand/band/franchise, evoke it through objects and colours (a cassette and bucket hat; never logos, never real faces).

INSIDE MODE: auto → write inside_text. own or blank → inside_text = "".

Return JSON: {"concepts":[{...},{...},{...}]} — three distinct loves, three distinct formats.`;
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

    const loves=[body.love1, body.love2, body.love3].map(l=>l?.trim()).filter(Boolean);
    const briefLines = [
      `Recipient: ${body.who}`,
      `Occasion: ${body.occasion}`,
      body.from?.trim() ? `From: ${body.from.trim()}` : '',
      ...loves.map((l, i) => `Love ${i + 1}: ${l}`),
      `insideMode=${body.insideMode}`,
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
      format: z.enum(['pattern', 'label', 'editorial']).default('editorial'),
    });
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(req.body);
    } catch {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const prompt = [
      QUIRKY_DNA,
      '',
      QUIRKY_FORMATS[body.format],
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
