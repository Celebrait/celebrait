// server/routes/studio-scene-suggest.ts
//
// POST /api/studio/scene-suggestions
//
// One-shot scene suggester — the middle ground between a free-text
// textarea and the multi-turn brainstorm chat. Reads the draft's
// recipient + occasion + photos and returns 3 distinct scene
// paragraphs the user can tap to fill the textarea.
//
// Why an LLM here: the static example chips we used to ship were
// generic by definition. Custom-generated suggestions personalise
// to the recipient/occasion AND to whatever the user has already
// typed in the brief. Better first-gen scenes reduce regen rate,
// which is where the real cost lives — see
// memory/next_pricing_and_regen_economics.md for the maths.
//
// Cost: gpt-4o-mini. ~$0.0003 per call (≈£0.0002). Hundreds of
// suggestions fit inside the cost of one image regen.

import type { Express, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { cards, type CardDraftState } from '@shared/schema';
import { openai } from '../utils/shared';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';

const requestSchema = z.object({
  cardId: z.number().int().positive(),
  /** Optional brief — whatever's currently in the Scene textarea.
   *  When non-empty, suggestions expand/vary on it. When empty, the
   *  LLM goes off recipient + occasion alone. */
  brief: z.string().max(500).optional(),
});

interface SceneSuggestion {
  id: string;
  text: string;
}

interface SuggestResponse {
  suggestions: SceneSuggestion[];
}

function getUserId(req: Request): string | null {
  const id = (req as any).session?.otpUserId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function buildSystemPrompt(): string {
  return `You generate scene descriptions for the front of a personalised greeting card. Each scene is later turned into an illustration by an image model — so it must be vivid, specific, and paintable.

OUTPUT REQUIREMENTS:
- Return JSON: { "suggestions": [{ "id": "a", "text": "..." }, { "id": "b", "text": "..." }, { "id": "c", "text": "..." }] }
- Exactly three suggestions
- Each scene 25–45 words, one paragraph, no line breaks
- No quotes, no markdown, no preamble
- ids must be 'a', 'b', 'c' in that order

CONTENT REQUIREMENTS:
- Each scene must be visually concrete: a place, a moment, a piece of action, a quality of light. Never abstract emotional language.
- Vary in mood across the three: e.g. one warm/intimate, one playful/active, one understated/serene. Three different tones.
- Build on what the user told you in the BRIEF. If they said "beach at sunset", suggestions ARE beach-at-sunset variations — don't drift to mountains. If the brief is empty, infer plausibly from recipient + occasion.
- Avoid clichés: "celebration of love", "another year older", "magical moment", "cherished memory". Specific beats sentimental.
- For BIRTHDAY cards: lean toward joy, playfulness, the recipient at the centre. Avoid age-mocking ("over the hill" etc).
- For ANNIVERSARY/WEDDING/ENGAGEMENT: respect that we don't know the relationship structure. Use inclusive scene-level language ("two people", "the two of them") rather than gendered or relationship-presumptive terms unless the user used them in the brief.
- For SYMPATHY: gentle, never morbid. A stillness, a shared cup of tea, light through a window. No "loss" / "departed" framing — just quiet presence.
- For GRADUATION: a moment of arrival or pride. Throwing caps, a parent hugging the graduate, a quiet walk past the university gate.

PHOTO MODE AWARENESS (when provided):
- "one_person, 1 photo" → suggestions feature the recipient solo
- "one_person, multiple photos" → recipient solo, "from every angle" framings welcome
- "group, 1 photo" → suggestions feature the recipient with others around them
- No photo → infer naturally; suggestions can frame "them" or scene without specifying

NEVER:
- Address the user
- Explain what you're doing
- Apologise or hedge
- Use placeholders like "[name]" — use the real recipient name when given`;
}

function buildUserPrompt(opts: {
  recipientName: string;
  occasion: string;
  brief: string;
  photoMode: string | null;
  photoCount: number;
}): string {
  const { recipientName, occasion, brief, photoMode, photoCount } = opts;
  const photoLine =
    photoCount > 0 && photoMode
      ? `Photos: ${photoCount} × ${photoMode}`
      : 'Photos: none';
  const briefLine = brief.trim()
    ? `Brief from the user: "${brief.trim()}"`
    : 'Brief from the user: (empty — pick three plausible directions)';
  return [
    `Recipient: ${recipientName}`,
    `Occasion: ${occasion}`,
    photoLine,
    briefLine,
    '',
    'Return three scene suggestions per the system instructions.',
  ].join('\n');
}

export function registerStudioSceneSuggestRoutes(app: Express): void {
  app.post(
    '/api/studio/scene-suggestions',
    isAuthenticated,
    async (req: Request, res: Response) => {
      if (!openai) {
        return res.status(503).json({ error: 'OpenAI not configured' });
      }
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      let body: z.infer<typeof requestSchema>;
      try {
        body = requestSchema.parse(req.body);
      } catch {
        return res.status(400).json({ error: 'Invalid request body' });
      }

      // Load the draft for context. Auth-gated: a user can only suggest
      // for their own card.
      const rows = await db
        .select({
          userId: cards.userId,
          conversationData: cards.conversationData,
        })
        .from(cards)
        .where(eq(cards.id, body.cardId))
        .limit(1);
      const row = rows[0];
      if (!row) return res.status(404).json({ error: 'Card not found' });
      if (row.userId !== userId) return res.status(403).json({ error: 'Not your card' });

      const state = (row.conversationData as CardDraftState | null) ?? null;
      const recipientName = state?.recipient?.name?.trim() || '';
      const occasion = state?.recipient?.occasion?.trim() || '';
      if (!recipientName || !occasion) {
        return res
          .status(400)
          .json({ error: 'Recipient name + occasion required first' });
      }

      const photoMode = state?.photos?.mode ?? null;
      const photoCount = state?.photos?.photoIds?.length ?? 0;

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            {
              role: 'user',
              content: buildUserPrompt({
                recipientName,
                occasion,
                brief: body.brief ?? '',
                photoMode,
                photoCount,
              }),
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.85, // higher = more variety across the three options
          max_tokens: 600,
        });

        const raw = completion.choices[0]?.message?.content?.trim();
        if (!raw) throw new Error('Empty completion');

        // Parse + validate the structured response. Defensive — model
        // sometimes returns extra fields or slightly off shapes.
        const parsed = JSON.parse(raw) as { suggestions?: unknown };
        const suggestions = Array.isArray(parsed.suggestions)
          ? parsed.suggestions
              .map((s, i) => {
                if (typeof s === 'object' && s !== null) {
                  const obj = s as { id?: unknown; text?: unknown };
                  const text = typeof obj.text === 'string' ? obj.text.trim() : '';
                  if (!text) return null;
                  const id = typeof obj.id === 'string' ? obj.id : String.fromCharCode(97 + i);
                  return { id, text };
                }
                return null;
              })
              .filter((x): x is SceneSuggestion => !!x)
              .slice(0, 3)
          : [];

        if (suggestions.length === 0) {
          throw new Error('No usable suggestions in response');
        }

        const response: SuggestResponse = { suggestions };
        res.json(response);
      } catch (err: any) {
        console.error('[STUDIO_SCENE_SUGGEST] error:', err);
        res.status(500).json({
          error: 'Could not generate suggestions — try again or use the brainstorm chat.',
        });
      }
    },
  );
}
