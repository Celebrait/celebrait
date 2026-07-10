// client/src/components/studio/brainstorm-chat-drawer.tsx
//
// Side drawer (shadcn Sheet) that hosts the Scene-step brainstorm chat.
// Owned by Scene step; open/close state + the accept callback flow
// through props. Conversation state lives in useBrainstormChat.
//
// UX shape per UX_STUDIO_TONE.md:
//   - Opens on the right, narrow-desktop / full-width-mobile
//   - No robot mascot, no "Greetings! ✨", no gradient purple buttons
//   - Five-phase guided flow from the MVP (initial_scene →
//     scene_specifics → activity → clothing → summary), with inline
//     action buttons beneath the latest assistant message
//   - "Sounds great, let's go!" primary when summary has finalScene

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Lightbulb, SkipForward, Check, Pencil, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useBrainstormChat, type BrainstormMessage } from '@/hooks/use-brainstorm-chat';

interface BrainstormChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientName: string;
  occasion: string;
  /** Current Scene textarea content. Passed to the hook so the opener
   *  can offer to refine existing text vs start fresh. */
  currentSceneText: string;
  // photoMode prop dropped 2026-05-14 — see use-brainstorm-chat.ts.
  /** Called when the user taps "Use this scene". The accepted scene
   *  paragraph should overwrite the Scene textarea and close the drawer. */
  onAccept: (scene: string) => void;
}

