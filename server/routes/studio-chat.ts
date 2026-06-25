// server/routes/studio-chat.ts
//
// POST /api/studio/chat — the conversational spine for the chat-driven
// studio (/studio-chat). A warm, on-rails card-maker assistant that
// talks the customer through the intake (recipient → occasion → photo
// mode → front headline → inside message) the way a real assistant
// would: it READS free text and extracts the field values, so the user
// can say "it's for my mum's 60th" and we capture name + occasion in
// one turn instead of marching through robotic one-field prompts.
//
// Same shape as studio-brainstorm.ts: a single LLM call per turn,
// strict JSON contract so the client never regexes the reply. The
// SCENE step is NOT handled here — it has its own dedicated helpers
// (scene-suggestions + brainstorm). Photo upload + generation are real
// UI/endpoints the client triggers. This endpoint owns the talking
// between those moments.
//
// Cost: gpt-4o-mini, ~$0.0003/turn. Cheap enough to run every message.

import type { Express, Request, Response } from 'express';
import { openai } from '../utils/shared';
import { isAuthenticated } from '../replit_integrations/auth/replitAuth';

type Role = 'user' | 'assistant';
interface HistoryMessage {
  role: Role;
  content: string;
}

// The step the client is currently trying to satisfy. The model uses
// it to know what to ask for + what to extract, but it may ALSO capture
// fields for later steps if the user volunteers them (e.g. name +
// occasion together).
type Step = 'name' | 'occasion' | 'photoMode' | 'front' | 'inside' | 'freeform';

// Occasion keys the studio understands (mirror CardDraftState).
const OCCASIONS = [
  'birthday', 'anniversary', 'wedding', 'graduation', 'engagement',
  'newbaby', 'christmas', 'valentines', 'thankyou', 'sympathy', 'other',
] as const;

interface Captured {
  name?: string;
  occasion?: (typeof OCCASIONS)[number];
  /** Freeform occasion words when occasion === 'other'. */
  occasionLabel?: string;
  photoMode?: 'one_person' | 'group';
  frontMode?: 'write' | 'none';
  frontText?: string;
  insideMode?: 'write' | 'blank';
  insideMessage?: string;
}

interface ChatRequest {
  step: Step;
  /** What the user just typed (or the label of a pill they tapped). */
  userMessage: string;
  history: HistoryMessage[];
  /** Current draft snapshot so the model has context (recipient name to
   *  use in copy, occasion for tone, what's already filled). */
  draft: {
    name?: string;
    occasion?: string;
    photoMode?: 'one_person' | 'group';
    frontText?: string;
    insideMode?: 'write' | 'blank';
  };
}

interface ChatResponse {
  reply: string;
  captured: Captured;
  /** True when the CURRENT step's required field is now captured, so
   *  the client can advance. */
  stepComplete: boolean;
}

function buildSystemPrompt(): string {
  return `You are Celebrait's card-maker — a warm, concise assistant guiding a customer through making a personalised greeting card, one short message at a time. You speak as the brand, not a personified AI.

WHAT YOU'RE COLLECTING (in rough order, but capture anything the user volunteers early):
1. name — who the card is FOR (a name or relationship like "Mum", "Sarah", "my best mate Tom"). Capture the natural address form ("Mum", "Sarah").
2. occasion — map to ONE key: birthday, anniversary, wedding, graduation, engagement, newbaby, christmas, valentines, thankyou, sympathy, or "other". If "other", also give occasionLabel with their words.
3. photoMode — "one_person" (just the recipient) or "group".
4. front — the headline on the FRONT of the card. They can give text, ask you to suggest one, or skip it (frontMode "none").
5. inside — either a written message (insideMode "write" + insideMessage) or blank to handwrite themselves (insideMode "blank").

You are told the current STEP each turn — focus your QUESTION on that step. But ALWAYS extract every field the user's message gives you, even for later steps (if they say "a birthday card for my mum", capture BOTH name="Mum" AND occasion="birthday" and set stepComplete true).

TONE (strict):
- Warm but not effusive. "Lovely" / "Got it" — never "Amazing!", "Perfect!", "Great!", "Awesome!".
- No emoji. Short — 1-2 sentences. Never ask two questions at once.
- Never invent facts about the recipient. Don't be sycophantic.
- Once you know the recipient's name, you may use it naturally and warmly, but don't overuse it.
- If the user goes off-topic or asks a question, answer briefly + warmly, then steer gently back to the current step. Stay on-rails: you only make greeting cards.

STEP-SPECIFIC GUIDANCE:
- name: a brief, warm opener if history is empty, then ask who it's for. If they give a name, stepComplete true.
- occasion: ask what you're celebrating. Map free text to a key. "60th" / "her birthday" → birthday. Wedding anniversary → anniversary. Retirement / leaving → "other" + occasionLabel.
- photoMode: ask whether the photo is just them or a group. Don't capture from vague input — needs a clear one/group signal.
- front: tell them you can suggest a headline, they can write their own, or skip it. If they write one, capture frontText + frontMode "write". If they want none, frontMode "none". If they ask YOU to choose, suggest a short, classic headline fitting the occasion + name (e.g. "Happy Birthday, Mum") as frontText with frontMode "write", and set stepComplete true.
- inside: ask if they want to write a message inside or leave it blank to handwrite. If they dictate a message, capture insideMessage + insideMode "write". If blank, insideMode "blank". Keep any message in THEIR voice — light touch-ups only, never rewrite wholesale.

JSON CONTRACT (return ONLY valid JSON in this exact shape):
{
  "reply": "the chat bubble text",
  "captured": { "name"?, "occasion"?, "occasionLabel"?, "photoMode"?, "frontMode"?, "frontText"?, "insideMode"?, "insideMessage"? },
  "stepComplete": true | false
}
Only include keys in "captured" that you actually extracted THIS turn. Set stepComplete true only when the CURRENT step's field is captured.`;
}

