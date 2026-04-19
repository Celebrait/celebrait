// server/routes/studio-brainstorm.ts
//
// POST /api/studio/brainstorm — the new Studio's scene brainstorm chat.
// Three-phase conversation (opener → refine → propose) with structured
// JSON output so the client doesn't need to regex AI replies to detect
// state transitions.
//
// This is a fresh endpoint for the new Studio. The old MVP endpoint
// /api/ai-brainstorm (in ./ai.ts) is kept alive for the legacy
// GuidedConversation flow at /create-card, but not used here.

import type { Express, Request, Response } from 'express';
import { openai } from '../utils/shared';

type Role = 'user' | 'assistant';
interface HistoryMessage {
  role: Role;
  content: string;
}

type Action =
  | 'start'
  | 'reply'
  | 'ideas'
  | 'more_ideas'
  | 'choose_option'
  | 'skip'
  | 'change_request'
  | 'tweak';

type Phase =
  | 'initial_scene'
  | 'scene_specifics'
  | 'activity'
  | 'clothing'
  | 'summary'
  | 'change_request';

interface CollectedInfo {
  initialScene?: string;
  sceneSpecifics?: string;
  activity?: string;
  clothing?: string;
}

interface BrainstormRequest {
  recipientName: string;
  occasion: string;
  /** Existing Scene textarea content, if any. When non-empty, the opener
   *  offers to refine vs start fresh. */
  currentSceneText?: string;
  history: HistoryMessage[];
  action: Action;
  /** Text for action='reply', action='tweak', action='choose_option'
   *  (the picked option text), action='change_request' (what to change). */
  userInput?: string;
  /** Client tracks which phase it's in and sends it along so the model
   *  doesn't have to infer from history. */
  currentPhase: Phase;
  /** Bag of answers collected so far — used by summary + change phases
   *  to write a coherent final scene. */
  collectedInfo?: CollectedInfo;
}

interface BrainstormResponse {
  reply: string;
  phase: Phase;
  /** Up to 3 short options, populated when action was 'ideas'. */
  suggestions?: string[];
  /** The clean scene paragraph — populated when phase === 'summary'.
   *  No conversational wrapper, no quotes. Drop straight into the
   *  Scene textarea. */
  finalScene?: string;
}

