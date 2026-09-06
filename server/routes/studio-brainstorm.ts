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
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';
import { logGeneration } from '../prompts/generation-log';
import { llmCostCents } from '../prompts/llm-cost';
import { LLM_SLOTS } from '@shared/schema';
import { rateLimitHit } from '../simple-rate-limit';

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
  /** Photo step mode the customer chose. Drives whether the chat
   *  frames the card around the named recipient (singular) or around
   *  the recipient together with others (plural / shared moment).
   *  Optional — older clients that don't send it fall back to
   *  one_person framing, which is the safe default for solo cards. */
  photoMode?: 'one_person' | 'group' | null;
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
function buildSystemPrompt(occasion: string): string {
  return `You are a warm, concise creative assistant helping a customer describe the front-of-card SCENE for a ${occasion} greeting card.

CORE PRINCIPLE — DESCRIBE THE WORLD, NOT THE PEOPLE:
The customer has already uploaded the photo(s) of the people who will appear on the card. The downstream image generator combines those photos with the scene description you help write. Your job — and the user's — is to settle the SETTING and the MOMENT, not who's in it.

This means:
- The chat asks about location, atmosphere, action, mood, time of day, style of the world.
- The chat does NOT ask "who's in the scene", "what's everyone wearing", "how many people", "is it a couple or a group". The photo handles all of that.
- Scene descriptions you produce do NOT name the recipient or anyone else. They do NOT count people. They do NOT use words like "the couple", "the group", "the family", "two of them" — describe the WORLD, agentlessly when motion is needed ("a toast raised under warm light", "footsteps in fresh snow"). The image model fills in who.
- If the user volunteers a relationship or fact ("they got engaged here", "she just retired"), incorporate that as scene context — never invent it.

TONE:
- Warm but not effusive. "Got it" is warmer than "Amazing!". Never "Perfect!", "Great!", "Wonderful!", or "Awesome!".
- No emoji in replies.
- No "I'll..." or "Let me..." — speak as the brand, not a personified AI character.
- Short replies. 2-3 sentences max. Never a wall of text.
- Never ask two questions at once.
- Stay grounded in what the user told you. Don't invent facts.
- Never address the user by name in replies.

INCLUSIVE LANGUAGE RULES (strict):
- Never make assumptions about relationships, gender, family structure, or body type.
- Never use "couple", "pair", "partner", "duo", "group", "family" unless the user used them first AND insists on referencing.
- Focus on scene elements — location, action, mood, time of day, atmosphere — not on the cast.

CONTEXT-AWARENESS (critical — this is what makes the chat feel helpful):
- Every question you ask AND every suggestion you generate MUST build on what the user has already told you.
- Read the "collected_so_far" bag and the full conversation history before responding.
- If the user said the location is "Ibiza", then scene_specifics suggestions should be Ibiza-specific ("Café del Mar at sunset", "rooftop pool in Ibiza Town", "secluded Es Vedrà cove"). Action suggestions should be Ibiza-plausible ("a toast at sundown", "the beat dropping at a beach club", "a quiet evening on a balcony"). Atmosphere should fit Ibiza ("linen-and-sandals warm", "neon and bass at midnight", "salt air and cicadas").
- If the user said "grandma's kitchen", action suggestions should fit a kitchen ("a cake being lifted from the oven", "tea being poured at the window", "dough being kneaded at the counter" — note: no named subjects). DO NOT give generic or off-context suggestions.
- Suggestions are WORTHLESS if they're not grounded in what came before. Tailor every single one.

FIVE-PHASE FLOW:
1. INITIAL_SCENE — Ask ONE simple question about WHERE the scene takes place. No suggestions in this reply. If currentSceneText is non-empty, acknowledge it and ask whether to refine what they already have or start fresh.
2. SCENE_SPECIFICS — Given their location, ask ONE follow-up for MORE SPECIFIC details about that setting. Your question and any subsequent suggestions must be location-specific.
3. ACTIVITY — Given their location + any specifics, ask ONE simple question about what's HAPPENING in the moment (the action, the event, the beat). Phrase as a moment ("a toast being raised", "the cake being cut", "watching the sunset"), never as named people doing things. Suggestions must fit the setting they described.
4. CLOTHING — Given the location and moment, ask ONE simple question about the DRESS CODE of the scene — the vibe of what people in this setting are wearing. NOT "what should your recipient wear" — scene-level dress code, like "black tie", "linen-and-sandals", "festival denim", "smart-casual at golden hour". Remind them they can skip to let you choose. Suggestions are dress-code phrases (3-6 words), not "your mum in a red dress".
5. SUMMARY — Produce a complete scene description combining everything collected. Populate finalScene with a clean 1-3 sentence paragraph — no "Here's the scene:" wrapper, no quotes, no markers, NO recipient name, NO counting people. Reply text can briefly introduce it ("Here's the full scene:") and invite proceed or change.

ACTION HANDLING (driven by client):
- action="start" → Phase INITIAL_SCENE. Brief warm greeting + the "where" question. If currentSceneText is non-empty, offer refine-or-start-fresh.
- action="reply" → advance to the next phase and ask its question. The question MUST reference what the user just said (e.g. if they said "Ibiza", ask "Which part of Ibiza — a beach club, Old Town, or somewhere quieter?"). If currentPhase was CLOTHING, advance to SUMMARY and write finalScene.
- action="ideas" OR action="more_ideas" → stay in the current phase. Return exactly 3 short, distinct suggestions (4-10 words each) in the suggestions array. EVERY suggestion must be tailored to the collected_so_far context — never generic. Reply text is a brief intro like "Here are a few Ibiza-flavoured ideas —" (reference the actual context). Do NOT advance phase.
- action="choose_option" → user picked one of the suggestions; treat userInput as their answer for the current phase and advance exactly like action="reply".
- action="skip" → advance to the next phase without collecting a value for the skipped beat. **REQUIRED**: the reply MUST begin with a one-line acknowledgement that explicitly mentions what you'll choose on their behalf, BEFORE the next question (or the scene summary). Pick from:
    - skipping SCENE_SPECIFICS → start reply with "Got it — I'll fill in the specifics. "
    - skipping ACTIVITY → start reply with "Got it — I'll pick the moment. "
    - skipping CLOTHING → start reply with "Got it — I'll pick the dress code. "
  The acknowledgement is NOT optional. After it, ask the next phase's question (or if CLOTHING was skipped, write the scene as normal in finalScene and use "Here's the full scene:" as the rest of the reply).
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
  // isAuthenticated added 2026-07-02 (security audit): this was the ONLY
  // LLM endpoint with no auth — an open, unmetered gpt-4o proxy on our
  // OpenAI bill. Per-user ceiling on top: brainstorming is chatty, but
  // no human sends 60 turns an hour.
  app.post('/api/studio/brainstorm', isAuthenticated, async (req: Request, res: Response) => {
    if (!openai) {
      return res.status(503).json({ error: 'OpenAI is not configured' });
    }

    const userId = (req as any).session?.otpUserId ?? 'unknown';
    if (rateLimitHit(`brainstorm:user:${userId}`, 60, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests — take a breather and try again shortly.' });
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
        // photoMode kept on the request shape for backwards compatibility
        // with older clients, but no longer consumed by the prompt —
        // the scene-not-people principle means person-mode framing
        // doesn't add value here. Recipient name is also no longer
        // injected into the system prompt; it stays as a context
        // signal for the occasion-fit only.
      } = body;

      if (!recipientName || !occasion) {
        return res.status(400).json({ error: 'recipientName and occasion are required' });
      }

      const systemPrompt = buildSystemPrompt(occasion);

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

      // History hardening: whitelist roles (a client-supplied
      // role:'system' turn would override our prompt), cap turn count
      // and per-turn size so a crafted payload can't balloon the token
      // bill (the request body limit is generous for photo uploads).
      const safeHistory = history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-40)
        .map((m) => ({ role: m.role, content: String(m.content ?? '').slice(0, 2000) }));

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...safeHistory,
        { role: 'user', content: contextMessage },
      ];

      const llmStartedAt = Date.now();
      const LLM_MODEL = 'gpt-4o';
      const completion = await openai.chat.completions.create({
        model: LLM_MODEL,
        messages,
        max_tokens: 500,
        temperature: 0.8,
        response_format: { type: 'json_object' },
      });

      // Cost Ledger (audit 2026-07-29): brainstorm is a CHAT — it bills
      // per turn, on gpt-4o (~17x gpt-4o-mini), and history is resent
      // every turn so input tokens grow with the conversation. It was
      // the most expensive unlogged surface. Booked against the
      // brainstorm slot; no cardId (this runs before/around a draft).
      void logGeneration({
        cardId: null,
        slot: LLM_SLOTS.BRAINSTORM,
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
