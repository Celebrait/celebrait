// server/routes/studio-inside-text.ts
//
// "Help me write this" — LLM-assisted inside-card message helper.
//
// Why it exists:
//   Greeting-card writer's block is real. Pre-this, the inside-text
//   input was a blank textarea staring back at the user. That's the
//   single biggest reason supermarket cards with pre-written rhymes
//   exist as a market — most people don't know what to write. The
//   helper seeds three suggestions grounded in the card's actual
//   context (recipient, occasion, scene, photo summaries, style) and
//   lets the user pick + edit, or "show more options" / "different
//   tone" to iterate. Their voice still ships; we just unblock the
//   blank-page moment.
//
// Pattern mirrors studio-brainstorm.ts:
//   - openai chat.completions with response_format=json_object
//   - inline system prompt (Prompt Lab is heavy machinery for image
//     gen versioning; text helpers iterate faster inline)
//   - light defensive parsing + fallback
//
// Each call returns exactly three suggestions, varied along:
//   - tone (sincere / playful / brief)
//   - length (short ≤20w, medium 20–50w, longer 50–80w)
//
// Hard caps: 100 words per suggestion. Never include the recipient's
// name unless the user has provided one. References at least one
// specific detail from the scene description.
//
// Cost: ~$0.005 per call on gpt-4o. Pre-launch volume is trivial.
// Per-card cap is enforced on the client (drawer's "Show more options"
// is the only path; UI naturally bounds to a few re-rolls).

import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { openai } from '../utils/shared';
import { db } from '../db';
import { cards, photos, type CardDraftState } from '@shared/schema';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';

