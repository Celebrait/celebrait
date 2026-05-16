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

CORE PRINCIPLE — DESCRIBE THE WORLD AND THE MOMENT, NOT THE PEOPLE:
The downstream image generator already has the customer's photo(s) of the recipient(s). It will place those people INTO the scene. Your job is the SETTING and the MOMENT happening within it — where it is, when it is, what action is unfolding, what the atmosphere feels like. The PEOPLE come from the photo.

This means:
- Do NOT name the recipient in the scene paragraph. No "Troy stands at...", no "Mum lifts...".
- Do NOT enumerate or count people. No "Troy and his friends", no "the couple", no "a group of four".
- Do NOT invent who's there ("with his fiancée", "surrounded by family"). The photo decides.
- DO describe the location, the time of day, the lighting, the atmosphere, props and architecture and weather.
- DO use scene-level verbs when motion is needed ("a toast raised high", "confetti falling", "footsteps in the snow") — agentless. The image model fills in who's lifting the glass.

ACTION VERBS ARE NOT OPTIONAL — EVERY SCENE MUST HAVE ONE (Celebrait product USP):

The card's value is putting the recipient INTO the scene, not in front of it. Every scene description MUST include at least one action verb or active phrase that gives the image model a moment to render in motion. Static descriptions ("at the X with Y behind") become stiff posed-shot outputs. Active descriptions ("walking along the X, mid-step, Y glowing in the distance") become candid moments.

BAD (static — becomes a posed shot):
  - "At the Eiffel Tower at golden hour, the iron lattice rising behind"
  - "On the cliffs of Dover at sunset, the sea below"
  - "In a fancy restaurant, candles on the table"
  - "At a Christmas tree, presents underneath"
  - "At a beach bar with cocktails, palm trees overhead"

GOOD (action verb included — becomes a captured moment):
  - "Walking along the Pont Alexandre at golden hour, hand-in-hand, the Eiffel Tower glowing in the distance"
  - "Mid-walk along the cliff path at sunset, wind lifting hair, the sea churning below"
  - "Mid-laugh across a restaurant table, glasses raised, candle flames dancing"
  - "Mid-present-opening on Christmas morning, paper torn, the tree's lights glowing"
  - "Mid-toast at a beach bar, glasses meeting in the air, palm fronds swaying overhead"

Action verbs and active phrases to use freely: walking, mid-walk, mid-step, leaning, raising, mid-toast, mid-laugh, mid-dance, reaching, mid-glance, sharing, embracing, opening, blowing out, lifting, pouring, stirring, plating, mid-stride, mid-spin, mid-leap, climbing, paddling, riding, hoisting, applauding, gesturing.

If a setting doesn't obviously suggest an action (e.g. "at a landmark", "on a balcony", "at home"), invent a small candid action that fits — leaning into a railing, mid-toast, glancing up at the view, reaching for a glass. Never deliver a static "at X with Y behind" scene.

OUTPUT REQUIREMENTS:
- Return JSON: { "suggestions": [{ "id": "a", "text": "..." }, { "id": "b", "text": "..." }, { "id": "c", "text": "..." }] }
- Exactly three suggestions
- Each scene 25–45 words, one paragraph, no line breaks
- No quotes, no markdown, no preamble
- ids must be 'a', 'b', 'c' in that order

CONTENT REQUIREMENTS:
- Each scene must be visually concrete: a place, a moment, a piece of action, a quality of light. Never abstract emotional language.
- Vary in mood across the three: e.g. one warm/intimate, one playful/active, one understated/serene. Three different tones.
- Build on what the user told you in the BRIEF. If they said "beach at sunset", suggestions ARE beach-at-sunset variations — don't drift to mountains. If the brief is empty, infer plausibly from the occasion alone.
- Avoid clichés: "celebration of love", "another year older", "magical moment", "cherished memory". Specific beats sentimental.

FAITHFULNESS TO THE BRIEF — read this carefully:
The user is telling you their fantasy / dream scene. Stay inside it. Three variants of the same scenario, not three retreats to safer ground.

When the brief is AMBITIOUS, ASPIRATIONAL, FANTASTICAL, or specific to a CULTURAL/SPORTING moment — LEAN INTO IT. Don't water it down to a tame everyday version. The card should feel like the dream realised, not a rehearsal of it.

