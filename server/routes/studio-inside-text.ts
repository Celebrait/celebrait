// server/routes/studio-inside-text.ts
//
// Inside-card message helper — STYLE TRANSFORM rebuild (2026-05-16).
//
// Design philosophy (from next_inside_text_helper_polish_rebuild.md +
// 2026-05-16 pre-mortem conversation):
//
//   • Writing a card message isn't hard. Most users can. The helper is
//     a BONUS for the "stuck" or "want to try a different vibe" moment,
//     not a default writing tool.
//
//   • The helper is a REWRITER, not a writer. It takes the user's draft
//     and transforms it into a different style/vibe (funny, poem,
//     heartfelt, brief, sweet). One job, one result, accept or try again.
//
//   • The killer failure mode is "feels like AI" — generic output that
//     could have been written for any birthday card on the internet.
//     The fix is to ground HARD in the card's actual context (scene
//     description, photo summaries, occasion, recipient) and to surface
//     a "grounding receipt" so the user can SEE what was woven in.
//
//   • Voice preservation matters. If the user wrote "love you, you
//     legend", the rewrite keeps it. Don't ghostwrite — co-author.
//
// Endpoint contract (breaking change from previous version):
//   POST /api/studio/inside-text/suggest
//   request:  { cardId, style, draft, previousAttempts? }
//   response: { result: { text, grounding: string[] } }
//
// The previous "fresh ideas vs adapt mine, three-suggestions-with-tone-
// labels" shape is gone. Only the drawer called it; full rewrite.

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

// ── Style catalogue ─────────────────────────────────────────────────
//
// Five styles, chosen to give breadth without choice paralysis. Each
// has a tight per-style instruction block (voice + length + landmines)
// so the model has a clear target and we don't get "funny" returning
// 4 paragraphs of saccharine prose.
//
// Style copy NOT shown to the user — chips show 'funny' / 'a poem' /
// etc. directly. The PROMPT_INSTRUCTION is what the model sees.

type Style = 'funny' | 'poem' | 'heartfelt' | 'brief' | 'sweet';

const STYLE_INSTRUCTIONS: Record<Style, string> = {
  funny: `STYLE = FUNNY.
- Light, observational humour. Affectionate teasing if the relationship implies it.
- Specific not general. Tie the joke to something concrete from the scene, photo, or occasion — never a recycled "another year closer to old" Dad-joke.
- Punny is the LAST resort, not the first.
- Don't make the joke at the recipient's expense in a way that wouldn't land in person.
- Length: 25–60 words. One tight beat.`,
  poem: `STYLE = A POEM.
- 4 lines, free verse OR rhyming. Use rhyme ONLY if it lands naturally — forced rhyme is worse than no rhyme.
- Each line carries weight. No filler "and / so / very" lines.
- Reference the scene or photo in at least one line.
- Length: 4 lines, max ~40 words total.`,
  heartfelt: `STYLE = HEARTFELT.
- Earned emotion only. Specific moment > general sentiment. "I think about the time we..." beats "you mean so much to me".
- NEVER use these phrases: "you mean the world to me", "I don't know what I'd do without you", "thank you for everything", "you're amazing".
- One specific memory or observation > three vague compliments.
- Length: 40–80 words. Give it room to breathe.`,
  brief: `STYLE = BRIEF.
- Tighten to a one or two-line punch. The kind of thing you'd handwrite under your signature in 5 seconds.
- Specific detail still required — "Happy birthday" alone is too thin.
- Length: 6–20 words. Hard cap.`,
  sweet: `STYLE = SWEET.
- Warm, gentle, soft. Affection without intensity. The card a grandparent sends, not a confession of love.
- No grand declarations. No "forever and always" energy.
- Reference one tangible detail from the scene/photo/occasion so it lands as "for them" not "for anyone".
- Length: 25–55 words.`,
};

const ALL_STYLES = Object.keys(STYLE_INSTRUCTIONS) as Style[];

// ── Request / Response shape ────────────────────────────────────────

const requestSchema = z.object({
  cardId: z.number().int().positive(),
  style: z.enum(ALL_STYLES as [Style, ...Style[]]),
  /** What the user has written so far. The rewriter transforms this.
   *  Empty draft is rejected — the rewriter is rewrite-only, not a
   *  generator. The client enforces this too (chips disabled when
   *  textarea empty) but server validates as a safety net. */
  draft: z.string().min(3).max(800),
  /** Optional list of previous attempts in this style — the model is
   *  told to avoid repeating the same opening or phrasing so "try
   *  funny again" returns a different angle, not a near-duplicate. */
  previousAttempts: z.array(z.string()).max(10).optional(),
});

interface RewriteResult {
  /** The rewritten message — body only, no salutation, no signoff. */
  text: string;
  /** What context elements the model claims to have used, surfaced
   *  back to the user as a "grounding receipt" — proves the rewrite
   *  is specific to their card, not generic. Short labels only
   *  (e.g. "golf", "sunset", "the laughing photo"). */
  grounding: string[];
}

interface RewriteResponse {
  result: RewriteResult;
}

// ── Prompt builder ──────────────────────────────────────────────────

interface PromptContext {
  recipientName: string;
  occasion: string;
  sceneDescription: string;
  styleHint: string;
  photoSummaries: string;
  photoMode: 'one_person' | 'group' | null;
}

