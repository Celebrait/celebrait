// client/src/hooks/use-brainstorm-chat.ts
//
// Conversation state for the Studio's Scene brainstorm chat. Mirrors
// the MVP's five-phase guided flow users responded well to:
//
//   initial_scene → scene_specifics → activity → clothing → summary
//                                                              ↑
//                                          change_request ─────┘
//
// POST /api/studio/brainstorm drives each turn; the server returns a
// structured JSON response { reply, phase, suggestions?, finalScene? }
// so the client doesn't need to regex AI replies to detect transitions.
//
// History is in-memory only — closing the drawer keeps state while the
// Studio page is open; navigating away loses it. Good enough for v1.

import { useCallback, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { getOccasionLabel } from '@/components/studio/scene-presets';

export type Role = 'user' | 'assistant';

export type Phase =
  | 'initial_scene'
  | 'scene_specifics'
  | 'activity'
  | 'clothing'
  | 'summary'
  | 'change_request';

export interface BrainstormMessage {
  id: string;
  role: Role;
  content: string;
}

export interface CollectedInfo {
  initialScene?: string;
  sceneSpecifics?: string;
  activity?: string;
  clothing?: string;
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

interface ServerResponse {
  reply: string;
  phase: Phase;
  suggestions?: string[];
  finalScene?: string;
}

interface UseBrainstormChatOptions {
  recipientName: string;
  occasion: string;
  /** Current Scene textarea content. Passed to the server each turn so
   *  the opener can offer to refine existing text vs start fresh. */
  currentSceneText: string;
  // photoMode removed 2026-05-14 — scenes describe the world, not the
  // people, so person-mode framing has nothing to influence in the
  // chat. The photo carries who's there; the chat carries where.
}

export interface BrainstormChatState {
  messages: BrainstormMessage[];
  phase: Phase;
  collectedInfo: CollectedInfo;
  suggestions: string[] | null;
  /** Populated when the AI has produced a finalScene. Drives the
   *  "Sounds great, let's go!" primary button in the drawer. */
  proposedScene: string | null;
  isLoading: boolean;
  error: string | null;
  /** True once the opener has fired. Used to suppress repeated openers
   *  if the drawer reopens mid-conversation. */
  hasStarted: boolean;
}

export interface BrainstormChatActions {
  /** Fire the opener. No-ops if already started. */
  start: () => Promise<void>;
  /** Send a typed user reply — commits as the answer for the current phase. */
  send: (text: string) => Promise<void>;
  /** Ask the AI for 3 suggestions at the current phase. */
  giveIdeas: () => Promise<void>;
  /** Re-roll for 3 fresh suggestions. */
  moreIdeas: () => Promise<void>;
  /** User picked one of the current suggestions — commits as a reply. */
  chooseSuggestion: (text: string) => Promise<void>;
  /** Skip the current question and advance. */
  skip: () => Promise<void>;
  /** From summary: "I'd like to make a change". Enters change_request. */
  requestChange: () => Promise<void>;
  /** After describing the change, send the tweak. */
  tweak: (text: string) => Promise<void>;
  /** Reset the entire conversation. */
  reset: () => void;
}

// ── Skip-acknowledgement helpers ─────────────────────────────────────
// The system prompt requires the model to start its reply with a
// "Got it — I'll pick X" line when the user skipped. Models drift,
// so we stitch one in client-side as a safety net. These helpers are
// the per-phase ack copy and a startsWith-style detector that
// recognises any plausible ack so we don't double up.
const SKIP_ACK_BY_PHASE: Record<string, string> = {
  scene_specifics: "Got it — I'll fill in the specifics.",
  activity: "Got it — I'll pick the moment.",
  clothing: "Got it — I'll pick the dress code.",
};
function buildSkipAck(phase: string): string | null {
  return SKIP_ACK_BY_PHASE[phase] ?? null;
}
function startsWithAck(reply: string): boolean {
  // Accept any plausible "got it" / "okay" / "sure" / "no problem"
  // opener within the first ~10 words. Generous on purpose — the
  // intent is to dedupe, not to enforce exact wording.
  const head = reply.slice(0, 80).toLowerCase();
  return (
    head.startsWith('got it') ||
    head.startsWith('ok') ||
    head.startsWith('okay') ||
    head.startsWith('sure') ||
    head.startsWith('no problem') ||
    head.startsWith('understood') ||
    head.startsWith("i'll pick") ||
    head.startsWith('alright')
  );
}

export function useBrainstormChat({
  recipientName,
  occasion,
  currentSceneText,
}: UseBrainstormChatOptions): BrainstormChatState & BrainstormChatActions {
  const [messages, setMessages] = useState<BrainstormMessage[]>([]);
  const [phase, setPhase] = useState<Phase>('initial_scene');
  const [collectedInfo, setCollectedInfo] = useState<CollectedInfo>({});
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [proposedScene, setProposedScene] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // Record the user's answer for the phase we're about to leave.
  // Called when a `reply` / `choose_option` action advances the flow.
  const stashCollected = useCallback((currentPhase: Phase, answer: string) => {
    setCollectedInfo((prev) => {
      const next = { ...prev };
      if (currentPhase === 'initial_scene') next.initialScene = answer;
      else if (currentPhase === 'scene_specifics') next.sceneSpecifics = answer;
      else if (currentPhase === 'activity') next.activity = answer;
      else if (currentPhase === 'clothing') next.clothing = answer;
      return next;
    });
  }, []);

  const callServer = useCallback(
    async (
      action: Action,
      opts: {
        userInput?: string;
        historyOverride?: BrainstormMessage[];
        phaseOverride?: Phase;
      } = {},
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const history = (opts.historyOverride ?? messages).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        // Remember what phase the user was on when they hit skip — used
        // by the defensive ack prepend below.
        const phaseBefore = opts.phaseOverride ?? phase;

        const res = await apiRequest('POST', '/api/studio/brainstorm', {
          recipientName,
          occasion,
          currentSceneText,
          history,
          action,
          userInput: opts.userInput,
          currentPhase: phaseBefore,
          collectedInfo,
        });
        const data = (await res.json()) as ServerResponse;

        // Defensive ack prepend — the system prompt now REQUIRES the
        // model to start the reply with a "Got it — I'll pick the
        // dress code" / etc. acknowledgement when the user skipped.
        // Belt-and-braces: if the model drops it anyway, stitch one
        // in client-side so the user always sees confirmation that
        // their skip was registered + what we'll choose for them.
        const ack = action === 'skip' ? buildSkipAck(phaseBefore) : null;
        const replyText =
          ack && !startsWithAck(data.reply ?? '')
            ? `${ack} ${data.reply ?? ''}`.trim()
            : data.reply ?? '';

        const assistantMessage: BrainstormMessage = {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content: replyText,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setPhase(data.phase);
        setSuggestions(data.suggestions ?? null);
        if (data.finalScene) {
          setProposedScene(data.finalScene);
        } else if (data.phase !== 'summary' && data.phase !== 'change_request') {
          // Only clear the proposed scene when leaving the summary branch.
          setProposedScene(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, recipientName, occasion, currentSceneText, phase, collectedInfo],
  );

  // Opener is a fixed client-side greeting — no API call. Saves a
  // round-trip + keeps the entry experience instant.
  //
  // Scene-not-people framing (2026-05-14): the opener intentionally
  // does NOT name the recipient or count people in the photo. The
  // chat's job is to settle the SCENE (where, when, what's
  // happening); the photo handles WHO. Naming the recipient in the
  // opener primed the rest of the conversation to over-index on
  // "Troy this, Troy that" when the photo was actually Troy + his
  // fiancée — felt strange because the photo and the prose were
  // talking about different casts.
  const start = useCallback(async () => {
    if (hasStarted || isLoading) return;
    // getOccasionLabel produces correct two-word forms ('Thank you',
    // not 'Thankyou'; "Valentine's Day", not 'Valentines').
    const occasionDisplay =
      getOccasionLabel(occasion.trim()) || 'celebration';

    const opener =
      `Hello! ✨ Let's design the scene for the front of this ${occasionDisplay} card. We'll keep it scene-led — where it is, what's happening, the atmosphere. The people in your photos handle themselves.\n\n` +
      `Where would you like the scene to take place?`;
    const openerMessage: BrainstormMessage = {
      id: `a-opener-${Date.now()}`,
      role: 'assistant',
      content: opener,
    };
    setMessages([openerMessage]);
    setPhase('initial_scene');
    setSuggestions(null);
    setProposedScene(null);
    setHasStarted(true);
  }, [hasStarted, isLoading, occasion]);

  const pushUserMessage = useCallback((text: string): BrainstormMessage[] => {
    const userMessage: BrainstormMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: text,
    };
    const next = [...messages, userMessage];
    setMessages(next);
    setSuggestions(null);
    return next;
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      setHasStarted(true);
      stashCollected(phase, trimmed);
      const next = pushUserMessage(trimmed);
      await callServer('reply', { userInput: trimmed, historyOverride: next });
    },
    [isLoading, phase, stashCollected, pushUserMessage, callServer],
  );

  const giveIdeas = useCallback(async () => {
    if (isLoading) return;
    await callServer('ideas');
  }, [isLoading, callServer]);

  const moreIdeas = useCallback(async () => {
    if (isLoading) return;
    await callServer('more_ideas');
  }, [isLoading, callServer]);

  const chooseSuggestion = useCallback(
    async (text: string) => {
      if (isLoading) return;
      stashCollected(phase, text);
      const next = pushUserMessage(text);
      await callServer('choose_option', { userInput: text, historyOverride: next });
    },
    [isLoading, phase, stashCollected, pushUserMessage, callServer],
  );

  const skip = useCallback(async () => {
    if (isLoading) return;
    const next = pushUserMessage('Skip this one');
    await callServer('skip', { historyOverride: next });
  }, [isLoading, pushUserMessage, callServer]);

  const requestChange = useCallback(async () => {
    if (isLoading) return;
    const next = pushUserMessage("I'd like to make a change");
    await callServer('change_request', { historyOverride: next });
  }, [isLoading, pushUserMessage, callServer]);

  const tweak = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      const next = pushUserMessage(trimmed);
      await callServer('tweak', { userInput: trimmed, historyOverride: next });
    },
    [isLoading, pushUserMessage, callServer],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setPhase('initial_scene');
    setCollectedInfo({});
    setSuggestions(null);
    setProposedScene(null);
    setError(null);
    setHasStarted(false);
  }, []);

  return {
    messages,
    phase,
    collectedInfo,
    suggestions,
    proposedScene,
    isLoading,
    error,
    hasStarted,
    start,
    send,
    giveIdeas,
    moreIdeas,
    chooseSuggestion,
    skip,
    requestChange,
    tweak,
    reset,
  };
}

// Title-case a short phrase word-by-word. "birthday" → "Birthday",
// "new home" → "New Home". Used to render the occasion key in the
// canned opener. Leaves already-capitalised text alone.
function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .map((word) =>
      word.length === 0 ? word : word[0].toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(' ');
}