export function registerStudioChatRoutes(app: Express): void {
  app.post('/api/studio/chat', isAuthenticated, async (req: Request, res: Response) => {
    if (!openai) {
      return res.status(503).json({ error: 'OpenAI is not configured' });
    }

    try {
      const body = req.body as ChatRequest;
      const { step, userMessage, history = [], draft } = body;

      if (typeof step !== 'string') {
        return res.status(400).json({ error: 'step is required' });
      }

      const contextBits: string[] = [];
      contextBits.push(`current_step: ${step}`);
      if (userMessage?.trim()) contextBits.push(`user_message: "${userMessage.trim()}"`);
      const draftParts: string[] = [];
      if (draft?.name) draftParts.push(`name: "${draft.name}"`);
      if (draft?.occasion) draftParts.push(`occasion: "${draft.occasion}"`);
      if (draft?.photoMode) draftParts.push(`photoMode: "${draft.photoMode}"`);
      if (draft?.frontText) draftParts.push(`frontText: "${draft.frontText}"`);
      if (draft?.insideMode) draftParts.push(`insideMode: "${draft.insideMode}"`);
      if (draftParts.length) contextBits.push(`draft_so_far: { ${draftParts.join(', ')} }`);
      const contextMessage = contextBits.join('\n');

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: buildSystemPrompt() },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: contextMessage },
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 400,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content ?? '';
      let parsed: ChatResponse;
      try {
        parsed = JSON.parse(raw) as ChatResponse;
      } catch (err) {
        console.error('[STUDIO_CHAT] JSON parse failed, raw:', raw);
        return res.json({
          reply: raw || 'Sorry — could you say that again?',
          captured: {},
          stepComplete: false,
        });
      }

      // Normalise — only let through known fields/values.
      const cap = parsed.captured ?? {};
      const captured: Captured = {};
      if (typeof cap.name === 'string' && cap.name.trim()) captured.name = cap.name.trim();
      if (typeof cap.occasion === 'string' && (OCCASIONS as readonly string[]).includes(cap.occasion)) {
        captured.occasion = cap.occasion as Captured['occasion'];
      }
      if (typeof cap.occasionLabel === 'string' && cap.occasionLabel.trim()) {
        captured.occasionLabel = cap.occasionLabel.trim();
      }
      if (cap.photoMode === 'one_person' || cap.photoMode === 'group') captured.photoMode = cap.photoMode;
      if (cap.frontMode === 'write' || cap.frontMode === 'none') captured.frontMode = cap.frontMode;
      if (typeof cap.frontText === 'string' && cap.frontText.trim()) captured.frontText = cap.frontText.trim();
      if (cap.insideMode === 'write' || cap.insideMode === 'blank') captured.insideMode = cap.insideMode;
      if (typeof cap.insideMessage === 'string' && cap.insideMessage.trim()) {
        captured.insideMessage = cap.insideMessage.trim();
      }

      res.json({
        reply: typeof parsed.reply === 'string' ? parsed.reply : '',
        captured,
        stepComplete: parsed.stepComplete === true,
      } satisfies ChatResponse);
    } catch (error) {
      console.error('[STUDIO_CHAT] error:', error);
      res.status(500).json({ error: 'Failed to generate chat response' });
    }
  });
}