export function BrainstormChatDrawer({
  open,
  onOpenChange,
  recipientName,
  occasion,
  currentSceneText,
  onAccept,
}: BrainstormChatDrawerProps) {
  const chat = useBrainstormChat({ recipientName, occasion, currentSceneText });
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-fire the opening message the first time the drawer opens.
  // Re-opening after a close preserves the history — hasStarted stays true.
  useEffect(() => {
    if (open && !chat.hasStarted && !chat.isLoading) {
      void chat.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll to bottom on new messages / loading state changes.
  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, [chat.messages.length, chat.isLoading]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    // In change_request phase the typed input describes what to tweak.
    // On summary itself, freeform typed input is also a tweak request.
    // Everywhere else, typed input is a reply for the current phase.
    if (chat.phase === 'change_request' || (chat.phase === 'summary' && chat.proposedScene)) {
      await chat.tweak(trimmed);
    } else {
      await chat.send(trimmed);
    }
  };

  const handleAccept = () => {
    if (!chat.proposedScene) return;
    onAccept(chat.proposedScene);
    onOpenChange(false);
  };

  // Reset conversation when the drawer fully closes (debounced via the
  // onOpenChange=false path). Keeping state while open — even across
  // navigations — is out of scope; this is in-memory per page load.
  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const lastAssistantIndex = lastIndexOf(chat.messages, (m) => m.role === 'assistant');

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-5 py-4 border-b border-keeper-hair text-left">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold text-keeper-ink">
            <Sparkles className="w-4 h-4 text-brand" strokeWidth={1.75} />
            Brainstorm the scene
          </SheetTitle>
          <SheetDescription className="text-xs text-stone-500">
            A few quick questions, and we'll draft a scene paragraph
            you can drop straight in.
          </SheetDescription>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-stone-50">
          {chat.messages.map((msg, i) => (
            <div key={msg.id}>
              <MessageBubble message={msg} />
              {/* Under the latest assistant message:
                  • If we're in summary phase with a proposedScene, show the
                    scene paragraph as a styled "Proposed scene" card BEFORE
                    the action buttons. Without this the user is asked to
                    approve a scene they can't see (the only on-screen text
                    is the assistant's intro reply like "Here's the full
                    scene:"). The textarea on the page behind the drawer
                    populates, but that's not where the user is looking.
                  • Then render the inline action buttons. */}
              {msg.role === 'assistant' && i === lastAssistantIndex && !chat.isLoading && (
                <div className="mt-3 space-y-3">
                  {chat.phase === 'summary' && chat.proposedScene && (
                    <ProposedSceneCard scene={chat.proposedScene} />
                  )}
                  <ActionButtons
                    phase={chat.phase}
                    suggestions={chat.suggestions}
                    proposedScene={chat.proposedScene}
                    onChooseSuggestion={chat.chooseSuggestion}
                    onGiveIdeas={chat.giveIdeas}
                    onMoreIdeas={chat.moreIdeas}
                    onSkip={chat.skip}
                    onRequestChange={chat.requestChange}
                    onAccept={handleAccept}
                    onReset={chat.reset}
                  />
                </div>
              )}
            </div>
          ))}

          {chat.isLoading && <TypingIndicator />}
          {chat.error && (
            <div className="text-xs text-accent-red-dark bg-accent-red-light border border-accent-red/25 rounded-lg px-3 py-2">
              {chat.error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-keeper-hair bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                chat.phase === 'summary' && chat.proposedScene
                  ? "Type a change, or tap Sounds great to continue…"
                  : chat.phase === 'change_request'
                    ? 'Tell me what to change…'
                    : 'Type your answer…'
              }
              className="text-base border-brand-light focus-visible:border-brand focus-visible:ring-brand/20"
              disabled={chat.isLoading}
              data-testid="input-brainstorm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || chat.isLoading}
              className="bg-go hover:bg-go-hover text-brand-foreground shrink-0"
              data-testid="btn-brainstorm-send"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Proposed-scene card ──────────────────────────────────────────────
// Rendered in the chat stream when phase=summary and proposedScene is
// non-null. Without this, the assistant's reply ("Here's the full
// scene:") sits over a Sounds-great button with no visible scene
// between them — the user is asked to commit blind. Styling
// deliberately distinct from chat bubbles so it reads as "the
// proposal" rather than another message.
function ProposedSceneCard({ scene }: { scene: string }) {
  return (
    <div
      className="flex justify-start"
      data-testid="brainstorm-proposed-scene"
    >
      <div className="max-w-[95%] w-full bg-brand-muted/50 border border-brand-light rounded-2xl px-4 py-3.5">
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-brand-dark mb-1.5">
          Proposed scene
        </p>
        <p className="text-sm leading-relaxed text-keeper-ink whitespace-pre-wrap">
          {scene}
        </p>
      </div>
    </div>
  );
}

// ── Message bubble ───────────────────────────────────────────────────
function MessageBubble({ message }: { message: BrainstormMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed ${
          isUser
            ? 'bg-brand text-brand-foreground'
            : 'bg-white border border-keeper-hair text-keeper-ink'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

// ── Typing indicator ─────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-keeper-hair rounded-2xl px-4 py-3 inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
        <span
          className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce"
          style={{ animationDelay: '0.15s' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce"
          style={{ animationDelay: '0.3s' }}
        />
      </div>
    </div>
  );
}

// ── Inline action buttons ────────────────────────────────────────────
// Rendered beneath the latest assistant message only. Button set is
// phase-sensitive:
//   - initial_scene  → no buttons (text-input only, mirrors MVP)
//   - scene_specifics / activity / clothing → Give me ideas / Skip
//   - suggestions showing → Choose Option N + More ideas + Skip
//   - summary → Sounds great, let's go! / I'd like to make a change
//   - change_request → no buttons (user describes the change)
type DrawerPhase =
  | 'initial_scene'
  | 'scene_specifics'
  | 'activity'
  | 'clothing'
  | 'summary'
  | 'change_request';

interface ActionButtonsProps {
  phase: DrawerPhase;
  suggestions: string[] | null;
  proposedScene: string | null;
  onChooseSuggestion: (text: string) => void;
  onGiveIdeas: () => void;
  onMoreIdeas: () => void;
  onSkip: () => void;
  onRequestChange: () => void;
  onAccept: () => void;
  onReset: () => void;
}

function ActionButtons({
  phase,
  suggestions,
  proposedScene,
  onChooseSuggestion,
  onGiveIdeas,
  onMoreIdeas,
  onSkip,
  onRequestChange,
  onAccept,
  onReset,
}: ActionButtonsProps) {
  // Suggestions showing → user picks one, or asks for more, or skips.
  if (suggestions && suggestions.length > 0) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChooseSuggestion(s)}
              className="text-left text-sm leading-snug px-3 py-2 rounded-lg bg-white border border-brand-light hover:border-brand hover:bg-brand-muted text-keeper-ink transition-colors max-w-full"
              data-testid={`btn-brainstorm-suggestion-${i}`}
            >
              <span className="font-medium text-brand mr-2">
                {i + 1}.
              </span>
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryAction icon={Lightbulb} label="More ideas" onClick={onMoreIdeas} />
          <SecondaryAction icon={SkipForward} label="Skip this question" onClick={onSkip} />
        </div>
      </div>
    );
  }

  // Summary phase with a scene → the big commit moment.
  if (phase === 'summary' && proposedScene) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onAccept}
          className="bg-go hover:bg-go-hover text-go-foreground text-sm"
          data-testid="btn-brainstorm-accept"
        >
          <Check className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
          Sounds great, let's go!
        </Button>
        <SecondaryAction icon={Pencil} label="I'd like to make a change" onClick={onRequestChange} />
        <SecondaryAction icon={RefreshCw} label="Start over" onClick={onReset} />
      </div>
    );
  }

  // Initial scene + change_request → no buttons, user must type.
  if (phase === 'initial_scene' || phase === 'change_request') {
    return null;
  }

  // Mid-flow phases (scene_specifics / activity / clothing) → Give me
  // ideas + Skip this question. Mirrors the MVP's bread-and-butter pattern.
  return (
    <div className="flex flex-wrap gap-2">
      <SecondaryAction icon={Lightbulb} label="Give me ideas" onClick={onGiveIdeas} />
      <SecondaryAction icon={SkipForward} label="Skip this question" onClick={onSkip} />
    </div>
  );
}

// Shared secondary-action pill used in the inline button row.
function SecondaryAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Lightbulb;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand-dark px-3 py-1.5 rounded-full border border-brand-light hover:border-brand hover:bg-brand-muted transition-colors"
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}

// Inline helper — Array.findLastIndex isn't available in all TS lib
// targets; rolling a trivial polyfill to avoid that config dance.
function lastIndexOf<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

export type { BrainstormMessage };