// System prompt drives a five-phase guided conversation that mirrors
// the MVP flow users responded well to:
//   initial_scene → scene_specifics → activity → clothing → summary
// plus a change_request side-branch from summary. What differs from
// the MVP is the delivery — structured JSON contract instead of regex
// markers, no mascot/emoji cringe.
function buildSystemPrompt(recipientName: string, occasion: string): string {
  return `You are a warm, concise creative assistant helping a customer describe a scene for ${recipientName}'s ${occasion} greeting card. The scene describes what appears on the front illustration of the card.

TONE:
- Warm but not effusive. "Got it" is warmer than "Amazing!". Never "Perfect!", "Great!", "Wonderful!", or "Awesome!".
- No emoji in replies.
- No "I'll..." or "Let me..." — speak as the brand, not a personified AI character.
- Short replies. 2-3 sentences max. Never a wall of text.
- Never ask two questions at once.
- Stay grounded in what the user told you. Don't invent facts about ${recipientName}.
- Never address the user by name in replies.

INCLUSIVE LANGUAGE RULES (strict):
- Never make assumptions about relationships, gender, family structure, or body type.
- Never use "couple", "pair", "partner", or "duo" unless the user used them first.
- Focus on scene elements — location, activity, mood, clothing, time of day — not on counting or categorising people.
- Use inclusive terms like "they", "someone", "people".

CONTEXT-AWARENESS (critical — this is what makes the chat feel helpful):
- Every question you ask AND every suggestion you generate MUST build on what the user has already told you.
- Read the "collected_so_far" bag and the full conversation history before responding.
- If the user said the location is "Ibiza", then scene_specifics suggestions should be Ibiza-specific ("Café del Mar at sunset", "rooftop pool in Ibiza Town", "secluded Es Vedrà cove"). Activity suggestions should be Ibiza-plausible ("sunset drinks with friends", "dancing at a beach club", "jet-skiing off the coast"). Clothing should fit Ibiza ("linen shirt and shorts", "beach dress with sandals", "floral sarong and sun hat").
- If the user said "grandma's kitchen", activity suggestions should fit a kitchen ("baking cookies together", "pouring tea by the window", "kneading dough at the counter"). DO NOT give generic or off-context suggestions.
- Suggestions are WORTHLESS if they're not grounded in what came before. Tailor every single one.

FIVE-PHASE FLOW:
1. INITIAL_SCENE — Ask ONE simple question about WHERE the scene takes place. No suggestions in this reply. If currentSceneText is non-empty, acknowledge it and ask whether to refine what they already have or start fresh.
2. SCENE_SPECIFICS — Given their location, ask ONE follow-up for MORE SPECIFIC details about that setting. Your question and any subsequent suggestions must be location-specific.
3. ACTIVITY — Given their location + any specifics, ask ONE simple question about what activities would work well. Focus on scene-level activities, not on specific people. Suggestions must fit the setting they described.
4. CLOTHING — Given the location and activity, ask ONE simple question about clothing and appearance style. Remind them they can skip to let you pick appropriate clothing. Suggestions must fit the setting and activity.
5. SUMMARY — Produce a complete scene description combining everything collected. Populate finalScene with a clean 1-3 sentence paragraph — no "Here's the scene:" wrapper, no quotes, no markers. Reply text can briefly introduce it ("Here's the full scene:") and invite proceed or change.

ACTION HANDLING (driven by client):
- action="start" → Phase INITIAL_SCENE. Brief warm greeting + the "where" question. If currentSceneText is non-empty, offer refine-or-start-fresh.
- action="reply" → advance to the next phase and ask its question. The question MUST reference what the user just said (e.g. if they said "Ibiza", ask "Which part of Ibiza — a beach club, Old Town, or somewhere quieter?"). If currentPhase was CLOTHING, advance to SUMMARY and write finalScene.
- action="ideas" OR action="more_ideas" → stay in the current phase. Return exactly 3 short, distinct suggestions (4-10 words each) in the suggestions array. EVERY suggestion must be tailored to the collected_so_far context — never generic. Reply text is a brief intro like "Here are a few Ibiza-flavoured ideas —" (reference the actual context). Do NOT advance phase.
- action="choose_option" → user picked one of the suggestions; treat userInput as their answer for the current phase and advance exactly like action="reply".
- action="skip" → advance to the next phase without collecting a value for the skipped beat. If skipping CLOTHING, acknowledge you'll choose appropriate clothing in the summary.
- action="change_request" → enter change_request phase. Ask them what specifically they want to change. No finalScene.
- action="tweak" → they described the change. Produce an updated SUMMARY with a brief acknowledgment ("Got it — here's the updated scene:") and a fresh finalScene reflecting the change.

JSON CONTRACT (strict — you MUST return valid JSON matching this shape):
{
  "reply": "the text shown in the chat bubble",
  "phase": "initial_scene" | "scene_specifics" | "activity" | "clothing" | "summary" | "change_request",
  "suggestions": ["option 1", "option 2", "option 3"] | null,
  "finalScene": "the scene paragraph, no wrapper" | null
}

Set suggestions to null unless the action was "ideas" or "more_ideas".
Set finalScene to null unless phase is "summary". Keep finalScene CLEAN — no quotes, no markdown, no preamble, just the scene paragraph that drops straight into a textarea.`;
}