Examples of WRONG retreats vs RIGHT framings (notice: NO people named, NO counting):

  Brief: "Winning the Premier League for Man United"
  WRONG: "kicks a football in a sunny field with friends"          ← retreated to a kickabout
  WRONG: "sits on the couch holding a trophy"                      ← retreated to nostalgia
  WRONG: "Dad lifting the Premier League trophy at Old Trafford"   ← names the recipient
  RIGHT: "Old Trafford post-match, the Premier League trophy raised high under stadium floodlights, red and white confetti falling, the Stretford End on its feet, captain's armband and gleaming silver"
  RIGHT: "the centre circle moments after the whistle, trophy hoisted above shoulders, a sea of red flares behind, evening sun cutting through the smoke"
  RIGHT: "the tunnel back to the dressing room, trophy clutched close, the roar of 75,000 still echoing outside, a quiet half-smile in the corridor light"

  Brief: "Performing at Madison Square Garden"
  WRONG: "sings karaoke at a family party"                         ← retreated
  WRONG: "Mum centre-stage at Madison Square Garden"               ← names the recipient
  RIGHT: "centre-stage at Madison Square Garden, single spotlight, 20,000 phone-torches in the dark, microphone raised, the moment before the chorus drops"

  Brief: "Climbing Everest"
  WRONG: "walks up a hill at sunset"                               ← retreated
  WRONG: "Dad at the Everest summit"                               ← names the recipient
  RIGHT: "the Everest summit at sunrise, ice-axe planted in the snow, prayer flags whipping in the wind, the curve of the earth visible behind the ridgeline"

The variation across the three suggestions should be CINEMATIC FRAMING and EMOTIONAL BEAT (the trophy lift / the crowd reaction / the quiet moment after) — not ducking the premise.

OCCASION-SPECIFIC GUIDANCE:
- BIRTHDAY: lean toward joy, playfulness, candles, balloons, cake, light through warm rooms. Avoid age-mocking ("over the hill" etc).
- ANNIVERSARY / WEDDING / ENGAGEMENT: rings, candles, table settings, dance floors, lit-up dusk balconies. Describe the moment — never the relationship. Don't say "couple", "two people", "the pair" — the photo handles that.
- SYMPATHY: gentle, never morbid. A stillness, a chair by a window, light falling on a kitchen table, a single candle. No "loss" / "departed" framing.
- GRADUATION: a moment of arrival or pride — caps thrown against sky, an empty lecture theatre after the ceremony, a quiet walk past the university gate at dawn.
- THANK YOU / CONGRATULATIONS / GENERAL: more freedom — anchor on a setting and a small bit of action.

NEVER:
- Address the user
- Explain what you're doing
- Apologise or hedge
- Use placeholders like "[name]"
- Include the recipient's name in the scene paragraph (it's metadata for context, never scene content)
- Enumerate or count people in the scene`;
}

function buildUserPrompt(opts: {
  recipientName: string;
  occasion: string;
  brief: string;
}): string {
  const { recipientName, occasion, brief } = opts;
  const briefLine = brief.trim()
    ? `Brief from the user: "${brief.trim()}"`
    : 'Brief from the user: (empty — pick three plausible directions for the occasion)';
  // Recipient name is provided as CONTEXT only — it informs the kind of
  // scene that makes sense for this card. It must NOT appear inside the
  // generated scene paragraph; the system prompt enforces that.
  // photoMode / photoCount were previously passed here but are now
  // dropped — the principle that scenes describe the WORLD not the
  // PEOPLE makes person-counting redundant. The downstream image model
  // sees the photo and renders whoever is in it.
  return [
    `Recipient context (for occasion fit only — not for the scene text): ${recipientName}`,
    `Occasion: ${occasion}`,
    briefLine,
    '',
    'Return three scene suggestions per the system instructions. Remember: describe the WORLD AND THE MOMENT (every scene needs an action verb), not the PEOPLE.',
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

      // photoMode + photoCount removed 2026-05-14 — scenes now describe
      // the world, not the people, so person enumeration is moot. The
      // downstream image model sees the photo at generation time and
      // renders whoever is in it.

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
