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
import { logGeneration } from '../prompts/generation-log';
import { llmCostCents } from '../prompts/llm-cost';
import { LLM_SLOTS } from '@shared/schema';

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

export function buildSystemPrompt(): string {
  return `You generate scene descriptions for the front of a personalised greeting card. Each scene is later turned into an illustration by an image model — so it must be vivid, specific, and paintable.

CORE PRINCIPLE — DESCRIBE THE WORLD AND THE MOMENT, NOT THE PEOPLE:
The downstream image generator already has the customer's photo(s) of the recipient(s). It will place those people INTO the scene. Your job is the SETTING and the MOMENT happening within it — where it is, when it is, what action is unfolding, what the atmosphere feels like. The PEOPLE come from the photo.

This means:
- Do NOT name the recipient in the scene paragraph. No "Troy stands at...", no "Mum lifts...".
- Do NOT enumerate or count people. No "Troy and his friends", no "the couple", no "a group of four".
- Do NOT invent who's there ("with his fiancée", "surrounded by family"). The photo decides.
- DO describe the location, the time of day, the lighting, the atmosphere, props and architecture and weather.
- DO use scene-level verbs when motion is needed ("a toast raised high", "confetti falling", "footsteps in the snow") — agentless. The image model fills in who's lifting the glass.

THE FOCAL ACTION IS VACANT — THIS IS THE WHOLE PRODUCT:
Each scene has exactly ONE focal action, and NOBODY is doing it. It is a vacancy the photo people will fill. Never populate a scene with other humans as participants — no "friends", "a team", "a crowd gathers round", "bodies moving", "faces around", "hands reaching" belonging to anyone but the implied protagonist. If other people appear at all they are DISTANT SCENERY inherent to the world (a stadium roaring far below, a blurred silhouette line at the back of the club) — never sharing the focal action, never near the camera. And do not stand a placeholder in the vacancy either — no "a figure", "a caped figure", "a silhouette stands": keep the action itself agentless. "Cape snapping mid-flight above the skyline" — not "a caped figure mid-flight".
  WRONG: "capes billowing, laughter among friends mid-leap in the sky"      ← invented friends now star in the card
  RIGHT: "Mid-flight above the skyline, cape snapping in the wind, sunlight breaking through the clouds, the city gleaming far below"
  WRONG: "a team gathers around a desk, coffee cups raised in a toast"      ← the recipient is a bystander at their own moment
  RIGHT: "Mid-toast at the centre desk of a bustling newsroom, papers still settling, the evening edition rolling off the press behind"


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
- Vary the three — but HOW you vary depends on the brief:
    • Brief names a SPECIFIC world (a sport, team, band, film, franchise, place, subculture, event — e.g. "WWE", "Formula 1", "Glastonbury", "Star Wars"): all three stay fully INSIDE that world. Vary by CINEMATIC FRAMING and BEAT — the entrance, the peak action, the aftermath — NOT by mood. Never make one a calm, generic version to "balance" the set.
    • Brief is loose, everyday, or empty: then vary by mood/tone (one warm/intimate, one playful/active, one understated/serene).
- Build on what the user told you in the BRIEF. If they said "beach at sunset", suggestions ARE beach-at-sunset variations — don't drift to mountains. If the brief is empty, infer plausibly from the occasion alone.
- ALL THREE must carry the brief's signature elements. NONE may retreat to a generic version of the occasion ("a party", "an arena", "a celebration"). If a stranger read one suggestion, they should be able to name the sport / band / place / world from the scene alone.
- NAME THE WORLD, DON'T GESTURE AT IT. Every scene must contain at least TWO unmistakable, NAMED signatures of the brief's world — proper nouns where the world has them, exact iconography where it doesn't. "A famous skyline" or "an iconic city" is a failure.
    Brief: "New York" → the Brooklyn Bridge's stone arches, the Empire State needling into cloud, yellow cabs streaming down Fifth Avenue, steam curling from a manhole, the Staten Island Ferry crossing a pink dusk — NOT "gleaming skyscrapers".
    Brief: "Superman" → the red cape, the blue suit with the S-shield, the Daily Planet globe, Metropolis — commit to the exact iconography, don't dilute to "a caped hero over a city".
- IN the world, never a party ABOUT the world. Themed decorations are a retreat: a Superman-themed cake, banners portraying the hero, a Formula-1-themed table — all WRONG. The card puts the recipient INSIDE the world itself: mid-flight with the cape snapping over Metropolis, not admiring a themed buffet. (The occasion may flavour the moment — a candle, a toast — but the WORLD is the venue, not the theme.)
- Avoid clichés: "celebration of love", "another year older", "magical moment", "cherished memory". Specific beats sentimental.
- BANNED FILLER — these paint nothing and are forbidden: "the air thick with excitement", "energy palpable", "vibrant energy radiating", "festive atmosphere", "joyous atmosphere", "the atmosphere electric", "excitement buzzing". Spend those words on a concrete visual instead (a prop, a light source, a texture, weather).

FAITHFULNESS TO THE BRIEF — read this carefully:
The user is telling you their fantasy / dream scene. Stay inside it. Three variants of the same scenario, not three retreats to safer ground.

When the brief is AMBITIOUS, ASPIRATIONAL, FANTASTICAL, or specific to a CULTURAL/SPORTING moment — LEAN INTO IT. Don't water it down to a tame everyday version. The card should feel like the dream realised, not a rehearsal of it.

Examples of WRONG retreats vs RIGHT framings (notice: NO people named, NO counting):

  Brief: "Winning the Premier League for Man United"
  WRONG: "kicks a football in a sunny field with friends"          ← retreated to a kickabout
  WRONG: "sits on the couch holding a trophy"                      ← retreated to nostalgia
  WRONG: "Dad lifting the Premier League trophy at Old Trafford"   ← names the recipient
  RIGHT: "Old Trafford post-match, the Premier League trophy raised high under stadium floodlights, red and white confetti falling, the Stretford End on its feet, captain's armband and gleaming silver"

  Brief: "Skydiving New York"  (an ACTIVITY + a PLACE — then ALL THREE scenes are that activity in that place; vary the beat, never the subject)
  WRONG SET: one skydive + a rooftop bonfire + a café toast   ← two of three abandoned the brief
  RIGHT (a): "Mid-freefall high above Manhattan, arms spread wide, the grid of streets and Central Park sprawling below, wind tearing past, the Hudson glinting at the horizon"
  RIGHT (b): "Canopy just burst open above the skyline, drifting past glass towers catching the afternoon sun, the city rising to meet the descent"
  RIGHT (c): "Boots touching down on the drop-zone grass, parachute billowing behind, helmets tipped back mid-cheer, the New York skyline stacked against the sky"

  Brief: "Thomas the Tank Engine"  (a NAMED CHARACTER is a world too — its unmistakable visual signatures go in ALL THREE scenes)
  WRONG: "a train whistle echoes in the distance"                ← the character has been laundered out
  WRONG: "the joyful hum of a familiar theme song"               ← same failure, in audio
  RIGHT: "Aboard a cheerful blue steam engine with a smiling face on its round boiler, chuffing along a sunny branch line, carriages rattling behind, a signal box waving the journey through"
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

TERSE OR NAMED BRIEFS — UNPACK THEM, DON'T GENERALISE:
A one-word, acronym, or proper-noun brief (a brand, sport, team, band, film, franchise, place) is shorthand for a whole visual world. First UNPACK it into its concrete, unmistakable signatures, then build all three scenes from those signatures. A named world rendered as "a generic big event" is a FAILURE — it loses the exact thing the user asked for.

  Brief: "WWE"
  Its signatures: a wrestling ring with ropes and turnbuckles, a championship belt, a superstar mid-move (off the top rope, entrance through pyro, belt raised overhead), a roaring arena under harsh spotlights, the titantron glowing behind.
  WRONG: "a buzzing arena, spotlights cutting the smoke, a championship belt raised, confetti bursting, the energy electric"  ← no ring, no wrestling — this is any concert or awards show
  RIGHT (a): "Storming down the entrance ramp through a wall of pyro, championship belt held high, the titantron blazing, an arena of thousands on its feet"
  RIGHT (b): "Mid-leap off the top rope inside the ring, ropes still shaking, spotlights raking the canvas, the crowd erupting below"
  RIGHT (c): "The moment after the three-count, belt raised in the centre of the ring, confetti falling through the floodlights, the roar cresting"

  Brief: "Formula 1"  → a podium spraying champagne / a car mid-corner with sparks off the floor / a pit-stop blur of tyres and crew — NOT "a fast car on a road".
  Brief: "Taylor Swift"  → a stadium stage under a canopy of wristband lights, a runway catwalk mid-song — NOT "a music event".

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

export function buildUserPrompt(opts: {
  recipientName: string;
  occasion: string;
  brief: string;
  /** Photo-step mode. Steers the SCALE of the moment (communal vs
   *  solitary), never person-counting — see the group line below. */
  photoMode?: 'one_person' | 'group';
}): string {
  const { recipientName, occasion, brief, photoMode } = opts;
  const briefLine = brief.trim()
    ? `Brief from the user: "${brief.trim()}"`
    : 'Brief from the user: (empty — pick three plausible directions for the occasion)';
  // Recipient name is provided as CONTEXT only — it informs the kind of
  // scene that makes sense for this card. It must NOT appear inside the
  // generated scene paragraph; the system prompt enforces that.
  //
  // photoMode history: passed pre-2026-05-14, removed when scenes became
  // world-not-people (person-COUNTING was the poison), reinstated
  // 2026-08-13 as a moment-SCALING hint only. A group photo over a
  // solitary-scaled scene ("a quiet chair by a window") isn't a
  // contradiction the way "two friends" over five faces was — it's just
  // a tonal mismatch. Steering communal vs solitary keeps the
  // no-enumeration principle fully intact.
  // ⚠️ Third iteration of this line — its history is a lesson in
  // prompt leakage. v1 gave example imagery ("a bonfire circle") and
  // the model pasted bonfires into every group card. v2 said "scale
  // every moment so several people are clearly sharing it" and the
  // model obeyed by INVENTING people — "friends mid-leap", "a team
  // gathers", "bodies moving in unison" — leaving no vacant slot for
  // the actual photo people (Aidan's Superman/Ibiza/Thomas screenshots,
  // 2026-08-14). v3 scaled the stage but gave example nouns ("a long
  // footplate") and a footplate duly appeared on a Superman rooftop.
  // v4: zero nouns of its own — the line may only gesture at the
  // brief's existing world.
  const groupLine =
    photoMode === 'group'
      ? 'This card\'s photo shows a GROUP. Make the stage of the focal action wide enough for several to share, expressed only through the size of the space and props that already belong to the brief\'s world. Give no examples of your own, add no people, and never import objects the world would not contain.'
      : '';
  return [
    `Recipient context (for occasion fit only — not for the scene text): ${recipientName}`,
    `Occasion: ${occasion}`,
    briefLine,
    ...(groupLine ? [groupLine] : []),
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

      const llmStartedAt = Date.now();
      const LLM_MODEL = 'gpt-4o-mini';
      try {
        const completion = await openai.chat.completions.create({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            {
              role: 'user',
              content: buildUserPrompt({
                recipientName,
                occasion,
                brief: body.brief ?? '',
                photoMode: state?.photos?.mode,
              }),
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.85, // higher = more variety across the three options
          max_tokens: 600,
        });

        // Cost Ledger (audit 2026-07-29): the scene helper spends real
        // money on every tap and logged nothing. No cardId — the draft
        // may not even be saved yet — so it books against the
        // scene_suggest slot (see CUSTOMER_LLM_SLOTS). Fire-and-forget.
        void logGeneration({
          cardId: null,
          slot: LLM_SLOTS.SCENE_SUGGEST,
          templateId: null,
          templateVersion: null,
          provider: 'openai',
          model: LLM_MODEL,
          quality: null,
          costCents: llmCostCents(
            LLM_MODEL,
            completion.usage?.prompt_tokens ?? 0,
            completion.usage?.completion_tokens ?? 0,
          ),
          durationMs: Date.now() - llmStartedAt,
          success: true,
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