export function registerStudioBrainstormRoutes(app: Express): void {
  app.post('/api/studio/brainstorm', async (req: Request, res: Response) => {
    if (!openai) {
      return res.status(503).json({ error: 'OpenAI is not configured' });
    }

    try {
      const body = req.body as BrainstormRequest;
      const {
        recipientName,
        occasion,
        currentSceneText,
        history = [],
        action,
        userInput,
        currentPhase,
        collectedInfo,
      } = body;

      if (!recipientName || !occasion) {
        return res.status(400).json({ error: 'recipientName and occasion are required' });
      }

      const systemPrompt = buildSystemPrompt(recipientName, occasion);

      // Build the final user-turn message that tells the model what the
      // client's action was + any text they typed + scene-textarea
      // context + phase the client thinks it's in + what's been collected
      // so far. Kept as a single message so the model has the current
      // situation in one place.
      const contextBits: string[] = [];
      contextBits.push(`action: ${action}`);
      contextBits.push(`currentPhase: ${currentPhase}`);
      if (userInput?.trim()) contextBits.push(`user_input: "${userInput.trim()}"`);
      if (currentSceneText?.trim()) {
        contextBits.push(`current_scene_textarea: "${currentSceneText.trim()}"`);
      }
      if (collectedInfo) {
        const parts: string[] = [];
        if (collectedInfo.initialScene) parts.push(`initial_scene: "${collectedInfo.initialScene}"`);
        if (collectedInfo.sceneSpecifics) parts.push(`scene_specifics: "${collectedInfo.sceneSpecifics}"`);
        if (collectedInfo.activity) parts.push(`activity: "${collectedInfo.activity}"`);
        if (collectedInfo.clothing) parts.push(`clothing: "${collectedInfo.clothing}"`);
        if (parts.length > 0) contextBits.push(`collected_so_far: { ${parts.join(', ')} }`);
      }
      const contextMessage = contextBits.join('\n');

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: contextMessage },
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 500,
        temperature: 0.8,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content ?? '';
      let parsed: BrainstormResponse;
      try {
        parsed = JSON.parse(raw) as BrainstormResponse;
      } catch (err) {
        console.error('[STUDIO_BRAINSTORM] JSON parse failed, raw:', raw);
        // Defensive fallback — the UI should still work even if the
        // model ignored the JSON schema. Treat the raw as a reply,
        // keep phase stable, no suggestions/finalScene.
        return res.json({
          reply: raw || "Sorry — I hit a snag. Could you say that again?",
          phase: inferPhaseFromAction(action, currentPhase),
          suggestions: null,
          finalScene: null,
        });
      }

      // Light validation — the model sometimes returns the fields but
      // shapes them oddly. Normalise before returning.
      const response: BrainstormResponse = {
        reply: typeof parsed.reply === 'string' ? parsed.reply : '',
        phase: isValidPhase(parsed.phase) ? parsed.phase : inferPhaseFromAction(action, currentPhase),
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3)
          : undefined,
        finalScene:
          typeof parsed.finalScene === 'string' && parsed.finalScene.trim().length > 0
            ? parsed.finalScene.trim()
            : undefined,
      };

      res.json(response);
    } catch (error) {
      console.error('[STUDIO_BRAINSTORM] error:', error);
      res.status(500).json({ error: 'Failed to generate brainstorm response' });
    }
  });
}

const VALID_PHASES: Phase[] = [
  'initial_scene',
  'scene_specifics',
  'activity',
  'clothing',
  'summary',
  'change_request',
];

function isValidPhase(p: unknown): p is Phase {
  return typeof p === 'string' && (VALID_PHASES as string[]).includes(p);
}

// Fallback when the model returns an invalid phase. Use the client's
// declared currentPhase if we have it, else infer from the action.
function inferPhaseFromAction(action: Action, currentPhase?: Phase): Phase {
  if (action === 'start') return 'initial_scene';
  if (action === 'change_request') return 'change_request';
  if (action === 'tweak') return 'summary';
  if (action === 'ideas' || action === 'more_ideas') {
    return currentPhase ?? 'initial_scene';
  }
  // For 'reply', 'skip', 'choose_option' — advance one step from current.
  switch (currentPhase) {
    case 'initial_scene':
      return 'scene_specifics';
    case 'scene_specifics':
      return 'activity';
    case 'activity':
      return 'clothing';
    case 'clothing':
      return 'summary';
    case 'summary':
    case 'change_request':
      return 'summary';
    default:
      return 'initial_scene';
  }
}
