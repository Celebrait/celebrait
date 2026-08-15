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
export const QUIRKY_DNA = `STYLE DNA — "Celebrait Quirky" v2 (applies to the whole image, always):
A CONTEMPORARY ART PRINT, not a greeting card cliché — the kind of bold flat-illustration piece trending in independent print shops and on gallery walls right now.
COLOUR IS THE ENERGY: a SATURATED colour-block ground with 3-5 flat electric ink colours on top in high-contrast, clashing-but-curated pairs. Vibrant, joyful, confident — fluorescent-adjacent brightness like risograph fluoro inks. The SPECIFIC colours are given per card in the PALETTE line below: obey it exactly, it was chosen from the subject's own world.
FLAT AND HAND-MADE: zero gradients, zero 3D, zero airbrush smoothness, zero digital gloss. Matisse-cutout confidence — big simplified shapes with deliberate hand-cut wobble, slight ink misregistration, visible screen-print grain. Oversized motifs, brave cropping, asymmetric composition — NEVER a small object floating centred in empty space (that is the AI tell — avoid it).
MOTIFS: objects, food, drink, botanicals, the kit of a hobby — still-life only: no humans, no faces, no cartoon animal characters. Retro-modern garnish welcome in moderation: a checkerboard edge, wavy stripes, a sunburst, abstract blobs.
LETTERING: hand-drawn and CHUNKY — retro-modern fat serif, groovy 70s-revival script, or bold naive caps — same ink family as the art, big enough to matter, part of the composition.
The bar: it should look like a limited-run screen print you'd frame — current, collectible, unmistakably made by a human hand.`;