function buildSystemPrompt(
  ctx: PromptContext,
  style: Style,
  draft: string,
  previousAttempts: string[],
): string {
  const isGroup = ctx.photoMode === 'group';
  const recipientFraming = ctx.recipientName
    ? isGroup
      ? `the card is for ${ctx.recipientName} and the people they're sharing this moment with`
      : `the card is for ${ctx.recipientName}`
    : 'the recipient is unnamed — use "you" or no salutation';

  const previousBlock = previousAttempts.length
    ? `\n\nThe user has already seen these ${style} versions and asked for another. Do NOT repeat the same opening, the same joke setup, or the same closing phrase. Find a DIFFERENT angle on the same draft:\n${previousAttempts.map((p, i) => `  ${i + 1}. "${p}"`).join('\n')}`
    : '';

  return `You are a thoughtful greetings-card copywriter. Your ONE job: rewrite the user's draft inside-card message in a specific style, grounded in the card's real context. You are an editor / co-author, never a ghostwriter.

CARD CONTEXT (use this — see GROUNDING RULE below):
- Occasion: ${ctx.occasion}
- ${recipientFraming}
- Front-of-card scene: ${ctx.sceneDescription || '(none — only occasion + recipient to work from)'}
- Style mood of the card art: ${ctx.styleHint || '(neutral)'}
- Reference photos: ${ctx.photoSummaries || '(no photo summaries available)'}

USER'S DRAFT (this is what you're transforming — not replacing):
"""
${draft}
"""

${STYLE_INSTRUCTIONS[style]}

GROUNDING RULE (the most important rule):
Reference AT LEAST ONE concrete detail from the card context above by name — a place, an activity, a moment, a visible element from the photos. Generic output is failure. "Wishing you a wonderful year" is failure. The rewrite must be one that COULD NOT have been written for any other card.

VOICE PRESERVATION RULE:
If the user's draft contains a phrase that carries genuine emotion or personality (e.g. "love you, you legend", "miss you so much", a nickname, an inside joke), KEEP that phrase verbatim or near-verbatim in the rewrite. You are co-authoring, not erasing.

BANNED PHRASES (never use):
- "wishing you a wonderful"
- "many happy returns"
- "may this year bring"
- "all the best"
- "warmest wishes"
- "thinking of you on this special day"
- "you mean the world to me" (unless the user's draft says it)
- "thank you for everything"

OTHER RULES:
- No salutation ("Dear ...") and no signoff ("Love, ..."). User adds those — return the MESSAGE BODY only.
- British English spelling.
- ${isGroup ? 'Plural framing — "you both" / "you all" / "you lot" — when writing to a group.' : 'Singular framing.'}
- Do NOT invent specific people, names, relationships, or facts not in the context above.
- Do NOT use emoji unless the style is funny AND it lands naturally — max one emoji.${previousBlock}

JSON CONTRACT (strict — return exactly this shape, no markdown fences):
{
  "text": "the rewritten message body, no quotes, no salutation, no signoff",
  "grounding": ["short label", "short label", "..."]
}

GROUNDING ARRAY: list the specific context elements you actually wove into the rewrite. Short labels (1–4 words each), 1–4 items. Examples: "golf", "sunset behind him", "the laughing photo", "birthday", "for Dad". Be honest — only list what's genuinely in the rewrite. An empty array means "I didn't ground this in anything specific" which means you've failed the GROUNDING RULE — try harder.

Output JSON only.`;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Pulls card draft + photo summaries into a PromptContext. Returns
 *  null if the card doesn't exist or isn't owned by the user. */
async function loadPromptContext(
  cardId: number,
  userId: string,
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
  };
}

/** Defensive parser — strips markdown fences if the model adds them
 *  despite being told not to, then validates the shape. Returns null
 *  on any failure (route turns that into a 502 with a try-again copy). */
function parseRewrite(raw: string): RewriteResult | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const obj = JSON.parse(trimmed);
    const text = String(obj?.text ?? '').trim();
    if (!text) return null;
    const groundingRaw = Array.isArray(obj?.grounding) ? obj.grounding : [];
    const grounding = groundingRaw
      .map((g: unknown) => String(g ?? '').trim())
      .filter((s: string): s is string => s.length > 0 && s.length <= 40)
      .slice(0, 4);
    // Soft length cap — most styles cap below 100 in their own prompt
    // blocks; this is the final safety net so a misbehaving model can't
    // ship a 500-word essay. Truncate at last sentence boundary.
    const words = text.split(/\s+/);
    let capped = text;
    if (words.length > 120) {
      const within = words.slice(0, 120).join(' ');
      const lastFullStop = within.lastIndexOf('.');
      capped = lastFullStop > 30 ? within.slice(0, lastFullStop + 1) : within;
    }
    return { text: capped, grounding };
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

      const ctx = await loadPromptContext(body.cardId, userId);
      if (!ctx) {
        return res.status(404).json({ error: 'Card not found' });
      }
      if (!ctx.occasion) {
        return res.status(400).json({
          error:
            "Card needs an occasion before we can rewrite the inside message. Finish step 1 first.",
        });
      }

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: buildSystemPrompt(
                ctx,
                body.style,
                body.draft,
                body.previousAttempts ?? [],
              ),
            },
            {
              role: 'user',
              content: `Rewrite the user's draft as "${body.style}" per the contract.`,
            },
          ],
          max_tokens: 400,
          // Slightly higher temperature than refinement-style rewrites
          // — we want the result to feel chosen, not boilerplate. The
          // previousAttempts dedupe + grounding rule keep variance
          // useful, not chaotic.
          temperature: 0.9,
          response_format: { type: 'json_object' },
        });

        const raw = completion.choices[0]?.message?.content ?? '';
        const result = parseRewrite(raw);

        if (!result) {
          console.error('[INSIDE_TEXT] parse failed, raw:', raw);
          return res.status(502).json({
            error:
              'The rewriter came back malformed. Try the button again.',
          });
        }

        const response: RewriteResponse = { result };
        res.json(response);
      } catch (err) {
        console.error('[INSIDE_TEXT] rewrite failed:', err);
        res.status(500).json({
          error: 'Rewrite failed. Try again in a moment.',
        });
      }
    },
  );
}
