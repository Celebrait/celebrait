// client/src/components/landing/imagine-describe-ship-section.tsx
//
// "Imagine it. Describe it. Send it." — autoplay demo of the
// Studio's brainstorm chat, ending on a 3D card reveal.
//
// Hard clone of the real drawer UI from
// `client/src/components/studio/brainstorm-chat-drawer.tsx`:
//
//   • Sparkle-icon header + "Brainstorm the scene" title
//   • Bubble styles (violet "you" / white "ai"), bg-stone-50 chat surface
//   • Phase-aware action pills under the latest AI message
//   • Typing indicator (3 bouncing dots in a bubble)
//   • Disabled input bar at the bottom mirroring the real one
//
// History (2026-05-06):
//   1. Original: autoplay timer-driven loop.
//   2. Pivoted to scroll-driven (sticky inner, scrubbed by scroll
//      progress). Got into knots over scroll-jacking, sticky
//      release, section collapse, gap-above-card.
//   3. Reverted to autoplay (Kevin call: "this scroll to animate
//      is more effort than its worth, should we revert back to
//      the gif only? And have the 3d card viewer mocked on the
//      screen as the reveal?"). Section is now normal flow,
//      intersection-observer triggers the timeline once, chat
//      plays through to summary, then phone fades out and the
//      3D card fades in. Card stays at rest forever after.
//
// Timeline (autoplay, fires once when section enters view):
//   • Snapshots 0..14 advance on their original `durationMs`
//     (≈13.7s total — same script as before).
//   • After snapshot 14's dwell: 'press' (Sounds great pulses)
//     for 700ms, then 'phone-fade' (700ms), then 'spinner'
//     (1500ms), then 'card' — final state, holds forever.
//
// TODO Kevin: swap brainstormCardFront/Inside imports below
// to the custom card art he's preparing for this section.

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  motion,
  AnimatePresence,
  cubicBezier,
  useReducedMotion,
  useInView,
} from 'framer-motion';
import {
  Battery,
  Check,
  ChevronLeft,
  Lightbulb,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  Signal,
  SkipForward,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';
import { Button } from '@/components/ui/button';
import { GestureHints } from '@/components/gesture-hints';

// TODO Kevin: swap to brainstorm-card-front/inside.png once the
// custom card art is rendered. Until then, points at the hero
// card 120 placeholders so the section renders end-to-end.
import brainstormCardFront from '@/assets/hero-card-front.jpg';
import brainstormCardInside from '@/assets/hero-card-inside.jpg';

const Card3DViewer = lazy(() =>
  import('@/components/card-3d-viewer').then((m) => ({ default: m.Card3DViewer })),
);

/* ─── Types ─────────────────────────────────────────────────────── */

type Role = 'ai' | 'user';
type ActionsKind =
  | 'none'
  | 'ideas-skip'
  | 'suggestions'
  | 'more-ideas-skip'
  | 'summary';

interface BubbleMsg {
  id: number;
  role: Role;
  content: string;
  /** Suggestions render as numbered chips ABOVE the bubble's content
   *  on the AI side (mirrors the real drawer layout). */
  suggestions?: string[];
}

interface ScriptSnapshot {
  /** How long to dwell on this snapshot before advancing. */
  durationMs: number;
  messages: BubbleMsg[];
  typing?: boolean;
  /** Action set rendered under the LATEST AI message in this snapshot. */
  actions?: ActionsKind;
}

/* ─── Scripted brainstorm playback ──────────────────────────────── */

// Stable message ids so React keeps stable keys across snapshots (no
// re-mount, no re-animation of older bubbles). New ids enter the
// list as the conversation progresses.
const M = {
  AI_OPEN: { id: 1, role: 'ai' as const, content: "Hi — where does Mum's birthday scene take place?" },
  USER_LOCATION: { id: 2, role: 'user' as const, content: 'Plettenberg Bay.' },
  AI_SPECIFICS: { id: 3, role: 'ai' as const, content: 'Lovely. Which part — beach, cliffs, or somewhere quieter?' },
  AI_SUGGESTIONS: {
    id: 4,
    role: 'ai' as const,
    content: 'Here are a few Plett-flavoured ideas —',
    suggestions: [
      'The cliffs at golden hour',
      'The lagoon at low tide',
      'The little café in the village',
    ],
  },
  USER_PICK: { id: 5, role: 'user' as const, content: 'The cliffs at golden hour.' },
  AI_ACTIVITY: { id: 6, role: 'ai' as const, content: "Got it. What's she doing there?" },
  USER_ACTIVITY: { id: 7, role: 'user' as const, content: 'Watching the sunset with her labrador.' },
  AI_CLOTHING: { id: 8, role: 'ai' as const, content: "And what's she wearing?" },
  AI_SUMMARY: {
    id: 9,
    role: 'ai' as const,
    content:
      "Got it — here's the scene: Mum at the Plett cliffs at golden hour, watching the sun go down with her labrador beside her.",
  },
};

const SCRIPT: ScriptSnapshot[] = [
  // 1. AI typing the opener
  { durationMs: 650, messages: [], typing: true },
  // 2. AI: opening "where" question (initial_scene → no buttons)
  { durationMs: 1000, messages: [M.AI_OPEN], actions: 'none' },
  // 3. User replies
  { durationMs: 500, messages: [M.AI_OPEN, M.USER_LOCATION] },
  // 4. AI typing
  { durationMs: 550, messages: [M.AI_OPEN, M.USER_LOCATION], typing: true },
  // 5. AI: scene_specifics question + [Ideas / Skip]
  {
    durationMs: 1100,
    messages: [M.AI_OPEN, M.USER_LOCATION, M.AI_SPECIFICS],
    actions: 'ideas-skip',
  },
  // 6. User clicks "Give me ideas" → AI typing
  {
    durationMs: 550,
    messages: [M.AI_OPEN, M.USER_LOCATION, M.AI_SPECIFICS],
    typing: true,
    actions: 'ideas-skip',
  },
  // 7. AI: 3 suggestions + [More ideas / Skip]
  {
    durationMs: 1600,
    messages: [M.AI_OPEN, M.USER_LOCATION, M.AI_SUGGESTIONS],
    actions: 'suggestions',
  },
  // 8. User picks "The cliffs at golden hour"
  {
    durationMs: 550,
    messages: [M.AI_OPEN, M.USER_LOCATION, M.AI_SUGGESTIONS, M.USER_PICK],
  },
  // 9. AI typing
  {
    durationMs: 550,
    messages: [M.AI_OPEN, M.USER_LOCATION, M.AI_SUGGESTIONS, M.USER_PICK],
    typing: true,
  },
  // 10. AI: activity question + [Ideas / Skip]
  {
    durationMs: 1000,
    messages: [
      M.AI_OPEN,
      M.USER_LOCATION,
      M.AI_SUGGESTIONS,
      M.USER_PICK,
      M.AI_ACTIVITY,
    ],
    actions: 'ideas-skip',
  },
  // 11. User: types activity reply
  {
    durationMs: 650,
    messages: [
      M.AI_OPEN,
      M.USER_LOCATION,
      M.AI_SUGGESTIONS,
      M.USER_PICK,
      M.AI_ACTIVITY,
      M.USER_ACTIVITY,
    ],
  },
  // 12. AI typing
  {
    durationMs: 550,
    messages: [
      M.AI_OPEN,
      M.USER_LOCATION,
      M.AI_SUGGESTIONS,
      M.USER_PICK,
      M.AI_ACTIVITY,
      M.USER_ACTIVITY,
    ],
    typing: true,
  },
  // 13. AI: clothing question + [Ideas / Skip]
  {
    durationMs: 900,
    messages: [
      M.AI_OPEN,
      M.USER_LOCATION,
      M.AI_SUGGESTIONS,
      M.USER_PICK,
      M.AI_ACTIVITY,
      M.USER_ACTIVITY,
      M.AI_CLOTHING,
    ],
    actions: 'ideas-skip',
  },
  // 14. User clicks Skip → AI typing
  {
    durationMs: 550,
    messages: [
      M.AI_OPEN,
      M.USER_LOCATION,
      M.AI_SUGGESTIONS,
      M.USER_PICK,
      M.AI_ACTIVITY,
      M.USER_ACTIVITY,
      M.AI_CLOTHING,
    ],
    typing: true,
  },
  // 15. AI: summary scene + [Sounds great / Edit / Start over]
  {
    durationMs: 3000,
    messages: [
      M.AI_OPEN,
      M.USER_LOCATION,
      M.AI_SUGGESTIONS,
      M.USER_PICK,
      M.AI_ACTIVITY,
      M.USER_ACTIVITY,
      M.AI_CLOTHING,
      M.AI_SUMMARY,
    ],
    actions: 'summary',
  },
  // 16. Reset frame — empty chat for ~400ms before looping
  { durationMs: 400, messages: [] },
];

/* ─── Phone frame ───────────────────────────────────────────────── */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  // Original widths — restored 2026-05-06 (Kevin: "you made the
  // phone smaller, so now the text cuts off at the bottom of the
  // phone, the entire chat needs to show"). Breathing room below
  // the phone is now provided by translate-y on the wrapper +
  // tighter headline/padding sizing, NOT by shrinking the phone.
  return (
    <div className="relative mx-auto w-[280px] md:w-[300px] lg:w-[320px] aspect-[9/19]">
      <div
        className="absolute inset-0 bg-ink rounded-[44px]"
        style={{
          boxShadow:
            '0 40px 80px -30px rgba(15,23,42,0.32), 0 16px 32px -16px rgba(15,23,42,0.18)',
        }}
      >
        <div className="absolute inset-[10px] bg-surface-card rounded-[34px] overflow-hidden">
          <div
            aria-hidden
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[110px] h-6 bg-ink rounded-b-2xl z-20"
          />
          <div className="relative w-full h-full">{children}</div>
          <div
            aria-hidden
            className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-stone-300 rounded-full z-20"
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components: bubbles, typing, action pills ─────────────── */

function MessageBubble({ msg }: { msg: BubbleMsg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, x: isUser ? 6 : -6 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className="max-w-[88%] space-y-1">
        {/* Suggestions chips render ABOVE the bubble content (mirrors
            the studio drawer's layout). */}
        {msg.suggestions && (
          <div className="space-y-1 mb-1.5">
            {msg.suggestions.map((s, i) => (
              <div
                key={i}
                className="text-left text-[10px] leading-snug px-2 py-1.5 rounded-md bg-white border border-brand-light text-ink"
              >
                <span className="font-semibold text-brand mr-1">{i + 1}.</span>
                {s}
              </div>
            ))}
          </div>
        )}
        <div
          className={`px-3 py-1.5 text-[11px] leading-snug ${
            isUser
              ? 'bg-brand text-brand-foreground rounded-2xl rounded-br-md'
              : 'bg-white border border-stone-200 text-ink rounded-2xl rounded-bl-md'
          }`}
        >
          {msg.content}
        </div>
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-start"
    >
      <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-md px-3 py-2 inline-flex items-center gap-1">
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
    </motion.div>
  );
}

function ActionPill({
  icon: Icon,
  label,
}: {
  icon: typeof Lightbulb;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-brand font-medium px-2 py-1 rounded-full border border-brand-light bg-white">
      <Icon className="w-2.5 h-2.5" strokeWidth={1.75} />
      {label}
    </span>
  );
}

function PrimaryActionPill({
  icon: Icon,
  label,
}: {
  icon: typeof Check;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-cta text-cta-foreground">
      <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
      {label}
    </span>
  );
}

function ActionRow({ kind }: { kind: ActionsKind }) {
  if (kind === 'none') return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      className="flex flex-wrap gap-1.5 mt-2 pl-1"
    >
      {kind === 'ideas-skip' && (
        <>
          <ActionPill icon={Lightbulb} label="Give me ideas" />
          <ActionPill icon={SkipForward} label="Skip" />
        </>
      )}
      {kind === 'more-ideas-skip' || kind === 'suggestions' ? (
        <>
          <ActionPill icon={Lightbulb} label="More ideas" />
          <ActionPill icon={SkipForward} label="Skip" />
        </>
      ) : null}
      {kind === 'summary' && (
        <>
          <PrimaryActionPill icon={Check} label="Sounds great" />
          <ActionPill icon={Pencil} label="Make a change" />
          <ActionPill icon={RefreshCw} label="Start over" />
        </>
      )}
    </motion.div>
  );
}

/* ─── Brainstorm screen ─────────────────────────────────────────── */

function BrainstormScreen({
  snapshot,
  showChoice,
  onViewChatAgain,
  onViewCard,
}: {
  snapshot: ScriptSnapshot;
  /** When true, overlay the chat with a centred two-button choice
   *  panel (Kevin call 2026-05-06: "have a button on the phone in
   *  the centre on its own which says view chat again or view
   *  greetings card"). */
  showChoice?: boolean;
  onViewChatAgain?: () => void;
  onViewCard?: () => void;
}) {
  const lastAiIndex = (() => {
    for (let i = snapshot.messages.length - 1; i >= 0; i--) {
      if (snapshot.messages[i].role === 'ai') return i;
    }
    return -1;
  })();

  return (
    <div className="absolute inset-0 flex flex-col bg-stone-50">
      {/* Status bar */}
      <div className="h-7 px-5 pt-1.5 flex items-center justify-between text-[10px] font-semibold text-ink tabular-nums shrink-0 bg-surface-card">
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <Signal className="w-3 h-3" strokeWidth={2.5} />
          <Wifi className="w-3 h-3" strokeWidth={2.5} />
          <Battery className="w-4 h-3" strokeWidth={2} />
        </div>
      </div>

      {/* App header — Brainstorm the scene */}
      <div className="px-4 py-2.5 border-b border-stone-200 shrink-0 bg-surface-card">
        <div className="flex items-center gap-2">
          <ChevronLeft className="w-4 h-4 text-ink" strokeWidth={2.25} />
          <Sparkles className="w-3.5 h-3.5 text-brand" strokeWidth={1.75} />
          <p className="text-[12px] font-semibold text-ink tracking-tight">
            Brainstorm the scene
          </p>
        </div>
        <p className="text-[9px] text-stone-500 mt-1 ml-6">
          A few quick questions, and we'll draft a scene.
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden px-3 pt-3 pb-2 flex flex-col gap-2 bg-stone-50 relative">
        {snapshot.messages.map((msg, i) => (
          <div key={msg.id}>
            <MessageBubble msg={msg} />
            {i === lastAiIndex && msg.role === 'ai' && snapshot.actions && (
              <ActionRow kind={snapshot.actions} />
            )}
          </div>
        ))}
        <AnimatePresence>{snapshot.typing && <TypingDots />}</AnimatePresence>

        {/* Choice panel — overlays the chat surface when chat ends.
            Two centred stacked buttons. Crossfade in/out. */}
        <AnimatePresence>
          {showChoice && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 bg-stone-50/95 backdrop-blur-[2px]"
            >
              <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft font-semibold mb-1">
                What's next?
              </p>
              <button
                type="button"
                onClick={onViewCard}
                className="w-full max-w-[200px] inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-cta-foreground bg-cta hover:bg-cta-hover px-3 py-2 rounded-full shadow-sm transition-colors duration-200"
              >
                <Sparkles className="w-3 h-3" strokeWidth={2.5} />
                View greetings card
              </button>
              <button
                type="button"
                onClick={onViewChatAgain}
                className="w-full max-w-[200px] inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-ink-soft bg-white border border-stone-200 hover:border-brand/40 hover:text-ink px-3 py-2 rounded-full transition-colors duration-200"
              >
                <RefreshCw className="w-3 h-3" strokeWidth={2} />
                View chat again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Disabled input bar (mirrors the real drawer's footer) */}
      <div className="px-3 py-2.5 border-t border-stone-200 bg-surface-card shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-7 px-2.5 rounded-md border border-stone-200 bg-white flex items-center text-[10px] text-stone-400">
            Type your answer…
          </div>
          <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center">
            <Send className="w-3 h-3 text-brand-foreground" strokeWidth={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section ───────────────────────────────────────────────────── */

// Drop the trailing reset/empty frame — scroll-driven doesn't loop,
// so we just hold on the last (summary) snapshot before the card
// reveal begins.
const SCROLL_SCRIPT = SCRIPT.slice(0, -1);

// Premium ease-out curve. Same family as Apple's keynote-style
// "easeOutQuart" decel — softens every transform so the reveal
// reads as graceful, not linear.
const REVEAL_EASE = cubicBezier(0.22, 1, 0.36, 1);

// Three phases: chat → choice → card.
//
// Kevin call 2026-05-06: "I think the best way to execute this is
// to finish the ai chat, then have a button on the phone in the
// centre on its own which says view chat again or view greetings
// card — give the user the option otherwise it's way too much
// going on."
//
// 'chat'   — autoplay snapshot timeline. ~13.7s of scripted chat.
// 'choice' — phone screen swaps to a centred two-button panel:
//            "View greetings card" (primary) / "View chat again"
//            (secondary). Sits forever until the user clicks one.
// 'card'   — phone fades out, 3D card fades in. Final state.
type RevealPhase = 'chat' | 'choice' | 'card';

export function ImagineDescribeShipSection() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const showAuthedTreatment = !isLoading && isAuthenticated;
  const reduced = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement>(null);

  // Chat autoplay is gated on the section scrolling into view. The
  // timeline is ~13.7s; if it starts on page load (as it used to),
  // anyone who doesn't reach this section within ~14s arrives to a
  // chat that's already finished — they miss the whole demo.
  //
  // `useInView` (framer-motion's helper) is used instead of a raw
  // IntersectionObserver — earlier attempts with the bare observer
  // were flaky (the snapshot timer never started). `once: true` so
  // the timeline never restarts once it's begun; `amount: 0.2` kept
  // low because the section is tall (>900px) — requiring a large
  // visible fraction would never trip on a laptop viewport. 20% in
  // view ≈ the headline + top of the phone on screen, which is the
  // right moment to begin so the user catches the chat from message 1.
  const inView = useInView(sectionRef, { once: true, amount: 0.2 });

  // Snapshot index for the chat playback. Advances on each
  // snapshot's `durationMs` while revealPhase==='chat' AND the
  // section is in view. Before in-view, the phone holds on
  // SCROLL_SCRIPT[0] (empty chat + typing dots) as an idle teaser.
  const [snapIdx, setSnapIdx] = useState(0);
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('chat');

  // Card is interactive AFTER reveal — same pattern as the hero
  // (tap to toggle open/close). Default closed at rest.
  const [cardManualOpen, setCardManualOpen] = useState(false);

  // Snapshot timer — advances chat snapshots on their durationMs.
  // When the last chat snapshot's dwell finishes, transitions
  // revealPhase → 'choice'. The user then clicks one of the two
  // panel buttons to either replay the chat or view the card.
  useEffect(() => {
    if (revealPhase !== 'chat') return;

    if (reduced) {
      // Reduced motion: jump straight to the card. Not gated on
      // in-view — there's no animation to miss, so resolving on
      // mount is fine.
      setSnapIdx(SCROLL_SCRIPT.length - 1);
      setRevealPhase('card');
      return;
    }

    // Hold the timeline until the section scrolls into view — see the
    // `inView` comment above. The phone idles on snapshot 0 until then.
    if (!inView) return;

    const dwell = SCROLL_SCRIPT[snapIdx].durationMs;

    if (snapIdx < SCROLL_SCRIPT.length - 1) {
      const t = window.setTimeout(() => setSnapIdx((i) => i + 1), dwell);
      return () => window.clearTimeout(t);
    }

    // Last chat snapshot — wait its dwell, then surface the choice
    // panel. Pre-empt the action row at the bottom of the snapshot
    // by overlaying the panel on top of the chat surface.
    const t = window.setTimeout(() => setRevealPhase('choice'), dwell);
    return () => window.clearTimeout(t);
  }, [snapIdx, revealPhase, reduced, inView]);

  // Choice handlers — wired to the two buttons inside the phone
  // when revealPhase === 'choice'.
  const handleViewChatAgain = () => {
    setSnapIdx(0);
    setRevealPhase('chat');
  };
  const handleViewCard = () => {
    setRevealPhase('card');
  };

  // Visual state derived from revealPhase. Pure opacity fades.
  // Phone stays visible during chat AND choice (the choice panel
  // overlays the chat surface inside the phone). Card fades in
  // only when the user explicitly picks "View greetings card".
  const phoneVisible = revealPhase === 'chat' || revealPhase === 'choice';
  const cardVisible = revealPhase === 'card';
  const showChoicePanel = revealPhase === 'choice';

  const snapshot = SCROLL_SCRIPT[snapIdx];

  return (
    <section
      ref={sectionRef}
      // overflow-x-clip: the card's bleed wrapper below extends up to
      // -40vw past each side (it assumed a now-removed sticky/overflow
      // ancestor). The card is centred so that horizontal bleed is just
      // offscreen empty canvas — clip it so it can't widen the document
      // (was causing a ~9px horizontal scroll). `clip` (not hidden) keeps
      // overflow-y visible so the intended vertical card bleed survives.
      className="relative overflow-x-clip py-16 md:py-20 lg:py-24"
    >
      {/* Single inner column — normal flow, no sticky, no fixed
          height. Headline at top, stage below (phone → card via
          autoplay). lg:min-h-[85vh] keeps the section feeling
          substantial on big screens. */}
      <div className="w-full max-w-7xl mx-auto px-6 md:px-10 lg:min-h-[85vh] flex flex-col flex-1 min-h-0">
          {/* Headline + subline. Headline pulled in from xl:text-6xl
              to xl:text-5xl 2026-05-06 to give the phone (which is
              ~675px tall on lg) more vertical room below it on common
              laptop heights. */}
          <div className="text-center max-w-3xl mx-auto shrink-0">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-5xl font-semibold text-ink tracking-tight leading-[1.05] lg:whitespace-nowrap">
              <span className="block md:inline">Imagine it.</span>{' '}
              <span className="block md:inline">Describe it.</span>{' '}
              <span className="block md:inline">Send it.</span>
            </h2>
            <p className="mt-5 md:mt-6 text-base md:text-lg text-ink-soft leading-relaxed max-w-[48ch] mx-auto">
              Let your imagination run free. Or{' '}
              <span className="relative inline-block font-medium text-ink whitespace-nowrap">
                brainstorm with AI
                <motion.span
                  aria-hidden
                  className="absolute left-0 right-0 -bottom-0.5 h-[3px] origin-left rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, #5c57d4 0%, #7a76e8 35%, #a78bfa 50%, #7a76e8 65%, #5c57d4 100%)',
                    backgroundSize: '220% 100%',
                  }}
                  initial={
                    reduced
                      ? { scaleX: 1, backgroundPosition: '0% 0%' }
                      : { scaleX: 0, backgroundPosition: '0% 0%' }
                  }
                  animate={
                    reduced
                      ? { scaleX: 1 }
                      : inView
                        ? {
                            scaleX: 1,
                            backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'],
                          }
                        : // Hold un-drawn until the section scrolls into
                          // view — same reasoning as the chat timeline.
                          // Otherwise the underline draws + finishes its
                          // intro sweep before the user ever reaches it.
                          { scaleX: 0 }
                  }
                  transition={
                    reduced
                      ? undefined
                      : {
                          scaleX: { duration: 1, delay: 0.9, ease: 'easeOut' },
                          backgroundPosition: {
                            duration: 6,
                            delay: 2,
                            repeat: Infinity,
                            ease: 'linear',
                          },
                        }
                  }
                />
              </span>{' '}
              to craft the perfect scene.
            </p>
          </div>

          {/* Stage — phone (during chat) → card+hints+CTA (after
              autoplay reveal). Both children are absolute inside
              the stage so they swap in place via opacity. Stage
              has explicit min-height to fit the phone at every
              breakpoint (~675px tall on lg) without crushing it. */}
          <div className="relative flex-1 min-h-[680px] md:min-h-[700px] lg:min-h-[720px] mt-6 md:mt-8 lg:mt-10">
            {/* PHONE — visible during chat AND choice. The choice
                panel overlays the chat surface inside the phone
                screen (rendered by BrainstormScreen). Phone fades
                out only when revealPhase becomes 'card'.
                pointer-events-none flips when phone is faded out so
                its (invisible) hit area doesn't intercept clicks
                meant for the card. */}
            <motion.div
              animate={{ opacity: phoneVisible ? 1 : 0 }}
              transition={{ duration: 0.6, ease: REVEAL_EASE }}
              className={`absolute inset-0 flex items-center justify-center ${
                phoneVisible ? '' : 'pointer-events-none'
              }`}
            >
              <PhoneFrame>
                <BrainstormScreen
                  snapshot={snapshot}
                  showChoice={showChoicePanel}
                  onViewChatAgain={handleViewChatAgain}
                  onViewCard={handleViewCard}
                />
              </PhoneFrame>
            </motion.div>

            {/* CARD STACK — fades in when the user clicks "View
                greetings card". Mirrors the hero's card area
                exactly: same slot breakpoints, same bleed wrapper,
                GestureHints below, auth-aware CTA below that.

                `visibility: hidden` (not just `pointer-events-none`)
                when not visible — visibility cascades to descendants
                and disables hit-testing entirely, so Card3DViewer's
                internal hit-zone div (which explicitly sets
                pointer-events: auto for tap-to-open) cannot
                intercept clicks on the choice panel below. With
                visibility-hidden we can keep Card3DViewer mounted
                AT ALL TIMES — pre-loaded, ready to fade in
                instantly, no Suspense flash on click (Kevin call
                2026-05-06: "the transition to the card is not
                super smooth").

                justify-start + pt: card stack now sits near the
                top of the stage (close to the headline) instead of
                vertically centred — matches the hero's headline →
                card flow (Kevin: "shift up the card with the hints
                and CTA so it more aligns like the 3d card render
                does to the hero headline"). */}
            <motion.div
              animate={{ opacity: cardVisible ? 1 : 0 }}
              transition={{ duration: 0.6, ease: REVEAL_EASE }}
              style={{ visibility: cardVisible ? 'visible' : 'hidden' }}
              className="absolute inset-0 flex flex-col items-center justify-start pt-2 md:pt-4 lg:pt-6"
            >
              {/* Card slot — exact hero breakpoints */}
              <div className="relative w-full max-w-[340px] md:max-w-[340px] lg:max-w-[350px] lg+:max-w-[380px] xl:max-w-[400px] aspect-square mx-auto overflow-visible">
                {/* Bleed wrapper — IDENTICAL negative-vw/vh extents
                    to the hero (Kevin call 2026-05-06: "the reveal
                    of the card is poor — it's clunky and small").
                    Earlier this section used top/bottom -10vh which
                    shrank the canvas dramatically, rendering the
                    card at roughly half the hero's visible size.
                    Sticky inner has overflow-hidden so the bleed
                    can extend visually past the headline / CTA
                    without any pointer-event conflicts (this wrapper
                    is pointer-events-none anyway). */}
                <div
                  className="absolute top-[-30vh] bottom-[-30vh] left-[-25vw] right-[-25vw] lg+:left-[-35vw] lg+:right-[-35vw] xl:left-[-40vw] xl:right-[-40vw] z-[10] pointer-events-none"
                  style={{
                    filter:
                      'drop-shadow(0 28px 40px rgba(15,23,42,0.12))',
                  }}
                >
                  {/* Card3DViewer is ALWAYS mounted — pre-loaded so
                      the click-to-card transition is instant + no
                      Suspense flash. The parent card-stack uses
                      `visibility: hidden` when not visible, which
                      cascades and disables hit-testing for ALL
                      descendants regardless of their pointer-events
                      setting. So even though Card3DViewer's hit zone
                      sets `pointer-events: auto` internally, it
                      cannot intercept clicks on the choice panel
                      below until the card is genuinely revealed. */}
                  <Suspense fallback={<CardLoader />}>
                    <Card3DViewer
                      frontImageUrl={brainstormCardFront}
                      insideImageUrl={brainstormCardInside}
                      backCredit="Made with Celebrait"
                      framingMargin={2.4}
                      minDistance={2.2}
                      enableZoom={false}
                      enableRotate
                      /* Resting ajar (Kevin 2026-06-01) — gentle peek so
                         the revealed card reads as openable. Matches the
                         hero + studio card view (-0.3 rad). */
                      closedAngle={-0.3}
                      /* Slight left angle so the ajar reads as 3D depth. */
                      restYaw={-0.1}
                      open={cardManualOpen}
                      onOpenChange={setCardManualOpen}
                      /* Hit zone hugs the card (2026-06-01) — drop the
                         explicit %-of-bleed-width insets so the hit zone
                         auto-sizes to the card's actual rendered footprint
                         in px, same as the hero + studio card view. The old
                         30% inset over this big bleed wrapper left the
                         interactive area far larger than the card. */
                      className="w-full h-full"
                    />
                  </Suspense>
                </div>
              </div>

              {/* Gesture hints — spacing copied from the hero
                  (Kevin call 2026-05-06: "review the spacing between
                  the hints and the CTA — copy the hero as that's
                  spot on"). mt-12/14, min-h-[64px] to match. */}
              <div className="relative mt-12 md:mt-14 z-[20] min-h-[64px]">
                <GestureHints open={cardManualOpen} hideZoomHint />
              </div>

              {/* CTA stack — spacing copied from hero too: mt-2 md:mt-6,
                  gap-4 between button + caption, -mt-2 on caption. */}
              <div className="relative z-[20] mt-2 md:mt-6 flex flex-col items-center gap-4">
                {showAuthedTreatment ? (
                  <Link href="/studio">
                    <Button className="bg-brand hover:bg-brand-dark text-brand-foreground h-12 px-8 text-base font-medium">
                      Open my studio
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={() => openAuth('/studio/new-card')}
                    className="bg-brand hover:bg-brand-dark text-brand-foreground h-12 px-8 text-base font-medium"
                  >
                    Make my first card
                  </Button>
                )}
                <p className="-mt-2 text-[13px] text-ink-soft">
                  Free to start. No card needed.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
    </section>
  );
}

/* ─── Card loader (Suspense fallback) ────────────────────────────── */

function CardLoader() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-brand animate-spin" strokeWidth={1.75} />
    </div>
  );
}