export const QUIRKY_FORMATS: Record<string, string> = {
  statement: `COMPOSITION — STATEMENT (MINIMAL): this card is almost EMPTY, and that is its power. A vast, flat, saturated ground occupies at least 70% of the card. ONE small-to-medium motif — a single object, beautifully drawn — placed off-centre with huge breathing room. The lettering is modest and precise, tucked near the motif or in a corner, never shouting. No pattern, no border, no garnish, no texture-filling: restraint IS the design. Gallery-minimal.`,
  hero: `COMPOSITION — HERO (BALANCED): ONE object drawn HUGE and cropped by the frame edges, confident contour and flat fills, a single loose brush-swash or colour-block behind it, calm ground visible around. Expressive script for the words plus breathing space. Poster energy, not busy.`,
  pattern: `COMPOSITION — PATTERN (DENSE): the motif repeats bold across the whole card at varied scales, some cropped off the edges. Lettering broken into short word-groups woven through the gaps. Rich and full — this is the maximal card of the range.`,
  label: `COMPOSITION — LABEL (DENSE): a punchy modern packet/label lockup — bold simple border, arced or stacked type, the motif bunched large in the centre, halftone shading in one ink. Craft-beer-label energy, structured-busy.`,
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

You are given who the card is for, the occasion, who it's from, and up to THREE things the recipient loves. Return THREE concepts as JSON — EACH built on a DIFFERENT love (concept 1 → love 1, etc.).

IF A LOVE SLOT IS EMPTY, that concept is about the RELATIONSHIP AND OCCASION ALONE — being a dad, a nan, a mate. It must reference NO specific hobby or object, including any mentioned as examples elsewhere in these instructions (no fishing, vinyl, cassettes, wheels, lemons, grills, coffee — those are TEACHING EXAMPLES, not this person's life). Rereading your line for an empty slot: if it names a thing they'd have to own or do, replace it.

WRITE WIDE, THEN EDIT — do this internally before answering:
1. For EACH love, draft THREE candidate front lines (nine total): one wordplay, one deadpan/affectionate observation, one proud declaration.
2. Then be a ruthless editor. A line SURVIVES only if it passes ALL of:
   - THE PUB TEST: said aloud to a friend, it lands instantly — no explanation, no "get it?". If a pun needs unpacking, it is DEAD.
   - IT PARSES: a real, natural sentence. Nonsense mashups ("Fatherhood at DC10 beats dropper") are the cardinal failure — never output a line whose grammar wobbles.
   - IT IS ABOUT THEM: their love is doing the work, not the occasion. "Level up for your birthday!" is generic filler — dead.
   - NO CRINGE ZONE: no "vibe(s)" as a noun, no "boss/legend/hero" clichés, no hashtag-speak, at most ONE exclamation mark across the whole card.
3. Pick the single best survivor per love. A clean deadpan line ALWAYS beats a strained pun. The bar is "simply the zest" — a stranger smiles unprompted.

Each returned concept:
- format: one of "statement", "hero", "pattern", "label" — composition recipes at three densities (statement=minimal, hero=balanced, pattern/label=dense). THE SET MUST SPAN THE RANGE: exactly one "statement" (every hand contains one), one "hero", and one of "pattern"/"label". Match each love to the recipe that flatters it. A statement card's line should be its shortest and driest.
- front_text: the surviving line. MAXIMUM 8 words. It must CONNECT to the picture — the words and the motif complete each other.
- inside_text: MAXIMUM 28 words. Lands the affection, may extend the joke, always warm enough to sign. References their love naturally. Never restates the front.
- art_direction: one sentence — the MOTIF (objects/food/botanicals/kit of that hobby, NEVER humans or cartoon animal characters) and how it sits in the chosen format.
- palette: you are the art director — name the ground colour plus 3-4 ink colours, ALL DRAWN FROM THAT LOVE'S OWN WORLD (kit colours; turmeric-chilli-coriander; sea and sunset). The three cards' palettes MUST be clearly distinct — three different ground hues, no two cards sharing a colour family.
- angle: "quirky".

RULES:
- Classy always: no clip-art energy, no emoji.
- Brands/bands/places evoked through objects and colours (a cassette and bucket hat; never logos, never lyrics, never real faces). Song/film TITLES may be name-dropped if the line still parses naturally.
- Occasion lives in the INSIDE text; the front is about THEM.
- INSIDE MODE: auto → write inside_text. own or blank → inside_text = "".

FINAL CHECK — do this LAST, immediately before returning: read your three front_texts once more. If ANY of them contains "vibe" or "vibes", "level up", "boss", "legend", "goals", or "mode", OR would need explaining in a pub, OR is about the occasion instead of their love — REPLACE it with the runner-up candidate for that love before answering. This check has caught a failure in most previous runs; assume it will catch one in yours.

Return JSON: {"concepts":[{...},{...},{...}]} — three distinct loves, three distinct formats, three distinct palettes.`;
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
        temperature: 0.7,
        max_tokens: 700,
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
      let concepts: CardConcept[] = (parsed.concepts ?? []).slice(0, 3);

      // The ban list is enforced in CODE, not hope — two prompt passes
      // still leaked "vibes". One corrective retry naming the offenders;
      // if that also fails we ship anyway (logged) rather than error.
      const BANNED = /\b(vibes?|level up|bossin?|legend|goals|beast mode|mode)\b/i;
      const offenders = concepts.filter((c) => BANNED.test(c.front_text ?? ''));
      if (offenders.length > 0) {
        const retry = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: conceptSystemPrompt() },
            { role: 'user', content: briefLines.join('\n') },
            { role: 'assistant', content: completion.choices[0]?.message?.content ?? '' },
            { role: 'user', content: `These front lines broke the banned-word rule: ${offenders.map((o) => `"${o.front_text}"`).join(', ')}. Replace ONLY those concepts' front_text (and inside_text if it echoed the line) with clean survivors — no "vibe(s)", "level up", "boss", "legend", "goals", "mode". Return the complete corrected JSON.` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.5,
          max_tokens: 700,
        });
        try {
          const reparsed = JSON.parse(retry.choices[0]?.message?.content ?? '{}');
          const fixed: CardConcept[] = (reparsed.concepts ?? []).slice(0, 3);
          if (fixed.length === 3) concepts = fixed;
        } catch { /* keep originals */ }
        const still = concepts.filter((c) => BANNED.test(c.front_text ?? ''));
        if (still.length) console.warn('[CARD-LAB] banned words survived retry:', still.map((c) => c.front_text));
      }

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
      format: z.enum(['statement', 'hero', 'pattern', 'label', 'editorial']).default('hero'),
      palette: z.string().max(300).optional(),
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
      QUIRKY_FORMATS[body.format === 'editorial' ? 'hero' : body.format],
      '',
      `ILLUSTRATION: ${body.art_direction}`,
      body.palette ? `PALETTE (obey exactly): ${body.palette}` : '',
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