function getUserId(req: Request): string | null {
  const id = (req as any).session?.otpUserId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

// ── Request / Response shape ────────────────────────────────────────

const requestSchema = z.object({
  cardId: z.number().int().positive(),
  /** Optional tone hint for re-rolls. Default behaviour returns three
   *  suggestions across all tones; passing a tone narrows the output
   *  to three variations within that tone. */
  tone: z.enum(['sincere', 'playful', 'brief']).optional(),
  /** Optional user draft for the "adapt mine" path — model tightens or
   *  varies the user's text instead of generating from scratch. */
  adaptFrom: z.string().max(500).optional(),
});

interface InsideTextSuggestion {
  /** The message text the user could drop straight into the inside
   *  textarea. No quotes, no preamble. */
  text: string;
  /** Tone label for the suggestion card UI. */
  toneLabel: 'sincere' | 'playful' | 'brief';
  /** Approx length category for the suggestion card UI. */
  lengthCategory: 'short' | 'medium' | 'longer';
}

interface InsideTextResponse {
  suggestions: InsideTextSuggestion[];
}

// ── System prompt builder ───────────────────────────────────────────

interface PromptContext {
  recipientName: string;
  occasion: string;
  /** Scene description from the front of the card. The strongest
   *  context signal — the inside should feel of-a-piece with the
   *  front. */
  sceneDescription: string;
  /** Style mode chosen for the card (cinematic / illustrated / custom).
   *  Influences tone — illustrated cards lean playful, cinematic lean
   *  weighty. Optional. */
  styleHint: string;
  /** Photo visual summaries — comma-joined short descriptions of the
   *  card's reference photos. Empty when no analysis is available yet.
   *  Gives the model grounding beyond just names. */
  photoSummaries: string;
  /** Plural-safe vs singular framing. Mirrors the brainstorm/scene
   *  photoMode awareness. */
  photoMode: 'one_person' | 'group' | null;
  /** What the user has already typed in the inside text input, if
   *  anything. Used in the "adapt mine" path. */
  adaptFrom?: string;
  /** Tone narrowing for re-rolls — undefined = mix of all three. */
  tone?: 'sincere' | 'playful' | 'brief';
}

function buildSystemPrompt(ctx: PromptContext): string {
  const isGroup = ctx.photoMode === 'group';
  const recipientFraming = isGroup
    ? `the card is for ${ctx.recipientName} and the people they're sharing this moment with`
    : `the card is for ${ctx.recipientName}`;

  const toneInstruction = ctx.tone
    ? `\n\nThis re-roll narrows to ONE tone: "${ctx.tone}". Return three distinct variations within that tone — vary the length and the angle, not the warmth level.`
    : `\n\nReturn three suggestions, one PER tone, in this order:\n  1. SINCERE — heartfelt, specific, lands a real emotion. Length: SHORT (≤20 words).\n  2. PLAYFUL — warm humour or affectionate teasing. Length: MEDIUM (20–50 words).\n  3. BRIEF — punchy, four to twelve words, the kind of one-liner you'd handwrite under a signature. Length: SHORT.`;

  const adaptInstruction = ctx.adaptFrom
    ? `\n\nADAPT MODE: The user has drafted this inside message:\n  "${ctx.adaptFrom}"\nReturn three improved variations that PRESERVE the user's voice and intent — tighten phrasing, fix flow, sharpen the emotional beat. Do NOT replace their message with a generic one. Do NOT change the meaning. Each variation gets a tone label + length category as normal.`
    : '';

  return `You are a thoughtful greetings-card copywriter. Your only job is to suggest what a sender could handwrite inside their card.

CARD CONTEXT:
- Occasion: ${ctx.occasion}
- ${recipientFraming}
- Front-of-card scene: ${ctx.sceneDescription || '(none — work from the occasion alone)'}
- Style mood: ${ctx.styleHint || '(neutral)'}
- Photos: ${ctx.photoSummaries || '(no photo summaries available)'}

RULES (hard):
1. EVERY suggestion must reference at least one specific detail from the scene description above (a place, an activity, a mood) — never generic "wishing you a wonderful year" filler.
2. Hard length cap: 100 words. Anything longer is wrong.
3. ${ctx.recipientName ? `You may use the recipient name "${ctx.recipientName}" once per suggestion, but it's optional.` : 'No recipient name was given. Use "you" or no salutation at all.'}
4. Do NOT include a salutation ("Dear ...") or a signoff ("Love, ..."). The user will add those. Each suggestion is the BODY of the message only.
5. Do NOT use these banned phrases: "wishing you a wonderful", "many happy returns", "may this year bring", "all the best", "warmest wishes", "thinking of you on this special day".
6. Do NOT invent specific people, names, relationships, or identifying facts not present in the context above.
7. ${isGroup ? 'Plural framing — when the card is for more than one person, write to them collectively. "You both", "you three", "you all", "the two of you", "you lot" all work depending on tone.' : 'Singular framing — write to the named recipient.'}
8. British English spelling.${toneInstruction}${adaptInstruction}

JSON CONTRACT (strict — return exactly this shape, no markdown fences):
{
  "suggestions": [
    {
      "text": "the message body, no quotes, no salutation, no signoff",
      "toneLabel": "sincere" | "playful" | "brief",
      "lengthCategory": "short" | "medium" | "longer"
    },
    ... two more
  ]
}

Output JSON only.`;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Pulls relevant data from a card draft for the prompt. */
async function loadPromptContext(
  cardId: number,
  userId: string,
  reqOverrides: { tone?: 'sincere' | 'playful' | 'brief'; adaptFrom?: string },
): Promise<PromptContext | null> {
  const rows = await db
    .select({
      id: cards.id,
      userId: cards.userId,
      conversationData: cards.conversationData,
    })
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  const row = rows[0];
  if (!row || row.userId !== userId) return null;

  const state = (row.conversationData as CardDraftState | null) ?? null;

  const recipientName = state?.recipient?.name?.trim() ?? '';
  const occasion = state?.recipient?.occasion?.trim() ?? '';
  const sceneDescription = state?.scene?.description?.trim() ?? '';
  const styleMode = state?.style?.mode ?? 'animated';
  const styleCustom = state?.style?.custom?.trim() ?? '';
  const styleHint =
    styleMode === 'custom'
      ? styleCustom
      : styleMode === 'realistic'
        ? 'cinematic, photoreal'
        : styleMode === 'animated'
          ? 'warm illustrated'
          : '';

  const photoIds = state?.photos?.photoIds ?? [];
  let photoSummaries = '';
  if (photoIds.length > 0) {
    const summaries = await db
      .select({
        visualSummary: photos.visualSummary,
      })
      .from(photos)
      .where(and(inArray(photos.id, photoIds), eq(photos.userId, userId)));
    photoSummaries = summaries
      .map((p) => p.visualSummary?.trim())
      .filter((s): s is string => !!s && s.length > 0)
      .join(' · ');
  }

  return {
    recipientName,
    occasion,
    sceneDescription,
    styleHint,
    photoSummaries,
    photoMode: state?.photos?.mode ?? null,
    tone: reqOverrides.tone,
    adaptFrom: reqOverrides.adaptFrom,
  };
}

/** Defensive parser — strips fence variants and normalises shape. */
function parseSuggestions(raw: string): InsideTextSuggestion[] | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const obj = JSON.parse(trimmed);
    const list = Array.isArray(obj?.suggestions) ? obj.suggestions : null;
    if (!list || list.length === 0) return null;
    const normalized: InsideTextSuggestion[] = [];
    for (const s of list) {
      const text = String(s?.text ?? '').trim();
      const toneLabel = ['sincere', 'playful', 'brief'].includes(s?.toneLabel)
        ? (s.toneLabel as InsideTextSuggestion['toneLabel'])
        : 'sincere';
      const lengthCategory = ['short', 'medium', 'longer'].includes(
        s?.lengthCategory,
      )
        ? (s.lengthCategory as InsideTextSuggestion['lengthCategory'])
        : 'medium';
      // Enforce the 100-word cap even if the model overshoots. We
      // truncate at the last sentence boundary inside the cap rather
      // than mid-sentence.
      const words = text.split(/\s+/);
      let capped = text;
      if (words.length > 100) {
        const within = words.slice(0, 100).join(' ');
        const lastFullStop = within.lastIndexOf('.');
        capped = lastFullStop > 30 ? within.slice(0, lastFullStop + 1) : within;
      }
      if (capped.length === 0) continue;
      normalized.push({ text: capped, toneLabel, lengthCategory });
    }
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

// ── Route ───────────────────────────────────────────────────────────

export function registerStudioInsideTextRoutes(app: Express): void {
  app.post(
    '/api/studio/inside-text/suggest',
    isAuthenticated,
    async (req: Request, res: Response) => {
      if (!openai) {
        return res.status(503).json({ error: 'OpenAI is not configured' });
      }
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      let body: z.infer<typeof requestSchema>;
      try {
        body = requestSchema.parse(req.body);
      } catch {
        return res.status(400).json({ error: 'Invalid request body' });
      }

      const ctx = await loadPromptContext(body.cardId, userId, {
        tone: body.tone,
        adaptFrom: body.adaptFrom,
      });
      if (!ctx) {
        return res.status(404).json({ error: 'Card not found' });
      }
      if (!ctx.occasion) {
        return res.status(400).json({
          error:
            'Card needs an occasion before we can suggest inside messages. Finish step 1 first.',
        });
      }

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: buildSystemPrompt(ctx) },
            {
              role: 'user',
              content:
                'Return three inside-card message suggestions per the contract.',
            },
          ],
          max_tokens: 700,
          temperature: 0.85,
          response_format: { type: 'json_object' },
        });

        const raw = completion.choices[0]?.message?.content ?? '';
        const suggestions = parseSuggestions(raw);

        if (!suggestions) {
          console.error('[INSIDE_TEXT] parse failed, raw:', raw);
          return res.status(502).json({
            error:
              'Suggestion generation came back malformed. Try the button again.',
          });
        }

        const response: InsideTextResponse = { suggestions };
        res.json(response);
      } catch (err) {
        console.error('[INSIDE_TEXT] generation failed:', err);
        res.status(500).json({
          error: 'Suggestion generation failed. Try again in a moment.',
        });
      }
    },
  );
}
